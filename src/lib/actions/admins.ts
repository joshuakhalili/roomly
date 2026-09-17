"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import {
  requireMember,
  requireOrganizationManager,
  friendlyError,
  optionalText,
  type ActionResult,
} from "./helpers";

/**
 * Creates another admin.
 *
 * Account creation uses the service role, but the caller's organisation and
 * permission level are established first with the normal RLS client.
 */
export async function createAdmin(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireOrganizationManager();
  if (!auth.ok) return auth;

  const email = optionalText(formData.get("email"), 254)?.toLowerCase() ?? null;
  const passwordValue = formData.get("password");
  const password = typeof passwordValue === "string" ? passwordValue : null;
  const displayName = optionalText(formData.get("display_name"), 200);
  const requestedRole = optionalText(formData.get("role"));
  const role = requestedRole === "admin" || requestedRole === "viewer"
    ? requestedRole
    : "staff";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false, error: "A valid email is required." };
  if (!password || password.length < 12 || password.length > 128)
    return { ok: false, error: "Use a password between 12 and 128 characters." };
  if (auth.role === "admin" && role === "admin")
    return { ok: false, error: "Only an owner can create another admin." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: displayName ?? email,
      organization_id: auth.organizationId,
      organization_role: role,
    },
  });

  if (error) return { ok: false, error: "Could not create that account." };
  if (!data.user) return { ok: false, error: "Could not create that account." };

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    email,
    display_name: displayName ?? email,
    organization_id: auth.organizationId,
    role,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: "Could not create that account." };
  }

  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.user.id } };
}

/**
 * Issues a fresh calendar token, invalidating the old feed.
 *
 * The token in the URL is the only thing protecting that feed — calendar
 * subscription has no login step — so it needs to be revocable.
 */
export async function regenerateCalendarToken(): Promise<
  ActionResult<{ token: string }>
> {
  const auth = await requireMember();
  if (!auth.ok) return auth;

  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { error } = await auth.supabase
    .from("profiles")
    .update({ calendar_feed_token: token })
    .eq("id", auth.userId);

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: { token } };
}

export async function setEmailDigest(
  optIn: boolean,
): Promise<ActionResult> {
  const auth = await requireMember();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("profiles")
    .update({ email_digest_opt_in: optIn })
    .eq("id", auth.userId);

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
