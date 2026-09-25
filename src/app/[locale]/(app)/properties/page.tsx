import {
  getTranslations,
  getFormatter,
  setRequestLocale,
} from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

import { Card, CardContent } from "@/components/ui/card";
import { PropertyDirectory } from "@/components/properties/property-directory";

import { PropertyDialog } from "@/components/properties/property-dialog";
import { getSignedUrls } from "@/lib/actions/storage";
import { Building2 } from "lucide-react";
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

  /**
   * A short stay is left out of this figure entirely.
   *
   * Its rent_amount is one total for a handful of nights, not a rate that
   * repeats — counting it as a month's income would overstate the rent roll
   * by whatever a booking happens to cost, and the number would swing wildly
   * as bookings came and went. The rent roll answers "what does this building
   * bring in every month", and a one-off booking is not an answer to that.
   */
  const isRecurring = (frequency: string) => frequency in PER_MONTH;

  const occupiedRooms = new Set((tenancies ?? []).map((x) => x.room_id));
  const roomToProperty = new Map(
    (rooms ?? []).map((r) => [r.id as string, r.property_id as string]),
  );

  const stats = new Map<
    string,
    { total: number; occupied: number; monthlyRent: number }
  >();
  const bucket = (id: string) => {
    if (!stats.has(id))
      stats.set(id, { total: 0, occupied: 0, monthlyRent: 0 });
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
    const frequency = String(tn.rent_frequency ?? "monthly");
    if (!isRecurring(frequency)) continue;
    const factor = PER_MONTH[frequency as keyof typeof PER_MONTH];
    bucket(propertyId).monthlyRent += Number(tn.rent_amount) * factor;
  }

  const money = (n: number) =>
    format.number(n, {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    });

  /* Signed here rather than in the card, because the card is not a client
     component and should not become one just to fetch a URL. Signing on the
     server means the image is in the first paint instead of arriving after a
     round trip, which on a list of buildings is the difference between
     recognising the page and watching it assemble. */
  const banners = list
    .map((p) => p.banner_path)
    .filter((p): p is string => !!p);
  const signed = banners.length ? await getSignedUrls(banners) : null;
  const bannerUrls = signed?.ok ? signed.data : {};

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("properties.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("properties.subtitle")}
          </p>
        </div>
        <PropertyDialog autoOpen />
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
        <PropertyDirectory
          properties={list.map((property) => {
            const value = stats.get(property.id) ?? {
              total: 0,
              occupied: 0,
              monthlyRent: 0,
            };
            return {
              id: property.id,
              name: property.name,
              address: property.address,
              image: property.banner_path
                ? (bannerUrls[property.banner_path] ?? null)
                : null,
              occupied: value.occupied,
              total: value.total,
              rent: money(value.monthlyRent),
            };
          })}
        />
      )}
    </div>
  );
}
