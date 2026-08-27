"use client";

import { useState, useTransition } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import {
  saveMeterReading,
  saveKey,
  saveDetector,
  deleteReportRecord,
  signChecklist,
} from "@/lib/actions/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Gauge, KeyRound, BellRing, PenLine } from "lucide-react";
import type {
  ChecklistDeclaration,
  ChecklistDetector,
  ChecklistKey,
  ChecklistMeter,
} from "@/lib/types";

function SectionShell({
  title,
  Icon,
  children,
}: {
  title: string;
  Icon: typeof Gauge;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <p className="flex items-center gap-2 font-medium">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          {title}
        </p>
        {children}
      </CardContent>
    </Card>
  );
}

export function ReportDetails({
  checklistId,
  meters,
  keys,
  detectors,
  declarations,
  readOnly,
}: {
  checklistId: string;
  meters: ChecklistMeter[];
  keys: ChecklistKey[];
  detectors: ChecklistDetector[];
  declarations: ChecklistDeclaration[];
  readOnly: boolean;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error ?? t("common.error"));
        return;
      }
      setAdding(null);
      toast.success(t("common.saved"));
      router.refresh();
    });
  }

  const removeButton = (
    table: "checklist_meters" | "checklist_keys" | "checklist_detectors",
    id: string,
  ) =>
    !readOnly && (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => run(() => deleteReportRecord(table, id))}
        disabled={isPending}
        aria-label={t("common.delete")}
      >
        <Trash2 className="size-4 text-destructive" aria-hidden />
      </Button>
    );

  const assessorSig = declarations.find((d) => d.role === "assessor");
  const tenantSig = declarations.find((d) => d.role === "tenant");

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {/* Meters */}
      <SectionShell title={t("inventory.meters")} Icon={Gauge}>
        {meters.map((m) => (
          <div key={m.id} className="flex items-center gap-2 text-sm">
            <Badge variant="secondary" className="shrink-0">
              {t(
                m.meter_type === "electricity"
                  ? "inventory.meterElectricity"
                  : m.meter_type === "gas"
                    ? "inventory.meterGas"
                    : "inventory.meterWater",
              )}
            </Badge>
            <span className="font-medium tabular-nums">{m.reading}</span>
            <span className="truncate text-xs text-muted-foreground">
              {m.serial_number}
            </span>
            <span className="ml-auto shrink-0">
              {removeButton("checklist_meters", m.id)}
            </span>
          </div>
        ))}

        {adding === "meter" ? (
          <form
            action={(fd) => run(() => saveMeterReading(checklistId, fd))}
            className="flex flex-col gap-3 border-t pt-3"
          >
            <Field label={t("rooms.type")}>
              <Select name="meter_type" defaultValue="electricity">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="electricity">
                    {t("inventory.meterElectricity")}
                  </SelectItem>
                  <SelectItem value="gas">{t("inventory.meterGas")}</SelectItem>
                  <SelectItem value="water">{t("inventory.meterWater")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("inventory.reading")} required>
              <Input name="reading" required inputMode="numeric" />
            </Field>
            <Field label={t("inventory.serialNumber")}>
              <Input name="serial_number" />
            </Field>
            <Field label={t("inventory.location")}>
              <Input name="location" />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isPending}>
                {t("common.save")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setAdding(null)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        ) : (
          !readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAdding("meter")}
              className="self-start"
            >
              <Plus className="size-4" aria-hidden />
              {t("inventory.meters")}
            </Button>
          )
        )}
      </SectionShell>

      {/* Keys */}
      <SectionShell title={t("inventory.keys")} Icon={KeyRound}>
        {keys.map((k) => (
          <div key={k.id} className="flex items-start gap-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {k.description}{" "}
                <span className="text-muted-foreground">× {k.quantity}</span>
              </p>
              {k.comments && (
                <p className="text-xs text-muted-foreground">{k.comments}</p>
              )}
            </div>
            {removeButton("checklist_keys", k.id)}
          </div>
        ))}

        {adding === "key" ? (
          <form
            action={(fd) => run(() => saveKey(checklistId, fd))}
            className="flex flex-col gap-3 border-t pt-3"
          >
            <Field label={t("inventory.keyDescription")} required>
              <Input name="description" required placeholder="Front door" />
            </Field>
            <Field label={t("inventory.quantity")}>
              <Input name="quantity" type="number" min="1" defaultValue={1} />
            </Field>
            <Field label={t("inventory.comments")}>
              <Textarea name="comments" rows={2} />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isPending}>
                {t("common.save")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setAdding(null)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        ) : (
          !readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAdding("key")}
              className="self-start"
            >
              <Plus className="size-4" aria-hidden />
              {t("inventory.keys")}
            </Button>
          )
        )}
      </SectionShell>

      {/* Detectors */}
      <SectionShell title={t("inventory.detectors")} Icon={BellRing}>
        {detectors.map((d) => (
          <div key={d.id} className="flex items-center gap-2 text-sm">
            <Badge variant="secondary" className="shrink-0">
              {t(
                d.detector_type === "smoke"
                  ? "inventory.smokeAlarm"
                  : "inventory.coDetector",
              )}
            </Badge>
            <span className="truncate">{d.location}</span>
            <Badge
              variant={d.tested ? "default" : "outline"}
              className="ml-auto shrink-0 text-xs"
            >
              {d.tested ? t("common.yes") : t("common.no")}
            </Badge>
            {removeButton("checklist_detectors", d.id)}
          </div>
        ))}

        {adding === "detector" ? (
          <form
            action={(fd) => run(() => saveDetector(checklistId, fd))}
            className="flex flex-col gap-3 border-t pt-3"
          >
            <Field label={t("rooms.type")}>
              <Select name="detector_type" defaultValue="smoke">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="smoke">{t("inventory.smokeAlarm")}</SelectItem>
                  <SelectItem value="co">{t("inventory.coDetector")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("inventory.location")}>
              <Input name="location" placeholder="Hallway" />
            </Field>
            <div className="flex items-center gap-2">
              <Checkbox id="tested" name="tested" defaultChecked />
              <Label htmlFor="tested" className="font-normal">
                {t("inventory.tested")}
              </Label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isPending}>
                {t("common.save")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setAdding(null)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        ) : (
          !readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAdding("detector")}
              className="self-start"
            >
              <Plus className="size-4" aria-hidden />
              {t("inventory.detectors")}
            </Button>
          )
        )}
      </SectionShell>

      {/* Declarations */}
      <SectionShell title={t("inventory.declarations")} Icon={PenLine}>
        {[
          {
            role: "assessor" as const,
            sig: assessorSig,
            text: t("inventory.assessorDeclaration"),
          },
          {
            role: "tenant" as const,
            sig: tenantSig,
            text: t("inventory.tenantDeclaration"),
          },
        ].map(({ role, sig, text }) => (
          <div key={role} className="flex flex-col gap-2 border-t pt-3 first:border-0 first:pt-0">
            <p className="text-xs text-muted-foreground">{text}</p>
            {sig ? (
              <p className="text-sm">
                <span className="font-medium">{sig.typed_name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {t("inventory.signedOn", {
                    date: format.dateTime(new Date(sig.signed_at), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }),
                  })}
                </span>
              </p>
            ) : (
              !readOnly && (
                <form
                  action={(fd) =>
                    run(() =>
                      signChecklist(
                        checklistId,
                        role,
                        String(fd.get("typed_name") ?? ""),
                        (fd.get("email") as string) || null,
                      ),
                    )
                  }
                  className="flex flex-col gap-2 sm:flex-row"
                >
                  <Input
                    name="typed_name"
                    placeholder={t("inventory.typedName")}
                    required
                    className="sm:flex-1"
                  />
                  <Button type="submit" size="sm" disabled={isPending}>
                    {t("inventory.sign")}
                  </Button>
                </form>
              )
            )}
          </div>
        ))}
      </SectionShell>
    </div>
  );
}
