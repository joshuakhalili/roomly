import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { buildRentRows, toDateString, type RentRow } from "@/lib/rent";
import { generateJobDates } from "@/lib/jobs";
import { addDays, differenceInCalendarDays, parseISO, startOfDay } from "date-fns";
import type { JobRecurrence, Tenancy } from "@/lib/types";

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
  // Anything that failed, returned rather than hidden — a cron whose only
  // output is a success message cannot be trusted to have done anything.
  const errors: string[] = [];

  const [{ data: organizations }, { data: settingsRows }] = await Promise.all([
    supabase.from("organizations").select("id"),
    supabase.from("app_settings").select("organization_id, key, value"),
  ]);
  const setting = (organizationId: string, key: string, fallback: string) =>
    settingsRows?.find(
      (row) => row.organization_id === organizationId && row.key === key,
    )?.value ?? fallback;

  // ── 1. Extend rent schedules ─────────────────────────────────────────────
  const { data: tenancies } = await supabase
    .from("tenancies")
    .select("*")
    .in("status", ["upcoming", "active"]);

  const horizon = new Date(today);
  horizon.setMonth(horizon.getMonth() + RENT_HORIZON_MONTHS);

  const newRows: RentRow[] = [];

  for (const t of (tenancies ?? []) as Tenancy[]) {
    /* A short stay's charges are written once, when the booking is made.
       There is no rolling horizon to extend — re-running it nightly would
       upsert the same two rows forever for no benefit. */
    if (t.rent_frequency === "total") continue;
    newRows.push(
      ...buildRentRows(t, horizon).map((row) => ({
        ...row,
        organization_id: (t as Tenancy & { organization_id: string })
          .organization_id,
      })),
    );
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
    organization_id: string;
    tenancy_id: string | null;
    rent_payment_id: string | null;
    notification_type: string;
    fired_for_date: string;
  }[] = [];

  for (const t of (tenancies ?? []) as Tenancy[]) {
    const organizationId = (t as Tenancy & { organization_id: string })
      .organization_id;
    const moveAlertDays =
      Number(setting(organizationId, "move_alert_days", "")) ||
      DEFAULT_MOVE_ALERT_DAYS;
    if (t.status === "upcoming") {
      const days = differenceInCalendarDays(parseISO(t.start_date), today);
      if (days >= 0 && days <= moveAlertDays)
        alerts.push({
          organization_id: organizationId,
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
          organization_id: organizationId,
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
    .select("id, end_date, organization_id")
    .eq("status", "ended")
    .gte("end_date", toDateString(addDays(today, -CLEANING_WINDOW_DAYS)))
    .lte("end_date", todayStr);

  for (const t of recentlyEnded ?? []) {
    alerts.push({
      organization_id: t.organization_id,
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
    .select("id, tenancy_id, amount_due, due_date, organization_id")
    .in("status", ["due", "late"])
    .lt("due_date", todayStr);

  for (const p of overdue ?? []) {
    alerts.push({
      organization_id: p.organization_id,
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

  // ── 3b. Maintenance ──────────────────────────────────────────────────────
  // Recurring arrangements are materialised into real rows the same way rent
  // is, and for the same reason: a job you can see on a calendar, assign, and
  // mark paid has to exist as a row. Computing it live would leave nothing to
  // edit and no way to record what it cost.
  const { data: recurrences } = await supabase
    .from("job_recurrences")
    .select("*")
    .eq("is_active", true);

  const newJobs: Record<string, unknown>[] = [];
  for (const r of (recurrences ?? []) as (JobRecurrence & {
    organization_id: string;
  })[]) {
    const jobHorizon = new Date(today);
    jobHorizon.setMonth(
      jobHorizon.getMonth() +
        Number(setting(r.organization_id, "job_horizon_months", "3")),
    );
    const dates = generateJobDates({
      startsOn: r.starts_on,
      endsOn: r.ends_on,
      frequency: r.frequency,
      dayOfWeek: r.day_of_week,
      dayOfMonth: r.day_of_month,
      horizon: jobHorizon,
      from: today,
    });
    for (const scheduled_for of dates) {
      newJobs.push({
        organization_id: r.organization_id,
        property_id: r.property_id,
        room_id: r.room_id,
        service_type_id: r.service_type_id,
        contact_id: r.contact_id,
        title: r.title,
        scheduled_for,
        cost: r.cost,
        source: "recurring",
        recurrence_id: r.id,
      });
    }
  }

  if (newJobs.length) {
    // Errors are surfaced, not swallowed. The first version ignored them and
    // reported seventeen jobs "considered" while silently creating none —
    // a failing write that looked exactly like a successful one.
    const { error } = await supabase.from("maintenance_jobs").upsert(newJobs, {
      onConflict: "recurrence_id,scheduled_for",
      ignoreDuplicates: true,
    });
    if (error) errors.push(`recurring jobs: ${error.message}`);
    log.jobs_considered = newJobs.length;
  }

  // The turnaround clean. This is the one the cleaning alert was gesturing at
  // and never delivered: in practice cleans are not scheduled, they are
  // caused by somebody moving out. A partial unique index keeps it to one per
  // tenancy however many times this runs.
  if (recentlyEnded?.length) {
    // Checked rather than upserted: the one-per-tenancy index has to stay
    // partial (a plain unique on tenancy_id would stop a manual job ever
    // referencing a tenancy), and ON CONFLICT cannot arbitrate on a partial
    // index through PostgREST.
    const { data: existing } = await supabase
      .from("maintenance_jobs")
      .select("tenancy_id")
      .eq("source", "tenancy_end")
      .in("tenancy_id", recentlyEnded.map((t) => t.id));
    const alreadyBooked = new Set(
      (existing ?? []).map((r) => r.tenancy_id as string),
    );

    const turnarounds: Record<string, unknown>[] = [];
    for (const t of recentlyEnded) {
      const turnaroundDays = Number(
        setting(t.organization_id, "turnaround_clean_days", "2"),
      );
      if (turnaroundDays <= 0) continue;
      if (!t.end_date || alreadyBooked.has(t.id)) continue;

      const { data: cleaning } = await supabase
        .from("service_types")
        .select("id")
        .eq("organization_id", t.organization_id)
        .eq("slug", "cleaning")
        .maybeSingle();

      const { data: tenancy } = await supabase
        .from("tenancies")
        .select("room_id, rooms(property_id, name)")
        .eq("id", t.id)
        .single();
      const room = tenancy?.rooms as unknown as
        | { property_id: string; name: string }
        | null;
      if (!room) continue;

      // Prefill whoever last cleaned this building — the usual answer, and
      // still changeable before it happens.
      const { data: lastCleaner } = await supabase
        .from("maintenance_jobs")
        .select("contact_id")
        .eq("property_id", room.property_id)
        .eq("service_type_id", cleaning?.id ?? "")
        .not("contact_id", "is", null)
        .order("scheduled_for", { ascending: false })
        .limit(1)
        .maybeSingle();

      turnarounds.push({
        organization_id: t.organization_id,
        property_id: room.property_id,
        room_id: tenancy?.room_id ?? null,
        service_type_id: cleaning?.id ?? null,
        contact_id: lastCleaner?.contact_id ?? null,
        title: `Turnaround clean — ${room.name}`,
        scheduled_for: toDateString(
          addDays(parseISO(t.end_date), turnaroundDays),
        ),
        source: "tenancy_end",
        tenancy_id: t.id,
      });
    }

    if (turnarounds.length) {
      const { error } = await supabase
        .from("maintenance_jobs")
        .insert(turnarounds);
      if (error) errors.push(`turnaround cleans: ${error.message}`);
      else log.turnaround_cleans = turnarounds.length;
    }
  }

  // ── 4. Snapshot today's metrics ──────────────────────────────────────────
  // A live query can only ever answer "now". Without this row there is no
  // history to draw a trend from.
  const [{ data: rooms }, { data: activeTenancies }] = await Promise.all([
    supabase.from("rooms").select("id, is_lettable, is_common_area, organization_id"),
    supabase.from("tenancies").select("room_id, rent_amount, organization_id").eq("status", "active"),
  ]);

  for (const organization of organizations ?? []) {
    const orgRooms = (rooms ?? []).filter(
      (room) => room.organization_id === organization.id,
    );
    const orgTenancies = (activeTenancies ?? []).filter(
      (tenancy) => tenancy.organization_id === organization.id,
    );
    const lettable = orgRooms.filter(
      (room) => room.is_lettable && !room.is_common_area,
    ).length;
    const occupied = new Set(orgTenancies.map((tenancy) => tenancy.room_id)).size;
    const totalRent = orgTenancies.reduce(
      (sum, tenancy) => sum + Number(tenancy.rent_amount),
      0,
    );
    const overdueTotal = (overdue ?? [])
      .filter((payment) => payment.organization_id === organization.id)
      .reduce((sum, payment) => sum + Number(payment.amount_due), 0);

    await supabase.from("metrics_snapshots").upsert(
      {
        organization_id: organization.id,
        snapshot_date: todayStr,
        occupied_rooms: occupied,
        vacant_rooms: Math.max(0, lettable - occupied),
        total_active_rent: totalRent,
        overdue_rent_total: overdueTotal,
      },
      { onConflict: "organization_id,snapshot_date" },
    );
  }

  return NextResponse.json({
    ok: errors.length === 0,
    date: todayStr,
    ...log,
    ...(errors.length ? { errors } : {}),
  });
}
