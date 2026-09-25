import { getTranslations, getFormatter } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { DashboardData } from "@/lib/queries/dashboard";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Banknote,
  CircleCheck,
  DoorOpen,
  FileWarning,
  LogIn,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

type Step = {
  key: string;
  Icon: LucideIcon;
  title: string;
  detail: string;
  href: string;
  cta: string;
  tone: "danger" | "warning" | "neutral";
};

const TONE_ICON: Record<Step["tone"], string> = {
  danger: "bg-destructive-muted text-destructive",
  warning: "bg-warning-muted text-warning",
  neutral: "bg-accent text-accent-foreground",
};

/**
 * The dashboard's first answer: what to do next, in order.
 *
 * Six tiles tell you how things are; they leave you to work out which one
 * matters. This ranks the open problems the way an experienced manager would
 * (money owed, then legal deadlines, then paperwork, then empty rooms) and
 * puts the first one in reach of a single click.
 */
export async function NextUp({
  metrics,
  alerts,
  certificateIssues,
}: {
  metrics: DashboardData["metrics"];
  alerts: DashboardData["alerts"];
  certificateIssues: { expired: number; dueSoon: number; deposits: number };
}) {
  const t = await getTranslations("nextUp");
  const format = await getFormatter();
  const money = (n: number) =>
    format.number(n, { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

  const owing = alerts.filter((a) => a.kind === "rent_overdue").length;
  const arrivals = alerts.filter((a) => a.kind === "move_in").length;
  const steps: Step[] = [];

  if (metrics.overdueTotal > 0)
    steps.push({
      key: "rent",
      Icon: Banknote,
      title: t("rentTitle", { amount: money(metrics.overdueTotal) }),
      detail: t("rentDetail", { payments: metrics.overdueCount, people: owing }),
      href: "/rent",
      cta: t("rentCta"),
      tone: "danger",
    });
  if (certificateIssues.expired + certificateIssues.deposits > 0)
    steps.push({
      key: "compliance",
      Icon: ShieldAlert,
      title: t("complianceTitle", { count: certificateIssues.expired + certificateIssues.deposits }),
      detail: t("complianceDetail", { dueSoon: certificateIssues.dueSoon }),
      href: "/compliance",
      cta: t("complianceCta"),
      tone: "danger",
    });
  if (arrivals > 0)
    steps.push({
      key: "arrivals",
      Icon: LogIn,
      title: t("arrivalsTitle", { count: arrivals }),
      detail: t("arrivalsDetail"),
      href: "/inventory",
      cta: t("arrivalsCta"),
      tone: "neutral",
    });
  if (metrics.complianceGaps > 0)
    steps.push({
      key: "documents",
      Icon: FileWarning,
      title: t("documentsTitle", { count: metrics.complianceGaps }),
      detail: t("documentsDetail"),
      href: "/documents",
      cta: t("documentsCta"),
      tone: "warning",
    });
  if (metrics.vacantRooms > 0)
    steps.push({
      key: "vacant",
      Icon: DoorOpen,
      title: t("vacantTitle", { count: metrics.vacantRooms }),
      detail: t("vacantDetail", { rate: metrics.occupancyRate }),
      href: "/properties",
      cta: t("vacantCta"),
      tone: "neutral",
    });

  if (!steps.length) {
    return (
      <section className="flex items-center gap-4 rounded-2xl border p-5">
        <span className="flex size-10 items-center justify-center rounded-full bg-success-muted">
          <CircleCheck className="size-5 text-success" aria-hidden />
        </span>
        <div>
          <p className="font-semibold">{t("clearTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("clearDetail")}</p>
        </div>
      </section>
    );
  }

  const [first, ...rest] = steps.slice(0, 4);

  return (
    <section aria-labelledby="next-up" className="grid gap-3 lg:grid-cols-[1.25fr_1fr] [&>*]:min-w-0">
      <h2 id="next-up" className="sr-only">
        {t("heading")}
      </h2>
      <Link
        href={first.href}
        className="next-up-lead group relative flex flex-col justify-between gap-6 overflow-hidden rounded-2xl p-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl next-up-chip">
            <first.Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-70">{t("heading")}</p>
            <p className="mt-1 text-xl font-semibold leading-snug">{first.title}</p>
            <p className="mt-1 text-sm opacity-80">{first.detail}</p>
          </div>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-lg next-up-cta px-3.5 py-2 text-sm font-semibold transition-transform duration-(--duration) ease-(--ease-out) group-hover:translate-x-0.5">
          {first.cta}
          <ArrowRight className="size-4" aria-hidden />
        </span>
      </Link>

      {rest.length > 0 && (
        <ul className="flex flex-col divide-y rounded-2xl border">
          {rest.map((s) => (
            <li key={s.key} className="flex-1">
              <Link
                href={s.href}
                className="group flex h-full items-center gap-3 px-4 py-3.5 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/70"
              >
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TONE_ICON[s.tone])}>
                  <s.Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{s.detail}</span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
