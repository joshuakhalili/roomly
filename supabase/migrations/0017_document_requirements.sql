-- ═══════════════════════════════════════════════════════════════════════════
-- Which documents a letting must have, as data rather than code
--
-- REQUIRED_DOCUMENT_TYPES was a single hardcoded list in TypeScript, applied
-- to every tenancy in the system. That was right while every tenancy was the
-- same thing. It stops being right the moment a short stay exists: chasing a
-- four-night guest for a deposit protection certificate is not a compliance
-- gap, it is the software being wrong about what the law asks for.
--
-- Shaped after retention_rules, which solved the neighbouring problem the same
-- way — one row per rule, with the legal basis recorded next to it rather than
-- asserted in a comment somewhere. It also means a requirement can be added
-- without a deploy, which matters for a rule set that changes by statute.
-- ═══════════════════════════════════════════════════════════════════════════

create table document_requirements (
  id           uuid primary key default gen_random_uuid(),
  letting_type letting_type not null,
  doc_type     document_type not null,
  -- Which panel is responsible for chasing it. Identity documents follow the
  -- person between lettings; agreements belong to one letting. The panels
  -- already split on exactly this, so a requirement has to say which side of
  -- the line it sits on or it would be shown in both places or neither.
  owner_scope  text not null check (owner_scope in ('tenant', 'tenancy')),
  legal_basis  text,
  sort_order   int not null default 0,
  unique (letting_type, doc_type)
);

-- ── Long tenancies ─────────────────────────────────────────────────────────
-- The five that were hardcoded, carried over unchanged, with the statute each
-- one comes from written down next to it.

insert into document_requirements
  (letting_type, doc_type, owner_scope, legal_basis, sort_order)
values
  ('long_term', 'right_to_rent', 'tenant',
   'Immigration Act 2014', 1),
  ('long_term', 'tenancy_agreement', 'tenancy',
   null, 2),
  ('long_term', 'deposit_certificate', 'tenancy',
   'Housing Act 2004 — deposit protection, within 30 days', 3),
  ('long_term', 'deposit_prescribed_info', 'tenancy',
   'Housing Act 2004 s.213 — prescribed information', 4),
  ('long_term', 'renters_rights_info', 'tenancy',
   'Renters'' Rights Act Information Sheet, from 1 May 2026', 5);

-- ── Short stays ────────────────────────────────────────────────────────────
-- Deliberately thin, and deliberately not a claim to be exhaustive. The two
-- kept are the two that genuinely still apply. The three dropped are dropped
-- for a reason, not by oversight: the statutory deposit scheme covers assured
-- tenancies rather than a licence to occupy for a few nights, the prescribed
-- information is part of that same regime, and the Renters' Rights sheet is
-- addressed to long tenancies.
--
-- An operator who needs more adds rows. That is the point of this table.

insert into document_requirements
  (letting_type, doc_type, owner_scope, legal_basis, sort_order)
values
  ('short_stay', 'right_to_rent', 'tenant',
   'Immigration Act 2014 — applies to any occupation treated as a tenancy or licence', 1),
  ('short_stay', 'tenancy_agreement', 'tenancy',
   null, 2);

alter table document_requirements enable row level security;
create policy "admins_full_access" on document_requirements
  for all to authenticated using (is_admin()) with check (is_admin());

-- ── Room for what comes next ───────────────────────────────────────────────
-- Two document types for short-let regimes that require a permit number and
-- guest identity reporting — Turkey's is the case in front of us, but the
-- shape is common across European short-let licensing.
--
-- Added as enum values only. No requirement rows reference them and no code
-- reads them yet; adding them now means the migration that does can be an
-- insert rather than another enum change.

alter type document_type add value if not exists 'short_term_rental_permit';
alter type document_type add value if not exists 'guest_id_registration';
