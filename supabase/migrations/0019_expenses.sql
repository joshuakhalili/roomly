-- ═══════════════════════════════════════════════════════════════════════════
-- Expenses: the money going out that nothing else was recording
--
-- Some of it was already here, in three places that do not know about each
-- other: maintenance_jobs.cost is what the work cost, assets.cost is what the
-- washing machine cost, and documents.amount is what the invoice said. Between
-- them they cover work and equipment, and miss everything else — the lamp, the
-- mattress, the accountant, the £14 of light bulbs.
--
-- The obvious move is a table that holds all of it. That is the wrong move:
-- copying the three existing sources into a fourth gives two answers to "what
-- did this building cost me last year" and no way to tell which is stale. So
-- this table holds ONLY the spend that has nowhere else to live, and a view
-- (0020) unions the four sources for anything that wants the whole picture.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Categories ─────────────────────────────────────────────────────────────
-- An editable table rather than an enum, for the same reason service_types is
-- one: the list is not knowable up front, and "add a category" should not mean
-- a migration and a deploy. slug marks the seeded rows so code and
-- translations can find them after someone renames one.

create table expense_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique,
  sort_order  int not null default 0,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now()
);

insert into expense_categories (name, slug, sort_order) values
  ('White goods',       'white_goods',       1),
  ('Furniture',         'furniture',         2),
  ('Fixtures & fittings','fixtures',         3),
  ('Repairs',           'repairs',           4),
  ('Cleaning',          'cleaning',          5),
  ('Safety & compliance','compliance',       6),
  ('Insurance',         'insurance',         7),
  ('Professional fees', 'professional_fees', 8),
  ('Travel',            'travel',            9),
  ('Other',             'other',            10);

-- ── The spend itself ───────────────────────────────────────────────────────
-- Every allocation is optional and they nest rather than exclude: a room
-- implies its property, a tenancy implies its room. An expense with none of
-- them set is a business cost that belongs to no building — an accountant's
-- fee, a software subscription — which is a real thing and needs somewhere to
-- go that is not "attach it to whichever house feels closest".

create table expenses (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid references properties(id) on delete set null,
  room_id      uuid references rooms(id) on delete set null,
  tenancy_id   uuid references tenancies(id) on delete set null,
  category_id  uuid references expense_categories(id) on delete set null,
  description  text not null,
  amount       numeric(10,2) not null,
  -- When the money was spent, not when it was typed in. Everything downstream
  -- groups by this, including the tax year.
  spent_on     date not null,
  supplier_name text,
  -- Bought because a tenant broke something and it is going on their bill.
  -- Kept apart from the deposit machinery on purpose: this is a note about
  -- intent, not a deduction anyone has agreed to yet.
  is_recharged boolean not null default false,
  notes        text,
  created_at   timestamptz not null default now()
);

create index on expenses (spent_on desc);
create index on expenses (property_id);
create index on expenses (category_id);

-- ── Receipts ───────────────────────────────────────────────────────────────
-- Reuses the documents pipeline rather than growing a second one: same
-- buckets, same upload action, same retention. A receipt is filed against an
-- expense exactly the way an invoice is filed against a maintenance job.

alter table documents
  add column expense_id uuid references expenses(id) on delete cascade;

alter table documents drop constraint documents_owner_check;
alter table documents add constraint documents_owner_check check (
  tenant_id is not null or tenancy_id is not null
  or property_id is not null or room_id is not null
  or maintenance_job_id is not null or asset_id is not null
  or expense_id is not null
  or is_company_wide
);

do $$
declare t text;
begin
  foreach t in array array['expense_categories', 'expenses'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "admins_full_access" on %I for all
         to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;
