import { getTranslations, getFormatter } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { lastPaidDate, nextDueDate } from "@/lib/rent";
import type { RentPayment, Tenancy } from "@/lib/types";

const FREQUENCY_KEY = {
  weekly: "tenancy.frequencyWeekly",
  fortnightly: "tenancy.frequencyFortnightly",
  four_weekly: "tenancy.frequencyFourWeekly",
  monthly: "tenancy.frequencyMonthly",
} as const;

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-medium">{value}</p>
    </div>
  );
}

/**
 * The at-a-glance facts for a tenancy: when it runs, what's paid, when the
 * next payment falls due, and the deposit position.
 */
export async function TenancySummary({
  tenancy,
  payments,
}: {
  tenancy: Tenancy;
  payments: RentPayment[];
}) {
  const t = await getTranslations();
  const format = await getFormatter();

  const date = (d: string | null) =>
    d ? format.dateTime(new Date(d), { dateStyle: "medium" }) : null;

  const money = (n: number | null) =>
    n === null
      ? "—"
      : format.number(Number(n), { style: "currency", currency: "GBP" });

  const lastPaid = lastPaidDate(payments);
  const nextDue = nextDueDate(payments);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4">
          <p className="col-span-2 text-sm font-medium">{t("tenancy.dates")}</p>
          <Item
            label={t("tenancy.startDate")}
            value={date(tenancy.start_date) ?? "—"}
          />
          <Item
            label={t("tenancy.endDate")}
            value={date(tenancy.end_date) ?? t("tenancy.noEndDate")}
          />
          <Item
            label={t("tenancy.rentDueOn")}
            value={
              tenancy.rent_frequency === "monthly" && tenancy.rent_due_day
                ? t("tenancy.dayOfMonth", { day: tenancy.rent_due_day })
                : t(FREQUENCY_KEY[tenancy.rent_frequency])
            }
          />
          <Item
            label={t("tenancy.nextDue")}
            value={date(nextDue) ?? "—"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4">
          <p className="col-span-2 text-sm font-medium">
            {t("tenancy.rentAndDeposit")}
          </p>
          <Item
            label={t("tenancy.rentAmount")}
            value={`${money(tenancy.rent_amount)} · ${t(FREQUENCY_KEY[tenancy.rent_frequency])}`}
          />
          <Item
            label={t("tenancy.lastPaid")}
            value={date(lastPaid) ?? t("tenancy.never")}
          />
          <Item
            label={t("tenancy.deposit")}
            value={money(tenancy.deposit_amount)}
          />
          <Item
            label={t("tenancy.depositScheme")}
            value={
              tenancy.deposit_scheme_name
                ? t("tenancy.depositProtected", {
                    scheme: tenancy.deposit_scheme_name,
                  })
                : t("tenancy.depositNotProtected")
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
