# Astra Execution Handover: Build Roomly End to End

## Operating instruction

Execute this specification from top to bottom. Treat every product, architecture, UX, and scope decision below as settled. Do not pause to ask preference questions. Inspect the repository first, preserve useful work, implement the complete release, run the verification suite, fix failures, then commit and push if a configured remote and credentials are available.

Only stop when an action genuinely requires a secret, account permission, payment, or external approval. The application must still run without those dependencies through the specified demo adapters. Never weaken authentication, authorisation, privacy, or tests to get a green build.

## Mission

Turn the current static Roomly concept into a production-shaped, beautiful web application for shared, co-living, and student homes.

Roomly has two users:

1. A property manager or room lead who creates a home, publishes trusted information, invites residents, and handles questions or repairs.
2. A resident who accepts an invitation, completes a short onboarding journey, and then uses **Roomly Home** as the permanent place for home information and support.

AI compresses setup and repetitive support work. It does not make sensitive decisions, publish autonomously, invent answers, or impersonate a human.

## Verified starting point

The repository currently contains:

- `index.html`: a self-contained resident-pass and manager-editor prototype with inline CSS and JavaScript. It is a visual/product reference, not an application architecture.
- `ROOMLY_MEMBER_PASS.md`: an earlier product note with useful invite, membership, and structured-content concepts.
- `ROOMLY_AI_MASTER_PLAN.md`: the current product and AI strategy.

There is no package manifest, framework, backend, database, authentication, persistence, test suite, deployment configuration, or real AI integration. The static prototype contains hard-coded private information and several interactions that report success without persisting data. Do not bolt a model API directly onto it.

Preserve the current prototype at `docs/prototypes/roomly-pass.html` before replacing the root implementation. Use it as a visual reference only.

## Decisions that are locked

### Product position

Roomly begins with UK shared, co-living, and student homes. It combines physical-home essentials with social onboarding. It is not a general property-accounting suite and not a social network.

The initial promise is:

> Everything you need to settle into your home, kept clear and current.

### Product surfaces

- **Manager workspace:** setup, content, invitations, readiness, unanswered questions, and maintenance.
- **Resident onboarding:** secure invite claim, preferences, essential information, agreements, and first-week actions.
- **Roomly Home:** the resident's permanent home dashboard after onboarding.
- **Roomly Assist:** review-before-apply AI tools for managers.
- **Ask Roomly:** source-backed resident questions with honest refusal and human handoff.

### Technical stack

Use:

- Next.js App Router with TypeScript and the current stable release available at implementation time.
- React Server Components by default; client components only for interaction that requires browser state.
- Tailwind CSS plus a small token layer in `app/globals.css`.
- Radix primitives or shadcn/ui only for accessible behavioural primitives such as dialogs, sheets, menus, and toasts. Restyle them to the Roomly system. Do not ship stock shadcn visuals.
- Supabase for PostgreSQL, authentication, row-level security, and private file storage.
- Supabase SQL migrations as the schema source of truth. Generate TypeScript database types.
- Zod for input and environment validation.
- OpenAI behind a provider interface for structured extraction, translation, classification, and grounded answers.
- Vitest and Testing Library for unit/component tests.
- Playwright with axe checks for end-to-end and accessibility tests.
- pnpm for package management.
- Vercel-compatible runtime and deployment configuration.

Do not add Redux, GraphQL, a queue, a separate API server, or a vector database in this release.

### Runtime modes

Support two modes:

1. `DEMO_MODE=true`: seeded identities, deterministic AI fixtures, in-memory or local Supabase-compatible data path, and no external messages. This mode must let any reviewer exercise every acceptance flow after `pnpm install && pnpm dev`.
2. Production mode: Supabase and OpenAI environment variables are required and validated at startup. Sensitive server keys remain server-only.

If local Supabase tooling is available, use it for integration tests. Do not make local review depend on a cloud account.

## Information architecture and routes

