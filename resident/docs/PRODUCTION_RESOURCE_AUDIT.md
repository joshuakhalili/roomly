# Production resource audit

The CLI account checks on 21 September 2026 succeeded for GitHub, Vercel and Supabase. The earlier limitation was missing configuration in this checkout, not missing account access.

## Existing resources

- GitHub has `joshuakhalili/roomly`, a different application described as bilingual property management with tenancies, rent and inventory reports. Its repository structure and history differ from this checkout.
- Vercel has `roomly` and `roomly-site` in the existing account. Neither is linked to this checkout.
- Supabase has an active `roomly` project. A metadata-only query found an existing rent/tenancy schema, including `tenancies`, `rent_payments`, `tenants`, `inventory_checklists`, `properties`, `rooms` and `profiles`.

This handover's schema uses some of the same table names with different definitions. Applying its migrations to that database would conflict with the existing application. No application migrations, seed data, deployments or repository updates were applied to those resources. The CLI's task-created local link was removed after inspection; `.temp` and `.vercel` metadata are ignored by Git.

## Required destination

This release requires an empty/compatible Supabase project and a confirmed repository/deployment destination, or an explicitly planned migration of the other application. Its credentials must be configured in the deployment environment with `DEMO_MODE=false`. An OpenAI API key is still absent from this checkout/environment.

Do not use `supabase db reset`, force-push this unrelated history over the existing main branch, or deploy this checkout over the other app merely because it shares the Roomly name.

The local review product remains runnable without these decisions. Production authentication continuation is now covered by mocked SDK contract tests, but real email delivery, live Storage and live OpenAI are still unverified for this release.
