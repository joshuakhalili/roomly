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
import { Check, Undo2, Send, Banknote } from "lucide-react";
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

  const todayStr = new Date().toISOString().slice(0, 10);

  const visible = useMemo(() => {
    const filtered = rows.filter(({ payment: p }) => {
      switch (filter) {
        case "attention":
          return overdueAsOf(p, todayStr);
        case "upcoming":
          return (p.status === "due" || p.status === "late") && !overdueAsOf(p, todayStr);
        case "paid":
          return p.status === "paid" || p.status === "waived";
        default:
          return true;
      }
    });
    // Most overdue first — that's the order you'd work through them.
    return filtered.sort((a, b) =>
      a.payment.due_date < b.payment.due_date ? -1 : 1,
    );
  }, [rows, filter, todayStr]);

  const overdueTotal = rows
    .filter((r) => overdueAsOf(r.payment, todayStr))
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
      {overdueTotal > 0 && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 p-4">
            <Banknote className="size-5 shrink-0 text-destructive" aria-hidden />
            <div>
              <p className="text-figure text-stat text-destructive">
                {format.number(overdueTotal, {
                  style: "currency",
                  currency: "GBP",
                })}
              </p>
              <p className="mt-0.5 text-metric-label">
                {t("dashboard.overdueCount", { count: counts.attention })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <Badge variant="secondary" className="ml-1 text-xs">
              {counts[f.key]}
            </Badge>
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {filter === "attention"
            ? t("rent.nothingToChase")
            : t("rent.noPayments")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map(({ payment, roomName, propertyName, tenant }) => {
            const overdue = overdueAsOf(payment, todayStr);
            const paid = payment.status === "paid";

            return (
              <li key={payment.id}>
                <Card className={cn(overdue && "border-destructive/50")}>
                  <CardContent className="flex flex-wrap items-center gap-3 p-4">
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
                        {paid && (
                          <Badge className="text-xs">
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
                        {t("rent.dueDate")}{" "}
                        {format.dateTime(new Date(payment.due_date), {
                          dateStyle: "medium",
                        })}
                        {payment.paid_at &&
                          ` · ${t("rent.paidOn", {
                            date: format.dateTime(new Date(payment.paid_at), {
                              dateStyle: "medium",
                            }),
                          })}`}
                      </p>
                    </div>

                    <p className="text-figure shrink-0 text-base font-semibold">
                      {format.number(Number(payment.amount_due), {
                        style: "currency",
                        currency: "GBP",
                      })}
                    </p>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      {/* Chasing only appears once it's actually late. */}
                      {overdue && tenant && (
                        <ReminderDialog
                          tenant={tenant}
                          templates={templates}
                          templateKey="rent_overdue"
                          values={{
                            amount: Number(payment.amount_due).toFixed(2),
                            room: roomName,
                          }}
                          isoDates={{ date: payment.due_date }}
                          trigger={
                            <Button variant="outline" size="sm">
                              <Send className="size-4" aria-hidden />
                              {t("rent.sendReminder")}
                            </Button>
                          }
                        />
                      )}

                      {paid ? (
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
                          size="sm"
                          onClick={() => update(payment.id, "paid")}
                          disabled={isPending}
                        >
                          <Check className="size-4" aria-hidden />
                          {t("rent.markPaid")}
                        </Button>
                      )}
                    </div>
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
