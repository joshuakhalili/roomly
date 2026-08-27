-- ═══════════════════════════════════════════════════════════════════════════
-- Separate "what you let" from "what you inspect"
--
-- The first cut conflated two different things under room_types: the kind of
-- unit a tenant rents, and the kind of space inside it. They are not the
-- same list. A tenant rents a studio or a flat. A kitchen is never let on
-- its own — it only exists as an area on an inventory report.
--
--   rooms.unit_type   'studio' | 'flat'        ← what a tenancy is attached to
--   area_types        Kitchen, Bedroom, …      ← what a checklist inspects
--
-- The checklist hierarchy now matches a real Schedule of Condition:
--   checklist → area ("3: Kitchen") → section ("3:5 Kitchen Units") → photos
-- ═══════════════════════════════════════════════════════════════════════════

create type unit_type as enum ('studio', 'flat');

alter table rooms add column unit_type unit_type not null default 'studio';

-- Anything previously typed as a whole-dwelling stays a flat; everything
-- else becomes a studio. Only demo rows exist at this point.
update rooms r
set unit_type = 'flat'
from room_types rt
where r.room_type_id = rt.id
  and rt.name in ('Flat', 'Living Room', 'Entrance/Hallway');

alter table rooms drop column room_type_id;

-- ── room_types becomes area_types ──────────────────────────────────────────
alter table room_types rename to area_types;
alter table checklist_section_templates rename column room_type_id to area_type_id;

-- Studio Room is the combined living/sleeping/kitchenette space in a studio;
-- there was no equivalent when these were "room types".
insert into area_types (name, sort_order) values ('Studio Room', 0)
on conflict (name) do nothing;

-- 'Studio' and 'Common Area' were unit-shaped, not area-shaped. Their old
-- section templates go with them.
delete from checklist_section_templates
where area_type_id in (select id from area_types where name in ('Studio', 'Common Area'));
delete from area_types where name in ('Studio', 'Common Area');

-- ── Which areas each kind of unit gets by default ──────────────────────────
-- Scaffolding only: an admin can add or remove areas on any given checklist
-- (a two-bedroom flat gets a second Bedroom; a studio with no separate
-- hallway loses that one).
create table unit_area_defaults (
  unit_type     unit_type not null,
  area_type_id  uuid not null references area_types(id) on delete cascade,
  sort_order    int not null default 0,
  primary key (unit_type, area_type_id)
);

insert into unit_area_defaults (unit_type, area_type_id, sort_order)
select 'studio', id, sort_order from area_types
where name in ('Studio Room', 'Bathroom');

insert into unit_area_defaults (unit_type, area_type_id, sort_order)
select 'flat', id, sort_order from area_types
where name in ('Entrance/Hallway', 'Living Room', 'Kitchen', 'Bathroom', 'Bedroom');

-- ── Checklist hierarchy ────────────────────────────────────────────────────
-- Safe to drop and rebuild: no checklist has been created yet.
drop table if exists checklist_photos cascade;
drop table if exists checklist_room_sections cascade;

create table checklist_areas (
  id            uuid primary key default gen_random_uuid(),
  checklist_id  uuid not null references inventory_checklists(id) on delete cascade,
  area_type_id  uuid references area_types(id) on delete set null,
  -- Display name, so a two-bed flat can hold "Bedroom 1" and "Bedroom 2"
  -- without needing two area types.
  name          text not null,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
create index on checklist_areas (checklist_id);

create table checklist_sections (
  id                       uuid primary key default gen_random_uuid(),
  checklist_area_id        uuid not null references checklist_areas(id) on delete cascade,
  section_template_id      uuid references checklist_section_templates(id) on delete set null,
  section_name             text not null,
  sort_order               int not null default 0,
  condition_rating         condition_rating,
  cleanliness_rating       condition_rating,
  description              text,
  flagged_for_maintenance  boolean not null default false,
  entry_date               date not null default current_date,
  created_at               timestamptz not null default now()
);
create index on checklist_sections (checklist_area_id);

create table checklist_photos (
  id                    uuid primary key default gen_random_uuid(),
  checklist_section_id  uuid not null references checklist_sections(id) on delete cascade,
  storage_path          text not null,
  caption               text,
  taken_at              timestamptz not null default now(),
  file_size             bigint,
  sort_order            int not null default 0,
  created_at            timestamptz not null default now()
);
create index on checklist_photos (checklist_section_id);

-- ── Re-apply RLS to the new tables ─────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'unit_area_defaults', 'checklist_areas', 'checklist_sections', 'checklist_photos'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "admins_full_access" on %I for all
         to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- ── Studio Room sections ───────────────────────────────────────────────────
-- A studio's main space contains the kitchenette and sleeping area, so its
-- section list is longer than a plain bedroom's.
do $$
declare
  studio_id uuid;
  sections text[] := array[
    'General Overview','Ceiling','Doors','Flooring','Heating','Lighting',
    'Switches/Sockets','Walls','Windows','Curtains/Blinds','Fixtures',
    'Furnishings','Bed','Wardrobe/Storage','Kitchen Units','Worktops','Sink',
    'Oven/Hob/Extractor Fan','Fridge/Freezer','Electricals','Room Items'
  ];
  i int;
begin
  select id into studio_id from area_types where name = 'Studio Room';
  for i in 1 .. array_length(sections, 1) loop
    insert into checklist_section_templates (area_type_id, section_name, sort_order)
    values (studio_id, sections[i], i)
    on conflict (area_type_id, section_name) do nothing;
  end loop;
end $$;
