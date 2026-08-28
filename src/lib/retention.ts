import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Retention: working out what has to go, and then making it go.
 *
 * The periods themselves live in the `retention_rules` table with the rule
 * each one comes from, and the SQL views compute what is due. This file is
 * the part that gathers the files sitting underneath each expired record and
 * removes them in an order that cannot leave personal data behind.
 *
 * One idea holds the whole thing together: **the preview and the deletion
 * run the same code**, with a single boolean between them. A preview that
 * recomputed its own list would be worse than no preview at all — it would
 * be confident, readable, and capable of being wrong about an operation
 * nobody can undo.
 */

/** Storage paths are stored as `bucket/path/within/bucket`. */
export interface StorageRef {
  bucket: string;
  path: string;
}

export type RetentionCategory =
  | "identity_documents"
  | "tenancy_records"
  | "inventory_photos";

export type ErasureSubject =
  | "document"
  | "tenancy"
  | "tenant"
  | "checklist_photos";

export interface ErasureItem {
  category: RetentionCategory;
  subjectType: ErasureSubject;
  subjectId: string;
  /**
   * What gets written to the audit log.
   *
   * Deliberately non-identifying — a room and a date, never a name. An
   * erasure log that records whose passport it deleted has copied the
   * identifying data into a table no retention rule covers, which undoes
   * the erasure it is supposed to evidence.
   */
  subjectLabel: string;
  dueDate: string | null;
  files: StorageRef[];
  records: number;
  bytes: number;
}

export interface RetentionPlan {
  today: string;
  items: ErasureItem[];
  /** Held back by a legal hold or a missing end date — shown, never erased. */
  blocked: { reason: string; count: number }[];
}

export interface RetentionResult {
  dryRun: boolean;
  today: string;
  items: ErasureItem[];
  errors: string[];
  totals: { records: number; files: number; bytes: number };
}

