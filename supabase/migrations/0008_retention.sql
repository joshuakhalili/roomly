-- ═══════════════════════════════════════════════════════════════════════════
-- Data retention, to the periods UK law actually sets
--
-- The original plan assumed one flat five-year period for everything. That
-- was wrong in both directions, and the two errors pull opposite ways:
--
--   Too LONG for identity documents. The Home Office's landlord guide (26
--   June 2025, p.31) is not a "keep at least" — it is an instruction to
--   destroy: "You must retain the copies securely for at least one year
--   after the tenancy agreement comes to an end. The copies must then be
--   securely destroyed." Holding a tenant's passport scan for five years is
--   a breach, not caution.
--
--   Too SHORT for tenancy and money records. The Limitation Act 1980 gives
--   six years to bring a claim on a simple contract, and HMRC wants business
--   records for five years after the 31 January filing deadline — which for
--   a tax year ending in April lands close to six. Deleting at five could
--   destroy your own evidence while you are still defensible against a claim.
--
-- So retention is per-category, each with the rule it comes from, and the
-- clock starts when the tenancy ends rather than when the file was uploaded.
--
-- UK GDPR sets no fixed number anywhere. Article 5(1)(e) says personal data
-- may be kept "no longer than is necessary"; these periods are how long is
-- necessary, evidenced. Storing them as data with their legal basis attached
-- is the accountability principle in Article 5(2) — being able to show why,
-- not just assert it.
-- ═══════════════════════════════════════════════════════════════════════════

create type retention_category as enum (
  'identity_documents',
  'tenancy_records',
  'inventory_photos'
);

create table retention_rules (
  category      retention_category primary key,
  period_months int not null,
  clock_starts  text not null,
  legal_basis   text not null,
  -- The distinction that matters. Where this is true the period is a
  -- ceiling the law imposes and erasure is required. Where it is false the
  -- period is a floor we keep to for our own protection, and erasure after
  -- it is our own storage-limitation decision.
  destruction_required boolean not null default false,
  notes         text
);

insert into retention_rules
  (category, period_months, clock_starts, legal_basis, destruction_required, notes)
values
  ('identity_documents', 12, 'the day the tenancy ends',
   'Home Office, Landlord''s guide to right to rent checks (26 June 2025): copies must be retained for the duration of the tenancy and at least one year thereafter, and "must then be securely destroyed".',
   true,
   'Covers ID documents, right to rent evidence and reference checks. Destroying these on time is itself the compliance obligation — they are the most sensitive records here and the shortest-lived.'),

  ('tenancy_records', 72, 'the day the tenancy ends',
   'Limitation Act 1980 s.5 — six years to bring a claim on a simple contract. HMRC requires business records for five years after the 31 January filing deadline, which falls inside the same window.',
   false,
   'Tenancy agreements, deposit paperwork, rent history, inventory reports and the tenant''s own record. Kept while a claim could still be brought, erased once it cannot.'),

  ('inventory_photos', 0, 'the day the PDF report is generated',
   'No statutory period. The report preserves the visual record, so the originals stop being necessary once it exists — UK GDPR Article 5(1)(e).',
   false,
   'Governed by the photo_purge_days setting rather than a fixed number of months, since the trigger is the export rather than the tenancy.');

-- ── Legal hold ─────────────────────────────────────────────────────────────
-- A dispute suspends the clock. Erasing records during a deposit
-- arbitration or a rent claim destroys the evidence you are about to need,
-- and "the automatic job deleted it" is not a defence. Every view below
-- excludes held tenancies, so this is one flag rather than a special case
-- scattered across the jobs.

alter table tenancies add column legal_hold boolean not null default false;
alter table tenancies add column legal_hold_reason text;

-- ── The erasure log ────────────────────────────────────────────────────────
-- Article 5(2) again: you have to be able to demonstrate compliance, which
-- means a record that erasure happened.
--
-- The trap is that a naive audit log rebuilds what it just erased. Writing
-- "deleted passport scan for Wei Zhang, +44 7700 900123" leaves the
-- identifying data sitting in a table that no retention rule covers, which
-- defeats the entire exercise. So subject_label is deliberately
-- non-identifying — a room and a date, never a name, and the code that
-- writes it is responsible for keeping it that way.

create table data_erasures (
  id             uuid primary key default gen_random_uuid(),
  category       retention_category not null,
  subject_type   text not null,
  subject_id     uuid,
  subject_label  text,
  due_date       date,
  records_deleted int not null default 0,
  files_deleted   int not null default 0,
  bytes_freed     bigint not null default 0,
  -- A planned run writes rows here too, so what the job would have done is
  -- inspectable before it is allowed to do it.
  dry_run        boolean not null default false,
  erased_at      timestamptz not null default now()
);
create index on data_erasures (erased_at desc);
create index on data_erasures (dry_run);

-- ── Helper ─────────────────────────────────────────────────────────────────

