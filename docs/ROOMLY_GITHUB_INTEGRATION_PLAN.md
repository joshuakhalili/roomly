> **22 September update:** The latest product direction supersedes the earlier shared-database/Astro proposal below. The released website preserves the original Framer runtime. Resident access is a separate application under `resident/`, with a separate schema and production deployment. Follow [ACCESS_AND_DEPLOYMENT.md](ACCESS_AND_DEPLOYMENT.md) and [INTEGRATION_PROGRESS.md](INTEGRATION_PROGRESS.md) for the current implementation. The historical plan is retained for context, not as instructions to migrate the staff database.

# Roomly integration and overhaul plan

Status: approved for execution. The original plan was prepared from repository and live-site inspection. Current execution and verification are tracked in INTEGRATION_PROGRESS.md. September 2026 update: keep portfolio/demo status in README and engineering documentation, not public website or app copy.

## 1. Outcome and source of truth

Upgrade the existing Roomly product in `joshuakhalili/roomly`. Preserve its operational features and records, apply the new onboarding/UI approach across the product, and add the resident experience. Bring the marketing website under the same release discipline.

The latest instruction to preserve existing functionality supersedes the earlier handover's exclusions of rent, tenancy operations, expenses and portfolio analytics. Those exclusions described the scope of the standalone resident-handbook implementation, not features to remove from the existing product. Retain the handover's quality, privacy, accessibility and review-before-publication requirements for the new functionality.

Verified sources:

| Surface                                   | Source inspected                                                                                                               | Meaning                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Existing application                      | `https://github.com/joshuakhalili/roomly`, commit `0e383c9`; local checkout `/Users/100milliongbp/Desktop/Github Repos/roomly` | Canonical foundation; preserve Git history and application behaviour                            |
| Onboarding and resident UI implementation | `/Users/100milliongbp/Documents/ChatGPT/roomly`, commit `de96dd3`                                                              | Source of reusable flows, design patterns, AI contracts and tests; not a replacement repository |
| Existing marketing website                | `https://roomly-site.vercel.app`; source `/Users/100milliongbp/Desktop/Github Repos/roomly-site`, commit `02a409f`             | Static site with its own local Git history, no configured remote                                |
| Existing application deployment           | `https://roomly-kappa.vercel.app`                                                                                              | Existing app URL; linked by the marketing site's login navigation                               |
| Website deployment                        | Vercel project `roomly-site`, static/Other framework                                                                           | Keep separate from the authenticated app deployment                                             |

The GitHub source has 26 migrations, operational organisation isolation, three UI languages, scheduled jobs and more functionality than its introductory README lists. This audit inspected source; it did not run the existing hosted application's complete regression suite. The standalone implementation's 119 passing tests and 13 browser tests do not prove an integration works.

## 2. Product structure: one product, three surfaces

1. **Website:** explains Roomly, shows genuine product screens, offers access by enquiry, and sends existing users to login.
2. **Manager workspace:** all existing portfolio operations, with clearer navigation and the new onboarding, handbook, invitations and resident-question tools.
3. **Resident Home:** invitation-based access to essentials, guide, agreements, first-week tasks, Ask Roomly and the resident's repair reports.

Use the same brand, controls, terminology, typography and interaction patterns. Use different navigation for different responsibilities. A dense rent table should remain a useful table; it should not be forced into the resident dashboard layout.

Recommended manager navigation groups:

- Overview: dashboard and analytics.
- Lettings: properties, rooms, people, tenancies and rent.
- Resident experience: home content, invitations and questions, scoped to the selected property/room.
- Operations: maintenance, inventory, documents and expenses.
- Settings: organisation, administrators, profile, language, theme and retention.

All destinations remain reachable on desktop and mobile. Preserve existing URLs and bookmarks. Put new staff-facing home tools beneath existing property/room routes; keep locale prefixes (`/en`, `/zh`, `/tr`). Resident routes live in their own authenticated route group, such as `/{locale}/home`, outside the staff layout. Public invitation routes disclose only safe welcome details. Role-aware login preserves the intended destination; people with both staff and resident access can select a permitted workspace.

## 3. Feature-preservation contract

