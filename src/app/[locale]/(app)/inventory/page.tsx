import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, ChevronRight, Building2, Camera } from "lucide-react";
import type { InventoryChecklist, Property, Room } from "@/lib/types";

/**
 * Every room's standing inventory, in a column per property.
 *
 * The room inventory is the thing an admin maintains — set up once with
 * photographs, then reused as the starting point for each tenancy. Listing
 * by property mirrors how the buildings are actually walked.
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
    : { data: [] as { checklist_area_id: string; condition_rating: string | null }[] };

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
  const roomList = (rooms ?? []) as Room[];

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
        // One column per property — two properties sit side by side on a
        // laptop and stack on a phone.
        <div className="grid gap-6 md:grid-cols-2">
          {propertyList.map((property) => {
            const propertyRooms = roomList.filter(
              (r) => r.property_id === property.id,
            );

            return (
              <section key={property.id} className="flex flex-col gap-3">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Building2 className="size-4 text-muted-foreground" aria-hidden />
                  {property.name}
                  <Badge variant="secondary" className="text-xs">
                    {propertyRooms.length}
                  </Badge>
                </h2>

                {propertyRooms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("rooms.noRooms")}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {propertyRooms.map((room) => {
                      const baseline = baselineByRoom.get(room.id);
                      const p = baseline ? progress.get(baseline.id) : undefined;
                      const done = p?.done ?? 0;
                      const total = p?.total ?? 0;
                      const complete = total > 0 && done === total;

                      return (
                        <li key={room.id}>
                          <Link
                            href={
                              baseline
                                ? `/inventory/${baseline.id}`
                                : `/properties/${property.id}/rooms/${room.id}`
                            }
                          >
                            <Card className="transition-colors hover:bg-accent/40">
                              <CardContent className="flex items-center gap-3 p-3">
                                <Camera
                                  className="size-4 shrink-0 text-muted-foreground"
                                  aria-hidden
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="truncate text-sm font-medium">
                                      {room.name}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="shrink-0 text-xs"
                                    >
                                      {t(
                                        room.unit_type === "flat"
                                          ? "rooms.unitFlat"
                                          : "rooms.unitStudio",
                                      )}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {total > 0
                                      ? `${done}/${total}`
                                      : t("inventory.statusDraft")}
                                  </p>
                                </div>
                                {complete && (
                                  <Badge className="shrink-0 text-xs">
                                    {t("inventory.statusCompleted")}
                                  </Badge>
                                )}
                                <ChevronRight
                                  className="size-4 shrink-0 text-muted-foreground"
                                  aria-hidden
                                />
                              </CardContent>
                            </Card>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
