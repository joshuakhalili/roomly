"use client";

import { useState, useTransition } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { parseISO } from "date-fns";
import { saveRecurrence, endRecurrence } from "@/lib/actions/maintenance";
import { serviceLabel } from "./service-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field, FormError } from "@/components/ui/field";
import { OptionSelect } from "@/components/ui/option-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Repeat, Plus, Ban } from "lucide-react";
import type {
  Contact,
  JobRecurrence,
  Property,
  RecurrenceFrequency,
  Room,
  ServiceType,
} from "@/lib/types";

const NO_ROOM = "__whole_property__";
const NONE = "__none__";

/** 0 = Sunday, matching JavaScript's getDay() and the database column. */
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

/**
 * Standing arrangements — the work that repeats without being asked for.
 *
 * Kept behind a dialog rather than given its own tab: you set a weekly clean
 * up once and then never think about it again. What you look at daily is the
 * jobs it produces, which are already on the calendar.
 */
export function RecurrencesDialog({
  recurrences,
  properties,
  rooms,
  serviceTypes,
  contacts,
}: {
  recurrences: JobRecurrence[];
  properties: Property[];
  rooms: Room[];
  serviceTypes: ServiceType[];
  contacts: Contact[];
}) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("weekly");

  function submit(formData: FormData) {
    setError(null);
    if (formData.get("room_id") === NO_ROOM) formData.set("room_id", "");
    if (formData.get("contact_id") === NONE) formData.set("contact_id", "");

    startTransition(async () => {
      const result = await saveRecurrence(null, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAdding(false);
      toast.success(t("maintenance.recurrenceSaved"));
      router.refresh();
    });
  }

  function stop(id: string) {
    startTransition(async () => {
      const result = await endRecurrence(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("common.saved"));
      router.refresh();
    });
  }

  const weekdayLabel = (day: number) =>
    format.dateTime(new Date(Date.UTC(2026, 1, 1 + day)), { weekday: "long" });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Repeat className="size-4" aria-hidden />
          {t("maintenance.standing")}
          {recurrences.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {recurrences.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("maintenance.standing")}</DialogTitle>
          <DialogDescription>
            {t("maintenance.standingHelp")}
          </DialogDescription>
        </DialogHeader>

        {recurrences.length > 0 && (
          <ul className="flex flex-col gap-2">
            {recurrences.map((r) => {
              const property = properties.find((p) => p.id === r.property_id);
              const contact = contacts.find((c) => c.id === r.contact_id);
              const when =
                r.frequency === "monthly"
                  ? t("maintenance.monthlyOn", { day: r.day_of_month ?? 1 })
                  : t(
                      r.frequency === "weekly"
                        ? "maintenance.weeklyOn"
                        : "maintenance.fortnightlyOn",
                      { day: weekdayLabel(r.day_of_week ?? 1) },
                    );

              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {when} · {property?.name}
                      {contact && ` · ${contact.name}`}
                      {r.cost != null &&
                        ` · ${format.number(Number(r.cost), {
                          style: "currency",
                          currency: "GBP",
                        })}`}
                    </p>
                    {r.ends_on && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("maintenance.until", {
                          date: format.dateTime(parseISO(r.ends_on), {
                            dateStyle: "medium",
                          }),
                        })}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => stop(r.id)}
                    disabled={isPending}
                  >
                    <Ban className="size-4" aria-hidden />
                    {t("maintenance.stop")}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {adding ? (
          <form action={submit} className="flex flex-col gap-4 border-t pt-4">
            <Field label={t("maintenance.jobTitle")} required>
              <Input
                name="title"
                required
                placeholder={t("maintenance.recurrenceTitlePlaceholder")}
                disabled={isPending}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("properties.one")} required>
                <OptionSelect
                  name="property_id"
                  value={propertyId}
                  onValueChange={setPropertyId}
                  disabled={isPending}
                  options={properties.map((p) => ({
                    value: p.id,
                    label: p.name,
                  }))}
                />
              </Field>
              <Field label={t("rooms.one")}>
                <OptionSelect
                  name="room_id"
                  defaultValue={NO_ROOM}
                  disabled={isPending}
                  options={[
                    { value: NO_ROOM, label: t("maintenance.wholeProperty") },
                    ...rooms
                      .filter((r) => r.property_id === propertyId)
                      .map((r) => ({ value: r.id, label: r.name })),
                  ]}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("maintenance.serviceType")}>
                <OptionSelect
                  name="service_type_id"
                  defaultValue={serviceTypes[0]?.id}
                  disabled={isPending}
                  options={serviceTypes.map((st) => ({
                    value: st.id,
                    label: serviceLabel(t, st),
                  }))}
                />
              </Field>
              <Field label={t("maintenance.contact")}>
                <OptionSelect
                  name="contact_id"
                  defaultValue={NONE}
                  disabled={isPending}
                  options={[
                    { value: NONE, label: t("common.notSet") },
                    ...contacts.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("maintenance.repeats")}>
                <OptionSelect
                  name="frequency"
                  value={frequency}
                  onValueChange={(v) => setFrequency(v as RecurrenceFrequency)}
                  disabled={isPending}
                  options={[
                    { value: "weekly", label: t("tenancy.frequencyWeekly") },
                    {
                      value: "fortnightly",
                      label: t("tenancy.frequencyFortnightly"),
                    },
                    { value: "monthly", label: t("tenancy.frequencyMonthly") },
                  ]}
                />
              </Field>

              {frequency === "monthly" ? (
                <Field
                  label={t("maintenance.dayOfMonth")}
                  hint={t("maintenance.dayOfMonthHint")}
                >
                  <Input
                    type="number"
                    name="day_of_month"
                    min={1}
                    max={31}
                    defaultValue={1}
                    disabled={isPending}
                  />
                </Field>
              ) : (
                <Field label={t("maintenance.dayOfWeek")}>
                  <OptionSelect
                    name="day_of_week"
                    defaultValue="2"
                    disabled={isPending}
                    options={WEEKDAYS.map((d) => ({
                      value: String(d),
                      label: weekdayLabel(d),
                    }))}
                  />
                </Field>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t("maintenance.startsOn")} required>
                <Input
                  type="date"
                  name="starts_on"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  disabled={isPending}
                />
              </Field>
              {/* Mainly for grounds work: fortnightly through summer, nothing
                  in February. Without it you cancel jobs all winter. */}
              <Field
                label={t("maintenance.endsOn")}
                hint={t("maintenance.endsOnHint")}
              >
                <Input type="date" name="ends_on" disabled={isPending} />
              </Field>
              <Field label={t("maintenance.cost")}>
                <Input
                  type="number"
                  name="cost"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  disabled={isPending}
                />
              </Field>
            </div>

            <FormError message={error} />

            <div className="flex gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? t("common.saving") : t("common.save")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdding(false)}
                disabled={isPending}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <DialogFooter className="sm:justify-start">
            <Button onClick={() => setAdding(true)} disabled={isPending}>
              <Plus className="size-4" aria-hidden />
              {t("maintenance.addStanding")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
