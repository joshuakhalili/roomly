/**
 * Builds the demo dataset: six buildings, ~55 lettable rooms, two years of
 * history behind them.
 *
 * Why a script and not a migration: this is not schema, and it is not truth.
 * A migration runs once, everywhere, forever — including on any real database
 * this app is ever pointed at. Demo data has to be deletable and re-runnable,
 * and it must never be something a production deploy applies by accident.
 *
 *   npx tsx scripts/seed-demo.ts            # wipe and rebuild
 *   npx tsx scripts/seed-demo.ts --dry-run  # print the plan, touch nothing
 *
 * Everything here is invented. No real tenant, address, phone number or email
 * appears in it — that is the whole point of the exercise, since this database
 * backs a public portfolio piece.
 *
 * The dates are all computed backwards from today, so the demo still looks
 * current a year from now instead of decaying into obviously stale data.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run with: node --env-file=.env.local ./node_modules/.bin/tsx scripts/seed-demo.ts",
  );
  process.exit(1);
}

const DRY = process.argv.includes("--dry-run");
const db = createClient(url, key, { auth: { persistSession: false } });
const ORGANIZATION_ID =
  process.env.SEED_ORGANIZATION_ID ?? "00000000-0000-4000-8000-000000000001";

/* ── Determinism ──────────────────────────────────────────────────────────
   A seeded generator, not Math.random. Re-running the script has to produce
   the same portfolio, or every run silently changes the numbers in the
   screenshots and nobody can tell a real regression from fresh dice. */
let seed = 20260828;
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
const between = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

// ── Dates ────────────────────────────────────────────────────────────────
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
/* Formatted from the local parts, never via toISOString().
   These are calendar dates, not instants. Britain spends half the year at
   UTC+1, so local midnight serialises to 23:00 the *previous* day — which
   shifted every seeded date back by one across BST and, in the daily snapshot
   loop, produced the same date twice and broke the primary key. */
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
  // Clamp, so 31 Jan + 1 month is 28 Feb rather than 3 March. Same rule the
  // rent generator uses; the demo data has to obey it or the two disagree.
  out.setDate(Math.min(day, new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate()));
  return out;
};
const HISTORY_START = addMonths(TODAY, -24);

// ── The portfolio ────────────────────────────────────────────────────────
const PROPERTIES = [
  { name: "Marlow House", unitType: "flat", address: "14 Marlow Road, Manchester M14 5QT", rooms: 12, rent: [520, 640] },
  { name: "Brindley Court", unitType: "flat", address: "3 Brindley Court, Leeds LS6 2AB", rooms: 10, rent: [480, 590] },
  { name: "Kestrel Point", unitType: "studio", address: "88 Kestrel Way, Sheffield S10 1LP", rooms: 9, rent: [455, 560] },
  { name: "Saffron Lodge", unitType: "flat", address: "21 Saffron Hill, Nottingham NG7 3DE", rooms: 9, rent: [500, 615] },
  { name: "Verity Place", unitType: "studio", address: "6 Verity Place, Liverpool L15 8RB", rooms: 8, rent: [470, 575] },
  { name: "Aldgate Mews", unitType: "studio", address: "2 Aldgate Mews, Birmingham B16 9NX", rooms: 7, rent: [545, 680] },
] as const;

const SURNAMES = ["Chen","Wang","Li","Zhang","Liu","Huang","Zhao","Wu","Zhou","Xu","Sun","Ma","Zhu","Hu","Guo","Lin","He","Gao","Luo","Zheng","Okafor","Nowak","Silva","Haddad","Kaur","Patel","Novak","Ferreira","Ivanov","Ahmed",
  "Brennan","Whitfield","Osei","Kowalski","Dias","Rahman","Petrov","Mensah","Lindqvist","Varga",
  "Duarte","Fitzgerald","Ismail","Nakamura","Olsen","Rossi","Sandhu","Terzi","Vukovic","Yilmaz"] as const;
