"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, friendlyError, optionalText, type ActionResult } from "./helpers";
import { createAdminClient } from "@/lib/supabase/server";
import { planRetention, runRetention } from "@/lib/retention";

/**
 * Puts a tenancy beyond the reach of the retention job, or releases it.
 *
 * The reason is required going on. A hold with no explanation is
 * indistinguishable from one somebody set by accident, and since it stops
 * data being erased on time it needs to be defensible — an indefinite hold
 * is itself a retention breach.
 */
export async function setLegalHold(
  tenancyId: string,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const hold = formData.get("legal_hold") === "on";
  const reason = optionalText(formData.get("legal_hold_reason"));

  if (hold && !reason)
    return { ok: false, error: "Give a reason for the hold." };

  const { error } = await auth.supabase
    .from("tenancies")
    .update({ legal_hold: hold, legal_hold_reason: hold ? reason : null })
    .eq("id", tenancyId);

  if (error) return { ok: false, error: friendlyError(error) };

  await auth.supabase.from("archive_log").insert({
    tenancy_id: tenancyId,
    action: hold ? "legal_hold_placed" : "legal_hold_lifted",
    actor: auth.userId,
    details: reason,
  });

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/**
 * Recalculates the preview.
 *
 * Runs the same planner the live job runs, with deletion switched off — the
 * point of the page is to show the actual plan, not an approximation of it.
 */
export async function refreshRetentionPreview(): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  // The service-role client, because the job it is previewing runs as that.
  // A preview taken under different permissions could quietly miss rows the
  // real run would delete, which is exactly the assurance gap to avoid.
  await runRetention(createAdminClient(), { dryRun: true });

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/**
 * Arms or disarms automatic erasure.
 *
 * Off until somebody turns it on, and turning it on is a deliberate act
 * recorded in the archive log.
 */
export async function setRetentionEnabled(
  enabled: boolean,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("app_settings")
    .update({ value: enabled ? "true" : "false" })
    .eq("key", "retention_enabled");

  if (error) return { ok: false, error: friendlyError(error) };

  await auth.supabase.from("archive_log").insert({
    tenancy_id: null,
    action: enabled ? "retention_enabled" : "retention_disabled",
    actor: auth.userId,
  });

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/** Read-only: what the job would do if it ran right now. */
export async function getRetentionPlan() {
  const auth = await requireAdmin();
  if (!auth.ok) return null;
  return planRetention(createAdminClient());
}
