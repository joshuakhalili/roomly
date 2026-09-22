# Roomly release progress

Canonical source: joshuakhalili/roomly. Original management history and original Framer website are preserved. Latest direction: retain the Framer runtime, replace the ivory palette, reorganise operational views and keep resident access separate from management workspaces.

- [x] Preserve canonical history and original website source
- [x] Shared violet/plum palette across management, resident and website
- [x] Searchable property directory with clear room and rent columns
- [x] Property Rooms / Utilities / Documents navigation
- [x] Room Tenancy / Documents / Inventory navigation
- [x] Inventory property selector, room search and review-status filter
- [x] Guided report area and item navigation; retained ratings, notes, photos, defects and exports
- [x] Four mobile destinations plus full accessible navigation menu
- [x] Preserve all operational features and database schema
- [x] Restore Framer template, runtime, 13 routes, FAQ and pricing interactions
- [x] Real shared-home photography and factual product copy
- [x] Preserve resident/onboarding implementation as independent `resident/` application
- [x] Keep resident identities and schemas separate from staff workspaces
- [x] Final regression, diff review and release verification
- [x] Commit, push and deploy management and website
- [ ] Merge PR #1 into main — explicit approval requested after automatic review blocked the merge

## Separate resident production release

The resident application works locally with its deterministic adapters. A public release needs its own Supabase project, provider configuration, Auth callback URLs, private storage and provider acceptance checks. Its schema must never be applied to the management database. There is no automatic data synchronisation between the two applications. These are explicit production requirements, not hidden completed items.

## Design decisions

Properties answer “which building?”; room records answer “who lives here?”; inventory answers “what do I need to inspect?”. Dashboard metrics remain on the dashboard. The shared palette uses plum navigation, violet actions and lilac surfaces. Status colours still indicate work needing attention.

The website keeps its original Framer composition and motion. Owned content and styling are applied through a repeatable build. The earlier Astro approach is archived for reference. No fabricated customer figures, certification badges or testimonials are introduced.
