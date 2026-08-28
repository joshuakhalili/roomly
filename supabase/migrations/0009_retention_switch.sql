-- ═══════════════════════════════════════════════════════════════════════════
-- The safety catch on the retention job
--
-- The job is scheduled from the day it ships, but it starts in preview mode:
-- every run works out exactly what is due and writes it to data_erasures
-- with dry_run = true, deleting nothing. Someone has to read a real preview,
-- against real dates, and then turn this on.
--
-- A dry-run flag you have to remember to pass is a dry-run flag that gets
-- forgotten once. This is the same idea with the default the right way round:
-- the dangerous mode is the one that takes a deliberate action to reach.
-- ═══════════════════════════════════════════════════════════════════════════

insert into app_settings (key, value, description) values
  ('retention_enabled', 'false',
   'When false the daily retention job only previews what is due and deletes nothing. Turn on from the Retention page once a preview has been reviewed.')
on conflict (key) do nothing;
