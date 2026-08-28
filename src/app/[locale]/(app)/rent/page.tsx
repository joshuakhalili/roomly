import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { RentTable, type RentRow } from "@/components/rent/rent-table";
import type { MessageTemplate } from "@/lib/messaging";
import type { RentPayment, TenantOnTenancy } from "@/lib/types";

/** Payments further out than this aren't actionable yet. */
const HORIZON_DAYS = 45;

export default async function RentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + HORIZON_DAYS);

  const [{ data: payments }, { data: tenancies }, { data: links }, { data: templates }] =
    await Promise.all([
      supabase
        .from("rent_payments")
        .select("*")
        .lte("due_date", horizon.toISOString().slice(0, 10))
        .order("due_date"),
      supabase
        .from("tenancies")
        .select("id, room_id, status, rooms(id, name, properties(name))"),
      supabase
        .from("tenancy_tenants")
        .select("tenancy_id, is_lead_tenant, tenants(*)"),
      supabase.from("message_templates").select("template_key, language, body_text"),
    ]);

  const leadByTenancy = new Map<string, TenantOnTenancy>();
  for (const row of (links ?? []) as unknown as {
    tenancy_id: string;
    is_lead_tenant: boolean;
    tenants: TenantOnTenancy | null;
  }[]) {
    if (!row.tenants) continue;
    const existing = leadByTenancy.get(row.tenancy_id);
    // Prefer the lead tenant; fall back to whoever is on the tenancy.
    if (!existing || row.is_lead_tenant)
      leadByTenancy.set(row.tenancy_id, {
        ...row.tenants,
        is_lead_tenant: row.is_lead_tenant,
      });
  }

  const tenancyById = new Map(
    ((tenancies ?? []) as unknown as {
      id: string;
      status: string;
      rooms: { id: string; name: string; properties: { name: string } | null } | null;
    }[]).map((x) => [x.id, x]),
  );

  const rows: RentRow[] = ((payments ?? []) as RentPayment[])
    .map((p) => {
      const tenancy = tenancyById.get(p.tenancy_id);
      if (!tenancy || tenancy.status === "archived") return null;
      return {
        payment: p,
        roomName: tenancy.rooms?.name ?? "—",
        propertyName: tenancy.rooms?.properties?.name ?? "",
        tenant: leadByTenancy.get(p.tenancy_id) ?? null,
      };
    })
    .filter((r): r is RentRow => r !== null);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">{t("rent.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("rent.subtitle")}</p>
      </header>

      <RentTable
        rows={rows}
        templates={(templates ?? []) as MessageTemplate[]}
      />
    </div>
  );
}
