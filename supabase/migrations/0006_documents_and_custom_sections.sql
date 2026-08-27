-- ═══════════════════════════════════════════════════════════════════════════
-- Document types matching what UK letting actually requires
--
-- Verified against gov.uk in August 2026. Two things drove this:
--
-- 1. Documents belong to three different owners, not two. A gas safety
--    record describes the building, not the person living in it or the
--    letting they signed — it stays valid when they move out and applies to
--    whoever moves in next.
--
-- 2. Safety certificates expire, and letting a property on a lapsed gas
--    certificate is a criminal offence. A document store that cannot say
--    "this ran out last month" is not much use for compliance.
--
-- Note: the Renters' Rights Act came into force on 1 May 2026. The old
-- "How to Rent" guide was withdrawn and replaced by the Renters' Rights Act
-- Information Sheet 2026, which is what must now be served.
-- ═══════════════════════════════════════════════════════════════════════════

alter type document_type rename to document_type_old;

create type document_type as enum (
  -- Follow the person
  'passport',
  'right_to_rent',
  'reference_check',
  -- Belong to the letting
  'tenancy_agreement',
  'deposit_certificate',
  'deposit_prescribed_info',
  'renters_rights_info',
  'inventory_report',
  'handbook',
  -- Belong to the property or room
  'gas_safety',
  'epc',
  'eicr',
  'hmo_licence',
  'legionella_assessment',
  'fire_safety',
  'other'
);

alter table documents
  alter column doc_type type document_type using doc_type::text::document_type;

drop type document_type_old;

-- ── Documents can now describe a property or a room ────────────────────────
alter table documents add column property_id uuid references properties(id) on delete cascade;
alter table documents add column room_id uuid references rooms(id) on delete cascade;

-- Certificates lapse. Without this the store cannot warn anyone.
alter table documents add column expires_at date;
alter table documents add column issued_at date;

create index on documents (property_id);
create index on documents (expires_at) where expires_at is not null;

alter table documents drop constraint documents_owner_check;
alter table documents add constraint documents_owner_check check (
  tenant_id is not null or tenancy_id is not null
  or property_id is not null or room_id is not null
);

-- ── Custom checklist sections ──────────────────────────────────────────────
-- No two rooms are laid out the same. The templates are a starting point:
-- an admin removes what isn't there (no window in the bathroom) and adds
-- what is (wall fixtures where you wouldn't expect them). Marking which
-- sections were added by hand keeps that distinction visible.

alter table checklist_sections
  add column is_custom boolean not null default false;

-- Sections created without a template behind them were added by hand.
update checklist_sections set is_custom = true where section_template_id is null;
