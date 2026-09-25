import { getTranslations, setRequestLocale } from "next-intl/server";
import { byName } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import {
  PropertySections,
  type InventoryProperty,
} from "@/components/inventory/property-sections";
import { getSignedUrls } from "@/lib/actions/storage";
import { ClipboardList } from "lucide-react";
import type { InventoryChecklist, Property, Room } from "@/lib/types";

/**
 * Every room's standing inventory, grouped by building.
 *
 * The room inventory is the thing an admin maintains — set up once with
 * photographs, then reused as the starting point for each tenancy. Listing by
 * property mirrors how the buildings are actually walked.
 */
export default async function InventoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const [{ data: properties }, { data: rooms }, { data: checklists }] =
    await Promise.all([
      supabase.from("properties").select("*").order("name"),
      supabase.from("rooms").select("*").order("name"),
      supabase.from("inventory_checklists").select("*"),
    ]);

  const baselineByRoom = new Map<string, InventoryChecklist>();
  for (const c of (checklists ?? []) as InventoryChecklist[]) {
    if (c.type === "baseline" && c.room_id) baselineByRoom.set(c.room_id, c);
  }

  // How much of each baseline is filled in, so an unfinished room is obvious.
  const baselineIds = [...baselineByRoom.values()].map((c) => c.id);
  const { data: areas } = baselineIds.length
    ? await supabase
        .from("checklist_areas")
        .select("id, checklist_id")
        .in("checklist_id", baselineIds)
    : { data: [] as { id: string; checklist_id: string }[] };

  const areaIds = (areas ?? []).map((a) => a.id);
  const { data: sections } = areaIds.length
    ? await supabase
        .from("checklist_sections")
        .select("checklist_area_id, condition_rating")
        .in("checklist_area_id", areaIds)
    : {
        data: [] as {
          checklist_area_id: string;
          condition_rating: string | null;
        }[],
      };

  const checklistByArea = new Map(
    (areas ?? []).map((a) => [a.id, a.checklist_id]),
  );
  const progress = new Map<string, { done: number; total: number }>();
  for (const s of sections ?? []) {
    const checklistId = checklistByArea.get(s.checklist_area_id);
    if (!checklistId) continue;
    const p = progress.get(checklistId) ?? { done: 0, total: 0 };
    p.total += 1;
    if (s.condition_rating) p.done += 1;
    progress.set(checklistId, p);
  }

  const propertyList = (properties ?? []) as Property[];
  const roomList = byName(rooms as Room[] | null);

  // Signed on the server so a section header paints with its photograph
  // rather than assembling after a round trip.
  const bannerPaths = propertyList
    .map((p) => p.banner_path)
    .filter((p): p is string => !!p);
  const signed = bannerPaths.length ? await getSignedUrls(bannerPaths) : null;
  const bannerUrls = signed?.ok ? signed.data : {};

  const sections_: InventoryProperty[] = propertyList.map((property) => ({
    id: property.id,
    name: property.name,
    address: property.address,
    bannerUrl: property.banner_path
      ? (bannerUrls[property.banner_path] ?? null)
      : null,
    rooms: roomList
      .filter((r) => r.property_id === property.id)
      .map((room) => {
        const baseline = baselineByRoom.get(room.id);
        const p = baseline ? progress.get(baseline.id) : undefined;
        return {
          id: room.id,
          name: room.name,
          unitType: room.unit_type,
          isShared: room.is_common_area,
          checklistId: baseline?.id ?? null,
          done: p?.done ?? 0,
          total: p?.total ?? 0,
        };
      }),
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">{t("inventory.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("inventory.roomInventoryHint")}
        </p>
      </header>

      {propertyList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ClipboardList className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              {t("properties.noProperties")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <PropertySections properties={sections_} />
      )}
    </div>
  );
}