Build these routes:

```text
/
/sign-in
/onboarding/manager
/invite/[token]
/onboarding/resident/[membershipId]
/home
/home/guide
/home/ask
/home/repairs
/home/repairs/new
/home/repairs/[requestId]
/manage
/manage/properties/[propertyId]
/manage/properties/[propertyId]/content
/manage/properties/[propertyId]/invites
/manage/properties/[propertyId]/questions
/manage/properties/[propertyId]/maintenance
/manage/properties/[propertyId]/settings
```

Use middleware only for coarse authentication redirects. Enforce ownership and membership again in every server action and data query.

### Navigation

Resident mobile navigation contains four items: Home, Guide, Ask, Repairs. Use a bottom navigation on small screens and a compact side navigation on larger screens.

Manager navigation contains Overview, Content, Invites, Questions, Maintenance, Settings. Manager and resident views are separate role-aware routes, not tabs in one public page.

## User journeys

### Manager onboarding

Trigger this after the first authenticated manager session when no organisation exists.

1. Welcome: explain the outcome in one sentence and show the seven-minute expectation.
2. Organisation: organisation name and manager display name.
3. Property: property name, address, property type, and timezone.
4. Home: room/unit name, resident capacity, manager contact, emergency contact, and preferred languages.
5. Source material: paste notes. File import is an optional enhancement; pasted text is mandatory.
6. Roomly Assist review: extract proposed structured blocks. Show source excerpt, category, visibility, and Accept/Edit/Skip. Nothing applies automatically.
7. Readiness and preview: show missing essentials, resident preview, then publish and create the first invite.

Persist progress after every step. Returning users resume on the first incomplete step. Back navigation preserves data. Completion redirects to the manager overview.

### Resident onboarding

The invite flow works before sign-in but reveals only the property name, inviter identity, and non-sensitive welcome copy until claim.

1. Invitation: property name, inviter, expiry, and “Join this home”.
2. Identity: sign in or create an account; bind the invite to that account once.
3. Preferences: preferred name, language, notification preference, and optional pronouns.
4. Essentials: show address, manager contact, move-in date, and access status. Reveal secrets only when membership and visibility rules permit.
5. Agreements: show required house agreements with individual acknowledgements. Non-required guidance remains readable without acknowledgement.
6. First week: checklist with useful actions such as save address, introduce yourself, locate bins, and understand repair reporting.
7. Complete: concise success moment and a single primary action, “Go to Roomly Home”.

Progress is per membership, not a single user boolean. A resident may belong to more than one home.

### Roomly Home

Roomly Home is permanent. It must remain valuable after onboarding is complete.

Order the default page as follows:

1. Context header: home name, resident name, current status, and last content review date.
2. Today: at most one next action. Hide this section when no action exists.
3. Essentials: Wi-Fi, address, manager contact, access, and emergency support. Permission-filter before rendering.
4. Ask Roomly: a calm question field embedded in the page. No floating chatbot orb.
5. First-week progress: visible only until complete, then collapses into the guide.
6. Recent repair status: only active requests.
7. Home guide shortcuts: agreements, bins, guests, local area, documents, and people.
8. Persistent human-help action.

The full guide uses sections and dividers rather than a grid of generic cards.

## Data model

Create SQL migrations implementing these tables. Every primary key is UUID. Every table has `created_at timestamptz not null default now()`. Mutable records also have `updated_at` maintained by a trigger.

### Identity and tenancy