const GIVEN = ["Wei","Ming","Yan","Hui","Jing","Lei","Na","Peng","Qing","Rui","Ting","Xin","Yu","Zhen","Bo","Fang","Hao","Jie","Kai","Lan","Mei","Ning","Ping","Shan","Tao","Amara","Dawid","Ines","Karim","Simran","Rohan","Marek","Paulo","Dmitri","Layla"] as const;

const ROOM_LABEL = ["Room 1","Room 2","Room 3","Room 4","Room 5","Room 6","Room 7","Room 8","Room 9","Room 10","Room 11","Room 12"] as const;

// Tables cleared before a rebuild, children before parents. `profiles` is not
// here: those are login accounts, not demo content, and wiping them would lock
// everyone out of the app the data is meant to be viewed in.
const WIPE_ORDER = [
  "data_erasures","notifications_log","metrics_snapshots","archive_log",
  "checklist_photos","checklist_declarations","checklist_detectors",
  "checklist_keys","checklist_meters","checklist_sections","checklist_areas",
  "checklist_pdf_exports","inventory_checklists",
  "maintenance_jobs","job_recurrences","assets","contacts",
  "documents","rent_payments","tenancy_tenants","occupants","tenancies",
  "rooms","properties","tenants","bank_accounts",
] as const;

async function wipe() {
  for (const table of WIPE_ORDER) {
    if (DRY) {
      const { count } = await db.from(table).select("*", { count: "exact", head: true }).eq("organization_id", ORGANIZATION_ID);
      console.log(`  would clear ${table} (${count ?? 0} rows)`);
      continue;
    }
    // A filter is required by PostgREST for a bulk delete; this matches every
    // row without naming a column that might not exist on the table.
    const { error } = await db.from(table).delete().eq("organization_id", ORGANIZATION_ID);
    if (error) {
      /* Tables come and go across migrations — `checklist_room_sections` was
         replaced by `checklist_sections` in 0004. A name that no longer exists
         is worth a warning and nothing more; a name that exists but refuses to
         delete is a real failure and has to stop the run. */
      if (/Could not find the table/.test(error.message)) {
        console.log(`  skipped ${table} (not in this schema)`);
        continue;
      }
      throw new Error(`${table}: ${error.message}`);
    }
    console.log(`  cleared ${table}`);
  }
}

type Row = Record<string, unknown>;

/** Insert and return the rows, failing loudly — a silent write is worthless. */
async function insert(table: string, rows: Row[]): Promise<Row[]> {
  if (rows.length === 0) return [];
  const out: Row[] = [];
  // Chunked: PostgREST will accept a very large body and then time out on it.
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((row) => ({
      ...row,
      organization_id: ORGANIZATION_ID,
    }));
    // The generated table types are not available to a standalone script, so
    // the row shape is checked against the database at run time instead.
    const { data, error } = await db
      .from(table)
      .insert(chunk as never)
      .select();
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as Row[]));
  }
  return out;
}

