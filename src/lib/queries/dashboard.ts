import { createClient } from "@/lib/supabase/server";
import {
  getDocumentRequirements,
  requiredTypesFor,
  tenantScopedTypes,
} from "@/lib/queries/document-requirements";
import type {
  Property,
  RentPayment,
  Room,
  Tenancy,
  TenantOnTenancy,
  DocumentRecord,
} from "@/lib/types";
import { toDateString } from "@/lib/rent";
import { differenceInCalendarDays, parseISO, startOfDay } from "date-fns";

export interface DashboardRoom extends Room {
  property_name: string;
  tenancy: (Tenancy & { tenants: TenantOnTenancy[] }) | null;
  /** How long this room has sat empty — null when occupied. */
  vacant_days: number | null;
}

export interface DashboardAlert {
  kind: "move_in" | "move_out" | "rent_overdue" | "cleaning";
  tenancyId: string;
  roomName: string;
  personName: string;
  days?: number;
  amount?: number;
  date?: string;
  /**
   * How many payments one overdue card stands for.
   *
   * A tenant seven months behind used to produce seven identical alerts, which
   * is the same fact stated seven times and pushes everything else off the
   * screen. One card, a count, and the total says strictly more in one line.
   */
  count?: number;
}

/**
 * The same metrics as they stood roughly a month ago, from `metrics_snapshots`.
 *
 * Null when the daily job has not been running long enough to have a snapshot
 * that old. That is the honest state for a new install, and the tiles render
 * without a comparison rather than inventing a zero — "no change" and "no
 * history" look identical on a badge and mean opposite things.
 */
export interface DashboardComparison {
  /** Actual age of the baseline snapshot, which is near 30 but rarely exactly. */
  days: number;
  occupancyRate: number;
  vacantRooms: number;
  overdueTotal: number;
}

export interface DashboardData {
  properties: Property[];
  rooms: DashboardRoom[];
  alerts: DashboardAlert[];
  comparison: DashboardComparison | null;
  /** Rent collected per calendar month, oldest first — the hero's trend line. */
  collectionTrend: { month: string; amount: number }[];
  metrics: {
    lettableRooms: number;
    occupiedRooms: number;
    occupancyRate: number;
    vacantRooms: number;
    overdueTotal: number;
    overdueCount: number;
    moveInsThisWeek: number;
    moveOutsThisWeek: number;
    complianceGaps: number;
    /** Paid so far this calendar month. */
    collectedThisMonth: number;
    /** Billed this calendar month, waivers excluded — they are not expected. */
    dueThisMonth: number;
  };
}

const fullName = (t?: TenantOnTenancy) =>
  t ? `${t.first_name} ${t.surname}`.trim() : "—";