Create a checked-in feature ledger before any overhaul. Each row records its existing routes, actions, tables, permissions, replacement UI, regression test and completion status. Presence of a menu item alone is not proof that the feature survived.

| Existing capability to preserve                                                      | UI integration                                                                        | Required proof                                                                                                       |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Properties, room/studio/flat units, shared areas, property imagery                   | Consistent property and room detail layouts; reuse existing records during onboarding | Create/edit/delete permission cases, room baseline creation, images and identifiers preserved                        |
| People, multiple occupants, lead tenant, tenancy history                             | Clear people and tenancy views; invitation status alongside eligible occupants        | Couples retain separate people records and shared tenancy; no duplicate people from invite claim                     |
| Upcoming/active/ended/archived tenancies; long lets and short stays                  | Guided forms using current fields and lifecycle                                       | Existing transitions and date rules, fixed-price short stays, archive/history remain valid                           |
| Rent cadences, due/paid/late/waived states, notes and manual payments                | Readable desktop tables and mobile detail views                                       | Weekly/fortnightly/four-weekly/monthly/total rules, month-end/leap-year cases, balances unchanged                    |
| Baseline, check-in and check-out inventories                                         | Same editor workflow quality as onboarding, with task-appropriate density             | Sections, custom areas, ratings, photos, meters, keys, detectors, declarations/signatures, completion and comparison |
| Condition-report PDFs and stored exports                                             | Consistent export/progress/error controls                                             | Representative large report downloads and archives correctly; inspect content as well as HTTP success                |
| Tenant, tenancy, property and business documents; requirement/expiry reporting       | Unified document lists with clear ownership and visibility                            | Upload/read/delete restrictions, private signed links, expiry and missing-document counts                            |
| Maintenance jobs, schedules, recurring work, contacts, assets and attached paperwork | One manager maintenance workspace receiving resident reports                          | Existing recurrence, job, asset, contact and payment flows remain available                                          |
| Expenses, categories, utilities, bills-included analysis, tax-year ledger            | Clear filters, totals and source links                                                | Same fixture produces the same totals; no double counting of jobs, assets or utility bills                           |
| Dashboard, occupancy/arrears trends and analytics                                    | New visual system without removing useful metrics                                     | Counts and calculations match baseline fixtures, empty states and date filters work                                  |
| Calendar subscription, daily jobs, optional email digest                             | Preserve settings and delivery mechanisms                                             | Existing feed URLs work; token rotation works; repeated jobs do not duplicate records                                |
| WhatsApp deep links and WeChat copy reminders                                        | Retain deliberate user-triggered sending and tenant language                          | Correct recipient, message, locale and clipboard/link behaviour                                                      |
| Organisation trials, owner/admin/staff/viewer permissions                            | Existing access model with clearer settings                                           | Two-organisation isolation, viewer write denial, administrative role restrictions                                    |
| Retention, legal holds, archive/erasure logs and storage limits                      | Preserve visibility and controls in Settings                                          | Dry-run and destructive fixture tests; held records protected; no duplicate production schedules                     |
| English, Simplified Chinese, Turkish; language preferences                           | Keep `next-intl`; translate added UI into all three languages                         | Existing and new labels, emails/reminders where applicable, expansion and date/number formatting                     |
| Theme preference, responsive navigation and PWA installation                         | Preserve light/dark/system functionality and install support                          | Both themes, manifest/icons, small/large viewports, keyboard and zoom                                                |

Tests must exercise the existing behaviour before refactoring and the same behaviour afterward. Record pre-existing failures separately and fix release-blocking defects rather than treating them as acceptable regressions.

## 4. Repository and code architecture

Use the existing GitHub repository and its `main` history. Start short-lived `codex/` branches from the current upstream commit. Port selected functionality through reviewed pull requests; do not merge the unrelated local root history over the app or copy entire directories blindly.

Recommended layout:

