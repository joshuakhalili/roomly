/**
 * Dumps every content table to a timestamped JSON file before anything
 * destructive runs against the database.
 *
 * The seed script wipes and rebuilds. That is the right behaviour — a demo
 * dataset with yesterday's half-finished experiments still in it is worse than
 * no demo — but "the right behaviour" and "unrecoverable" should not be the
 * same sentence. This makes the wipe reversible.
 *
 *   node --env-file=.env.local ./node_modules/.bin/tsx scripts/backup-data.ts
 *
 * Output goes to `.backups/`, which is gitignored: it is a copy of live data
 * and has no business in a public repository.
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env vars — run with node --env-file=.env.local");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const TABLES = [
  "profiles", "properties", "rooms", "area_types", "unit_area_defaults",
  "checklist_section_templates", "bank_accounts",
  "tenants", "tenancies", "tenancy_tenants", "occupants",
  "rent_payments", "documents",
  "inventory_checklists", "checklist_room_sections", "checklist_photos",
  "checklist_meters", "checklist_keys", "checklist_detectors",
  "checklist_declarations", "checklist_pdf_exports",
  "checklist_areas", "checklist_sections",
  "service_types", "contacts", "assets", "job_recurrences", "maintenance_jobs",
  "document_requirements", "utility_bills", "expense_categories", "expenses",
  "message_templates", "notifications_log", "metrics_snapshots",
  "archive_log", "app_settings", "retention_rules", "data_erasures",
] as const;

async function main() {
  const dump: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    const { data, error } = await db.from(table).select("*");
    if (error) {
      // A table that does not exist in this database is worth saying out loud
      // rather than skipping in silence — it means this list has drifted.
      console.warn(`  ! ${table}: ${error.message}`);
      continue;
    }
    dump[table] = data ?? [];
    console.log(`  ${table}: ${data?.length ?? 0}`);
  }

  mkdirSync(".backups", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = `.backups/roomly-${stamp}.json`;
  writeFileSync(file, JSON.stringify(dump, null, 2));

  const rows = Object.values(dump).reduce((n, xs) => n + xs.length, 0);
  console.log(`\nWrote ${rows} rows to ${file}`);
}

main().catch((err) => {
  console.error("Backup failed:", err.message);
  process.exit(1);
});
