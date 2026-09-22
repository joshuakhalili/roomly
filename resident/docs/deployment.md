# Deployment

1. Use an empty or explicitly compatible Supabase project and apply migrations in order. The existing account project named Roomly belongs to another app; see `PRODUCTION_RESOURCE_AUDIT.md` before linking anything. Do not apply `seed.sql` to a customer project.
2. Configure verified email authentication, SMTP, canonical site URL and `/auth/callback` redirect allowlist. The application supports password sign-in and account creation with confirmation.
3. Set `DEMO_MODE=false`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, and `NEXT_PUBLIC_SITE_URL`. Optionally override `OPENAI_MODEL`.
4. Run `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, and `pnpm build`.
5. Deploy on Vercel using the Next.js preset, pnpm install and `pnpm build`. Use Node 24. The runtime is Node, not Edge, for server modules.
6. Verify sign-in/callback, create an organisation, publish a guide, claim an invite from another account, upload/download a private repair attachment and check RLS under both accounts. Enable live AI tests explicitly for the chosen OpenAI model.
7. Configure platform access logs to redact invitation URL path segments, retention, backups and error monitoring. Roomly itself emits no raw provider prompts or raw invitation tokens to analytics.

The demo SQLite path is for local review and automated tests. It is not used in production and is not a Vercel persistence strategy. Production uses Supabase with caller JWT/RLS, never a service-role bypass.

No remote was configured in the starting repository. Account access is available, but discovered Roomly resources belong to another application with an incompatible schema and history. Git commits can be created locally; a deployment or push requires a real configured destination. Do not invent a remote or create a cloud account on behalf of the owner.
