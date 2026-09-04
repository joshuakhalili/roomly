"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { createTenancy, updateTenancy } from "@/lib/actions/tenancies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { OptionSelect } from "@/components/ui/option-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TenantPicker } from "@/components/tenants/tenant-picker";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Tenancy, Tenant, TenantOnTenancy } from "@/lib/types";

const STEPS = ["details", "rent", "review"] as const;

/**
 * Create/edit a tenancy.
 *
 * Split into steps because the full field list is long enough to be
 * off-putting on one screen — especially on a phone. All fields stay mounted
 * so a single form submission carries everything; the steps only control
 * what's visible.
 */
export function TenancyForm({
  roomId,
  tenancy,
  allTenants,
  assigned = [],
  bankAccounts = [],
}: {
  roomId: string;
  tenancy?: Tenancy;
  allTenants: Tenant[];
  assigned?: TenantOnTenancy[];
  bankAccounts?: { id: string; bank_name: string; account_label: string }[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [frequency, setFrequency] = useState(tenancy?.rent_frequency ?? "monthly");
  /* Decided before anything else, because it changes what the money step even
     asks for: a booking has one total and a balance date where a tenancy has a
     cadence and a due day. */
  const [lettingType, setLettingType] = useState(
    tenancy?.letting_type ?? "long_term",
  );
  const isShortStay = lettingType === "short_stay";
  const [selectedIds, setSelectedIds] = useState<string[]>(
    assigned.map((a) => a.id),
  );
  const [leadId, setLeadId] = useState<string | null>(
    assigned.find((a) => a.is_lead_tenant)?.id ?? assigned[0]?.id ?? null,
  );

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      // Handled as separate branches rather than one ternary: creating
      // returns the new id to navigate to, updating returns nothing.
      if (tenancy) {
        const result = await updateTenancy(tenancy.id, formData);
        if (!result.ok) {
          setError(result.error);
          setStep(0); // back to where a missing required field likely is
          return;
        }
        toast.success(t("common.saved"));
        router.refresh();
        return;
      }

      const result = await createTenancy(roomId, formData);
      if (!result.ok) {
        setError(result.error);
        setStep(0);
        return;
      }
      toast.success(t("common.saved"));
      router.push(`/tenancies/${result.data.id}` as "/");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        {t("common.step", { current: step + 1, total: STEPS.length })}
      </p>

      {/* Step 1 — who lives here */}
      <div className={step === 0 ? "flex flex-col gap-4" : "hidden"}>
        <h2 className="font-semibold">{t("tenancy.details")}</h2>

        <Field
          label={t("tenancy.lettingType")}
          hint={
            isShortStay
              ? t("tenancy.lettingShortStayHint")
              : t("tenancy.lettingLongTermHint")
          }
        >
          <OptionSelect
            name="letting_type"
            value={lettingType}
            onValueChange={(v) => setLettingType(v as typeof lettingType)}
            disabled={isPending}
            options={[
              { value: "long_term", label: t("tenancy.lettingLongTerm") },
              { value: "short_stay", label: t("tenancy.lettingShortStay") },
            ]}
          />
        </Field>

        <Separator />

        <p className="text-sm text-muted-foreground">
          {t("tenants.pickHint")}
        </p>
        <TenantPicker
          tenants={allTenants}
          selectedIds={selectedIds}
          leadId={leadId}
          onChange={(ids) => {
            setSelectedIds(ids);
            if (leadId && !ids.includes(leadId)) setLeadId(ids[0] ?? null);
            if (!leadId && ids.length > 0) setLeadId(ids[0]);
          }}
          onLeadChange={setLeadId}
          disabled={isPending}
        />
      </div>

      {/* Step 2 — money and dates */}
      <div className={step === 1 ? "flex flex-col gap-4" : "hidden"}>
        <h2 className="font-semibold">{t("tenancy.rentAndDeposit")}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("tenancy.startDate")} required>
            <Input
              type="date"
              name="start_date"
              defaultValue={tenancy?.start_date ?? ""}
              required
              disabled={isPending}
            />
          </Field>
          {/* A tenancy can run until someone gives notice; a booking cannot —
              without a checkout date the room would never come free again. */}
          <Field label={t("tenancy.endDate")} required={isShortStay}>
            <Input
              type="date"
              name="end_date"
              defaultValue={tenancy?.end_date ?? ""}
              required={isShortStay}
              disabled={isPending}
            />
          </Field>

          <Field label={t("tenancy.status")}>
            <OptionSelect
              name="status"
              defaultValue={tenancy?.status ?? "upcoming"}
              disabled={isPending}
              options={[
                { value: "upcoming", label: t("tenancy.statusUpcoming") },
                { value: "active", label: t("tenancy.statusActive") },
                { value: "ended", label: t("tenancy.statusEnded") },
              ]}
            />
          </Field>

          <Field
            label={isShortStay ? t("tenancy.stayTotal") : t("tenancy.rentAmount")}
            required
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              name="rent_amount"
              defaultValue={tenancy?.rent_amount ?? ""}
              required
              disabled={isPending}
            />
          </Field>

          {/* A short stay has no cadence, so the whole question disappears
              rather than sitting there offering answers that do not apply.
              The server derives 'total' from the letting type, so the two can
              never end up disagreeing. */}
          {!isShortStay && (
            <Field label={t("tenancy.rentFrequency")}>
              <OptionSelect
                name="rent_frequency"
                value={frequency}
                onValueChange={(v) => setFrequency(v as typeof frequency)}
                disabled={isPending}
                options={[
                  { value: "monthly", label: t("tenancy.frequencyMonthly") },
                  { value: "weekly", label: t("tenancy.frequencyWeekly") },
                  {
                    value: "fortnightly",
                    label: t("tenancy.frequencyFortnightly"),
                  },
                  {
                    value: "four_weekly",
                    label: t("tenancy.frequencyFourWeekly"),
                  },
                ]}
              />
            </Field>
          )}

          {/* Only meaningful for monthly rent — weekly schedules follow the
              move-in weekday instead, so the field would mislead. */}
          {!isShortStay && frequency === "monthly" && (
            <Field
              label={t("tenancy.rentDueDay")}
              hint={t("common.optional")}
            >
              <Input
                type="number"
                min="1"
                max="31"
                name="rent_due_day"
                defaultValue={tenancy?.rent_due_day ?? ""}
                disabled={isPending}
              />
            </Field>
          )}

          {isShortStay && (
            <Field
              label={t("tenancy.balanceDue")}
              hint={t("tenancy.balanceDueHint")}
            >
              <Input
                type="date"
                name="balance_due_date"
                defaultValue={tenancy?.balance_due_date ?? ""}
                disabled={isPending}
              />
            </Field>
          )}

          <Field
            label={
              isShortStay
                ? t("tenancy.depositHolds")
                : t("tenancy.depositAmount")
            }
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              name="deposit_amount"
              defaultValue={tenancy?.deposit_amount ?? ""}
              disabled={isPending}
            />
          </Field>
          <Field label={t("tenancy.depositScheme")}>
            <Input
              name="deposit_scheme_name"
              defaultValue={tenancy?.deposit_scheme_name ?? ""}
              disabled={isPending}
            />
          </Field>
          <Field label={t("tenancy.depositRef")}>
            <Input
              name="deposit_scheme_ref"
              defaultValue={tenancy?.deposit_scheme_ref ?? ""}
              disabled={isPending}
            />
          </Field>

          {bankAccounts.length > 0 && (
            <Field label={t("tenancy.bankAccount")}>
              <OptionSelect
                name="bank_account_id"
                defaultValue={tenancy?.bank_account_id ?? undefined}
                disabled={isPending}
                placeholder={t("common.notSet")}
                options={bankAccounts.map((b) => ({
                  value: b.id,
                  label: `${b.bank_name} — ${b.account_label}`,
                }))}
              />
            </Field>
          )}
        </div>

        {/* Outside the two-column grid: a checkbox next to a dropdown reads as
            a field with a missing label. */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="bills_included"
            name="bills_included"
            defaultChecked={tenancy?.bills_included ?? false}
            disabled={isPending}
          />
          <Label htmlFor="bills_included" className="font-normal">
            {t("tenancy.billsIncluded")}
          </Label>
        </div>

        <Field label={t("tenancy.notes")}>
          <Textarea
            name="notes"
            rows={3}
            defaultValue={tenancy?.notes ?? ""}
            disabled={isPending}
          />
        </Field>
      </div>

      {/* Step 3 — confirm */}
      <div className={step === 2 ? "flex flex-col gap-4" : "hidden"}>
        <h2 className="font-semibold">{t("common.confirm")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("tenants.selectedCount", { count: selectedIds.length })}
        </p>
      </div>

      <FormError message={error} />
      <Separator />

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || isPending}
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("common.previous")}
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={isPending}
          >
            {t("common.next")}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button type="submit" disabled={isPending}>
            {isPending ? t("common.saving") : t("common.save")}
          </Button>
        )}
      </div>
    </form>
  );
}
