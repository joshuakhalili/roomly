-- ═══════════════════════════════════════════════════════════════════════════
-- Make the recurrence guard usable by ON CONFLICT
--
-- 0012 guarded against duplicate recurring jobs with a partial unique index:
--
--   create unique index … on maintenance_jobs (recurrence_id, scheduled_for)
--     where recurrence_id is not null;
--
-- The index is correct and does prevent duplicates. What it cannot do is act
-- as the arbiter for an upsert: Postgres will only match ON CONFLICT to a
-- partial index if the statement repeats the index predicate, and PostgREST
-- sends the column list alone. So every nightly run raised "there is no
-- unique or exclusion constraint matching the ON CONFLICT specification" —
-- and because the cron ignored the write error, it reported seventeen jobs
-- considered while creating none.
--
-- The predicate turns out to be unnecessary. A plain unique index over
-- (recurrence_id, scheduled_for) leaves one-off jobs alone by itself, since
-- Postgres treats NULLs as distinct in a unique index: any number of rows
-- with a null recurrence_id can share a date. The partial clause was
-- restating what NULL semantics already give.
--
-- The turnaround index stays partial — unique (tenancy_id) without the
-- predicate would stop a manual job ever referencing a tenancy — so that one
-- is handled by checking first and inserting, rather than upserting.
-- ═══════════════════════════════════════════════════════════════════════════

drop index if exists maintenance_jobs_one_per_recurrence_date;

create unique index maintenance_jobs_one_per_recurrence_date
  on maintenance_jobs (recurrence_id, scheduled_for);
