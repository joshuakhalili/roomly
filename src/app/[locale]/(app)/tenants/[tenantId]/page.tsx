import { notFound } from "next/navigation";
import { getTranslations, getFormatter, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TenantDialog } from "@/components/tenants/tenant-dialog";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import {
  getDocumentRequirements,
  tenantScopedTypes,
} from "@/lib/queries/document-requirements";
import { DeleteTenantButton } from "@/components/tenants/delete-tenant-button";
import { ArrowLeft, Pencil, Mail, Phone, MessageCircle, Globe } from "lucide-react";
import { LANGUAGE_LABELS } from "@/lib/types";
import type { DocumentRecord, Tenant } from "@/lib/types";

interface HistoryRow {
  is_lead_tenant: boolean;
  tenancies: {
    id: string;
    status: string;
    start_date: string;
    end_date: string | null;
    rooms: { name: string; property_id: string; id: string } | null;
  } | null;
}

const STATUS_KEY = {
  upcoming: "tenancy.statusUpcoming",
  active: "tenancy.statusActive",
  ended: "tenancy.statusEnded",
  archived: "tenancy.statusArchived",
} as const;

export default async function TenantPage({
  params,
}: {
  params: Promise<{ locale: string; tenantId: string }>;
}) {
  const { locale, tenantId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const format = await getFormatter();

  const supabase = await createClient();
  const [{ data: tenant }, { data: history }, { data: documents }, requirements] =
    await Promise.all([
      supabase.from("tenants").select("*").eq("id", tenantId).single(),
      supabase
        .from("tenancy_tenants")
        .select(
          "is_lead_tenant, tenancies(id, status, start_date, end_date, rooms(id, name, property_id))",
        )
        .eq("tenant_id", tenantId),
      supabase.from("documents").select("*").eq("tenant_id", tenantId),
      getDocumentRequirements(supabase),
    ]);

  if (!tenant) notFound();

  const person = tenant as Tenant;
  const rows = (history ?? []) as unknown as HistoryRow[];

  const detail = (Icon: typeof Mail, value: string | null) =>
    value ? (
      <p className="flex items-center gap-2 text-sm">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {value}
      </p>
    ) : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <Link
          href="/tenants"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("tenants.title")}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">
            {person.first_name} {person.surname}
          </h1>
          <div className="flex flex-wrap gap-2">
            <TenantDialog
              tenant={person}
              trigger={
                <Button variant="outline" size="sm">
                  <Pencil className="size-4" aria-hidden />
                  {t("common.edit")}
                </Button>
              }
            />
            <DeleteTenantButton id={person.id} />
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 p-4">
          {detail(Mail, person.email)}
          {detail(Phone, person.phone)}
          {detail(MessageCircle, person.wechat_id)}
          {detail(Globe, person.country_of_origin)}
          <p className="flex items-center gap-2 text-sm">
            <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {LANGUAGE_LABELS[person.preferred_language]}
          </p>
          {person.notes && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {person.notes}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Identity documents follow the person between lettings. */}
      <DocumentsPanel
        tenantId={person.id}
        tenants={[{ ...person, is_lead_tenant: false }]}
        documents={(documents ?? []) as DocumentRecord[]}
        /* A profile outlives any one letting, so what it must hold is
           everything that follows the person under any letting type, not
           whatever their current tenancy happens to be. */
        requiredTypes={[...tenantScopedTypes(requirements)]}
        scope="tenant"
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("tenants.history")}</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("tenants.noHistory")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows
              .filter((r) => r.tenancies)
              .sort((a, b) =>
                a.tenancies!.start_date < b.tenancies!.start_date ? 1 : -1,
              )
              .map((r) => {
                const ten = r.tenancies!;
                return (
                  <li key={ten.id}>
                    <Link href={`/tenancies/${ten.id}`}>
                      <Card className="transition-colors hover:bg-accent/40">
                        <CardContent className="flex items-center gap-3 p-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">
                                {ten.rooms?.name ?? "—"}
                              </span>
                              <Badge
                                variant={
                                  ten.status === "active" ? "default" : "secondary"
                                }
                                className="text-xs"
                              >
                                {t(
                                  STATUS_KEY[
                                    ten.status as keyof typeof STATUS_KEY
                                  ],
                                )}
                              </Badge>
                              {r.is_lead_tenant && (
                                <Badge variant="outline" className="text-xs">
                                  {t("tenancy.leadTenant")}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format.dateTime(new Date(ten.start_date), {
                                dateStyle: "medium",
                              })}
                              {ten.end_date &&
                                ` — ${format.dateTime(new Date(ten.end_date), {
                                  dateStyle: "medium",
                                })}`}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                );
              })}
          </ul>
        )}
      </section>
    </div>
  );
}
