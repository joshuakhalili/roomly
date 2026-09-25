import { getTranslations, getFormatter } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { DashboardAlert } from "@/lib/queries/dashboard";
import { cn } from "@/lib/utils";
import { TONE_CHIP, type Tone } from "@/lib/tone";
import {
  LogIn,
  LogOut,
  Banknote,
  Sparkles,
  CircleCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * Today's alerts, most urgent first.
 *
 * The list this replaces had two problems, and only one of them was styling.
 * It was a plain divided list, so an urgent thing and a routine thing looked
 * identical; and it repeated a tenant once per unpaid month, so thirteen
 * overdue payments across three people filled the screen and hid the move-ins
 * underneath. The grouping happens in the query — see `DashboardAlert.count` —
 * and this is what makes the result readable: one card per problem, the kind
 * of problem named and coloured, the number that matters set as a figure.
 */
const STYLES: Record<DashboardAlert["kind"], { Icon: LucideIcon; tone: Tone }> = {
  rent_overdue: { Icon: Banknote, tone: "danger" },
  move_in: { Icon: LogIn, tone: "success" },
  move_out: { Icon: LogOut, tone: "warning" },
  cleaning: { Icon: Sparkles, tone: "brand" },
};

export async function AlertsStrip({ alerts }: { alerts: DashboardAlert[] }) {
  const t = await getTranslations();
  const format = await getFormatter();

  const money = (n: number) =>
    format.number(n, { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "medium" });

  // Most urgent first: money owed, then people arriving or leaving, then
  // cleaning, which can always wait a day.
  const order: DashboardAlert["kind"][] = [
    "rent_overdue",
    "move_in",
    "move_out",
    "cleaning",
  ];
  const sorted = [...alerts].sort(
    (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind),
  );

  if (sorted.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-muted">
            <CircleCheck className="size-4.5 text-success" aria-hidden />
          </span>
          <div>
            <p className="font-medium">{t("dashboard.alerts")}</p>
            <p className="text-sm text-muted-foreground">
              {t("dashboard.noAlerts")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  function heading(a: DashboardAlert) {
    switch (a.kind) {
      case "rent_overdue":
        return t("alerts.kindOverdue");
      case "move_in":
        return t("alerts.kindMoveIn");
      case "move_out":
        return t("alerts.kindMoveOut");
      case "cleaning":
        return t("alerts.kindCleaning");
    }
  }

  function detail(a: DashboardAlert) {
    switch (a.kind) {
      case "rent_overdue":
        return t("alerts.overdueSince", {
          count: a.count ?? 1,
          date: a.date ? date(a.date) : "",
        });
      case "move_in":
      case "move_out":
        return t("alerts.inDays", { days: a.days ?? 0 });
      case "cleaning":
        return t("alerts.endedOn", { date: a.date ? date(a.date) : "" });
    }
  }

  const renderAlert = (a: DashboardAlert, i: number) => {
    const { Icon, tone } = STYLES[a.kind];
    return (
      <li key={`${a.kind}-${a.tenancyId}-${i}`}>
        <Link
          href={`/tenancies/${a.tenancyId}`}
          className="group flex items-center gap-3 rounded-xl px-3 py-3 outline-none transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* The chip carries the kind of problem; the row stays plain. */}
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              TONE_CHIP[tone],
            )}
            title={heading(a)}
          >
            <Icon className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {a.kind === "cleaning" ? a.roomName : a.personName}
              <span className="font-normal text-muted-foreground"> · {heading(a)}</span>
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {a.kind === "cleaning" ? detail(a) : `${a.roomName} · ${detail(a)}`}
            </span>
          </span>
          {a.kind === "rent_overdue" && (
            <span className="figure shrink-0 text-sm font-semibold text-destructive">
              {money(a.amount ?? 0)}
            </span>
          )}
        </Link>
      </li>
    );
  };

  /* A list, not a sideways strip. The strip hid everything past the fourth
     card behind a scroll nobody noticed; six rows with the rest one click
     away shows more and hides nothing. */
  const VISIBLE = 6;
  const shown = sorted.slice(0, VISIBLE);
  const more = sorted.slice(VISIBLE);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h2 className="font-semibold">{t("dashboard.alerts")}</h2>
        <Badge variant="secondary">{sorted.length}</Badge>
      </div>
      <ul className="grid gap-x-4 rounded-2xl border p-1.5 md:grid-cols-2">
        {shown.map(renderAlert)}
      </ul>
      {more.length > 0 && (
        <details className="group/more">
          <summary className="w-fit cursor-pointer list-none rounded-md px-2 py-1 text-sm font-medium text-primary hover:underline">
            <span className="group-open/more:hidden">{t("dashboard.showAll", { count: sorted.length })}</span>
            <span className="hidden group-open/more:inline">{t("dashboard.showFewer")}</span>
          </summary>
          <ul className="mt-2 grid gap-x-4 rounded-2xl border p-1.5 md:grid-cols-2">
            {more.map((a, i) => renderAlert(a, i + VISIBLE))}
          </ul>
        </details>
      )}
    </section>
  );
}
