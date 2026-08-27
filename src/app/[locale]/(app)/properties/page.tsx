import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PropertyDialog } from "@/components/properties/property-dialog";
import { Building2, ChevronRight } from "lucide-react";
import type { Property } from "@/lib/types";

export default async function PropertiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const [{ data: properties }, { data: rooms }] = await Promise.all([
    supabase.from("properties").select("*").order("name"),
    supabase.from("rooms").select("id,property_id"),
  ]);

  const roomCounts = new Map<string, number>();
  for (const r of rooms ?? []) {
    roomCounts.set(r.property_id, (roomCounts.get(r.property_id) ?? 0) + 1);
  }

  const list = (properties ?? []) as Property[];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("properties.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("properties.subtitle")}
          </p>
        </div>
        <PropertyDialog />
      </header>

      {list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Building2 className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              {t("properties.noProperties")}
            </p>
            <PropertyDialog />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((property) => (
            <Link key={property.id} href={`/properties/${property.id}`}>
              <Card className="h-full transition-colors hover:bg-accent/40">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary">
                    <Building2 className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{property.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {property.address ??
                        t("properties.roomCount", {
                          count: roomCounts.get(property.id) ?? 0,
                        })}
                    </p>
                  </div>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
