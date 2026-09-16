-- ══════════════════════════════════════════════════════════════════════════════════════════════════════
-- Organisation isolation
--
-- Roomly started as a single-business application. Its original is_admin()
-- policy therefore meant "has a profile", which becomes a cross-customer data
-- leak as soon as a second trial business is added. This migration makes the
-- organisation the security boundary for database rows and private files.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════════

create type organization_role as enum ('owner', 'admin', 'staff', 'viewer');

create table organizations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text not null unique,
  -- 100MB per trial keeps five businesses comfortably inside a free-project
  -- storage envelope while still allowing roughly 200 compressed photos.
  storage_limit_bytes bigint not null default 104857600,
  created_at          timestamptz not null default now()
);

-- All pre-migration records belong to this organisation. Keeping the ID
-- constant makes old, un-prefixed Storage objects distinguishable during the
-- compatibility period.
insert into organizations (id, name, slug)
values ('00000000-0000-4000-8000-000000000001', 'Roomly', 'roomly-legacy');

alter table profiles
  add column organization_id uuid references organizations(id) on delete restrict,
  add column role organization_role not null default 'owner';
update profiles
set organization_id = '00000000-0000-4000-8000-000000000001'
where organization_id is null;
alter table profiles alter column organization_id set not null;

create or replace function current_organization_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id from profiles where id = auth.uid();
$$;

create or replace function current_organization_role()
returns organization_role
language sql
security definer
set search_path = public
stable
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(current_organization_role() in ('owner', 'admin'), false);
$$;

