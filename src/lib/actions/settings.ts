"use server";

import { revalidatePath } from "next/cache";
import {
  requireAdmin,
  friendlyError,
  optionalText,
  type ActionResult,
} from "./helpers";
import { toAppLanguage } from "@/lib/types";

/** Your own name and how you want the app to talk to you. */
export async function updateOwnProfile(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("profiles")
    .update({
      display_name: optionalText(formData.get("display_name")),
      preferred_language: toAppLanguage(formData.get("preferred_language")),
      email_digest_opt_in: formData.get("email_digest_opt_in") === "on",
    })
    .eq("id", auth.userId);

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/**
 * Changes your own password.
 *
 * Deliberately separate from the Admins screen, which sets a password for
 * someone else using the service-role key. This one goes through the signed-in
 * session, so it can only ever change the password of whoever is asking.
 */
export async function changeOwnPassword(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const password = optionalText(formData.get("password"));
  const confirm = optionalText(formData.get("confirm_password"));

  if (!password || password.length < 8)
    return { ok: false, error: "Use at least 8 characters." };
  if (password !== confirm)
    return { ok: false, error: "The two passwords do not match." };

  const { error } = await auth.supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };

  return { ok: true, data: undefined };
}

/**
 * The operational settings that were previously only reachable by editing
 * the database by hand.
 *
 * Each is validated against a range here rather than trusted from the form:
 * these feed jobs that delete things, and a purge window of zero days would
 * mean photos vanish the moment a report is generated.
 */
const NUMERIC_LIMITS: Record<string, { min: number; max: number }> = {
  photo_purge_days: { min: 1, max: 3650 },
  move_alert_days: { min: 1, max: 30 },
};

export async function updateAppSettings(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const updates: { key: string; value: string }[] = [];

  for (const [key, limits] of Object.entries(NUMERIC_LIMITS)) {
    const raw = formData.get(key);
    if (raw === null) continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < limits.min || n > limits.max)
      return {
        ok: false,
        error: `${key.replace(/_/g, " ")} must be a whole number between ${limits.min} and ${limits.max}.`,
      };
    updates.push({ key, value: String(n) });
  }

  // Unchecked boxes are absent from FormData entirely, so a hidden companion
  // field marks that the checkbox was on the form at all. Without it, "off"
  // is indistinguishable from "not submitted".
  if (formData.get("purge_photos_on_tenancy_end_present") === "1") {
    updates.push({
      key: "purge_photos_on_tenancy_end",
      value: formData.get("purge_photos_on_tenancy_end") === "on" ? "true" : "false",
    });
  }

  for (const { key, value } of updates) {
    const { error } = await auth.supabase
      .from("app_settings")
      .update({ value })
      .eq("key", key);
    if (error) return { ok: false, error: friendlyError(error) };
  }

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
