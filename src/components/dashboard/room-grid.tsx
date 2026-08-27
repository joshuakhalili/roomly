"use client";

import { useMemo, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DashboardRoom } from "@/lib/queries/dashboard";
import { DoorOpen, User, Search } from "lucide-react";

type Filter = "all" | "current" | "upcoming" | "vacant";

/**
 * The room list, with the quick-filter chips.
 *
 * Cards rather than a table: at ~30 rooms this reads faster at a glance and
 * survives phone width, where a table would need horizontal scrolling.
 */
export function RoomGrid({ rooms }: { rooms: DashboardRoom[] }) {
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
        r.tenancy?.occupants
          .map((o) => `${o.first_name} ${o.surname}`)
          .join(" ") ?? "";
      return (
        r.name.toLowerCase().includes(q) ||
        r.property_name.toLowerCase().includes(q) ||
        names.toLowerCase().includes(q)
      );
    });
  }, [rooms, filter, query]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: t("filters.all") },
    { key: "current", label: t("filters.current") },
    { key: "upcoming", label: t("filters.upcoming") },
    { key: "vacant", label: t("filters.vacant") },
  ];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
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
            className="pl-8"
            aria-label={t("filters.search")}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {rooms.length === 0 ? t("dashboard.noRooms") : t("filters.noResults")}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((room) => {
            const tenancy = room.tenancy;
            const isActive = tenancy?.status === "active";
            const isUpcoming = tenancy?.status === "upcoming";
            const lead =
              tenancy?.occupants.find((o) => o.is_lead_tenant) ??
              tenancy?.occupants[0];

            return (
              <Link
                key={room.id}
                href={`/properties/${room.property_id}/rooms/${room.id}`}
                className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full transition-colors hover:bg-accent/40">
                  <CardContent className="flex h-full flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{room.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {room.property_name}
                        </p>
                      </div>
                      <Badge
                        variant={isActive ? "default" : "secondary"}
                        className={cn(
                          "shrink-0",
                          isUpcoming &&
                            "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
                        )}
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
                            {tenancy.occupants.length > 1 &&
                              ` +${tenancy.occupants.length - 1}`}
                          </span>
                        </>
                      ) : (
                        <>
                          <DoorOpen
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <span className="text-muted-foreground">
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
                      <p className="text-xs text-muted-foreground">
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
      )}
    </section>
  );
}
