import { getTranslations, getFormatter, setRequestLocale } from "next-intl/server";
import { getDashboardData } from "@/lib/queries/dashboard";
import { MetricCard } from "@/components/metrics/metric-card";
import { DeltaBadge } from "@/components/metrics/delta-badge";
import { AlertsStrip } from "@/components/dashboard/alerts-strip";
import { RoomGrid } from "@/components/dashboard/room-grid";
import { SegmentMeter, ProgressMeter } from "@/components/charts/segment-meter";
import {
  Building2,
  DoorOpen,
  Banknote,
  ArrowLeftRight,
  FileWarning,
  PiggyBank,
} from "lucide-react";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const format = await getFormatter();
  const { rooms, properties, alerts, metrics, comparison, collectionTrend } =
    await getDashboardData();

  const money = (n: number) =>
    format.number(n, {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    });

  const vsCaption = comparison
    ? t("dashboard.vsDaysAgo", { days: comparison.days })
    : "";

  /* A trend line through seven zeros is a flat line that looks like real data
     saying "nothing changed", when what it actually means is "nothing recorded
     yet". Draw nothing instead. */
  const trend = collectionTrend.some((m) => m.amount > 0)
    ? collectionTrend.map((m) => m.amount)
    : undefined;

  const occupancyDelta = comparison
    ? metrics.occupancyRate - comparison.occupancyRate
    : 0;
  const vacantDelta = comparison ? metrics.vacantRooms - comparison.vacantRooms : 0;
  const overdueDelta = comparison
    ? metrics.overdueTotal - comparison.overdueTotal
    : 0;
  const moves = metrics.moveInsThisWeek + metrics.moveOutsThisWeek;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.subtitle")}
        </p>
      </header>

      {/* The bento.

          Twelve columns, and the tiles deliberately do not all fit the same
          box. Money takes seven columns and two rows because it is the thing
          you open this page to see; the three tiles along the bottom are the
          ones you check rather than watch.

          Colour does the second half of that job. Each tile wears the hue of
          what it measures, and a tile with nothing to report wears none — so
          how alarming the board looks tracks how much is actually wrong. */}
      <section className="rise-in grid grid-cols-12 gap-4">
        <MetricCard
          className="col-span-12 lg:col-span-7 lg:row-span-2"
          label={t("dashboard.collectedThisMonth")}
          value={money(metrics.collectedThisMonth)}
          hint={t("dashboard.ofExpected", {
            amount: money(metrics.dueThisMonth),
          })}
          Icon={PiggyBank}
          size="xl"
          muted={metrics.dueThisMonth === 0}
          trend={trend}
          href="/analytics#money"
          footer={
            metrics.dueThisMonth > 0 ? (
              <div className="flex flex-col gap-2">
                <ProgressMeter
                  value={metrics.collectedThisMonth}
                  max={metrics.dueThisMonth}
                />
                <p className="figure text-xs text-muted-foreground">
                  {t("dashboard.outstandingThisMonth", {
                    amount: money(
                      Math.max(
                        0,
                        metrics.dueThisMonth - metrics.collectedThisMonth,
                      ),
                    ),
                  })}
                </p>
              </div>
            ) : undefined
          }
        />

        <MetricCard
          className="col-span-6 lg:col-span-5"
          label={t("dashboard.overdueRent")}
          value={money(metrics.overdueTotal)}
          hint={t("dashboard.overdueCount", { count: metrics.overdueCount })}
          Icon={Banknote}
          size="lg"
          tone="danger"
          muted={metrics.overdueTotal === 0}
          href="/rent"
          delta={
            comparison ? (
              <DeltaBadge
                delta={overdueDelta}
                label={money(Math.abs(overdueDelta))}
                caption={vsCaption}
                polarity="up-bad"
              />
            ) : undefined
          }
        />

        <MetricCard
          className="col-span-6 lg:col-span-5"
          label={t("dashboard.occupancyRate")}
          value={`${metrics.occupancyRate}%`}
          hint={t("dashboard.occupiedRooms", {
            occupied: metrics.occupiedRooms,
            total: metrics.lettableRooms,
          })}
          Icon={Building2}
          size="lg"
          href="/analytics#occupancy"
          delta={
            comparison ? (
              <DeltaBadge
                delta={occupancyDelta}
                label={t("dashboard.points", {
                  points: Math.abs(occupancyDelta),
                })}
                caption={vsCaption}
                polarity="up-good"
              />
            ) : undefined
          }
          footer={
            <SegmentMeter
              total={metrics.lettableRooms}
              filled={metrics.occupiedRooms}
              tone="brand"
            />
          }
        />

        <MetricCard
          className="col-span-6 lg:col-span-4"
          label={t("dashboard.vacantRooms")}
          value={metrics.vacantRooms}
          hint={t("dashboard.vacantOfTotal", {
            total: metrics.lettableRooms,
          })}
          Icon={DoorOpen}
          muted={metrics.vacantRooms === 0}
          href="/analytics#turnover"
          delta={
            comparison ? (
              <DeltaBadge
                delta={vacantDelta}
                label={t("dashboard.roomsDelta", {
                  count: Math.abs(vacantDelta),
                })}
                caption={vsCaption}
                polarity="up-bad"
              />
            ) : undefined
          }
        />

        {/* Moves are neither good nor bad — people arrive and leave. Left
            uncoloured on purpose, so the tiles that *are* coloured mean it. */}
        <MetricCard
          className="col-span-6 lg:col-span-4"
          label={t("dashboard.upcomingMoves")}
          value={moves}
          hint={t("dashboard.movesCount", {
            moveIns: metrics.moveInsThisWeek,
            moveOuts: metrics.moveOutsThisWeek,
          })}
          Icon={ArrowLeftRight}
          muted={moves === 0}
          href="/analytics#turnover"
        />

        <MetricCard
          className="col-span-12 lg:col-span-4"
          label={t("dashboard.complianceGaps")}
          value={metrics.complianceGaps}
          hint={t("dashboard.complianceCount", {
            count: metrics.complianceGaps,
          })}
          Icon={FileWarning}
          tone="warning"
          muted={metrics.complianceGaps === 0}
          href="/documents"
        />
      </section>

      <AlertsStrip alerts={alerts} />

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("dashboard.rooms")}</h2>
        <RoomGrid rooms={rooms} properties={properties} />
      </div>
    </div>
  );
}
