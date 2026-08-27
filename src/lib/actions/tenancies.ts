"use server";

import { revalidatePath } from "next/cache";
import { parseISO } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requireAdmin,
  friendlyError,
  optionalText,
  optionalNumber,
  type ActionResult,
} from "./helpers";
import { generateDueDates } from "@/lib/rent";
import type { RentFrequency, TenancyStatus, LeavingReason } from "@/lib/types";

/** How far ahead rent rows are created up front. The daily job extends this. */
const INITIAL_RENT_HORIZON_MONTHS = 3;

/**
 * Tenants are chosen from existing profiles rather than typed in again.
 * The form submits their ids plus which one leads the tenancy.
 */
function parseTenantIds(formData: FormData): {
  ids: string[];
  leadId: string | null;
} {
  const ids = formData
    .getAll("tenant_ids")
    .map((v) => String(v))
    .filter(Boolean);
  const leadId = optionalText(formData.get("lead_tenant_id"));
  return { ids, leadId };
}

function tenancyFields(formData: FormData) {
  const startDate = optionalText(formData.get("start_date"));
  const frequency = (optionalText(formData.get("rent_frequency")) ??
    "monthly") as RentFrequency;

  // Default the rent day to the move-in day — the common case, and it means
  // one less field for the admin to fill in correctly.
  const explicitDueDay = optionalNumber(formData.get("rent_due_day"));
  const rentDueDay =
    explicitDueDay ?? (startDate ? parseISO(startDate).getDate() : null);

  return {
    start_date: startDate,
    end_date: optionalText(formData.get("end_date")),
    status: (optionalText(formData.get("status")) ?? "upcoming") as TenancyStatus,
    rent_amount: optionalNumber(formData.get("rent_amount")),
    rent_frequency: frequency,
    rent_due_day: frequency === "monthly" ? rentDueDay : null,
    deposit_amount: optionalNumber(formData.get("deposit_amount")),
    deposit_scheme_name: optionalText(formData.get("deposit_scheme_name")),
    deposit_scheme_ref: optionalText(formData.get("deposit_scheme_ref")),
    bank_account_id: optionalText(formData.get("bank_account_id")),
    notes: optionalText(formData.get("notes")),
  };
}

/**
 * Creates the rent rows for a tenancy up to the horizon.
 * Idempotent: the (tenancy_id, due_date) unique constraint means re-running
 * this after an edit tops up missing periods instead of duplicating them.
 */
async function generateRentRows(
  supabase: SupabaseClient,
  tenancy: {
    id: string;
    start_date: string;
    end_date: string | null;
    rent_frequency: RentFrequency;
    rent_due_day: number | null;
    rent_amount: number;
  },
) {
  const horizon = new Date();
  horizon.setMonth(horizon.getMonth() + INITIAL_RENT_HORIZON_MONTHS);

  const dueDates = generateDueDates({
    startDate: tenancy.start_date,
    endDate: tenancy.end_date,
    frequency: tenancy.rent_frequency,
    rentDueDay: tenancy.rent_due_day,
    horizon,
  });

  if (dueDates.length === 0) return;

  await supabase.from("rent_payments").upsert(
    dueDates.map((due_date) => ({
      tenancy_id: tenancy.id,
      due_date,
      amount_due: tenancy.rent_amount,
      status: "due",
    })),
    { onConflict: "tenancy_id,due_date", ignoreDuplicates: true },
  );
}

export async function createTenancy(
  roomId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const fields = tenancyFields(formData);
  if (!fields.start_date)
    return { ok: false, error: "A move-in date is required." };
  if (fields.rent_amount === null)
    return { ok: false, error: "A rent amount is required." };

  const { ids, leadId } = parseTenantIds(formData);
  if (ids.length === 0)
    return { ok: false, error: "Choose at least one tenant." };

  const { data: tenancy, error } = await auth.supabase
    .from("tenancies")
    .insert({ ...fields, room_id: roomId, rent_amount: fields.rent_amount })
    .select("*")
    .single();

  if (error) return { ok: false, error: friendlyError(error) };

  const lead = leadId && ids.includes(leadId) ? leadId : ids[0];
  const { error: linkError } = await auth.supabase.from("tenancy_tenants").insert(
    ids.map((tenant_id) => ({
      tenancy_id: tenancy.id,
      tenant_id,
      is_lead_tenant: tenant_id === lead,
    })),
  );

  if (linkError) {
    // Don't leave a tenancy with nobody in it.
    await auth.supabase.from("tenancies").delete().eq("id", tenancy.id);
    return { ok: false, error: friendlyError(linkError) };
  }

  await generateRentRows(auth.supabase, tenancy);

  revalidatePath("/", "layout");
  return { ok: true, data: { id: tenancy.id } };
}

export async function updateTenancy(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const fields = tenancyFields(formData);
  if (!fields.start_date)
    return { ok: false, error: "A move-in date is required." };
  if (fields.rent_amount === null)
    return { ok: false, error: "A rent amount is required." };

  const { data: tenancy, error } = await auth.supabase
    .from("tenancies")
    .update({ ...fields, rent_amount: fields.rent_amount })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return { ok: false, error: friendlyError(error) };

  // Dates or amounts may have changed — top up any newly-needed rent rows.
  await generateRentRows(auth.supabase, tenancy);

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/**
 * Ends a tenancy and frees the room. Keeps the record and its documents —
 * the retention job deletes those later, not this.
 */
export async function archiveTenancy(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const reason = optionalText(formData.get("reason_for_leaving")) as
    | LeavingReason
    | null;

  const { error } = await auth.supabase
    .from("tenancies")
    .update({
      status: "archived",
      archived_at: new Date().toISOString(),
      reason_for_leaving: reason,
      reason_notes: optionalText(formData.get("reason_notes")),
      end_date: optionalText(formData.get("end_date")),
    })
    .eq("id", id);

  if (error) return { ok: false, error: friendlyError(error) };

  await auth.supabase.from("archive_log").insert({
    tenancy_id: id,
    action: "archived",
    actor: auth.userId,
    details: reason,
  });

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/** Moves a tenancy between upcoming / active / ended. */
export async function setTenancyStatus(
  id: string,
  status: TenancyStatus,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("tenancies")
    .update({ status })
    .eq("id", id);

  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function deleteTenancy(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase.from("tenancies").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
