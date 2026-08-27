import { getTranslations, getFormatter, setRequestLocale } from "next-intl/server";
import { getDashboardData } from "@/lib/queries/dashboard";
import { MetricCard } from "@/components/dashboard/metric-card";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { RoomGrid } from "@/components/dashboard/room-grid";
import { Building2, DoorOpen, Banknote, ArrowLeftRight, FileWarning } from "lucide-react";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const format = await getFormatter();
  const { rooms, alerts, metrics } = await getDashboardData();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.subtitle")}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label={t("dashboard.occupancyRate")}
          value={`${metrics.occupancyRate}%`}
          hint={t("dashboard.occupiedRooms", {
            occupied: metrics.occupiedRooms,
            total: metrics.lettableRooms,
          })}
          Icon={Building2}
        />
        <MetricCard
          label={t("dashboard.vacantRooms")}
          value={metrics.vacantRooms}
          Icon={DoorOpen}
          tone={metrics.vacantRooms > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label={t("dashboard.overdueRent")}
          value={format.number(metrics.overdueTotal, {
            style: "currency",
            currency: "GBP",
            maximumFractionDigits: 0,
          })}
          hint={t("dashboard.overdueCount", { count: metrics.overdueCount })}
          Icon={Banknote}
          tone={metrics.overdueTotal > 0 ? "danger" : "neutral"}
        />
        <MetricCard
          label={t("dashboard.upcomingMoves")}
          value={metrics.moveInsThisWeek + metrics.moveOutsThisWeek}
          hint={t("dashboard.movesCount", {
            moveIns: metrics.moveInsThisWeek,
            moveOuts: metrics.moveOutsThisWeek,
          })}
          Icon={ArrowLeftRight}
        />
        <MetricCard
          label={t("dashboard.complianceGaps")}
          value={metrics.complianceGaps}
          hint={t("dashboard.complianceCount", { count: metrics.complianceGaps })}
          Icon={FileWarning}
          tone={metrics.complianceGaps > 0 ? "warning" : "neutral"}
        />
      </section>

      <AlertsPanel alerts={alerts} />

      <div>
        <h2 className="mb-3 text-lg font-semibold">{t("dashboard.rooms")}</h2>
        <RoomGrid rooms={rooms} />
      </div>
    </div>
  );
}
