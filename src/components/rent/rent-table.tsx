"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { setRentStatus } from "@/lib/actions/rent";
import { ReminderDialog } from "@/components/messaging/reminder-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, Undo2, Send, Banknote, ChevronDown, PiggyBank } from "lucide-react";
import { MetricCard } from "@/components/metrics/metric-card";
import { ProgressMeter } from "@/components/charts/segment-meter";
import type { MessageTemplate } from "@/lib/messaging";
import type { RentPayment, TenantOnTenancy } from "@/lib/types";

/**
 * A payment needs chasing only once its due date has passed.
 *
 * Nothing is flagged on the day itself — the tenant has until the end of it
 * to pay, and chasing someone the morning their rent is due is exactly the
 * intrusiveness this is meant to avoid.
 */
function overdueAsOf(p: RentPayment, todayStr: string) {
  return (p.status === "due" || p.status === "late") && p.due_date < todayStr;
}

export interface RentRow {
  payment: RentPayment;
  roomName: string;
  propertyName: string;
  tenant: TenantOnTenancy | null;
}

type Filter = "attention" | "upcoming" | "paid" | "all";

export function RentTable({
  rows,
  templates,
}: {
  rows: RentRow[];
  templates: MessageTemplate[];
}) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("attention");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const todayStr = new Date().toISOString().slice(0, 10);

  const money = (n: number) =>
    format.number(n, { style: "currency", currency: "GBP" });
  /* The banner is a headline, not a statement line: "£10,450.00" spends two
     characters on a precision nobody reads at that size. Individual payments
     keep their pence, because that is money you are about to tick off. */
  const roundMoney = (n: number) =>
    format.number(n, {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    });
  const shortDate = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "medium" });

  /**
   * One card per tenancy, not per payment.
   *
   * This page used to print the same tenant once for every month they were
   * behind — seven identical rows for one person, which pushed the other
   * twelve people off the screen and made a manageable problem look like an
   * unmanageable one. Nothing about the styling could fix that; the count and
   * the total are what you actually need, and the individual months are still
   * a click away for when you want to settle one of them.
   */
  const groups = useMemo(() => {
    const visible = rows.filter(({ payment: p }) => {
      switch (filter) {
        case "attention":
          return overdueAsOf(p, todayStr);
        case "upcoming":
          return (
            (p.status === "due" || p.status === "late") &&
            !overdueAsOf(p, todayStr)
          );
        case "paid":
          return p.status === "paid" || p.status === "waived";
        default:
          return true;
      }
    });

    const byTenancy = new Map<string, RentRow[]>();
    for (const row of visible) {
      const list = byTenancy.get(row.payment.tenancy_id) ?? [];
      list.push(row);
      byTenancy.set(row.payment.tenancy_id, list);
    }

    return [...byTenancy.entries()]
      .map(([tenancyId, list]) => {
        const payments = [...list].sort((a, b) =>
          a.payment.due_date < b.payment.due_date ? -1 : 1,
        );
        return {
          tenancyId,
          payments,
          head: payments[0],
          total: payments.reduce(
            (sum, r) => sum + Number(r.payment.amount_due),
            0,
          ),
          oldestDue: payments[0].payment.due_date,
          overdueCount: payments.filter((r) =>
            overdueAsOf(r.payment, todayStr),
          ).length,
        };
      })
      // Longest-running arrears first — the order you would work through them.
      .sort((a, b) => (a.oldestDue < b.oldestDue ? -1 : 1));
  }, [rows, filter, todayStr]);

  const overdueTotal = rows
    .filter((r) => overdueAsOf(r.payment, todayStr))
    .reduce((sum, r) => sum + Number(r.payment.amount_due), 0);

  /* This calendar month's takings, computed from the same rows the list is
     built from. Waived rent is excluded from what was expected — it was never
     going to arrive, and counting it would leave every month looking short. */
  const monthPrefix = todayStr.slice(0, 7);
  const thisMonth = rows.filter((r) => r.payment.due_date.startsWith(monthPrefix));
  const collectedThisMonth = thisMonth
    .filter((r) => r.payment.status === "paid")
    .reduce((sum, r) => sum + Number(r.payment.amount_due), 0);
  const dueThisMonth = thisMonth
    .filter((r) => r.payment.status !== "waived")
    .reduce((sum, r) => sum + Number(r.payment.amount_due), 0);

  function update(id: string, status: RentPayment["status"]) {
    startTransition(async () => {
      const result = await setRentStatus(id, status);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("common.saved"));
      router.refresh();
    });
  }

  function toggle(tenancyId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(tenancyId)) next.delete(tenancyId);
      else next.add(tenancyId);
      return next;
    });
  }

  const counts = {
    attention: rows.filter((r) => overdueAsOf(r.payment, todayStr)).length,
    upcoming: rows.filter(
      (r) =>
        (r.payment.status === "due" || r.payment.status === "late") &&
        !overdueAsOf(r.payment, todayStr),
    ).length,
    paid: rows.filter(
      (r) => r.payment.status === "paid" || r.payment.status === "waived",
    ).length,
    all: rows.length,
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "attention", label: t("rent.needsChasing") },
    { key: "upcoming", label: t("rent.upcoming") },
    { key: "paid", label: t("rent.statusPaid") },
    { key: "all", label: t("filters.all") },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Two figures, not one.
          A lone red total is the only thing this page used to say about the
          month, which makes every month look like a bad one — £10,450 overdue
          reads very differently next to £8,000 already collected. The green
          card is not decoration; it is the missing half of the sentence. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard
          label={t("dashboard.collectedThisMonth")}
          value={roundMoney(collectedThisMonth)}
          hint={t("dashboard.ofExpected", { amount: roundMoney(dueThisMonth) })}
          Icon={PiggyBank}
          muted={dueThisMonth === 0}
          footer={
            dueThisMonth > 0 ? (
              <ProgressMeter
                value={collectedThisMonth}
                max={dueThisMonth}
              />
            ) : undefined
          }
        />
        <MetricCard
          label={t("rent.needsChasing")}
          value={roundMoney(overdueTotal)}
          hint={t("dashboard.overdueCount", { count: counts.attention })}
          Icon={Banknote}
          tone="danger"
          muted={overdueTotal === 0}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <Badge variant="secondary" className="ml-1 text-xs">
              {counts[f.key]}
            </Badge>
          </Button>
        ))}
      </div>

      {groups.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {filter === "attention"
            ? t("rent.nothingToChase")
            : t("rent.noPayments")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((group) => {
            const { head, payments, total, tenancyId, overdueCount } = group;
            const { roomName, propertyName, tenant } = head;
            const single = payments.length === 1;
            const overdue = overdueCount > 0;
            const allPaid = payments.every((r) => r.payment.status === "paid");
            const isOpen = expanded.has(tenancyId);

            return (
              <li key={tenancyId}>
                {/* Deliberately untinted.

                    These rows had a red edge, then briefly a red wash, and
                    both were wrong for the same reason: the default view of
                    this page is "Needs chasing", so every row in it is late.
                    Colouring all of them separates nothing — it just turns the
                    page red. The status is already on the badge and on the
                    amount, and the two summary cards above carry the colour
                    where it actually contrasts against something. */}
                <Card>
                  <CardContent className="flex flex-col gap-3 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">
                            {tenant
                              ? `${tenant.first_name} ${tenant.surname}`
                              : "—"}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {roomName}
                          </Badge>
                          {allPaid && (
                            <Badge variant="secondary" className="text-xs">
                              {t("rent.statusPaid")}
                            </Badge>
                          )}
                          {overdue && (
                            <Badge variant="destructive" className="text-xs">
                              {t("rent.statusLate")}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {propertyName && `${propertyName} · `}
                          {single
                            ? `${t("rent.dueDate")} ${shortDate(
                                head.payment.due_date,
                              )}`
                            : `${t("rent.outstandingCount", {
                                count: payments.length,
                              })} · ${t("rent.oldestDue", {
                                date: shortDate(group.oldestDue),
                              })}`}
                          {single &&
                            head.payment.paid_at &&
                            ` · ${t("rent.paidOn", {
                              date: shortDate(head.payment.paid_at),
                            })}`}
                        </p>
                      </div>

                      <p
                        className={cn(
                          "figure shrink-0 text-lg font-semibold",
                          overdue && "text-destructive",
                        )}
                      >
                        {money(total)}
                      </p>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        {/* Chasing only appears once it's actually late, and
                            chases the whole balance rather than one month. */}
                        {overdue && tenant && (
                          <ReminderDialog
                            tenant={tenant}
                            templates={templates}
                            templateKey="rent_overdue"
                            values={{
                              amount: total.toFixed(2),
                              room: roomName,
                            }}
                            isoDates={{ date: group.oldestDue }}
                            trigger={
                              <Button variant="outline" size="sm">
                                <Send className="size-4" aria-hidden />
                                {t("rent.sendReminder")}
                              </Button>
                            }
                          />
                        )}

                        {single ? (
                          head.payment.status === "paid" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => update(head.payment.id, "due")}
                              disabled={isPending}
                            >
                              <Undo2 className="size-4" aria-hidden />
                              {t("rent.undoPaid")}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => update(head.payment.id, "paid")}
                              disabled={isPending}
                            >
                              <Check className="size-4" aria-hidden />
                              {t("rent.markPaid")}
                            </Button>
                          )
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggle(tenancyId)}
                            aria-expanded={isOpen}
                          >
                            <ChevronDown
                              className={cn(
                                "size-4 transition-transform duration-(--duration-fast)",
                                isOpen && "rotate-180",
                              )}
                              aria-hidden
                            />
                            {isOpen
                              ? t("rent.hidePayments")
                              : t("rent.showPayments")}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Marking one month settled is still possible — it just is
                        not the first thing the page shows you. */}
                    {!single && isOpen && (
                      <ul className="flex flex-col divide-y border-t">
                        {payments.map(({ payment }) => (
                          <li
                            key={payment.id}
                            className="flex flex-wrap items-center gap-3 py-2.5"
                          >
                            <span className="min-w-0 flex-1 text-sm text-muted-foreground">
                              {shortDate(payment.due_date)}
                              {payment.paid_at &&
                                ` · ${t("rent.paidOn", {
                                  date: shortDate(payment.paid_at),
                                })}`}
                            </span>
                            <span className="figure shrink-0 text-sm font-medium">
                              {money(Number(payment.amount_due))}
                            </span>
                            {payment.status === "paid" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => update(payment.id, "due")}
                                disabled={isPending}
                              >
                                <Undo2 className="size-4" aria-hidden />
                                {t("rent.undoPaid")}
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => update(payment.id, "paid")}
                                disabled={isPending}
                              >
                                <Check className="size-4" aria-hidden />
                                {t("rent.markPaid")}
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
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
