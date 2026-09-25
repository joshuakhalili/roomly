import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { byName } from "@/lib/utils";
import type { DocumentType, Property, Tenancy } from "@/lib/types";

/**
 * Everything a letting business can be fined for forgetting, on one screen.
 *
 * Two kinds of deadline. Building certificates expire on a fixed cycle and
 * belong to the property. Deposits run on a clock that starts at move-in: the
 * money has to be protected, and the prescribed information served, within 30
 * days (Housing Act 2004 s.213). Both are derived from records the app
 * already keeps, so nothing here needs its own data entry.
 */

/** The certificates every let building is checked for, in column order. */
export const COMPLIANCE_CERTIFICATES: DocumentType[] = [
  "gas_safety",
  "eicr",
  "epc",
  "fire_safety",
];

/** How far ahead "due soon" looks. Long enough to book an engineer. */
export const DUE_SOON_DAYS = 60;
export const DEPOSIT_DEADLINE_DAYS = 30;

export type CertificateState = "ok" | "dueSoon" | "expired" | "missing";

export interface CertificateCell {
  type: DocumentType;
  state: CertificateState;
  expiresAt: string | null;
  /** Negative once expired. */
  daysLeft: number | null;
}

export interface PropertyCompliance {
  property: Pick<Property, "id" | "name" | "address">;
  certificates: CertificateCell[];
}

export type DepositIssue = "unprotected" | "noPrescribedInfo";

export interface DepositRow {
  tenancyId: string;
  roomName: string;
  propertyName: string;
  tenantName: string;
  amount: number;
  deadline: string;
  daysLeft: number;
  issues: DepositIssue[];
}

const DAY = 86_400_000;

function daysBetween(fromIso: string, to: Date) {
  const from = new Date(`${fromIso}T00:00:00`);
  return Math.round((from.getTime() - to.getTime()) / DAY);
}

export async function getComplianceData() {
  const supabase = await createClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    { data: properties },
    { data: certificates },
    { data: tenancies },
    { data: tenancyDocs },
    { data: rooms },
    { data: people },
  ] = await Promise.all([
    supabase.from("properties").select("id, name, address"),
    fetchAll((from, to) =>
      supabase
        .from("documents")
        .select("property_id, doc_type, expires_at")
        .in("doc_type", COMPLIANCE_CERTIFICATES)
        .not("property_id", "is", null)
        .order("id")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("tenancies")
        .select("id, room_id, start_date, deposit_amount, letting_type, status")
        .in("status", ["upcoming", "active"])
        .order("id")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("documents")
        .select("tenancy_id, doc_type")
        .in("doc_type", ["deposit_certificate", "deposit_prescribed_info"])
        .not("tenancy_id", "is", null)
        .order("id")
        .range(from, to),
    ),
    supabase.from("rooms").select("id, name, property_id"),
    fetchAll((from, to) =>
      supabase
        .from("tenancy_tenants")
        .select("tenancy_id, is_lead_tenant, tenants(first_name, surname)")
        .order("tenancy_id")
        .order("tenant_id")
        .range(from, to),
    ),
  ]);

  // The newest expiry wins: an old lapsed record next to a renewed one is
  // history, not a gap.
  const latest = new Map<string, string | null>();
  for (const c of certificates as { property_id: string; doc_type: string; expires_at: string | null }[]) {
    const key = `${c.property_id}:${c.doc_type}`;
    const prev = latest.get(key);
    if (prev === undefined || (c.expires_at ?? "9999") > (prev ?? "9999")) {
      latest.set(key, c.expires_at);
    }
  }

  const buildings: PropertyCompliance[] = byName(
    (properties ?? []) as Pick<Property, "id" | "name" | "address">[],
  ).map((property) => ({
    property,
    certificates: COMPLIANCE_CERTIFICATES.map((type) => {
      const key = `${property.id}:${type}`;
      if (!latest.has(key)) return { type, state: "missing", expiresAt: null, daysLeft: null };
      const expiresAt = latest.get(key) ?? null;
      if (!expiresAt) return { type, state: "ok", expiresAt: null, daysLeft: null };
      const daysLeft = daysBetween(expiresAt, today);
      const state: CertificateState =
        daysLeft < 0 ? "expired" : daysLeft <= DUE_SOON_DAYS ? "dueSoon" : "ok";
      return { type, state, expiresAt, daysLeft };
    }),
  }));

  const docsByTenancy = new Map<string, Set<string>>();
  for (const d of tenancyDocs as { tenancy_id: string; doc_type: string }[]) {
    const set = docsByTenancy.get(d.tenancy_id) ?? new Set<string>();
    set.add(d.doc_type);
    docsByTenancy.set(d.tenancy_id, set);
  }
  const roomById = new Map((rooms ?? []).map((r) => [r.id as string, r]));
  const propertyName = new Map((properties ?? []).map((p) => [p.id as string, p.name as string]));
  const leadByTenancy = new Map<string, string>();
  for (const row of people as unknown as {
    tenancy_id: string;
    is_lead_tenant: boolean;
    tenants: { first_name: string; surname: string } | null;
  }[]) {
    if (!row.tenants) continue;
    if (row.is_lead_tenant || !leadByTenancy.has(row.tenancy_id)) {
      leadByTenancy.set(row.tenancy_id, `${row.tenants.first_name} ${row.tenants.surname}`);
    }
  }

  let depositsHeld = 0;
  const deposits: DepositRow[] = [];
  for (const t of tenancies as (Pick<Tenancy, "id" | "room_id" | "start_date" | "deposit_amount"> & {
    letting_type: string;
  })[]) {
    // Short stays sit outside the statutory deposit scheme.
    if (t.letting_type !== "long_term" || !Number(t.deposit_amount)) continue;
    depositsHeld += 1;
    const docs = docsByTenancy.get(t.id) ?? new Set<string>();
    const issues: DepositIssue[] = [];
    if (!docs.has("deposit_certificate")) issues.push("unprotected");
    if (!docs.has("deposit_prescribed_info")) issues.push("noPrescribedInfo");
    if (!issues.length) continue;
    const start = new Date(`${t.start_date}T00:00:00`);
    const deadline = new Date(start.getTime() + DEPOSIT_DEADLINE_DAYS * DAY);
    const room = roomById.get(t.room_id);
    deposits.push({
      tenancyId: t.id,
      roomName: (room?.name as string) ?? "",
      propertyName: room ? (propertyName.get(room.property_id as string) ?? "") : "",
      tenantName: leadByTenancy.get(t.id) ?? "",
      amount: Number(t.deposit_amount),
      deadline: deadline.toISOString().slice(0, 10),
      daysLeft: Math.round((deadline.getTime() - today.getTime()) / DAY),
      issues,
    });
  }
  deposits.sort((a, b) => a.daysLeft - b.daysLeft);

  const cells = buildings.flatMap((b) => b.certificates);
  return {
    buildings,
    deposits,
    depositsHeld,
    counts: {
      expired: cells.filter((c) => c.state === "expired").length,
      dueSoon: cells.filter((c) => c.state === "dueSoon").length,
      missing: cells.filter((c) => c.state === "missing").length,
      deposits: deposits.length,
    },
  };
}
