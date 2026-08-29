-- ── The buckets themselves ─────────────────────────────────────────────────
--
-- These existed only because someone made them by hand in the dashboard. That
-- worked exactly once, on one project, and left a hole nobody would find until
-- the next one: migration 0003 applies policies to `storage.objects` for these
-- bucket names, and policies are perfectly happy to reference a bucket that
-- does not exist. So a fresh database would migrate cleanly, start cleanly,
-- and then fail on the first document upload with "Bucket not found".
--
-- Anything the app needs in order to run belongs in a migration. A setup step
-- that lives only in someone's memory is not a setup step.
--
-- `on conflict do nothing` so this is a no-op on the project where the buckets
-- were already created by hand.

insert into storage.buckets (id, name, public, file_size_limit)
values
  -- Identity documents. Private, and subject to the 1-year destroy rule in
  -- the retention migration — see 0008.
  ('passports',          'passports',          false, 15728640),
  ('right-to-rent',      'right-to-rent',      false, 15728640),
  -- The letting's own paperwork.
  ('tenancy-agreements', 'tenancy-agreements', false, 15728640),
  ('deposit-certs',      'deposit-certs',      false, 15728640),
  ('handbooks',          'handbooks',          false, 15728640),
  -- Inventory evidence. Photos are compressed client-side before upload, so
  -- the ceiling here is a backstop rather than the expected size.
  ('inventory-photos',   'inventory-photos',   false, 15728640),
  ('checklist-pdfs',     'checklist-pdfs',     false, 15728640)
on conflict (id) do nothing;

-- Every one of these is private. Public buckets are readable by anyone with
-- the URL, forever, with no login — which for a passport scan is not a
-- configuration choice, it is a data breach. The app reads them through
-- short-lived signed URLs instead.
