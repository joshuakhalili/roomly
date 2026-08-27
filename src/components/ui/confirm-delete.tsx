"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Confirmation for anything destructive.
 *
 * Deliberately spells out the blast radius in `description` — deleting a
 * property takes its rooms and every tenancy record with it, and that should
 * be stated before the click, not discovered after.
 */
export function ConfirmDelete({
  title,
  description,
  onConfirm,
  trigger,
  confirmLabel,
  redirectTo,
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<{ ok: boolean; error?: string }>;
  trigger: React.ReactNode;
  confirmLabel?: string;
  redirectTo?: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await onConfirm();
      if (!result.ok) {
        toast.error(result.error ?? t("common.error"));
        return;
      }
      setOpen(false);
      toast.success(t("common.saved"));
      if (redirectTo) router.push(redirectTo as "/");
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Keep the dialog open while the delete runs so the pending
              // state is visible and a failure can be shown in place.
              e.preventDefault();
              confirm();
            }}
            disabled={isPending}
            className={cn(buttonVariants({ variant: "destructive" }))}
          >
            {confirmLabel ?? t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
