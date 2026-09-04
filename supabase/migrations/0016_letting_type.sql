-- ═══════════════════════════════════════════════════════════════════════════
-- Short stays, alongside long tenancies
--
-- Every letting in here has been the same shape: one room, one continuous
-- range of dates, and a rent that repeats on a cadence until it ends. A short
-- stay is a different shape — a fixed number of nights with one total price —
-- and the difference is not cosmetic. Run a four-night booking through the
-- rent scheduler as it stands and it invents a series of monthly charges.
--
-- One flag, not a second table. A booking still has a room, still has people
-- in it, still needs a check-in and a check-out report, and still has money
-- owed against it. Everything about it is a tenancy except how the price
-- behaves, so the price is what branches.
-- ═══════════════════════════════════════════════════════════════════════════

create type letting_type as enum ('long_term', 'short_stay');

alter table tenancies
  add column letting_type letting_type not null default 'long_term';

-- Existing rows are all long lettings by construction; the default backfills
-- them and there is nothing further to do.

-- ── Pricing ────────────────────────────────────────────────────────────────
-- 'total' joins the cadences rather than arriving as a separate price column.
-- rent_amount then means the same thing everywhere — "the number the schedule
-- is built from" — so every existing query that sums rent_amount for active
-- tenancies keeps working without being taught about a second field.
--
-- Note this value is added here but not written by anything in this file:
-- Postgres will not let a newly-added enum value be used in the same
-- transaction that adds it. The first write happens from the application,
-- after this migration has been applied.

alter type rent_frequency add value if not exists 'total';

-- Where a stay is paid in two parts: something to hold the booking, then the
-- balance. Null on a long tenancy, where rent_due_day governs instead, and
-- null on a stay paid in full on arrival.
alter table tenancies add column balance_due_date date;

comment on column tenancies.balance_due_date is
  'Short stays only. When the balance falls due; null means on arrival.';

-- ── Bills ──────────────────────────────────────────────────────────────────
-- Whether utilities are covered by the rent. On its own this is just a fact
-- about the letting; paired with the utility_bills table it is what makes the
-- "is this room actually making money" comparison possible at all.

alter table tenancies
  add column bills_included boolean not null default false;
