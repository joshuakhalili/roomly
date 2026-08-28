"use client";

import { useMemo, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentMeter } from "@/components/charts/segment-meter";
import { cn } from "@/lib/utils";
import type { DashboardRoom } from "@/lib/queries/dashboard";
import type { Property } from "@/lib/types";
import { DoorOpen, User, Search } from "lucide-react";

type Filter = "all" | "current" | "upcoming" | "vacant";

/**
 * The room list, grouped under the building each room is in.
 *
 * It used to be one flat grid with the property name as a subtitle line on
 * every card. That reads fine with one building and falls apart with six: the
 * only way to answer "how is Golding Road doing" was to scan thirty cards and
 * hold the count in your head. A heading per property with its own occupancy
 * meter answers it before you look at a single room.
 */
export function RoomGrid({
  rooms,
  properties,
}: {
  rooms: DashboardRoom[];
  properties: Property[];
}) {
  const t = useTranslations();
  const format = useFormatter();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rooms.filter((r) => {
      if (r.is_common_area) return false;

      const status = r.tenancy?.status;
      if (filter === "current" && status !== "active") return false;
      if (filter === "upcoming" && status !== "upcoming") return false;
      if (filter === "vacant" && r.tenancy) return false;

      if (!q) return true;
      const names =
        r.tenancy?.tenants
          .map((x) => `${x.first_name} ${x.surname}`)
          .join(" ") ?? "";
      return (
        r.name.toLowerCase().includes(q) ||
        r.property_name.toLowerCase().includes(q) ||
        names.toLowerCase().includes(q)
      );
    });
  }, [rooms, filter, query]);

  /**
   * Grouped by property, in the order the properties come back.
   *
   * The occupancy counts deliberately ignore the active filter: with "Vacant"
   * selected, a heading reading "0 of 8 occupied" would be describing the
   * filter rather than the building. The meter always tells the truth about
   * the property; the cards below it are what the filter narrows.
   */
  const groups = useMemo(() => {
    const roomsByProperty = new Map<string, DashboardRoom[]>();
    for (const r of filtered) {
      const list = roomsByProperty.get(r.property_id) ?? [];
      list.push(r);
      roomsByProperty.set(r.property_id, list);
    }

    return properties
      .map((p) => {
        const lettable = rooms.filter(
          (r) => r.property_id === p.id && r.is_lettable && !r.is_common_area,
        );
        return {
          property: p,
          rooms: roomsByProperty.get(p.id) ?? [],
          total: lettable.length,
          occupied: lettable.filter((r) => r.tenancy?.status === "active")
            .length,
        };
      })
      .filter((g) => g.rooms.length > 0);
  }, [filtered, properties, rooms]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: t("filters.all") },
    { key: "current", label: t("filters.current") },
    { key: "upcoming", label: t("filters.upcoming") },
    { key: "vacant", label: t("filters.vacant") },
  ];

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("filters.search")}
            className="rounded-full pl-8"
            aria-label={t("filters.search")}
          />
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {rooms.length === 0 ? t("dashboard.noRooms") : t("filters.noResults")}
        </p>
      ) : (
        groups.map(({ property, rooms: groupRooms, total, occupied }) => (
          <div key={property.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link
                href={`/properties/${property.id}`}
                className="font-heading font-semibold hover:underline"
              >
                {property.name}
              </Link>
              <span className="figure text-xs text-muted-foreground">
                {t("dashboard.occupiedRooms", { occupied, total })}
              </span>
              <SegmentMeter
                total={total}
                filled={occupied}
                className="w-full max-w-40 sm:w-40"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {groupRooms.map((room) => {
                const tenancy = room.tenancy;
                const isActive = tenancy?.status === "active";
                const isUpcoming = tenancy?.status === "upcoming";
                const lead =
                  tenancy?.tenants.find((x) => x.is_lead_tenant) ??
                  tenancy?.tenants[0];

                return (
                  <Link
                    key={room.id}
                    href={`/properties/${room.property_id}/rooms/${room.id}`}
                    className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Card interactive className="h-full">
                      <CardContent className="flex h-full flex-col gap-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 truncate font-medium">
                            {room.name}
                          </p>
                          <Badge
                            variant={isActive ? "secondary" : "outline"}
                            className="shrink-0"
                          >
                            {isActive
                              ? t("rooms.occupied")
                              : isUpcoming
                                ? t("rooms.upcoming")
                                : t("rooms.vacant")}
                          </Badge>
                        </div>

                        <div className="mt-auto flex items-center gap-2 text-sm">
                          {tenancy && lead ? (
                            <>
                              <User
                                className="size-4 shrink-0 text-muted-foreground"
                                aria-hidden
                              />
                              <span className="truncate">
                                {lead.first_name} {lead.surname}
                                {tenancy.tenants.length > 1 &&
                                  ` +${tenancy.tenants.length - 1}`}
                              </span>
                            </>
                          ) : (
                            <>
                              <DoorOpen
                                className="size-4 shrink-0 text-muted-foreground"
                                aria-hidden
                              />
                              {/* A room empty for a week is a fact; one empty
                                  for three months is a problem, so the number
                                  earns colour once it is worth acting on. */}
                              <span
                                className={cn(
                                  "truncate text-muted-foreground",
                                  room.vacant_days !== null &&
                                    room.vacant_days >= 30 &&
                                    "text-warning",
                                )}
                              >
                                {room.vacant_days !== null
                                  ? t("dashboard.vacantDays", {
                                      days: room.vacant_days,
                                    })
                                  : t("rooms.noTenant")}
                              </span>
                            </>
                          )}
                        </div>

                        {isActive && (
                          <p className="figure text-xs text-muted-foreground">
                            {format.number(Number(tenancy.rent_amount), {
                              style: "currency",
                              currency: "GBP",
                              maximumFractionDigits: 0,
                            })}{" "}
                            · {t(`tenancy.frequency${
                              tenancy.rent_frequency === "monthly"
                                ? "Monthly"
                                : tenancy.rent_frequency === "weekly"
                                  ? "Weekly"
                                  : tenancy.rent_frequency === "fortnightly"
                                    ? "Fortnightly"
                                    : "FourWeekly"
                            }`)}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
