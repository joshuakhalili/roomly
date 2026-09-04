"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { parseISO } from "date-fns";
import { toast } from "sonner";
import { saveUtilityBill, deleteUtilityBill } from "@/lib/actions/expenses";
import { billsMargin } from "@/lib/queries/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FormError } from "@/components/ui/field";
import { OptionSelect } from "@/components/ui/option-select";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Zap, Flame, Droplets } from "lucide-react";
import type { MeterType, Tenancy, UtilityBill } from "@/lib/types";

const METER_ICON = {
  electricity: Zap,
  gas: Flame,
  water: Droplets,
} as const;

/* Reused from the inventory namespace rather than duplicated here: these are
   the same three words the check-in report already uses for the same meters,
   and two copies would drift the first time one was reworded. */
const METER_KEY = {
  electricity: "inventory.meterElectricity",
  gas: "inventory.meterGas",
  water: "inventory.meterWater",
} as const;

function BillDialog({
  propertyId,
  bill,
}: {
  propertyId: string;
  bill?: UtilityBill;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    formData.set("property_id", propertyId);
    startTransition(async () => {
      const result = await saveUtilityBill(bill?.id ?? null, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      toast.success(t("common.saved"));
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={bill ? "ghost" : "default"}>
          {bill ? (
            <Pencil className="size-4" aria-hidden />
          ) : (
            <>
              <Plus className="size-4" aria-hidden />
              {t("properties.addBill")}
            </>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {bill ? t("properties.editBill") : t("properties.addBill")}
          </DialogTitle>
        </DialogHeader>

        <form action={submit} className="flex flex-col gap-4">
          <Field label={t("properties.billPeriod")} required>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                name="period_start"
                defaultValue={bill?.period_start ?? ""}
                required
                disabled={isPending}
              />
              <Input
                type="date"
                name="period_end"
                defaultValue={bill?.period_end ?? ""}
                required
                disabled={isPending}
              />
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("inventory.meters")}>
              <OptionSelect
                name="meter_type"
                defaultValue={bill?.meter_type ?? "electricity"}
                disabled={isPending}
                options={(
                  ["electricity", "gas", "water"] as MeterType[]
                ).map((m) => ({ value: m, label: t(METER_KEY[m]) }))}
              />
            </Field>

            <Field label={t("properties.billAmount")} required>
              <Input
                type="number"
                step="0.01"
                min="0"
                name="amount"
                defaultValue={bill?.amount ?? ""}
                required
                disabled={isPending}
              />
            </Field>
          </div>

          <Field label={t("properties.billSupplier")}>
            <Input
              name="supplier_name"
              defaultValue={bill?.supplier_name ?? ""}
              disabled={isPending}
            />
          </Field>

          <Field label={t("tenancy.notes")}>
            <Textarea
              name="notes"
              rows={2}
              defaultValue={bill?.notes ?? ""}
              disabled={isPending}
            />
          </Field>

          <FormError message={error} />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * What the utilities cost here, next to the rent that is supposed to cover
 * them.
 *
 * The margin only appears once both halves exist. A list of bills with no
 * bills-included letting to compare against is just a list of bills, and
 * putting a number on it would be inventing a conclusion from one side of a
 * comparison.
 */
export function UtilityBillsPanel({
  propertyId,
  bills,
  tenancies,
}: {
  propertyId: string;
  bills: UtilityBill[];
  tenancies: Tenancy[];
}) {
  const t = useTranslations();
  const format = useFormatter();

  const money = (n: number) =>
    format.number(n, { style: "currency", currency: "GBP" });

  const margin = useMemo(
    () => billsMargin(bills, tenancies),
    [bills, tenancies],
  );

  const sorted = useMemo(
    () =>
      [...bills].sort((a, b) => (a.period_end < b.period_end ? 1 : -1)),
    [bills],
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="font-semibold">{t("properties.utilities")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("properties.utilitiesHelp")}
          </p>
        </div>
        <div className="ml-auto">
          <BillDialog propertyId={propertyId} />
        </div>
      </div>

      {margin.hasData && (
        <Card>
          <CardContent className="flex flex-wrap items-baseline gap-x-4 gap-y-1 p-4">
            <span className="metric-label">{t("properties.billsMargin")}</span>
            {/* Only the figure takes colour, and only when it is negative —
                a healthy margin is not an alarm, it is just a number. */}
            <span
              className={
                margin.margin < 0
                  ? "figure text-lg font-semibold text-destructive"
                  : "figure text-lg font-semibold"
              }
            >
              {money(margin.margin)}
            </span>
            <span className="text-xs text-muted-foreground">
              {margin.margin < 0
                ? t("properties.billsMarginNegative")
                : t("properties.billsMarginHint")}
            </span>
          </CardContent>
        </Card>
      )}

      {!margin.hasData && bills.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("properties.noBillsIncluded")}
        </p>
      )}

      {sorted.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t("properties.noBills")}
        </p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {sorted.map((bill) => {
            const Icon = METER_ICON[bill.meter_type];
            return (
              <li key={bill.id}>
                <Card>
                  <CardContent className="flex items-start gap-3 p-4">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4" aria-hidden />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{t(METER_KEY[bill.meter_type])}</p>
                      <p className="figure text-xs text-muted-foreground">
                        {format.dateTime(parseISO(bill.period_start), {
                          dateStyle: "medium",
                        })}
                        {" — "}
                        {format.dateTime(parseISO(bill.period_end), {
                          dateStyle: "medium",
                        })}
                      </p>
                      {bill.supplier_name && (
                        <p className="truncate text-xs text-muted-foreground">
                          {bill.supplier_name}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <span className="figure font-medium">
                        {money(Number(bill.amount))}
                      </span>
                      <BillDialog propertyId={propertyId} bill={bill} />
                      <ConfirmDelete
                        title={t("properties.deleteBill")}
                        description={t("properties.deleteBillWarning")}
                        onConfirm={() => deleteUtilityBill(bill.id)}
                        trigger={
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={t("common.delete")}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
