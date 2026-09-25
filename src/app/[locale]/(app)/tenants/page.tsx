import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { TenantDialog } from "@/components/tenants/tenant-dialog";
import {
  TenantsBrowser,
  type TenantWithPlace,
} from "@/components/tenants/tenants-browser";
import {
  getDocumentRequirements,
  tenantScopedTypes,
} from "@/lib/queries/document-requirements";
import { Users } from "lucide-react";
import type { DocumentRecord, Property, Tenant } from "@/lib/types";

interface TenantRow extends Tenant {
  tenancy_tenants: {
    tenancies: {
      status: string;
      rooms: {
        name: string;
        properties: { id: string; name: string } | null;
      } | null;
    } | null;
  }[];
}

export default async function TenantsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const [
    { data },
    { data: properties },
    { data: documents },
    requirements,
  ] = await Promise.all([
    supabase
      .from("tenants")
      .select(
        "*, tenancy_tenants(tenancies(status, rooms(name, properties(id, name))))",
      )
      .order("surname"),
    supabase.from("properties").select("*").order("name"),
    // Only identity documents matter here; the rest belong to a letting.
    supabase.from("documents").select("*").not("tenant_id", "is", null),
    getDocumentRequirements(supabase),
  ]);

  const all = (data ?? []) as unknown as TenantRow[];

  const docsByTenant = new Map<string, Set<string>>();
  for (const d of (documents ?? []) as DocumentRecord[]) {
    if (!d.tenant_id) continue;
    const set = docsByTenant.get(d.tenant_id) ?? new Set<string>();
    set.add(d.doc_type);
    docsByTenant.set(d.tenant_id, set);
  }

  /* A profile outlives any one letting, so what it must hold is everything
     that follows the person under any letting type. */
  const required = [...tenantScopedTypes(requirements)];

  /**
   * Where each person is now, if anywhere.
   *
   * A profile can sit unassigned between lettings, which is the whole reason
   * tenants are stored separately from tenancies.
   */
  const tenants: TenantWithPlace[] = all.map((tenant) => {
    const current = tenant.tenancy_tenants.find(
      (tt) =>
        tt.tenancies?.status === "active" || tt.tenancies?.status === "upcoming",
    )?.tenancies;

    const have = docsByTenant.get(tenant.id) ?? new Set<string>();

    return {
      ...tenant,
      place: current?.rooms
        ? {
            roomName: current.rooms.name,
            propertyId: current.rooms.properties?.id ?? null,
            propertyName: current.rooms.properties?.name ?? null,
          }
        : null,
      missingDocuments: required.filter((r) => !have.has(r)).length,
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("tenants.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("tenants.subtitle")}
          </p>
        </div>
        <TenantDialog autoOpen />
      </header>

      {tenants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Users className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              {t("tenants.noTenants")}
            </p>
            <TenantDialog />
          </CardContent>
        </Card>
      ) : (
        <TenantsBrowser
          tenants={tenants}
          properties={(properties ?? []) as Property[]}
        />
      )}
    </div>
  );
}
