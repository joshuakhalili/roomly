"use server";

import { revalidatePath } from "next/cache";
import {
  requireAdmin,
  friendlyError,
  optionalText,
  type ActionResult,
} from "./helpers";
import type { ChecklistType, ConditionRating } from "@/lib/types";

const PHOTO_BUCKET = "inventory-photos";
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 600; // long enough to work through a whole area

/**
 * Creates a tenancy's check-in or check-out.
 *
 * Seeded from the room's own baseline inventory where one exists, so the
 * admin starts from the room's known condition rather than an empty form.
 * Ratings and notes carry across; photographs deliberately do not — a
 * check-in needs pictures of the condition on that day, and duplicating
 * hundreds of images per tenancy would exhaust storage. The baseline's
 * photos remain viewable alongside as the reference.
 *
 * Falls back to a blank scaffold if the room has no baseline yet.
 */
export async function createChecklist(
  tenancyId: string,
  type: ChecklistType,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { data: tenancy } = await auth.supabase
    .from("tenancies")
    .select("id, room_id, rooms(id, unit_type)")
    .eq("id", tenancyId)
    .single();

  if (!tenancy) return { ok: false, error: "Tenancy not found." };

  const { data: checklist, error } = await auth.supabase
    .from("inventory_checklists")
    .insert({ tenancy_id: tenancyId, type, status: "draft" })
    .select("id")
    .single();

  if (error) return { ok: false, error: friendlyError(error) };

  const { data: seeded } = await auth.supabase.rpc(
    "seed_checklist_from_baseline",
    { p_checklist_id: checklist.id, p_room_id: tenancy.room_id },
  );

  if (!seeded) {
    const unitType =
      (tenancy.rooms as unknown as { unit_type: string } | null)?.unit_type ??
      "studio";
    await auth.supabase.rpc("scaffold_checklist", {
      p_checklist_id: checklist.id,
      p_unit_type: unitType,
    });
  }

  revalidatePath("/", "layout");
  return { ok: true, data: { id: checklist.id } };
}