```text
profiles
  id uuid primary key references auth.users
  display_name text not null
  preferred_name text
  pronouns text
  locale text not null default 'en-GB'
  notification_preference text not null default 'email'

organisations
  id, name, slug unique, created_by references profiles

organisation_members
  organisation_id, profile_id, role enum(owner, manager, staff)
  unique(organisation_id, profile_id)

properties
  id, organisation_id, name, address_line_1, address_line_2,
  city, postcode, country_code default 'GB', timezone default 'Europe/London',
  property_type enum(shared_house, student_house, coliving, other), published_at

rooms
  id, property_id, name, capacity integer, manager_contact_json jsonb,
  emergency_contact_json jsonb, default_locale, supported_locales text[]

memberships
  id, room_id, profile_id, status enum(invited, active, ended),
  move_in_at, move_out_at, onboarding_completed_at
  unique(room_id, profile_id)

invites
  id, room_id, created_by, invitee_email nullable, token_hash unique,
  expires_at, claimed_at nullable, revoked_at nullable
```

### Structured home content

```text
content_blocks
  id, room_id
  kind enum(welcome, essential, agreement, person, first_week, resource,
            faq, local_place, safety, access)
  title, body, data jsonb not null default '{}'
  position integer not null
  visibility enum(invitee, member, scheduled, manager_only)
  visible_from timestamptz nullable
  required_acknowledgement boolean default false
  status enum(draft, published, archived)
  source_type enum(manual, imported, ai_draft, approved_answer)
  source_excerpt text nullable
  owner_id references profiles
  verified_at timestamptz nullable
  published_at timestamptz nullable

content_versions
  id, content_block_id, version integer, snapshot jsonb,
  changed_by, change_reason, unique(content_block_id, version)

translations
  id, content_block_id, locale, title, body, data jsonb,
  status enum(draft, reviewed, published), reviewed_by nullable
  unique(content_block_id, locale)

acknowledgements
  id, membership_id, content_block_id, content_version,
  acknowledged_at, unique(membership_id, content_block_id, content_version)

onboarding_tasks
  id, room_id, title, description, position, required boolean,
  completion_kind enum(manual, acknowledgement, visit, manager_confirmed)

onboarding_task_completions
  id, membership_id, onboarding_task_id, completed_at,
  unique(membership_id, onboarding_task_id)
```

### Questions, AI, and maintenance

```text
question_logs
  id, membership_id, room_id, question_redacted, category,
  outcome enum(answered, unknown, escalated, blocked),
  cited_block_ids uuid[], feedback enum(helpful, not_helpful) nullable

ai_runs
  id, organisation_id, room_id, actor_id,
  purpose enum(content_extract, rewrite, translate, answer, maintenance_triage),
  provider, model, input_hash, status, latency_ms,
  result_metadata jsonb, error_code nullable

ai_suggestions
  id, ai_run_id, room_id, kind, proposed_data jsonb,
  source_excerpt, status enum(pending, accepted, edited, rejected),
  reviewed_by nullable, reviewed_at nullable

maintenance_requests
  id, room_id, membership_id, title, description, location,
  category enum(plumbing, electrical, heating, appliance, access, safety, other),
  priority enum(low, normal, high, emergency),
  status enum(draft, submitted, acknowledged, scheduled, in_progress, resolved, closed),
  availability_json jsonb, assigned_to text nullable

maintenance_attachments
  id, maintenance_request_id, storage_path, mime_type, size_bytes

maintenance_events
  id, maintenance_request_id, actor_id nullable, event_type, note,
  resident_visible boolean default true
```

Add indexes for every foreign key, active memberships by profile, published blocks by room and position, invite token hash, open maintenance by room and status, and unanswered questions by room.

### Row-level security

Enable RLS on every public table.

- Organisation staff may read and modify records for their own organisation according to role.
- Residents may read only their active memberships, their room, and blocks currently visible to members.
- Invite resolution occurs through a security-definer server function that returns only safe preview fields.
- Residents may create questions, acknowledgements, task completions, and maintenance requests for their own active membership.
- Residents may read only their own maintenance requests and resident-visible events.
- Service-role access exists only in server-only modules.
- Add SQL policy tests for cross-organisation and cross-room denial.

## Server contracts

Implement server actions or route handlers with Zod schemas. Return discriminated results in the form `{ ok: true, data } | { ok: false, error: { code, message, fieldErrors? } }`.

