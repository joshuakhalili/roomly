"use server";

import { revalidatePath } from "next/cache";
import {
  requireAdmin,
  friendlyError,
  optionalText,
  optionalNumber,
  normalisePhone,
  type ActionResult,
} from "./helpers";
import type { JobStatus, RecurrenceFrequency } from "@/lib/types";

// ── Jobs ───────────────────────────────────────────────────────────────────

function jobFields(formData: FormData) {
  return {
    property_id: optionalText(formData.get("property_id")),
    // Empty means the whole building. Grounds work is never per-room, so
    // this can never be required.
    room_id: optionalText(formData.get("room_id")),
    service_type_id: optionalText(formData.get("service_type_id")),
    contact_id: optionalText(formData.get("contact_id")),
    title: optionalText(formData.get("title")),
    description: optionalText(formData.get("description")),
    scheduled_for: optionalText(formData.get("scheduled_for")),
    scheduled_time: optionalText(formData.get("scheduled_time")),
    cost: optionalNumber(formData.get("cost")),
    notes: optionalText(formData.get("notes")),
  };
}

export async function saveJob(
  id: string | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const fields = jobFields(formData);
  if (!fields.property_id) return { ok: false, error: "Choose a property." };
  if (!fields.title) return { ok: false, error: "Give the job a title." };
  if (!fields.scheduled_for) return { ok: false, error: "Choose a date." };

  const query = id
    ? auth.supabase.from("maintenance_jobs").update(fields).eq("id", id)
    : auth.supabase.from("maintenance_jobs").insert({
        ...fields,
        checklist_section_id: optionalText(formData.get("checklist_section_id")),
        asset_id: optionalText(formData.get("asset_id")),
      });

  const { data, error } = await query.select("id").single();
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id } };
}

/**
 * Marking a job done also clears the defect it was raised against.
 *
 * That link is the point of connecting the two: a Summary of Defects that
 * still lists something you paid to fix last month is worse than no list,
 * because it teaches you to stop trusting it.
 */
