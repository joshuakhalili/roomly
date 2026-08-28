import { getTranslations, getFormatter, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OccupancyTrend } from "@/components/analytics/occupancy-trend";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { ChartLine } from "lucide-react";
import type { Tenancy } from "@/lib/types";

const REASON_KEY = {
  end_of_term: "tenancy.reasonEndOfTerm",
  tenant_gave_notice: "tenancy.reasonTenantNotice",
  given_notice_by_admin: "tenancy.reasonAdminNotice",
  other: "tenancy.reasonOther",
} as const;

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const format = await getFormatter();

  const supabase = await createClient();

  // Twelve months back — long enough to see a pattern, short enough that
  // "what does this property cost to run" means something current.
  const yearStart = new Date();
  yearStart.setFullYear(yearStart.getFullYear() - 1);
  const yearStartIso = yearStart.toISOString().slice(0, 10);

  const [
    { data: snapshots },
    { data: tenancies },
    { data: rooms },
    { data: properties },
    { data: jobs },
    { data: assets },
    { data: rentPaid },
  ] = await Promise.all([
      supabase
        .from("metrics_snapshots")
        .select("*")
        .order("snapshot_date", { ascending: true })
        .limit(180),
      supabase.from("tenancies").select("*"),
      supabase.from("rooms").select("id, name, property_id, is_lettable, is_common_area"),
      supabase.from("properties").select("id, name").order("name"),
      // Cancelled work never happened, so it must not appear as a cost.
      supabase
        .from("maintenance_jobs")
        .select("property_id, cost, is_paid, status, scheduled_for, service_type_id")
        .neq("status", "cancelled")
        .gte("scheduled_for", yearStartIso),
      supabase
        .from("assets")
        .select("property_id, cost, purchased_on")
        .gte("purchased_on", yearStartIso),
      supabase
        .from("rent_payments")
        .select("tenancy_id, amount_due, due_date")
        .eq("status", "paid")
        .gte("due_date", yearStartIso),
    ]);

  const { data: serviceTypes } = await supabase
    .from("service_types")
    .select("id, name, slug");

  const all = (tenancies ?? []) as Tenancy[];

  /**
   * Average days a room sat empty between one tenancy ending and the next
   * beginning — the "time to fill" a letting agent would quote.
   */
  const gaps: number[] = [];
  const byRoom = new Map<string, Tenancy[]>();
  for (const t of all) {
    const list = byRoom.get(t.room_id) ?? [];
    list.push(t);
    byRoom.set(t.room_id, list);
  }
  for (const list of byRoom.values()) {
    const ordered = [...list].sort((a, b) =>
      a.start_date < b.start_date ? -1 : 1,
    );
    for (let i = 1; i < ordered.length; i++) {
      const previousEnd = ordered[i - 1].end_date;
      if (!previousEnd) continue;
      const gap = differenceInCalendarDays(
        parseISO(ordered[i].start_date),
        parseISO(previousEnd),
      );
      if (gap >= 0) gaps.push(gap);
    }
  }
  const averageGap =
    gaps.length > 0
      ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
      : null;

  const reasons = new Map<string, number>();
  for (const t of all) {
    if (!t.reason_for_leaving) continue;
    reasons.set(
      t.reason_for_leaving,
      (reasons.get(t.reason_for_leaving) ?? 0) + 1,
    );
  }

  const lettable = (rooms ?? []).filter(
    (r) => r.is_lettable && !r.is_common_area,
  ).length;

  /**
   * Money in against money out, per property, over the last twelve months.
   *
   * Occupancy alone says a room is full; it cannot say whether the building
   * makes anything. Rent collected minus what was spent running it is the
   * number that answers that, and every part of it is already recorded —
   * paid rent, job costs, and things bought.
   */
  const roomToProperty = new Map(
    (rooms ?? []).map((r) => [r.id as string, r.property_id as string]),
  );
  const tenancyToProperty = new Map(
    all.map((t) => [t.id, roomToProperty.get(t.room_id) ?? ""]),
  );

  const finances = new Map<
    string,
    { income: number; jobs: number; purchases: number; unpaid: number }
  >();
  const bucket = (id: string) => {
    if (!finances.has(id))
      finances.set(id, { income: 0, jobs: 0, purchases: 0, unpaid: 0 });
    return finances.get(id)!;
  };

  for (const p of rentPaid ?? []) {
    const propertyId = tenancyToProperty.get(p.tenancy_id as string);
    if (propertyId) bucket(propertyId).income += Number(p.amount_due);
  }
  for (const j of jobs ?? []) {
    const b = bucket(j.property_id as string);
    b.jobs += Number(j.cost ?? 0);
    if (!j.is_paid) b.unpaid += Number(j.cost ?? 0);
  }
  for (const a of assets ?? []) {
    bucket(a.property_id as string).purchases += Number(a.cost ?? 0);
  }

  const propertyFinances = (properties ?? [])
    .map((p) => {
      const f = finances.get(p.id as string) ?? {
        income: 0,
        jobs: 0,
        purchases: 0,
        unpaid: 0,
      };
      return { id: p.id as string, name: p.name as string, ...f,
        spend: f.jobs + f.purchases, net: f.income - f.jobs - f.purchases };
    })
    .filter((p) => p.income > 0 || p.spend > 0)
    .sort((a, b) => b.spend - a.spend);

  const totalSpend = propertyFinances.reduce((s, p) => s + p.spend, 0);
  const totalIncome = propertyFinances.reduce((s, p) => s + p.income, 0);

  /** Where the money went, by kind of work. */
  const byService = new Map<string, number>();
  for (const j of jobs ?? []) {
    const key = (j.service_type_id as string) ?? "none";
    byService.set(key, (byService.get(key) ?? 0) + Number(j.cost ?? 0));
  }
  const serviceSpend = [...byService.entries()]
    .map(([id, amount]) => {
      const st = (serviceTypes ?? []).find((s) => s.id === id);
      return {
        id,
        label: st?.slug ? t(`maintenance.service.${st.slug}`) : (st?.name ?? "—"),
        amount,
      };
    })
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const money = (n: number) =>
    format.number(n, { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

  const points = (snapshots ?? []).map((s) => ({
    date: s.snapshot_date as string,
    occupancy:
      lettable > 0
        ? Math.round((Number(s.occupied_rooms) / lettable) * 100)
        : 0,
    rent: Number(s.total_active_rent),
    overdue: Number(s.overdue_rent_total),
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">{t("analytics.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("analytics.subtitle")}
        </p>
      </header>

      {/* Trends need history, and history only starts accumulating once the
          daily job has run a few times. Say so rather than draw a flat line. */}
      {points.length < 2 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ChartLine className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              {t("analytics.notEnoughData")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <OccupancyTrend points={points} />
      )}

      {/* ── Money in against money out ───────────────────────────────── */}
      {propertyFinances.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">{t("analytics.runningCosts")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("analytics.lastTwelveMonths")}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  {t("analytics.rentCollected")}
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-600">
                  {money(totalIncome)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  {t("analytics.spent")}
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-destructive">
                  {money(totalSpend)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  {t("analytics.net")}
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {money(totalIncome - totalSpend)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("properties.title")}</TableHead>
                    <TableHead className="text-right">
                      {t("analytics.rentCollected")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("analytics.work")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("analytics.purchases")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("analytics.net")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {propertyFinances.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.name}
                        {/* Money owed but not yet handed over is not a saving,
                            and a net figure that quietly assumes it will never
                            be paid is flattering rather than useful. */}
                        {p.unpaid > 0 && (
                          <span className="ml-2 text-xs text-destructive">
                            {t("analytics.unpaidBills", {
                              amount: money(p.unpaid),
                            })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(p.income)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(p.jobs)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(p.purchases)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium tabular-nums ${
                          p.net < 0 ? "text-destructive" : ""
                        }`}
                      >
                        {money(p.net)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {serviceSpend.length > 0 && (
            <Card>
              <CardContent className="flex flex-col gap-2 p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  {t("analytics.spendByType")}
                </p>
                {serviceSpend.map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-sm">
                      {s.label}
                    </span>
                    {/* Bars relative to the largest, so the comparison is
                        visible without an axis to read. */}
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.round((s.amount / serviceSpend[0].amount) * 100)}%`,
                        }}
                      />
                    </span>
                    <span className="w-16 shrink-0 text-right text-sm tabular-nums">
                      {money(s.amount)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium text-muted-foreground">
              {t("analytics.timeToFill")}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {averageGap === null
                ? "—"
                : t("analytics.days", { count: averageGap })}
            </p>
            {averageGap === null && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("analytics.notEnoughData")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium text-muted-foreground">
              {t("analytics.reasonsForLeaving")}
            </p>
            {reasons.size === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("analytics.notEnoughData")}
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1">
                {[...reasons.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([reason, count]) => (
                    <li
                      key={reason}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>
                        {t(REASON_KEY[reason as keyof typeof REASON_KEY])}
                      </span>
                      <span className="font-medium tabular-nums">{count}</span>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        {points.length > 0 &&
          `${t("analytics.occupancyOverTime")}: ${format.dateTime(
            new Date(points[0].date),
            { dateStyle: "medium" },
          )} — ${format.dateTime(new Date(points[points.length - 1].date), {
            dateStyle: "medium",
          })}`}
      </p>
    </div>
  );
}