create or replace function can_write_organization(target uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select target = current_organization_id()
    and coalesce(current_organization_role() in ('owner', 'admin', 'staff'), false);
$$;

-- Add the boundary to every business-owned table. Defaults are evaluated in
-- authenticated requests; service-role jobs must state an organisation
-- explicitly, which prevents a background task silently creating ownerless
-- rows.
do $$
declare t text;
begin
  foreach t in array array[
    'properties', 'area_types', 'checklist_section_templates', 'rooms',
    'bank_accounts', 'tenancies', 'documents', 'rent_payments',
    'inventory_checklists', 'checklist_pdf_exports', 'checklist_meters',
    'checklist_keys', 'checklist_detectors', 'checklist_declarations',
    'message_templates', 'notifications_log', 'metrics_snapshots', 'archive_log',
    'app_settings', 'unit_area_defaults', 'checklist_areas', 'checklist_sections',
    'checklist_photos', 'tenants', 'tenancy_tenants', 'retention_rules',
    'data_erasures', 'service_types', 'contacts', 'assets', 'job_recurrences',
    'maintenance_jobs', 'document_requirements', 'utility_bills',
    'expense_categories', 'expenses'
  ] loop
    execute format('alter table %I add column organization_id uuid references organizations(id) on delete restrict', t);
    execute format(
      'update %I set organization_id = %L where organization_id is null',
      t, '00000000-0000-4000-8000-000000000001'
    );
    execute format('alter table %I alter column organization_id set not null', t);
    execute format(
      'alter table %I alter column organization_id set default current_organization_id()',
      t
    );
    execute format('create index on %I (organization_id)', t);
  end loop;
end $$;

alter table profiles
  alter column organization_id set default current_organization_id();
create index on profiles (organization_id);

-- Configuration keys used to be global. They are now unique only inside one
-- organisation, so every new trial receives an independent editable copy.
alter table area_types drop constraint if exists room_types_name_key;
alter table area_types drop constraint if exists area_types_name_key;
alter table area_types add constraint area_types_organization_name_key
  unique (organization_id, name);

alter table message_templates drop constraint if exists message_templates_template_key_language_key;
alter table message_templates add constraint message_templates_organization_key_language_key
  unique (organization_id, template_key, language);

alter table metrics_snapshots drop constraint metrics_snapshots_pkey;
alter table metrics_snapshots add primary key (organization_id, snapshot_date);

alter table app_settings drop constraint app_settings_pkey;
alter table app_settings add primary key (organization_id, key);

alter table retention_rules drop constraint retention_rules_pkey;
alter table retention_rules add primary key (organization_id, category);

alter table unit_area_defaults drop constraint unit_area_defaults_pkey;
alter table unit_area_defaults add primary key (organization_id, unit_type, area_type_id);

alter table document_requirements drop constraint if exists document_requirements_letting_type_doc_type_key;
alter table document_requirements add constraint document_requirements_organization_type_doc_key
  unique (organization_id, letting_type, doc_type);

alter table service_types drop constraint if exists service_types_slug_key;
create unique index service_types_organization_slug_key
  on service_types (organization_id, slug) where slug is not null;

alter table expense_categories drop constraint if exists expense_categories_slug_key;
create unique index expense_categories_organization_slug_key
  on expense_categories (organization_id, slug) where slug is not null;

-- A guessed UUID must never be usable to attach one organisation's child row
-- to another organisation's parent. RLS hides the parent, while this trigger
-- supplies the database-level invariant the foreign key alone cannot express.
create or replace function enforce_parent_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  i int;
  parent_table text;
  child_column text;
  parent_id uuid;
  parent_organization uuid;
begin
  i := 0;
  while i < tg_nargs loop
    parent_table := tg_argv[i];
    child_column := tg_argv[i + 1];
    execute format('select ($1).%I::uuid', child_column) into parent_id using new;
    if parent_id is not null then
      execute format('select organization_id from public.%I where id = $1', parent_table)
        into parent_organization using parent_id;
      if parent_organization is distinct from new.organization_id then
        raise exception 'Referenced % belongs to another organization', parent_table
          using errcode = '23503';
      end if;
    end if;
    i := i + 2;
  end loop;
  return new;
end;
$$;

create trigger rooms_same_organization before insert or update on rooms
  for each row execute function enforce_parent_organization('properties', 'property_id');
create trigger checklist_templates_same_organization before insert or update on checklist_section_templates
  for each row execute function enforce_parent_organization('area_types', 'area_type_id');
create trigger unit_defaults_same_organization before insert or update on unit_area_defaults
  for each row execute function enforce_parent_organization('area_types', 'area_type_id');
create trigger tenancies_same_organization before insert or update on tenancies
  for each row execute function enforce_parent_organization('rooms', 'room_id', 'bank_accounts', 'bank_account_id');
create trigger tenancy_tenants_same_organization before insert or update on tenancy_tenants
  for each row execute function enforce_parent_organization('tenancies', 'tenancy_id', 'tenants', 'tenant_id');
create trigger rent_payments_same_organization before insert or update on rent_payments
  for each row execute function enforce_parent_organization('tenancies', 'tenancy_id');
create trigger inventory_checklists_same_organization before insert or update on inventory_checklists
  for each row execute function enforce_parent_organization('tenancies', 'tenancy_id', 'rooms', 'room_id');
create trigger checklist_areas_same_organization before insert or update on checklist_areas
  for each row execute function enforce_parent_organization('inventory_checklists', 'checklist_id', 'area_types', 'area_type_id');
create trigger checklist_sections_same_organization before insert or update on checklist_sections
  for each row execute function enforce_parent_organization('checklist_areas', 'checklist_area_id', 'checklist_section_templates', 'section_template_id');
create trigger checklist_photos_same_organization before insert or update on checklist_photos
  for each row execute function enforce_parent_organization('checklist_sections', 'checklist_section_id');
create trigger checklist_exports_same_organization before insert or update on checklist_pdf_exports
  for each row execute function enforce_parent_organization('inventory_checklists', 'checklist_id');
create trigger checklist_meters_same_organization before insert or update on checklist_meters
  for each row execute function enforce_parent_organization('inventory_checklists', 'checklist_id');
create trigger checklist_keys_same_organization before insert or update on checklist_keys
  for each row execute function enforce_parent_organization('inventory_checklists', 'checklist_id');
create trigger checklist_detectors_same_organization before insert or update on checklist_detectors
  for each row execute function enforce_parent_organization('inventory_checklists', 'checklist_id');
create trigger checklist_declarations_same_organization before insert or update on checklist_declarations
  for each row execute function enforce_parent_organization('inventory_checklists', 'checklist_id');
create trigger contacts_same_organization before insert or update on contacts
  for each row execute function enforce_parent_organization('service_types', 'service_type_id', 'properties', 'usual_property_id');
create trigger assets_same_organization before insert or update on assets
  for each row execute function enforce_parent_organization('properties', 'property_id', 'rooms', 'room_id');
create trigger recurrences_same_organization before insert or update on job_recurrences
  for each row execute function enforce_parent_organization('properties', 'property_id', 'rooms', 'room_id', 'service_types', 'service_type_id', 'contacts', 'contact_id');
create trigger maintenance_jobs_same_organization before insert or update on maintenance_jobs
  for each row execute function enforce_parent_organization('properties', 'property_id', 'rooms', 'room_id', 'service_types', 'service_type_id', 'contacts', 'contact_id', 'job_recurrences', 'recurrence_id', 'checklist_sections', 'checklist_section_id', 'assets', 'asset_id', 'tenancies', 'tenancy_id');
create trigger utility_bills_same_organization before insert or update on utility_bills
  for each row execute function enforce_parent_organization('properties', 'property_id');
create trigger expenses_same_organization before insert or update on expenses
  for each row execute function enforce_parent_organization('properties', 'property_id', 'rooms', 'room_id', 'tenancies', 'tenancy_id', 'expense_categories', 'category_id');
create trigger notifications_same_organization before insert or update on notifications_log
  for each row execute function enforce_parent_organization('tenancies', 'tenancy_id', 'rent_payments', 'rent_payment_id');
create trigger documents_same_organization before insert or update on documents
  for each row execute function enforce_parent_organization('tenants', 'tenant_id', 'tenancies', 'tenancy_id', 'properties', 'property_id', 'rooms', 'room_id', 'maintenance_jobs', 'maintenance_job_id', 'assets', 'asset_id', 'expenses', 'expense_id');

-- Profile membership fields are controlled only through service-role account
-- administration. A user may update their own preferences, but cannot turn
-- that UPDATE into a role escalation or move themselves into another tenant.
create or replace function protect_profile_membership()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and
     (new.organization_id is distinct from old.organization_id or new.role is distinct from old.role)
  then
    raise exception 'Organization membership can only be changed by account administration'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger protect_profile_membership_before_update
  before update on profiles for each row execute function protect_profile_membership();

-- Replace every original "any profile can see everything" policy.
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'properties', 'area_types', 'checklist_section_templates', 'rooms',
    'bank_accounts', 'tenancies', 'documents', 'rent_payments',
    'inventory_checklists', 'checklist_pdf_exports', 'checklist_meters',
    'checklist_keys', 'checklist_detectors', 'checklist_declarations',
    'message_templates', 'notifications_log', 'metrics_snapshots', 'archive_log',
    'app_settings', 'unit_area_defaults', 'checklist_areas', 'checklist_sections',
    'checklist_photos', 'tenants', 'tenancy_tenants', 'retention_rules',
    'data_erasures', 'service_types', 'contacts', 'assets', 'job_recurrences',
    'maintenance_jobs', 'document_requirements', 'utility_bills',
    'expense_categories', 'expenses'
  ] loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on %I', p.policyname, t);
    end loop;
    execute format(
      'create policy organization_read on %I for select to authenticated using (organization_id = current_organization_id())',
      t
    );
    execute format(
      'create policy organization_insert on %I for insert to authenticated with check (can_write_organization(organization_id))',
      t
    );
    execute format(
      'create policy organization_update on %I for update to authenticated using (can_write_organization(organization_id)) with check (can_write_organization(organization_id))',
      t
    );
    execute format(
      'create policy organization_delete on %I for delete to authenticated using (can_write_organization(organization_id))',
      t
    );
  end loop;
