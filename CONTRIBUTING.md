# Contributing

Use a `codex/` or descriptive feature branch from the canonical Roomly repository. Read `AGENTS.md`, the integration plan and the feature ledger before changing product behaviour.

1. Keep changes focused and retain existing routes, translations, themes and operational flows.
2. Add new database changes as ordered migrations. Do not rewrite applied migration history.
3. Exercise permissions with multiple organisations and roles. A hidden button is not authorisation.
4. Run lint, typecheck, operational tests, database checks and the relevant build. Website changes also require responsive, keyboard, link and accessibility checks.
5. Describe the user-visible effect, tests, migration impact and any remaining verification in the pull request.

Use fictional fixtures. Never commit `.env` files, account passwords, auth tokens, private calendar URLs or tenant documents. Follow `SECURITY.md` for sensitive reports.

Do not add invented customers, testimonials, certifications or performance figures. Public product copy stays focused on Roomly; project/demo status belongs in README and engineering documentation.
