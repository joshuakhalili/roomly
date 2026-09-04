-- ═══════════════════════════════════════════════════════════════════════════
-- Turkish, as a language tenants can be written to in
--
-- The app_language enum backs three columns: which language a tenant is
-- messaged in, which one an admin reads the interface in, and which one a
-- message template is written for. Adding a UI locale alone would leave a
-- Turkish-speaking landlord reading Turkish while every tenant reminder still
-- went out in English.
--
-- This migration adds the value and does nothing else, on purpose. Postgres
-- refuses to use a newly-added enum value in the same transaction that adds
-- it, so the templates that use it are in 0022. Same reason 0016 added
-- 'total' to rent_frequency without writing it anywhere.
-- ═══════════════════════════════════════════════════════════════════════════

alter type app_language add value if not exists 'tr';
