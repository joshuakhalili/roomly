-- ═══════════════════════════════════════════════════════════════════════════
-- A filing area for everything that isn't tenant paperwork
--
-- Tenant documents stay where they are — ID, right to rent, contract and
-- deposit scheme all belong to the person or their letting. Everything else
-- is the business's own paperwork: licences, safety certificates, contractor
-- invoices. It accumulates, so it is stored as a log rather than a slot:
-- this year's gas certificate joins last year's instead of replacing it.
-- ═══════════════════════════════════════════════════════════════════════════

-- "Passport" was too narrow — a driving licence or national ID card serves
-- the same purpose. RENAME VALUE keeps existing rows pointing at it.
alter type document_type rename value 'passport' to 'id_document';

-- New categories for the library. Adding values is allowed inside a
-- transaction on modern Postgres as long as they aren't used until it
-- commits — nothing below references them.
alter type document_type add value if not exists 'maintenance_invoice';
alter type document_type add value if not exists 'insurance';
alter type document_type add value if not exists 'business_licence';
alter type document_type add value if not exists 'warranty';

-- ── Company-wide documents ─────────────────────────────────────────────────
-- Landlord insurance or a business licence covers the whole operation, not
-- one building. Filing it under an arbitrary property would make it
-- impossible to find later, so it gets an explicit home.
--
-- A flag rather than "all owners null": that way a bug which forgets to set
-- property_id fails the constraint instead of silently creating a
-- company-wide document.
alter table documents
  add column is_company_wide boolean not null default false;

-- ── Invoice detail ─────────────────────────────────────────────────────────
-- Enough structure to answer "what did we spend on this room" and "who
-- fixed the boiler last time" without opening every PDF.
alter table documents add column supplier_name text;
alter table documents add column amount numeric(10,2);

alter table documents drop constraint documents_owner_check;
alter table documents add constraint documents_owner_check check (
  tenant_id is not null or tenancy_id is not null
  or property_id is not null or room_id is not null
  or is_company_wide
);

create index on documents (doc_type);
create index on documents (uploaded_at desc);
