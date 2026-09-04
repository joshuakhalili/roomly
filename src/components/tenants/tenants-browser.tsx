"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { OptionSelect } from "@/components/ui/option-select";
import {
  Collapsible,
  CollapsibleChevron,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronRight,
  Mail,
  Phone,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { APP_LANGUAGES, LANGUAGE_LABELS } from "@/lib/types";
import type { Property, Tenant } from "@/lib/types";

/** A tenant with the letting they are in now, if any. */
export interface TenantWithPlace extends Tenant {
  place: {
    roomName: string;
    propertyId: string | null;
    propertyName: string | null;
  } | null;
  /** Which of their required identity documents are still missing. */
  missingDocuments: number;
}

/**
 * Housed, between lettings, or archived.
 *
 * These were three metric cards above an undifferentiated grid, which put the
 * counts in the same visual language as the people they were counting — three
 * more cards on a page whose problem was already too many cards. They are one
 * bar now, and the bar is the filter rather than a readout next to it.
 */
type Segment = "housed" | "unplaced" | "archived" | "all";

const ALL = "__all__";

function initials(tenant: Tenant) {
  return `${tenant.first_name.at(0) ?? ""}${tenant.surname.at(0) ?? ""}`.toUpperCase();
}

function TenantCard({ tenant }: { tenant: TenantWithPlace }) {
  const t = useTranslations();

  return (
    <Link
      href={`/tenants/${tenant.id}`}
      className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card interactive className={tenant.is_archived ? "h-full opacity-75" : "h-full"}>
        <CardContent className="flex h-full items-start gap-3 p-5">
          {/* Initials rather than an icon: in a grid of thirty people the
              same generic silhouette thirty times helps nobody find anyone. */}
          <span
            className="figure flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground"
            aria-hidden
          >
            {initials(tenant)}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">
              {tenant.first_name} {tenant.surname}
            </p>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {tenant.place ? (
                <>
                  <Badge variant="secondary">{tenant.place.roomName}</Badge>
                  {tenant.place.propertyName && (
                    <span className="truncate text-xs text-muted-foreground">
                      {tenant.place.propertyName}
                    </span>
                  )}
                </>
              ) : (
                /* Outline, not a status colour. Being between lettings is a
                   category, not something to act on — the grouping and the
                   label say it, and colour would be shouting a fact. */
                <Badge variant="outline">
                  {tenant.is_archived
                    ? t("tenants.archived")
                    : t("tenants.unassigned")}
                </Badge>
              )}
              {/* Missing paperwork, on the other hand, is a job. */}
              {tenant.missingDocuments > 0 && !tenant.is_archived && (
                <Badge variant="warning">
                  {t("tenants.missingDocs", { count: tenant.missingDocuments })}
                </Badge>
              )}
            </div>

            {(tenant.phone || tenant.email) && (
              <div className="mt-2.5 flex flex-col gap-1">
                {tenant.phone && (
                  <p className="figure flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <Phone className="size-3 shrink-0" aria-hidden />
                    {tenant.phone}
                  </p>
                )}
                {tenant.email && (
                  <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <Mail className="size-3 shrink-0" aria-hidden />
                    {tenant.email}
                  </p>
                )}
              </div>
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
}

function Group({
  title,
  tenants,
}: {
  title: string;
  tenants: TenantWithPlace[];
}) {
  if (tenants.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h2 className="font-semibold">{title}</h2>
        <Badge variant="secondary">{tenants.length}</Badge>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tenants.map((tenant) => (
          <TenantCard key={tenant.id} tenant={tenant} />
        ))}
      </div>
    </section>
  );
}

export function TenantsBrowser({
  tenants,
  properties,
}: {
  tenants: TenantWithPlace[];
  properties: Property[];
}) {
  const t = useTranslations();

  const [segment, setSegment] = useState<Segment>("all");
  const [search, setSearch] = useState("");
  const [propertyId, setPropertyId] = useState(ALL);
  const [language, setLanguage] = useState(ALL);
  const [country, setCountry] = useState(ALL);
  const [contactable, setContactable] = useState(false);
  const [missingOnly, setMissingOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  /* Built from what is actually on file rather than a fixed list — a country
     nobody has come from is a filter that can only ever return nothing. */
  const countries = useMemo(
    () =>
      [...new Set(tenants.map((x) => x.country_of_origin).filter(Boolean))]
        .sort()
        .map((c) => ({ value: c as string, label: c as string })),
    [tenants],
  );

  const counts = useMemo(() => {
    const active = tenants.filter((x) => !x.is_archived);
    return {
      housed: active.filter((x) => x.place).length,
      unplaced: active.filter((x) => !x.place).length,
      archived: tenants.filter((x) => x.is_archived).length,
      all: tenants.length,
    };
  }, [tenants]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tenants
      .filter((x) => {
        if (segment === "archived") return x.is_archived;
        if (segment === "housed") return !x.is_archived && x.place;
        if (segment === "unplaced") return !x.is_archived && !x.place;
        return true;
      })
      .filter((x) => propertyId === ALL || x.place?.propertyId === propertyId)
      .filter((x) => language === ALL || x.preferred_language === language)
      .filter((x) => country === ALL || x.country_of_origin === country)
      .filter((x) => !contactable || Boolean(x.phone || x.email || x.wechat_id))
      .filter((x) => !missingOnly || x.missingDocuments > 0)
      .filter(
        (x) =>
          !needle ||
          `${x.first_name} ${x.surname}`.toLowerCase().includes(needle) ||
          x.email?.toLowerCase().includes(needle) ||
          x.phone?.toLowerCase().includes(needle) ||
          x.wechat_id?.toLowerCase().includes(needle),
      );
  }, [
    tenants,
    segment,
    propertyId,
    language,
    country,
    contactable,
    missingOnly,
    search,
  ]);

  const activeFilters =
    (propertyId !== ALL ? 1 : 0) +
    (language !== ALL ? 1 : 0) +
    (country !== ALL ? 1 : 0) +
    (contactable ? 1 : 0) +
    (missingOnly ? 1 : 0);

  function clearFilters() {
    setPropertyId(ALL);
    setLanguage(ALL);
    setCountry(ALL);
    setContactable(false);
    setMissingOnly(false);
  }

  const SEGMENTS: { key: Segment; label: string; count: number }[] = [
    { key: "all", label: t("filters.all"), count: counts.all },
    { key: "housed", label: t("tenants.inARoom"), count: counts.housed },
    { key: "unplaced", label: t("tenants.unassigned"), count: counts.unplaced },
    { key: "archived", label: t("tenants.archived"), count: counts.archived },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* One bar, in place of three stat cards. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {SEGMENTS.map((s) => (
            <Button
              key={s.key}
              size="sm"
              variant={segment === s.key ? "default" : "outline"}
              onClick={() => setSegment(s.key)}
              aria-pressed={segment === s.key}
            >
              {s.label}
              <span className="figure opacity-70">{s.count}</span>
            </Button>
          ))}
        </div>

        <div className="relative min-w-44 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("tenants.searchPlaceholder")}
            className="pl-8"
            aria-label={t("tenants.searchPlaceholder")}
          />
        </div>

        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-auto">
              <SlidersHorizontal className="size-4" aria-hidden />
              {t("filters.title")}
              {activeFilters > 0 && (
                <Badge variant="secondary">{activeFilters}</Badge>
              )}
              <CollapsibleChevron />
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      </div>

      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleContent>
          <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <OptionSelect
                value={propertyId}
                onValueChange={setPropertyId}
                options={[
                  { value: ALL, label: t("filters.allProperties") },
                  ...properties.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
              <OptionSelect
                value={language}
                onValueChange={setLanguage}
                options={[
                  { value: ALL, label: t("tenants.anyLanguage") },
                  ...APP_LANGUAGES.map((code) => ({
                    value: code,
                    label: LANGUAGE_LABELS[code],
                  })),
                ]}
              />
              {countries.length > 0 && (
                <OptionSelect
                  value={country}
                  onValueChange={setCountry}
                  options={[
                    { value: ALL, label: t("tenants.anyCountry") },
                    ...countries,
                  ]}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="contactable"
                  checked={contactable}
                  onCheckedChange={(v) => setContactable(v === true)}
                />
                <Label htmlFor="contactable" className="font-normal">
                  {t("tenants.hasContact")}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="missingOnly"
                  checked={missingOnly}
                  onCheckedChange={(v) => setMissingOnly(v === true)}
                />
                <Label htmlFor="missingOnly" className="font-normal">
                  {t("tenants.missingDocsOnly")}
                </Label>
              </div>
              {activeFilters > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  {t("filters.clear")}
                </Button>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t("filters.noResults")}
        </p>
      ) : segment === "all" ? (
        /* Grouped rather than one long grid: on "everyone" the useful
           distinction is who is housed and who is not, and a badge buried in
           each card is not a distinction you can see from the top of a page. */
        <div className="flex flex-col gap-8">
          <Group
            title={t("tenants.inARoom")}
            tenants={filtered.filter((x) => !x.is_archived && x.place)}
          />
          <Group
            title={t("tenants.unassigned")}
            tenants={filtered.filter((x) => !x.is_archived && !x.place)}
          />
          <Group
            title={t("tenants.archived")}
            tenants={filtered.filter((x) => x.is_archived)}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((tenant) => (
            <TenantCard key={tenant.id} tenant={tenant} />
          ))}
        </div>
      )}
    </div>
  );
}
