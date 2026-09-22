# Applications, identities and deployments

| Surface | Source | Audience | Authentication/data | Deployment |
|---|---|---|---|---|
| Website | `site/` | Public visitors | No workspace session | Existing `roomly-site` Vercel project |
| Management | repository root | Letting business staff | Existing Supabase organisations, roles and private storage | Existing `roomly` Vercel project |
| Resident Home and onboarding | `resident/` | Invited residents and their content managers | Independent Supabase project in production; local SQLite adapter for review | Separate deployment; not enabled in management |

A staff viewer is not a resident role. The resident app must not share the management database or its migration sequence. Existing management records are never reset, reseeded or copied by this release. The friend's real organisation and the fictional review organisation retain their existing row-level boundaries.

Management URLs continue to use `/en`, `/zh` and `/tr`. The website's Log in opens the management login. Resident invitations and guest/member entry points belong to their own deployment and are not injected into management navigation or the marketing access enquiry.

## Local resident review

From `resident/`, install with pnpm 11 and run `DEMO_MODE=true pnpm dev --port 3100`. The SQLite adapter needs Node.js 24 and persistent local disk. Maya, Elena, New manager and New resident are documented review identities; never use them as public production authentication. Public Vercel deployments explicitly reject the local adapter.

## Production configuration

The management app retains its current Supabase variables, service key, cron secret, optional email and optional Turnstile configuration. This UI release introduces no schema migration. Vercel deployment does not prove scheduled cleanup or external email delivery has been exercised.

For resident production, create an isolated Supabase project and follow `resident/README.md`, including all resident migrations, RLS tests, private storage, Auth callbacks and optional OpenAI configuration. Do not apply `resident/supabase` to the management project. Cross-application repair synchronisation is not implemented; each application's repair workflow remains independent.