```text
src/
  app/[locale]/       existing staff routes + new public/auth/resident route groups
  components/        shared design primitives and feature components
  lib/
    actions/         existing server actions, gradually standardised
    auth/            staff and resident access checks
    content/         handbook permissions, publication and versions
    onboarding/      resumable setup and membership onboarding
    ai/              provider contracts and deterministic demo adapter
    resident/        memberships, invitations and safe home queries
    maintenance/     resident-report / operational-job bridge
supabase/migrations/ existing history + additive integration migrations
tests/               existing tests + SQL, browser, accessibility and AI regressions
design/              shared tokens and brand assets
site/                marketing-site source and independent build
docs/                feature ledger, architecture, migration and release runbooks
.github/workflows/   continuous verification
```

Keep the current app at the repository root initially, its npm lockfile, Next.js routing and existing useful dependencies (PDF generation, calendar, internationalisation, themes). Avoid combining a package-manager migration, framework upgrade and feature integration. Pin added dependencies and validate a single compatible React/Next combination. Reconcile the local implementation's differing action contracts and locale identifiers through explicit adapters.

Port pure functions and proven UX patterns where appropriate. Refactor the standalone domain code into bounded modules; do not import its large application-wide dispatcher, SQLite store or fresh-database schema as production infrastructure. Preserve existing server actions until their replacements pass equivalent tests. Generate database types from the integrated schema and keep user-facing errors stable while adding structured error codes incrementally.

For the website, import its source with provenance/history retained and keep the original local repository intact. The current generator depends on its own `pristine-mirror` Git tag and string replacement inside Framer output; simply copying it into a subdirectory would not create a reliable build. First preserve a reproducible baseline, then replace that generation mechanism with maintainable static page templates and structured content. Recommended implementation: an independently built Astro site under `site/`, consuming shared CSS tokens/assets. Preserve URLs, content and useful interactions through parity checks. This static-site build change is isolated from app/database integration.

## 5. Data integration: extend the existing model

### Canonical records

Keep existing `organizations`, `properties`, `rooms`, `tenants`, `tenancies`, `tenancy_tenants`, documents and operational tables as the source of truth. Retain their IDs. Do not introduce a competing `organisations` table or a second set of properties and rooms.

Add guide/publication settings in related tables where their concerns differ from operational property records. New content, version, translation, invitation, acknowledgement, onboarding-task and AI-audit tables reference the existing organisation/property/room IDs. All new foreign-key relationships enforce organisation consistency.

### Staff identity and resident identity

The existing `profiles` table represents organisation staff. Its `viewer` role still reads organisation records; it is not a suitable resident role.

Keep staff profiles and the existing role checks intact. Add neutral resident-account/preferences records linked to Supabase Auth and scoped resident memberships tied to a room and, where applicable, an existing tenancy and occupant. A person may hold both staff access and resident memberships without gaining new permissions from the latter.

Invitations are created against an explicitly selected occupant/tenancy or a controlled new-resident workflow. Do not match accounts to records solely by an email string. Claim is authenticated, single-use and transactional. Multiple occupants receive independent invitations and acknowledgements. Membership dates and tenancy status drive pre-arrival, active and ended access; move-out revokes current-home access without deleting the manager's historical records. Re-invitations, returning residents and room transfers are tested explicitly.

New actor/audit references must work for both staff and residents; do not copy foreign keys that require every resident to have a staff profile.

### Repair reports and operational maintenance

Keep resident reports as intake/conversation records linked to existing `maintenance_jobs` when a manager schedules work. Reports can exist without a job: the current jobs table requires a scheduled date, and reporting a leak must not invent an appointment.

Allow multiple reports to link to one job where appropriate. The existing job owns schedule, contractor/contact, costs, payment and expense-ledger contribution. The report owns resident description, private attachment and resident-visible timeline. Map status changes explicitly and publish only appropriate updates; internal notes, costs and other residents' reports remain private. No second expense row is created for the same repair.

### Documents and AI boundaries

Keep the existing document library and storage paths. Add explicit publication/access grants for any document intended for residents. Being in the same property must never expose passports, other occupants' records or internal documents.

AI retrieves only approved handbook sources, not the rent ledger, identity documents or unrestricted operational records. Keep reviewed extraction/translation, grounded citations, refusal, deterministic emergency guidance and explicit publication. Do not add AI rent collection, legal decisions or vendor dispatch. Preserve manual operations already present in the original app.

### Migration method

