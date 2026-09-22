# Roomly acceptance matrix

Source: the 30 acceptance criteria in `ASTRA_IMPLEMENTATION_HANDOVER.md`. All product criteria are implemented and verified through the credential-free adapter, application tests and real PostgreSQL policy tests as indicated below. Hosted-provider verification remains external configuration, not a silently claimed test result.

| # | Criterion | Evidence / result |
| --- | --- | --- |
| 1 | Install, lint, typecheck, tests, build | Passed; exact results in `testing.md` |
| 2 | Credential-free complete demo | Persistent SQLite adapter, four selectable identities; browser suite starts it without secrets |
| 3 | Seven-step manager onboarding and resume | Full E2E with refresh/resume; domain and PostgreSQL change-set coverage |
| 4 | Accepted, edited, rejected extraction outcomes | Distinct stored suggestion decisions; domain/component/E2E tests |
| 5 | No automatic AI publication | Suggestions create drafts; publication snapshot tests |
| 6 | Invite expiry, revoke, replacement | Manager E2E and domain tests |
| 7 | Expired/revoked/claimed tokens cannot reveal private data | Hash-only persistence, safe resolver, domain and SQL denial tests |
| 8 | Single claim; three seeded languages | English, Chinese, Turkish resident onboarding E2E; SQL claim lock test |
| 9 | Individually versioned required agreements | Completion gate, exact version checks, UI acknowledgements, domain/SQL tests |
| 10 | Onboarding ends at permanent Home | Resident E2E |
| 11 | Conditional Today | Incomplete onboarding/agreement/task priority; hidden when complete; domain checks |
| 12 | Membership, visibility, schedule | Shared permission filter and SQL snapshot function tests |
| 13 | Every answered AI response cites authorized blocks | Retrieval filtering and response validation; 53 fixtures |
| 14 | Invalid/missing citations become unknown | Missing, foreign and malformed citation regression tests; manager handoff UI |
| 15 | Immediate deterministic emergency response | Client/server gates precede provider; bypass unit test and browser checks |
| 16 | Cross-organization/room denials | Domain, authenticated PostgreSQL RLS and HTTP E2E checks |
| 17 | Unanswered question to draft FAQ | Inbox operation and domain tests; explicit publish remains separate |
| 18 | Repair description/location/availability/attachment | E2E PDF upload, draft review and submission |
| 19 | Maintenance emergency guidance and confirmation | Deterministic classification and browser confirmation flow |
| 20 | Own resident timeline; organization manager scope | Domain/SQL visibility and E2E manager-to-resident update |
| 21 | Draft saves isolated from published guide | Separate source and translation snapshots; SQL/domain/E2E tests |
| 22 | Recoverable delete and history | Soft archive, timed Undo, later restore and append-only versions; domain/E2E |
| 23 | Shared desktop/mobile preview permissions | Same `visibleBlocks` projection and renderer; preview focus and isolation tests |
| 24 | Keyboard actions and 44px targets | Semantic forms/buttons, associated checkbox labels, focus-managed dialog, target CSS, keyboard browser checks |
| 25 | No serious/critical axe issues on primary routes | Axe assertions inside nine passing browser tests |
| 26 | 320px, 200% zoom, reduced motion | Browser viewport/overflow/zoom/motion checks and reviewed screenshots |
| 27 | No secrets/private unrelated data in AI logs | Field exclusions, redaction, hashes and source IDs only; privacy tests. Platform URL log redaction is a deployment requirement |
| 28 | Required documentation | README; architecture, data-security, AI-safety, testing and deployment documents |
| 29 | Prototype only under docs | Original file preserved at `docs/prototypes/roomly-pass.html`; absent from route tree |
| 30 | Final scope, configuration, test and commit report | Delivered with local commit hash; push skipped as explicitly allowed when no remote exists |

## Deferred external verification

No product acceptance criterion is intentionally deferred. Real Supabase Auth/email/Storage service integration and live OpenAI contract execution have not been verified against hosted accounts. Docker is unavailable, so the Supabase CLI pgTAP command was not executed; the real migrations and policies passed twelve embedded PostgreSQL tests. Production deployment, remote push and live credentials are not claimed. The working rules explicitly permit local commits when no remote exists.

See `testing.md` for the exact scope and reproduction steps, and `deployment.md` for the required live smoke test.

Verified application commit: `c9ef76d3b0dd2708fd15f158aa70b2879e061811`. A following documentation-only commit records the completed checklist. No configured Git remote; no commit was pushed.

UI follow-up: consistent everyday screens, guide discovery, compact content editing, invitation copying and repair filters implemented. Verification: 103 tests passed, 1 opt-in live provider test skipped; 8 E2E tests passed; lint, typecheck and build passed.

Follow-through audit: 119 unit/component/integration checks passed and one live-provider check remains skipped; 9 browser flows passed, including complete second-home onboarding and repair navigation. Authentication continuation was tested with mocked SDK responses. Existing account access was verified, but discovered cloud resources are incompatible with this release; see `PRODUCTION_RESOURCE_AUDIT.md`.

## Desktop completion verification

Desktop layout and keyboard regressions now cover all primary public, resident and manager routes at laptop and wide-monitor widths, plus short windows, long names, expanded forms, retained notes, preview focus and 200% desktop zoom reflow. `pnpm test:e2e`: 13 passed in Chromium. `pnpm test`: 119 passed, 1 opt-in live provider test skipped. Lint, typecheck and production build passed. No previously passing mobile or end-to-end criterion regressed. External service verification and push/deployment requirements remain as documented in `PRODUCTION_RESOURCE_AUDIT.md`; no configured Git remote exists.
