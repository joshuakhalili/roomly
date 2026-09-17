"use server";

import { revalidatePath } from "next/cache";
import { parseISO } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requireAdmin,
  friendlyError,
  optionalText,
  optionalNumber,
  oneOf,
  type ActionResult,
} from "./helpers";
import { buildRentRows, type RentSchedulable } from "@/lib/rent";
import type {
  RentFrequency,
  TenancyStatus,
  LeavingReason,
  LettingType,
} from "@/lib/types";

/** How far ahead rent rows are created up front. The daily job extends this. */
const INITIAL_RENT_HORIZON_MONTHS = 3;
const LETTING_TYPES = ["long_term", "short_stay"] as const;
const RENT_FREQUENCIES = [
  "weekly",
  "fortnightly",
  "four_weekly",
  "monthly",
  "total",
] as const;
const TENANCY_STATUSES = ["upcoming", "active", "ended", "archived"] as const;
const LEAVING_REASONS = [
  "end_of_term",
  "tenant_gave_notice",
  "given_notice_by_admin",
  "other",
] as const;

/**
 * Tenants are chosen from existing profiles rather than typed in again.
 * The form submits their ids plus which one leads the tenancy.
 */
function parseTenantIds(formData: FormData): {
  ids: string[];
  leadId: string | null;
} {
  const ids = [...new Set(formData
    .getAll("tenant_ids")
    .map((v) => String(v))
    .filter(Boolean))].slice(0, 20);
  const leadId = optionalText(formData.get("lead_tenant_id"));
  return { ids, leadId };
}

function tenancyFields(formData: FormData) {
  const startDate = optionalText(formData.get("start_date"));
  const lettingType: LettingType =
    oneOf(optionalText(formData.get("letting_type")), LETTING_TYPES) ??
    "long_term";

  /* A short stay is priced as one total, whatever the form last had selected
     in the frequency dropdown. Deriving it here rather than trusting the
     submitted value means the two fields can never disagree in the database. */
  const frequency: RentFrequency =
    lettingType === "short_stay"
      ? "total"
      : (oneOf(
          optionalText(formData.get("rent_frequency")),
          RENT_FREQUENCIES,
        ) ?? "monthly");

  // Default the rent day to the move-in day — the common case, and it means
  // one less field for the admin to fill in correctly.
  const explicitDueDay = optionalNumber(formData.get("rent_due_day"));
  const rentDueDay =
    explicitDueDay ?? (startDate ? parseISO(startDate).getDate() : null);

  return {
    letting_type: lettingType,
    start_date: startDate,
    end_date: optionalText(formData.get("end_date")),
    status:
      oneOf(optionalText(formData.get("status")), TENANCY_STATUSES) ??
      "upcoming",
    rent_amount: optionalNumber(formData.get("rent_amount")),
    rent_frequency: frequency,
    rent_due_day: frequency === "monthly" ? rentDueDay : null,
    // Only a short stay has a balance to fall due; on a long tenancy the
    // field would sit there contradicting rent_due_day.
    balance_due_date:
      lettingType === "short_stay"
        ? optionalText(formData.get("balance_due_date"))
        : null,
    bills_included: formData.get("bills_included") === "on",
    deposit_amount: optionalNumber(formData.get("deposit_amount")),
    deposit_scheme_name: optionalText(formData.get("deposit_scheme_name")),
    deposit_scheme_ref: optionalText(formData.get("deposit_scheme_ref")),
    bank_account_id: optionalText(formData.get("bank_account_id")),
    notes: optionalText(formData.get("notes")),
  };
}

/**
 * What both create and update insist on.
 *
 * A checkout date is optional on a tenancy that runs until someone gives
 * notice, but a booking without one is not a booking — and the status job
 * would never end it, so the room would stay occupied forever.
 */
function validateTenancy(
  fields: ReturnType<typeof tenancyFields>,
): string | null {
  if (!fields.start_date) return "A move-in date is required.";
  if (fields.rent_amount === null) return "A rent amount is required.";
  if (fields.letting_type === "short_stay" && !fields.end_date)
    return "A checkout date is required for a short stay.";
  if (
    fields.end_date &&
    fields.start_date &&
    fields.end_date < fields.start_date
  )
    return "The end date cannot be before the start date.";
  return null;
}

/**
 * Writes a tenancy's rent rows up to the horizon.
 *
 * The schedule itself is worked out by buildRentRows, which the nightly cron
 * also uses — this is only the part that touches the database. Idempotent:
 * the (tenancy_id, due_date) unique constraint means re-running after an edit
 * tops up missing periods instead of duplicating them.
 */
async function generateRentRows(
  supabase: SupabaseClient,
  tenancy: RentSchedulable,
) {
  const horizon = new Date();
  horizon.setMonth(horizon.getMonth() + INITIAL_RENT_HORIZON_MONTHS);

  const rows = buildRentRows(tenancy, horizon);
  if (rows.length === 0) return;

  await supabase
    .from("rent_payments")
    .upsert(rows, { onConflict: "tenancy_id,due_date", ignoreDuplicates: true });
}

export async function createTenancy(
  roomId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const fields = tenancyFields(formData);
  const invalid = validateTenancy(fields);
  if (invalid) return { ok: false, error: invalid };

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
  const invalid = validateTenancy(fields);
  if (invalid) return { ok: false, error: invalid };

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

  const reason: LeavingReason | null = oneOf(
    optionalText(formData.get("reason_for_leaving")),
    LEAVING_REASONS,
  );

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
  if (!TENANCY_STATUSES.includes(status))
    return { ok: false, error: "Choose a valid tenancy status." };

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