end $$;

alter table organizations enable row level security;
create policy organization_members_read on organizations for select to authenticated
  using (id = current_organization_id());
create policy organization_owner_update on organizations for update to authenticated
  using (id = current_organization_id() and current_organization_role() = 'owner')
  with check (id = current_organization_id());

drop policy if exists admins_full_access on profiles;
create policy profiles_organization_read on profiles for select to authenticated
  using (organization_id = current_organization_id());
create policy profiles_self_update on profiles for update to authenticated
  using (id = auth.uid() and organization_id = current_organization_id())
  with check (id = auth.uid() and organization_id = current_organization_id());

-- New Auth users are inert until server-side account administration inserts
-- their profile. Never trust user_metadata here: a public sign-up request can
-- choose its own metadata and could otherwise appoint itself owner of a known
-- organisation UUID.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  return new;
end;
$$;

-- Private Storage objects are namespaced "<organization uuid>/...". Legacy
-- un-prefixed objects remain readable only to the legacy organisation; all
-- new uploads, including legacy uploads, must use the new prefix.
create or replace function storage_object_in_current_organization(object_name text)
returns boolean
language sql
security definer
set search_path = public, storage
stable
as $$
  select split_part(object_name, '/', 1) = current_organization_id()::text
    or (
      current_organization_id() = '00000000-0000-4000-8000-000000000001'::uuid
      and not exists (
        select 1 from organizations o
        where o.id::text = split_part(object_name, '/', 1)
      )
    );
$$;

create or replace function organization_storage_has_capacity(object_metadata jsonb)
returns boolean
language sql
security definer
set search_path = public, storage
stable
as $$
  select coalesce((
    select sum(coalesce((o.metadata->>'size')::bigint, 0))
    from storage.objects o
    where split_part(o.name, '/', 1) = current_organization_id()::text
  ), 0) + coalesce((object_metadata->>'size')::bigint, 0)
  <= coalesce((
    select storage_limit_bytes from organizations
    where id = current_organization_id()
  ), 0);
