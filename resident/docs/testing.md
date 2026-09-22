# Testing and release evidence

Final local verification used Node 24.14.0, pnpm 11.19.0 and Chromium through Playwright. The application uses the deterministic demo adapter unless explicitly configured otherwise.

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed |
| `pnpm lint` | Passed, no lint errors |
| `pnpm typecheck` | Passed |
| `pnpm test` | 119 passed, 1 skipped, 5 files passed |
| `pnpm test:e2e` | 13 passed in Chromium (1.1 minutes) |
| `pnpm build` | Passed, production routes generated |

The one skipped test is the opt-in live OpenAI contract test. Run it only with a real key and `ROOMLY_LIVE_AI=true`. Static structured-output contract checks run without a key.

## Coverage

- Domain tests cover onboarding persistence, invitation expiry/revocation/single claim, membership and schedule restrictions, individual agreement versions, readiness, publication isolation, archive/restore/history, translations, unanswered questions, repair transitions and private timelines.
- AI evaluation includes 53 fixtures covering supported, missing, ambiguous, emergency, access-sensitive, multilingual and prompt-injection inputs. Additional tests check malformed/missing/foreign citations, provider errors, redaction and strict schemas.
- Testing Library checks content review, readiness, answers, emergency guidance, preview focus, manager resume and Undo.
- Twelve database integration tests apply all six real SQL migrations to embedded PostgreSQL (PGlite with pgcrypto). Auth and Storage platform schemas are stubbed, while the application's actual RLS, functions, constraints and transactions execute. Tests use authenticated JWT identities and include a full manager onboarding/publish change-set sequence.
- Thirteen browser tests cover permanent Home, grounded/refused/emergency answers, offline/provider failures, seven-step manager setup and resume, invitations and all three seeded resident languages, content save/publish/preview/Undo, private repair attachments and manager updates, mobile/reduced-motion/zoom, public routes and unauthorized requests.
- Axe scans cover public pages, resident onboarding, manager onboarding and primary resident/manager pages, rejecting every serious or critical violation. Keyboard checks cover navigation, form entry, review actions and dialog focus restoration. Controls use minimum 44px targets. Browser checks include 320px width, 200% CSS zoom and reduced motion; screenshots were visually reviewed.

## Reproduce

Follow the commands in the README. Install Chromium with `pnpm exec playwright install chromium` before the browser suite. E2E starts a server on port 3100 with its own build directory and fresh SQLite file. It leaves the interactive port 3000 demo alone. Playwright HTML reports and failure traces remain local and ignored by Git.

`pnpm db:test` additionally runs the checked-in pgTAP suite against a local Supabase stack. Docker is unavailable in this environment, so this command was not run; PGlite executed the real application migrations and role policies instead. Generated table types were derived from the applied PostgreSQL catalog and can be regenerated with the Supabase CLI after starting Docker.

## External verification limits

Hosted Supabase email delivery/auth callbacks, the real Storage service, and live OpenAI responses require accounts and credentials. They were not exercised. Before accepting customer data, complete the production smoke test in `deployment.md` with two real accounts and a private attachment. No production deployment or Git push was performed because no remote or deployment destination is configured.

UI follow-up: guide search/filter/empty-state recovery, citation disclosure, clipboard copying, attachment feedback and keyboard editor disclosure are now covered. Every manager page also passes axe and overflow checks at 320px. Page-ready assertions exclude the streaming loading view before scanning. See `UI_REVIEW.md`.

Autonomous audit regressions cover production sign-up/sign-in/callback continuation with a mocked Supabase SDK, open-redirect denial, multiple-home resident navigation/repair submission, setup template synchronization and preserving manual edits. The local database type-generation command was also tested with a deliberately failing CLI; it preserves existing types and cleans its temporary file. These are not claims of hosted-provider verification. See `PRODUCTION_RESOURCE_AUDIT.md` for the actual account/resource findings.

Desktop completion adds route-by-route layout checks at 1024 × 640, 1440 × 900 and 1920 × 1080, plus short-window navigation, expanded forms, retained AI draft notes, clickable overview counts, long names, preview keyboard focus, and 200% desktop zoom reflow (720 × 450 CSS viewport). All four new desktop checks and the nine existing browser flows passed together. Lint, typecheck, the 119 non-live tests and production build passed after the desktop changes.
