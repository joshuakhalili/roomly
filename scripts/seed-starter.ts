/**
 * The starter set: one worked example of every feature, for a brand new
 * instance.
 *
 * This is not the demo data. `seed-demo.ts` builds two years of portfolio to
 * make the charts look real; this builds the smallest possible set that shows
 * someone *how each part of the app works*, on a database they are about to
 * start using for their own lettings.
 *
 *   node --env-file=.env.sam ./node_modules/.bin/tsx scripts/seed-starter.ts
 *
 * Two rules it follows:
 *
 *   Everything is named "Example …", so there is never a moment of wondering
 *   whether a record is real. It is all safe to delete, and deleting it is the
 *   expected first move once the real data starts going in.
 *
 *   Nothing is left in a single state. One room is let and one is empty; one
 *   rent payment is paid and one is outstanding; one job is done and one is
 *   booked. A template that only ever shows the happy path teaches you half
 *   the screen — you cannot tell what "overdue" looks like until something is.
 *
 * Refuses to run against a database that already has real content, because
 * the one thing worse than no starter data is starter data appearing in
 * someone's live records three weeks in.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run with: node --env-file=<the instance's env file> ./node_modules/.bin/tsx scripts/seed-starter.ts",
  );
  process.exit(1);
}

const FORCE = process.argv.includes("--force");
const db = createClient(url, key, { auth: { persistSession: false } });

type Row = Record<string, unknown>;

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
/* Local parts, never toISOString(). Under BST local midnight serialises to
   23:00 the previous day, which silently shifts every date back one. */
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
};
const addMonths = (d: Date, n: number) => {
  const out = new Date(d);
  const day = out.getDate();
  out.setDate(1);
  out.setMonth(out.getMonth() + n);
  out.setDate(
    Math.min(day, new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate()),
  );
  return out;
};

async function one(table: string, row: Row): Promise<Row> {
  const { data, error } = await db.from(table).insert(row as never).select().single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data as Row;
}

async function many(table: string, rows: Row[]): Promise<Row[]> {
  if (!rows.length) return [];
  const { data, error } = await db.from(table).insert(rows as never).select();
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as Row[];
}

