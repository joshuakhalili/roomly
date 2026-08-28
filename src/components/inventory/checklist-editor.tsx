"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { addArea, deleteArea, completeChecklist } from "@/lib/actions/inventory";
import { AreaSections } from "./area-sections";
import { RatingBadge } from "./rating-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { OptionSelect } from "@/components/ui/option-select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JobDialog } from "@/components/maintenance/job-dialog";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Wrench,
} from "lucide-react";
import type {
  Contact,
  Property,
  Room,
  ServiceType,
  AreaType,
  ChecklistArea,
  ChecklistPhoto,
  ChecklistSection,
  InventoryChecklist,
} from "@/lib/types";

export function ChecklistEditor({
  checklist,
  areas,
  sections,
  photos,
  areaTypes,
  maintenance,
}: {
  checklist: InventoryChecklist;
  areas: ChecklistArea[];
  sections: ChecklistSection[];
  photos: ChecklistPhoto[];
  areaTypes: AreaType[];
  /**
   * What is needed to turn a defect into a booked job without leaving the
   * page. Optional so a checklist still renders if it is not supplied.
   */
  maintenance?: {
    propertyId: string;
    roomId: string | null;
    properties: Property[];
    rooms: Room[];
    serviceTypes: ServiceType[];
    contacts: Contact[];
    bookedSectionIds: string[];
  };
}) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openArea, setOpenArea] = useState<string | null>(areas[0]?.id ?? null);
  const [addOpen, setAddOpen] = useState(false);

  const sectionsByArea = new Map<string, ChecklistSection[]>();
  for (const s of sections) {
    const list = sectionsByArea.get(s.checklist_area_id) ?? [];
    list.push(s);
    sectionsByArea.set(s.checklist_area_id, list);
  }

  const photosBySection = new Map<string, ChecklistPhoto[]>();
  for (const p of photos) {
    const list = photosBySection.get(p.checklist_section_id) ?? [];
    list.push(p);
    photosBySection.set(p.checklist_section_id, list);
  }

  /** Summary figures per area — the Report Summary table. */
  const summary = areas.map((area) => {
    const areaSections = sectionsByArea.get(area.id) ?? [];
    const overview = areaSections.find((s) =>
      s.section_name.toLowerCase().includes("general overview"),
    );
    return {
      area,
      condition: overview?.condition_rating ?? null,
      cleanliness: overview?.cleanliness_rating ?? null,
      defects: areaSections.filter((s) => s.flagged_for_maintenance).length,
      photoCount: areaSections.reduce(
        (n, s) => n + (photosBySection.get(s.id)?.length ?? 0),
        0,
      ),
      completed: areaSections.filter((s) => s.condition_rating !== null).length,
      total: areaSections.length,
    };
  });

  // Defects roll up across every area, grouped by where they were found.
  const defects = areas.flatMap((area) =>
    (sectionsByArea.get(area.id) ?? [])
      .filter((s) => s.flagged_for_maintenance)
      .map((s) => ({ area, section: s })),
  );

  function onAddArea(formData: FormData) {
    const areaTypeId = String(formData.get("area_type_id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    if (!areaTypeId || !name) return;

    startTransition(async () => {
      const result = await addArea(checklist.id, areaTypeId, name);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setAddOpen(false);
      setOpenArea(result.data.id);
      toast.success(t("common.saved"));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Report summary */}
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("inventory.summary")}</h2>
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("inventory.sections")}</TableHead>
                  <TableHead>{t("inventory.condition")}</TableHead>
                  <TableHead>{t("inventory.cleanliness")}</TableHead>
                  <TableHead className="text-right">
                    {t("inventory.defects")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("inventory.photos")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((row) => (
                  <TableRow key={row.area.id}>
                    <TableCell className="font-medium">
                      {row.area.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {row.completed}/{row.total}
                      </span>
                    </TableCell>
                    <TableCell>
                      <RatingBadge value={row.condition} />
                    </TableCell>
                    <TableCell>
                      <RatingBadge value={row.cleanliness} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.defects}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.photoCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* Areas */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("inventory.title")}</h2>

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="size-4" aria-hidden />
                {t("inventory.addArea")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("inventory.addArea")}</DialogTitle>
              </DialogHeader>
              <form action={onAddArea} className="flex flex-col gap-4">
                <Field label={t("rooms.type")} required>
                  <OptionSelect
                    name="area_type_id"
                    defaultValue={areaTypes[0]?.id}
                    options={areaTypes.map((at) => ({
                      value: at.id,
                      label: at.name,
                    }))}
                  />
                </Field>
                <Field
                  label={t("rooms.name")}
                  required
                  hint={t("inventory.areaNameHint")}
                >
                  <Input name="name" placeholder="Bedroom 2" required />
                </Field>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddOpen(false)}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {t("common.save")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {areas.map((area) => {
          const areaSections = sectionsByArea.get(area.id) ?? [];
          const isOpen = openArea === area.id;
          const done = areaSections.filter((s) => s.condition_rating !== null).length;

          return (
            <div key={area.id} className="rounded-lg border">
              <div className="flex items-center gap-2 p-3">
                <button
                  type="button"
                  onClick={() => setOpenArea(isOpen ? null : area.id)}
                  className="flex flex-1 items-center gap-2 text-left"
                  aria-expanded={isOpen}
                >
                  {isOpen ? (
                    <ChevronDown className="size-4 shrink-0" aria-hidden />
                  ) : (
                    <ChevronRight className="size-4 shrink-0" aria-hidden />
                  )}
                  <span className="font-medium">{area.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {done}/{areaSections.length}
                  </Badge>
                  {done === areaSections.length && areaSections.length > 0 && (
                    <CircleCheck
                      className="size-4 text-emerald-600"
                      aria-hidden
                    />
                  )}
                </button>

                <ConfirmDelete
                  title={t("inventory.deleteAreaConfirm")}
                  description={t("inventory.deleteAreaWarning")}
                  onConfirm={() => deleteArea(area.id)}
                  trigger={
                    <Button variant="ghost" size="sm" aria-label={t("common.delete")}>
                      <Trash2 className="size-4 text-destructive" aria-hidden />
                    </Button>
                  }
                />
              </div>

              {isOpen && (
                <div className="border-t p-3">
                  <AreaSections
                    areaId={area.id}
                    sections={areaSections}
                    photosBySection={photosBySection}
                    readOnly={checklist.status === "completed"}
                  />
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Defects roll-up */}
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("inventory.defects")}</h2>
        {defects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("inventory.noDefects")}
          </p>
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-3 p-4">
              {defects.map(({ area, section }) => {
                const booked =
                  maintenance?.bookedSectionIds.includes(section.id) ?? false;
                return (
                  <div key={section.id} className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {area.name} · {section.section_name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <RatingBadge value={section.condition_rating} />
                        <RatingBadge value={section.cleanliness_rating} />
                      </div>
                      {section.description && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {section.description}
                        </p>
                      )}
                    </div>

                    {/* The whole reason the flag exists. Without this a
                        defect list is something you read and then retype
                        somewhere else. Marking the job done clears the flag,
                        so the list cannot drift out of date. */}
                    {maintenance &&
                      (booked ? (
                        <Badge variant="secondary" className="shrink-0">
                          {t("inventory.repairBooked")}
                        </Badge>
                      ) : (
                        <JobDialog
                          properties={maintenance.properties}
                          rooms={maintenance.rooms}
                          serviceTypes={maintenance.serviceTypes}
                          contacts={maintenance.contacts}
                          defaultPropertyId={maintenance.propertyId}
                          checklistSectionId={section.id}
                          trigger={
                            <Button variant="outline" size="sm">
                              <Wrench className="size-4" aria-hidden />
                              {t("inventory.bookRepair")}
                            </Button>
                          }
                        />
                      ))}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </section>

      {checklist.status !== "completed" && (
        <Button
          onClick={() =>
            startTransition(async () => {
              const res = await completeChecklist(checklist.id, null);
              if (!res.ok) toast.error(res.error);
              else {
                toast.success(t("common.saved"));
                router.refresh();
              }
            })
          }
          disabled={isPending}
        >
          <CircleCheck className="size-4" aria-hidden />
          {t("inventory.markComplete")}
        </Button>
      )}
    </div>
  );
}
