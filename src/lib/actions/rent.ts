"use server";

import { revalidatePath } from "next/cache";
import {
  requireAdmin,
  friendlyError,
  optionalText,
  type ActionResult,
} from "./helpers";
import type { RentPaymentStatus } from "@/lib/types";

/**
 * Marks a rent payment paid, late, waived, or back to due.
 *
 * `paid_at` is set only when actually paid and cleared otherwise, so
 * "last paid" can never be derived from a payment that was later undone.
 */
export async function setRentStatus(
  paymentId: string,
  status: RentPaymentStatus,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("rent_payments")
    .update({
      status,
      paid_at: status === "paid" ? new Date().toISOString() : null,
    })
    .eq("id", paymentId);

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function setRentNote(
  paymentId: string,
  note: string | null,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("rent_payments")
    .update({ notes: note })
    .eq("id", paymentId);

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/** Records a one-off payment outside the generated schedule. */
export async function addManualPayment(
  tenancyId: string,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const dueDate = optionalText(formData.get("due_date"));
  const amount = Number(formData.get("amount_due") ?? 0);
  if (!dueDate) return { ok: false, error: "A date is required." };
  if (!Number.isFinite(amount) || amount <= 0)
    return { ok: false, error: "An amount is required." };

  const { error } = await auth.supabase.from("rent_payments").insert({
    tenancy_id: tenancyId,
    due_date: dueDate,
    amount_due: amount,
    status: "due",
    notes: optionalText(formData.get("notes")),
  });

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
