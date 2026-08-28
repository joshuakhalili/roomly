import { getTranslations, getFormatter, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { MetricCard } from "@/components/metrics/metric-card";
import { SegmentMeter } from "@/components/charts/segment-meter";
import { PropertyDialog } from "@/components/properties/property-dialog";
import { Building2, ChevronRight, DoorOpen, Banknote, MapPin } from "lucide-react";
import type { Property } from "@/lib/types";

export default async function PropertiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const format = await getFormatter();

  const supabase = await createClient();
  const [{ data: properties }, { data: rooms }, { data: tenancies }] =
    await Promise.all([
      supabase.from("properties").select("*").order("name"),
      supabase
        .from("rooms")
        .select("id, property_id, is_lettable, is_common_area"),
      // Only active lettings tell you what is occupied right now.
      supabase
        .from("tenancies")
        .select("room_id, rent_amount, rent_frequency")
        .eq("status", "active"),
    ]);

  const list = (properties ?? []) as Property[];

  /**
   * Rent stated as a monthly equivalent.
   *
   * A building with weekly and monthly lettings in it cannot have its rents
   * added together as they are stored — £200 a week and £200 a month are not
   * the same £200. Normalising to a month is the only way the per-property
   * figures are comparable, and it is why this is not simply a `sum`.
   */
  const PER_MONTH = {
    weekly: 52 / 12,
    fortnightly: 26 / 12,
    four_weekly: 13 / 12,
    monthly: 1,
  } as const;

  const occupiedRooms = new Set((tenancies ?? []).map((x) => x.room_id));
  const roomToProperty = new Map(
    (rooms ?? []).map((r) => [r.id as string, r.property_id as string]),
  );

  const stats = new Map<
    string,
    { total: number; occupied: number; monthlyRent: number }
  >();
  const bucket = (id: string) => {
    if (!stats.has(id)) stats.set(id, { total: 0, occupied: 0, monthlyRent: 0 });
    return stats.get(id)!;
  };

  for (const r of rooms ?? []) {
    if (!r.is_lettable || r.is_common_area) continue;
    const b = bucket(r.property_id as string);
    b.total += 1;
    if (occupiedRooms.has(r.id as string)) b.occupied += 1;
  }
  for (const tn of tenancies ?? []) {
    const propertyId = roomToProperty.get(tn.room_id as string);
    if (!propertyId) continue;
    const factor =
      PER_MONTH[(tn.rent_frequency as keyof typeof PER_MONTH) ?? "monthly"] ?? 1;
    bucket(propertyId).monthlyRent += Number(tn.rent_amount) * factor;
  }

  const totals = [...stats.values()].reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      occupied: acc.occupied + s.occupied,
      monthlyRent: acc.monthlyRent + s.monthlyRent,
    }),
    { total: 0, occupied: 0, monthlyRent: 0 },
  );
  const occupancyRate =
    totals.total === 0 ? 0 : Math.round((totals.occupied / totals.total) * 100);

  const money = (n: number) =>
    format.number(n, {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    });

  return (
    <div className="flex flex-col gap-8">
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
        <>
          <section className="rise-in grid grid-cols-12 gap-4">
            <MetricCard
              className="col-span-6 lg:col-span-4"
              label={t("dashboard.occupancyRate")}
              value={`${occupancyRate}%`}
              hint={t("dashboard.occupiedRooms", {
                occupied: totals.occupied,
                total: totals.total,
              })}
              Icon={Building2}
              size="lg"
              footer={
                <SegmentMeter
                  total={totals.total}
                  filled={totals.occupied}
                  tone="brand"
                />
              }
            />
            <MetricCard
              className="col-span-6 lg:col-span-4"
              label={t("properties.rentRoll")}
              value={money(totals.monthlyRent)}
              hint={t("properties.perMonth")}
              Icon={Banknote}
              size="lg"
              muted={totals.monthlyRent === 0}
            />
            <MetricCard
              className="col-span-12 lg:col-span-4"
              label={t("dashboard.vacantRooms")}
              value={totals.total - totals.occupied}
              hint={t("properties.acrossBuildings", { count: list.length })}
              Icon={DoorOpen}
              size="lg"
              muted={totals.total - totals.occupied === 0}
            />
          </section>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((property) => {
              const s = stats.get(property.id) ?? {
                total: 0,
                occupied: 0,
                monthlyRent: 0,
              };
              return (
                <Link
                  key={property.id}
                  href={`/properties/${property.id}`}
                  className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Card interactive className="group/property h-full">
                    <CardContent className="flex h-full flex-col gap-4 p-5">
                      <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                          <Building2 className="size-5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-heading font-semibold">
                            {property.name}
                          </p>
                          {property.address && (
                            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                              <MapPin className="size-3 shrink-0" aria-hidden />
                              {property.address}
                            </p>
                          )}
                        </div>
                        <ChevronRight
                          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/property:translate-x-0.5"
                          aria-hidden
                        />
                      </div>

                      {/* The meter, not just the count. One tick per room means
                          "three empty" is something you see rather than read. */}
                      <div className="mt-auto flex flex-col gap-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="figure text-sm font-medium">
                            {t("dashboard.occupiedRooms", {
                              occupied: s.occupied,
                              total: s.total,
                            })}
                          </span>
                          {s.monthlyRent > 0 && (
                            <span className="figure text-sm text-muted-foreground">
                              {money(s.monthlyRent)}
                            </span>
                          )}
                        </div>
                        <SegmentMeter
                          total={s.total}
                          filled={s.occupied}
                          tone="brand"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
