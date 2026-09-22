"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Search, ArrowUpRight } from "lucide-react";
export type RoomEntry = {
  id: string;
  name: string;
  type: string;
  occupant: string;
  status: "occupied" | "upcoming" | "vacant" | "shared";
};
export function RoomDirectory({
  propertyId,
  rooms,
}: {
  propertyId: string;
  rooms: RoomEntry[];
}) {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const list = rooms.filter(room => `${room.name} ${room.occupant}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return (
    <div>
      <label className="workspace-search py-4">
        <Search size={18} aria-hidden />
        <input
          aria-label={t("workspace.searchRooms")}
          placeholder={t("workspace.searchRooms")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div>
        {list          .map((room) => (
            <Link
              key={room.id}
              href={`/properties/${propertyId}/rooms/${room.id}`}
              className="room-row"
            >
              <div>
                <strong className="font-medium">{room.name}</strong>
                <small className="directory-label mt-1">{room.type}</small>
              </div>
              <span className="room-detail text-sm">
                {room.occupant || "—"}
              </span>
              <span className="room-detail text-sm text-muted-foreground">
                {t(
                  room.status === "shared"
                    ? "rooms.isCommonArea"
                    : `rooms.${room.status}`,
                )}
              </span>
              <ArrowUpRight
                className="room-arrow text-primary"
                size={18}
                aria-hidden
              />
            </Link>
          ))}
      </div>
      {!list.length && <p role="status" className="py-10 text-muted-foreground">{t("workspace.noResults")}</p>}
    </div>
  );
}
