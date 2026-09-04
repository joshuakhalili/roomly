"use client";

import { useMemo, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { parseISO } from "date-fns";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OptionSelect } from "@/components/ui/option-select";
import { ProgressMeter } from "@/components/charts/segment-meter";
import {
  Collapsible,
  CollapsibleChevron,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ExpenseDialog } from "./expense-dialog";
import { isInTaxYear, taxYear, type TaxYear } from "@/lib/tax-year";
import { Search, SlidersHorizontal, Wrench, Package, Zap, Receipt } from "lucide-react";
import type {
  Expense,
  ExpenseCategory,
  ExpenseLedgerRow,
  ExpenseSource,
  Property,
  Room,
} from "@/lib/types";

/**
 * Where a line came from, and where it is edited.
 *
 * The ledger is a reading surface — every row is owned by the screen that
 * created it, so an entry links back there rather than opening an editor that
 * would be writing to the wrong table.
 */
const SOURCE_META: Record<
  ExpenseSource,
  { Icon: typeof Wrench; labelKey: string; href: string | null }
> = {
  expense: { Icon: Receipt, labelKey: "expenses.sourceExpense", href: null },
  maintenance: {
    Icon: Wrench,
    labelKey: "expenses.sourceMaintenance",
    href: "/maintenance",
  },
  asset: { Icon: Package, labelKey: "expenses.sourceAsset", href: "/maintenance" },
  utility: { Icon: Zap, labelKey: "expenses.sourceUtility", href: null },
};

const ALL = "__all__";

