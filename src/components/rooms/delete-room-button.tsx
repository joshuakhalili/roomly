"use client";

import { useTranslations } from "next-intl";
import { deleteRoom } from "@/lib/actions/rooms";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function DeleteRoomButton({
  id,
  propertyId,
}: {
  id: string;
  propertyId: string;
}) {
  const t = useTranslations();

  return (
    <ConfirmDelete
      title={t("properties.deleteConfirm")}
      description={t("properties.deleteWarning")}
      onConfirm={() => deleteRoom(id)}
      redirectTo={`/properties/${propertyId}`}
      trigger={
        <Button variant="outline" size="sm">
          <Trash2 className="size-4" aria-hidden />
          {t("common.delete")}
        </Button>
      }
    />
  );
}
