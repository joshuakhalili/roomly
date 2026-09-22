# Roomly: implemented features and remaining work

## Status

The original 13-stage application checklist is implemented in the local demo. The 30 acceptance criteria and their verification evidence are listed in `ACCEPTANCE.md`. This is a working, persistent application; it has not been deployed with real customer accounts.

The follow-up UI pass applies the manager onboarding design language to everyday resident and manager screens. Verification results for that pass are recorded in `IMPLEMENTATION_PROGRESS.md`.

## Features implemented

### Entry and accounts

- Public Roomly introduction and separate resident/manager entry paths.
- Sign-in and account creation through the production Supabase adapter.
- Server-side identity checks and protected resident/manager routes.
- Local demo identity chooser: Maya, Elena, New resident, New manager.
- Persistent demo accounts, sessions and saved work, without cloud credentials.
- Safe expired, revoked and already-claimed invitation screens.

### Manager setup

- Seven steps: welcome, organisation, property, room/home, source notes, AI review, readiness/preview/publish.
- Organisation name and manager name.
- Property name, address, property type and timezone.
- Room name, capacity, operational contacts and supported languages.
- Progress saved after each step and during editing; return/resume and Back preserve entries.
- Pasted notes converted into structured suggestions.
- Accept original, apply edited version, or skip each suggestion.
- Readiness checks, resident preview, first publication and first invitation.

### Manager workspace

- Property overview, property navigation, published content count, question count and open repair count.
- Named next actions and a ten-item readiness checklist.
- Content editor with structured block types, draft autosave and visible save states.
- Explicit review and publish, separate from saving.
- Version history and editing conflict handling.
- Reordering with accessible controls.
- Soft archive, ten-second Undo and later recovery.
- Permission-filtered resident preview in a focus-managed sheet.
- Roomly Assist notes extraction and reviewable suggestions.
- Translation drafts, manager review, locked fact checks and separate published translations.
- Private invitations with optional email restriction and configurable expiry.
- Copy invitation link, safe preview, revoke and replacement; invitation history.
- Unanswered question inbox and checked-answer-to-FAQ-draft action.
- Maintenance report review, valid status transitions, resident-visible updates and internal notes.
- Grouped home, contact and language-review settings.

### Resident joining and onboarding

- Safe invitation preview before sign-in, with no private room content.
- Exactly-once invitation claim, account binding, expiry and capacity checks.
- Preferences: name, language, optional pronouns and notification preference.
- Membership-specific onboarding progress and multiple-home membership support.
- Essentials, move-in information, contacts and permitted access guidance.
- Individual required agreement acknowledgements tied to published versions.
- First-week checklist with persistent completion.
- Completion and permanent Roomly Home destination.
- Reviewed seeded content in English, Simplified Chinese and Turkish. UI labels may fall back to English.

### Everyday resident experience

- Home context, resident status and content review date.
- One next action in Today, hidden when nothing remains.
- Permission-filtered address, Wi-Fi, contacts, access and emergency information.
- Embedded Ask Roomly.
- First-week progress, active repair updates and guide shortcuts.
- Guide search and topic filters with a clear no-results state.
- Expandable guide sections and automatic disclosure of cited sections.
- Permanent human-help contact action.
- Desktop side navigation and mobile Home/Guide/Ask/Repairs navigation.

### Ask Roomly and safeguards

- Dedicated question page plus embedded Home composer.
- Authorized, published, locale-filtered retrieval with at most eight sources.
- Source-linked answers with verification dates.
- Unknown response and manager handoff for unsupported or invalidly cited answers.
- Deterministic UK emergency response before any AI request.
- Sensitive access, payment, legal and tenancy questions limited to exact approved sources or refusal.
- Helpful/not-helpful feedback.
- Retryable provider-unavailable state.
- Redacted question records and metadata-only AI audit records.
- Deterministic demo provider and production OpenAI adapter; AI cannot publish or send external messages.

### Repairs

- Report title, description, location, availability and optional private attachment.
- JPG/PNG/PDF uploads with file checks and a 5 MB limit.
- Emergency detection and immediate guidance.
- Draft review and explicit submission confirmation.
- Attachment success and retry feedback.
- All/open/resolved filters.
- Clear report stages, status and dated timeline.
- Residents see their own reports; managers see their organisation's reports.

### Desktop experience

- Dedicated laptop and wide-monitor layouts across all resident and manager screens.
- Reachable navigation in short windows, readable content widths and aligned page regions.
- Guide-first content editing, expandable AI review that retains unfinished notes, and responsive readiness placement.
- Clickable overview counts, paired contact fields and persistent onboarding progress on taller screens.
- Regression coverage for expanded forms, keyboard preview, long names and 200% desktop zoom reflow.

### Quality and infrastructure

- Next.js App Router, TypeScript, React, Tailwind/token styling and accessible Radix dialog behaviour.
- Supabase migrations, generated database types, RLS and private storage policies.
- Domain validation, content concurrency checks and atomic database changes.
- Hashed invitation/session tokens and server-side ownership/membership enforcement.
- Offline, loading, empty, success, error and permission states.
- Keyboard support, focus states, touch targets, responsive layouts and reduced motion.
- Unit, component, PostgreSQL, browser, axe and AI evaluation coverage.
- Setup, architecture, security, AI safety, testing and deployment documentation.
- Original static prototype preserved under `docs/prototypes/`.

## Still required before production use

CLI logins are available. The discovered Roomly cloud resources belong to another rent/tenancy application; they are not a compatible deployment target for this checkout. See `PRODUCTION_RESOURCE_AUDIT.md`.

1. Configure a Supabase project, apply migrations and configure the canonical auth callback URL.
2. Provide production Supabase URL/public key, OpenAI key and application site URL; disable demo mode.
3. Configure and verify real authentication email delivery and account confirmation.
4. Test hosted Auth, private Storage uploads/downloads and OpenAI against real accounts. These integrations exist but were not live-tested without credentials.
5. Run the Supabase CLI/pgTAP suite when Docker is available. Application SQL and RLS have already been exercised with embedded PostgreSQL.
6. Configure a Git remote and push the commits.
7. Configure a deployment destination, HTTPS/domain, log redaction, backups and retention; perform the production smoke test before customer data is added.

For newly authored blocks, demo translations are reviewable drafts and can retain source-language wording. Real automatic translation requires the live provider or manual manager translation. The three seeded languages already contain reviewed demo content.

## Outside this release

Rent collection/accounting/deposits; leases/screening/legal decisions; vendor dispatch or cost approval; automatic WhatsApp/SMS/email campaigns; resident scoring; roommate matching; a free-form page builder; public private-home links; unverified AI local recommendations; advanced portfolio analytics; native mobile apps.

These are excluded by the handover, rather than unfinished items from the implementation checklist.

Follow-through fixes: auth preserves invitation and manager destinations through signup, errors and confirmation; resident links preserve selected-home context; setup regenerates only untouched draft essentials; revoked invitation links stop appearing as shareable; failed type generation preserves the checked-in file.
