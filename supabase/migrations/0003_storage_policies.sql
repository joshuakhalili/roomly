-- ═══════════════════════════════════════════════════════════════════════════
-- Storage access policies
--
-- Creating a private bucket only stops anonymous access. Supabase applies
-- Row Level Security to storage.objects as well, and with no policy the
-- default is deny — which locks out admins too. These policies grant
-- signed-in admins full access to the app's buckets, and nobody else any.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  bucket_names text[] := array[
    'passports', 'right-to-rent', 'tenancy-agreements', 'deposit-certs',
    'handbooks', 'inventory-photos', 'checklist-pdfs'
  ];
begin
  -- Drop first so this migration can be re-run safely.
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
