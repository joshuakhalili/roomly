import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PropertyDialog } from "@/components/properties/property-dialog";
import { RoomDialog } from "@/components/rooms/room-dialog";
import { DeletePropertyButton } from "@/components/properties/delete-property-button";
import { ArrowLeft, ChevronRight, DoorOpen, Pencil, User } from "lucide-react";
import type { Property, Room, Tenancy, TenantOnTenancy } from "@/lib/types";

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ locale: string; propertyId: string }>;
}) {
  const { locale, propertyId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .single();

  if (!property) notFound();

  const [{ data: rooms }, { data: tenancies }, { data: tenancyTenants }] =
    await Promise.all([
      supabase.from("rooms").select("*").eq("property_id", propertyId).order("name"),
      supabase.from("tenancies").select("*").in("status", ["upcoming", "active"]),
      supabase
        .from("tenancy_tenants")
        .select("tenancy_id, is_lead_tenant, tenants(*)"),
    ]);

  const tenantsByTenancy = new Map<string, TenantOnTenancy[]>();
  for (const row of (tenancyTenants ?? []) as unknown as {
    tenancy_id: string;
    is_lead_tenant: boolean;
    tenants: TenantOnTenancy | null;
  }[]) {
    if (!row.tenants) continue;
    const list = tenantsByTenancy.get(row.tenancy_id) ?? [];
    list.push({ ...row.tenants, is_lead_tenant: row.is_lead_tenant });
    tenantsByTenancy.set(row.tenancy_id, list);
  }

  const tenancyByRoom = new Map<string, Tenancy>();
  for (const tenancy of (tenancies ?? []) as Tenancy[]) {
    const existing = tenancyByRoom.get(tenancy.room_id);
    // An active tenancy always wins over a merely upcoming one.
    if (!existing || tenancy.status === "active")
      tenancyByRoom.set(tenancy.room_id, tenancy);
  }

  const prop = property as Property;
  const roomList = (rooms ?? []) as Room[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/properties"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("properties.title")}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">{prop.name}</h1>
            {prop.address && (
              <p className="text-sm text-muted-foreground">{prop.address}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <PropertyDialog
              property={prop}
              trigger={
                <Button variant="outline" size="sm">
                  <Pencil className="size-4" aria-hidden />
                  {t("common.edit")}
                </Button>
              }
            />
            <DeletePropertyButton id={prop.id} />
            <RoomDialog propertyId={prop.id} />
          </div>
        </div>
      </div>

      {prop.notes && (
        <Card>
          <CardContent className="p-4 text-sm whitespace-pre-wrap">
            {prop.notes}
          </CardContent>
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("rooms.title")}</h2>

        {roomList.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <DoorOpen className="size-8 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">{t("rooms.noRooms")}</p>
              <RoomDialog propertyId={prop.id} />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roomList.map((room) => {
              const tenancy = tenancyByRoom.get(room.id);
              const lead = tenancy
                ? (tenantsByTenancy.get(tenancy.id)?.find((x) => x.is_lead_tenant) ??
                  tenantsByTenancy.get(tenancy.id)?.[0])
                : undefined;

              return (
                <Link
                  key={room.id}
                  href={`/properties/${prop.id}/rooms/${room.id}`}
                >
                  <Card className="h-full transition-colors hover:bg-accent/40">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium">{room.name}</p>
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {room.is_common_area
                              ? t("rooms.isCommonArea")
                              : t(
                                  room.unit_type === "flat"
                                    ? "rooms.unitFlat"
                                    : "rooms.unitStudio",
                                )}
                          </Badge>
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                          {lead ? (
                            <>
                              <User className="size-3 shrink-0" aria-hidden />
                              {lead.first_name} {lead.surname}
                            </>
                          ) : room.is_common_area ? (
                            "—"
                          ) : (
                            t("rooms.vacant")
                          )}
                        </p>
                      </div>
                      <ChevronRight
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