export function splitStoragePath(stored: string | null): StorageRef | null {
  if (!stored) return null;
  const i = stored.indexOf("/");
  if (i <= 0 || i === stored.length - 1) return null;
  return { bucket: stored.slice(0, i), path: stored.slice(i + 1) };
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Every photo and report filed under a set of checklists.
 *
 * Walked a level at a time rather than as one nested select: the hierarchy
 * is checklist → area → section → photo, and a join written across four
 * tables in PostgREST syntax is far harder to check than four plain reads.
 */
async function collectChecklistFiles(
  db: SupabaseClient,
  checklistIds: string[],
): Promise<{ photos: { id: string; ref: StorageRef; bytes: number }[] }> {
  if (!checklistIds.length) return { photos: [] };

  const { data: areas } = await db
    .from("checklist_areas")
    .select("id")
    .in("checklist_id", checklistIds);
  const areaIds = (areas ?? []).map((a) => a.id);
  if (!areaIds.length) return { photos: [] };

  const { data: sections } = await db
    .from("checklist_sections")
    .select("id")
    .in("checklist_area_id", areaIds);
  const sectionIds = (sections ?? []).map((s) => s.id);
  if (!sectionIds.length) return { photos: [] };

  const { data: photos } = await db
    .from("checklist_photos")
    .select("id, storage_path, file_size")
    .in("checklist_section_id", sectionIds);

  const out: { id: string; ref: StorageRef; bytes: number }[] = [];
  for (const p of photos ?? []) {
    const ref = splitStoragePath(p.storage_path);
    if (ref) out.push({ id: p.id, ref, bytes: Number(p.file_size ?? 0) });
  }
  return { photos: out };
}

async function setting(
  db: SupabaseClient,
  key: string,
  fallback: string,
): Promise<string> {
  const { data } = await db
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? fallback;
}

/**
 * Everything currently past its retention date.
 *
 * Reads the views and nothing else, so the numbers here are the numbers the
 * database will act on.
 */
export async function planRetention(
  db: SupabaseClient,
  now = new Date(),
): Promise<RetentionPlan> {
  const today = isoDate(now);
  const items: ErasureItem[] = [];
  const blocked: { reason: string; count: number }[] = [];

  /**
   * Documents already accounted for by an earlier item.
   *
   * Identity paperwork expires five years before the record it belongs to,
   * so by the time a tenant's whole file is erased their passport is
   * normally long gone. But when both fall due in the same run — a tenancy
   * that ended over six years ago whose identity documents were never
   * cleared — the same document would be listed twice: once on its own
   * twelve-month clock, once as part of the tenant's record.
   *
   * Live, the second pass would try to delete a file the first had already
   * removed and report it as a failure, then decline to delete the tenant
   * row to protect a file that no longer exists. The preview would also
   * overstate the count. Both are fixed by scheduling each document once.
   */
  const scheduled = new Set<string>();

  // ── Identity paperwork: one year after the tenancy ends ──────────────────
  const { data: idDocs } = await db
    .from("identity_documents_due")
    .select("*")
    .lte("due_date", today);

  for (const d of idDocs ?? []) {
    const ref = splitStoragePath(d.storage_path);
    scheduled.add(d.document_id);
    items.push({
      category: "identity_documents",
      subjectType: "document",
      subjectId: d.document_id,
      subjectLabel: `${d.doc_type} · ${d.room_label} · tenancy ended ${d.ended_on}`,
      dueDate: d.due_date,
      files: ref ? [ref] : [],
      records: 1,
      bytes: Number(d.file_size ?? 0),
    });
  }

  // ── Tenancy records: six years after the tenancy ends ────────────────────
  const { data: tenancies } = await db
    .from("tenancies_due_for_erasure")
    .select("*")
    .lte("due_date", today);

  for (const t of tenancies ?? []) {
    const files: StorageRef[] = [];
    let bytes = 0;
    let records = 1; // the tenancy row itself

    // Documents filed against the letting.
    const { data: docs } = await db
      .from("documents")
      .select("id, storage_path, file_size")
      .eq("tenancy_id", t.tenancy_id);
    for (const d of docs ?? []) {
      if (scheduled.has(d.id)) continue;
      scheduled.add(d.id);
      const ref = splitStoragePath(d.storage_path);
      if (ref) files.push(ref);
      bytes += Number(d.file_size ?? 0);
      records += 1;
    }

    // Checklists, their photos, and the exported reports.
    const { data: checklists } = await db
      .from("inventory_checklists")
      .select("id")
      .eq("tenancy_id", t.tenancy_id);
    const checklistIds = (checklists ?? []).map((c) => c.id);

    const { photos } = await collectChecklistFiles(db, checklistIds);
    for (const p of photos) {
      files.push(p.ref);
      bytes += p.bytes;
      records += 1;
    }

    if (checklistIds.length) {
      const { data: exports } = await db
        .from("checklist_pdf_exports")
        .select("storage_path, file_size")
        .in("checklist_id", checklistIds);
      for (const e of exports ?? []) {
        const ref = splitStoragePath(e.storage_path);
        if (ref) files.push(ref);
        bytes += Number(e.file_size ?? 0);
        records += 1;
      }
    }

    // Rent history goes with the tenancy — it is the financial record the
    // six-year period exists for.
    const { count: rentRows } = await db
      .from("rent_payments")
      .select("id", { count: "exact", head: true })
      .eq("tenancy_id", t.tenancy_id);
    records += rentRows ?? 0;

    items.push({
      category: "tenancy_records",
      subjectType: "tenancy",
      subjectId: t.tenancy_id,
      subjectLabel: `${t.room_label ?? "room"} · tenancy ended ${t.ended_on}`,
      dueDate: t.due_date,
      files,
      records,
      bytes,
    });
  }

  // ── The tenant's own record ──────────────────────────────────────────────
  // Erased on the same six-year clock, but computed from the latest of ALL
  // their tenancies. A tenant profile is reused across rooms, so reading the
  // clock off a single tenancy would delete someone still living here.
  const { data: tenants } = await db
    .from("tenants_due_for_erasure")
    .select("*")
    .lte("due_date", today);

  for (const t of tenants ?? []) {
    const files: StorageRef[] = [];
    let bytes = 0;
    let records = 1;

    const { data: docs } = await db
      .from("documents")
      .select("id, storage_path, file_size")
      .eq("tenant_id", t.tenant_id);
    for (const d of docs ?? []) {
      if (scheduled.has(d.id)) continue;
      scheduled.add(d.id);
      const ref = splitStoragePath(d.storage_path);
      if (ref) files.push(ref);
      bytes += Number(d.file_size ?? 0);
      records += 1;
    }

    items.push({
      category: "tenancy_records",
      subjectType: "tenant",
      subjectId: t.tenant_id,
      subjectLabel: `tenant record · ${t.room_label ?? "room"} · last tenancy ended ${t.ended_on}`,
      dueDate: t.due_date,
      files,
      records,
      bytes,
    });
  }

  // ── Checklist photos whose report already exists ─────────────────────────
  const purgeDays = Number(await setting(db, "photo_purge_days", "30"));
  const purgeOnEnd =
    (await setting(db, "purge_photos_on_tenancy_end", "true")) === "true";

  const { data: exports } = await db
    .from("checklist_photos_purgeable")
    .select("*");

  for (const e of exports ?? []) {
    const generated = new Date(e.generated_at);
    const ageDays = Math.floor(
      (now.getTime() - generated.getTime()) / 86_400_000,
    );
    const tenancyOver =
      purgeOnEnd && (e.tenancy_status === "ended" || e.tenancy_status === "archived");

    if (ageDays < purgeDays && !tenancyOver) continue;

    const { photos } = await collectChecklistFiles(db, [e.checklist_id]);
    if (!photos.length) continue;

    items.push({
      category: "inventory_photos",
      subjectType: "checklist_photos",
      subjectId: e.checklist_id,
      subjectLabel: `${e.room_label ?? "room"} · report generated ${isoDate(generated)}`,
      dueDate: isoDate(
        new Date(generated.getTime() + purgeDays * 86_400_000),
      ),
      files: photos.map((p) => p.ref),
      records: photos.length,
      bytes: photos.reduce((s, p) => s + p.bytes, 0),
    });
  }

  // ── What is being deliberately kept ──────────────────────────────────────
  const { count: heldCount } = await db
    .from("tenancies")
    .select("id", { count: "exact", head: true })
    .eq("legal_hold", true);
  if (heldCount) blocked.push({ reason: "legal_hold", count: heldCount });

  const { data: undated } = await db
    .from("tenant_retention_clock")
    .select("tenant_id")
    .eq("has_undated_end", true);
  if (undated?.length)
    blocked.push({ reason: "no_end_date", count: undated.length });

  return { today, items, blocked };
}

/**
 * Carries out a plan, or writes down what it would have done.
 *
 * Files go before rows, always. Deleting the row first orphans the file: the
 * database forgets it exists while the object sits in the bucket, and since
 * no retention rule can reach an object nothing points at, the personal data
 * survives the erasure that was supposed to remove it. A Postgres cascade
 * does not reach into storage.
 */
export async function runRetention(
  db: SupabaseClient,
  opts: { dryRun: boolean; now?: Date; actor?: string | null },
): Promise<RetentionResult> {
  const now = opts.now ?? new Date();
  const plan = await planRetention(db, now);
  const errors: string[] = [];
  const done: ErasureItem[] = [];

  // A preview describes what is due right now, so only the latest one is
  // worth anything. Keeping every night's would bury the handful of rows
  // that record real deletions under thousands that record none — and the
  // erasure log's whole job is being readable years later.
  if (opts.dryRun) await db.from("data_erasures").delete().eq("dry_run", true);

  for (const item of plan.items) {
    if (!opts.dryRun) {
      const failed = await removeFiles(db, item.files);
      if (failed.length) {
        // Leave the rows alone. A half-erased record is recoverable; a row
        // deleted while its file survives is not detectable at all.
        errors.push(
          `${item.subjectType} ${item.subjectId}: ${failed.length} file(s) could not be deleted — records kept`,
        );
        continue;
      }

      const rowError = await removeRows(db, item);
      if (rowError) {
        errors.push(`${item.subjectType} ${item.subjectId}: ${rowError}`);
        continue;
      }
    }

    await db.from("data_erasures").insert({
      category: item.category,
      subject_type: item.subjectType,
      subject_id: item.subjectId,
      subject_label: item.subjectLabel,
      due_date: item.dueDate,
      records_deleted: item.records,
      files_deleted: item.files.length,
      bytes_freed: item.bytes,
      dry_run: opts.dryRun,
    });

    done.push(item);
  }

  return {
    dryRun: opts.dryRun,
    today: plan.today,
    items: done,
    errors,
    totals: {
      records: done.reduce((s, i) => s + i.records, 0),
      files: done.reduce((s, i) => s + i.files.length, 0),
      bytes: done.reduce((s, i) => s + i.bytes, 0),
    },
  };
}

/** Grouped per bucket — the storage API removes many paths at once. */
async function removeFiles(
  db: SupabaseClient,
  files: StorageRef[],
): Promise<StorageRef[]> {
  const byBucket = new Map<string, string[]>();
  for (const f of files) {
    const list = byBucket.get(f.bucket) ?? [];
    list.push(f.path);
    byBucket.set(f.bucket, list);
  }

  const failed: StorageRef[] = [];
  for (const [bucket, paths] of byBucket) {
    const { error } = await db.storage.from(bucket).remove(paths);
    if (error) failed.push(...paths.map((path) => ({ bucket, path })));
  }
  return failed;
}

async function removeRows(
  db: SupabaseClient,
  item: ErasureItem,
): Promise<string | null> {
  switch (item.subjectType) {
    case "document": {
      const { error } = await db
        .from("documents")
        .delete()
        .eq("id", item.subjectId);
      return error?.message ?? null;
    }
    case "tenancy": {
      // Cascades to occupants, documents, rent payments and checklists.
      const { error } = await db
        .from("tenancies")
        .delete()
        .eq("id", item.subjectId);
      return error?.message ?? null;
    }
    case "tenant": {
      const { error } = await db
        .from("tenants")
        .delete()
        .eq("id", item.subjectId);
      return error?.message ?? null;
    }
    case "checklist_photos": {
      const { data: areas } = await db
        .from("checklist_areas")
        .select("id")
        .eq("checklist_id", item.subjectId);
      const areaIds = (areas ?? []).map((a) => a.id);

      if (areaIds.length) {
        const { data: sections } = await db
          .from("checklist_sections")
          .select("id")
          .in("checklist_area_id", areaIds);
        const sectionIds = (sections ?? []).map((s) => s.id);
        if (sectionIds.length) {
          const { error } = await db
            .from("checklist_photos")
            .delete()
            .in("checklist_section_id", sectionIds);
          if (error) return error.message;
        }
      }

      // Marks the report as now being the only copy, so the checklist is
      // not offered up for purging again on every later run.
      const { error } = await db
        .from("checklist_pdf_exports")
        .update({ photos_purged_at: new Date().toISOString() })
        .eq("checklist_id", item.subjectId);
      return error?.message ?? null;
    }
  }
}
