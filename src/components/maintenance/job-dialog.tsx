"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { saveJob } from "@/lib/actions/maintenance";
import { serviceLabel } from "./service-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError } from "@/components/ui/field";
import { OptionSelect } from "@/components/ui/option-select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";
import type {
  Contact,
  MaintenanceJob,
  Property,
  Room,
  ServiceType,
} from "@/lib/types";

const NO_ROOM = "__whole_property__";
const NONE = "__none__";

export function JobDialog({
  job,
  properties,
  rooms,
  serviceTypes,
  contacts,
  defaultDate,
  defaultPropertyId,
  checklistSectionId,
  trigger,
}: {
  job?: MaintenanceJob;
  properties: Property[];
  rooms: Room[];
  serviceTypes: ServiceType[];
  contacts: Contact[];
  defaultDate?: string;
  defaultPropertyId?: string;
  /** Set when the job is being raised from a flagged inventory defect. */
  checklistSectionId?: string;
  trigger?: React.ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [propertyId, setPropertyId] = useState(
    job?.property_id ?? defaultPropertyId ?? properties[0]?.id ?? "",
  );

  // Only this building's rooms, plus the option of none — grounds work and
  // anything communal belongs to the property, not a room.
  const roomOptions = [
    { value: NO_ROOM, label: t("maintenance.wholeProperty") },
    ...rooms
      .filter((r) => r.property_id === propertyId)
      .map((r) => ({ value: r.id, label: r.name })),
  ];

  function submit(formData: FormData) {
    setError(null);
    if (formData.get("room_id") === NO_ROOM) formData.set("room_id", "");
    if (formData.get("contact_id") === NONE) formData.set("contact_id", "");
    if (checklistSectionId)
      formData.set("checklist_section_id", checklistSectionId);

    startTransition(async () => {
      const result = await saveJob(job?.id ?? null, formData);
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
        {trigger ?? (
          <Button size="sm" variant={job ? "outline" : "default"}>
            {job ? (
              <>
                <Pencil className="size-4" aria-hidden />
                {t("common.edit")}
              </>
            ) : (
              <>
                <Plus className="size-4" aria-hidden />
                {t("maintenance.addJob")}
              </>
            )}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {job ? t("maintenance.editJob") : t("maintenance.addJob")}
          </DialogTitle>
        </DialogHeader>

        <form action={submit} className="flex flex-col gap-4">
          <Field label={t("maintenance.jobTitle")} required>
            <Input
              name="title"
              defaultValue={job?.title ?? ""}
              required
              placeholder={t("maintenance.jobTitlePlaceholder")}
              disabled={isPending}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("properties.title")} required>
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

            <Field label={t("rooms.title")}>
              <OptionSelect
                name="room_id"
                defaultValue={job?.room_id ?? NO_ROOM}
                disabled={isPending}
                options={roomOptions}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("maintenance.serviceType")}>
              <OptionSelect
                name="service_type_id"
                defaultValue={job?.service_type_id ?? serviceTypes[0]?.id}
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
                defaultValue={job?.contact_id ?? NONE}
                disabled={isPending}
                options={[
                  { value: NONE, label: t("common.notSet") },
                  ...contacts.map((c) => ({
                    value: c.id,
                    label: c.company ? `${c.name} — ${c.company}` : c.name,
                  })),
                ]}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("maintenance.date")} required>
              <Input
                type="date"
                name="scheduled_for"
                defaultValue={
                  job?.scheduled_for ??
                  defaultDate ??
                  new Date().toISOString().slice(0, 10)
                }
                required
                disabled={isPending}
              />
            </Field>
            <Field label={t("maintenance.time")}>
              <Input
                type="time"
                name="scheduled_time"
                defaultValue={job?.scheduled_time?.slice(0, 5) ?? ""}
                disabled={isPending}
              />
            </Field>
            <Field label={t("maintenance.cost")}>
              <Input
                type="number"
                name="cost"
                step="0.01"
                min="0"
                inputMode="decimal"
                defaultValue={job?.cost ?? ""}
                disabled={isPending}
              />
            </Field>
          </div>

          <Field label={t("maintenance.description")}>
            <Textarea
              name="description"
              rows={3}
              defaultValue={job?.description ?? ""}
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
