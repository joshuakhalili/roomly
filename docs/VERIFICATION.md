# Release verification — 22 September 2026

## Management application

- Lint and TypeScript checks pass.
- 44 operational tests pass, including three regression cases for inventory partial updates. Editing one rating no longer clears the other rating, notes or maintenance flag.
- Embedded PostgreSQL smoke test applies all 26 historical migrations unchanged and checks that public tables retain RLS.
- Production Next.js build passes.
- Three authenticated, read-only Playwright checks exercise all ten management destinations at 1440, 390 and 320px, search empty states, property tabs and the complete mobile navigation menu. No serious/critical axe findings or horizontal page overflow.
- Additional browser review covers property rooms/utilities/documents, room inventory and report item navigation at the same widths; English, Chinese and Turkish property/inventory screens in light and dark themes.
- No live database reset, migration, fixture insertion, email dispatch or scheduled cleanup was performed.

Run the authenticated suite against an isolated review organisation:

```sh
ROOMLY_REVIEW_AUTH=/absolute/path/to/short-lived-storage-state.json npm run test:app
```

`ROOMLY_REVIEW_URL` defaults to localhost:3001. The storage-state file is private and must never be committed. Without it the suite explicitly skips; CI does not pretend to have tested hosted credentials.

## Website

- Build copies the imported Framer baseline and applies owned editorial/style changes. All transformed runtime JavaScript parses.
- Four browser tests cover all 13 original routes at 1440, 390 and 320px, image assets, no public demo explanations, actual 404 responses, FAQ, monthly/yearly pricing via keyboard, management login and access-enquiry destinations.
- No serious/critical axe findings in the route sweep. Original animation/runtime and responsive variants are retained.
- Screenshots are captured from the fictional management review organisation, not a customer's workspace. Licensed people photography makes no endorsement claim.

## Resident / onboarding module

The code in `resident/` is the independently verified local implementation, with shared palette changes. It is not a new management database migration.

- Lint, TypeScript and production build pass.
- 119 tests pass; one real OpenAI-provider test is skipped because provider credentials are absent.
- 13 Playwright tests pass: manager/resident onboarding, Home, guide, cited answers, emergency/refusal behaviour, content publication and permissions, repair intake/timeline, multiple homes, keyboard and responsive layouts.
- Tests ran against the same source in its original checkout before import. The only import-specific differences are documentation explaining the separate deployment boundary.

## Remaining production checks

Resident Auth/Storage/OpenAI provider verification and its public deployment require its own configured project. There is no cross-application data synchronisation. Management external email and cron jobs retain existing configuration but were not invoked by this presentation release. Automated accessibility results are not a substitute for a human assistive-technology audit.

Deployment URLs and commit identifiers are recorded in `RELEASE.md` after publication.
