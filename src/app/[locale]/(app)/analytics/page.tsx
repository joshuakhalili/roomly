import { getTranslations, getFormatter, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
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
  const [{ data: snapshots }, { data: tenancies }, { data: rooms }] =
    await Promise.all([
      supabase
        .from("metrics_snapshots")
        .select("*")
        .order("snapshot_date", { ascending: true })
        .limit(180),
      supabase.from("tenancies").select("*"),
      supabase.from("rooms").select("id, name, is_lettable, is_common_area"),
    ]);

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