create or replace function retention_months(cat retention_category)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select period_months from retention_rules where category = cat;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- What is due
--
-- These views are the single source of truth for both the dry run and the
-- live run. That is the whole point of them: if the preview computed its
-- list separately from the deletion, the two could drift and the preview
-- would be worse than useless — it would be false assurance about an
-- irreversible operation.
-- ═══════════════════════════════════════════════════════════════════════════

-- A tenant is reusable across tenancies, so their clock cannot be read from
-- any single one. It runs from the last tenancy to end, and does not run at
-- all while one is still live.
create or replace view tenant_retention_clock
with (security_invoker = true) as
select
  t.id                                                as tenant_id,
  coalesce(bool_or(ten.status in ('upcoming', 'active')), false) as has_live_tenancy,
  coalesce(bool_or(ten.legal_hold), false)            as on_legal_hold,
  count(ten.id)                                       as tenancy_count,
  max(ten.end_date)                                   as last_ended_on,
  -- An open-ended tenancy that has ended without a recorded end date leaves
  -- the clock unstartable. Better to surface that than to guess a date and
  -- erase against it.
  bool_or(ten.status in ('ended', 'archived') and ten.end_date is null) as has_undated_end
from tenants t
left join tenancy_tenants tt on tt.tenant_id = t.id
left join tenancies ten      on ten.id = tt.tenancy_id
group by t.id;

-- Identity paperwork: the twelve-month rule.
create or replace view identity_documents_due
with (security_invoker = true) as
select
  d.id            as document_id,
  d.doc_type,
  d.storage_path,
  coalesce(d.file_size, 0) as file_size,
  clock.ended_on,
  (clock.ended_on + make_interval(months => retention_months('identity_documents')))::date as due_date,
  clock.room_label
from documents d
join lateral (
  select
    case when d.tenant_id is not null then trc.last_ended_on else ten.end_date end as ended_on,
    case
      when d.tenant_id is not null
        then trc.has_live_tenancy or trc.on_legal_hold or trc.has_undated_end
      else ten.status in ('upcoming', 'active') or ten.legal_hold
    end as blocked,
    coalesce(r.name, 'unassigned') as room_label
  from (select 1) _
  left join tenant_retention_clock trc on d.tenant_id  is not null and trc.tenant_id = d.tenant_id
  left join tenancies ten              on d.tenancy_id is not null and ten.id = d.tenancy_id
  left join rooms r                    on r.id = ten.room_id
) clock on true
where d.doc_type in ('id_document', 'right_to_rent', 'reference_check')
  and clock.ended_on is not null
  and not clock.blocked;

-- Tenancy records: the six-year rule. Deleting the tenancy row cascades to
-- its occupants, documents, rent payments and checklists, so this view lists
-- only the tenancy — but the job still has to collect the storage paths
-- underneath it first. Postgres cascades do not reach into a storage bucket.
create or replace view tenancies_due_for_erasure
with (security_invoker = true) as
select
  t.id        as tenancy_id,
  t.end_date  as ended_on,
  r.name      as room_label,
  (t.end_date + make_interval(months => retention_months('tenancy_records')))::date as due_date
from tenancies t
left join rooms r on r.id = t.room_id
where t.status in ('ended', 'archived')
  and t.end_date is not null
  and not t.legal_hold;

-- A tenant whose last tenancy is past the six-year mark. Computed from the
-- clock rather than from "has no tenancies left", so a profile created for
-- someone who never moved in is never mistaken for an expired one.
create or replace view tenants_due_for_erasure
with (security_invoker = true) as
select
  trc.tenant_id,
  trc.last_ended_on as ended_on,
  (trc.last_ended_on + make_interval(months => retention_months('tenancy_records')))::date as due_date
from tenant_retention_clock trc
where trc.tenancy_count > 0
  and trc.last_ended_on is not null
  and not trc.has_live_tenancy
  and not trc.on_legal_hold
  and not trc.has_undated_end;

-- Checklist photos whose report already exists. Not a legal rule — a storage
-- one — but it runs on the same job and is logged the same way, because it
-- is still an irreversible deletion of something an admin uploaded.
create or replace view checklist_photos_purgeable
with (security_invoker = true) as
select
  e.id            as export_id,
  e.checklist_id,
  e.generated_at,
  c.tenancy_id,
  ten.status      as tenancy_status,
  coalesce(ten.legal_hold, false) as legal_hold,
  r.name          as room_label
from checklist_pdf_exports e
join inventory_checklists c on c.id = e.checklist_id
left join tenancies ten     on ten.id = c.tenancy_id
left join rooms r           on r.id = coalesce(c.room_id, ten.room_id)
where e.photos_purged_at is null
  and not coalesce(ten.legal_hold, false);

-- ── RLS on the new tables ──────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array['retention_rules', 'data_erasures'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "admins_full_access" on %I for all
         to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- ── Retire the old flat setting ────────────────────────────────────────────
-- Left in place would be a second, contradictory answer to "how long do we
-- keep this" sitting one table away from the real one.

delete from app_settings where key = 'retention_years';
