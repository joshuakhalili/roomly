"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { createRoom, updateRoom } from "@/lib/actions/rooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Field, FormError } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import type { Room } from "@/lib/types";

export function RoomDialog({
  propertyId,
  room,
  trigger,
}: {
  propertyId: string;
  room?: Room;
  trigger?: React.ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCommonArea, setIsCommonArea] = useState(room?.is_common_area ?? false);
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(room);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateRoom(room!.id, formData)
        : await createRoom(propertyId, formData);

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
          <Button>
            <Plus className="size-4" aria-hidden />
            {t("rooms.add")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t("rooms.edit") : t("rooms.add")}</DialogTitle>
        </DialogHeader>

        <form action={onSubmit} className="flex flex-col gap-4">
          <Field label={t("rooms.name")} htmlFor="name" required>
            <Input
              id="name"
              name="name"
              defaultValue={room?.name}
              placeholder="Room 1"
              required
              autoFocus
              disabled={isPending}
            />
          </Field>

          <Field
            label={t("rooms.type")}
            htmlFor="unit_type"
            hint={t("rooms.typeHint")}
          >
            <Select
              name="unit_type"
              defaultValue={room?.unit_type ?? "studio"}
              disabled={isPending}
            >
              <SelectTrigger id="unit_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="studio">{t("rooms.unitStudio")}</SelectItem>
                <SelectItem value="flat">{t("rooms.unitFlat")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <div className="flex items-center gap-2">
            <Checkbox
              id="is_common_area"
              name="is_common_area"
              checked={isCommonArea}
              onCheckedChange={(v) => setIsCommonArea(v === true)}
              disabled={isPending}
            />
            <Label htmlFor="is_common_area" className="font-normal">
              {t("rooms.isCommonArea")}
            </Label>
          </div>

          {/* A shared area can't be let on its own, so the option disappears
              rather than sitting there contradicting the checkbox above. */}
          {!isCommonArea && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="is_lettable"
                name="is_lettable"
                defaultChecked={room?.is_lettable ?? true}
                disabled={isPending}
              />
              <Label htmlFor="is_lettable" className="font-normal">
                {t("rooms.isLettable")}
              </Label>
            </div>
          )}

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
