# Feature-preservation ledger

Baseline: canonical commit `0e383c9`. All paths below are under `/{locale}` unless they begin `/api`. The new website/documentation work does not remove or replace these routes, actions or database tables. “Source mapped” is not a completed browser test.

| Feature                          | Route / entry point                       | Data / action area                          | Regression status                                                  |
| -------------------------------- | ----------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------ |
| Overview / alerts                | `/`                                       | dashboard queries, daily jobs               | Source mapped; browser pending                                     |
| Analytics                        | `/analytics`                              | rent, occupancy and expense queries         | Source mapped; browser pending                                     |
| Property CRUD and photos         | `/properties`, `/properties/[id]`         | properties, private photo storage           | Source mapped; browser pending                                     |
| Room CRUD / baselines            | `/properties/[id]/rooms/[id]`             | rooms, baseline checklists, migration 0026  | Source mapped; embedded migrations pass                            |
| Tenant CRUD and relationships    | `/tenants`, `/tenants/[id]`               | tenants, tenancy_tenants                    | Source mapped; browser pending                                     |
| Tenancy creation and lifecycle   | room `/tenancies/new`, `/tenancies/[id]`  | tenancies, occupants, legal holds           | Source mapped; browser pending                                     |
| Rent schedules and payments      | `/rent`                                   | rent scheduling, rent_payments              | Scheduling tests pass; browser pending                             |
| Messaging                        | rent reminder dialog                      | templates, WhatsApp link, WeChat copy       | Source mapped; browser pending                                     |
| Inventory editor                 | `/inventory`, `/inventory/[id]`           | checklists, sections, items, photos         | Source mapped; browser pending                                     |
| Condition comparison             | `/inventory/compare/[id]`                 | paired tenancy checklists                   | Source mapped; browser pending                                     |
| PDF export / retention handoff   | inventory export                          | PDF renderer, exports, photo purge          | Source mapped; export regression pending                           |
| Documents / expiry               | `/documents`, property and tenancy panels | library, private Storage, document types    | Source mapped; hosted Storage test pending                         |
| Maintenance / recurrence         | `/maintenance`                            | jobs, recurrences, contacts, assets         | Recurrence tests pass; browser pending                             |
| Expense ledger / utilities       | `/expenses`, property utility panels      | expenses, assets, jobs, utility_bills       | Tax-year tests pass; totals regression pending                     |
| Calendar subscriptions           | settings and `/api/calendar/[token]`      | private token, iCal generator               | Source mapped; feed regression pending                             |
| Staff / roles / organisation     | `/settings/admins`                        | profiles, organisations, action helpers     | Path validation tests pass; cross-role tests pending               |
| User preferences / themes        | `/settings`, navigation                   | profile, next-themes, next-intl             | Source mapped; theme and 3-language browser tests pending          |
| Retention / legal hold           | `/settings/retention`                     | retention rules, preview, erasure           | Retention logic tests pass; destructive rehearsal pending          |
| Daily and retention jobs         | `/api/cron/daily`, `/api/cron/retention`  | authenticated privileged jobs               | Source mapped; isolated execution pending                          |
| Auth / login throttle            | `/login`, auth callback                   | Supabase Auth, throttle RPC, Turnstile      | Source mapped; hosted Auth tests pending                           |
| Organisation / storage isolation | all actions and queries                   | migrations 0023–0026, RLS, storage policies | Historical migrations pass; populated multi-org regression pending |
| Installable phone app            | manifest, install prompt                  | app metadata / icons                        | Source mapped; device verification pending                         |

## New experience still to integrate

Manager setup, resident accounts and room-scoped membership, invite claim, resident onboarding, Home/Guide/Ask/Repairs, draft/publish/versioned content and the operational repair bridge are not yet present in this branch. The separate resident implementation is a source of proven patterns; its tests do not establish these flows in the canonical application.
