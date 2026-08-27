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
 * Creates a checklist and scaffolds it from the templates.
 *
 * The scaffold is a copy, not a live reference: editing the templates later
 * must not alter a report that has already been signed. Areas come from the
 * unit type (a studio gets its main room and a bathroom; a flat gets the
 * full set), and each area is filled with its own section list.
 */
export async function createChecklist(
  tenancyId: string,
  type: ChecklistType,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { data: tenancy } = await auth.supabase
    .from("tenancies")
    .select("id, rooms(id, unit_type)")
    .eq("id", tenancyId)
    .single();

  const unitType =
    (tenancy?.rooms as unknown as { unit_type: string } | null)?.unit_type ??
    "studio";

  const { data: checklist, error } = await auth.supabase
    .from("inventory_checklists")
    .insert({ tenancy_id: tenancyId, type, status: "draft" })
    .select("id")
    .single();

  if (error) return { ok: false, error: friendlyError(error) };

  const { data: defaults } = await auth.supabase
    .from("unit_area_defaults")
    .select("area_type_id, sort_order, area_types(id, name)")
    .eq("unit_type", unitType)
    .order("sort_order");

  for (const [index, def] of (defaults ?? []).entries()) {
    const areaType = def.area_types as unknown as { id: string; name: string };
    if (!areaType) continue;

    const { data: area } = await auth.supabase
      .from("checklist_areas")
      .insert({
        checklist_id: checklist.id,
        area_type_id: areaType.id,
        name: areaType.name,
        sort_order: index + 1,
      })
      .select("id")
      .single();

    if (!area) continue;

    const { data: templates } = await auth.supabase
      .from("checklist_section_templates")
      .select("id, section_name, sort_order")
      .eq("area_type_id", areaType.id)
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

/** Saves meters, keys and detectors — the report-level records. */
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
    reading_date: optionalText(formData.get("reading_date")),
    location: optionalText(formData.get("location")),
    serial_number: optionalText(formData.get("serial_number")),
  });

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