$$;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

create policy organization_storage_read on storage.objects for select to authenticated
  using (storage_object_in_current_organization(name));
create policy organization_storage_insert on storage.objects for insert to authenticated
  with check (
    split_part(name, '/', 1) = current_organization_id()::text
    and organization_storage_has_capacity(metadata)
  );
create policy organization_storage_update on storage.objects for update to authenticated
  using (storage_object_in_current_organization(name))
  with check (split_part(name, '/', 1) = current_organization_id()::text);
create policy organization_storage_delete on storage.objects for delete to authenticated
  using (storage_object_in_current_organization(name));

-- The service-role provisioning endpoint uses this function to clone the
-- editable defaults into a new, empty trial organisation.
create or replace function create_trial_organization(org_name text, org_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  source_org constant uuid := '00000000-0000-4000-8000-000000000001';
  new_org uuid;
  source_area record;
  new_area uuid;
begin
  insert into organizations (name, slug)
  values (org_name, org_slug)
  returning id into new_org;

  for source_area in
    select * from area_types where organization_id = source_org order by sort_order, name
  loop
    insert into area_types (organization_id, name, sort_order)
    values (new_org, source_area.name, source_area.sort_order)
    returning id into new_area;

    insert into checklist_section_templates
      (organization_id, area_type_id, section_name, sort_order)
    select new_org, new_area, section_name, sort_order
    from checklist_section_templates
    where organization_id = source_org and area_type_id = source_area.id;

    insert into unit_area_defaults
      (organization_id, unit_type, area_type_id, sort_order)
    select new_org, unit_type, new_area, sort_order
    from unit_area_defaults
    where organization_id = source_org and area_type_id = source_area.id;
  end loop;

  insert into message_templates (organization_id, template_key, language, body_text)
    select new_org, template_key, language, body_text from message_templates where organization_id = source_org;
  insert into app_settings (organization_id, key, value, description)
    select new_org, key, value, description from app_settings where organization_id = source_org;
  insert into retention_rules
    (organization_id, category, period_months, clock_starts, legal_basis, destruction_required, notes)
    select new_org, category, period_months, clock_starts, legal_basis, destruction_required, notes
    from retention_rules where organization_id = source_org;
  insert into document_requirements
    (organization_id, letting_type, doc_type, owner_scope, legal_basis, sort_order)
    select new_org, letting_type, doc_type, owner_scope, legal_basis, sort_order
    from document_requirements where organization_id = source_org;
  insert into service_types (organization_id, name, slug, sort_order, is_archived)
    select new_org, name, slug, sort_order, is_archived from service_types where organization_id = source_org;
  insert into expense_categories (organization_id, name, slug, sort_order, is_archived)
    select new_org, name, slug, sort_order, is_archived from expense_categories where organization_id = source_org;

  return new_org;
end;
$$;

revoke all on function create_trial_organization(text, text) from public, anon, authenticated;
grant execute on function create_trial_organization(text, text) to service_role;

-- Rebuild service-role views with an explicit organisation column. The
-- application applies that column when a service-role client is used.
drop view if exists checklist_photos_purgeable;
drop view if exists tenancies_due_for_erasure;
drop view if exists identity_documents_due;
drop view if exists tenants_due_for_erasure;
drop view if exists tenant_retention_clock;
drop view if exists expense_ledger;

create or replace function retention_months(cat retention_category, target_organization uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select period_months
  from retention_rules
  where category = cat and organization_id = target_organization;
$$;

create or replace function retention_months(cat retention_category)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select retention_months(cat, current_organization_id());
$$;

create view tenant_retention_clock with (security_invoker = true) as
select
  t.organization_id,
  t.id as tenant_id,
  coalesce(bool_or(ten.status in ('upcoming', 'active')), false) as has_live_tenancy,
  coalesce(bool_or(ten.legal_hold), false) as on_legal_hold,
  count(ten.id) as tenancy_count,
  max(ten.end_date) as last_ended_on,
  bool_or(ten.status in ('ended', 'archived') and ten.end_date is null) as has_undated_end,
  (array_agg(r.name order by ten.end_date desc nulls first))[1] as last_room_label
from tenants t
left join tenancy_tenants tt on tt.tenant_id = t.id and tt.organization_id = t.organization_id
left join tenancies ten on ten.id = tt.tenancy_id and ten.organization_id = t.organization_id
left join rooms r on r.id = ten.room_id and r.organization_id = t.organization_id
group by t.organization_id, t.id;

create view identity_documents_due with (security_invoker = true) as
select
  d.organization_id,
  d.id as document_id,
  d.doc_type,
  d.storage_path,
  coalesce(d.file_size, 0) as file_size,
  clock.ended_on,
  (clock.ended_on + make_interval(months => retention_months('identity_documents', d.organization_id)))::date as due_date,
  clock.room_label
from documents d
join lateral (
  select
    case when d.tenant_id is not null then trc.last_ended_on else ten.end_date end as ended_on,
    case
      when d.tenant_id is not null then trc.has_live_tenancy or trc.on_legal_hold or trc.has_undated_end
      else ten.status in ('upcoming', 'active') or ten.legal_hold
    end as blocked,
    coalesce(case when d.tenant_id is not null then trc.last_room_label else r.name end, 'unassigned') as room_label
  from (select 1) _
  left join tenant_retention_clock trc on d.tenant_id is not null and trc.tenant_id = d.tenant_id and trc.organization_id = d.organization_id
  left join tenancies ten on d.tenancy_id is not null and ten.id = d.tenancy_id and ten.organization_id = d.organization_id
  left join rooms r on r.id = ten.room_id and r.organization_id = d.organization_id
) clock on true
where d.doc_type in ('id_document', 'right_to_rent', 'reference_check')
  and clock.ended_on is not null and not clock.blocked;

create or replace view tenancies_due_for_erasure with (security_invoker = true) as
select t.organization_id, t.id as tenancy_id, t.end_date as ended_on, r.name as room_label,
  (t.end_date + make_interval(months => retention_months('tenancy_records', t.organization_id)))::date as due_date
from tenancies t
left join rooms r on r.id = t.room_id and r.organization_id = t.organization_id
where t.status in ('ended', 'archived') and t.end_date is not null and not t.legal_hold;

create view tenants_due_for_erasure with (security_invoker = true) as
select trc.organization_id, trc.tenant_id, trc.last_ended_on as ended_on,
  trc.last_room_label as room_label,
  (trc.last_ended_on + make_interval(months => retention_months('tenancy_records', trc.organization_id)))::date as due_date
from tenant_retention_clock trc
where trc.tenancy_count > 0 and trc.last_ended_on is not null
  and not trc.has_live_tenancy and not trc.on_legal_hold and not trc.has_undated_end;

create or replace view checklist_photos_purgeable with (security_invoker = true) as
select e.organization_id, e.id as export_id, e.checklist_id, e.generated_at,
  c.tenancy_id, ten.status as tenancy_status,
  coalesce(ten.legal_hold, false) as legal_hold, r.name as room_label
from checklist_pdf_exports e
join inventory_checklists c on c.id = e.checklist_id and c.organization_id = e.organization_id
left join tenancies ten on ten.id = c.tenancy_id and ten.organization_id = e.organization_id
left join rooms r on r.id = coalesce(c.room_id, ten.room_id) and r.organization_id = e.organization_id
where e.photos_purged_at is null and not coalesce(ten.legal_hold, false);

create or replace view expense_ledger with (security_invoker = true) as
  select e.organization_id, e.id, 'expense'::text as source, e.spent_on, e.amount,
    e.description, e.supplier_name, e.property_id, e.room_id, e.category_id,
    c.name as category_name, c.slug as category_slug
  from expenses e left join expense_categories c on c.id = e.category_id and c.organization_id = e.organization_id
  union all
  select j.organization_id, j.id, 'maintenance'::text,
    coalesce(j.completed_on, j.scheduled_for), j.cost, j.title, ct.name,
    j.property_id, j.room_id, null::uuid, st.name, st.slug
  from maintenance_jobs j
  left join contacts ct on ct.id = j.contact_id and ct.organization_id = j.organization_id
  left join service_types st on st.id = j.service_type_id and st.organization_id = j.organization_id
  where j.cost is not null and j.status = 'done'
  union all
  select a.organization_id, a.id, 'asset'::text, a.purchased_on, a.cost, a.name,
    a.supplier_name, a.property_id, a.room_id, null::uuid, null::text, null::text
  from assets a where a.cost is not null and a.purchased_on is not null
  union all
  select u.organization_id, u.id, 'utility'::text, u.period_end, u.amount,
    u.meter_type::text, u.supplier_name, u.property_id, null::uuid, null::uuid,
    null::text, null::text from utility_bills u;

comment on view expense_ledger is
  'Organisation-scoped read-only union of expenses, maintenance, assets and utilities.';