1. Confirm the current production migration ledger and schema; repository migration count alone is not proof of deployed state.
2. Rehearse on an isolated database with representative fixtures and a protected backup/restore path.
3. Add tables/columns and constraints without removing or rewriting historical migrations.
4. Backfill only necessary links, with dry-run reports, transaction boundaries and repeatable steps. Flag ambiguous tenant matches for resolution; never guess.
5. Compare counts, IDs, rent balances, expense totals, inventory relationships and file references before/after.
6. Test old staff workflows and new resident access under real authenticated database roles, including direct API/storage attempts.
7. Deploy compatible application code with the resident experience disabled by default, then enable per organisation after verification.
8. Roll back application/feature activation without dropping the new data. Any destructive cleanup is a separate later change, never part of this overhaul.

Existing production customer records are not copied into browser screenshots, AI prompts or public preview deployments. Demo adapters use isolated fictional data. No production reset or seed command is part of the plan.

## 6. Onboarding and the full UI overhaul

Adopt the warm bone/ink/violet design, clearer task order, progressive disclosure, saved-state feedback and desktop/mobile quality from the new implementation. Translate them into the existing components rather than shipping two competing global stylesheets. Audit semantic warning/danger states so operational meaning is not lost. Preserve dark mode and all three languages.

**New manager:** welcome → organisation → property → rooms/units and contacts → existing occupants or invite preparation → optional source notes/AI review → readiness/preview/publish. Existing data entry and empty states link naturally into this setup. Expensive setup can resume; optional handbook publication does not block rent/inventory work.

**Existing manager:** goes to the current workspace, with a resumable “Set up the resident experience” task for an existing property/room. Never force existing users to recreate organisations, properties or tenancies. Pre-fill from existing records, require review for resident publication and retain missing-data indicators.

**Resident:** invite → identity → preferences → permitted essentials → versioned house agreements → first-week tasks → Roomly Home. House-guidance acknowledgements remain distinct from signing a tenancy agreement or a formal inventory report.

**Existing operational screens:** redesign in batches: dashboard/properties/people; tenancies/rent; inventory/documents; maintenance/expenses/analytics; settings. Every batch carries its feature-ledger checks. Retain dense tables, filters and comparisons when useful. Keep saves, destructive-action confirmation, undo/recovery, offline and error handling visible and consistent.

## 7. Website integration and refresh

The inspected website already describes property operations, rent, expenses, inventory and compliance. Keep that product promise and add the resident side to it.

- Present the whole journey: manage the property, welcome residents, support everyday life.
- Show two clear audiences: property managers and residents. Retain the original operations feature coverage and add onboarding, home guides, invitations, Ask and repair reporting.
- Replace screenshots with the verified integrated application, including desktop and mobile. Do not imply the standalone local demo is already the live product.
- Fix CTA semantics: the current hero control labelled “Log in” opens a demo-request email, while navigation login opens the app. Login, Request access and a future Get started action must have distinct, honest destinations.
- Preserve blog URLs, build log, About, privacy and terms; create redirects for any deliberate URL change. Maintain metadata, sitemap, canonical URLs, social previews and accessible images/headings.
- Make pricing, plan comparison and access terms consistent. Local site notes describe the displayed prices/tier allocations as presentation choices; the site displays pricing while describing a demo-access model. Do not silently turn those figures into billing rules. Preserve current amounts during the design pass and clearly distinguish actual availability; commercial packaging is a separate owner decision.
- Explain the resident/AI data flow accurately in privacy copy. Do not repeat categorical legal-compliance claims without review. This is a content verification task, not a claim that the existing policies are legally sufficient.
- Preserve or reimplement working FAQ/pricing interactions, navigation and reduced-motion behaviour. Check runtime counters rather than assuming initial zero values are final figures.
- Keep access request-based until a real self-service onboarding flow is deployed. No non-functional signup buttons or newly introduced paid subscription flow.
- Keep the app and site as separate Vercel projects, both linked to the canonical repository with appropriate root/build settings. Existing URLs remain usable; custom domains are an optional later configuration.

## 8. GitHub sturdiness and release gates

