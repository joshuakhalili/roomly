-- ═══════════════════════════════════════════════════════════════════════════
-- Maintenance: the work, who does it, and what you own
--
-- Three stubs already existed waiting for this and were dead ends without it:
--
--   checklist_sections.flagged_for_maintenance — every inventory check could
--   flag a defect, the report rolled them into a Summary of Defects, and then
--   nothing consumed them. A list you cannot act on.
--
--   documents.supplier_name / .amount and the 'maintenance_invoice',
--   'warranty' and 'insurance' types — added with the document library, never
--   written to, because nothing recorded the work the invoice was for.
--
--   The nightly cleaning prompt — raised for seven days after a tenancy ends,
--   with no date, no cleaner and no cost behind it.
--
-- This connects them. The organising idea is that a job is one object whether
-- it recurs, is triggered, or is booked once: a weekly clean, the turnaround
-- clean when a tenant leaves, and a gas engineer coming out on Thursday are
-- the same shape, and belong on the same calendar.
-- ═══════════════════════════════════════════════════════════════════════════

create type job_status          as enum ('booked', 'done', 'cancelled');
create type job_source          as enum ('manual', 'recurring', 'tenancy_end');
create type recurrence_frequency as enum ('weekly', 'fortnightly', 'monthly');

-- ── What kind of work ──────────────────────────────────────────────────────
-- An editable list rather than an enum. The categories arrived one at a time
-- while this was being designed — cleaning, then landscaping — which is a
-- reliable sign there is a fifth coming. An enum would make pest control or
-- window cleaning a migration and a deploy.
--
-- The same list types a contact: a job IS cleaning, a contact DOES cleaning.
-- Two near-identical lists would drift apart within a month.
--
-- slug is set on the seeded rows only. It does two jobs: it is how code finds
-- a category without matching on a name someone may rename, and it is the
-- translation key so the defaults read correctly in Chinese. Rows added by an
-- admin have no slug and show exactly the text that was typed.

create table service_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique,
  sort_order  int not null default 0,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now()
);

insert into service_types (name, slug, sort_order) values
  ('Cleaning',     'cleaning',    1),
  ('Landscaping',  'landscaping', 2),
  ('Repair',       'repair',      3),
  ('Plumbing',     'plumbing',    4),
  ('Electrical',   'electrical',  5),
  ('Gas',          'gas',         6),
  ('Inspection',   'inspection',  7);

-- ── Who does it ────────────────────────────────────────────────────────────
-- One global address book, not a list per building. usual_property_id is a
-- hint for prefilling, deliberately not a restriction — the cleaner who
-- normally does one house can obviously be booked for another.

create table contacts (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  company           text,
  service_type_id   uuid references service_types(id) on delete set null,
  -- E.164, same as tenants: the wa.me link silently fails on anything else.
  phone             text,
  email             text,
  usual_property_id uuid references properties(id) on delete set null,
  notes             text,
  is_archived       boolean not null default false,
  created_at        timestamptz not null default now()
);
create index on contacts (service_type_id);

-- ── What you own ───────────────────────────────────────────────────────────
-- Deliberately NOT the inventory checklist, and named so the two are never
-- confused. They describe the same washing machine for opposite purposes:
--
--   A checklist section is a frozen snapshot — "Good condition, no damage,
--   photographed on 3 September" — and its value comes from never changing,
--   because it settles a deposit dispute.
--
--   An asset is a live record — bought here, cost this, covered until then —
--   and its value comes from staying current.
--
-- Merging them would ruin both. Assets are also forward-only: nobody is
-- back-filling twenty years of furniture, you start at the next purchase.

create table assets (
  id                  uuid primary key default gen_random_uuid(),
  property_id         uuid not null references properties(id) on delete cascade,
  -- Null means it belongs to the building rather than one room — a boiler,
  -- a communal washing machine.
  room_id             uuid references rooms(id) on delete set null,
  name                text not null,
  make_model          text,
  serial_number       text,
  purchased_on        date,
  cost                numeric(10,2),
  supplier_name       text,
  warranty_expires_on date,
  notes               text,
  -- Kept rather than deleted when it is thrown out: the spend was real and
  -- should stay in the property's history.
  is_disposed         boolean not null default false,
  created_at          timestamptz not null default now()
);
create index on assets (property_id);
create index on assets (room_id);
create index on assets (warranty_expires_on) where warranty_expires_on is not null;

-- ── Standing arrangements ──────────────────────────────────────────────────
-- The pattern rent already uses: store the rule, and let the nightly job
-- materialise real rows ahead of it. A job you can see on a calendar and
-- mark paid has to be a row; computing it live would leave nothing to edit.
--
-- ends_on exists mainly for grounds work, which is seasonal — fortnightly
-- through summer and nothing in February. Without it you would spend every
-- winter cancelling jobs you never wanted.

