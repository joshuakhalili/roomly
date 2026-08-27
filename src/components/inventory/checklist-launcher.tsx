"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { toast } from "sonner";
import { createChecklist } from "@/lib/actions/inventory";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Plus } from "lucide-react";
import type { InventoryChecklist } from "@/lib/types";

/**
 * The inventory section of a room page: whichever checklists exist for the
 * current tenancy, and buttons to start the ones that don't.
 */
export function ChecklistLauncher({
  tenancyId,
  checklists,
}: {
  tenancyId: string;
  checklists: InventoryChecklist[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const checkIn = checklists.find((c) => c.type === "check_in");
  const checkOut = checklists.find((c) => c.type === "check_out");

  function start(type: "check_in" | "check_out") {
    startTransition(async () => {
      const result = await createChecklist(tenancyId, type);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/inventory/${result.data.id}` as "/");
    });
  }

  function row(
    checklist: InventoryChecklist | undefined,
    type: "check_in" | "check_out",
    label: string,
    startLabel: string,
  ) {
    if (checklist) {
      return (
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <ClipboardList
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{label}</p>
              <Badge
                variant={checklist.status === "completed" ? "default" : "secondary"}
                className="mt-1 text-xs"
              >
                {checklist.status === "completed"
                  ? t("inventory.statusCompleted")
                  : t("inventory.statusDraft")}
              </Badge>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/inventory/${checklist.id}`}>
                {checklist.status === "completed"
                  ? t("inventory.view")
                  : t("inventory.continue")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <Button
        variant="outline"
        onClick={() => start(type)}
        disabled={isPending}
        className="justify-start"
      >
        <Plus className="size-4" aria-hidden />
        {startLabel}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-semibold">{t("inventory.title")}</h2>
      {row(checkIn, "check_in", t("inventory.checkIn"), t("inventory.startCheckIn"))}
      {/* Check-out only makes sense once there's a check-in to compare against. */}
      {checkIn &&
        row(
          checkOut,
          "check_out",
          t("inventory.checkOut"),
          t("inventory.startCheckOut"),
        )}
    </div>
  );
}
