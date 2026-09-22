# Architecture

Roomly uses Next.js 16.3.5 App Router, React, TypeScript, Tailwind 4 and DM Sans through `next/font`. Pages load session-scoped data on the server. Interactive product components receive a filtered view rather than the whole database. The resident and manager route trees are separate.

## Domain and persistence

`lib/contracts.ts` contains the Zod server contracts. `/api/command` validates the operation and payload, resolves the authenticated actor and runs `lib/domain.ts`. Results use `{ ok: true, data } | { ok: false, error }`. `/api/state` applies the same role and membership view filtering as server-rendered pages.

The demo adapter uses a SQLite transaction to persist the complete relational-shaped state. A per-process queue serializes asynchronous domain transactions; SQLite `BEGIN IMMEDIATE` protects concurrent connections. Opaque session tokens are stored only as hashes. Attachments are BLOBs outside the state document, accessed through permission-checked routes.

Production loads only rows allowed by Supabase RLS. The domain computes a write set, and `apply_roomly_changes` applies it in one PostgreSQL transaction as the caller. It is security-invoker, table-allowlisted and preserves row policies. Content versions are checked again under a row lock. Invites use dedicated security-definer functions that expose only safe preview fields and lock the token and room before claiming.

Supabase migrations are authoritative. Every table has UUID identity and timestamps. Constrained status/role/category columns use PostgreSQL check constraints. Foreign keys are indexed. `lib/supabase/database.types.ts` is generated from the applied migration schema using PostgreSQL catalog introspection; `pnpm db:types` can replace it with standard Supabase CLI output.

## Publication

Each block has a mutable working version and a `published_snapshot`. Resident queries materialize only the snapshot, then apply visibility, schedule and reviewed-translation rules. Draft edits and archive operations do not affect residents. A publish action checks deterministic readiness and replaces eligible snapshots. History is append-only. Archive can be undone immediately through a ten-second toast or later from archived content.

Acknowledgements reference the published content version. A changed agreement requires a new acknowledgement before completion. Onboarding state belongs to each membership. Manager progress is saved after every step and during editing.

## Retrieval and providers

Production retrieves at most eight authorised sources using PostgreSQL full-text ranking and title weights, selecting the reviewed locale first. Demo retrieval uses a deterministic local ranker. Sensitive content is removed before any provider call; emergency routing happens deterministically. AI suggestions and translation drafts have their own review states and do not publish themselves.

There is no queue, vector database, Redux, GraphQL, separate API service, or external message sending.

## User interface

The token layer lives in `app/globals.css`. Resident Home places context, one next action, essentials and Ask before first-week and repair details on mobile. Desktop moves secondary details into a narrow supporting column. Guide content uses native disclosures and dividers. Radix provides focus-managed preview sheets. All other controls use native semantic elements. Reduced-motion preferences remove transitions.
