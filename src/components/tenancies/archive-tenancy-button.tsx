"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { archiveTenancy } from "@/lib/actions/tenancies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError } from "@/components/ui/field";
import { OptionSelect } from "@/components/ui/option-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Archive } from "lucide-react";

/**
 * Ends a tenancy and frees the room.
 *
 * Asks for a reason on the way out — it's one click, and "why do tenants
 * leave" is one of the few genuinely useful things a landlord can track that
 * can't be derived from the other data.
 */
export function ArchiveTenancyButton({
  id,
  endDate,
}: {
  id: string;
  endDate: string | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await archiveTenancy(id, formData);
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
        <Button variant="outline" size="sm">
          <Archive className="size-4" aria-hidden />
          {t("tenancy.archive")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("tenancy.archiveConfirm")}</DialogTitle>
          <DialogDescription>
            {t("tenancy.archiveWarning")}
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="flex flex-col gap-4">
          <Field label={t("tenancy.endDate")}>
            <Input
              type="date"
              name="end_date"
              defaultValue={endDate ?? new Date().toISOString().slice(0, 10)}
              disabled={isPending}
            />
          </Field>

          <Field label={t("tenancy.reasonForLeaving")}>
            <OptionSelect
              name="reason_for_leaving"
              defaultValue="end_of_term"
              options={[
                { value: "end_of_term", label: t("tenancy.reasonEndOfTerm") },
                {
                  value: "tenant_gave_notice",
                  label: t("tenancy.reasonTenantNotice"),
                },
                {
                  value: "given_notice_by_admin",
                  label: t("tenancy.reasonAdminNotice"),
                },
                { value: "other", label: t("tenancy.reasonOther") },
              ]}
            />
          </Field>

          <Field label={t("tenancy.notes")}>
            <Textarea name="reason_notes" rows={2} disabled={isPending} />
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
              {isPending ? t("common.saving") : t("tenancy.archive")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