export function ExpensesBrowser({
  rows,
  expenses,
  categories,
  properties,
  rooms,
  years,
}: {
  rows: ExpenseLedgerRow[];
  /** The editable subset, keyed by id, so a row can open its own dialog. */
  expenses: Expense[];
  categories: ExpenseCategory[];
  properties: Property[];
  rooms: Room[];
  years: TaxYear[];
}) {
  const t = useTranslations();
  const format = useFormatter();

  const [yearStart, setYearStart] = useState(String(years[0]?.startYear ?? ""));
  const [search, setSearch] = useState("");
  const [source, setSource] = useState(ALL);
  const [categoryId, setCategoryId] = useState(ALL);
  const [propertyId, setPropertyId] = useState(ALL);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const money = (n: number) =>
    format.number(n, { style: "currency", currency: "GBP" });

  const activeYear = useMemo(() => taxYear(Number(yearStart)), [yearStart]);

  const expenseById = useMemo(
    () => new Map(expenses.map((e) => [e.id, e])),
    [expenses],
  );
  const propertyById = useMemo(
    () => new Map(properties.map((p) => [p.id, p])),
    [properties],
  );

  /* Filtered in the browser rather than on the server: the whole year is
     already loaded, and a filter that has to make a round trip stops feeling
     like a filter. */
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows
      .filter((r) => r.spent_on && isInTaxYear(r.spent_on, activeYear))
      .filter((r) => source === ALL || r.source === source)
      .filter((r) => categoryId === ALL || r.category_id === categoryId)
      .filter((r) => propertyId === ALL || r.property_id === propertyId)
      .filter(
        (r) =>
          !needle ||
          r.description?.toLowerCase().includes(needle) ||
          r.supplier_name?.toLowerCase().includes(needle),
      )
      .sort((a, b) => (a.spent_on < b.spent_on ? 1 : -1));
  }, [rows, activeYear, source, categoryId, propertyId, search]);

  const total = visible.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

  /** Biggest first — the point of a breakdown is what dominates it. */
  const byCategory = useMemo(() => {
    const sums = new Map<string, number>();
    for (const r of visible) {
      const key = r.category_name ?? t(SOURCE_META[r.source].labelKey);
      sums.set(key, (sums.get(key) ?? 0) + Number(r.amount ?? 0));
    }
    return [...sums.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [visible, t]);

  const activeFilters =
    (source !== ALL ? 1 : 0) +
    (categoryId !== ALL ? 1 : 0) +
    (propertyId !== ALL ? 1 : 0);

  function clearFilters() {
    setSource(ALL);
    setCategoryId(ALL);
    setPropertyId(ALL);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* One bar: the year, the search, and the way into the rest. */}
      <div className="flex flex-wrap items-center gap-2">
        <OptionSelect
          value={yearStart}
          onValueChange={setYearStart}
          className="w-auto min-w-40"
          options={years.map((y) => ({
            value: String(y.startYear),
            label: t("expenses.taxYear", { label: y.label }),
          }))}
        />

        <div className="relative min-w-44 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("expenses.searchPlaceholder")}
            className="pl-8"
            aria-label={t("expenses.searchPlaceholder")}
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

      {/* Outside the trigger's own Collapsible so the panel spans the full
          width rather than the width of the button that opened it. */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleContent>
          <div className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3">
            <OptionSelect
              value={source}
              onValueChange={setSource}
              options={[
                { value: ALL, label: t("expenses.allSources") },
                ...(
                  ["expense", "maintenance", "asset", "utility"] as ExpenseSource[]
                ).map((s) => ({
                  value: s,
                  label: t(SOURCE_META[s].labelKey),
                })),
              ]}
            />
            <OptionSelect
              value={categoryId}
              onValueChange={setCategoryId}
              options={[
                { value: ALL, label: t("expenses.allCategories") },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <OptionSelect
              value={propertyId}
              onValueChange={setPropertyId}
              options={[
                { value: ALL, label: t("expenses.allProperties") },
                ...properties.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
            {activeFilters > 0 && (
              <div className="sm:col-span-3">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  {t("filters.clear")}
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* The one headline number, and what makes it up. Not a row of stat
          cards: there is a single figure worth reading here. */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div>
            <p className="metric-label">
              {t("expenses.totalFor", { label: activeYear.label })}
            </p>
            <p className="figure figure-stat">{money(total)}</p>
          </div>

          {byCategory.length > 0 && (
            <ul className="flex flex-col gap-2">
              {byCategory.map(([name, amount]) => (
                <li key={name} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{name}</span>
                    <span className="figure shrink-0 text-muted-foreground">
                      {money(amount)}
                    </span>
                  </div>
                  <ProgressMeter value={amount} max={total} tone="brand" />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {visible.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {rows.length === 0 ? t("expenses.none") : t("expenses.noneMatch")}
        </p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {visible.map((row) => {
            const meta = SOURCE_META[row.source];
            const editable = expenseById.get(row.id);
            const property = row.property_id
              ? propertyById.get(row.property_id)
              : null;

            return (
              <li key={`${row.source}-${row.id}`}>
                <Card>
                  <CardContent className="flex items-start gap-3 p-4">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <meta.Icon className="size-4" aria-hidden />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {row.description ?? t(meta.labelKey)}
                      </p>
                      <p className="figure text-xs text-muted-foreground">
                        {format.dateTime(parseISO(row.spent_on), {
                          dateStyle: "medium",
                        })}
                        {row.supplier_name ? ` · ${row.supplier_name}` : ""}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {/* Neutral: where a line came from is a category, and
                            categories do not take colour. */}
                        <Badge variant="outline">{t(meta.labelKey)}</Badge>
                        {row.category_name && (
                          <Badge variant="secondary">{row.category_name}</Badge>
                        )}
                        {property && (
                          <span className="truncate text-xs text-muted-foreground">
                            {property.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <span className="figure font-medium">
                        {money(Number(row.amount))}
                      </span>
                      {editable ? (
                        <ExpenseDialog
                          expense={editable}
                          categories={categories}
                          properties={properties}
                          rooms={rooms}
                        />
                      ) : (
                        meta.href && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={meta.href as "/"}>
                              {t("expenses.openSource")}
                            </Link>
                          </Button>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
