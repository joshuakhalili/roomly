"use client";

import { useState, useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { createAdmin } from "@/lib/actions/admins";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

export function AddAdminDialog() {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createAdmin(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      formRef.current?.reset();
      toast.success(t("admins.created"));
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden />
          {t("admins.add")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admins.add")}</DialogTitle>
          <DialogDescription>{t("admins.subtitle")}</DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={onSubmit} className="flex flex-col gap-4">
          <Field label={t("admins.displayName")}>
            <Input name="display_name" disabled={isPending} autoFocus />
          </Field>
          <Field label={t("admins.email")} required>
            <Input type="email" name="email" required disabled={isPending} />
          </Field>
          <Field
            label={t("admins.temporaryPassword")}
            required
            hint={t("admins.passwordHint")}
          >
            <Input
              type="text"
              name="password"
              minLength={8}
              required
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
