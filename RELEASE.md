# Roomly interface release — 22 September 2026

The management application retains its original operational features and database. Properties, room records and inventory now have distinct navigation and guided review. Shared violet/plum styling replaces the ivory surfaces across management, resident and marketing touchpoints.

The website is built from the original Framer mirror, including the runtime, responsive variants, scroll animations, FAQ and billing-period switch. The earlier Astro rebuild is archived. Updated product screenshots and licensed shared-home photography are included.

## Verified code commits

- `3dc506f`: inventory partial updates preserve unrelated ratings, notes and flags.
- `ec05a68`: management hierarchy, mobile navigation and accessibility fixes.
- `573cf5b`: independently runnable resident/onboarding module and CI.
- `280ccc2`: original Framer integration and shared branding.
- `57274cd`: release boundaries, feature inventory and verification documentation.

## Deployments

- Website: https://roomly-site.vercel.app — existing Vercel project `roomly-site`; repository root directory `site`.
- Management: https://roomly-kappa.vercel.app/en/login — existing Vercel project `roomly`; repository root.
- Resident: independent source under `resident/`; public production deployment is not part of this release. Run locally using its documented adapter.

Website deployment `dpl_CngZ39qFdKVVcGapgtvii6KKFXbW` was verified live: home, guides, about and privacy return 200, yearly pricing works, the mobile layout fits and no browser runtime errors were observed.

Management deployment `dpl_7XqU5GZcaUJHYzXbNcHh2b51WDni` completed successfully and is aliased to the existing production URL. Both GitHub verification runs for code commit `57274cd` passed all management, website and resident jobs.

The authenticated production smoke check was not performed: automatic approval rejected reading stored review credentials from the original website capture script. Local authenticated checks passed; public production pages and deployment status are checked separately.

The release is pushed to `codex/roomly-integration` in PR #1. Merging into `main` requires explicit approval following an automatic approval rejection.

## Checks

Management: 44 tests, one historical migration smoke test, lint/types/build, three authenticated browser tests across ten destinations at 1440/390/320px. Additional property/report and EN/ZH/TR light/dark checks pass.

Website: four browser tests, all 13 original paths at three widths, assets, accessible controls, keyboard pricing, FAQ and clean navigation. No serious/critical axe findings in the route sweep.

Resident: 119 tests plus 13 browser tests, lint/types/build. One real OpenAI-provider check is skipped without credentials.

## Boundaries

No live database migration, reseed, automated email or scheduled deletion was performed. Resident production requires a separate configured Supabase project and provider acceptance checks. Cross-application data synchronisation is not implemented. See `docs/ACCESS_AND_DEPLOYMENT.md` and `docs/VERIFICATION.md`.
