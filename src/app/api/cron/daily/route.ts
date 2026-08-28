import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { generateDueDates, toDateString } from "@/lib/rent";
import { addDays, differenceInCalendarDays, parseISO, startOfDay } from "date-fns";
import type { RentFrequency, Tenancy } from "@/lib/types";

/**
 * The once-a-day job.
 *
 * Four things, in order:
 *   1. Extend each active tenancy's rent schedule
 *   2. Move tenancies whose dates have arrived into the right status
 *   3. Raise today's alerts, once each
 *   4. Record a metrics snapshot for the trend charts
 *
 * Runs with the service role — there is no session on a cron request — so
 * it authenticates on CRON_SECRET instead. Without that check the URL would
 * be an unauthenticated write endpoint.
 *
 * Scheduled at 07:00 UTC by vercel.json, early enough that the day's alerts
 * are waiting before anyone starts work. (vercel.json is strict JSON and
 * rejects comment keys, so the schedule is explained here instead.)
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** How far ahead rent rows are kept materialised. */
const RENT_HORIZON_MONTHS = 3;

/** Fallback if the setting is missing; the real value comes from app_settings. */
const DEFAULT_MOVE_ALERT_DAYS = 3;

/** Cleaning stays on the list this long after a tenancy ends. */
const CLEANING_WINDOW_DAYS = 7;

function unauthorised() {
  return new NextResponse("Unauthorised", { status: 401 });
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Refuse rather
  // than run unprotected if the secret was never configured.
  if (!secret || auth !== `Bearer ${secret}`) return unauthorised();

  const supabase = createAdminClient();
  const today = startOfDay(new Date());
  const todayStr = toDateString(today);
  const log: Record<string, number> = {};

  const { data: leadTime } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "move_alert_days")
    .maybeSingle();
  const moveAlertDays = Number(leadTime?.value) || DEFAULT_MOVE_ALERT_DAYS;

  // ── 1. Extend rent schedules ─────────────────────────────────────────────
  const { data: tenancies } = await supabase
    .from("tenancies")
    .select("*")
    .in("status", ["upcoming", "active"]);

  const horizon = new Date(today);
  horizon.setMonth(horizon.getMonth() + RENT_HORIZON_MONTHS);

  const newRows: {
    tenancy_id: string;
    due_date: string;
    amount_due: number;
    status: string;
  }[] = [];

  for (const t of (tenancies ?? []) as Tenancy[]) {
    const dates = generateDueDates({
      startDate: t.start_date,
      endDate: t.end_date,
      frequency: t.rent_frequency as RentFrequency,
      rentDueDay: t.rent_due_day,
      horizon,
    });
    for (const due_date of dates) {
      newRows.push({
        tenancy_id: t.id,
        due_date,
        amount_due: t.rent_amount,
        status: "due",
      });
    }
  }

  if (newRows.length) {
    // ignoreDuplicates leans on the (tenancy_id, due_date) unique index, so
    // re-running this tops up missing periods without touching paid ones.
    await supabase
      .from("rent_payments")
      .upsert(newRows, {
        onConflict: "tenancy_id,due_date",
        ignoreDuplicates: true,
      });
    log.rent_rows_considered = newRows.length;
  }

  // ── 2. Advance tenancy statuses ──────────────────────────────────────────
  const startingToday = ((tenancies ?? []) as Tenancy[]).filter(
    (t) => t.status === "upcoming" && t.start_date <= todayStr,
  );
  for (const t of startingToday) {
    await supabase.from("tenancies").update({ status: "active" }).eq("id", t.id);
  }
  log.became_active = startingToday.length;

  const endingToday = ((tenancies ?? []) as Tenancy[]).filter(
    (t) => t.status === "active" && t.end_date && t.end_date < todayStr,
  );
  for (const t of endingToday) {
    await supabase.from("tenancies").update({ status: "ended" }).eq("id", t.id);
  }
  log.became_ended = endingToday.length;

  // ── 3. Raise today's alerts ──────────────────────────────────────────────
  // Written once per (type, date, subject) so reloading the dashboard does
  // not re-raise the same thing; the unique index enforces it.
  const alerts: {
    tenancy_id: string | null;
    rent_payment_id: string | null;
    notification_type: string;
    fired_for_date: string;
  }[] = [];

  for (const t of (tenancies ?? []) as Tenancy[]) {
    if (t.status === "upcoming") {
      const days = differenceInCalendarDays(parseISO(t.start_date), today);
      if (days >= 0 && days <= moveAlertDays)
        alerts.push({
          tenancy_id: t.id,
          rent_payment_id: null,
          notification_type: "move_in",
          fired_for_date: todayStr,
        });
    }
    if (t.status === "active" && t.end_date) {
      const days = differenceInCalendarDays(parseISO(t.end_date), today);
      if (days >= 0 && days <= moveAlertDays)
        alerts.push({
          tenancy_id: t.id,
          rent_payment_id: null,
          notification_type: "move_out",
          fired_for_date: todayStr,
        });
    }
  }

  // Cleaning is prompted after the tenancy has actually ended.
  const { data: recentlyEnded } = await supabase
    .from("tenancies")
    .select("id, end_date")
    .eq("status", "ended")
    .gte("end_date", toDateString(addDays(today, -CLEANING_WINDOW_DAYS)))
    .lte("end_date", todayStr);

  for (const t of recentlyEnded ?? []) {
    alerts.push({
      tenancy_id: t.id,
      rent_payment_id: null,
      notification_type: "cleaning",
      fired_for_date: todayStr,
    });
  }

  // Rent alerts fire the day AFTER the due date — the tenant has had their
  // whole due day to pay before anyone is prompted to chase.
  const { data: overdue } = await supabase
    .from("rent_payments")
    .select("id, tenancy_id, amount_due, due_date")
    .in("status", ["due", "late"])
    .lt("due_date", todayStr);

  for (const p of overdue ?? []) {
    alerts.push({
      tenancy_id: p.tenancy_id,
      rent_payment_id: p.id,
      notification_type: "rent_overdue",
      fired_for_date: todayStr,
    });
  }

  if (alerts.length) {
    await supabase
      .from("notifications_log")
      .upsert(alerts, {
        onConflict: "notification_type,fired_for_date,tenancy_id,rent_payment_id",
        ignoreDuplicates: true,
      });
    log.alerts = alerts.length;
  }

  // ── 4. Snapshot today's metrics ──────────────────────────────────────────
  // A live query can only ever answer "now". Without this row there is no
  // history to draw a trend from.
  const [{ data: rooms }, { data: activeTenancies }] = await Promise.all([
    supabase.from("rooms").select("id, is_lettable, is_common_area"),
    supabase.from("tenancies").select("room_id, rent_amount").eq("status", "active"),
  ]);

  const lettable = (rooms ?? []).filter(
    (r) => r.is_lettable && !r.is_common_area,
  ).length;
  const occupied = new Set((activeTenancies ?? []).map((t) => t.room_id)).size;
  const totalRent = (activeTenancies ?? []).reduce(
    (sum, t) => sum + Number(t.rent_amount),
    0,
  );
  const overdueTotal = (overdue ?? []).reduce(
    (sum, p) => sum + Number(p.amount_due),
    0,
  );

  await supabase.from("metrics_snapshots").upsert(
    {
      snapshot_date: todayStr,
      occupied_rooms: occupied,
      vacant_rooms: Math.max(0, lettable - occupied),
      total_active_rent: totalRent,
      overdue_rent_total: overdueTotal,
    },
    { onConflict: "snapshot_date" },
  );

  return NextResponse.json({ ok: true, date: todayStr, ...log });
}
