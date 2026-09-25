"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useAutoOpen } from "@/components/ui/use-auto-open";
import imageCompression from "browser-image-compression";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { createProperty, updateProperty } from "@/lib/actions/properties";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Field, FormError } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import type { Property } from "@/lib/types";

/**
 * A banner is decoration at the top of a card, not evidence.
 *
 * Wider than an inventory photo because it is displayed wide, and squeezed
 * harder for the same reason a condition photo is: a phone photograph of the
 * front of a house is 4MB, and nobody needs 4MB to recognise their own
 * building.
 */
const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.4,
  maxWidthOrHeight: 1800,
  useWebWorker: true,
};

export function PropertyDialog({
  property,
  trigger,
  autoOpen,
}: {
  property?: Property;
  trigger?: React.ReactNode;
  /** Opens on arrival when the URL carries ?new=1 (from the New menu). */
  autoOpen?: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useAutoOpen(autoOpen);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const isEdit = Boolean(property);

  /* Shown at once, from the file itself, rather than waiting for a round trip
     to find out whether the right photo was picked. Revoked when it is
     replaced so the object URLs do not pile up over a long editing session. */
  function onPickBanner(file: File | undefined) {
    setPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const picked = formData.get("banner");

      // Compressed here rather than server-side: it keeps a large upload off
      // the wire entirely instead of sending it and shrinking it on arrival.
      if (picked instanceof File && picked.size > 0) {
        try {
          const compressed = await imageCompression(picked, COMPRESSION_OPTIONS);
          formData.set("banner", compressed, picked.name);
        } catch {
          setError(t("properties.bannerFailed"));
          return;
        }
      }

      const result = isEdit
        ? await updateProperty(property!.id, formData)
        : await createProperty(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      onPickBanner(undefined);
      formRef.current?.reset();
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
            {t("properties.add")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("properties.edit") : t("properties.add")}
          </DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={onSubmit} className="flex flex-col gap-4">
          <Field label={t("properties.name")} htmlFor="name" required>
            <Input
              id="name"
              name="name"
              defaultValue={property?.name}
              required
              autoFocus
              disabled={isPending}
            />
          </Field>

          <Field label={t("properties.address")} htmlFor="address">
            <Input
              id="address"
              name="address"
              defaultValue={property?.address ?? ""}
              disabled={isPending}
            />
          </Field>

          <Field
            label={t("properties.banner")}
            htmlFor="banner"
            hint={t("properties.bannerHint")}
          >
            <Input
              id="banner"
              name="banner"
              type="file"
              accept="image/*"
              disabled={isPending}
              onChange={(e) => onPickBanner(e.target.files?.[0])}
            />
          </Field>

          {preview && (
            /* eslint-disable-next-line @next/next/no-img-element -- a local
               object URL for a file that has not been uploaded yet */
            <img
              src={preview}
              alt=""
              className="aspect-[3/1] w-full rounded-lg border border-border object-cover"
            />
          )}

          {isEdit && property?.banner_path && !preview && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="remove_banner"
                name="remove_banner"
                disabled={isPending}
              />
              <Label htmlFor="remove_banner" className="font-normal">
                {t("properties.removeBanner")}
              </Label>
            </div>
          )}

          <Field label={t("properties.notes")} htmlFor="notes">
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={property?.notes ?? ""}
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
