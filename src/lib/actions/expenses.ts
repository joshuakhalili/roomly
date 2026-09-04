"use server";

import { revalidatePath } from "next/cache";
import {
  requireAdmin,
  friendlyError,
  optionalText,
  optionalNumber,
  type ActionResult,
} from "./helpers";

// ── Expenses ───────────────────────────────────────────────────────────────

/**
 * Create or update one piece of spend.
 *
 * Allocation is deliberately loose: property, room and tenancy are all
 * optional and none of them is required to save. An expense with none set is
 * a business cost that belongs to no building, which is a real thing —
 * forcing a property onto it would mean picking one arbitrarily and then
 * reading a wrong per-property total back out later.
 */
export async function saveExpense(
  id: string | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const description = optionalText(formData.get("description"));
  const amount = optionalNumber(formData.get("amount"));
  const spentOn = optionalText(formData.get("spent_on"));

  if (!description) return { ok: false, error: "Say what it was for." };
  if (amount === null) return { ok: false, error: "An amount is required." };
  if (!spentOn) return { ok: false, error: "A date is required." };

  const roomId = optionalText(formData.get("room_id"));
  const propertyId = optionalText(formData.get("property_id"));

  const fields = {
    // A room already tells you the building, so a room without a property is
    // a form that lost half its answer rather than a valid allocation.
    property_id: propertyId,
    room_id: propertyId ? roomId : null,
    tenancy_id: optionalText(formData.get("tenancy_id")),
    category_id: optionalText(formData.get("category_id")),
    description,
    amount,
    spent_on: spentOn,
    supplier_name: optionalText(formData.get("supplier_name")),
    is_recharged: formData.get("is_recharged") === "on",
    notes: optionalText(formData.get("notes")),
  };

  const query = id
    ? auth.supabase.from("expenses").update(fields).eq("id", id)
    : auth.supabase.from("expenses").insert(fields);

  const { data, error } = await query.select("id").single();
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id } };
}

/**
 * Deletes an expense outright rather than archiving it.
 *
 * Unlike a contact or an asset, nothing points at an expense — there is no
 * history that would lose its meaning. A receipt filed against it goes too,
 * by cascade, which is what someone deleting a mistaken entry expects.
 */
export async function deleteExpense(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  // The receipt's file has to go before the row that points at it, or the
  // object survives with nothing referencing it.
  const { data: docs } = await auth.supabase
    .from("documents")
    .select("storage_path")
    .eq("expense_id", id);

  for (const doc of docs ?? []) {
    const stored = doc.storage_path as string | null;
    if (!stored) continue;
    const i = stored.indexOf("/");
    if (i <= 0) continue;
    await auth.supabase.storage
      .from(stored.slice(0, i))
      .remove([stored.slice(i + 1)]);
  }

  const { error } = await auth.supabase.from("expenses").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

// ── Categories ─────────────────────────────────────────────────────────────

export async function saveExpenseCategory(
  id: string | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const name = optionalText(formData.get("name"));
  if (!name) return { ok: false, error: "A name is required." };

  const fields = {
    name,
    sort_order: optionalNumber(formData.get("sort_order")) ?? 0,
  };

  const query = id
    ? auth.supabase.from("expense_categories").update(fields).eq("id", id)
    : auth.supabase.from("expense_categories").insert(fields);

  const { data, error } = await query.select("id").single();
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id } };
}

/** Archived rather than deleted: past expenses still point at the category. */
export async function archiveExpenseCategory(
  id: string,
  archived = true,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("expense_categories")
    .update({ is_archived: archived })
    .eq("id", id);

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

// ── Utility bills ──────────────────────────────────────────────────────────

export async function saveUtilityBill(
  id: string | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const propertyId = optionalText(formData.get("property_id"));
  const amount = optionalNumber(formData.get("amount"));
  const periodStart = optionalText(formData.get("period_start"));
  const periodEnd = optionalText(formData.get("period_end"));

  if (!propertyId) return { ok: false, error: "Choose a property." };
  if (amount === null) return { ok: false, error: "An amount is required." };
  if (!periodStart || !periodEnd)
    return { ok: false, error: "The period this bill covers is required." };
  /* Checked here as well as in the database. The constraint is what makes it
     impossible; this is what makes it explainable — a check violation reaches
     the admin as a Postgres error nobody can act on. */
  if (periodEnd < periodStart)
    return { ok: false, error: "The period ends before it starts." };

  const fields = {
    property_id: propertyId,
    meter_type: optionalText(formData.get("meter_type")) ?? "electricity",
    period_start: periodStart,
    period_end: periodEnd,
    amount,
    supplier_name: optionalText(formData.get("supplier_name")),
    notes: optionalText(formData.get("notes")),
  };

  const query = id
    ? auth.supabase.from("utility_bills").update(fields).eq("id", id)
    : auth.supabase.from("utility_bills").insert(fields);

  const { data, error } = await query.select("id").single();
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id } };
}

export async function deleteUtilityBill(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("utility_bills")
    .delete()
    .eq("id", id);

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
