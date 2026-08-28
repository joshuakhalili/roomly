"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { createTenant, updateTenant } from "@/lib/actions/tenants";
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
import { Plus } from "lucide-react";
import type { Tenant } from "@/lib/types";

export function TenantDialog({
  tenant,
  trigger,
  onCreated,
}: {
  tenant?: Tenant;
  trigger?: React.ReactNode;
  onCreated?: (id: string) => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      if (tenant) {
        const result = await updateTenant(tenant.id, formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
      } else {
        const result = await createTenant(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onCreated?.(result.data.id);
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
            {t("tenants.add")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {tenant ? t("tenants.edit") : t("tenants.add")}
          </DialogTitle>
        </DialogHeader>

        <form action={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("tenancy.firstName")} required>
              <Input
                name="first_name"
                defaultValue={tenant?.first_name}
                required
                autoFocus
                disabled={isPending}
              />
            </Field>
            <Field label={t("tenancy.surname")} required>
              <Input
                name="surname"
                defaultValue={tenant?.surname}
                required
                disabled={isPending}
              />
            </Field>
            <Field label={t("tenancy.email")}>
              <Input
                type="email"
                name="email"
                defaultValue={tenant?.email ?? ""}
                disabled={isPending}
              />
            </Field>
            <Field label={t("tenancy.phone")} hint={t("tenancy.phoneHint")}>
              <Input
                type="tel"
                name="phone"
                defaultValue={tenant?.phone ?? ""}
                placeholder="+44 7700 900000"
                disabled={isPending}
              />
            </Field>
            <Field label={t("tenancy.wechatId")}>
              <Input
                name="wechat_id"
                defaultValue={tenant?.wechat_id ?? ""}
                disabled={isPending}
              />
            </Field>
            <Field label={t("tenancy.countryOfOrigin")}>
              <Input
                name="country_of_origin"
                defaultValue={tenant?.country_of_origin ?? ""}
                disabled={isPending}
              />
            </Field>
            <Field label={t("tenancy.language")}>
              <OptionSelect
                name="preferred_language"
                defaultValue={tenant?.preferred_language ?? "en"}
                disabled={isPending}
                options={[
                  { value: "en", label: "English" },
                  { value: "zh", label: "简体中文" },
                ]}
              />
            </Field>
          </div>

          <Field label={t("tenancy.notes")}>
            <Textarea
              name="notes"
              rows={2}
              defaultValue={tenant?.notes ?? ""}
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
