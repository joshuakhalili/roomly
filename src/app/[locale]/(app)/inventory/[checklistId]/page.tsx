import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { ChecklistEditor } from "@/components/inventory/checklist-editor";
import { ReportDetails } from "@/components/inventory/report-details";
import { ExportPdfButton } from "@/components/inventory/export-pdf-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, GitCompareArrows } from "lucide-react";
import type {
  AreaType,
  ChecklistArea,
  ChecklistDeclaration,
  ChecklistDetector,
  ChecklistKey,
  ChecklistMeter,
  ChecklistPhoto,
  ChecklistSection,
  InventoryChecklist,
  TenantOnTenancy,
} from "@/lib/types";

export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ locale: string; checklistId: string }>;
}) {
  const { locale, checklistId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const { data: checklist } = await supabase
    .from("inventory_checklists")
    .select(
      "*, tenancies(id, room_id, rooms(id, name, property_id, properties(name, address)))",
    )
    .eq("id", checklistId)
    .single();

  if (!checklist) notFound();

  const tenancy = checklist.tenancies as unknown as {
    id: string;
    rooms: {
      id: string;
      name: string;
      property_id: string;
      properties: { name: string; address: string | null } | null;
    } | null;
  } | null;

  // A baseline hangs off the room directly; check-in/out reach it via the
  // tenancy.
  let room = tenancy?.rooms ?? null;
  if (!room && checklist.room_id) {
    const { data: r } = await supabase
      .from("rooms")
      .select("id, name, property_id, properties(name, address)")
      .eq("id", checklist.room_id)
      .single();
    room = r as unknown as typeof room;
  }

  const { data: areas } = await supabase
    .from("checklist_areas")
    .select("*")
    .eq("checklist_id", checklistId)
    .order("sort_order");

  const areaIds = (areas ?? []).map((a) => a.id);

  const [
    { data: sections },
    { data: areaTypes },
    { data: meters },
    { data: keys },
    { data: detectors },
    { data: declarations },
    { data: links },
    { data: siblings },
  ] = await Promise.all([
    areaIds.length
      ? supabase
          .from("checklist_sections")
          .select("*")
          .in("checklist_area_id", areaIds)
          .order("sort_order")
      : Promise.resolve({ data: [] as ChecklistSection[] }),
    supabase.from("area_types").select("*").order("sort_order"),
    supabase.from("checklist_meters").select("*").eq("checklist_id", checklistId),
    supabase.from("checklist_keys").select("*").eq("checklist_id", checklistId),
    supabase
      .from("checklist_detectors")
      .select("*")
      .eq("checklist_id", checklistId),
    supabase
      .from("checklist_declarations")
      .select("*")
      .eq("checklist_id", checklistId),
    tenancy
      ? supabase
          .from("tenancy_tenants")
          .select("is_lead_tenant, tenants(*)")
          .eq("tenancy_id", tenancy.id)
      : Promise.resolve({ data: [] as { is_lead_tenant: boolean; tenants: TenantOnTenancy | null }[] }),
    tenancy
      ? supabase
          .from("inventory_checklists")
          .select("id, type")
          .eq("tenancy_id", tenancy.id)
      : Promise.resolve({ data: [] as { id: string; type: string }[] }),
  ]);

  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: photos } = sectionIds.length
    ? await supabase
        .from("checklist_photos")
        .select("*")
        .in("checklist_section_id", sectionIds)
        .order("sort_order")
    : { data: [] as ChecklistPhoto[] };

  const assigned: TenantOnTenancy[] = ((links ?? []) as unknown as {
    is_lead_tenant: boolean;
    tenants: TenantOnTenancy | null;
  }[])
    .filter((r) => r.tenants)
    .map((r) => ({ ...r.tenants!, is_lead_tenant: r.is_lead_tenant }));

  const cl = checklist as unknown as InventoryChecklist;
  const typeLabel =
    cl.type === "baseline"
      ? t("inventory.baseline")
      : cl.type === "check_in"
        ? t("inventory.checkIn")
        : t("inventory.checkOut");

  // A comparison only means anything once both halves exist.
  const hasBoth = (siblings ?? []).length === 2;

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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{typeLabel}</h1>
            <Badge variant={cl.status === "completed" ? "default" : "secondary"}>
              {cl.status === "completed"
                ? t("inventory.statusCompleted")
                : t("inventory.statusDraft")}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            {hasBoth && tenancy && (
              <Button asChild variant="outline">
                <Link href={`/inventory/compare/${tenancy.id}`}>
                  <GitCompareArrows className="size-4" aria-hidden />
                  {t("inventory.compare")}
                </Link>
              </Button>
            )}
            <ExportPdfButton
              checklistId={cl.id}
              meta={{
                propertyName: room?.properties?.name ?? "",
                roomName: room?.name ?? "",
                address: room?.properties?.address ?? null,
                type: typeLabel,
                occupants: assigned.map((x) => `${x.first_name} ${x.surname}`),
              }}
              areas={(areas ?? []) as ChecklistArea[]}
              sections={(sections ?? []) as ChecklistSection[]}
              photos={(photos ?? []) as ChecklistPhoto[]}
              meters={(meters ?? []) as ChecklistMeter[]}
              keys={(keys ?? []) as ChecklistKey[]}
              detectors={(detectors ?? []) as ChecklistDetector[]}
              declarations={(declarations ?? []) as ChecklistDeclaration[]}
            />
          </div>
        </div>
      </div>

      <ChecklistEditor
        checklist={cl}
        areas={(areas ?? []) as ChecklistArea[]}
        sections={(sections ?? []) as ChecklistSection[]}
        photos={(photos ?? []) as ChecklistPhoto[]}
        areaTypes={(areaTypes ?? []) as AreaType[]}
      />

      <ReportDetails
        checklistId={cl.id}
        meters={(meters ?? []) as ChecklistMeter[]}
        keys={(keys ?? []) as ChecklistKey[]}
        detectors={(detectors ?? []) as ChecklistDetector[]}
        declarations={(declarations ?? []) as ChecklistDeclaration[]}
        readOnly={cl.status === "completed"}
      />
    </div>
  );
}
