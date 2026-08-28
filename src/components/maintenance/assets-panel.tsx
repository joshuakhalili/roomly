"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { saveAsset, disposeAsset } from "@/lib/actions/maintenance";
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
import { Plus, Pencil, PackageX, ShieldCheck } from "lucide-react";
import type { Asset, Property, Room } from "@/lib/types";

const NO_ROOM = "__whole_property__";

/** Flagged as running out inside this window, so it reads as "act soon". */
const EXPIRING_SOON_DAYS = 60;

function AssetDialog({
  asset,
  properties,
  rooms,
}: {
  asset?: Asset;
  properties: Property[];
  rooms: Room[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [propertyId, setPropertyId] = useState(
    asset?.property_id ?? properties[0]?.id ?? "",
  );

  function submit(formData: FormData) {
    setError(null);
    if (formData.get("room_id") === NO_ROOM) formData.set("room_id", "");
    startTransition(async () => {
      const result = await saveAsset(asset?.id ?? null, formData);
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
        <Button size="sm" variant={asset ? "ghost" : "default"}>
          {asset ? (
            <Pencil className="size-4" aria-hidden />
          ) : (
            <>
              <Plus className="size-4" aria-hidden />
              {t("maintenance.addAsset")}
            </>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {asset ? t("maintenance.editAsset") : t("maintenance.addAsset")}
          </DialogTitle>
        </DialogHeader>

        <form action={submit} className="flex flex-col gap-4">
          <Field label={t("maintenance.itemName")} required>
            <Input
              name="name"
              defaultValue={asset?.name ?? ""}
              required
              placeholder={t("maintenance.itemNamePlaceholder")}
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
                options={properties.map((p) => ({ value: p.id, label: p.name }))}
              />
            </Field>
            <Field label={t("rooms.title")}>
              <OptionSelect
                name="room_id"
                defaultValue={asset?.room_id ?? NO_ROOM}
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
            <Field label={t("maintenance.makeModel")}>
              <Input
                name="make_model"
                defaultValue={asset?.make_model ?? ""}
                disabled={isPending}
              />
            </Field>
            <Field label={t("inventory.serialNumber")}>
              <Input
                name="serial_number"
                defaultValue={asset?.serial_number ?? ""}
                disabled={isPending}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("maintenance.purchasedOn")}>
              <Input
                type="date"
                name="purchased_on"
                defaultValue={asset?.purchased_on ?? ""}
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
                defaultValue={asset?.cost ?? ""}
                disabled={isPending}
              />
            </Field>
            <Field label={t("maintenance.warrantyUntil")}>
              <Input
                type="date"
                name="warranty_expires_on"
                defaultValue={asset?.warranty_expires_on ?? ""}
                disabled={isPending}
              />
            </Field>
          </div>

          <Field label={t("maintenance.supplier")}>
            <Input
              name="supplier_name"
              defaultValue={asset?.supplier_name ?? ""}
              disabled={isPending}
            />
          </Field>

          <Field label={t("tenancy.notes")}>
            <Textarea
              name="notes"
              rows={2}
              defaultValue={asset?.notes ?? ""}
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

export function AssetsPanel({
  assets,
  properties,
  rooms,
}: {
  assets: Asset[];
  properties: Property[];
  rooms: Room[];
}) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDisposed, setShowDisposed] = useState(false);

  const today = new Date();

  /**
   * Still covered first, then everything else.
   *
   * Warranty is visible, never alerted — you look here when something breaks
   * and want to know whether to call the supplier or the repair man. An alert
   * for a lapsing toaster guarantee would only teach you to ignore alerts.
   */
  const visible = useMemo(() => {
    const list = assets.filter((a) => showDisposed || !a.is_disposed);
    return [...list].sort((a, b) => {
      const aCovered = a.warranty_expires_on && a.warranty_expires_on >= toISO(today);
      const bCovered = b.warranty_expires_on && b.warranty_expires_on >= toISO(today);
      if (aCovered !== bCovered) return aCovered ? -1 : 1;
      return (b.purchased_on ?? "") > (a.purchased_on ?? "") ? 1 : -1;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, showDisposed]);

  const totalSpend = visible.reduce((s, a) => s + Number(a.cost ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          {t("maintenance.assetsHelp")}
        </p>
        <div className="ml-auto flex items-center gap-2">
          {totalSpend > 0 && (
            <span className="text-sm tabular-nums text-muted-foreground">
              {format.number(totalSpend, {
                style: "currency",
                currency: "GBP",
                maximumFractionDigits: 0,
              })}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowDisposed(!showDisposed)}
          >
            {showDisposed
              ? t("maintenance.hideDisposed")
              : t("maintenance.showDisposed")}
          </Button>
          <AssetDialog properties={properties} rooms={rooms} />
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t("maintenance.noAssets")}
        </p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((a) => {
            const property = properties.find((p) => p.id === a.property_id);
            const room = rooms.find((r) => r.id === a.room_id);
            const days = a.warranty_expires_on
              ? differenceInCalendarDays(parseISO(a.warranty_expires_on), today)
              : null;

            return (
              <li key={a.id}>
                <Card className={a.is_disposed ? "opacity-60" : undefined}>
                  <CardContent className="flex flex-col gap-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{a.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {property?.name}
                          {room ? ` · ${room.name}` : ` · ${t("maintenance.wholeProperty")}`}
                        </p>
                      </div>
                      <div className="flex shrink-0">
                        <AssetDialog
                          asset={a}
                          properties={properties}
                          rooms={rooms}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          aria-label={t("maintenance.dispose")}
                          onClick={() =>
                            startTransition(async () => {
                              const r = await disposeAsset(a.id, !a.is_disposed);
                              if (!r.ok) {
                                toast.error(r.error);
                                return;
                              }
                              toast.success(t("common.saved"));
                              router.refresh();
                            })
                          }
                        >
                          <PackageX className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </div>

                    {a.make_model && (
                      <p className="text-sm text-muted-foreground">
                        {a.make_model}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {a.cost != null && (
                        <span className="font-medium tabular-nums">
                          {format.number(Number(a.cost), {
                            style: "currency",
                            currency: "GBP",
                          })}
                        </span>
                      )}
                      {a.purchased_on && (
                        <span className="text-muted-foreground">
                          {format.dateTime(parseISO(a.purchased_on), {
                            dateStyle: "medium",
                          })}
                        </span>
                      )}
                    </div>

                    {days !== null && (
                      <Badge
                        variant={
                          days < 0
                            ? "outline"
                            : days <= EXPIRING_SOON_DAYS
                              ? "destructive"
                              : "secondary"
                        }
                        className="w-fit gap-1 text-xs"
                      >
                        <ShieldCheck className="size-3" aria-hidden />
                        {days < 0
                          ? t("maintenance.warrantyExpired")
                          : t("maintenance.warrantyDays", { count: days })}
                      </Badge>
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

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}
