"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { updateOwnProfile, changeOwnPassword } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Field, FormError } from "@/components/ui/field";
import { OptionSelect } from "@/components/ui/option-select";
import { APP_LANGUAGES, LANGUAGE_LABELS } from "@/lib/types";
import type { Profile } from "@/lib/types";

export function ProfileForm({
  profile,
  digestConfigured,
}: {
  profile: Profile;
  /** Whether the email service actually has credentials in this deployment. */
  digestConfigured: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateOwnProfile(formData);
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
      <Field label={t("settings.displayName")}>
        <Input
          name="display_name"
          defaultValue={profile.display_name ?? ""}
          placeholder={profile.email}
          disabled={isPending}
        />
      </Field>

      <Field label={t("settings.language")}>
        <OptionSelect
          name="preferred_language"
          defaultValue={profile.preferred_language}
          options={APP_LANGUAGES.map((code) => ({
            value: code,
            label: LANGUAGE_LABELS[code],
          }))}
        />
      </Field>

      <div className="flex items-start gap-3 rounded-md border p-3">
        <Switch
          id="email_digest_opt_in"
          name="email_digest_opt_in"
          defaultChecked={profile.email_digest_opt_in}
          disabled={isPending || !digestConfigured}
        />
        <div className="min-w-0 flex-1">
          <Label htmlFor="email_digest_opt_in">{t("settings.digest")}</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            {/* Said plainly rather than letting someone switch on a digest
                that silently never arrives. */}
            {digestConfigured
              ? t("settings.digestHelp")
              : t("settings.digestUnavailable")}
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

export function PasswordForm() {
  const t = useTranslations();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await changeOwnPassword(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(t("settings.passwordChanged"));
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      <Field label={t("settings.newPassword")}>
        <Input
          type="password"
          name="password"
          aria-label={t("settings.newPassword")}
          autoComplete="new-password"
          minLength={8}
          required
          disabled={isPending}
        />
      </Field>
      <Field label={t("settings.confirmPassword")}>
        <Input
          type="password"
          name="confirm_password"
          aria-label={t("settings.confirmPassword")}
          autoComplete="new-password"
          minLength={8}
          required
          disabled={isPending}
        />
      </Field>

      <FormError message={error} />

      <div>
        <Button type="submit" variant="outline" disabled={isPending}>
          {isPending ? t("common.saving") : t("settings.changePassword")}
        </Button>
      </div>
    </form>
  );
}
