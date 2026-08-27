import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { ChecklistEditor } from "@/components/inventory/checklist-editor";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import type {
  AreaType,
  ChecklistArea,
  ChecklistPhoto,
  ChecklistSection,
  InventoryChecklist,
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
    .select("*, tenancies(id, room_id, rooms(id, name, property_id))")
    .eq("id", checklistId)
    .single();

  if (!checklist) notFound();

  const { data: areas } = await supabase
    .from("checklist_areas")
    .select("*")
    .eq("checklist_id", checklistId)
    .order("sort_order");

  const areaIds = (areas ?? []).map((a) => a.id);

  const [{ data: sections }, { data: areaTypes }] = await Promise.all([
    areaIds.length
      ? supabase
          .from("checklist_sections")
          .select("*")
          .in("checklist_area_id", areaIds)
          .order("sort_order")
      : Promise.resolve({ data: [] as ChecklistSection[] }),
    supabase.from("area_types").select("*").order("sort_order"),
  ]);

  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: photos } = sectionIds.length
    ? await supabase
        .from("checklist_photos")
        .select("*")
        .in("checklist_section_id", sectionIds)
        .order("sort_order")
    : { data: [] as ChecklistPhoto[] };

  const room = (
    checklist.tenancies as unknown as {
      rooms: { id: string; name: string; property_id: string };
    } | null
  )?.rooms;

  const cl = checklist as unknown as InventoryChecklist;

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
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">
            {cl.type === "check_in"
              ? t("inventory.checkIn")
              : t("inventory.checkOut")}
          </h1>
          <Badge variant={cl.status === "completed" ? "default" : "secondary"}>
            {cl.status === "completed"
              ? t("inventory.statusCompleted")
              : t("inventory.statusDraft")}
          </Badge>
        </div>
      </div>

      <ChecklistEditor
        checklist={cl}
        areas={(areas ?? []) as ChecklistArea[]}
        sections={(sections ?? []) as ChecklistSection[]}
        photos={(photos ?? []) as ChecklistPhoto[]}
        areaTypes={(areaTypes ?? []) as AreaType[]}
      />
    </div>
  );
}
