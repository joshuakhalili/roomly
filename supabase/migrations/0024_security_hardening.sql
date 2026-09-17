-- Security hardening for public trial access.

-- ── Login throttling ──────────────────────────────────────────────────────
-- Store only keyed hashes of the visitor IP/account pair. Raw IP addresses
-- and email addresses never enter this table.
create table auth_login_attempts (
  attempt_key text not null,
  attempted_at timestamptz not null default now()
);

create index auth_login_attempts_key_time_idx
  on auth_login_attempts (attempt_key, attempted_at desc);

alter table auth_login_attempts enable row level security;
alter table auth_login_attempts force row level security;
revoke all on auth_login_attempts from public, anon, authenticated;

create or replace function consume_login_attempt(
  p_ip_key text,
  p_account_key text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff constant timestamptz := now() - interval '15 minutes';
begin
  if p_ip_key !~ '^ip:[0-9a-f]{64}$'
     or p_account_key !~ '^account:[0-9a-f]{64}$' then
    return false;
  end if;

  -- Serialise attempts from the same address so simultaneous requests cannot
  -- all pass the count before any one of them inserts.
  perform pg_advisory_xact_lock(hashtext(p_ip_key));
  delete from auth_login_attempts where attempted_at < now() - interval '24 hours';

  if (select count(*) from auth_login_attempts
      where attempt_key = p_ip_key and attempted_at >= cutoff) >= 30 then
    return false;
  end if;

  if (select count(*) from auth_login_attempts
      where attempt_key = p_account_key and attempted_at >= cutoff) >= 5 then
    return false;
  end if;

  insert into auth_login_attempts (attempt_key)
  values (p_ip_key), (p_account_key);
  return true;
end;
$$;

create or replace function clear_login_account_attempts(p_account_key text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth_login_attempts where attempt_key = p_account_key;
$$;

revoke all on function consume_login_attempt(text, text) from public, anon, authenticated;
revoke all on function clear_login_account_attempts(text) from public, anon, authenticated;
grant execute on function consume_login_attempt(text, text) to service_role;
grant execute on function clear_login_account_attempts(text) to service_role;

-- ── Storage boundary ──────────────────────────────────────────────────────
-- Backstop the application checks at Supabase Storage itself. Buckets remain
-- private and reject MIME types that the corresponding feature never needs.
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp',
  'application/pdf'
]
where id in (
  'passports', 'right-to-rent', 'tenancy-agreements', 'deposit-certs',
  'handbooks'
);

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'
]
where id in ('inventory-photos', 'property-banners');

update storage.buckets
set allowed_mime_types = array['application/pdf']
where id = 'checklist-pdfs';

drop policy if exists organization_storage_read on storage.objects;
drop policy if exists organization_storage_insert on storage.objects;
drop policy if exists organization_storage_update on storage.objects;
drop policy if exists organization_storage_delete on storage.objects;

create policy organization_storage_read on storage.objects for select to authenticated
  using (
    bucket_id = any(array[
      'passports', 'right-to-rent', 'tenancy-agreements', 'deposit-certs',
      'handbooks', 'inventory-photos', 'checklist-pdfs', 'property-banners'
    ])
    and storage_object_in_current_organization(name)
  );

create policy organization_storage_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = any(array[
      'passports', 'right-to-rent', 'tenancy-agreements', 'deposit-certs',
      'handbooks', 'inventory-photos', 'checklist-pdfs', 'property-banners'
    ])
    and split_part(name, '/', 1) = current_organization_id()::text
    and can_write_organization(current_organization_id())
    and organization_storage_has_capacity(metadata)
  );

create policy organization_storage_update on storage.objects for update to authenticated
  using (
    bucket_id = any(array[
      'passports', 'right-to-rent', 'tenancy-agreements', 'deposit-certs',
      'handbooks', 'inventory-photos', 'checklist-pdfs', 'property-banners'
    ])
    and storage_object_in_current_organization(name)
    and can_write_organization(current_organization_id())
  )
  with check (
    bucket_id = any(array[
      'passports', 'right-to-rent', 'tenancy-agreements', 'deposit-certs',
      'handbooks', 'inventory-photos', 'checklist-pdfs', 'property-banners'
    ])
    and split_part(name, '/', 1) = current_organization_id()::text
    and can_write_organization(current_organization_id())
  );

create policy organization_storage_delete on storage.objects for delete to authenticated
  using (
    bucket_id = any(array[
      'passports', 'right-to-rent', 'tenancy-agreements', 'deposit-certs',
      'handbooks', 'inventory-photos', 'checklist-pdfs', 'property-banners'
    ])
    and storage_object_in_current_organization(name)
    and can_write_organization(current_organization_id())
  );