/** Saves the ratings and notes for one section. */
export async function updateSection(
  sectionId: string,
  values: {
    condition_rating?: ConditionRating | null;
    cleanliness_rating?: ConditionRating | null;
    description?: string | null;
    flagged_for_maintenance?: boolean;
  },
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("checklist_sections")
    .update(values)
    .eq("id", sectionId);

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/** Adds an area to a checklist, e.g. a second bedroom in a flat. */
export async function addArea(
  checklistId: string,
  areaTypeId: string,
  name: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { count } = await auth.supabase
    .from("checklist_areas")
    .select("id", { count: "exact", head: true })
    .eq("checklist_id", checklistId);

  const { data: area, error } = await auth.supabase
    .from("checklist_areas")
    .insert({
      checklist_id: checklistId,
      area_type_id: areaTypeId,
      name,
      sort_order: (count ?? 0) + 1,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: friendlyError(error) };

  const { data: templates } = await auth.supabase
    .from("checklist_section_templates")
    .select("id, section_name, sort_order")
    .eq("area_type_id", areaTypeId)
    .order("sort_order");

  if (templates?.length) {
    await auth.supabase.from("checklist_sections").insert(
      templates.map((tpl) => ({
        checklist_area_id: area.id,
        section_template_id: tpl.id,
        section_name: tpl.section_name,
        sort_order: tpl.sort_order,
      })),
    );
  }

  revalidatePath("/", "layout");
  return { ok: true, data: { id: area.id } };
}

export async function deleteArea(areaId: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("checklist_areas")
    .delete()
    .eq("id", areaId);
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/** Adds a one-off section to an area without touching the shared template. */
export async function addSection(
  areaId: string,
  sectionName: string,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { count } = await auth.supabase
    .from("checklist_sections")
    .select("id", { count: "exact", head: true })
    .eq("checklist_area_id", areaId);

  const { error } = await auth.supabase.from("checklist_sections").insert({
    checklist_area_id: areaId,
    section_name: sectionName,
    sort_order: (count ?? 0) + 1,
    // Flagged so it's visible that this one was added for this room
    // specifically rather than inherited from the template.
    is_custom: true,
  });

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function deleteSection(sectionId: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("checklist_sections")
    .delete()
    .eq("id", sectionId);
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/**
 * Uploads one photo against a section.
 *
 * `taken_at` is sent by the client from the file's own lastModified date, so
 * a photo shot in the morning and uploaded that evening still carries the
 * time it was actually taken — which is the whole point of a dated record.
 */
export async function uploadPhoto(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const sectionId = optionalText(formData.get("section_id"));
  const file = formData.get("file");
  const takenAt = optionalText(formData.get("taken_at"));

  if (!sectionId) return { ok: false, error: "Missing section." };
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "No photo provided." };
  if (file.size > MAX_PHOTO_BYTES)
    return { ok: false, error: "That photo is larger than 12MB." };

  const safeName = file.name.replace(/[^\w.\-]/g, "_").slice(-100);
  const path = `${sectionId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await auth.supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type || undefined });

  if (uploadError) return { ok: false, error: uploadError.message };

  const { count } = await auth.supabase
    .from("checklist_photos")
    .select("id", { count: "exact", head: true })
    .eq("checklist_section_id", sectionId);

  const { data, error } = await auth.supabase
    .from("checklist_photos")
    .insert({
      checklist_section_id: sectionId,
      storage_path: `${PHOTO_BUCKET}/${path}`,
      taken_at: takenAt ?? new Date().toISOString(),
      file_size: file.size,
      sort_order: (count ?? 0) + 1,
    })
    .select("id")
    .single();

  if (error) {
    await auth.supabase.storage.from(PHOTO_BUCKET).remove([path]);
    return { ok: false, error: friendlyError(error) };
  }

  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id } };
}

export async function deletePhoto(photoId: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { data: photo } = await auth.supabase
    .from("checklist_photos")
    .select("storage_path")
    .eq("id", photoId)
    .single();

  const { error } = await auth.supabase
    .from("checklist_photos")
    .delete()
    .eq("id", photoId);
  if (error) return { ok: false, error: friendlyError(error) };

  if (photo?.storage_path) {
    const [bucket, ...rest] = photo.storage_path.split("/");
    await auth.supabase.storage.from(bucket).remove([rest.join("/")]);
  }

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/** Signs every photo in one batch — a section can hold dozens. */
export async function getPhotoUrls(
  paths: string[],
): Promise<ActionResult<Record<string, string>>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (paths.length === 0) return { ok: true, data: {} };

  const keys = paths.map((p) => p.split("/").slice(1).join("/"));
  const { data, error } = await auth.supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(keys, SIGNED_URL_TTL_SECONDS);

  if (error) return { ok: false, error: error.message };

  const map: Record<string, string> = {};
  data?.forEach((entry, i) => {
    if (entry.signedUrl) map[paths[i]] = entry.signedUrl;
  });
  return { ok: true, data: map };
}

/** Records a typed-name signature on the report. */
export async function signChecklist(
  checklistId: string,
  role: "assessor" | "tenant",
  typedName: string,
  email: string | null,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!typedName.trim()) return { ok: false, error: "A name is required." };

  const { error } = await auth.supabase.from("checklist_declarations").insert({
    checklist_id: checklistId,
    role,
    typed_name: typedName.trim(),
    email,
  });

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function completeChecklist(
  checklistId: string,
  assessorName: string | null,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("inventory_checklists")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      assessor_name: assessorName,
    })
    .eq("id", checklistId);

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

// ── Report-level records: meters, keys, detectors ──────────────────────────
// These belong to the report as a whole rather than to any one area, exactly
// as they appear in a professional Schedule of Condition.

export async function saveMeterReading(
  checklistId: string,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase.from("checklist_meters").insert({
    checklist_id: checklistId,
    meter_type: optionalText(formData.get("meter_type")),
    reading: optionalText(formData.get("reading")),
    reading_date:
      optionalText(formData.get("reading_date")) ??
      new Date().toISOString().slice(0, 10),
    location: optionalText(formData.get("location")),
    serial_number: optionalText(formData.get("serial_number")),
  });

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function saveKey(
  checklistId: string,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const description = optionalText(formData.get("description"));
  if (!description) return { ok: false, error: "A description is required." };

  const { error } = await auth.supabase.from("checklist_keys").insert({
    checklist_id: checklistId,
    description,
    quantity: Number(formData.get("quantity") ?? 1) || 1,
    comments: optionalText(formData.get("comments")),
  });

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function saveDetector(
  checklistId: string,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase.from("checklist_detectors").insert({
    checklist_id: checklistId,
    detector_type: optionalText(formData.get("detector_type")),
    location: optionalText(formData.get("location")),
    tested: formData.get("tested") === "on",
    comments: optionalText(formData.get("comments")),
  });

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/** One delete for all three, since they behave identically. */
export async function deleteReportRecord(
  table: "checklist_meters" | "checklist_keys" | "checklist_detectors",
  id: string,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase.from(table).delete().eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/**
 * Records that a PDF was generated, and where it was stored.
 *
 * This row is the precondition for ever purging the original photos: the
 * compact PDF has to exist as the permanent record before the source images
 * can safely go.
 */
export async function recordPdfExport(
  checklistId: string,
  formData: FormData,
): Promise<ActionResult<{ path: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "No PDF provided." };

  const path = `${checklistId}/${Date.now()}-report.pdf`;
  const { error: uploadError } = await auth.supabase.storage
    .from("checklist-pdfs")
    .upload(path, file, { contentType: "application/pdf", upsert: true });

  if (uploadError) return { ok: false, error: uploadError.message };

  const { error } = await auth.supabase.from("checklist_pdf_exports").insert({
    checklist_id: checklistId,
    storage_path: `checklist-pdfs/${path}`,
    file_size: file.size,
  });

  if (error) {
    await auth.supabase.storage.from("checklist-pdfs").remove([path]);
    return { ok: false, error: friendlyError(error) };
  }

  revalidatePath("/", "layout");
  return { ok: true, data: { path } };
}
