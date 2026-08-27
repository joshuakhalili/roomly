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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  Upload,
  Trash2,
  ExternalLink,
  TriangleAlert,
} from "lucide-react";
import {
  PROPERTY_DOCUMENT_TYPES,
  PROPERTY_CERTIFICATES,
  type DocumentRecord,
  type DocumentType,
} from "@/lib/types";
import { DOC_TYPE_KEYS } from "./doc-type-labels";

/** Flag a certificate this far ahead so there's time to book the engineer. */
const EXPIRY_WARNING_DAYS = 60;

/**
 * Safety certificates for a property.
 *
 * Kept apart from tenant and tenancy paperwork because these describe the
 * building: they outlast any tenant, apply to every room, and — unlike a
 * passport — they expire. Letting on a lapsed gas safety record is a
 * criminal offence, so expiry is shown rather than left to be remembered.
 */
export function CertificatesPanel({
  propertyId,
  documents,
}: {
  propertyId: string;
  documents: DocumentRecord[];
}) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [docType, setDocType] = useState<DocumentType>("gas_safety");
  const formRef = useRef<HTMLFormElement>(null);

  const today = new Date();
  const status = (doc: DocumentRecord) => {
    if (!doc.expires_at) return null;
    const expiry = new Date(doc.expires_at);
    const days = Math.floor(
      (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days < 0) return "expired" as const;
    if (days <= EXPIRY_WARNING_DAYS) return "soon" as const;
    return "valid" as const;
  };

  const problems = documents.filter((d) => {
    const s = status(d);
    return s === "expired" || s === "soon";
  });

  // Certificates the property is expected to hold but has none of at all.
  const held = new Set(documents.map((d) => d.doc_type));
  const absent = PROPERTY_CERTIFICATES.filter((c) => !held.has(c.type));

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

  function openDocument(id: string) {
    startTransition(async () => {
      const result = await getDocumentUrl(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    });
  }

  /** Pre-fills expiry from the certificate's own validity period. */
  const suggestedExpiry = (() => {
    const rule = PROPERTY_CERTIFICATES.find((c) => c.type === docType);
    if (!rule) return "";
    const d = new Date();
    d.setMonth(d.getMonth() + rule.validMonths);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t("documents.propertyDocuments")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("documents.propertyDocumentsHint")}
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Upload className="size-4" aria-hidden />
              {t("documents.upload")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("documents.propertyDocuments")}</DialogTitle>
            </DialogHeader>

            <form ref={formRef} action={onUpload} className="flex flex-col gap-4">
              <input type="hidden" name="property_id" value={propertyId} />

              <Field label={t("documents.type")} required>
                <Select
                  name="doc_type"
                  value={docType}
                  onValueChange={(v) => setDocType(v as DocumentType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_DOCUMENT_TYPES.map((dt) => (
                      <SelectItem key={dt} value={dt}>
                        {t(DOC_TYPE_KEYS[dt])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("documents.issueDate")}>
                  <Input type="date" name="issued_at" disabled={isPending} />
                </Field>
                <Field
                  label={t("documents.expiryDate")}
                  hint={t("documents.noExpiry")}
                >
                  <Input
                    type="date"
                    name="expires_at"
                    defaultValue={suggestedExpiry}
                    key={docType}
                    disabled={isPending}
                  />
                </Field>
              </div>

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

      {(problems.length > 0 || absent.length > 0) && (
        <div className="flex flex-col gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {problems.map((d) => (
            <p key={d.id} className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t(DOC_TYPE_KEYS[d.doc_type])} —{" "}
              {status(d) === "expired"
                ? t("documents.expired")
                : t("documents.expiringSoon")}
              {d.expires_at &&
                ` (${format.dateTime(new Date(d.expires_at), { dateStyle: "medium" })})`}
            </p>
          ))}
          {absent.length > 0 && (
            <p className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t("documents.missing", {
                types: absent.map((c) => t(DOC_TYPE_KEYS[c.type])).join(", "),
              })}
            </p>
          )}
        </div>
      )}

      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <ShieldCheck className="size-7 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">{t("documents.none")}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((doc) => {
            const s = status(doc);
            return (
              <li key={doc.id}>
                <Card>
                  <CardContent className="flex items-center gap-3 p-3">
                    <ShieldCheck
                      className="size-5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {t(DOC_TYPE_KEYS[doc.doc_type])}
                        </span>
                        {s && (
                          <Badge
                            variant={s === "valid" ? "secondary" : "destructive"}
                            className="text-xs"
                          >
                            {s === "expired"
                              ? t("documents.expired")
                              : s === "soon"
                                ? t("documents.expiringSoon")
                                : t("documents.expiresOn", {
                                    date: format.dateTime(
                                      new Date(doc.expires_at!),
                                      { dateStyle: "medium" },
                                    ),
                                  })}
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {doc.file_name}
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
