"use server";

import { revalidatePath } from "next/cache";
import {
  requireAdmin,
  friendlyError,
  optionalText,
  normalisePhone,
  type ActionResult,
} from "./helpers";
import { toAppLanguage } from "@/lib/types";

function tenantFields(formData: FormData) {
  return {
    first_name: optionalText(formData.get("first_name")),
    surname: optionalText(formData.get("surname")),
    email: optionalText(formData.get("email")),
    phone: normalisePhone(optionalText(formData.get("phone"))),
    wechat_id: optionalText(formData.get("wechat_id")),
    country_of_origin: optionalText(formData.get("country_of_origin")),
    preferred_language: toAppLanguage(formData.get("preferred_language")),
    notes: optionalText(formData.get("notes")),
  };
}

export async function createTenant(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const fields = tenantFields(formData);
  if (!fields.first_name || !fields.surname)
    return { ok: false, error: "A first name and surname are required." };

  const { data, error } = await auth.supabase
    .from("tenants")
    .insert({ ...fields, first_name: fields.first_name, surname: fields.surname })
    .select("id")
    .single();

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id } };
}

export async function updateTenant(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const fields = tenantFields(formData);
  if (!fields.first_name || !fields.surname)
    return { ok: false, error: "A first name and surname are required." };

  const { error } = await auth.supabase
    .from("tenants")
    .update(fields)
    .eq("id", id);

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/**
 * Hides a tenant from the assignment picker without deleting them.
 *
 * Deleting would take their tenancy history with it, which is exactly the
 * record you want to keep after someone moves out.
 */
export async function setTenantArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("tenants")
    .update({ is_archived: archived })
    .eq("id", id);

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function deleteTenant(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase.from("tenants").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/** Replaces who is on a tenancy, and which of them leads it. */
export async function setTenancyTenants(
  tenancyId: string,
  tenantIds: string[],
  leadTenantId: string | null,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (tenantIds.length === 0)
    return { ok: false, error: "Choose at least one tenant." };

  const { error: clearError } = await auth.supabase
    .from("tenancy_tenants")
    .delete()
    .eq("tenancy_id", tenancyId);
  if (clearError) return { ok: false, error: friendlyError(clearError) };

  // Always exactly one lead, so "who do I contact" is never ambiguous.
  const lead = leadTenantId && tenantIds.includes(leadTenantId)
    ? leadTenantId
    : tenantIds[0];

  const { error } = await auth.supabase.from("tenancy_tenants").insert(
    tenantIds.map((tenant_id) => ({
      tenancy_id: tenancyId,
      tenant_id,
      is_lead_tenant: tenant_id === lead,
    })),
  );

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
