"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { saveContact, archiveContact } from "@/lib/actions/maintenance";
import { serviceLabel } from "./service-label";
import { whatsappLink } from "@/lib/messaging";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Pencil, MessageCircle, Mail, Phone, Archive } from "lucide-react";
import type {
  Contact,
  JobWithContext,
  Property,
  ServiceType,
} from "@/lib/types";

const WHATSAPP_GREEN = "#25D366";
const NONE = "__none__";

function ContactDialog({
  contact,
  serviceTypes,
  properties,
}: {
  contact?: Contact;
  serviceTypes: ServiceType[];
  properties: Property[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    for (const key of ["service_type_id", "usual_property_id"]) {
      if (formData.get(key) === NONE) formData.set(key, "");
    }
    startTransition(async () => {
      const result = await saveContact(contact?.id ?? null, formData);
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
        <Button size="sm" variant={contact ? "ghost" : "default"}>
          {contact ? (
            <Pencil className="size-4" aria-hidden />
          ) : (
            <>
              <Plus className="size-4" aria-hidden />
              {t("maintenance.addContact")}
            </>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {contact ? t("maintenance.editContact") : t("maintenance.addContact")}
          </DialogTitle>
        </DialogHeader>

        <form action={submit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("maintenance.contactName")} required>
              <Input
                name="name"
                defaultValue={contact?.name ?? ""}
                required
                disabled={isPending}
              />
            </Field>
            <Field label={t("maintenance.company")}>
              <Input
                name="company"
                defaultValue={contact?.company ?? ""}
                disabled={isPending}
              />
            </Field>
          </div>

          <Field label={t("maintenance.trade")}>
            <OptionSelect
              name="service_type_id"
              defaultValue={contact?.service_type_id ?? NONE}
              disabled={isPending}
              options={[
                { value: NONE, label: t("common.notSet") },
                ...serviceTypes.map((st) => ({
                  value: st.id,
                  label: serviceLabel(t, st),
                })),
              ]}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("tenancy.phone")} hint={t("maintenance.phoneHint")}>
              <Input
                name="phone"
                type="tel"
                defaultValue={contact?.phone ?? ""}
                placeholder="07700 900000"
                disabled={isPending}
              />
            </Field>
            <Field label={t("tenancy.email")}>
              <Input
                name="email"
                type="email"
                defaultValue={contact?.email ?? ""}
                disabled={isPending}
              />
            </Field>
          </div>

          <Field
            label={t("maintenance.usualProperty")}
            hint={t("maintenance.usualPropertyHint")}
          >
            <OptionSelect
              name="usual_property_id"
              defaultValue={contact?.usual_property_id ?? NONE}
              disabled={isPending}
              options={[
                { value: NONE, label: t("maintenance.anyProperty") },
                ...properties.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </Field>

          <Field label={t("tenancy.notes")}>
            <Textarea
              name="notes"
              rows={2}
              defaultValue={contact?.notes ?? ""}
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

export function ContactsPanel({
  contacts,
  serviceTypes,
  properties,
  jobs,
}: {
  contacts: Contact[];
  serviceTypes: ServiceType[];
  properties: Property[];
  jobs: JobWithContext[];
}) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tradeFilter, setTradeFilter] = useState("all");

  /**
   * How much each contact has been paid, and when they last worked.
   *
   * This is the "how many times have we used a landscaper this year, and what
   * did it cost" question — answered per person, from the jobs already
   * recorded, without anyone entering anything extra.
   */
  const stats = useMemo(() => {
    const map = new Map<string, { jobs: number; spend: number; last: string }>();
    for (const job of jobs) {
      if (!job.contact_id || job.status === "cancelled") continue;
      const s = map.get(job.contact_id) ?? { jobs: 0, spend: 0, last: "" };
      s.jobs += 1;
      s.spend += Number(job.cost ?? 0);
      if (job.scheduled_for > s.last) s.last = job.scheduled_for;
      map.set(job.contact_id, s);
    }
    return map;
  }, [jobs]);

  const visible = contacts.filter(
    (c) => tradeFilter === "all" || c.service_type_id === tradeFilter,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={tradeFilter === "all" ? "default" : "outline"}
          onClick={() => setTradeFilter("all")}
        >
          {t("filters.all")}
        </Button>
        {serviceTypes.map((st) => (
          <Button
            key={st.id}
            size="sm"
            variant={tradeFilter === st.id ? "default" : "outline"}
            onClick={() => setTradeFilter(st.id)}
          >
            {serviceLabel(t, st)}
          </Button>
        ))}
        <div className="ml-auto">
          <ContactDialog serviceTypes={serviceTypes} properties={properties} />
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t("maintenance.noContacts")}
        </p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {visible.map((c) => {
            const trade = serviceTypes.find((st) => st.id === c.service_type_id);
            const s = stats.get(c.id);
            return (
              <li key={c.id}>
                <Card>
                  <CardContent className="flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {c.name}
                          {trade && (
                            <Badge variant="secondary" className="text-xs">
                              {serviceLabel(t, trade)}
                            </Badge>
                          )}
                        </p>
                        {c.company && (
                          <p className="truncate text-sm text-muted-foreground">
                            {c.company}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0">
                        <ContactDialog
                          contact={c}
                          serviceTypes={serviceTypes}
                          properties={properties}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          aria-label={t("maintenance.archiveContact")}
                          onClick={() =>
                            startTransition(async () => {
                              const r = await archiveContact(c.id);
                              if (!r.ok) {
                                toast.error(r.error);
                                return;
                              }
                              toast.success(t("common.saved"));
                              router.refresh();
                            })
                          }
                        >
                          <Archive className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </div>

                    {s && (
                      <p className="text-xs text-muted-foreground">
                        {t("maintenance.contactStats", {
                          count: s.jobs,
                          spend: format.number(s.spend, {
                            style: "currency",
                            currency: "GBP",
                            maximumFractionDigits: 0,
                          }),
                        })}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {c.phone && (
                        <>
                          <Button
                            asChild
                            size="sm"
                            style={{ backgroundColor: WHATSAPP_GREEN }}
                          >
                            <a
                              href={whatsappLink(c.phone, "") ?? undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MessageCircle className="size-4" aria-hidden />
                              WhatsApp
                            </a>
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <a href={`tel:${c.phone}`}>
                              <Phone className="size-4" aria-hidden />
                              {c.phone}
                            </a>
                          </Button>
                        </>
                      )}
                      {c.email && (
                        <Button asChild size="sm" variant="outline">
                          <a href={`mailto:${c.email}`}>
                            <Mail className="size-4" aria-hidden />
                            {t("tenancy.email")}
                          </a>
                        </Button>
                      )}
                    </div>

                    {c.notes && (
                      <p className="text-xs text-muted-foreground">{c.notes}</p>
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
