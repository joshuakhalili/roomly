import { NextResponse } from "next/server";
import ical, { ICalAlarmType, ICalAlarmRelatesTo } from "ical-generator";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * A personal calendar feed of move-ins, move-outs and rent dates.
 *
 * Subscribed to in the admin's own calendar app, which then delivers the
 * alarms. That is the whole point: it reaches a phone using notification
 * infrastructure people already trust, without building push.
 *
 * Regenerated from live data on every fetch, so an ended tenancy or a
 * changed date is reflected the next time the calendar app polls — rather
 * than a one-time export that goes stale immediately.
 *
 * Authenticated by the unguessable token in the URL, because calendar
 * subscription has no login step. The token is regenerable if it leaks.
 */

export const dynamic = "force-dynamic";

/** Move-in and move-out are worth knowing about several days ahead. */
const MOVE_ALARM_DAYS = [3, 2, 1, 0];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // A short token is certainly not one of ours; don't even query.
  if (!token || token.length < 32) {
    return new NextResponse("Not found", { status: 404 });
  }

  // No session exists on a calendar fetch, so this runs with the service
  // role and the token is the only credential.
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, organization_id")
    .eq("calendar_feed_token", token)
    .maybeSingle();

  if (!profile) return new NextResponse("Not found", { status: 404 });
  const organizationId = profile.organization_id;

  const [{ data: tenancies }, { data: links }, { data: payments }, { data: jobs }] =
    await Promise.all([
      supabase
        .from("tenancies")
        .select("*, rooms(name, properties(name))")
        .eq("organization_id", organizationId)
        .in("status", ["upcoming", "active"]),
      supabase
        .from("tenancy_tenants")
        .select("tenancy_id, is_lead_tenant, tenants(first_name, surname)")
        .eq("organization_id", organizationId),
      supabase
        .from("rent_payments")
        .select("*")
        .eq("organization_id", organizationId)
        .in("status", ["due", "late"]),
      // Booked work only. A job already done is a record, not something to
      // be reminded about, and a cancelled one should disappear from the
      // calendar rather than linger as a ghost.
      supabase
        .from("maintenance_jobs")
        .select(
          "*, properties(name), rooms(name), service_types(name), contacts(name)",
        )
        .eq("organization_id", organizationId)
        .eq("status", "booked"),
    ]);

  const leadByTenancy = new Map<string, string>();
  for (const row of (links ?? []) as unknown as {
    tenancy_id: string;
    is_lead_tenant: boolean;
    tenants: { first_name: string; surname: string } | null;
  }[]) {
    if (!row.tenants) continue;
    if (!leadByTenancy.has(row.tenancy_id) || row.is_lead_tenant) {
      leadByTenancy.set(
        row.tenancy_id,
        `${row.tenants.first_name} ${row.tenants.surname}`,
      );
    }
  }

  const calendar = ical({
    name: "Roomly",
    description: "Move-ins, move-outs, rent dates and scheduled work",
    // Tells subscribers how often to re-poll. Nothing here is urgent to
    // the minute, so hourly is plenty.
    ttl: 60 * 60,
  });

  const asDate = (d: string) => new Date(`${d}T09:00:00`);

  for (const tenancy of (tenancies ?? []) as unknown as {
    id: string;
    status: string;
    start_date: string;
    end_date: string | null;
    rooms: { name: string; properties: { name: string } | null } | null;
  }[]) {
    const room = tenancy.rooms?.name ?? "";
    const property = tenancy.rooms?.properties?.name ?? "";
    const who = leadByTenancy.get(tenancy.id) ?? "";

    if (tenancy.status === "upcoming") {
      const event = calendar.createEvent({
        start: asDate(tenancy.start_date),
        allDay: true,
        summary: `Move in: ${who} — ${room}`,
        description: property,
        id: `movein-${tenancy.id}`,
      });
      for (const days of MOVE_ALARM_DAYS) {
        event.createAlarm({
          type: ICalAlarmType.display,
          triggerBefore: days * 24 * 60 * 60,
        });
      }
    }

    if (tenancy.end_date) {
      const event = calendar.createEvent({
        start: asDate(tenancy.end_date),
        allDay: true,
        summary: `Move out: ${who} — ${room}`,
        description: property,
        id: `moveout-${tenancy.id}`,
      });
      for (const days of MOVE_ALARM_DAYS) {
        event.createAlarm({
          type: ICalAlarmType.display,
          triggerBefore: days * 24 * 60 * 60,
        });
      }
    }
  }

  const tenancyById = new Map(
    ((tenancies ?? []) as unknown as { id: string }[]).map((x) => [x.id, x]),
  );

  for (const payment of (payments ?? []) as unknown as {
    id: string;
    tenancy_id: string;
    due_date: string;
    amount_due: number;
  }[]) {
    const tenancy = tenancyById.get(payment.tenancy_id) as
      | { rooms?: { name: string } | null }
      | undefined;
    const room = tenancy?.rooms?.name ?? "";
    const who = leadByTenancy.get(payment.tenancy_id) ?? "";

    const event = calendar.createEvent({
      start: asDate(payment.due_date),
      allDay: true,
      summary: `Rent due: ${who} — ${room} (£${Number(payment.amount_due).toFixed(2)})`,
      id: `rent-${payment.id}`,
    });

    // Fires the day AFTER the due date: the tenant gets their whole due day
    // to pay, and this prompts a check on whether they did — not an early
    // chase, which is the intrusiveness this design avoids.
    //
    // relatesTo START matters. An all-day event's END is the following day,
    // so the default (relative to END) would land two days after the due
    // date rather than one.
    // relatesTo has to be set on the returned alarm: ical-generator does
    // not read it from the constructor options. Without it the trigger is
    // relative to the event's END, and an all-day event ends the following
    // day — so the reminder would land two days after the rent was due.
    const alarm = event.createAlarm({
      type: ICalAlarmType.display,
      triggerAfter: 24 * 60 * 60,
    });
    alarm.relatesTo(ICalAlarmRelatesTo.start);
  }

  // ── Scheduled work ───────────────────────────────────────────────────────
  // Unlike the others these can carry a real time: a gas engineer gives you
  // a slot, a gardener gives you a day. A timed event gets a sensible hour
  // in the calendar; a dateless one stays all-day.
  for (const job of (jobs ?? []) as unknown as {
    id: string;
    title: string;
    scheduled_for: string;
    scheduled_time: string | null;
    description: string | null;
    properties: { name: string } | null;
    rooms: { name: string } | null;
    service_types: { name: string } | null;
    contacts: { name: string } | null;
  }[]) {
    const where = [job.properties?.name, job.rooms?.name]
      .filter(Boolean)
      .join(" · ");
    const timed = Boolean(job.scheduled_time);

    const event = calendar.createEvent({
      start: timed
        ? new Date(`${job.scheduled_for}T${job.scheduled_time}`)
        : asDate(job.scheduled_for),
      allDay: !timed,
      summary: job.contacts?.name
        ? `${job.title} — ${job.contacts.name}`
        : job.title,
      description: [where, job.service_types?.name, job.description]
        .filter(Boolean)
        .join("\n"),
      location: where || undefined,
      id: `job-${job.id}`,
    });

    // One day's warning. Enough to move it or unlock a door; not so much
    // that a weekly clean nags all week.
    const alarm = event.createAlarm({
      type: ICalAlarmType.display,
      triggerBefore: 24 * 60 * 60,
    });
    alarm.relatesTo(ICalAlarmRelatesTo.start);
  }

  return new NextResponse(calendar.toString(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="roomly.ics"',
      // Never cached by an intermediary: the feed is per-admin and private.
      "Cache-Control": "no-store, private",
    },
  });
}