async function main() {
  // ── Refuse to touch a database that is already in use ──────────────────
  const { count: propertyCount } = await db
    .from("properties")
    .select("*", { count: "exact", head: true });
  if ((propertyCount ?? 0) > 0 && !FORCE) {
    console.error(
      `This database already has ${propertyCount} propert${propertyCount === 1 ? "y" : "ies"}.\n` +
        "Starter data is for an empty instance. Re-run with --force if you are sure.",
    );
    process.exit(1);
  }

  console.log(`Seeding starter data into ${new URL(url!).hostname}\n`);

  // ── A building, with one room let and one empty ────────────────────────
  const property = await one("properties", {
    name: "Example House",
    address: "1 Example Street, Manchester M1 1AA",
    notes:
      "This is example data, created to show how Roomly works. " +
      "Delete it whenever you like — nothing else depends on it.",
  });

  // The empty room is deliberately never referenced again — being empty is
  // its whole job, so that the vacant state is visible on the dashboard.
  const [letRoom] = await many("rooms", [
    { property_id: property.id, unit_type: "studio", name: "Example Room 1", is_lettable: true, is_common_area: false },
    { property_id: property.id, unit_type: "studio", name: "Example Room 2", is_lettable: true, is_common_area: false },
  ]);
  // A shared space, so the difference between a lettable room and a common
  // area is visible rather than something you read about in a tooltip.
  await one("rooms", {
    property_id: property.id,
    unit_type: "flat",
    name: "Example Shared Kitchen",
    is_lettable: false,
    is_common_area: true,
  });
  console.log("  1 property, 3 rooms (1 let, 1 empty, 1 shared)");

  // ── A person, and their letting ────────────────────────────────────────
  const tenant = await one("tenants", {
    first_name: "Example",
    surname: "Tenant",
    email: "example.tenant@example.com",
    // Ofcom reserves 07700 900xxx precisely so it can never reach anyone.
    phone: "+447700900123",
    preferred_language: "en",
    notes: "Example tenant profile. People are stored separately from rooms, so the same person can move between rooms and keep their history.",
  });

  const start = addMonths(TODAY, -3);
  const tenancy = await one("tenancies", {
    room_id: letRoom.id,
    status: "active",
    start_date: iso(start),
    rent_amount: 650,
    rent_frequency: "monthly",
    rent_due_day: start.getDate(),
    deposit_amount: 650,
    deposit_scheme_name: "DPS",
    deposit_scheme_ref: "EXAMPLE-0001",
    notes: "Example tenancy.",
  });
  await one("tenancy_tenants", {
    tenancy_id: tenancy.id,
    tenant_id: tenant.id,
    is_lead_tenant: true,
  });
  console.log("  1 tenant, 1 active tenancy");

  // ── Rent: some settled, one outstanding ────────────────────────────────
  const payments: Row[] = [];
  for (let i = 3; i >= 0; i--) {
    const due = addMonths(start, 3 - i);
    if (due > addDays(TODAY, 45)) continue;
    // The most recent one is left unpaid on purpose: it is the only way to
    // see the chase list, the "Late" badge and the reminder button working.
    const outstanding = i === 0;
    payments.push({
      tenancy_id: tenancy.id,
      due_date: iso(due),
      amount_due: 650,
      status: outstanding ? "due" : "paid",
      paid_at: outstanding ? null : `${iso(addDays(due, 1))}T10:00:00.000Z`,
    });
  }
  await many("rent_payments", payments);
  console.log(`  ${payments.length} rent payments (1 left outstanding, so the chase list is not empty)`);

  // ── A document you can actually open ───────────────────────────────────
  const PLACEHOLDER = Buffer.from(
    "JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAw" +
      "IG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8" +
      "PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCAyMDAgMTAwXT4+CmVuZG9iagp0" +
      "cmFpbGVyCjw8L1Jvb3QgMSAwIFI+Pg==",
    "base64",
  );
  const path = "starter/example-tenancy-agreement.pdf";
  const up = await db.storage
    .from("tenancy-agreements")
    .upload(path, PLACEHOLDER, { contentType: "application/pdf", upsert: true });
  if (up.error) throw new Error(`storage: ${up.error.message}`);
  await one("documents", {
    tenancy_id: tenancy.id,
    doc_type: "tenancy_agreement",
    file_name: "example-tenancy-agreement.pdf",
    storage_path: `tenancy-agreements/${path}`,
    file_size: PLACEHOLDER.byteLength,
    issued_at: iso(start),
    notes: "Example document. Real uploads work the same way — the file is private and served through a short-lived signed link.",
  });
  console.log("  1 document (a real file, openable from the Documents page)");

  // ── Maintenance: a contact, a thing you own, and work in both states ───
  const { data: serviceTypes } = await db
    .from("service_types")
    .select("id, slug");
  const service = (slug: string) =>
    serviceTypes?.find((s) => s.slug === slug)?.id as string | undefined;

  const cleaner = await one("contacts", {
    name: "Example Cleaner",
    company: "Example Cleaning Co",
    service_type_id: service("cleaning"),
    phone: "+447700900456",
    email: "cleaner@example.com",
    notes: "Example contact. This address book is shared across every property.",
  });

  const asset = await one("assets", {
    property_id: property.id,
    room_id: letRoom.id,
    name: "Example Washing Machine",
    make_model: "Example Model 123",
    purchased_on: iso(addMonths(TODAY, -6)),
    cost: 320,
    supplier_name: "Example Supplier",
    // Expiring soon rather than years away, so the warranty warning is
    // actually visible instead of being a feature you take on trust.
    warranty_expires_on: iso(addMonths(TODAY, 2)),
    notes: "Example asset. Logging what you own is separate from the inventory checklist — this record stays current, a checklist is frozen evidence.",
  });

  const recurrence = await one("job_recurrences", {
    property_id: property.id,
    service_type_id: service("cleaning"),
    contact_id: cleaner.id,
    title: "Example communal clean",
    frequency: "weekly",
    day_of_week: 2,
    cost: 45,
    starts_on: iso(addMonths(TODAY, -1)),
  });

  await many("maintenance_jobs", [
    {
      property_id: property.id,
      service_type_id: service("cleaning"),
      contact_id: cleaner.id,
      recurrence_id: recurrence.id,
      title: "Example communal clean",
      scheduled_for: iso(addDays(TODAY, -7)),
      status: "done",
      completed_on: iso(addDays(TODAY, -7)),
      cost: 45,
      is_paid: true,
      paid_on: iso(addDays(TODAY, -5)),
      source: "recurring",
    },
    {
      property_id: property.id,
      service_type_id: service("repair"),
      title: "Example repair — dripping tap",
      description: "Example job. Anything you book by hand looks like this.",
      scheduled_for: iso(addDays(TODAY, 3)),
      status: "booked",
      // Unpaid and upcoming, so the calendar and the unpaid-bills figure
      // both have something in them.
      cost: 85,
      is_paid: false,
      source: "manual",
      asset_id: asset.id,
    },
  ]);
  console.log("  1 contact, 1 asset, 1 standing arrangement, 2 jobs (1 done, 1 booked)");

  console.log(
    "\nDone. Everything above is named \"Example …\" and is safe to delete.\n" +
      "The room types, service types and message templates come from the\n" +
      "migrations rather than from here, so those stay when the examples go.",
  );
}

main().catch((err) => {
  console.error("\nStarter seed failed:", err.message);
  process.exit(1);
});