Required operations:

```text
createOrganisation(input)
createProperty(input)
createRoom(input)
saveManagerOnboardingStep(input)
createInvite(roomId, email?, expiresInDays=7)
revokeInvite(inviteId)
resolveInvite(rawToken)
claimInvite(rawToken)
saveResidentPreferences(input)
acknowledgeBlock(membershipId, blockId, version)
completeOnboardingTask(membershipId, taskId)
createContentBlock(input)
updateContentBlock(input, expectedVersion)
reorderContentBlocks(roomId, orderedIds)
publishContentChanges(roomId)
runContentExtraction(roomId, notes)
reviewAiSuggestion(suggestionId, decision, editedData?)
askRoomly(roomId, question)
submitQuestionFeedback(questionLogId, feedback)
createMaintenanceDraft(input)
submitMaintenanceRequest(requestId)
appendMaintenanceEvent(input)
```

Use optimistic concurrency for content editing. A version mismatch returns `CONTENT_VERSION_CONFLICT` and preserves both versions for review.

## AI design

Create `lib/ai/provider.ts` with an interface and two implementations:

- `OpenAIProvider`: production implementation.
- `DemoAIProvider`: deterministic fixtures selected by input intent. It must exercise success, unknown, emergency, and error UI states.

### Content extraction

Input: room metadata, supported locales, and manager notes.

Output must validate against a strict JSON schema:

```ts
type ExtractedSuggestion = {
  kind: ContentBlockKind;
  title: string;
  body: string;
  data: Record<string, string | number | boolean | null>;
  visibility: 'invitee' | 'member' | 'scheduled' | 'manager_only';
  sourceExcerpt: string;
  warnings: string[];
};
```

The model may propose only allowlisted block kinds and data keys. Treat uploaded or pasted content as untrusted data, not instructions. Store suggestions separately until a manager accepts them.

### Grounded answers

For this release, retrieve from the small set of authorised, published content blocks using PostgreSQL full-text ranking plus title/category boosts. Do not introduce embeddings yet.

Filter by identity, membership, visibility, schedule, and locale before retrieval. Send at most eight blocks to the model. Require this response:

```ts
type GroundedAnswer = {
  status: 'answered' | 'unknown' | 'escalate' | 'emergency';
  answer: string;
  sourceIds: string[];
  suggestedAction: 'none' | 'open_block' | 'contact_manager' | 'report_repair' | 'call_emergency';
  category: string;
};
```

Reject model-provided source IDs not present in the retrieved set. Render source labels from database records, never from model text. If the model returns no valid citation, render the result as `unknown`. Show “Last checked” from the oldest cited block verification date.

Emergency keywords route through deterministic UK emergency guidance before any model call. Access codes, payment instructions, legal interpretation, and tenancy decisions require exact approved sources or a refusal.

### Translation

Draft translation per block. Preserve proper nouns, phone numbers, addresses, URLs, and a room glossary. Store as `draft`; a manager must review before publication. Locked safety facts must match the source values after translation.

### Maintenance triage

AI may suggest category, location, priority, and missing questions. Deterministic rules force `emergency` for fire, active gas smell, immediate danger, major uncontrolled flooding, or loss of secure access. The resident must confirm submission. Do not dispatch vendors or promise times automatically.

### Privacy and audit

- Never send access codes, authentication tokens, raw invite tokens, payment details, or unrelated profile data to the model.
- Redact email, phone, and exact address from analytics copies.
- Set provider data-retention controls when supported.
- Log purpose, model, latency, status, input hash, and cited IDs; do not log raw sensitive prompts by default.
- Make every manager AI mutation reviewable and attributable.

## Readiness model

Room readiness is rule-based, not generated.

Ten checks, each worth ten percentage points:

