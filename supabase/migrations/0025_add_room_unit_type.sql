-- PostgreSQL makes newly-added enum values visible only after this migration
-- commits. Keep this separate from the migration that uses 'room'.
alter type unit_type add value if not exists 'room';
