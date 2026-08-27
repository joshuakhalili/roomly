-- ═══════════════════════════════════════════════════════════════════════════
-- Lettings Manager — initial schema
--
-- Security model: every table has Row Level Security ON, and the only policy
-- is "you must be a signed-in admin". There are no tenant logins and no
-- anonymous access anywhere — if you are not authenticated, you see nothing.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Enums ──────────────────────────────────────────────────────────────────
-- Postgres enums rather than free-text status columns: a typo becomes an
-- error at write time instead of a row that silently never matches a filter.

create type tenancy_status      as enum ('upcoming', 'active', 'ended', 'archived');
create type rent_frequency      as enum ('weekly', 'fortnightly', 'four_weekly', 'monthly');
create type rent_payment_status as enum ('due', 'paid', 'late', 'waived');
create type condition_rating    as enum ('excellent', 'good', 'fair', 'poor', 'unacceptable');
create type checklist_type      as enum ('check_in', 'check_out');
create type checklist_status    as enum ('draft', 'completed');
create type document_type       as enum ('passport', 'right_to_rent', 'tenancy_agreement',
                                         'deposit_certificate', 'handbook', 'other');
create type declaration_role    as enum ('assessor', 'tenant');
create type detector_type       as enum ('smoke', 'co');
create type meter_type          as enum ('electricity', 'gas', 'water');
create type app_language        as enum ('en', 'zh');
create type leaving_reason      as enum ('end_of_term', 'tenant_gave_notice',
                                         'given_notice_by_admin', 'other');

-- ── Admin profiles ─────────────────────────────────────────────────────────
-- Mirrors auth.users. Every row is a full-permission admin; there are no
-- role tiers by design. Adding an admin is inserting a row, not a schema change.

create table profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  email                text not null,
  display_name         text,
  preferred_language   app_language not null default 'en',
  -- Secret token in the calendar subscription URL. Calendar apps can't log in,
  -- so this token IS the access control for that feed — hence regenerable.
  calendar_feed_token  text not null unique default encode(gen_random_bytes(32), 'hex'),
  email_digest_opt_in  boolean not null default false,
  created_at           timestamptz not null default now()
);

-- ── Properties & rooms ─────────────────────────────────────────────────────

create table properties (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  notes       text,
  created_at  timestamptz not null default now()
);

create table room_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  sort_order  int  not null default 0
);

-- The reusable inventory template. Adding a section to "Bedroom" here means
-- every future bedroom checklist gets it — no code change.
create table checklist_section_templates (
  id            uuid primary key default gen_random_uuid(),
  room_type_id  uuid not null references room_types(id) on delete cascade,
  section_name  text not null,
  sort_order    int  not null default 0,
  unique (room_type_id, section_name)
);

create table rooms (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references properties(id) on delete cascade,
  room_type_id    uuid references room_types(id) on delete set null,
  name            text not null,
  -- A shared kitchen is a room for inventory purposes but can't be let alone.
  is_common_area  boolean not null default false,
  is_lettable     boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now()
);
create index on rooms (property_id);

create table bank_accounts (
  id             uuid primary key default gen_random_uuid(),
  bank_name      text not null,
  account_label  text not null,
  notes          text,
  created_at     timestamptz not null default now()
);

-- ── Tenancies & occupants ──────────────────────────────────────────────────
-- Rent/deposit/dates live on the tenancy (shared by everyone in the room);
-- names/phones/documents live on the occupant. That split is what lets a
-- couple share one room's rent while each keeps their own passport on file.

create table tenancies (
  id                    uuid primary key default gen_random_uuid(),
  room_id               uuid not null references rooms(id) on delete cascade,
  bank_account_id       uuid references bank_accounts(id) on delete set null,
  status                tenancy_status not null default 'upcoming',
  start_date            date not null,
  end_date              date,
  rent_amount           numeric(10,2) not null,
  rent_frequency        rent_frequency not null default 'monthly',
  -- Day of month rent falls due, taken from the move-in date. Clamped to the
  -- last day of shorter months at generation time (see the rent job).
  rent_due_day          int check (rent_due_day between 1 and 31),
  deposit_amount        numeric(10,2),
  deposit_scheme_name   text,
  deposit_scheme_ref    text,
  reason_for_leaving    leaving_reason,
  reason_notes          text,
  notes                 text,
  -- Starts the 5-year retention clock. Null until an admin archives it.
  archived_at           timestamptz,
  created_at            timestamptz not null default now()
);
create index on tenancies (room_id);
create index on tenancies (status);
create index on tenancies (archived_at) where archived_at is not null;

