"use client";

import { useTranslations } from "next-intl";
import { deleteTenant } from "@/lib/actions/tenants";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function DeleteTenantButton({ id }: { id: string }) {
  const t = useTranslations();

  return (
    <ConfirmDelete
      title={t("tenants.deleteConfirm")}
      description={t("tenants.deleteWarning")}
      onConfirm={() => deleteTenant(id)}
      redirectTo="/tenants"
      trigger={
        <Button variant="outline" size="sm">
          <Trash2 className="size-4" aria-hidden />
          {t("common.delete")}
        </Button>
      }
    />
  );
}