export async function setJobStatus(
  id: string,
  status: JobStatus,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { data: job } = await auth.supabase
    .from("maintenance_jobs")
    .select("checklist_section_id")
    .eq("id", id)
    .single();

  const { error } = await auth.supabase
    .from("maintenance_jobs")
    .update({
      status,
      completed_on:
        status === "done" ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: friendlyError(error) };

  if (status === "done" && job?.checklist_section_id) {
    await auth.supabase
      .from("checklist_sections")
      .update({ flagged_for_maintenance: false })
      .eq("id", job.checklist_section_id);
  }

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/**
 * Payment is tracked separately from completion on purpose.
 *
 * The work being finished and the invoice being settled are different facts —
 * a cleaner who bills monthly does four jobs before one payment — and keeping
 * them apart is what turns this into real expense tracking rather than a
 * to-do list.
 */
export async function setJobPaid(
  id: string,
  paid: boolean,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("maintenance_jobs")
    .update({
      is_paid: paid,
      paid_on: paid ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function deleteJob(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const { error } = await auth.supabase
    .from("maintenance_jobs")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

// ── Recurrences ────────────────────────────────────────────────────────────

export async function saveRecurrence(
  id: string | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const frequency = optionalText(formData.get("frequency")) as
    | RecurrenceFrequency
    | null;
  const propertyId = optionalText(formData.get("property_id"));
  const title = optionalText(formData.get("title"));
  const startsOn = optionalText(formData.get("starts_on"));

  if (!propertyId) return { ok: false, error: "Choose a property." };
  if (!title) return { ok: false, error: "Give the arrangement a title." };
  if (!startsOn) return { ok: false, error: "Choose a start date." };
  if (!frequency) return { ok: false, error: "Choose how often it repeats." };

  const fields = {
    property_id: propertyId,
    room_id: optionalText(formData.get("room_id")),
    service_type_id: optionalText(formData.get("service_type_id")),
    contact_id: optionalText(formData.get("contact_id")),
    title,
    frequency,
    day_of_week:
      frequency === "monthly" ? null : optionalNumber(formData.get("day_of_week")),
    day_of_month:
      frequency === "monthly" ? optionalNumber(formData.get("day_of_month")) : null,
    cost: optionalNumber(formData.get("cost")),
    starts_on: startsOn,
    // Mainly for grounds work, which stops over winter. Without an end date
    // you spend every February cancelling jobs you never wanted.
    ends_on: optionalText(formData.get("ends_on")),
    is_active: formData.get("is_active") !== "off",
  };

  const query = id
    ? auth.supabase.from("job_recurrences").update(fields).eq("id", id)
    : auth.supabase.from("job_recurrences").insert(fields);

  const { data, error } = await query.select("id").single();
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id } };
}

/**
 * Stops an arrangement and clears the jobs it created that have not happened.
 *
 * Past ones stay: they were done and possibly paid for, and deleting them
 * would silently rewrite the property's spend history.
 */
export async function endRecurrence(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const today = new Date().toISOString().slice(0, 10);

  const { error } = await auth.supabase
    .from("job_recurrences")
    .update({ is_active: false, ends_on: today })
    .eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };

  await auth.supabase
    .from("maintenance_jobs")
    .delete()
    .eq("recurrence_id", id)
    .eq("status", "booked")
    .gt("scheduled_for", today);

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

// ── Contacts ───────────────────────────────────────────────────────────────

export async function saveContact(
  id: string | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const name = optionalText(formData.get("name"));
  if (!name) return { ok: false, error: "A name is required." };

  const fields = {
    name,
    company: optionalText(formData.get("company")),
    service_type_id: optionalText(formData.get("service_type_id")),
    // Same normalisation as tenants: wa.me silently fails on anything that
    // isn't E.164, so "07700 900000" would produce a dead button.
    phone: normalisePhone(optionalText(formData.get("phone"))),
    email: optionalText(formData.get("email")),
    usual_property_id: optionalText(formData.get("usual_property_id")),
    notes: optionalText(formData.get("notes")),
  };

  const query = id
    ? auth.supabase.from("contacts").update(fields).eq("id", id)
    : auth.supabase.from("contacts").insert(fields);

  const { data, error } = await query.select("id").single();
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id } };
}

/**
 * Archives rather than deletes.
 *
 * Jobs point at contacts, and those jobs are the record of what a property
 * cost. Deleting the contact would null the link and lose "who did this".
 */
export async function archiveContact(
  id: string,
  archived = true,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const { error } = await auth.supabase
    .from("contacts")
    .update({ is_archived: archived })
    .eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

// ── Assets ─────────────────────────────────────────────────────────────────

export async function saveAsset(
  id: string | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const propertyId = optionalText(formData.get("property_id"));
  const name = optionalText(formData.get("name"));
  if (!propertyId) return { ok: false, error: "Choose a property." };
  if (!name) return { ok: false, error: "Name the item." };

  const fields = {
    property_id: propertyId,
    room_id: optionalText(formData.get("room_id")),
    name,
    make_model: optionalText(formData.get("make_model")),
    serial_number: optionalText(formData.get("serial_number")),
    purchased_on: optionalText(formData.get("purchased_on")),
    cost: optionalNumber(formData.get("cost")),
    supplier_name: optionalText(formData.get("supplier_name")),
    warranty_expires_on: optionalText(formData.get("warranty_expires_on")),
    notes: optionalText(formData.get("notes")),
  };

  const query = id
    ? auth.supabase.from("assets").update(fields).eq("id", id)
    : auth.supabase.from("assets").insert(fields);

  const { data, error } = await query.select("id").single();
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id } };
}

/**
 * Marks an item as gone without erasing it.
 *
 * The money was spent and belongs in the property's history whether or not
 * the washing machine is still there.
 */
export async function disposeAsset(
  id: string,
  disposed = true,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const { error } = await auth.supabase
    .from("assets")
    .update({ is_disposed: disposed })
    .eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

// ── Service types ──────────────────────────────────────────────────────────

export async function addServiceType(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const name = optionalText(formData.get("name"));
  if (!name) return { ok: false, error: "Name the service." };

  const { data, error } = await auth.supabase
    .from("service_types")
    // No slug: slugs identify the seeded rows that code and translations
    // refer to. A custom one shows exactly the text that was typed.
    .insert({ name, sort_order: 99 })
    .select("id")
    .single();

  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id } };
}

export async function archiveServiceType(
  id: string,
  archived = true,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const { error } = await auth.supabase
    .from("service_types")
    .update({ is_archived: archived })
    .eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