1. Address published.
2. Manager contact published.
3. Emergency contact published.
4. Wi-Fi or explicit “not provided” state published.
5. Access guidance present with correct visibility.
6. Bin/recycling guidance published.
7. Repair reporting guidance published.
8. At least one required agreement or explicit “none” state.
9. Supported languages reviewed.
10. Every published block verified within the last 180 days.

Show the missing checks by name. A readiness score never blocks saving a draft. Publishing requires checks 1, 2, 3, 5, and 7.

## UI and design system

### Visual thesis

A warm editorial handbook inside a calm operational workspace. The resident experience feels hosted and human; the manager experience feels precise and dependable.

### Tokens

```css
--roomly-bone: #F6F4EF;
--roomly-paper: #FFFFFF;
--roomly-ink: #14120F;
--roomly-muted: #686560;
--roomly-line: #D9D5CE;
--roomly-violet: #5638D8;
--roomly-violet-deep: #34207F;
--roomly-violet-soft: #F0ECFF;
--roomly-success: #1F6B45;
--roomly-success-soft: #E8F4EC;
--roomly-danger: #B9322A;
--roomly-danger-soft: #FBE9E6;
```

Use one humanist sans family loaded through `next/font`. Use at most one complementary display face. Define three radii: 8px controls, 14px functional panels, 24px major sheets or resident highlights. Use shadows only on floating layers and the resident question interaction.

### Composition rules

- Avoid a dashboard-card mosaic. Use page regions, lists, dividers, and one dominant working surface.
- Keep Roomly violet as the only product accent. Red is reserved for danger.
- Resident body copy is at least 16px. Every touch target is at least 44 by 44 CSS pixels.
- Use one consistent line-icon set. No emoji category artwork.
- Resident pages are mobile-first. Manager pages support desktop density and remain fully usable on mobile.
- The resident page does not display manager editing controls or a role-switching demo tab.
- Labels explain state and action. Avoid generic marketing copy inside the application.

### Motion

Use three restrained motion patterns:

1. A short staggered entrance for the resident context header, essentials, and next action.
2. Shared expand/collapse motion for AI suggestions and guide sections.
3. A sheet transition for mobile preview and maintenance details.

Respect `prefers-reduced-motion`; the experience remains complete without animation.

### Required states

Every asynchronous surface implements loading, empty, success, error, offline/retry, and permission-denied states. AI surfaces also implement extracting, suggestions-ready, partially-applied, unknown, low-confidence refusal, emergency, and provider-unavailable states.

## Core components

Create product-specific components rather than page-local duplicates:

```text
components/roomly/RoomlyLogo
components/roomly/AppShell
components/roomly/ResidentNav
components/roomly/ManagerNav
components/roomly/SaveStatus
components/roomly/ReadinessChecklist
components/roomly/RoomlyAssistComposer
components/roomly/AiSuggestionReview
components/roomly/AskRoomly
components/roomly/GroundedAnswer
components/roomly/SourceChip
components/roomly/EssentialList
components/roomly/AgreementList
components/roomly/OnboardingProgress
components/roomly/PermissionBadge
components/roomly/ResidentPreviewSheet
components/roomly/MaintenanceTimeline
components/roomly/EmptyState
```

## Persistence and editing behaviour

- Autosave manager drafts after 600 ms of inactivity and expose Saving, Saved, Offline, and Failed states.
- Publish is separate from saving. Residents see the last published version until a manager completes “Review and publish”.
- Deleting a content block uses soft archive and provides a ten-second Undo toast.
- Reordering supports pointer and keyboard controls with accessible announcements.
- The resident preview renders from the same content query and permission function used by the actual resident route.
- Mobile manager preview opens as a full-screen sheet; it never disappears without an alternative.
- Store onboarding progress and draft content in the database, not only client state.

## Seeded demo

Seed one organisation, one property, one room, one manager, and one resident:

- Organisation: Roomly Homes
- Property: Cambridge City House
- Room: Room 3
- Manager: Elena
- Resident: Maya
- Locales: English, Simplified Chinese, Turkish

