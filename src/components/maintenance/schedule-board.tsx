"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import {
  addMonths,
  endOfMonth,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  addDays,
} from "date-fns";
import { setJobStatus, setJobPaid, deleteJob } from "@/lib/actions/maintenance";
import { JobDialog } from "./job-dialog";
import { RecurrencesDialog } from "./recurrences-dialog";
import { AttachedDocuments } from "./attached-documents";
import { serviceLabel } from "./service-label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Undo2,
  Banknote,
  MessageCircle,
  CalendarDays,
  MapPin,
  Repeat,
  Trash2,
} from "lucide-react";
import { whatsappLink } from "@/lib/messaging";
import type {
  Contact,
  DocumentRecord,
  JobRecurrence,
  JobWithContext,
  Property,
  Room,
  ServiceType,
} from "@/lib/types";

const WHATSAPP_GREEN = "#25D366";

/** Monday-first, which is how a UK working week reads. */
const WEEK_STARTS_ON = 1;

export function ScheduleBoard({
  jobs,
  properties,
  rooms,
  serviceTypes,
  contacts,
  recurrences,
  documents,
}: {
  jobs: JobWithContext[];
  properties: Property[];
  rooms: Room[];
  serviceTypes: ServiceType[];
  contacts: Contact[];
  recurrences: JobRecurrence[];
  documents: DocumentRecord[];
}) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const byDay = useMemo(() => {
    const map = new Map<string, JobWithContext[]>();
    for (const job of jobs) {
      if (typeFilter !== "all" && job.service_type_id !== typeFilter) continue;
      const list = map.get(job.scheduled_for) ?? [];
      list.push(job);
      map.set(job.scheduled_for, list);
    }
    return map;
  }, [jobs, typeFilter]);

  /** Six rows of seven, so the grid never changes height between months. */
  const grid = useMemo(() => {
    const first = startOfWeek(startOfMonth(month), {
      weekStartsOn: WEEK_STARTS_ON,
    });
    return Array.from({ length: 42 }, (_, i) => addDays(first, i));
  }, [month]);

  const visible = useMemo(() => {
    const inMonth = jobs.filter((job) => {
      if (typeFilter !== "all" && job.service_type_id !== typeFilter)
        return false;
      const d = parseISO(job.scheduled_for);
      return selectedDay
        ? isSameDay(d, selectedDay)
        : d >= startOfMonth(month) && d <= endOfMonth(month);
    });
    return inMonth.sort((a, b) =>
      a.scheduled_for < b.scheduled_for ? -1 : 1,
    );
  }, [jobs, month, selectedDay, typeFilter]);

  const selected = jobs.find((j) => j.id === selectedId) ?? null;

  const monthCost = visible
    .filter((j) => j.status !== "cancelled")
    .reduce((sum, j) => sum + Number(j.cost ?? 0), 0);
  const unpaid = visible.filter(
    (j) => j.status !== "cancelled" && !j.is_paid && j.cost,
  ).length;

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error ?? t("common.error"));
        return;
      }
      toast.success(t("common.saved"));
      router.refresh();
    });
  }

  const money = (n: number) =>
    format.number(n, { style: "currency", currency: "GBP" });

  const contact = selected
    ? contacts.find((c) => c.id === selected.contact_id)
    : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Filters and the one button that creates work. */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={typeFilter === "all" ? "default" : "outline"}
          onClick={() => setTypeFilter("all")}
        >
          {t("filters.all")}
        </Button>
        {serviceTypes.map((st) => (
          <Button
            key={st.id}
            size="sm"
            variant={typeFilter === st.id ? "default" : "outline"}
            onClick={() => setTypeFilter(st.id)}
          >
            {serviceLabel(t, st)}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <RecurrencesDialog
            recurrences={recurrences}
            properties={properties}
            rooms={rooms}
            serviceTypes={serviceTypes}
            contacts={contacts}
          />
          <JobDialog
            properties={properties}
            rooms={rooms}
            serviceTypes={serviceTypes}
            contacts={contacts}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Calendar ─────────────────────────────────────────────────── */}
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMonth(addMonths(month, -1))}
                aria-label={t("maintenance.previousMonth")}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <p className="font-medium">
                {format.dateTime(month, { month: "long", year: "numeric" })}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMonth(addMonths(month, 1))}
                aria-label={t("maintenance.nextMonth")}
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {grid.slice(0, 7).map((d) => (
                <div
                  key={`h-${d.toISOString()}`}
                  className="pb-1 text-[11px] font-medium text-muted-foreground"
                >
                  {format.dateTime(d, { weekday: "short" })}
                </div>
              ))}

              {grid.map((day) => {
                const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
                const dayJobs = byDay.get(key) ?? [];
                const outside = !isSameMonth(day, month);
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                const isToday = isSameDay(day, new Date());

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setSelectedDay(isSelected ? null : day)
                    }
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center gap-1 rounded-md text-sm transition-colors",
                      outside && "text-muted-foreground/40",
                      isToday && "font-semibold text-primary",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-secondary",
                    )}
                    aria-label={format.dateTime(day, { dateStyle: "full" })}
                    aria-pressed={Boolean(isSelected)}
                  >
                    <span className="leading-none">{day.getDate()}</span>
                    {/* A count, not one dot per job — three cleans on a
                        Tuesday must not overflow the cell. */}
                    {dayJobs.length > 0 && (
                      <span
                        className={cn(
                          "flex h-1.5 items-center gap-0.5",
                          isSelected ? "opacity-90" : "",
                        )}
                      >
                        {dayJobs.length > 2 ? (
                          <span className="text-[9px] leading-none tabular-nums">
                            {dayJobs.length}
                          </span>
                        ) : (
                          dayJobs.map((j) => (
                            <span
                              key={j.id}
                              className={cn(
                                "size-1.5 rounded-full",
                                isSelected
                                  ? "bg-primary-foreground"
                                  : j.status === "done"
                                    ? "bg-emerald-500"
                                    : j.status === "cancelled"
                                      ? "bg-muted-foreground/40"
                                      : "bg-primary",
                              )}
                            />
                          ))
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedDay && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDay(null)}
                className="self-start"
              >
                {t("maintenance.showWholeMonth")}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* ── Job list ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
            <p className="text-sm font-medium">
              {selectedDay
                ? format.dateTime(selectedDay, { dateStyle: "long" })
                : format.dateTime(month, { month: "long", year: "numeric" })}
              <span className="ml-2 text-muted-foreground">
                {t("maintenance.jobCount", { count: visible.length })}
              </span>
            </p>
            {monthCost > 0 && (
              <p className="text-sm tabular-nums text-muted-foreground">
                {money(monthCost)}
                {unpaid > 0 && (
                  <span className="ml-2 text-destructive">
                    {t("maintenance.unpaidCount", { count: unpaid })}
                  </span>
                )}
              </p>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              {t("maintenance.noJobs")}
            </p>
          ) : (
            <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1">
              {visible.map((job) => (
                <li key={job.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedId(selectedId === job.id ? null : job.id)
                    }
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition-colors",
                      selectedId === job.id
                        ? "border-primary bg-secondary/60"
                        : "hover:bg-secondary/40",
                      job.status === "cancelled" && "opacity-60",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "font-medium",
                          job.status === "cancelled" && "line-through",
                        )}
                      >
                        {job.title}
                      </span>
                      {job.status === "done" && (
                        <Badge variant="secondary" className="text-xs">
                          {t("maintenance.statusDone")}
                        </Badge>
                      )}
                      {job.cost && !job.is_paid && job.status !== "cancelled" && (
                        <Badge variant="destructive" className="text-xs">
                          {t("maintenance.unpaid")}
                        </Badge>
                      )}
                      {job.source === "tenancy_end" && (
                        <Badge variant="outline" className="text-xs">
                          {t("maintenance.turnaround")}
                        </Badge>
                      )}
                      {job.source === "recurring" && (
                        <Repeat
                          className="size-3 text-muted-foreground"
                          aria-hidden
                        />
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {format.dateTime(parseISO(job.scheduled_for), {
                        dateStyle: "medium",
                      })}
                      {job.scheduled_time && ` · ${job.scheduled_time.slice(0, 5)}`}
                      {" · "}
                      {job.property_name}
                      {job.room_name && ` · ${job.room_name}`}
                      {job.contact_name && ` · ${job.contact_name}`}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Selected job ───────────────────────────────────────────────── */}
      {selected && (
        <Card className="border-primary/40">
          <CardContent className="flex flex-col gap-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold">{selected.title}</h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="size-3.5" aria-hidden />
                    {format.dateTime(parseISO(selected.scheduled_for), {
                      dateStyle: "full",
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden />
                    {selected.property_name}
                    {selected.room_name && ` · ${selected.room_name}`}
                  </span>
                  {selected.service_type_name && (
                    <Badge variant="outline" className="text-xs">
                      {selected.service_type_slug
                        ? t(`maintenance.service.${selected.service_type_slug}`)
                        : selected.service_type_name}
                    </Badge>
                  )}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <JobDialog
                  job={selected}
                  properties={properties}
                  rooms={rooms}
                  serviceTypes={serviceTypes}
                  contacts={contacts}
                />
                <ConfirmDelete
                  title={t("maintenance.deleteJob")}
                  description={t("maintenance.deleteJobWarning")}
                  onConfirm={() => deleteJob(selected.id)}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Trash2 className="size-4 text-destructive" aria-hidden />
                      {t("common.delete")}
                    </Button>
                  }
                />
              </div>
            </div>

            {selected.description && (
              <p className="text-sm">{selected.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {selected.status === "done" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => act(() => setJobStatus(selected.id, "booked"))}
                  disabled={isPending}
                >
                  <Undo2 className="size-4" aria-hidden />
                  {t("maintenance.reopen")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => act(() => setJobStatus(selected.id, "done"))}
                  disabled={isPending}
                >
                  <Check className="size-4" aria-hidden />
                  {t("maintenance.markDone")}
                </Button>
              )}

              {selected.cost != null && (
                <Button
                  variant={selected.is_paid ? "outline" : "default"}
                  size="sm"
                  onClick={() =>
                    act(() => setJobPaid(selected.id, !selected.is_paid))
                  }
                  disabled={isPending}
                >
                  <Banknote className="size-4" aria-hidden />
                  {selected.is_paid
                    ? t("maintenance.markUnpaid")
                    : t("maintenance.markPaid", {
                        amount: money(Number(selected.cost)),
                      })}
                </Button>
              )}

              {contact?.phone && (
                <Button
                  asChild
                  size="sm"
                  style={{ backgroundColor: WHATSAPP_GREEN }}
                >
                  <a
                    href={whatsappLink(contact.phone, "") ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="size-4" aria-hidden />
                    {contact.name}
                  </a>
                </Button>
              )}
            </div>

            <AttachedDocuments
              propertyId={selected.property_id}
              jobId={selected.id}
              documents={documents.filter(
                (d) => d.maintenance_job_id === selected.id,
              )}
              offered={["maintenance_invoice", "warranty", "receipt", "other"]}
              defaultAmount={selected.cost}
              defaultSupplier={selected.contact_name}
            />

            {selected.checklist_section_id && (
              <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                {t("maintenance.fromDefect")}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
