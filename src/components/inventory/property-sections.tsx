"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { ProgressMeter } from "@/components/charts/segment-meter";
import {
  Collapsible,
  CollapsibleChevron,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Building2, Camera, ChevronRight, MapPin } from "lucide-react";

export interface InventoryRoom {
  id: string;
  name: string;
  unitType: "studio" | "flat";
  /** Where the room's own inventory lives, once it exists. */
  checklistId: string | null;
  done: number;
  total: number;
}

export interface InventoryProperty {
  id: string;
  name: string;
  address: string | null;
  bannerUrl: string | null;
  rooms: InventoryRoom[];
}

const OPEN_KEY = "inventory-open";

const subscribe = () => () => {};
/** Server render: assume nothing is stored, so the first client paint agrees. */
const getServerSnapshot = () => "";

function getClientSnapshot() {
  try {
    return localStorage.getItem(OPEN_KEY) ?? "";
  } catch {
    // Private browsing can throw on access — fall back to the defaults.
    return "";
  }
}

/**
 * Every room's standing inventory, one collapsible section per building.
 *
 * This was a two-column masonry of small cards, one per room, under a plain
 * heading. With more than a couple of buildings that is a wall of near
 * identical boxes in two ragged columns, and no way to tell whose rooms are
 * whose without reading every header. Now each building is a section you can
 * shut, with its photograph and address on the header so it is recognisable
 * before it is read, and the rooms inside are rows in one container rather
 * than twelve separate cards.
 */
export function PropertySections({
  properties,
}: {
  properties: InventoryProperty[];
}) {
  const t = useTranslations();
  const stored = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  /* Remembered between visits, because which building someone is working
     through does not change just because they opened a room and came back.
     Seeded from what was stored, or — first visit — everything open when
     there are few enough that open is still readable. */
  const [open, setOpen] = useState<Set<string>>(() => {
    if (stored) return new Set(stored.split(",").filter(Boolean));
    return new Set(
      properties.length <= 2
        ? properties.map((p) => p.id)
        : properties.slice(0, 1).map((p) => p.id),
    );
  });

  function toggle(id: string, isOpen: boolean) {
    setOpen((previous) => {
      const next = new Set(previous);
      if (isOpen) next.add(id);
      else next.delete(id);
      try {
        localStorage.setItem(OPEN_KEY, [...next].join(","));
      } catch {
        // Non-fatal: the sections just forget between visits.
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {properties.map((property) => {
        const started = property.rooms.filter((r) => r.total > 0).length;
        const complete = property.rooms.filter(
          (r) => r.total > 0 && r.done === r.total,
        ).length;
        const notStarted = property.rooms.length - started;

        return (
          <Collapsible
            key={property.id}
            open={open.has(property.id)}
            onOpenChange={(isOpen) => toggle(property.id, isOpen)}
            className="rounded-xl border border-border bg-card"
          >
            <CollapsibleTrigger className="p-4">
              {property.bannerUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element -- signed
                   URLs expire, so the optimiser cannot cache them */
                <img
                  src={property.bannerUrl}
                  alt=""
                  loading="lazy"
                  className="h-10 w-16 shrink-0 rounded-md object-cover"
                />
              ) : (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Building2 className="size-5" aria-hidden />
                </span>
              )}

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

              <div className="flex shrink-0 items-center gap-2">
                {/* A room with no inventory at all is the only thing here
                    worth a colour: without one there is no evidence of
                    condition to compare against later. */}
                {notStarted > 0 && (
                  <Badge variant="warning">
                    {t("inventory.notStartedCount", { count: notStarted })}
                  </Badge>
                )}
                <span className="figure hidden text-xs text-muted-foreground sm:inline">
                  {t("inventory.completeOf", {
                    done: complete,
                    total: property.rooms.length,
                  })}
                </span>
                <CollapsibleChevron />
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
              {property.rooms.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted-foreground">
                  {t("rooms.noRooms")}
                </p>
              ) : (
                /* Rows in one container, not a stack of cards: twelve cards
                   in a column is twelve borders competing for the same
                   attention as the section they sit in. */
                <ul className="divide-y divide-border border-t border-border">
                  {property.rooms.map((room) => (
                    <li key={room.id}>
                      <Link
                        href={
                          room.checklistId
                            ? `/inventory/${room.checklistId}`
                            : `/properties/${property.id}/rooms/${room.id}`
                        }
                        className="flex items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
                      >
                        <Camera
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium">
                              {room.name}
                            </span>
                            <Badge variant="outline">
                              {t(
                                room.unitType === "flat"
                                  ? "rooms.unitFlat"
                                  : "rooms.unitStudio",
                              )}
                            </Badge>
                          </div>

                          {room.total > 0 ? (
                            <div className="mt-1.5 flex items-center gap-2">
                              <ProgressMeter
                                value={room.done}
                                max={room.total}
                                tone="brand"
                                className="max-w-40"
                              />
                              <span className="figure text-xs text-muted-foreground">
                                {room.done}/{room.total}
                              </span>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {t("inventory.notStarted")}
                            </p>
                          )}
                        </div>

                        <ChevronRight
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
