import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { TenancyForm } from "@/components/tenancies/tenancy-form";
import { ArrowLeft } from "lucide-react";
import type { Tenant } from "@/lib/types";

export default async function NewTenancyPage({
  params,
}: {
  params: Promise<{ locale: string; propertyId: string; roomId: string }>;
}) {
  const { locale, propertyId, roomId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const [{ data: room }, { data: bankAccounts }, { data: tenants }] =
    await Promise.all([
      supabase.from("rooms").select("id,name").eq("id", roomId).single(),
      supabase.from("bank_accounts").select("id,bank_name,account_label"),
      supabase.from("tenants").select("*").order("surname"),
    ]);

  if (!room) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <Link
          href={`/properties/${propertyId}/rooms/${roomId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {room.name}
        </Link>
        <h1 className="text-2xl font-semibold">{t("tenancy.add")}</h1>
      </div>

      <TenancyForm
        roomId={roomId}
        allTenants={(tenants ?? []) as Tenant[]}
        bankAccounts={bankAccounts ?? []}
      />
    </div>
  );
}
