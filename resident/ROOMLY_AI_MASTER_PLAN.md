# Roomly AI and Product Master Plan

> Execution source of truth: `ASTRA_IMPLEMENTATION_HANDOVER.md`. That handover resolves the product, architecture, onboarding, Roomly Home, testing, security, and delivery decisions required for the end-to-end build.

## Product thesis

Roomly should become the calm, trusted layer between a resident and the shared, co-living, or student home they live in. It should answer everyday questions instantly, turn vague reports into actionable requests, and help property managers publish useful information without making residents learn another complicated property-management system.

The wedge is not “an AI chatbot for housing.” It is a resident pass that already knows the home, shows its sources, and hands uncertain or sensitive issues to a human.

## What the market already proves

Current resident platforms converge on a familiar baseline: move-in tasks, maintenance, messaging, documents, payments, events, and self-service. Residently brings applications, documents, rent, maintenance, renewals, communications, services, and support into one renter app. AppFolio now answers routine resident questions from stored property information, while Buildium uses AI to draft communications and triage maintenance. The lesson is that Roomly should not reproduce an entire property-management suite first. It should make the highest-frequency resident moments dramatically better.

Reference patterns:

- [Residently renter app](https://residently.com/product/renter-app): one resident journey from application through renewal.
- [AppFolio resident experience](https://www.appfolio.com/property-manager/resident-experience): grounded resident answers, move-in tasks, payments, and communications.
- [Buildium resident experience](https://www.buildium.com/features/resident-experience-software/): branded portal, maintenance capture, AI triage, and communication drafting.
- [Monty](https://www.montyliving.com/): source-backed answers and human approval before consequential actions.

## The four AI jobs

### 1. Roomly Answers — build first

Residents ask a natural-language question from the Room Pass: “Where do the bins go?”, “Can I have a guest?”, or “Who do I call about the boiler?” Roomly answers only from approved room content, names the source section, and offers the correct next action. If the answer is missing or uncertain, it says so and creates a clean handoff to the manager.

Why first: it builds on the content Roomly already has, gives residents an immediate benefit, and creates a feedback loop showing managers which information is missing.

Guardrails:

- Retrieve only from the resident’s authorised room and tenancy context.
- Show the source and freshness date with every answer.
- Never invent access, legal, safety, payment, or tenancy information.
- Escalate emergencies and low-confidence answers through deterministic rules.
- Log the question category and outcome, not unnecessary free-text personal data.

### 2. Pass Copilot — prototype now

Managers can paste rough move-in notes, a property handbook, or repeated resident questions. Roomly turns them into structured essentials, FAQs, contacts, and recommendations. It also checks for missing information, rewrites unclear content, and prepares translations. Every change is a previewable suggestion; nothing publishes automatically.

The prototype implements this interaction as a local, deterministic demo so the product behaviour can be evaluated before an AI backend is chosen.

### 3. Maintenance Intake — build second

A resident describes a problem in text, photo, or voice. Roomly asks only the missing questions, identifies location and urgency, suggests safe immediate steps, and creates a structured work order with a resident-facing timeline.

Important boundary: AI may classify and draft. Emergency rules, vendor dispatch, costs, and final commitments remain deterministic or require human approval.

### 4. Resident Pulse — build after enough usage data

Summarise repeated questions, unresolved themes, move-in friction, and stale information for the manager. Recommend the one handbook improvement with the highest expected impact. Do not create a vanity analytics dashboard.

## Feature roadmap

### Phase 0 — polished concept

- Resident-facing “Ask this home” experience with cited answers and human fallback.
- Manager Pass Copilot with draft, clarity, gap-check, and translation actions.
- Content-readiness score based on real missing fields, not a decorative percentage.
- Visible save status, preview state, and safer publish language.
- Accessible dialogs, keyboard escape, reduced-motion support, and mobile editor behaviour.

### Phase 1 — useful MVP

- Authenticated, property-scoped knowledge retrieval.
- Structured Room Pass editor with version history and review-before-publish.
- Source-backed resident answers with feedback and escalation.
- Invite claim, expiry, revocation, permissions, and audit trail.
- Basic maintenance intake with photo, location, urgency, and status.
- Manager inbox containing only questions Roomly could not answer.

Success measures: pass activation, answer resolution without manager contact, unanswered-question rate, time to publish a complete pass, maintenance form completion, and escalation quality.

### Phase 2 — operational leverage

- Learn from approved manager replies and propose new FAQs.
- Multilingual answers and manager-reviewed translations.
- Proactive move-in checklist and context-timed reminders.
- Maintenance deduplication, triage, scheduling preference capture, and vendor-ready summaries.
- Document extraction for leases, welcome packs, and building rules, with field-level review.

### Phase 3 — portfolio intelligence

- Cross-property themes and stale-content detection.
- Resident sentiment trends with minimum-volume privacy thresholds.
- Renewal-risk signals presented as evidence, never opaque scores.
- Integrations with the manager’s existing property system, messaging, calendar, and storage.

## Quality-of-life backlog

High priority:

- Autosave with “saved / saving / offline” state and version history.
- Inline preview that updates from edited fields.
- Undo for delete and AI-applied changes.
- Command/search palette for larger handbooks.
- Missing-content checklist before sharing.
- Bulk translation review with per-field confidence and original text visible.
- Clear “resident view” and “manager view” modes instead of demo-style tabs.
- One primary action per screen; secondary actions live in a quiet overflow menu.

Resident experience:

- Home-screen install prompt only after value is demonstrated.
- Recently used essentials and offline access to non-sensitive information.
- Copy confirmation that names what was copied.
- Large touch targets, visible focus, readable language switcher, and no hover-only controls.
- Maintenance status timeline and a single persistent route to human help.

Manager experience:

- Templates by property type, not a free-form page builder.
- Readiness checks for emergency contacts, access notes, waste, maintenance, and language coverage.
- Preview as a real resident with permission-aware content.
- Scheduled visibility for door and move-in details.
- Content ownership, last-reviewed date, and stale-content reminders.

## UI direction

Visual thesis: a warm editorial handbook inside a calm operational workspace — bone paper, ink text, Roomly violet as the only accent, crisp rules, and soft depth only where something can be acted on.

Content plan: residents see identity, essentials, one intelligent question field, home details, help, and FAQs; managers see status, AI-assisted setup, structured content, and a live resident preview.

Interaction thesis:

- A short staged entrance gives the resident pass a hosted, welcoming feel.
- AI suggestions expand in place and apply with a visible state change, never silently.
- The manager workspace uses sticky context and restrained transitions so long forms remain easy to navigate.

Design rules:

- The resident pass stays mobile-first and emotionally warm.
- The manager surface stays dense, calm, and operational.
- Cards exist only for interactive or independently actionable objects.
- AI is labelled at the action level, not sprayed across the interface as decoration.
- Every AI action explains what will change before applying it.

## Technical shape

Use structured content as the system of record. Store source fragments, visibility, owner, and review date on every item. Index only authorised content for retrieval. Return answers as `{ answer, sourceIds, confidence, action }`; render citations from source IDs rather than model-written labels.

Put hard rules before the model: emergency routing, access permissions, invite validity, payment status, and maintenance priority thresholds. AI can draft, classify, translate, and summarise. Publishing, sensitive disclosure, dispatch, and money movement require deterministic checks and, where appropriate, human approval.

Start with evaluation fixtures before model tuning: 50 real resident questions across answerable, missing, ambiguous, emergency, sensitive, multilingual, and adversarial cases. Measure groundedness, correct refusal, citation accuracy, escalation precision, and latency.

## What not to build yet

- A general-purpose resident chatbot with access to everything.
- Autonomous vendor dispatch, payment changes, or lease decisions.
- A full property-management accounting suite.
- A free-form page designer.
- Sentiment surveillance at individual-resident level.
- AI-written local recommendations without manager verification.
- More dashboards before Roomly has enough real behaviour to justify them.

## Recommended build order

1. Ship the structured Room Pass and content-readiness checks.
2. Add source-backed Roomly Answers with safe fallback.
3. Add Pass Copilot for managers, always review-before-publish.
4. Add maintenance intake and a transparent status timeline.
5. Use unanswered questions to improve handbook content.
6. Integrate into existing property systems only after the workflow proves value.
