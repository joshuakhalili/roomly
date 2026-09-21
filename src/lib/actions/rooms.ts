"use server";

import { revalidatePath } from "next/cache";
import {
  requireAdmin,
  friendlyError,
  optionalText,
  type ActionResult,
} from "./helpers";

function roomFields(formData: FormData) {
  const isCommonArea = formData.get("is_common_area") === "on";
  return {
    name: optionalText(formData.get("name")),
    // What a tenant rents. Kitchens and bathrooms are areas within a unit,
    // not units themselves, so they aren't options here.
    unit_type:
      formData.get("unit_type") === "flat"
        ? "flat"
        : formData.get("unit_type") === "studio"
          ? "studio"
          : "room",
    is_common_area: isCommonArea,
    // A shared kitchen can't be let on its own, so the two flags are linked
    // rather than independently settable — one less way to create a room
    // that shows as available but can never be occupied.
    // An unchecked box is absent from the form data entirely, so this tests
    // for presence rather than for a "false" value that never arrives.
    is_lettable: isCommonArea ? false : formData.get("is_lettable") === "on",
    notes: optionalText(formData.get("notes")),
  };
}

export async function createRoom(
  propertyId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const fields = roomFields(formData);
  if (!fields.name) return { ok: false, error: "A room name is required." };

  const { data, error } = await auth.supabase
    .from("rooms")
    .insert({
      ...fields,
      property_id: propertyId,
      organization_id: auth.organizationId,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id } };
}

export async function updateRoom(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const fields = roomFields(formData);
  if (!fields.name) return { ok: false, error: "A room name is required." };

  const { error } = await auth.supabase.from("rooms").update(fields).eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function deleteRoom(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase.from("rooms").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
