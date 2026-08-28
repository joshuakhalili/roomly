"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import {
  refreshRetentionPreview,
  setRetentionEnabled,
} from "@/lib/actions/retention";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";

/**
 * The arming switch.
 *
 * Turning it on is guarded by a confirmation naming the number of records
 * the next run would delete, because that is the number that makes the
 * decision — "enable automatic erasure" in the abstract is easy to agree to
 * and impossible to judge.
 */
export function RetentionControls({
  enabled,
  dueRecords,
}: {
  enabled: boolean;
  dueRecords: number;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function toggle(next: boolean) {
    startTransition(async () => {
      const result = await setRetentionEnabled(next);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success(t("common.saved"));
      router.refresh();
    });
  }

  function refresh() {
    startTransition(async () => {
      const result = await refreshRetentionPreview();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("retention.previewRefreshed"));
      router.refresh();
    });
  }

  return (
    <Card className={enabled ? "border-primary/50" : "border-amber-500/50"}>
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        {enabled ? (
          <ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden />
        ) : (
          <ShieldAlert className="size-5 shrink-0 text-amber-600" aria-hidden />
        )}

        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {enabled ? t("retention.modeLive") : t("retention.modePreview")}
          </p>
          <p className="text-sm text-muted-foreground">
            {enabled
              ? t("retention.modeLiveHelp")
              : t("retention.modePreviewHelp")}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" onClick={refresh} disabled={isPending}>
            <RefreshCw className="size-4" aria-hidden />
            {t("retention.refreshPreview")}
          </Button>

          {enabled ? (
            <Button
              variant="outline"
              onClick={() => toggle(false)}
              disabled={isPending}
            >
              {t("retention.disable")}
            </Button>
          ) : (
            <AlertDialog open={open} onOpenChange={setOpen}>
              <AlertDialogTrigger asChild>
                <Button disabled={isPending}>{t("retention.enable")}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("retention.enableConfirmTitle")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("retention.enableConfirmBody", { count: dueRecords })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isPending}>
                    {t("common.cancel")}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      toggle(true);
                    }}
                    disabled={isPending}
                  >
                    {t("retention.enable")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
