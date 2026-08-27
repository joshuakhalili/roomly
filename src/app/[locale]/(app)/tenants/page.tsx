import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TenantDialog } from "@/components/tenants/tenant-dialog";
import { Users, ChevronRight, Phone, Mail } from "lucide-react";
import type { Tenant } from "@/lib/types";

interface TenantRow extends Tenant {
  tenancy_tenants: {
    tenancies: {
      status: string;
      rooms: { name: string } | null;
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
  const { data } = await supabase
    .from("tenants")
    .select("*, tenancy_tenants(tenancies(status, rooms(name)))")
    .order("surname");

  const tenants = (data ?? []) as unknown as TenantRow[];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("tenants.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("tenants.subtitle")}
          </p>
        </div>
        <TenantDialog />
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => {
            // Where they are now, if anywhere — a profile can sit unassigned
            // between lettings.
            const current = tenant.tenancy_tenants.find(
              (tt) =>
                tt.tenancies?.status === "active" ||
                tt.tenancies?.status === "upcoming",
            );

            return (
              <Link key={tenant.id} href={`/tenants/${tenant.id}`}>
                <Card className="h-full transition-colors hover:bg-accent/40">
                  <CardContent className="flex items-start gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">
                          {tenant.first_name} {tenant.surname}
                        </p>
                        {current?.tenancies?.rooms ? (
                          <Badge variant="secondary" className="text-xs">
                            {current.tenancies.rooms.name}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            {t("tenants.unassigned")}
                          </Badge>
                        )}
                      </div>

                      {tenant.phone && (
                        <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                          <Phone className="size-3 shrink-0" aria-hidden />
                          {tenant.phone}
                        </p>
                      )}
                      {tenant.email && (
                        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                          <Mail className="size-3 shrink-0" aria-hidden />
                          {tenant.email}
                        </p>
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
          })}
        </div>
      )}
    </div>
  );
}