Include published blocks for Wi-Fi, address, contact, access timing, repairs, emergency support, house rules, bins, guests, three local places, and three FAQs. Include one active repair request and three pending AI suggestions.

Provide a visible demo identity chooser only in `DEMO_MODE`. It must never render in production mode.

## Accessibility and language

- Target WCAG 2.2 AA.
- Use semantic headings, landmarks, forms, lists, buttons, and links.
- Dialogs and sheets trap focus, close on Escape, restore focus, and expose names/descriptions.
- Tabs use correct roving focus and arrow-key behaviour.
- Visible focus states exist for every interactive element.
- Do not rely on colour alone for status.
- Preserve logical DOM, visual, and keyboard order.
- Locale controls expose selected state and remain readable at 320px.
- Test 200% zoom, keyboard-only use, reduced motion, long names, translated expansion, and screen-reader labels.

Implement English completely. Seed reviewed Chinese and Turkish translations for the demo content. UI chrome may fall back to English where a translation key is absent, but content translation status must remain honest.

## Repository shape

Use this target structure:

```text
app/
  (auth)/sign-in/
  (resident)/home/
  (manager)/manage/
  invite/[token]/
  onboarding/
  api/
components/roomly/
lib/
  ai/
  auth/
  content/
  demo/
  maintenance/
  permissions/
  readiness/
  supabase/
supabase/
  migrations/
  seed.sql
tests/
  unit/
  integration/
  e2e/
docs/
  architecture.md
  ai-safety.md
  prototypes/roomly-pass.html
```

