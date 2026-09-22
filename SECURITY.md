# Security

Report a suspected vulnerability privately to [Joshua Khalili](mailto:joshuakhalili20@gmail.com?subject=Roomly%20security%20report). Include the affected route or version, reproduction steps using fictional data and the expected boundary. Do not post credentials, tenant records or exploit details in a public issue. No response-time commitment is implied.

## Current controls

- Supabase Auth plus server-side session validation.
- Organisation/role checks in actions and PostgreSQL row-level security.
- Private storage, organisation-scoped object paths and expiring access links.
- Server-only privileged clients for provisioning and scheduled work.
- Login throttling and optional Turnstile challenges.
- Configurable retention, legal holds and export-aware photo cleanup.

These are implementation properties, not independent certification or a guarantee of security. Embedded database checks do not replace hosted Auth, Storage, backup and restore verification. See the integration progress and verification records for release gaps.

Never weaken authentication, RLS or data retention safeguards to make a preview easier to run. Keep previews isolated from production records and destructive scheduled jobs.