async function main() {
  console.log(DRY ? "DRY RUN — nothing will be written\n" : "Seeding demo data\n");

  console.log("Clearing existing content…");
  await wipe();
  if (DRY) {
    console.log("\nWould then insert 6 properties, ~55 rooms, ~24 months of history.");
    return;
  }

  // ── Properties and rooms ───────────────────────────────────────────────
  const properties = await insert(
    "properties",
    PROPERTIES.map((p) => ({ name: p.name, address: p.address })),
  );
  console.log(`  ${properties.length} properties`);

  const roomRows: Row[] = [];
  PROPERTIES.forEach((p, i) => {
    const propertyId = properties[i].id as string;
    for (let n = 0; n < p.rooms; n++) {
      roomRows.push({
        property_id: propertyId,
        unit_type: p.unitType,
        name: ROOM_LABEL[n],
        is_lettable: true,
        is_common_area: false,
      });
    }
    /* Shared spaces are rooms for inventory purposes and cannot be let on
       their own. Only the flat-style buildings have them — in a block of
       studios the kitchen is inside the unit, which is the distinction
       `unit_type` exists to carry. */
    if (p.unitType === "flat") {
      for (const shared of ["Kitchen", "Bathroom", "Entrance/Hallway"]) {
        roomRows.push({
          property_id: propertyId,
          unit_type: "flat",
          name: shared,
          is_lettable: false,
          is_common_area: true,
        });
      }
    }
  });
  const rooms = await insert("rooms", roomRows);
  const lettable = rooms.filter((r) => r.is_lettable && !r.is_common_area);
  console.log(`  ${rooms.length} rooms (${lettable.length} lettable)`);

  // ── People ─────────────────────────────────────────────────────────────
  const used = new Set<string>();
  const tenantRows: Row[] = [];
  for (let i = 0; i < 96; i++) {
    let first = pick(GIVEN);
    let last = pick(SURNAMES);
    let guard = 0;
    while (used.has(`${first} ${last}`) && guard++ < 50) {
      first = pick(GIVEN);
      last = pick(SURNAMES);
    }
    used.add(`${first} ${last}`);
    const zh = SURNAMES.indexOf(last as (typeof SURNAMES)[number]) < 20;
    tenantRows.push({
      first_name: first,
      surname: last,
      // Invented domain, never-allocated UK mobile range (Ofcom reserves
      // 07700 900xxx for drama and documentation).
      email: `${first}.${last}`.toLowerCase() + "@example.com",
      phone: `+447700900${String(100 + i).slice(-3)}`,
      preferred_language: zh ? "zh" : "en",
      country_of_origin: zh ? "China" : pick(["United Kingdom", "Poland", "Nigeria", "India", "Brazil"]),
      is_archived: false,
    });
  }
  const tenants = await insert("tenants", tenantRows);
  console.log(`  ${tenants.length} tenant profiles`);

  // ── Tenancies: a chain per room across the last two years ──────────────
  /* Rooms are let in runs of 6–14 months with a short void between, which is
     what produces the occupancy curve, the time-to-fill figure and the "why
     tenants left" breakdown. About one room in seven is deliberately left
     empty right now, so the dashboard has something to show. */
  const REASONS = ["end_of_term", "tenant_gave_notice", "given_notice_by_admin", "other"] as const;
  const tenancyRows: Row[] = [];
  const linkPlan: { roomIndex: number; tenantIdx: number }[] = [];
  let tenantCursor = 0;

  lettable.forEach((room, roomIndex) => {
    const property = PROPERTIES.find((p) => p.name === properties.find((x) => x.id === room.property_id)?.name)!;
    const baseRent = between(property.rent[0], property.rent[1]);
    let cursor = addDays(HISTORY_START, between(0, 60));
    const leaveEmpty = roomIndex % 7 === 3;

    while (cursor < TODAY) {
      const months = between(6, 14);
      const start = new Date(cursor);
      const end = addMonths(start, months);
      const isCurrent = end >= TODAY;

      if (isCurrent && leaveEmpty) break; // this room is vacant today

      tenancyRows.push({
        room_id: room.id,
        status: isCurrent ? "active" : "ended",
        start_date: iso(start),
        end_date: isCurrent ? null : iso(end),
        rent_amount: baseRent + between(0, 4) * 10,
        rent_frequency: "monthly",
        rent_due_day: start.getDate(),
        deposit_amount: baseRent,
        deposit_scheme_name: pick(["DPS", "mydeposits", "TDS"]),
        deposit_scheme_ref: `DEM-${String(tenancyRows.length + 1).padStart(5, "0")}`,
        reason_for_leaving: isCurrent ? null : pick(REASONS),
      });
      linkPlan.push({ roomIndex: tenancyRows.length - 1, tenantIdx: tenantCursor % tenants.length });
      tenantCursor++;

      if (isCurrent) break;
      cursor = addDays(end, between(4, 45)); // the void before the next let
    }
  });

  const tenancies = await insert("tenancies", tenancyRows);
  console.log(`  ${tenancies.length} tenancies (${tenancies.filter((t) => t.status === "active").length} active)`);

  await insert(
    "tenancy_tenants",
    linkPlan.map((l) => ({
      tenancy_id: tenancies[l.roomIndex].id,
      tenant_id: tenants[l.tenantIdx].id,
      is_lead_tenant: true,
    })),
  );

  /* Archived once their last letting ended more than 90 days ago.
     A real book keeps everyone forever, and the point of the archived section
     is that "moved out eighteen months ago" and "moved out last month, looking
     for the next room" are different states. Filing everyone who is not
     currently housed as merely unassigned made the live list mostly ghosts. */
  const lastEndByTenant = new Map<string, string>();
  const housedNow = new Set<string>();
  for (const l of linkPlan) {
    const tenancy = tenancies[l.roomIndex];
    const tenantId = tenants[l.tenantIdx].id as string;
    if (tenancy.status === "active") {
      housedNow.add(tenantId);
      continue;
    }
    const end = tenancy.end_date as string;
    const seen = lastEndByTenant.get(tenantId);
    if (!seen || end > seen) lastEndByTenant.set(tenantId, end);
  }
  const recently = iso(addDays(TODAY, -90));
  const stale = tenants.filter((t) => {
    const id = t.id as string;
    if (housedNow.has(id)) return false;
    const end = lastEndByTenant.get(id);
    return end !== undefined && end < recently;
  });
  for (let i = 0; i < stale.length; i += 200) {
    const { error } = await db
      .from("tenants")
      .update({ is_archived: true })
      .in("id", stale.slice(i, i + 200).map((t) => t.id));
    if (error) throw new Error(`archive tenants: ${error.message}`);
  }
  console.log(`  ${housedNow.size} housed, ${stale.length} archived`);

  // ── Rent ───────────────────────────────────────────────────────────────
  /* One row per month from the start of the letting to today (or its end).
     Ended tenancies are fully paid — you do not hand the keys back mid-
     argument. Live ones are paid up to the last month or two, and four of
     them are deliberately behind so the chase list has something in it. */
  const behind = new Set(
    tenancies.filter((t) => t.status === "active").slice(0, 4).map((t) => t.id),
  );
  const payments: Row[] = [];
  for (const t of tenancies) {
    const start = new Date(t.start_date as string);
    const stop = t.end_date ? new Date(t.end_date as string) : TODAY;
    const arrearsFrom = behind.has(t.id as string) ? addMonths(TODAY, -between(2, 6)) : null;

    for (let d = new Date(start); d <= stop; d = addMonths(d, 1)) {
      const unpaid = arrearsFrom !== null && d >= arrearsFrom;
      payments.push({
        tenancy_id: t.id,
        due_date: iso(d),
        amount_due: t.rent_amount,
        status: unpaid ? "due" : "paid",
        paid_at: unpaid ? null : `${iso(addDays(d, between(0, 3)))}T10:00:00.000Z`,
      });
    }
  }
  await insert("rent_payments", payments);
  console.log(`  ${payments.length} rent payments (${behind.size} tenancies in arrears)`);

  // ── Documents ──────────────────────────────────────────────────────────
  /* One placeholder PDF per bucket, shared by every row that points at it.
     The alternative was several hundred uploads of the same few hundred bytes;
     this way every download in the demo actually opens something, which is
     what matters, and the row's `doc_type` still carries the real meaning. */
  const PLACEHOLDER = Buffer.from(
    "JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAw" +
      "IG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8" +
      "PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCAyMDAgMTAwXT4+CmVuZG9iagp0" +
      "cmFpbGVyCjw8L1Jvb3QgMSAwIFI+Pg==",
    "base64",
  );
  const DOC_BUCKET: Record<string, string> = {
    right_to_rent: "right-to-rent",
    tenancy_agreement: "tenancy-agreements",
    deposit_certificate: "deposit-certs",
    deposit_prescribed_info: "deposit-certs",
    renters_rights_info: "handbooks",
  };
  const paths: Record<string, string> = {};
  for (const [docType, bucket] of Object.entries(DOC_BUCKET)) {
    const path = `${ORGANIZATION_ID}/demo/${docType}.pdf`;
    const { error } = await db.storage
      .from(bucket)
      .upload(path, PLACEHOLDER, { contentType: "application/pdf", upsert: true });
    if (error) throw new Error(`storage ${bucket}: ${error.message}`);
    paths[docType] = `${bucket}/${path}`;
  }

  /* Two active tenancies are left short of their paperwork on purpose — a
     compliance screen that always reads zero proves nothing about whether it
     works. */
  const activeTenancies = tenancies.filter((t) => t.status === "active");
  const docRows: Row[] = [];
  activeTenancies.forEach((t, i) => {
    const missing = i < 2 ? 2 : 0;
    Object.keys(DOC_BUCKET)
      .slice(0, Object.keys(DOC_BUCKET).length - missing)
      .forEach((docType) => {
        docRows.push({
          tenancy_id: t.id,
          doc_type: docType,
          file_name: `${docType}.pdf`,
          storage_path: paths[docType],
          file_size: PLACEHOLDER.byteLength,
          issued_at: t.start_date,
        });
      });
  });
  await insert("documents", docRows);
  console.log(`  ${docRows.length} documents (2 tenancies left incomplete)`);

  // ── Maintenance ────────────────────────────────────────────────────────
  const { data: serviceTypes } = await db.from("service_types").select("id, slug");
  const service = (slug: string) => serviceTypes?.find((s) => s.slug === slug)?.id as string;

  const contacts = await insert("contacts", [
    { name: "Bright & Clean", company: "Bright & Clean Ltd", service_type_id: service("cleaning"), phone: "+447700900801", email: "hello@example.com" },
    { name: "Greenfield Grounds", company: "Greenfield Grounds", service_type_id: service("landscaping"), phone: "+447700900802", email: "grounds@example.com" },
    { name: "R. Okonkwo", company: "Okonkwo Plumbing", service_type_id: service("plumbing"), phone: "+447700900803" },
    { name: "S. Whitfield", company: "Whitfield Electrical", service_type_id: service("electrical"), phone: "+447700900804" },
    { name: "GasSafe North", company: "GasSafe North", service_type_id: service("gas"), phone: "+447700900805", email: "bookings@example.com" },
    { name: "J. Almeida", company: "Almeida Joinery", service_type_id: service("repair"), phone: "+447700900806" },
  ]);
  console.log(`  ${contacts.length} contacts`);

  const APPLIANCES = [
    ["Washing machine", "Bosch Serie 4"], ["Fridge freezer", "Beko CFG3582"],
    ["Boiler", "Worcester Bosch 4000"], ["Oven", "Zanussi ZOHNX3X1"],
    ["Smart TV", 'Samsung 43" AU7100'], ["Vacuum cleaner", "Shark NZ690UK"],
  ] as const;
  const assetRows: Row[] = [];
  properties.forEach((p) => {
    for (let i = 0; i < between(3, 6); i++) {
      const [name, model] = pick(APPLIANCES);
      const bought = addDays(TODAY, -between(30, 700));
      assetRows.push({
        property_id: p.id,
        name,
        make_model: model,
        purchased_on: iso(bought),
        cost: between(180, 900),
        supplier_name: pick(["Currys", "AO.com", "Local supplier"]),
        // Some warranties have already lapsed and some expire soon, which is
        // the only way the expiry warning can be seen working.
        warranty_expires_on: iso(addMonths(bought, pick([12, 24, 24, 36]))),
      });
    }
  });
  const assets = await insert("assets", assetRows);
  console.log(`  ${assets.length} assets`);

  // Standing cleaning and grounds arrangements, plus the jobs they produced.
  const recurrences = await insert(
    "job_recurrences",
    properties.flatMap((p) => [
      { property_id: p.id, service_type_id: service("cleaning"), title: "Communal clean", frequency: "weekly", day_of_week: 2, cost: 55, starts_on: iso(addMonths(TODAY, -12)), contact_id: contacts[0].id },
      { property_id: p.id, service_type_id: service("landscaping"), title: "Grounds maintenance", frequency: "fortnightly", day_of_week: 4, cost: 100, starts_on: iso(addMonths(TODAY, -12)), contact_id: contacts[1].id },
    ]),
  );
  console.log(`  ${recurrences.length} recurring arrangements`);

  const jobs: Row[] = [];
  for (const r of recurrences) {
    const stepDays = r.frequency === "weekly" ? 7 : 14;
    // Six months back to a month ahead: enough history for the spend chart,
    // enough future for the calendar to have something on it.
    for (let d = addMonths(TODAY, -6); d <= addMonths(TODAY, 1); d = addDays(d, stepDays)) {
      const past = d < TODAY;
      jobs.push({
        property_id: r.property_id,
        service_type_id: r.service_type_id,
        contact_id: r.contact_id,
        recurrence_id: r.id,
        title: r.title,
        scheduled_for: iso(d),
        status: past ? "done" : "booked",
        completed_on: past ? iso(d) : null,
        cost: r.frequency === "weekly" ? between(45, 70) : between(80, 130),
        is_paid: past,
        paid_on: past ? iso(addDays(d, between(1, 14))) : null,
        source: "recurring",
      });
    }
  }
  const DEFECTS = [
    ["Leaking tap in shared kitchen", "plumbing"], ["Hallway light not working", "electrical"],
    ["Annual gas safety check", "gas"], ["Front door lock sticking", "repair"],
    ["Damp patch on landing ceiling", "repair"], ["Boiler service", "gas"],
    ["Extractor fan replacement", "electrical"], ["Blocked gutter", "repair"],
  ] as const;
  for (const p of properties) {
    for (let i = 0; i < between(2, 5); i++) {
      const [title, slug] = pick(DEFECTS);
      const when = addDays(TODAY, between(-150, 20));
      const past = when < TODAY;
      jobs.push({
        property_id: p.id,
        service_type_id: service(slug),
        title,
        scheduled_for: iso(when),
        status: past ? "done" : "booked",
        completed_on: past ? iso(when) : null,
        cost: between(60, 480),
        // A few invoices left outstanding, so "unpaid bills" is not always £0.
        is_paid: past && rnd() > 0.25,
        paid_on: past ? iso(addDays(when, between(2, 21))) : null,
        source: "manual",
      });
    }
  }
  await insert("maintenance_jobs", jobs);
  console.log(`  ${jobs.length} maintenance jobs`);

  // ── Snapshots ──────────────────────────────────────────────────────────
  /* The daily job writes one of these a night. Without two years of them the
     trend chart is empty and every "vs 30 days ago" comparison disappears, so
     the history is reconstructed here from the tenancies just created. */
  const snapshots: Row[] = [];
  const spans = tenancies.map((t) => ({
    start: new Date(t.start_date as string),
    end: t.end_date ? new Date(t.end_date as string) : null,
    rent: Number(t.rent_amount),
  }));
  for (let d = new Date(HISTORY_START); d <= TODAY; d = addDays(d, 1)) {
    const live = spans.filter((s) => s.start <= d && (s.end === null || s.end >= d));
    snapshots.push({
      snapshot_date: iso(d),
      occupied_rooms: live.length,
      vacant_rooms: Math.max(0, lettable.length - live.length),
      total_active_rent: live.reduce((sum, s) => sum + s.rent, 0),
      // Arrears only became real in the last few months of the story.
      overdue_rent_total: d > addMonths(TODAY, -6) ? between(0, 4200) : 0,
    });
  }
  await insert("metrics_snapshots", snapshots);
  console.log(`  ${snapshots.length} daily snapshots`);

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