- Protect `main`, use small named PRs with preview links, test results, affected features and migration notes. Preserve both app and website history/provenance; never force-push the current local history over upstream.
- CI runs deterministic install, lint, typecheck, current operational unit tests, new unit/component/AI tests, PostgreSQL migration/RLS tests, browser flows and production builds.
- Migrations must apply to both a fresh database and the previous release's database with populated fixtures. Use isolated Supabase/PostgreSQL for platform-specific Auth/Storage verification; embedded PostgreSQL remains useful but is not a substitute for every hosted-service check.
- Cover owner/admin/staff/viewer, resident, mixed-role and unauthenticated identities across at least two organisations. Test direct requests as well as hidden navigation.
- Test desktop/laptop/mobile widths, short windows, 200% zoom, keyboard, reduced motion, light/dark themes and English/Chinese/Turkish. Add Chromium, WebKit and Firefox coverage; the standalone tests currently establish only Chromium results.
- Test manager setup with both new and populated organisations, single-use invite claims, scheduled access, multi-occupancy, move-out, room transfer, publication isolation, repair-to-job flow and expense totals.
- Include full PDF generation/download, calendar tokens, recurring job idempotency, storage caps, retention preview/legal holds and report export before deleting raw photos.
- Track route errors, failed saves, background-job failures and AI provider failures without logging sensitive content. Add dependency/security scanning and a documented backup/restore rehearsal.
- Keep production cron credentials and destructive retention schedules out of previews. Preview app and site use a dedicated test environment, never an accidental production database connection.
- Before release, manually walk the feature ledger and integrated journeys on the preview. Publish the website refresh only when its claims and screenshots match available app behaviour.

## 9. Delivery sequence and definition of done

| Stage / PR group                    | Deliverable                                                                                                                     | Exit gate                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1. Preserve and baseline            | Confirm upstream/source folders; retain local work; record feature ledger, migrations, routes, screenshots and release baseline | Every original feature mapped; existing test results recorded      |
| 2. Test and release foundation      | CI, isolated test environment, representative multi-organisation fixtures, initial browser/RLS coverage                         | Existing operational flows pass before UI changes                  |
| 3. Shared UI foundation             | Tokens, components, role-aware navigation shells, locale/theme support; first original screens restyled                         | Desktop/mobile and original workflows pass                         |
| 4. Additive identity/data bridge    | Resident accounts/memberships, safe invitations, content schema, staff-policy preservation                                      | Fresh/upgrade migrations and cross-role isolation pass             |
| 5. Onboarding and resident handbook | New/existing manager setup, resident claim/onboarding, publication, guide and Ask                                               | End-to-end journeys run on existing Roomly records                 |
| 6. Maintenance integration          | Resident intake connected to existing jobs and expense behaviour                                                                | No duplicate jobs/costs; private/public timeline tests pass        |
| 7. Remaining operational UI         | Rent, tenancies, inventory, PDFs, documents, expenses, analytics and settings                                                   | Every feature-ledger row verified with new design                  |
| 8. Website in GitHub                | Import/provenance, maintainable static build, updated copy/screens, link/SEO checks                                             | All existing public routes and interactions pass                   |
| 9. Release rehearsal and rollout    | Restore drill, upgrade rehearsal, staged enablement, complete regression, app/site release notes                                | Zero unexplained feature loss or data mismatch; rollback exercised |

The site inventory and content draft can proceed while app integration is developed; screenshots and final publication depend on the integrated UI. Database/permission design must precede resident account enablement. No calendar estimate is asserted before the baseline identifies existing defects and deployment constraints.

“Done” means the existing GitHub repository contains the integrated implementation and website source, its complete feature ledger passes, prior records and permissions remain correct, new onboarding and resident journeys work against that same data model, and app/site deploy reproducibly with documented rollback. A local passing demo or a successful push alone is not completion.

## 10. Discussion points

Recommended direction: one canonical GitHub repository; two deployments; preserve all original operations; use the new UI/onboarding as the design and flow reference; separate resident permissions; stage the rollout.

The two product decisions worth discussing are commercial availability (request-a-demo versus genuinely open signup) and how prominently the website should balance manager operations with resident experience. Neither requires changing or discarding existing features. Default for this plan: retain request-based access and give manager operations the lead, with resident experience presented as a connected benefit.
