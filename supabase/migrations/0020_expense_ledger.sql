-- ═══════════════════════════════════════════════════════════════════════════
-- One ledger over four sources
--
-- Money leaves this business in four different shapes and each is recorded
-- where it makes sense to record it: a job has a cost, an asset has a purchase
-- price, a utility bill covers a period, and an expense is everything else.
-- Asking "what did I spend" should not mean knowing that.
--
-- A view rather than a table, and that is the whole design. Copying those rows
-- into a real expenses table would mean two records of the same £340 boiler
-- repair, drifting apart the first time someone edits one of them. Here there
-- is exactly one row for each pound spent, wherever it was entered, and
-- editing it in its own screen updates what this returns.
--
-- `source` is what makes it navigable: the UI shows where a line came from and
-- links back to the screen that owns it, so the ledger stays a reading surface
-- and never becomes a second place to edit things.
-- ═══════════════════════════════════════════════════════════════════════════

-- security_invoker is not optional here. Without it a view runs with its
-- owner's rights, which means it would happily read tables the person
-- querying it has no policy for — quietly routing around the RLS on every
-- table underneath. With it, the admin check on each source table still
-- applies, and this view is only ever as permissive as what it selects from.
create view expense_ledger
with (security_invoker = true) as

  -- Standalone spend
  select
    e.id,
    'expense'::text            as source,
    e.spent_on                 as spent_on,
    e.amount                   as amount,
    e.description              as description,
    e.supplier_name            as supplier_name,
    e.property_id              as property_id,
    e.room_id                  as room_id,
    e.category_id              as category_id,
    c.name                     as category_name,
    c.slug                     as category_slug
  from expenses e
  left join expense_categories c on c.id = e.category_id

  union all

  -- Work that has been done and priced. Booked-but-not-done jobs are left out
  -- deliberately: a job in the diary for next Tuesday is a commitment, not a
  -- cost, and counting it would inflate a tax year that has not happened yet.
  select
    j.id,
    'maintenance'::text,
    coalesce(j.completed_on, j.scheduled_for),
    j.cost,
    j.title,
    ct.name,
    j.property_id,
    j.room_id,
    null::uuid,
    st.name,
    st.slug
  from maintenance_jobs j
  left join contacts ct      on ct.id = j.contact_id
  left join service_types st on st.id = j.service_type_id
  where j.cost is not null
    and j.status = 'done'

  union all

  -- Things bought and still owned. Priced on the day of purchase, so an asset
  -- with no purchase date cannot be placed in a year and is left out rather
  -- than guessed into the wrong one.
  select
    a.id,
    'asset'::text,
    a.purchased_on,
    a.cost,
    a.name,
    a.supplier_name,
    a.property_id,
    a.room_id,
    null::uuid,
    null::text,
    null::text
  from assets a
  where a.cost is not null
    and a.purchased_on is not null

  union all

  -- Utilities. Dated to the end of the period they cover: that is the point at
  -- which the whole bill is known, and it keeps a bill spanning the April
  -- boundary in a single tax year rather than split across two.
  select
    u.id,
    'utility'::text,
    u.period_end,
    u.amount,
    u.meter_type::text,
    u.supplier_name,
    u.property_id,
    null::uuid,
    null::uuid,
    null::text,
    null::text
  from utility_bills u;

comment on view expense_ledger is
  'Read-only union of expenses, completed maintenance, asset purchases and '
  'utility bills. Each row is owned by its source table — edit it there.';
