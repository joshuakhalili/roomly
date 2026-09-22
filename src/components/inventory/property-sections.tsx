"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Search, ArrowUpRight, Building2 } from "lucide-react";
export interface InventoryRoom {
  id: string;
  name: string;
  unitType: "room" | "studio" | "flat";
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

export function PropertySections({
  properties,
}: {
  properties: InventoryProperty[];
}) {
  const t = useTranslations();
  const params = useSearchParams();
  const [selected, setSelected] = useState(
    params.get("property") ?? properties[0]?.id,
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("allRooms");
  const property = properties.find((p) => p.id === selected) ?? properties[0];
  if (!property) return <p>{t("properties.noProperties")}</p>;
  const rooms = property.rooms.filter(
    (r) =>
      r.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
      (filter === "allRooms" ||
        (filter === "needsReview"
          ? !r.total || r.done < r.total
          : r.total > 0 && r.done === r.total)),
  );
  function select(id: string) {
    setSelected(id);
    setQuery("");
    setFilter("allRooms");
    const url = new URL(window.location.href);
    url.searchParams.set("property", id);
    window.history.replaceState(null, "", url);
  }
  return (
    <div className="inventory-workspace">
      <aside
        className="inventory-index"
        aria-label={t("workspace.chooseProperty")}
      >
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t("workspace.chooseProperty")}
        </h2>
        <div className="inventory-index-list">
          {properties.map((p) => (
            <button
              key={p.id}
              onClick={() => select(p.id)}
              aria-pressed={property.id === p.id}
            >
              <span className="flex items-center gap-2 font-medium text-sm">
                <Building2 size={16} aria-hidden />
                {p.name}
              </span>
              <small>
                {p.rooms.length} · {t("rooms.title")}
              </small>
            </button>
          ))}
        </div>
      </aside>
      <section className="min-w-0" aria-label={property.name}>
        <div className="inventory-summary">
          <h2>{property.name}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {property.address}
          </p>
          <Link
            className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-primary"
            href={`/properties/${property.id}`}
          >
            {t("workspace.openProperty")}
            <ArrowUpRight size={16} aria-hidden />
          </Link>
        </div>
        <div className="workspace-toolbar">
          <label className="workspace-search">
            <Search size={18} aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t("workspace.searchInventory")}
              placeholder={t("workspace.searchInventory")}
            />
          </label>
          <select
            className="min-h-11 rounded-md border px-3 text-sm"
            aria-label={t("workspace.review")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {["allRooms", "needsReview", "ready"].map((f) => (
              <option key={f} value={f}>
                {t(`workspace.${f}`)}
              </option>
            ))}
          </select>
        </div>
        <ul>
          {rooms.map((room) => (
            <li key={room.id} className="inventory-room">
              <div>
                <h3 className="font-semibold">{room.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(
                    room.unitType === "flat"
                      ? "rooms.unitFlat"
                      : room.unitType === "studio"
                        ? "rooms.unitStudio"
                        : "rooms.unitRoom",
                  )}
                </p>
              </div>
              <div className="inventory-progress">
                {room.total > 0 ? (
                  <>
                    <progress
                      aria-label={t("workspace.review")}
                      value={room.done}
                      max={room.total}
                    />
                    <span>
                      {t("workspace.itemsReviewed", {
                        done: room.done,
                        total: room.total,
                      })}
                    </span>
                  </>
                ) : (
                  <span>{t("workspace.notStarted")}</span>
                )}
              </div>
              <div className="inventory-actions">
                <Link
                  className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                  href={
                    room.checklistId
                      ? `/inventory/${room.checklistId}`
                      : `/properties/${property.id}/rooms/${room.id}`
                  }
                >
                  {t("workspace.review")}
                  <ArrowUpRight size={15} aria-hidden />
                </Link>
                <Link
                  className="inline-flex min-h-11 items-center text-xs text-muted-foreground underline underline-offset-4"
                  href={`/properties/${property.id}/rooms/${room.id}`}
                >
                  {t("workspace.roomRecord")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
        {!rooms.length && (
          <p role="status" className="py-12 text-muted-foreground">
            {t("workspace.noResults")}
          </p>
        )}
      </section>
    </div>
  );
}
