-- Minimal hosted-service boundary for migration smoke tests, not a Supabase emulator.
create extension pgcrypto;
create role anon;
create role authenticated;
create role service_role bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '')
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select jsonb_build_object('email', current_setting('request.jwt.claim.email', true))
$$;
grant usage on schema auth to authenticated, anon, service_role;

create schema storage;
create table storage.buckets (
  id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid default gen_random_uuid(), bucket_id text, name text,
  metadata jsonb default '{}', owner uuid, created_at timestamptz default now()
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
create function storage.extension(name text) returns text language sql immutable as $$
  select reverse(split_part(reverse(name), '.', 1))
$$;

-- Defaults must precede migrations, so explicit security revocations remain effective.
grant usage on schema public, storage to authenticated, anon, service_role;
grant select, insert, update, delete on all tables in schema storage to authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public grant usage on sequences to authenticated, service_role;
