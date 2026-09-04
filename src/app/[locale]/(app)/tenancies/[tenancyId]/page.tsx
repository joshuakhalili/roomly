import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { TenancyForm } from "@/components/tenancies/tenancy-form";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import {
  getDocumentRequirements,
  requiredTypesFor,
} from "@/lib/queries/document-requirements";
import { ArchiveTenancyButton } from "@/components/tenancies/archive-tenancy-button";
import { LegalHoldButton } from "@/components/tenancies/legal-hold-button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import type { DocumentRecord, Tenancy, Tenant, TenantOnTenancy } from "@/lib/types";

const STATUS_KEY = {
  upcoming: "tenancy.statusUpcoming",
  active: "tenancy.statusActive",
  ended: "tenancy.statusEnded",
  archived: "tenancy.statusArchived",
} as const;

export default async function TenancyPage({
  params,
}: {
  params: Promise<{ locale: string; tenancyId: string }>;
}) {
  const { locale, tenancyId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const { data: tenancy } = await supabase
    .from("tenancies")
    .select("*")
    .eq("id", tenancyId)
    .single();

  if (!tenancy) notFound();

  const [
    { data: links },
    { data: documents },
    { data: room },
    { data: banks },
    { data: allTenants },
    requirements,
  ] = await Promise.all([
      supabase
        .from("tenancy_tenants")
        .select("is_lead_tenant, tenants(*)")
        .eq("tenancy_id", tenancyId),
      supabase.from("documents").select("*").eq("tenancy_id", tenancyId),
      supabase
        .from("rooms")
        .select("id,name,property_id")
        .eq("id", tenancy.room_id)
        .single(),
      supabase.from("bank_accounts").select("id,bank_name,account_label"),
      supabase.from("tenants").select("*").order("surname"),
      getDocumentRequirements(supabase),
    ]);

  const assigned: TenantOnTenancy[] = ((links ?? []) as unknown as {
    is_lead_tenant: boolean;
    tenants: TenantOnTenancy | null;
  }[])
    .filter((r) => r.tenants)
    .map((r) => ({ ...r.tenants!, is_lead_tenant: r.is_lead_tenant }));

  const ten = tenancy as Tenancy;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        {room && (
          <Link
            href={`/properties/${room.property_id}/rooms/${room.id}`}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {room.name}
          </Link>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{t("tenancy.title")}</h1>
            <Badge variant={ten.status === "active" ? "default" : "secondary"}>
              {t(STATUS_KEY[ten.status])}
            </Badge>
            {ten.legal_hold && (
              <Badge variant="destructive">{t("tenancy.holdOn")}</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Offered once the tenancy is over — that is when the retention
                clock starts, and so when freezing it means anything. */}
            {(ten.status === "ended" || ten.status === "archived") && (
              <LegalHoldButton
                id={ten.id}
                held={ten.legal_hold}
                reason={ten.legal_hold_reason}
              />
            )}
            {ten.status !== "archived" && (
              <ArchiveTenancyButton id={ten.id} endDate={ten.end_date} />
            )}
          </div>
        </div>
      </div>

      <TenancyForm
        roomId={ten.room_id}
        tenancy={ten}
        allTenants={(allTenants ?? []) as Tenant[]}
        assigned={assigned}
        bankAccounts={banks ?? []}
      />

      <Separator />

      <DocumentsPanel
        tenancyId={ten.id}
        tenants={assigned}
        documents={(documents ?? []) as DocumentRecord[]}
        requiredTypes={requiredTypesFor(requirements, ten.letting_type, "tenancy")}
      />
    </div>
  );
}
