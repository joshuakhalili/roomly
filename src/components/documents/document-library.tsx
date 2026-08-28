"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { toast } from "sonner";
import { getDocumentUrl, deleteDocument } from "@/lib/actions/documents";
import { LibraryUploadDialog } from "./library-upload-dialog";
import { DOC_TYPE_KEYS } from "./doc-type-labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { cn } from "@/lib/utils";
import {
  FileText,
  ShieldCheck,
  Receipt,
  ExternalLink,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  CERTIFICATE_TYPES,
  INVOICE_TYPES,
  type DocumentRecord,
  type Property,
} from "@/lib/types";

const EXPIRY_WARNING_DAYS = 60;

/** How close a certificate is to lapsing, or null if it never expires. */
function expiryStatus(doc: DocumentRecord) {
  if (!doc.expires_at) return null;
  const days = Math.floor(
    (new Date(doc.expires_at).getTime() - Date.now()) / 86_400_000,
  );
  if (days < 0) return "expired" as const;
  if (days <= EXPIRY_WARNING_DAYS) return "soon" as const;
  return "valid" as const;
}

type Scope = "all" | "company" | string;

export function DocumentLibrary({
  documents,
  properties,
}: {
  documents: DocumentRecord[];
  properties: Property[];
}) {
  const t = useTranslations();
  const format = useFormatter();
  const [isPending, startTransition] = useTransition();
  const [scope, setScope] = useState<Scope>("all");
  const [kind, setKind] = useState<"all" | "certificates" | "invoices">("all");

  const visible = useMemo(
    () =>
      documents.filter((d) => {
        if (scope === "company" && !d.is_company_wide) return false;
        if (scope !== "all" && scope !== "company" && d.property_id !== scope)
          return false;
        if (kind === "certificates" && !CERTIFICATE_TYPES.includes(d.doc_type))
          return false;
        if (kind === "invoices" && !INVOICE_TYPES.includes(d.doc_type))
          return false;
        return true;
      }),
    [documents, scope, kind],
  );

  /**
   * Same certificate for the same place, newest first.
   *
   * A gas record is renewed every year and the old ones still matter — this
   * is a log, not a slot. Grouping keeps the current one prominent with its
   * history tucked behind it rather than a flat list of near-identical rows.
   */
  const groups = useMemo(() => {
    const map = new Map<string, DocumentRecord[]>();
    for (const d of visible) {
      const key = `${d.doc_type}|${d.property_id ?? "company"}`;
      const list = map.get(key) ?? [];
      list.push(d);
      map.set(key, list);
    }
    return [...map.values()]
      .map((list) =>
        [...list].sort((a, b) =>
          (b.issued_at ?? b.uploaded_at) > (a.issued_at ?? a.uploaded_at) ? 1 : -1,
        ),
      )
      .sort((a, b) => {
        // Anything expired or expiring floats to the top.
        const rank = (d: DocumentRecord) =>
          expiryStatus(d) === "expired" ? 0 : expiryStatus(d) === "soon" ? 1 : 2;
        return rank(a[0]) - rank(b[0]);
      });
  }, [visible]);

  const propertyName = (id: string | null) =>
    properties.find((p) => p.id === id)?.name;

  function open(id: string) {
    startTransition(async () => {
      const result = await getDocumentUrl(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    });
  }

  const scopeFilters: { key: Scope; label: string }[] = [
    { key: "all", label: t("documents.filterAll") },
    ...properties.map((p) => ({ key: p.id as Scope, label: p.name })),
    { key: "company", label: t("documents.companyWide") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {scopeFilters.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={scope === f.key ? "default" : "outline"}
            onClick={() => setScope(f.key)}
          >
            {f.label}
          </Button>
        ))}
        <span className="mx-1 w-px bg-border" aria-hidden />
        {(
          [
            ["all", t("documents.filterAll")],
            ["certificates", t("documents.certificates")],
            ["invoices", t("documents.invoices")],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={kind === key ? "secondary" : "ghost"}
            onClick={() => setKind(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FileText className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              {t("documents.noDocuments")}
            </p>
            <LibraryUploadDialog properties={properties} />
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((versions) => {
            const doc = versions[0];
            const older = versions.slice(1);
            const status = expiryStatus(doc);
            const isInvoice = INVOICE_TYPES.includes(doc.doc_type);
            const Icon = isInvoice ? Receipt : ShieldCheck;

            return (
              <li key={doc.id}>
                <Card
                  className={cn(
                    status === "expired" && "border-destructive/50",
                    status === "soon" && "border-amber-500/50",
                  )}
                >
                  <CardContent className="flex flex-col gap-2 p-4">
                    <div className="flex items-start gap-3">
                      <Icon
                        className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">
                            {t(DOC_TYPE_KEYS[doc.doc_type])}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {doc.is_company_wide
                              ? t("documents.companyWide")
                              : (propertyName(doc.property_id) ?? "—")}
                          </Badge>
                          {status && status !== "valid" && (
                            <Badge variant="destructive" className="text-xs">
                              <TriangleAlert className="size-3" aria-hidden />
                              {status === "expired"
                                ? t("documents.expired")
                                : t("documents.expiringSoon")}
                            </Badge>
                          )}
                        </div>

                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {doc.supplier_name && `${doc.supplier_name} · `}
                          {doc.amount != null &&
                            `${format.number(Number(doc.amount), {
                              style: "currency",
                              currency: "GBP",
                            })} · `}
                          {doc.issued_at
                            ? format.dateTime(new Date(doc.issued_at), {
                                dateStyle: "medium",
                              })
                            : format.dateTime(new Date(doc.uploaded_at), {
                                dateStyle: "medium",
                              })}
                          {doc.expires_at &&
                            ` → ${format.dateTime(new Date(doc.expires_at), {
                              dateStyle: "medium",
                            })}`}
                        </p>
                        {doc.notes && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {doc.notes}
                          </p>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => open(doc.id)}
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
                            <Trash2
                              className="size-4 text-destructive"
                              aria-hidden
                            />
                          </Button>
                        }
                      />
                    </div>

                    {/* The trail behind the current one. */}
                    {older.length > 0 && (
                      <details className="ml-8">
                        <summary className="cursor-pointer text-xs text-muted-foreground">
                          {t("documents.history", { count: older.length })}
                        </summary>
                        <ul className="mt-2 flex flex-col gap-1">
                          {older.map((old) => (
                            <li
                              key={old.id}
                              className="flex items-center gap-2 text-xs text-muted-foreground"
                            >
                              <span className="min-w-0 flex-1 truncate">
                                {old.file_name}
                                {old.issued_at &&
                                  ` · ${format.dateTime(new Date(old.issued_at), {
                                    dateStyle: "medium",
                                  })}`}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => open(old.id)}
                                disabled={isPending}
                                aria-label={t("documents.view")}
                              >
                                <ExternalLink className="size-3" aria-hidden />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
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
