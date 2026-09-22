# Roomly Room Pass

## Product take

Darif's guest pass works because it gives a person an immediate, useful reward for opening a single link: the information they need is already organised, personal, and available without hunting through messages. The underlying pattern is worth bringing to Roomly, but the job changes.

Darif answers, "How do I make this stay easy?" Roomly should answer, "How do I help a new person feel oriented, welcome, and clear about how this room works?"

The proposed feature is **Room Pass**: a member-specific onboarding page delivered when someone is invited to a Room. It starts as a lightweight invite and, once claimed, becomes that member's always-available room handbook.

## What to preserve from Darif

| Darif pattern | Why it works | Roomly translation |
| --- | --- | --- |
| One useful link, no scavenger hunt | Lowers the cost of getting started | A one-tap invite that opens the Room Pass before account setup |
| A personalised header | Makes a generic guide feel meant for the person | "Welcome, Maya" with room name, host, and a simple first-week progress state |
| Essentials are pinned first | Solves the urgent questions before the nice-to-haves | Join details, meeting link/location, start date, key contacts, and any access instructions |
| A fixed, thoughtful content order | Creates calm rather than an overflowing knowledge base | Welcome -> essentials -> agreements -> people -> first steps -> resources |
| Structured content rendered in a consistent shell | Lets a host update content without breaking the experience | Room Handbook blocks and reusable templates, not a free-form page builder |
| One host/editor surface and one member surface | Keeps setup simple while preserving a polished member experience | Room lead edits the handbook; members see a mobile-first pass |
| Share action and view state | Makes the handoff operational | Invite delivery, claim status, last viewed, and incomplete onboarding steps |

## What should change for Roomly

This should not be a public, persistent property guide. A Room Pass represents membership and may include private room information.

- Make the first link a **single-use, expiring invitation**. After it is claimed, require the member's Roomly session rather than relying on a bearer URL.
- Keep door codes, live meeting links, or other sensitive access details behind a verified session and, where relevant, a scheduled visibility window.
- Replace accommodation content (Wi-Fi, local tips, emergency numbers) with social and operational onboarding: purpose, agreements, people, rituals, communication norms, and useful links.
- Keep the pass helpful after onboarding, but remove the "new here" checklist once it is complete. It becomes **Room home** rather than a static welcome page.
- Use lightweight acknowledgement for essential agreements. Do not turn every handbook section into a required form.

## Member flow

```text
Room lead creates a Room
  -> chooses a Room Handbook template
  -> adds essentials and invites a member
  -> member opens a short-lived Room Pass link
  -> sees the room, purpose, and their first action
  -> claims invitation / creates or signs into Roomly
  -> completes only essential acknowledgements
  -> lands in the Room with handbook retained under "Room home"
```

### First view priority

1. **Welcome** - room name, host, start date, and one human sentence.
2. **Today** - the next practical action, such as confirm your place or join the first gathering.
3. **Essentials** - when/where/how to join; one-tap copy and open actions.
4. **How we share the room** - 3-5 clear agreements, with acknowledgement only when required.
5. **People** - room lead and existing members, with names/pronouns/roles only where they opt in.
6. **Your first week** - a small progress list: introduce yourself, attend the first session, set preferences.
7. **Resources** - links, documents, and practical help.

## Content model

The host should edit data; Roomly should own layout, accessibility, and hierarchy. That is the most valuable technical lesson from Darif's design.

```ts
type RoomPass = {
  roomId: string
  welcomeNote: string
  startAt?: Date
  essentials: Essential[]
  agreements: Agreement[]
  people: PersonPreview[]
  firstWeekSteps: OnboardingStep[]
  resources: Resource[]
}

type Essential = {
  kind: 'location' | 'meeting_link' | 'contact' | 'access_note'
  label: string
  value: string
  visibility: 'invitee' | 'member' | 'scheduled'
}

type Agreement = {
  title: string
  body: string
  acknowledgementRequired: boolean
  order: number
}

type OnboardingInvite = {
  roomId: string
  inviteeEmail?: string
  tokenHash: string
  expiresAt: Date
  claimedAt?: Date
  revokedAt?: Date
}
```

This deliberately avoids arbitrary HTML. Each block has typed fields and a controlled renderer, so a room lead can add a resource or agreement without accidentally making the onboarding experience hard to read on mobile.

## MVP boundary

Build now:

- Invite creation, delivery, expiry, revoke, and claim.
- A member-specific Room Pass and authenticated Room home.
- Structured handbook editor: welcome, essentials, agreements, people, first-week steps, resources.
- Copy/open actions, acknowledgement state, and simple completion progress.
- Room templates for the most common room types.

Defer:

- A free-form page designer.
- Public permanent links.
- Automatic content suggestions based on private room activity.
- Analytics beyond invite claimed, pass viewed, and required agreement acknowledged.

## Implementation notes

- Generate a cryptographically strong invite token; store only a hash and enforce expiry, revocation, and single claim.
- Do not place private room data in the URL, analytics events, or link-preview metadata.
- Resolve the token server-side, then exchange it for an authenticated Roomly session on claim.
- Render the same structured handbook in both the invite pass and Room home; change only the permission-aware fields and the onboarding state.
- Track completion as individual steps, not one opaque "onboarded" boolean. That makes the next best action clear and allows required acknowledgements to be auditable.

## Design direction

Warm and inhabited, but operational first: parchment-white surfaces, ink-like text, a single moss accent, generous breathing room, and no dashboard-card pile. The first screen should feel like entering a well-hosted room, not filling out an account form.