/**
 * Everything the dashboard shows, in one pass.
 *
 * Deliberately a handful of broad queries stitched together in memory rather
 * than many round-trips: at ~30 rooms the whole dataset is small, and this
 * keeps the page a single fast render.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const today = startOfDay(new Date());
  const todayStr = toDateString(today);

  // Six complete months plus the current one — enough for the hero's trend to
  // show a shape, short enough that it still describes how things are now.
  const trendStart = new Date(today.getFullYear(), today.getMonth() - 6, 1);
  const trendStartStr = toDateString(trendStart);
  const monthStartStr = toDateString(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const monthEndStr = toDateString(
    new Date(today.getFullYear(), today.getMonth() + 1, 0),
  );
  // Far enough back to hold a ~30-day baseline even with gaps in the job's run.
  const snapshotStartStr = toDateString(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - 120),
  );

  const [
    { data: properties },
    { data: rooms },
    { data: tenancies },
    { data: tenancyTenants },
    { data: payments },
    { data: documents },
    { data: recentPayments },
    { data: snapshots },
    requirements,
  ] = await Promise.all([
    supabase.from("properties").select("*").order("name"),
    supabase.from("rooms").select("*").order("name"),
    supabase
      .from("tenancies")
      .select("*")
      .in("status", ["upcoming", "active", "ended"]),
    supabase
      .from("tenancy_tenants")
      .select("tenancy_id, is_lead_tenant, tenants(*)"),
    supabase.from("rent_payments").select("*").in("status", ["due", "late"]),
    supabase.from("documents").select("*"),
    // Every status, so "collected" and "expected" come from the same rows.
    supabase
      .from("rent_payments")
      .select("status, amount_due, due_date")
      .gte("due_date", trendStartStr),
    supabase
      .from("metrics_snapshots")
      .select("snapshot_date, occupied_rooms, vacant_rooms, overdue_rent_total")
      .gte("snapshot_date", snapshotStartStr)
      .order("snapshot_date", { ascending: true }),
    getDocumentRequirements(supabase),
  ]);

  const propertyById = new Map((properties ?? []).map((p) => [p.id, p]));
  // Flatten the join so each tenancy carries its people with their lead flag.
  const tenantsByTenancy = new Map<string, TenantOnTenancy[]>();
  for (const row of (tenancyTenants ?? []) as unknown as {
    tenancy_id: string;
    is_lead_tenant: boolean;
    tenants: TenantOnTenancy | null;
  }[]) {
    if (!row.tenants) continue;
    const list = tenantsByTenancy.get(row.tenancy_id) ?? [];
    list.push({ ...row.tenants, is_lead_tenant: row.is_lead_tenant });
    tenantsByTenancy.set(row.tenancy_id, list);
  }

  // The tenancy that "owns" a room right now: an active one if present,
  // otherwise the nearest upcoming one so the room shows as spoken for.
  const activeByRoom = new Map<string, Tenancy>();
  const upcomingByRoom = new Map<string, Tenancy>();
  const endedByRoom = new Map<string, Tenancy>();
  for (const t of (tenancies ?? []) as Tenancy[]) {
    if (t.status === "active") activeByRoom.set(t.room_id, t);
    else if (t.status === "upcoming") {
      const existing = upcomingByRoom.get(t.room_id);
      if (!existing || t.start_date < existing.start_date)
        upcomingByRoom.set(t.room_id, t);
    } else if (t.status === "ended") {
      const existing = endedByRoom.get(t.room_id);
      if (!existing || (t.end_date ?? "") > (existing.end_date ?? ""))
        endedByRoom.set(t.room_id, t);
    }
  }

  const dashboardRooms: DashboardRoom[] = ((rooms ?? []) as Room[]).map((r) => {
    const tenancy = activeByRoom.get(r.id) ?? upcomingByRoom.get(r.id) ?? null;
    const lastEnded = endedByRoom.get(r.id);

    let vacantDays: number | null = null;
    if (!activeByRoom.has(r.id) && r.is_lettable && !r.is_common_area) {
      // Measure from the last move-out if there was one, otherwise from when
      // the room was created — a never-let room is still vacant.
      const since = lastEnded?.end_date ?? r.created_at;
      vacantDays = Math.max(0, differenceInCalendarDays(today, parseISO(since)));
    }

    return {
      ...r,
      property_name: propertyById.get(r.property_id)?.name ?? "",
      tenancy: tenancy
        ? { ...tenancy, tenants: tenantsByTenancy.get(tenancy.id) ?? [] }
        : null,
      vacant_days: vacantDays,
    };
  });

  const roomById = new Map(dashboardRooms.map((r) => [r.id, r]));
  const tenancyById = new Map(((tenancies ?? []) as Tenancy[]).map((t) => [t.id, t]));

  // ── Alerts ───────────────────────────────────────────────────────────────
  const alerts: DashboardAlert[] = [];

  for (const t of (tenancies ?? []) as Tenancy[]) {
    const room = roomById.get(t.room_id);
    if (!room) continue;
    const lead =
      tenantsByTenancy.get(t.id)?.find((x) => x.is_lead_tenant) ??
      tenantsByTenancy.get(t.id)?.[0];

    if (t.status === "upcoming") {
      const days = differenceInCalendarDays(parseISO(t.start_date), today);
      if (days >= 0 && days <= 3)
        alerts.push({
          kind: "move_in",
          tenancyId: t.id,
          roomName: room.name,
          personName: fullName(lead),
          days,
        });
    }

    if (t.status === "active" && t.end_date) {
      const days = differenceInCalendarDays(parseISO(t.end_date), today);
      if (days >= 0 && days <= 3)
        alerts.push({
          kind: "move_out",
          tenancyId: t.id,
          roomName: room.name,
          personName: fullName(lead),
          days,
        });
    }

    // Cleaning is prompted once the tenancy has actually ended.
    if (t.status === "ended" && t.end_date) {
      const days = differenceInCalendarDays(today, parseISO(t.end_date));
      if (days >= 0 && days <= 7)
        alerts.push({
          kind: "cleaning",
          tenancyId: t.id,
          roomName: room.name,
          personName: fullName(lead),
          date: t.end_date,
        });
    }
  }

  // Rent alerts fire the day AFTER the due date, so a tenant gets their full
  // due day to pay before anyone is chased.
  const overdue = ((payments ?? []) as RentPayment[]).filter(
    (p) => p.due_date < todayStr,
  );

  /* One card per tenancy, not per payment. Someone seven months behind is one
     problem to deal with, and listing it seven times buried every other kind
     of alert underneath it. The date kept is the oldest, because how long this
     has been running is the part that decides how urgent it is. */
  const overdueByTenancy = new Map<string, DashboardAlert>();
  for (const p of overdue) {
    const t = tenancyById.get(p.tenancy_id);
    const room = t ? roomById.get(t.room_id) : undefined;
    if (!t || !room) continue;

    const existing = overdueByTenancy.get(t.id);
    if (existing) {
      existing.amount = (existing.amount ?? 0) + Number(p.amount_due);
      existing.count = (existing.count ?? 0) + 1;
      if (p.due_date < (existing.date ?? "")) existing.date = p.due_date;
      continue;
    }

    const lead =
      tenantsByTenancy.get(t.id)?.find((x) => x.is_lead_tenant) ??
      tenantsByTenancy.get(t.id)?.[0];
    overdueByTenancy.set(t.id, {
      kind: "rent_overdue",
      tenancyId: t.id,
      roomName: room.name,
      personName: fullName(lead),
      amount: Number(p.amount_due),
      date: p.due_date,
      count: 1,
    });
  }
  // Longest-running arrears first — that is the order you would work through.
  alerts.push(
    ...[...overdueByTenancy.values()].sort((a, b) =>
      (a.date ?? "") < (b.date ?? "") ? -1 : 1,
    ),
  );

  // ── Metrics ──────────────────────────────────────────────────────────────
  const lettable = dashboardRooms.filter((r) => r.is_lettable && !r.is_common_area);
  const occupiedRooms = lettable.filter((r) => activeByRoom.has(r.id)).length;
  const lettableRooms = lettable.length;

  // Documents now live in two places: identity documents on the person,
  // agreements on the letting. A tenancy counts as compliant when the union
  // of both covers what's required — otherwise every tenancy would report a
  // missing right-to-rent that is in fact filed against the tenant.
  const docsByTenancy = new Map<string, Set<string>>();
  const docsByTenant = new Map<string, Set<string>>();
  for (const d of (documents ?? []) as DocumentRecord[]) {
    if (d.tenancy_id) {
      const set = docsByTenancy.get(d.tenancy_id) ?? new Set<string>();
      set.add(d.doc_type);
      docsByTenancy.set(d.tenancy_id, set);
    }
    if (d.tenant_id) {
      const set = docsByTenant.get(d.tenant_id) ?? new Set<string>();
      set.add(d.doc_type);
      docsByTenant.set(d.tenant_id, set);
    }
  }

  // What each kind of letting has to have is data now, so a short stay is not
  // reported as missing a deposit certificate it was never going to need.
  const followsThePerson = tenantScopedTypes(requirements);

  const complianceGaps = ((tenancies ?? []) as Tenancy[]).filter((t) => {
    if (t.status !== "active") return false;

    const required = requiredTypesFor(requirements, t.letting_type);
    const have = new Set(docsByTenancy.get(t.id) ?? []);
    // Every person on the tenancy must have their own identity documents,
    // so an incomplete one leaves the tenancy incomplete.
    const people = tenantsByTenancy.get(t.id) ?? [];
    for (const req of required) {
      if (!followsThePerson.has(req)) continue;
      if (
        people.length > 0 &&
        people.every((p) => docsByTenant.get(p.id)?.has(req))
      ) {
        have.add(req);
      }
    }

    return required.some((req) => !have.has(req));
  }).length;

  const withinWeek = (dateStr: string | null) => {
    if (!dateStr) return false;
    const d = differenceInCalendarDays(parseISO(dateStr), today);
    return d >= 0 && d <= 7;
  };

  // ── Money in ─────────────────────────────────────────────────────────────
  const recent = (recentPayments ?? []) as Pick<
    RentPayment,
    "status" | "amount_due" | "due_date"
  >[];

  const thisMonth = recent.filter(
    (p) => p.due_date >= monthStartStr && p.due_date <= monthEndStr,
  );
  const collectedThisMonth = thisMonth
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount_due), 0);
  // Waived rent was never going to arrive, so counting it as outstanding would
  // make a fully-settled month look permanently short.
  const dueThisMonth = thisMonth
    .filter((p) => p.status !== "waived")
    .reduce((sum, p) => sum + Number(p.amount_due), 0);

  const byMonth = new Map<string, number>();
  for (const p of recent) {
    if (p.status !== "paid") continue;
    const month = p.due_date.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + Number(p.amount_due));
  }
  /* Built from a walk over the months rather than from the map's keys, so a
     month in which nothing at all was collected shows as a zero in the line
     instead of vanishing and quietly shortening the gap between its
     neighbours. */
  const collectionTrend: { month: string; amount: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = toDateString(d).slice(0, 7);
    collectionTrend.push({ month: key, amount: byMonth.get(key) ?? 0 });
  }

  // ── Comparison against roughly a month ago ───────────────────────────────
  const history = (snapshots ?? []) as {
    snapshot_date: string;
    occupied_rooms: number;
    vacant_rooms: number;
    overdue_rent_total: number;
  }[];
  /* The newest snapshot at least 28 days old. Not "the one 30 days ago" — the
     job can miss a night, and demanding an exact date would silently drop the
     comparison whenever it did. */
  const cutoff = toDateString(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - 28),
  );
  const baseline = [...history]
    .reverse()
    .find((s) => s.snapshot_date <= cutoff);

  let comparison: DashboardComparison | null = null;
  if (baseline) {
    // Rooms are counted at the time of the snapshot, so a property bought since
    // then does not distort the rate it is compared against.
    const thenLettable = baseline.occupied_rooms + baseline.vacant_rooms;
    comparison = {
      days: differenceInCalendarDays(
        today,
        parseISO(baseline.snapshot_date),
      ),
      occupancyRate:
        thenLettable === 0
          ? 0
          : Math.round((baseline.occupied_rooms / thenLettable) * 100),
      vacantRooms: baseline.vacant_rooms,
      overdueTotal: Number(baseline.overdue_rent_total),
    };
  }

  return {
    properties: (properties ?? []) as Property[],
    rooms: dashboardRooms,
    alerts,
    comparison,
    collectionTrend,
    metrics: {
      lettableRooms,
      occupiedRooms,
      occupancyRate:
        lettableRooms === 0
          ? 0
          : Math.round((occupiedRooms / lettableRooms) * 100),
      vacantRooms: lettableRooms - occupiedRooms,
      overdueTotal: overdue.reduce((sum, p) => sum + Number(p.amount_due), 0),
      overdueCount: overdue.length,
      moveInsThisWeek: ((tenancies ?? []) as Tenancy[]).filter(
        (t) => t.status === "upcoming" && withinWeek(t.start_date),
      ).length,
      moveOutsThisWeek: ((tenancies ?? []) as Tenancy[]).filter(
        (t) => t.status === "active" && withinWeek(t.end_date),
      ).length,
      complianceGaps,
      collectedThisMonth,
      dueThisMonth,
    },
  };
}
