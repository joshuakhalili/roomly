# Architecture

The existing Next.js application remains the source of truth. The website is an independent Astro static build in the same repository. Resident/onboarding integration is pending and must use additive schema changes.

## Request boundary

`src/proxy.ts` performs session validation and locale routing. It is a coarse route gate, not the only permission check. Server actions validate inputs and call membership/role helpers. Supabase queries run with the authenticated user's session and PostgreSQL RLS. Administration and scheduled jobs use the separate server-only privileged client where required.

## Domain

Properties contain rooms or units. Tenancies connect one room to one or more tenant records. Tenant identity records are distinct from authenticated staff profiles. Organisation identifiers scope records, foreign-key consistency and storage paths. Owner/admin/staff can write according to action-level permissions; viewer is read-only within its organisation.

Inventory baselines and tenancy checklists store structured sections and items. Condition reports export to PDF before configured photo retention can purge originals. Expenses are reported by a security-invoker ledger view, combining existing cost sources rather than duplicating them.

## Background work

Daily jobs handle scheduling and optional email summaries. Retention jobs apply configured lifecycle rules, legal holds and export controls. Calendar URLs are bearer secrets, separate from browser sign-in. Keep them out of screenshots and logs.

## Website

`site/src/pages` generates static pages. Shared layout and CSS implement navigation, metadata and responsive composition. Articles are structured JSON migrated from the previous site's author-owned content. No mirrored Framer runtime or destructive Git reset script is required. Photography is served locally; contact links open the visitor's email client.

## Integration boundaries

New resident accounts must not receive the existing staff `viewer` role: viewers can read their organisation. Resident membership needs a separate room-scoped boundary. New resident repair intake will link to existing maintenance jobs; existing jobs continue to own costs. Shared UI work must preserve the current locales, themes, paths, exports, scheduled jobs and retention controls.
