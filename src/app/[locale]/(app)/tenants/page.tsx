import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/metrics/metric-card";
import { TenantDialog } from "@/components/tenants/tenant-dialog";
import {
  Users,
  ChevronRight,
  Phone,
  Mail,
  UserCheck,
  UserMinus,
  Archive,
} from "lucide-react";
import type { Tenant } from "@/lib/types";

interface TenantRow extends Tenant {
  tenancy_tenants: {
    tenancies: {
      status: string;
      rooms: { name: string; properties: { name: string } | null } | null;
    } | null;
  }[];
}

/** Their initials, for the avatar — the first letter of each name. */
function initials(tenant: Tenant) {
  return `${tenant.first_name.at(0) ?? ""}${tenant.surname.at(0) ?? ""}`.toUpperCase();
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
  const { data } = await supabase
    .from("tenants")
    .select(
      "*, tenancy_tenants(tenancies(status, rooms(name, properties(name))))",
    )
    .order("surname");

  const all = (data ?? []) as unknown as TenantRow[];

  /**
   * Where each person is now, if anywhere — a profile can sit unassigned
   * between lettings, which is the whole reason tenants are stored separately
   * from tenancies.
   */
  const placeOf = (tenant: TenantRow) =>
    tenant.tenancy_tenants.find(
      (tt) =>
        tt.tenancies?.status === "active" || tt.tenancies?.status === "upcoming",
    )?.tenancies ?? null;

  /* `is_archived` has been on this table since the tenant-profiles migration
     and has never had anywhere to show. Someone who has moved out should not
     be sitting in the same list as current tenants — but deleting them would
     take their tenancy history and documents with them, which is exactly what
     the retention rules say must be kept. Archived is the answer, and it needs
     a place to live. */
  const active = all.filter((x) => !x.is_archived);
  const archived = all.filter((x) => x.is_archived);
  const housed = active.filter((x) => placeOf(x) !== null).length;

  function TenantCard({ tenant, dim }: { tenant: TenantRow; dim?: boolean }) {
    const place = placeOf(tenant);

    return (
      <Link
        href={`/tenants/${tenant.id}`}
        className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Card interactive className={dim ? "h-full opacity-75" : "h-full"}>
          <CardContent className="flex h-full items-start gap-3 p-5">
            {/* Initials rather than an icon: in a grid of thirty people the
                same generic silhouette thirty times helps nobody find anyone. */}
            <span
              className={
                "figure flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold " +
                "bg-muted text-muted-foreground"
              }
              aria-hidden
            >
              {initials(tenant)}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {tenant.first_name} {tenant.surname}
              </p>

              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {place?.rooms ? (
                  <>
                    <Badge variant="secondary">{place.rooms.name}</Badge>
                    {place.rooms.properties && (
                      <span className="truncate text-xs text-muted-foreground">
                        {place.rooms.properties.name}
                      </span>
                    )}
                  </>
                ) : tenant.is_archived ? (
                  <Badge variant="outline">{t("tenants.archived")}</Badge>
                ) : (
                  <Badge variant="outline">{t("tenants.unassigned")}</Badge>
                )}
              </div>

              {(tenant.phone || tenant.email) && (
                <div className="mt-2.5 flex flex-col gap-1">
                  {tenant.phone && (
                    <p className="figure flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <Phone className="size-3 shrink-0" aria-hidden />
                      {tenant.phone}
                    </p>
                  )}
                  {tenant.email && (
                    <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <Mail className="size-3 shrink-0" aria-hidden />
                      {tenant.email}
                    </p>
                  )}
                </div>
              )}
            </div>

            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("tenants.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("tenants.subtitle")}
          </p>
        </div>
        <TenantDialog />
      </header>

      {all.length === 0 ? (
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
        <>
          <section className="rise-in grid grid-cols-12 gap-4">
            <MetricCard
              className="col-span-6 lg:col-span-4"
              label={t("tenants.inARoom")}
              value={housed}
              hint={t("tenants.ofActive", { total: active.length })}
              Icon={UserCheck}
              size="lg"
              muted={housed === 0}
            />
            <MetricCard
              className="col-span-6 lg:col-span-4"
              label={t("tenants.unassigned")}
              value={active.length - housed}
              hint={t("tenants.betweenLettings")}
              Icon={UserMinus}
              size="lg"
              muted={active.length - housed === 0}
            />
            <MetricCard
              className="col-span-12 lg:col-span-4"
              label={t("tenants.archived")}
              value={archived.length}
              hint={t("tenants.keptForRecords")}
              Icon={Archive}
              size="lg"
              muted={archived.length === 0}
            />
          </section>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((tenant) => (
              <TenantCard key={tenant.id} tenant={tenant} />
            ))}
          </div>

          {archived.length > 0 && (
            <section className="flex flex-col gap-4">
              <div className="flex items-baseline gap-2">
                <h2 className="font-semibold">{t("tenants.archived")}</h2>
                <Badge variant="secondary">{archived.length}</Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {archived.map((tenant) => (
                  <TenantCard key={tenant.id} tenant={tenant} dim />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
