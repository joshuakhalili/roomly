import { createClient } from "@/lib/supabase/server";
import { REQUIRED_DOCUMENT_TYPES } from "@/lib/types";
import type {
  Occupant,
  Property,
  RentPayment,
  Room,
  Tenancy,
  DocumentRecord,
} from "@/lib/types";
import { toDateString } from "@/lib/rent";
import { differenceInCalendarDays, parseISO, startOfDay } from "date-fns";

export interface DashboardRoom extends Room {
  property_name: string;
  tenancy: (Tenancy & { occupants: Occupant[] }) | null;
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
}

export interface DashboardData {
  properties: Property[];
  rooms: DashboardRoom[];
  alerts: DashboardAlert[];
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
  };
}

const fullName = (o?: Occupant) =>
  o ? `${o.first_name} ${o.surname}`.trim() : "—";

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

  const [
    { data: properties },
    { data: rooms },
    { data: tenancies },
    { data: occupants },
    { data: payments },
    { data: documents },
  ] = await Promise.all([
    supabase.from("properties").select("*").order("name"),
    supabase.from("rooms").select("*").order("name"),
    supabase
      .from("tenancies")
      .select("*")
      .in("status", ["upcoming", "active", "ended"]),
    supabase.from("occupants").select("*"),
    supabase.from("rent_payments").select("*").in("status", ["due", "late"]),
    supabase.from("documents").select("*"),
  ]);

  const propertyById = new Map((properties ?? []).map((p) => [p.id, p]));
  const occupantsByTenancy = new Map<string, Occupant[]>();
  for (const o of (occupants ?? []) as Occupant[]) {
    const list = occupantsByTenancy.get(o.tenancy_id) ?? [];
    list.push(o);
    occupantsByTenancy.set(o.tenancy_id, list);
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
        ? { ...tenancy, occupants: occupantsByTenancy.get(tenancy.id) ?? [] }
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
      occupantsByTenancy.get(t.id)?.find((o) => o.is_lead_tenant) ??
      occupantsByTenancy.get(t.id)?.[0];

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
  for (const p of overdue) {
    const t = tenancyById.get(p.tenancy_id);
    const room = t ? roomById.get(t.room_id) : undefined;
    if (!t || !room) continue;
    const lead =
      occupantsByTenancy.get(t.id)?.find((o) => o.is_lead_tenant) ??
      occupantsByTenancy.get(t.id)?.[0];
    alerts.push({
      kind: "rent_overdue",
      tenancyId: t.id,
      roomName: room.name,
      personName: fullName(lead),
      amount: Number(p.amount_due),
      date: p.due_date,
    });
  }

  // ── Metrics ──────────────────────────────────────────────────────────────
  const lettable = dashboardRooms.filter((r) => r.is_lettable && !r.is_common_area);
  const occupiedRooms = lettable.filter((r) => activeByRoom.has(r.id)).length;
  const lettableRooms = lettable.length;

  const docsByTenancy = new Map<string, Set<string>>();
  for (const d of (documents ?? []) as DocumentRecord[]) {
    const set = docsByTenancy.get(d.tenancy_id) ?? new Set<string>();
    set.add(d.doc_type);
    docsByTenancy.set(d.tenancy_id, set);
  }
  const complianceGaps = ((tenancies ?? []) as Tenancy[]).filter((t) => {
    if (t.status !== "active") return false;
    const have = docsByTenancy.get(t.id) ?? new Set<string>();
    return REQUIRED_DOCUMENT_TYPES.some((req) => !have.has(req));
  }).length;

  const withinWeek = (dateStr: string | null) => {
    if (!dateStr) return false;
    const d = differenceInCalendarDays(parseISO(dateStr), today);
    return d >= 0 && d <= 7;
  };

  return {
    properties: (properties ?? []) as Property[],
    rooms: dashboardRooms,
    alerts,
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
    },
  };
}
