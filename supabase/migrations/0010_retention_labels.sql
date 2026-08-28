-- ═══════════════════════════════════════════════════════════════════════════
-- Give the erasure log something worth reading
--
-- The label is the only trace left once a record is gone, and for a
-- tenant-owned document it was coming out as "unassigned": those documents
-- hang off the person, not the letting, so there was no tenancy in the row
-- to read a room from. "id_document · unassigned · ended 2025-07-24" tells
-- you nothing about which erasure it was.
--
-- The room has to come from the tenant's most recent tenancy instead. The
-- label still names no one — a room and a date — which is the constraint
-- that matters: this table is not covered by any retention rule, so anything
-- identifying written here would outlive the data it describes.
-- ═══════════════════════════════════════════════════════════════════════════

-- `create or replace view` can only append columns, never insert or rename
-- one, so these are dropped and rebuilt. Dependents first: both of the
-- others read from tenant_retention_clock.
drop view if exists identity_documents_due;
drop view if exists tenants_due_for_erasure;
drop view if exists tenant_retention_clock;

create view tenant_retention_clock
with (security_invoker = true) as
select
  t.id                                                as tenant_id,
  coalesce(bool_or(ten.status in ('upcoming', 'active')), false) as has_live_tenancy,
  coalesce(bool_or(ten.legal_hold), false)            as on_legal_hold,
  count(ten.id)                                       as tenancy_count,
  max(ten.end_date)                                   as last_ended_on,
  bool_or(ten.status in ('ended', 'archived') and ten.end_date is null) as has_undated_end,
  -- Where they lived most recently, for the audit label.
  (array_agg(r.name order by ten.end_date desc nulls first))[1] as last_room_label
from tenants t
left join tenancy_tenants tt on tt.tenant_id = t.id
left join tenancies ten      on ten.id = tt.tenancy_id
left join rooms r            on r.id = ten.room_id
group by t.id;

create view identity_documents_due
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
    coalesce(
      case when d.tenant_id is not null then trc.last_room_label else r.name end,
      'unassigned'
    ) as room_label
  from (select 1) _
  left join tenant_retention_clock trc on d.tenant_id  is not null and trc.tenant_id = d.tenant_id
  left join tenancies ten              on d.tenancy_id is not null and ten.id = d.tenancy_id
  left join rooms r                    on r.id = ten.room_id
) clock on true
where d.doc_type in ('id_document', 'right_to_rent', 'reference_check')
  and clock.ended_on is not null
  and not clock.blocked;

-- Same for the tenant's own record.
create view tenants_due_for_erasure
with (security_invoker = true) as
select
  trc.tenant_id,
  trc.last_ended_on as ended_on,
  trc.last_room_label as room_label,
  (trc.last_ended_on + make_interval(months => retention_months('tenancy_records')))::date as due_date
from tenant_retention_clock trc
where trc.tenancy_count > 0
  and trc.last_ended_on is not null
  and not trc.has_live_tenancy
  and not trc.on_legal_hold
  and not trc.has_undated_end;
