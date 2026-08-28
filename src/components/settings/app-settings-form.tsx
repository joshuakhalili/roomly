"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { updateAppSettings } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Field, FormError } from "@/components/ui/field";

/**
 * The settings that change what the nightly jobs do.
 *
 * These affect every admin, not just whoever is looking — so they read as
 * one shared form with an explicit save, rather than toggles that apply the
 * instant they are touched.
 */
export function AppSettingsForm({
  photoPurgeDays,
  purgeOnTenancyEnd,
  moveAlertDays,
}: {
  photoPurgeDays: number;
  purgeOnTenancyEnd: boolean;
  moveAlertDays: number;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateAppSettings(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(t("common.saved"));
      router.refresh();
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      <Field label={t("settings.moveAlertDays")} hint={t("settings.moveAlertHelp")}>
        <Input
          type="number"
          name="move_alert_days"
          defaultValue={moveAlertDays}
          min={1}
          max={30}
          className="max-w-28"
          disabled={isPending}
        />
      </Field>

      <Field label={t("settings.photoPurgeDays")} hint={t("settings.photoPurgeHelp")}>
        <Input
          type="number"
          name="photo_purge_days"
          defaultValue={photoPurgeDays}
          min={1}
          max={3650}
          className="max-w-28"
          disabled={isPending}
        />
      </Field>

      {/* An unchecked switch sends nothing at all, so this marks that the
          control was on the form — otherwise "off" and "not submitted" are
          the same thing and the setting could never be turned off. */}
      <input type="hidden" name="purge_photos_on_tenancy_end_present" value="1" />
      <div className="flex items-start gap-3 rounded-md border p-3">
        <Switch
          id="purge_photos_on_tenancy_end"
          name="purge_photos_on_tenancy_end"
          defaultChecked={purgeOnTenancyEnd}
          disabled={isPending}
        />
        <div className="min-w-0 flex-1">
          <Label htmlFor="purge_photos_on_tenancy_end">
            {t("settings.purgeOnEnd")}
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("settings.purgeOnEndHelp")}
          </p>
        </div>
      </div>

      <FormError message={error} />

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}
