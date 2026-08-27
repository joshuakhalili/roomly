-- ═══════════════════════════════════════════════════════════════════════════
-- Tenant profiles, and a standing inventory per room
--
-- Two structural changes:
--
-- 1. A tenant is now a person, not a row inside one letting. You create the
--    profile once and assign it to a room; when that tenancy ends the person
--    remains and can be placed somewhere else. Their passport follows them.
--
-- 2. Every room has its own inventory, set up once with photographs. A
--    tenancy's check-in is seeded from that baseline rather than built from
--    scratch each time — the room's condition is a property of the room.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tenants as reusable profiles ───────────────────────────────────────────

create table tenants (
  id                  uuid primary key default gen_random_uuid(),
  first_name          text not null,
  surname             text not null,
  email               text,
  phone               text,          -- stored E.164 so wa.me links work
  wechat_id           text,
  country_of_origin   text,
  preferred_language  app_language not null default 'en',
  notes               text,
  -- Kept out of the picker once they are no longer a prospect, without
  -- deleting the history of where they lived.
  is_archived         boolean not null default false,
  created_at          timestamptz not null default now()
);
create index on tenants (surname, first_name);

-- A tenancy can hold several tenants; a tenant accumulates tenancies over
-- time. Lead tenant is per tenancy, not per person — someone can lead one
-- letting and not the next.
create table tenancy_tenants (
  tenancy_id      uuid not null references tenancies(id) on delete cascade,
  tenant_id       uuid not null references tenants(id) on delete cascade,
  is_lead_tenant  boolean not null default false,
  created_at      timestamptz not null default now(),
  primary key (tenancy_id, tenant_id)
);
create index on tenancy_tenants (tenant_id);

-- Carry the existing occupants across as profiles.
insert into tenants (id, first_name, surname, email, phone, wechat_id,
                     country_of_origin, preferred_language, notes, created_at)
select id, first_name, surname, email, phone, wechat_id,
       country_of_origin, preferred_language, notes, created_at
from occupants;

insert into tenancy_tenants (tenancy_id, tenant_id, is_lead_tenant)
select tenancy_id, id, is_lead_tenant from occupants;

-- ── Documents split between person and letting ─────────────────────────────
-- Passport and right-to-rent describe the person and are reused if they rent
-- again. A tenancy agreement or deposit certificate describes one letting.

alter table documents add column tenant_id uuid references tenants(id) on delete cascade;
alter table documents alter column tenancy_id drop not null;

update documents set tenant_id = occupant_id where occupant_id is not null;

-- Person-level documents detach from the letting entirely.
update documents
set tenancy_id = null
where doc_type in ('passport', 'right_to_rent') and tenant_id is not null;

alter table documents drop column occupant_id;

-- Must belong to one or the other, never neither.
alter table documents add constraint documents_owner_check
  check (tenant_id is not null or tenancy_id is not null);

drop table occupants;

-- ── Inventories belong to rooms as well as to tenancies ────────────────────

-- ALTER TYPE ... ADD VALUE cannot be used later in the same transaction,
-- so the enum is rebuilt instead.
alter type checklist_type rename to checklist_type_old;
create type checklist_type as enum ('baseline', 'check_in', 'check_out');
alter table inventory_checklists
  alter column type type checklist_type using type::text::checklist_type;
drop type checklist_type_old;

alter table inventory_checklists
  add column room_id uuid references rooms(id) on delete cascade;
alter table inventory_checklists alter column tenancy_id drop not null;

-- A baseline belongs to a room; a check-in/check-out belongs to a tenancy.
alter table inventory_checklists add constraint checklist_owner_check check (
  (type = 'baseline' and room_id is not null and tenancy_id is null) or
  (type <> 'baseline' and tenancy_id is not null)
);

-- One baseline per room.
create unique index inventory_checklists_room_baseline
  on inventory_checklists (room_id) where type = 'baseline';

-- ── Scaffolding, as one shared definition ──────────────────────────────────
-- Both the room-baseline trigger and the application call this, so there is
-- only ever one description of what a fresh checklist contains.

create or replace function scaffold_checklist(p_checklist_id uuid, p_unit_type unit_type)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  new_area_id uuid;
  i int := 0;
begin
  for d in
    select at.id as area_type_id, at.name, uad.sort_order
    from unit_area_defaults uad
    join area_types at on at.id = uad.area_type_id
    where uad.unit_type = p_unit_type
    order by uad.sort_order
  loop
    i := i + 1;
    insert into checklist_areas (checklist_id, area_type_id, name, sort_order)
    values (p_checklist_id, d.area_type_id, d.name, i)
    returning id into new_area_id;

    -- Templates are copied, not referenced: editing a template later must
    -- not alter a report that has already been completed.
    insert into checklist_sections
      (checklist_area_id, section_template_id, section_name, sort_order)
    select new_area_id, cst.id, cst.section_name, cst.sort_order
    from checklist_section_templates cst
    where cst.area_type_id = d.area_type_id
    order by cst.sort_order;
  end loop;
end $$;

-- Every new room gets its inventory immediately, however it was created.
create or replace function create_room_baseline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_checklist_id uuid;
begin
  if new.is_lettable or new.is_common_area then
    insert into inventory_checklists (room_id, type, status)
    values (new.id, 'baseline', 'draft')
    returning id into new_checklist_id;

    perform scaffold_checklist(new_checklist_id, new.unit_type);
  end if;
  return new;
end $$;

create trigger on_room_created
  after insert on rooms
  for each row execute function create_room_baseline();

-- Give the rooms that already exist their baseline too.
do $$
declare
  r record;
  new_checklist_id uuid;
begin
  for r in select id, unit_type from rooms loop
    insert into inventory_checklists (room_id, type, status)
    values (r.id, 'baseline', 'draft')
    on conflict do nothing
    returning id into new_checklist_id;

    if new_checklist_id is not null then
      perform scaffold_checklist(new_checklist_id, r.unit_type);
    end if;
  end loop;
end $$;

/**
 * Seeds a tenancy's check-in from its room's baseline.
 *
 * Structure, ratings and notes carry over so the admin starts from the
 * room's known condition rather than a blank form. Photographs deliberately
 * do not: a check-in needs pictures of the condition on that day, and
 * copying hundreds of images per tenancy would exhaust storage. The
 * baseline's own photos stay available alongside as the reference.
 */
create or replace function seed_checklist_from_baseline(
  p_checklist_id uuid, p_room_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  baseline_id uuid;
  a record;
  new_area_id uuid;
begin
  select id into baseline_id
  from inventory_checklists
  where room_id = p_room_id and type = 'baseline';

  if baseline_id is null then return false; end if;

  for a in
    select * from checklist_areas where checklist_id = baseline_id order by sort_order
  loop
    insert into checklist_areas (checklist_id, area_type_id, name, sort_order)
    values (p_checklist_id, a.area_type_id, a.name, a.sort_order)
    returning id into new_area_id;

    insert into checklist_sections
      (checklist_area_id, section_template_id, section_name, sort_order,
       condition_rating, cleanliness_rating, description)
    select new_area_id, s.section_template_id, s.section_name, s.sort_order,
           s.condition_rating, s.cleanliness_rating, s.description
    from checklist_sections s
    where s.checklist_area_id = a.id
    order by s.sort_order;
  end loop;

  return true;
end $$;

-- ── RLS for the new tables ─────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['tenants', 'tenancy_tenants'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "admins_full_access" on %I for all
         to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;
