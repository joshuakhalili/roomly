# Roomly

A bilingual property management web app for small UK letting operations — built to
replace the spreadsheets-and-memory approach to tracking tenants, rent, compliance
documents, and property condition reports.

Runs as a normal website and installs to an iPhone home screen as a PWA.

> **Note on data**: this is a portfolio project. Everything in the repository and in
> any deployed demo is fictional. It holds no real tenant data.

---

## The problem it solves

A landlord running ~30 rooms across a couple of buildings has to keep track of, per
room: who lives there, what they pay and when, whether they've actually paid, which
legal documents are on file, and what condition the room was in when they arrived
versus when they left. Getting the last one wrong is what deposit disputes are made of.

Off-the-shelf inventory software does the condition reports well but doesn't know
about rent. Accounting tools do rent but not condition. Roomly does both, in one
place, with the tenant record as the thing that links them.

## Features

**Properties, rooms and tenancies**
Rooms belong to properties; tenancies belong to rooms; occupants belong to tenancies.
That last split is deliberate — a couple sharing a room share one rent and one deposit
but keep separate names, phone numbers and identity documents.

Tenancies move through `upcoming → active → ended → archived`, so a tenant can be
entered weeks before they arrive and the system still knows to remind you about them.

**Inventory / Schedule of Condition**
Modelled on real professional inventory reports: each room is broken into numbered
sections (Kitchen → Worktops, Oven/Hob/Extractor Fan, Kitchen Units…), each carrying a
condition rating, a cleanliness rating, notes, and any number of individually
timestamped photos. Section lists are templates per room type, stored as data, so
adding a section is a database row rather than a code change.

Check-in and check-out are the same structure recorded twice against one tenancy,
which makes the comparison view a straightforward join — and makes "this was Good in
January and is Poor now" provable rather than remembered.

**Rent tracking**
Due dates are generated from the move-in date and stored as real rows, so marking a
payment paid has something concrete to update. Handles weekly, fortnightly, four-weekly
and monthly, and correctly clamps month-end dates — a tenant who moves in on the 31st
is billed on the 28th in February and back on the 31st in March, rather than drifting
earlier every month. That edge case is covered by tests.

**Reminders that reach a phone**
Rather than building push notifications, each admin gets a private calendar
subscription URL. Move-ins, move-outs and rent dates appear in their phone's own
calendar with alarms attached, using notification infrastructure that already exists
and that people already trust.

Rent alerts deliberately fire the day *after* the due date — the tenant gets their full
due day to pay before anyone is chased.

**Tenant messaging in English and Chinese**
One-click WhatsApp reminders via `wa.me` deep links, pre-filled in the tenant's
preferred language. WeChat has no equivalent link that opens a chat from outside the
app, so those messages are copied to the clipboard to paste instead — an honest
limitation rather than a broken button.

**Compliance at a glance**
The dashboard counts active tenancies missing a legally required document (right to
rent, tenancy agreement, deposit protection certificate), turning a room-by-room audit
into a single number.

**Bilingual throughout**
The entire admin interface runs in English and Simplified Chinese.

---

## Tech

| | |
|---|---|
| Framework | Next.js 16 (App Router, React 19, Server Components) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix) |
| Database | Supabase (PostgreSQL) with Row Level Security |
| Auth & storage | Supabase Auth, private Storage buckets |
| i18n | next-intl (`en`, `zh-Hans`) |
| Hosting | Vercel |

### Security and data protection

The app handles passport scans and right-to-rent documents, so the security model is
part of the design rather than an afterthought:

- **Row Level Security on every table.** The database itself refuses to return rows to
  anyone who isn't an authenticated admin — not just the application layer.
- **No public file URLs.** Documents and photos live in private buckets and are served
  through short-lived signed URLs generated per request.
- **Every route is behind auth** via a single proxy check, with `noindex`, `DENY`
  framing and `no-referrer` headers set globally.
- **Retention is enforced, not just promised.** Archived tenancies are hard-deleted —
  files included — after a configurable retention period, rather than being flagged and
  forgotten.
- **Storage is bounded by design.** Once a checklist is exported to PDF, the original
  photos are purged on a delay, keeping the compact PDF as the permanent record. A
  full 70-page condition report with ~330 photos compresses to a few megabytes; the
  raw photos behind it are orders of magnitude larger.

---

## Running it

See **[SETUP.md](./SETUP.md)** for step-by-step setup, written for someone who hasn't
deployed a web app before.

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase keys
npm run dev
```

```bash
npm test        # rent scheduling logic
npm run typecheck
npm run build
```

## Project structure

```
src/
  app/[locale]/          Localised routes
    (app)/               Signed-in pages, sharing the nav shell
    (auth)/login/        The only publicly reachable page
  components/            UI, grouped by feature
  lib/
    supabase/            Browser, server and admin clients
    queries/             Data access
    rent.ts              Due-date generation (tested)
  i18n/                  Locale routing and config
  messages/              en.json, zh.json
  proxy.ts               Auth gate for every request
supabase/migrations/     Schema and seed data
```

## Status

Actively being built. Properties, rooms, tenancies, the inventory checklist, rent
tracking and the calendar feed are in progress across staged milestones; the
foundation — auth, database schema, security model, bilingual routing and PWA
support — is in place.
