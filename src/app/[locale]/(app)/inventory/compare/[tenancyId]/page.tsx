import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { ComparisonTable } from "@/components/inventory/comparison-table";
import { ArrowLeft } from "lucide-react";
import type { ChecklistArea, ChecklistSection } from "@/lib/types";

/**
 * Check-in against check-out.
 *
 * Both checklists share a tenancy and are built from the same templates, so
 * matching them up is a join on (area name, section name) rather than
 * anything cleverer.
 */
export default async function ComparePage({
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
    .select("id, rooms(id, name, property_id)")
    .eq("id", tenancyId)
    .single();

  if (!tenancy) notFound();

  const { data: checklists } = await supabase
    .from("inventory_checklists")
    .select("id, type")
    .eq("tenancy_id", tenancyId);

  const checkIn = (checklists ?? []).find((c) => c.type === "check_in");
  const checkOut = (checklists ?? []).find((c) => c.type === "check_out");
  if (!checkIn || !checkOut) notFound();

  const { data: areas } = await supabase
    .from("checklist_areas")
    .select("*")
    .in("checklist_id", [checkIn.id, checkOut.id])
    .order("sort_order");

  const areaIds = (areas ?? []).map((a) => a.id);
  const { data: sections } = areaIds.length
    ? await supabase
        .from("checklist_sections")
        .select("*")
        .in("checklist_area_id", areaIds)
        .order("sort_order")
    : { data: [] as ChecklistSection[] };

  const room = tenancy.rooms as unknown as {
    id: string;
    name: string;
    property_id: string;
  } | null;

  return (
    <div className="flex flex-col gap-6">
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
        <h1 className="text-2xl font-semibold">{t("inventory.comparison")}</h1>
      </div>

      <ComparisonTable
        checkInId={checkIn.id}
        checkOutId={checkOut.id}
        areas={(areas ?? []) as ChecklistArea[]}
        sections={(sections ?? []) as ChecklistSection[]}
      />
    </div>
  );
}
