# Verification record — 22 September 2026

Scope: website refresh, repository documentation and baseline test foundation on `codex/roomly-integration`, based on canonical commit `0e383c9`.

| Check | Result |
| --- | --- |
| `npm ci` / dependency installation | Successful; app and website lockfiles committed |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | 41 passed, 0 failed, 10 suites |
| `npm run test:database` | 1 passed; all 26 historical migrations apply unchanged; every public table retains RLS |
| `npm run build` | Passed with placeholder Supabase URL/key; no production data accessed |
| `npm --prefix site run check` | 14 files, 0 errors, 0 warnings, 0 hints |
| `npm --prefix site run build` | 13 pages generated, plus robots.txt and sitemap.xml |
| `npm run test:site` | 4 passed: 13 public routes at 1440, 390 and 320px, plus keyboard/FAQ/menu/reduced-motion flow |
| Website accessibility | No serious or critical axe violations in those 39 route/viewport checks |
| Website routes and assets | Internal page links resolve; images load; no page exceptions or horizontal overflow in tested widths |
| Public presentation | Rendered public pages contain no demo/project/prototype labels; contact and login destinations verified |
| Dependency audit during install | 0 vulnerabilities reported for each installed dependency tree |

The browser suite covers Chromium. It does not establish full WCAG conformance or Firefox/WebKit behaviour. Checked-in screenshots show fictional review data from the original management app and the refreshed website. The management app's new production build is not a complete authenticated browser regression.

The database harness uses PGlite with Auth and Storage shims. It preserves historical migration SQL and permission revocations; this initial smoke check does not establish hosted Supabase behaviour, a populated upgrade, backup/restore or all cross-role policies.

## Remaining release gates

- Additive resident/onboarding integration into the existing records and permission model.
- Full original-feature browser regression, PDFs, feeds, schedules and retention rehearsals.
- New flow, cross-organisation, cross-room, mixed-role and private storage tests.
- Credential-free adapter for the integrated application.
- Hosted Auth/Storage and production-environment verification.
- Link the website deployment to the canonical repository's `site/` root and release it.

No production database migrations or live website deployments were performed during this milestone. Follow `INTEGRATION_PROGRESS.md` for the wider release.
