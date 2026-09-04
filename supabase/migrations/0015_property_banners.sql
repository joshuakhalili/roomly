-- ═══════════════════════════════════════════════════════════════════════════
-- A picture of each building
--
-- Properties have had a name and an address and nothing else to look at. On a
-- list of six houses that is six identical grey icons, and the only way to
-- tell them apart is to read. A photograph of the front of a building is the
-- fastest possible identifier for the person who owns it — they recognise it
-- before they have finished reading the name.
--
-- Private, like every other bucket here. A building exterior is not a passport
-- scan, but a public bucket is readable by anyone who ever sees the URL,
-- forever, and "it is only the outside of a house" is a weak reason to hand
-- out a permanent link to where a landlord's tenants live.
-- ═══════════════════════════════════════════════════════════════════════════

alter table properties add column banner_path text;

comment on column properties.banner_path is
  'Stored as "<bucket>/<path>", the same shape as documents.storage_path.';

insert into storage.buckets (id, name, public, file_size_limit)
values ('property-banners', 'property-banners', false, 15728640)
on conflict (id) do nothing;

-- ── Storage policies ───────────────────────────────────────────────────────
-- Migration 0003 grants admins access to a fixed array of bucket names. A
-- bucket missing from that array has RLS enabled and no policy, which means
-- deny — including to admins. So the four policies are dropped and recreated
-- with the new name included, exactly as 0003 does, rather than adding a
-- fifth policy that would drift away from the other four.

do $$
declare
  bucket_names text[] := array[
    'passports', 'right-to-rent', 'tenancy-agreements', 'deposit-certs',
    'handbooks', 'inventory-photos', 'checklist-pdfs', 'property-banners'
  ];
begin
  execute 'drop policy if exists "admins_read_files"   on storage.objects';
  execute 'drop policy if exists "admins_insert_files" on storage.objects';
  execute 'drop policy if exists "admins_update_files" on storage.objects';
  execute 'drop policy if exists "admins_delete_files" on storage.objects';

  execute format(
    'create policy "admins_read_files" on storage.objects for select
       to authenticated using (bucket_id = any(%L) and public.is_admin())',
    bucket_names);

  execute format(
    'create policy "admins_insert_files" on storage.objects for insert
       to authenticated with check (bucket_id = any(%L) and public.is_admin())',
    bucket_names);

  execute format(
    'create policy "admins_update_files" on storage.objects for update
       to authenticated using (bucket_id = any(%L) and public.is_admin())
       with check (bucket_id = any(%L) and public.is_admin())',
    bucket_names, bucket_names);

  execute format(
    'create policy "admins_delete_files" on storage.objects for delete
       to authenticated using (bucket_id = any(%L) and public.is_admin())',
    bucket_names);
end $$;
