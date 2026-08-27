import { getTranslations, getFormatter } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { DashboardAlert } from "@/lib/queries/dashboard";
import { cn } from "@/lib/utils";
import {
  LogIn,
  LogOut,
  Banknote,
  Sparkles,
  CircleCheck,
  type LucideIcon,
} from "lucide-react";

const STYLES: Record<
  DashboardAlert["kind"],
  { Icon: LucideIcon; className: string }
> = {
  move_in: { Icon: LogIn, className: "text-blue-600 dark:text-blue-400" },
  move_out: { Icon: LogOut, className: "text-amber-600 dark:text-amber-500" },
  rent_overdue: { Icon: Banknote, className: "text-destructive" },
  cleaning: { Icon: Sparkles, className: "text-violet-600 dark:text-violet-400" },
};

export async function AlertsPanel({ alerts }: { alerts: DashboardAlert[] }) {
  const t = await getTranslations();
  const format = await getFormatter();

  function describe(a: DashboardAlert) {
    switch (a.kind) {
      case "move_in":
        return t("alerts.moveInSoon", {
          name: a.personName,
          room: a.roomName,
          days: a.days ?? 0,
        });
      case "move_out":
        return t("alerts.moveOutSoon", {
          name: a.personName,
          room: a.roomName,
          days: a.days ?? 0,
        });
      case "rent_overdue":
        return t("alerts.rentOverdue", {
          name: a.personName,
          room: a.roomName,
          amount: format.number(a.amount ?? 0, {
            style: "currency",
            currency: "GBP",
          }),
          date: a.date
            ? format.dateTime(new Date(a.date), { dateStyle: "medium" })
            : "",
        });
      case "cleaning":
        return t("alerts.cleaningDue", {
          room: a.roomName,
          date: a.date
            ? format.dateTime(new Date(a.date), { dateStyle: "medium" })
            : "",
        });
    }
  }

  // Most urgent first: overdue money, then people arriving/leaving, then cleaning.
  const order: DashboardAlert["kind"][] = [
    "rent_overdue",
    "move_in",
    "move_out",
    "cleaning",
  ];
  const sorted = [...alerts].sort(
    (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind),
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("dashboard.alerts")}</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <CircleCheck className="size-4 text-emerald-600" aria-hidden />
            {t("dashboard.noAlerts")}
          </p>
        ) : (
          <ul className="divide-y">
            {sorted.map((a, i) => {
              const { Icon, className } = STYLES[a.kind];
              return (
                <li key={`${a.kind}-${a.tenancyId}-${i}`}>
                  <Link
                    href={`/tenancies/${a.tenancyId}`}
                    className="flex items-start gap-3 py-3 text-sm hover:underline"
                  >
                    <Icon
                      className={cn("mt-0.5 size-4 shrink-0", className)}
                      aria-hidden
                    />
                    <span className="min-w-0">{describe(a)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
