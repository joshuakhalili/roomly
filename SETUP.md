# Set up Roomly

Use Node.js 24 and npm. Work against a fresh development Supabase project, not an existing customer database. The website and automated database tests require no Supabase account.

## 1. Install

```sh
npm ci
cp .env.example .env.local
```

Set the project URL, public anon key, server-only service-role key, a random `CRON_SECRET` and `NEXT_PUBLIC_APP_URL=http://localhost:3000`. Keep `.env.local` out of Git. Leave optional email and Turnstile settings blank until you configure those services.

## 2. Apply the database history

Apply every file in `supabase/migrations/` in ascending filename order, from `0001` through `0026`. Later files add required columns, organisation isolation and security fixes. Applying only the first two files is insufficient.

Use your normal Supabase migration workflow. With the Supabase CLI installed and a linked **development** project, `supabase db push` applies pending migrations; inspect the target and the pending list before confirming. Alternatively, execute each complete SQL file in a fresh project's SQL editor in order and record what was applied. Never rerun an initial migration over a populated schema.

Embedded verification, without cloud credentials:

```sh
npm run test:database
```

This verifies migration SQL against PostgreSQL via PGlite with small Auth/Storage test shims. It does not start the application or validate Supabase's hosted services.

## 3. Create an organisation and owner

An Auth user alone has no staff access. The provisioning script creates an isolated organisation, its defaults, an Auth user and the owner's profile. Choose a new slug and email. The script is not a general-purpose migration or account recovery tool.

Load `.env.local` and provide `TRIAL_PASSWORD` in the process environment using your secret manager or a hidden shell prompt. Do not put the actual password in a command argument or commit it.

```sh
node --env-file=.env.local --import tsx scripts/create-trial-organization.ts   --name 'Roomly Review'   --slug roomly-review   --email owner@example.test
```

The password must be at least 12 characters. Use an address you control if you need real email flows. The script confirms the organisation and email without printing the password. Clear `TRIAL_PASSWORD` from your shell when finished.

## 4. Run

```sh
npm run dev
```

Open <http://localhost:3000/en/login> and sign in with the owner you created. Add properties and rooms, then tenants and tenancies. Use the app's administrator controls to grant colleagues access with an appropriate role.

## 5. Website

```sh
cd site
npm ci
npm run dev
```

The static website runs at <http://localhost:4321> without accounts or secrets. See [site/README.md](site/README.md) for assets, content and deployment.

## 6. Verify and deploy

```sh
npm run lint
npm run typecheck
npm test
npm run test:database
npm run build
```

Deploy the application from the repository root and the website from `site/` as separate Vercel projects. Configure app environment variables in the correct environment, HTTPS app URL, Supabase redirect URLs and private storage policies. Do not copy production cron or email credentials into previews. Review storage limits, backup/restore, retention schedules and the [remaining release gates](docs/INTEGRATION_PROGRESS.md) before storing real tenant data.

The hosting provider's current plans and terms determine billing and commercial use. No free-service guarantee is implied by these instructions.

## Troubleshooting

- **Sign-in succeeds but records are unavailable:** confirm the user has a `profiles` row with the intended organisation and role. Do not bypass RLS.
- **Missing table, column or function:** verify every migration was applied, in order.
- **No email digest:** optional Resend configuration and the scheduled job must both be present.
- **Build succeeds but data cannot load:** a build is not a connectivity or permission test; check the configured project and authenticated account.
- **Database reset needed:** create a separate clean development project. Do not erase a populated schema to recover from a migration error.
