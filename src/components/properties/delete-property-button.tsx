"use client";

import { useTranslations } from "next-intl";
import { deleteProperty } from "@/lib/actions/properties";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function DeletePropertyButton({ id }: { id: string }) {
  const t = useTranslations();

  return (
    <ConfirmDelete
      title={t("properties.deleteConfirm")}
      description={t("properties.deleteWarning")}
      onConfirm={() => deleteProperty(id)}
      redirectTo="/properties"
      trigger={
        <Button variant="outline" size="sm">
          <Trash2 className="size-4" aria-hidden />
          {t("common.delete")}
        </Button>
      }
    />
  );
}
