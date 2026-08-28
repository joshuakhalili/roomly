"use client";

import { useState, useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { uploadDocument } from "@/lib/actions/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError } from "@/components/ui/field";
import { OptionSelect } from "@/components/ui/option-select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import {
  LIBRARY_DOCUMENT_TYPES,
  PROPERTY_CERTIFICATES,
  INVOICE_TYPES,
  type DocumentType,
  type Property,
} from "@/lib/types";
import { DOC_TYPE_KEYS } from "./doc-type-labels";

const COMPANY_VALUE = "__company__";

/**
 * Files one document into the library.
 *
 * The form adapts to what's being filed: a certificate asks for issue and
 * expiry dates and prefills the expiry from its statutory validity period;
 * an invoice asks who did the work and what it cost. Asking for all of it
 * every time would make routine filing tedious.
 */
export function LibraryUploadDialog({
  properties,
  defaultPropertyId,
  trigger,
}: {
  properties: Property[];
  defaultPropertyId?: string;
  trigger?: React.ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [docType, setDocType] = useState<DocumentType>("gas_safety");
  const [owner, setOwner] = useState(
    defaultPropertyId ?? properties[0]?.id ?? COMPANY_VALUE,
  );
  const formRef = useRef<HTMLFormElement>(null);

  const isCertificate = PROPERTY_CERTIFICATES.some((c) => c.type === docType);
  const isInvoice = INVOICE_TYPES.includes(docType);

  const suggestedExpiry = (() => {
    const rule = PROPERTY_CERTIFICATES.find((c) => c.type === docType);
    if (!rule) return "";
    const d = new Date();
    d.setMonth(d.getMonth() + rule.validMonths);
    return d.toISOString().slice(0, 10);
  })();

  function onUpload(formData: FormData) {
    setError(null);
    // The picker carries one value; translate it into the right owner field.
    if (owner === COMPANY_VALUE) {
      formData.set("is_company_wide", "on");
      formData.delete("property_id");
    } else {
      formData.set("property_id", owner);
    }

    startTransition(async () => {
      const result = await uploadDocument(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      formRef.current?.reset();
      toast.success(t("common.saved"));
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" aria-hidden />
            {t("documents.addDocument")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("documents.addDocument")}</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={onUpload} className="flex flex-col gap-4">
          <Field label={t("documents.type")} required>
            <OptionSelect
              name="doc_type"
              value={docType}
              onValueChange={(v) => setDocType(v as DocumentType)}
              options={LIBRARY_DOCUMENT_TYPES.map((dt) => ({
                value: dt,
                label: t(DOC_TYPE_KEYS[dt]),
              }))}
            />
          </Field>

          <Field label={t("documents.belongsTo")} required>
            <OptionSelect
              value={owner}
              onValueChange={setOwner}
              options={[
                ...properties.map((p) => ({ value: p.id, label: p.name })),
                { value: COMPANY_VALUE, label: t("documents.companyWide") },
              ]}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("documents.issueDate")}>
              <Input type="date" name="issued_at" disabled={isPending} />
            </Field>
            {/* Only certificates lapse — an invoice has no expiry. */}
            {isCertificate && (
              <Field label={t("documents.expiryDate")}>
                <Input
                  type="date"
                  name="expires_at"
                  defaultValue={suggestedExpiry}
                  key={docType}
                  disabled={isPending}
                />
              </Field>
            )}
          </div>

          {isInvoice && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("documents.supplier")}>
                <Input
                  name="supplier_name"
                  placeholder="e.g. Cambridge Gas Ltd"
                  disabled={isPending}
                />
              </Field>
              <Field label={t("documents.amount")}>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  name="amount"
                  disabled={isPending}
                />
              </Field>
            </div>
          )}

          <Field label={t("tenancy.notes")}>
            <Textarea name="notes" rows={2} disabled={isPending} />
          </Field>

          <Field label="File" required hint="Images or PDF, up to 15MB">
            <Input
              type="file"
              name="file"
              accept="image/*,application/pdf"
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
              {isPending ? t("documents.uploading") : t("documents.upload")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
