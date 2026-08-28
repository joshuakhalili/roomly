"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { setLegalHold } from "@/lib/actions/retention";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Gavel } from "lucide-react";

/**
 * Freezes a tenancy's retention clock.
 *
 * The case for it: a deposit arbitration or a rent claim can begin years
 * after someone moves out, and the records that prove your side are exactly
 * the ones the six-year rule is about to delete. Losing them to a scheduled
 * job during a live dispute is not a defence.
 *
 * The case against leaving it on: a hold is an exception to a legal
 * obligation, so it needs a stated reason and it needs to come off. The
 * Retention page counts held tenancies for that reason.
 */
export function LegalHoldButton({
  id,
  held,
  reason,
}: {
  id: string;
  held: boolean;
  reason: string | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    if (held) formData.delete("legal_hold");
    startTransition(async () => {
      const result = await setLegalHold(id, formData);
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
        <Button variant={held ? "default" : "outline"} size="sm">
          <Gavel className="size-4" aria-hidden />
          {held ? t("tenancy.holdOn") : t("tenancy.holdPlace")}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {held ? t("tenancy.holdLiftTitle") : t("tenancy.holdPlaceTitle")}
          </DialogTitle>
          <DialogDescription>
            {held ? t("tenancy.holdLiftHelp") : t("tenancy.holdPlaceHelp")}
          </DialogDescription>
        </DialogHeader>

        <form action={submit} className="flex flex-col gap-4">
          {held ? (
            reason && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <Badge variant="secondary" className="mb-2 text-xs">
                  {t("tenancy.holdReason")}
                </Badge>
                <p>{reason}</p>
              </div>
            )
          ) : (
            <>
              <input type="hidden" name="legal_hold" value="on" />
              <Field label={t("tenancy.holdReason")}>
                <Textarea
                  name="legal_hold_reason"
                  rows={3}
                  required
                  disabled={isPending}
                  placeholder={t("tenancy.holdReasonPlaceholder")}
                />
              </Field>
            </>
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
              {held ? t("tenancy.holdLift") : t("tenancy.holdPlace")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
