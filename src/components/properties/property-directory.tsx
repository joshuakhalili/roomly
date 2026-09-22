"use client";
import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Building2, Search, ArrowUpRight } from "lucide-react";
export type DirectoryProperty = {
  id: string;
  name: string;
  address: string | null;
  image: string | null;
  occupied: number;
  total: number;
  rent: string;
};
export function PropertyDirectory({
  properties,
}: {
  properties: DirectoryProperty[];
}) {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const list = properties.filter((p) =>
    `${p.name} ${p.address ?? ""}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  return (
    <section aria-label={t("workspace.directory")}>
      <div className="workspace-toolbar">
        <label className="workspace-search">
          <Search size={18} aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("workspace.searchProperties")}
            aria-label={t("workspace.searchProperties")}
          />
        </label>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {list.length} / {properties.length}
        </span>
      </div>
      <div>
        {list.map((p) => (
          <Link
            className="directory-row"
            href={`/properties/${p.id}`}
            key={p.id}
          >
            {p.image ? (
              <Image unoptimized width={72} height={72} className="directory-photo" src={p.image} alt="" />
            ) : (
              <span className="directory-photo">
                <Building2 size={25} aria-hidden />
              </span>
            )}
            <div>
              <h2>{p.name}</h2>
              <p>{p.address}</p>
            </div>
            <div className="directory-occupancy">
              <span className="directory-label">{t("rooms.title")}</span>
              <strong className="text-sm font-medium">
                {t("dashboard.occupiedRooms", {
                  occupied: p.occupied,
                  total: p.total,
                })}
              </strong>
            </div>
            <div className="directory-financial">
              <span className="directory-label">
                {t("properties.rentRoll")}
              </span>
              <strong className="figure font-medium">{p.rent}</strong>
              <span className="text-xs text-muted-foreground">
                {" "}
                {t("properties.perMonth")}
              </span>
            </div>
            <ArrowUpRight
              className="directory-arrow text-primary"
              size={19}
              aria-hidden
            />
          </Link>
        ))}
      </div>
      {!list.length && (
        <p role="status" className="py-12 text-muted-foreground">
          {t("workspace.noResults")}
        </p>
      )}
    </section>
  );
}
