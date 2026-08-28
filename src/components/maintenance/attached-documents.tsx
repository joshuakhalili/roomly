"use client";

import { useState, useTransition } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import {
  uploadDocument,
  getDocumentUrl,
  deleteDocument,
} from "@/lib/actions/documents";
import { DOC_TYPE_KEYS } from "@/components/documents/doc-type-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field, FormError } from "@/components/ui/field";
import { OptionSelect } from "@/components/ui/option-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Paperclip, FileText, Trash2 } from "lucide-react";
import type { DocumentRecord, DocumentType } from "@/lib/types";

/**
 * Paperwork attached from inside Maintenance.
 *
 * The file still lands in the Document library — it is filed against the
 * property so it sits with the insurance and the certificates, and only
 * carries a back-reference to the job or purchase it came from. Uploading
 * here rather than in Documents means recording it once, at the moment you
 * have the invoice in your hand, instead of remembering later which folder
 * it belonged in.
 */
export function AttachedDocuments({
  propertyId,
  jobId,
  assetId,
  documents,
  offered,
  defaultAmount,
  defaultSupplier,
}: {
  propertyId: string;
  jobId?: string;
  assetId?: string;
  documents: DocumentRecord[];
  offered: DocumentType[];
  defaultAmount?: number | null;
  defaultSupplier?: string | null;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function upload(formData: FormData) {
    setError(null);
    // Filed against the property so it appears in the library; the job or
    // asset id is only the link back.
    formData.set("property_id", propertyId);
    if (jobId) formData.set("maintenance_job_id", jobId);
    if (assetId) formData.set("asset_id", assetId);

    startTransition(async () => {
      const result = await uploadDocument(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      toast.success(t("documents.uploaded"));
      router.refresh();
    });
  }

  function view(id: string) {
    startTransition(async () => {
      const result = await getDocumentUrl(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteDocument(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("common.saved"));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {documents.length > 0 && (
        <ul className="flex flex-col gap-1">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <FileText
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <button
                type="button"
                onClick={() => view(doc.id)}
                className="min-w-0 flex-1 truncate text-left hover:underline"
                disabled={isPending}
              >
                {doc.file_name}
              </button>
              <Badge variant="outline" className="shrink-0 text-xs">
                {t(DOC_TYPE_KEYS[doc.doc_type])}
              </Badge>
              {doc.amount != null && (
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {format.number(Number(doc.amount), {
                    style: "currency",
                    currency: "GBP",
                  })}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(doc.id)}
                disabled={isPending}
                aria-label={t("common.delete")}
              >
                <Trash2 className="size-4 text-destructive" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="self-start">
            <Paperclip className="size-4" aria-hidden />
            {t("maintenance.attach")}
          </Button>
        </DialogTrigger>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("maintenance.attach")}</DialogTitle>
          </DialogHeader>

          <form action={upload} className="flex flex-col gap-4">
            <Field label={t("documents.type")} required>
              <OptionSelect
                name="doc_type"
                defaultValue={offered[0]}
                required
                options={offered.map((dt) => ({
                  value: dt,
                  label: t(DOC_TYPE_KEYS[dt]),
                }))}
              />
            </Field>

            <Field label={t("documents.file")} required>
              <Input
                type="file"
                name="file"
                accept="image/*,application/pdf"
                required
                disabled={isPending}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Prefilled from the job or purchase, since it is almost
                  always the same number and the same supplier. */}
              <Field label={t("maintenance.supplier")}>
                <Input
                  name="supplier_name"
                  defaultValue={defaultSupplier ?? ""}
                  disabled={isPending}
                />
              </Field>
              <Field label={t("maintenance.cost")}>
                <Input
                  type="number"
                  name="amount"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  defaultValue={defaultAmount ?? ""}
                  disabled={isPending}
                />
              </Field>
            </div>

            <Field label={t("maintenance.warrantyUntil")}>
              <Input type="date" name="expires_at" disabled={isPending} />
            </Field>

            <FormError message={error} />

            <div className="flex gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? t("common.saving") : t("documents.upload")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