Add `README.md`, `.env.example`, and scripts for `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `db:start`, `db:reset`, and `db:types` where supported.

## Execution sequence

Complete each stage and keep the app runnable before starting the next.

1. Preserve the prototype and scaffold the Next.js TypeScript application.
2. Establish tokens, fonts, application shells, role-aware routing, and the seeded demo adapter.
3. Add Supabase schema, migrations, seed data, generated types, auth helpers, and RLS tests.
4. Build manager onboarding with resumable persistence.
5. Build invite creation, safe resolution, single claim, expiry, revocation, and resident onboarding.
6. Build Roomly Home and the full guide from permission-filtered structured content.
7. Build manager content editing, autosave, versioning, readiness, preview, publish, archive, undo, and reorder.
8. Build the AI provider interface, deterministic demo provider, structured extraction, suggestion review, and translation drafts.
9. Build Ask Roomly with authorised retrieval, citations, refusal, emergency rules, feedback, and manager question inbox.
10. Build maintenance intake, attachments, triage suggestions, submission, manager updates, and resident timeline.
11. Add state coverage, responsive behaviour, accessibility fixes, and restrained motion.
12. Add unit, integration, E2E, accessibility, and AI evaluation tests.
13. Write operational documentation, run the full verification suite, fix every failure, review the final diff, commit, and push when authorised.

## Testing requirements

Minimum coverage by layer:

| Layer | Required coverage |
| --- | --- |
| Unit | Readiness rules, visibility rules, invite validity, emergency routing, AI schema validation, source validation, content version conflicts |
| Integration | Manager setup persistence, invite claim, cross-room denial, publish/draft isolation, acknowledgement versioning, maintenance state transitions |
| Component | Onboarding steps, suggestion review, grounded answer states, readiness checklist, mobile preview sheet, undo toast |
| E2E | Full manager onboarding, full resident onboarding to Roomly Home, manager content publish visible to resident, grounded answer and unknown fallback, repair submission and status update |
| Accessibility | axe scan of every primary route plus keyboard flows for onboarding, dialog, navigation, AI review, and maintenance submission |
| AI evaluation | At least 50 fixtures covering answerable, missing, ambiguous, emergency, access-sensitive, multilingual, and prompt-injection inputs |

The deterministic demo provider is the default in tests. Production-provider contract tests run only when explicitly enabled with credentials.

## Acceptance criteria

1. `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` complete successfully.
2. `DEMO_MODE=true pnpm dev` starts a complete reviewable product without cloud credentials.
3. A new manager can finish all seven onboarding steps, leave midway, return, and resume without lost data.
4. Pasted notes produce structured suggestions; accepting, editing, and rejecting suggestions produce distinct persisted outcomes.
5. No AI suggestion changes published resident content without explicit manager acceptance and publish.
6. A manager can create an invite, see its expiry, revoke it, and create a replacement.
7. An expired, revoked, or claimed token cannot be reused and exposes no private room data.
8. A resident can claim an active invite exactly once and complete onboarding in the seeded three languages.
9. Required agreements are individually versioned and acknowledged before onboarding completion.
10. Completing resident onboarding lands on `/home`, and Roomly Home remains available afterward.
11. Roomly Home shows Today only when an incomplete action exists.
12. Essentials and access information obey membership, visibility, and schedule rules.
13. Ask Roomly cites one or more authorised blocks for every answered response.
14. Any answer with an invalid or missing citation is rendered as unknown with a manager handoff.
15. Emergency input displays deterministic UK emergency guidance without waiting for an AI response.
16. Cross-organisation and cross-room access attempts fail in server actions and database policies.
17. Managers can see unanswered questions and turn one into a draft FAQ without automatic publication.
18. Residents can create a repair request with description, location, availability, and optional attachment.
19. Emergency maintenance language triggers explicit emergency guidance and still requires resident confirmation before submission.
20. Residents see only their own repair timeline; managers see requests only for their organisation.
21. Manager draft saves do not change resident-visible content until publish.
22. Delete is recoverable through Undo and remains available in version history.
23. Desktop and mobile previews use the same permission-filtered rendering path as the resident product.
24. Every primary action is keyboard accessible and every touch target is at least 44 by 44 pixels.
25. Primary routes pass automated axe checks with no serious or critical violations.
26. The UI remains usable at 320px width, 200% zoom, and with reduced motion.
27. No secret, raw invite token, access code, or unrelated resident data appears in AI logs or analytics.
28. The repository includes setup, architecture, data-security, AI-safety, testing, and deployment documentation.
29. The old static prototype remains available only under `docs/prototypes/` and is not part of the production route tree.
30. The final handoff lists implemented scope, deferred external configuration, test results, and the commit pushed.

## Explicitly out of scope

- Rent collection, accounting, arrears, deposits, or money movement.
- Lease generation, screening, legal advice, or tenancy decisions.
- Automated vendor dispatch or repair-cost approval.
- Autonomous sending of WhatsApp, SMS, or email messages.
- Individual resident sentiment, risk, behaviour, or churn scoring.
- Roommate matching, private-chat analysis, or automated mediation.
- A free-form page builder.
- Public permanent links containing private home information.
- AI-generated local recommendations without manager verification.
- Portfolio analytics beyond counts needed for the manager overview.
- Native mobile applications. The responsive web app is the release.

## Working rules

- Preserve user-authored files and unrelated changes.
- Use small, coherent commits after verified milestones. Do not commit broken states.
- Never print secrets or commit `.env` files.
- Keep a running implementation checklist in the task response or a local progress file.
- Prefer completing the defined flow over adding adjacent features.
- When an external provider is unavailable, finish and verify the demo adapter, document the missing environment variable, and continue.
- If no Git remote exists, create the commits and report that push was skipped. Do not invent a remote.
- If pushing requires user authentication, finish everything else before surfacing that single blocker.

## Final delivery format

When complete, report:

1. Product flows shipped.
2. Architecture and important safety decisions.
3. Test commands and exact results.
4. Demo credentials or identity-selection instructions.
5. External environment variables still required for production mode.
6. Commit hash and push status.
7. Any acceptance criterion not met, with the exact reason. Do not describe the release as complete while any criterion is silently outstanding.

