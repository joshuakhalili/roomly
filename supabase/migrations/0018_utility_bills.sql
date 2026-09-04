-- ═══════════════════════════════════════════════════════════════════════════
-- What the utilities actually cost
--
-- Rent with bills included is a number a landlord sets once, usually from what
-- the last tenant's usage looked like, and then does not revisit. Meanwhile
-- the standing charge goes up, someone leaves an electric heater on through
-- February, and the margin quietly inverts. Nothing in this app — or in any
-- competitor looked at — puts the two numbers next to each other.
--
-- That comparison is the whole reason this table exists. It is not general
-- expense tracking (see 0019 for that): it is period-based, because a bill
-- covers a period and the rent it is being compared against was collected
-- over that same period.
-- ═══════════════════════════════════════════════════════════════════════════

create table utility_bills (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references properties(id) on delete cascade,
  -- Reuses the meter types the inventory checklists already read at check-in,
  -- so a bill and a meter reading are talking about the same thing.
  meter_type    meter_type not null,
  period_start  date not null,
  period_end    date not null,
  amount        numeric(10,2) not null,
  supplier_name text,
  notes         text,
  created_at    timestamptz not null default now(),
  -- A bill that ends before it starts is a typo, and one that gets stored is
  -- a period that silently matches nothing when the comparison runs.
  constraint utility_bills_period_check check (period_end >= period_start)
);

create index on utility_bills (property_id, period_start);

alter table utility_bills enable row level security;
create policy "admins_full_access" on utility_bills
  for all to authenticated using (is_admin()) with check (is_admin());
