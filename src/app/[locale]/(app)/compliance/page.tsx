import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { DOC_TYPE_KEYS } from "@/components/documents/doc-type-labels";
import {
  COMPLIANCE_CERTIFICATES,
  DUE_SOON_DAYS,
  getComplianceData,
  type CertificateCell,
} from "@/lib/queries/compliance";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  CalendarClock,
  CircleCheck,
  FileQuestion,
  PiggyBank,
  ShieldAlert,
} from "lucide-react";

const CELL_STYLE: Record<CertificateCell["state"], string> = {
  ok: "text-foreground",
  dueSoon: "bg-warning-muted text-warning",
  expired: "bg-destructive-muted text-destructive",
  missing: "bg-caution-muted text-caution",
};

export default async function CompliancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const format = await getFormatter();
  const { buildings, deposits, depositsHeld, counts } = await getComplianceData();

  const date = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00`), { dateStyle: "medium" });
  const money = (n: number) =>
    format.number(n, { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

  function cellText(c: CertificateCell) {
    switch (c.state) {
      case "missing":
        return t("compliance.notOnFile");
      case "expired":
        return t("compliance.expiredAgo", { days: Math.abs(c.daysLeft ?? 0) });
      case "dueSoon":
        return t("compliance.dueIn", { days: c.daysLeft ?? 0 });
      default:
        return c.expiresAt ? t("compliance.until", { date: date(c.expiresAt) }) : t("documents.noExpiry");
    }
  }

  const tiles = [
    { key: "expired", value: counts.expired, Icon: ShieldAlert, tone: "text-destructive" },
    { key: "dueSoon", value: counts.dueSoon, Icon: CalendarClock, tone: "text-warning" },
    { key: "missing", value: counts.missing, Icon: FileQuestion, tone: "text-caution" },
    { key: "deposits", value: counts.deposits, Icon: PiggyBank, tone: "text-destructive" },
  ] as const;
  const allClear = Object.values(counts).every((n) => n === 0);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("compliance.title")} subtitle={t("compliance.subtitle")} />

      {allClear && (
        <div className="flex items-center gap-3 rounded-xl border bg-success-muted/60 p-4 text-sm">
          <CircleCheck className="size-5 text-success" aria-hidden />
          {t("compliance.allClear")}
        </div>
      )}

      <section className="rise-in grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
        {tiles.map(({ key, value, Icon, tone }) => (
          <div key={key} className="flex flex-col gap-2 bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="metric-label">{t(`compliance.tile.${key}`)}</p>
              <Icon className="size-4 text-muted-foreground" aria-hidden />
            </div>
            <p className={cn("figure figure-stat", value ? tone : "text-muted-foreground")}>
              {value}
            </p>
            <p className="text-xs text-muted-foreground">
              {t(`compliance.tileHint.${key}`, { days: DUE_SOON_DAYS })}
            </p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("compliance.certificates")}</h2>
          <Link href="/documents" className="text-sm text-primary hover:underline">
            {t("compliance.openLibrary")}
          </Link>
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">{t("nav.properties")}</th>
                {COMPLIANCE_CERTIFICATES.map((type) => (
                  <th key={type} className="px-4 py-3 font-medium">
                    {t(DOC_TYPE_KEYS[type])}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buildings.map(({ property, certificates }) => (
                <tr key={property.id} className="border-b last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-medium">
                    <Link
                      href={`/properties/${property.id}?view=documents`}
                      className="group inline-flex items-center gap-1 hover:text-primary"
                    >
                      {property.name}
                      <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                    </Link>
                    {property.address && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {property.address}
                      </span>
                    )}
                  </th>
                  {certificates.map((c) => (
                    <td key={c.type} className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-medium tabular-nums",
                          CELL_STYLE[c.state],
                          c.state === "ok" && "px-0",
                        )}
                      >
                        {cellText(c)}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("compliance.deposits")}</h2>
          <p className="text-sm text-muted-foreground">{t("compliance.depositsHint")}</p>
        </div>
        {deposits.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border p-4 text-sm">
            <CircleCheck className="size-5 text-success" aria-hidden />
            {t("compliance.depositsClear", { count: depositsHeld })}
          </div>
        ) : (
          <ul className="divide-y rounded-xl border">
            {deposits.map((d) => (
              <li key={d.tenancyId}>
                <Link
                  href={`/tenancies/${d.tenancyId}`}
                  className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 transition-colors hover:bg-muted/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{d.tenantName || d.roomName}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.propertyName} · {d.roomName} · {money(d.amount)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {d.issues.map((issue) => (
                      <span
                        key={issue}
                        className="rounded-full bg-destructive-muted px-2.5 py-1 text-xs font-medium text-destructive"
                      >
                        {t(`compliance.issue.${issue}`)}
                      </span>
                    ))}
                  </div>
                  <p className={cn("w-40 text-right text-xs tabular-nums", d.daysLeft < 0 ? "text-destructive" : "text-muted-foreground")}>
                    {d.daysLeft < 0
                      ? t("compliance.deadlinePassed", { date: date(d.deadline) })
                      : t("compliance.deadlineIn", { days: d.daysLeft })}
                  </p>
                  <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
