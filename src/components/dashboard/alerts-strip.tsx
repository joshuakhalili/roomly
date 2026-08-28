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
 * Today's alerts, as a row of cards you scroll sideways.
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

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h2 className="font-semibold">{t("dashboard.alerts")}</h2>
        <Badge variant="secondary">{sorted.length}</Badge>
      </div>

      {/* The negative margin lets the strip bleed to the page edge on a phone,
          so a half-visible card at the right announces there is more without
          needing a scrollbar to say it. */}
      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <ul className="flex snap-x snap-mandatory gap-3">
          {sorted.map((a, i) => {
            const { Icon, tone } = STYLES[a.kind];
            return (
              <li
                key={`${a.kind}-${a.tenancyId}-${i}`}
                className="w-60 shrink-0 snap-start"
              >
                <Link
                  href={`/tenancies/${a.tenancyId}`}
                  className="block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {/* The card is plain; only the little chip is coloured.
                      The chip is where colour earns its place here — it says
                      *what kind* of thing this is, which is the one question
                      you ask when scanning a row of alerts. Washing the whole
                      card said the same thing eight times louder. */}
                  <Card interactive size="sm" className="h-full">
                    <CardContent className="flex h-full flex-col gap-2.5 p-4">
                      <span
                        className={cn(
                          "inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                          TONE_CHIP[tone],
                        )}
                      >
                        <Icon className="size-3.5 shrink-0" aria-hidden />
                        {heading(a)}
                      </span>

                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {a.kind === "cleaning" ? a.roomName : a.personName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {a.kind === "cleaning" ? detail(a) : a.roomName}
                        </p>
                      </div>

                      {/* The amount and how long it has been running are two
                          separate facts, and a 240px card cannot hold them on
                          one line — side by side, the count was being
                          truncated to "7 payments since Jan 3…". Stacked, both
                          are readable and the money gets to be a figure. */}
                      {a.kind !== "cleaning" && (
                        <div className="mt-auto">
                          {a.kind === "rent_overdue" ? (
                            <>
                              <p className="figure text-xl font-semibold text-destructive">
                                {money(a.amount ?? 0)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {detail(a)}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm font-medium">{detail(a)}</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
