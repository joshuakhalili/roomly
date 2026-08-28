-- ═══════════════════════════════════════════════════════════════════════════
-- How much warning you want before someone moves in or out
--
-- This was a constant in the cron job (MOVE_ALERT_DAYS = 3), which meant
-- changing it needed a code edit and a deploy. It is an operational
-- preference, not a design decision — three days suits someone who cleans
-- between tenancies themselves, and a week suits someone booking a
-- contractor — so it belongs with the other settings.
--
-- Rent deliberately stays fixed at the day after the due date. That one is
-- the feature, not a preference: the whole point is that nobody is chased
-- on the morning their rent is due, and a setting allowing zero would let
-- that be switched off by accident.
-- ═══════════════════════════════════════════════════════════════════════════

insert into app_settings (key, value, description) values
  ('move_alert_days', '3',
   'How many days before a move-in or move-out the alerts start. Rent reminders are always the day after the due date and are not configurable.')
on conflict (key) do nothing;