create table occupants (
  id                  uuid primary key default gen_random_uuid(),
  tenancy_id          uuid not null references tenancies(id) on delete cascade,
  first_name          text not null,
  surname             text not null,
  email               text,
  -- Stored E.164 (+447…) so the wa.me reminder link works without cleanup.
  phone               text,
  wechat_id           text,
  country_of_origin   text,
  preferred_language  app_language not null default 'en',
  is_lead_tenant      boolean not null default false,
  notes               text,
  created_at          timestamptz not null default now()
);
create index on occupants (tenancy_id);

create table documents (
  id           uuid primary key default gen_random_uuid(),
  occupant_id  uuid references occupants(id) on delete cascade,
  tenancy_id   uuid not null references tenancies(id) on delete cascade,
  doc_type     document_type not null,
  file_name    text not null,
  storage_path text not null,
  file_size    bigint,
  notes        text,
  uploaded_at  timestamptz not null default now()
);
create index on documents (tenancy_id);
create index on documents (occupant_id);

-- ── Rent ───────────────────────────────────────────────────────────────────
-- Rows are materialised ahead of time by the daily job rather than computed
-- live, so "mark as paid" has a concrete row to update. "Last paid" and
-- "next due" are derived from this table, never stored separately — they
-- can't drift out of sync with the actual payment record.

create table rent_payments (
  id          uuid primary key default gen_random_uuid(),
  tenancy_id  uuid not null references tenancies(id) on delete cascade,
  due_date    date not null,
  amount_due  numeric(10,2) not null,
  status      rent_payment_status not null default 'due',
  paid_at     timestamptz,
  notes       text,
  created_at  timestamptz not null default now(),
  unique (tenancy_id, due_date)
);
create index on rent_payments (due_date);
create index on rent_payments (status);

-- ── Inventory checklists ───────────────────────────────────────────────────
-- check_in and check_out are two rows of the same shape sharing a tenancy.
-- That's what makes the side-by-side comparison a plain join rather than a
-- special case.

create table inventory_checklists (
  id             uuid primary key default gen_random_uuid(),
  tenancy_id     uuid not null references tenancies(id) on delete cascade,
  type           checklist_type not null,
  status         checklist_status not null default 'draft',
  assessor_name  text,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  unique (tenancy_id, type)
);
create index on inventory_checklists (tenancy_id);

