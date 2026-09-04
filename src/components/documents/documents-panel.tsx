"use client";

import { useState, useTransition, useRef } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import {
  uploadDocument,
  getDocumentUrl,
  deleteDocument,
} from "@/lib/actions/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, FormError } from "@/components/ui/field";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { OptionSelect } from "@/components/ui/option-select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileText, Upload, Trash2, ExternalLink, TriangleAlert } from "lucide-react";
import {
  REQUIRED_DOCUMENT_TYPES,
  TENANT_DOCUMENT_TYPES,
  TENANCY_DOCUMENT_TYPES,
  type DocumentRecord,
  type TenantOnTenancy,
} from "@/lib/types";
import { DOC_TYPE_KEYS } from "./doc-type-labels";

export function DocumentsPanel({
  tenancyId,
  tenantId,
  tenants,
  documents,
  scope = "tenancy",
}: {
  tenancyId?: string;
  tenantId?: string;
  tenants: TenantOnTenancy[];
  documents: DocumentRecord[];
  /**
   * A tenant profile shows only identity documents; a tenancy shows the
   * agreement and deposit certificate. Same component, different slice.
   */
  scope?: "tenancy" | "tenant";
}) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [opening, setOpening] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const offered =
    scope === "tenant" ? TENANT_DOCUMENT_TYPES : TENANCY_DOCUMENT_TYPES;

  const present = new Set(documents.map((d) => d.doc_type));
  // Only chase the documents this panel is actually responsible for.
  const missing = REQUIRED_DOCUMENT_TYPES.filter(
    (d) => offered.includes(d) && !present.has(d),
  );

  function onUpload(formData: FormData) {
    setError(null);
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

  /**
   * Documents live in private buckets, so there is no URL to link to
   * directly — one is minted on demand and expires in minutes.
   */
  function openDocument(id: string) {
    setOpening(id);
    startTransition(async () => {
      const result = await getDocumentUrl(id);
      setOpening(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">{t("documents.title")}</h2>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Upload className="size-4" aria-hidden />
              {t("documents.upload")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("documents.upload")}</DialogTitle>
            </DialogHeader>

            <form ref={formRef} action={onUpload} className="flex flex-col gap-4">
              {tenancyId && (
                <input type="hidden" name="tenancy_id" value={tenancyId} />
              )}
              {tenantId && (
                <input type="hidden" name="tenant_id" value={tenantId} />
              )}

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

              {scope === "tenancy" && tenants.length > 1 && (
                <Field label={t("tenants.title")}>
                  <OptionSelect
                    name="tenant_id"
                    defaultValue={tenants[0].id}
                    options={tenants.map((p) => ({
                      value: p.id,
                      label: `${p.first_name} ${p.surname}`,
                    }))}
                  />
                </Field>
              )}

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
      </div>

      {/* Compliance gap — the same rule the dashboard counts. */}
      {missing.length > 0 && (
        <p className="flex items-start gap-2 rounded-md bg-warning-muted p-3 text-sm text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("documents.missing", {
            types: missing.map((m) => t(DOC_TYPE_KEYS[m])).join(", "),
          })}
        </p>
      )}

      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <FileText className="size-7 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">{t("documents.none")}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((doc) => {
            const owner = tenants.find((p) => p.id === doc.tenant_id);
            return (
              <li key={doc.id}>
                <Card>
                  <CardContent className="flex items-center gap-3 p-3">
                    <FileText
                      className="size-5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {doc.file_name}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {t(DOC_TYPE_KEYS[doc.doc_type])}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {owner && `${owner.first_name} ${owner.surname} · `}
                        {t("documents.uploadedOn", {
                          date: format.dateTime(new Date(doc.uploaded_at), {
                            dateStyle: "medium",
                          }),
                        })}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDocument(doc.id)}
                      disabled={isPending}
                      aria-label={t("documents.view")}
                    >
                      <ExternalLink className="size-4" aria-hidden />
                      <span className="sr-only sm:not-sr-only">
                        {opening === doc.id ? t("common.loading") : t("documents.view")}
                      </span>
                    </Button>

                    <ConfirmDelete
                      title={t("documents.deleteConfirm")}
                      description={t("documents.deleteWarning")}
                      onConfirm={() => deleteDocument(doc.id)}
                      trigger={
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t("documents.delete")}
                        >
                          <Trash2 className="size-4 text-destructive" aria-hidden />
                        </Button>
                      }
                    />
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