create table job_recurrences (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references properties(id) on delete cascade,
  room_id         uuid references rooms(id) on delete set null,
  service_type_id uuid references service_types(id) on delete set null,
  contact_id      uuid references contacts(id) on delete set null,
  title           text not null,
  frequency       recurrence_frequency not null,
  -- 0 = Sunday, matching JavaScript's getDay(). Used by weekly/fortnightly.
  day_of_week     int check (day_of_week between 0 and 6),
  -- Clamped to the last day of shorter months when materialised, exactly as
  -- the rent due day is.
  day_of_month    int check (day_of_month between 1 and 31),
  cost            numeric(10,2),
  starts_on       date not null,
  ends_on         date,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
create index on job_recurrences (property_id);

-- ── The work itself ────────────────────────────────────────────────────────

create table maintenance_jobs (
  id                   uuid primary key default gen_random_uuid(),
  property_id          uuid not null references properties(id) on delete cascade,
  -- Null for anything that belongs to the building rather than a room.
  -- Grounds work is never per-room, which is why this cannot be required.
  room_id              uuid references rooms(id) on delete set null,
  service_type_id      uuid references service_types(id) on delete set null,
  contact_id           uuid references contacts(id) on delete set null,

  title                text not null,
  description          text,
  scheduled_for        date not null,
  -- Optional: a gas engineer gives you a slot, a gardener gives you a day.
  scheduled_time       time,
  status               job_status not null default 'booked',
  completed_on         date,

  -- Cost and payment are separate states on purpose. The work being finished
  -- and the invoice being settled are different facts, and keeping them apart
  -- is what lets this add up to real expense tracking per property.
  cost                 numeric(10,2),
  is_paid              boolean not null default false,
  paid_on              date,

  -- Where the job came from, so a recurring or automatic one can be told
  -- apart from something deliberately booked.
  source               job_source not null default 'manual',
  recurrence_id        uuid references job_recurrences(id) on delete set null,

  -- What it is about, all optional: the defect it fixes, the appliance it
  -- services, the tenancy whose ending caused it.
  checklist_section_id uuid references checklist_sections(id) on delete set null,
  asset_id             uuid references assets(id) on delete set null,
  tenancy_id           uuid references tenancies(id) on delete set null,

  notes                text,
  created_at           timestamptz not null default now()
);
create index on maintenance_jobs (property_id);
create index on maintenance_jobs (scheduled_for);
create index on maintenance_jobs (status);
create index on maintenance_jobs (checklist_section_id) where checklist_section_id is not null;

-- One turnaround clean per tenancy, however many times the nightly job runs.
-- The same guard rent uses, for the same reason: a job that re-runs must not
-- re-create what it made yesterday.
create unique index maintenance_jobs_one_turnaround_per_tenancy
  on maintenance_jobs (tenancy_id)
  where source = 'tenancy_end';

-- A recurrence must not produce two jobs for the same day either.
create unique index maintenance_jobs_one_per_recurrence_date
  on maintenance_jobs (recurrence_id, scheduled_for)
  where recurrence_id is not null;

-- ── Paperwork ──────────────────────────────────────────────────────────────
-- The invoice for a job and the receipt for a purchase are documents like any
-- other — they belong in the library with the insurance and the gas
-- certificates. These columns are what let them be filed from inside
-- Maintenance instead of uploaded a second time by hand.

alter table documents add column maintenance_job_id uuid references maintenance_jobs(id) on delete cascade;
alter table documents add column asset_id uuid references assets(id) on delete cascade;

create index on documents (maintenance_job_id);
create index on documents (asset_id);

alter table documents drop constraint documents_owner_check;
alter table documents add constraint documents_owner_check check (
  tenant_id is not null or tenancy_id is not null
  or property_id is not null or room_id is not null
  or maintenance_job_id is not null or asset_id is not null
  or is_company_wide
);

-- 'receipt' is genuinely distinct from an invoice: one proves you bought the
-- thing, the other bills you for work. Warranty claims want the receipt.
alter type document_type add value if not exists 'receipt';

-- ── RLS ────────────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'service_types', 'contacts', 'assets', 'job_recurrences', 'maintenance_jobs'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "admins_full_access" on %I for all
         to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- ── Settings ───────────────────────────────────────────────────────────────

insert into app_settings (key, value, description) values
  ('turnaround_clean_days', '2',
   'Days after a tenancy ends to schedule the turnaround clean. Set to 0 to stop creating them automatically.'),
  ('job_horizon_months', '3',
   'How far ahead recurring jobs are created.')
on conflict (key) do nothing;