create table checklist_room_sections (
  id                       uuid primary key default gen_random_uuid(),
  checklist_id             uuid not null references inventory_checklists(id) on delete cascade,
  room_id                  uuid not null references rooms(id) on delete cascade,
  -- Kept nullable so an admin can add a one-off section for a property quirk
  -- without polluting the reusable template.
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
create index on checklist_room_sections (checklist_id);
create index on checklist_room_sections (room_id);

create table checklist_photos (
  id                          uuid primary key default gen_random_uuid(),
  checklist_room_section_id   uuid not null references checklist_room_sections(id) on delete cascade,
  storage_path                text not null,
  caption                     text,
  -- Defaults to upload time but editable — photos are often taken before upload.
  taken_at                    timestamptz not null default now(),
  file_size                   bigint,
  sort_order                  int not null default 0,
  created_at                  timestamptz not null default now()
);
create index on checklist_photos (checklist_room_section_id);

-- The compact permanent record. Its existence is the precondition for
-- purging the originals above.
create table checklist_pdf_exports (
  id            uuid primary key default gen_random_uuid(),
  checklist_id  uuid not null references inventory_checklists(id) on delete cascade,
  storage_path  text not null,
  file_size     bigint,
  generated_at  timestamptz not null default now(),
  photos_purged_at timestamptz
);
create index on checklist_pdf_exports (checklist_id);

-- ── Report-level checklist data ────────────────────────────────────────────

create table checklist_meters (
  id            uuid primary key default gen_random_uuid(),
  checklist_id  uuid not null references inventory_checklists(id) on delete cascade,
  meter_type    meter_type not null,
  reading       text,
  reading_date  date,
  location      text,
  serial_number text
);

create table checklist_keys (
  id            uuid primary key default gen_random_uuid(),
  checklist_id  uuid not null references inventory_checklists(id) on delete cascade,
  description   text not null,
  quantity      int not null default 1,
  comments      text
);

create table checklist_detectors (
  id             uuid primary key default gen_random_uuid(),
  checklist_id   uuid not null references inventory_checklists(id) on delete cascade,
  detector_type  detector_type not null,
  location       text,
  tested         boolean not null default false,
  comments       text
);

-- Lightweight signature: typed name + timestamp. Adequate for an internal
-- condition report; deliberately NOT a substitute for a signed tenancy
-- agreement, which stays an uploaded document.
create table checklist_declarations (
  id            uuid primary key default gen_random_uuid(),
  checklist_id  uuid not null references inventory_checklists(id) on delete cascade,
  role          declaration_role not null,
  typed_name    text not null,
  email         text,
  signed_at     timestamptz not null default now()
);

-- ── Messaging, notifications, analytics ────────────────────────────────────

create table message_templates (
  id            uuid primary key default gen_random_uuid(),
  template_key  text not null,
  language      app_language not null,
  body_text     text not null,
  unique (template_key, language)
);

-- Records which alerts have already fired, so the dashboard doesn't re-raise
-- the same event every time someone loads the page that day.
create table notifications_log (
  id                 uuid primary key default gen_random_uuid(),
  tenancy_id         uuid references tenancies(id) on delete cascade,
  rent_payment_id    uuid references rent_payments(id) on delete cascade,
  notification_type  text not null,
  fired_for_date     date not null,
  created_at         timestamptz not null default now(),
  unique (notification_type, fired_for_date, tenancy_id, rent_payment_id)
);
create index on notifications_log (fired_for_date);

-- Written once a day by the cron job. A live query can only ever answer
-- "right now" — this table is the only reason trend charts are possible.
create table metrics_snapshots (
  snapshot_date       date primary key,
  occupied_rooms      int not null,
  vacant_rooms        int not null,
  total_active_rent   numeric(12,2) not null,
  overdue_rent_total  numeric(12,2) not null,
  created_at          timestamptz not null default now()
);

create table archive_log (
  id           uuid primary key default gen_random_uuid(),
  tenancy_id   uuid,
  action       text not null,
  actor        text,
  details      text,
  occurred_at  timestamptz not null default now()
);

-- App-wide settings kept as data, not constants in code, so retention
-- periods can be changed without a deploy.
create table app_settings (
  key         text primary key,
  value       text not null,
  description text
);

insert into app_settings (key, value, description) values
  ('retention_years',        '5',  'Years after archiving before a tenancy is permanently deleted'),
  ('photo_purge_days',       '30', 'Days after PDF export before original checklist photos are deleted'),
  ('purge_photos_on_tenancy_end', 'true', 'Also purge photos once the tenancy has ended, if a PDF exists');

-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security
--
-- One helper + one policy per table. Every admin has identical full access;
-- nobody unauthenticated has any.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from profiles where id = auth.uid());
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'properties', 'room_types', 'checklist_section_templates', 'rooms',
    'bank_accounts', 'tenancies', 'occupants', 'documents', 'rent_payments',
    'inventory_checklists', 'checklist_room_sections', 'checklist_photos',
    'checklist_pdf_exports', 'checklist_meters', 'checklist_keys',
    'checklist_detectors', 'checklist_declarations', 'message_templates',
    'notifications_log', 'metrics_snapshots', 'archive_log', 'app_settings'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "admins_full_access" on %I for all
         to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- ── New signups become admins automatically ────────────────────────────────
-- There are no non-admin users in this system, so any account created (via
-- the in-app "Add admin" screen or the Supabase dashboard) gets a profile.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', new.email))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
