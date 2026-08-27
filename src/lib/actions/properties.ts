"use server";

import { revalidatePath } from "next/cache";
import {
  requireAdmin,
  friendlyError,
  optionalText,
  type ActionResult,
} from "./helpers";

export async function createProperty(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const name = optionalText(formData.get("name"));
  if (!name) return { ok: false, error: "A property name is required." };

  const { data, error } = await auth.supabase
    .from("properties")
    .insert({
      name,
      address: optionalText(formData.get("address")),
      notes: optionalText(formData.get("notes")),
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id } };
}

export async function updateProperty(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const name = optionalText(formData.get("name"));
  if (!name) return { ok: false, error: "A property name is required." };

  const { error } = await auth.supabase
    .from("properties")
    .update({
      name,
      address: optionalText(formData.get("address")),
      notes: optionalText(formData.get("notes")),
    })
    .eq("id", id);

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/**
 * Deleting a property cascades to its rooms, tenancies, occupants and
 * documents. The UI warns about this before calling it.
 */
export async function deleteProperty(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase.from("properties").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
