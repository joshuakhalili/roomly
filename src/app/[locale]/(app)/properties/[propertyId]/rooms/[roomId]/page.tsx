import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoomDialog } from "@/components/rooms/room-dialog";
import { DeleteRoomButton } from "@/components/rooms/delete-room-button";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { TenancySummary } from "@/components/tenancies/tenancy-summary";
import { ChecklistLauncher } from "@/components/inventory/checklist-launcher";
import { ArrowLeft, Pencil, Plus, User, Mail, Phone } from "lucide-react";
import type {
  DocumentRecord,
  InventoryChecklist,
  Occupant,
  RentPayment,
  Room,
  Tenancy,
} from "@/lib/types";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ locale: string; propertyId: string; roomId: string }>;
}) {
  const { locale, propertyId, roomId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const [{ data: room }, { data: property }] = await Promise.all([
    supabase.from("rooms").select("*").eq("id", roomId).single(),
    supabase.from("properties").select("name").eq("id", propertyId).single(),
  ]);

  if (!room) notFound();

  // The tenancy that currently applies: active first, else the next upcoming.
  const { data: tenancies } = await supabase
    .from("tenancies")
    .select("*")
    .eq("room_id", roomId)
    .in("status", ["active", "upcoming"])
    .order("start_date");

  const current =
    ((tenancies ?? []) as Tenancy[]).find((x) => x.status === "active") ??
    ((tenancies ?? []) as Tenancy[])[0] ??
    null;

  let occupants: Occupant[] = [];
  let documents: DocumentRecord[] = [];
  let payments: RentPayment[] = [];
  let checklists: InventoryChecklist[] = [];

  if (current) {
    const [{ data: o }, { data: d }, { data: p }, { data: c }] = await Promise.all([
      supabase.from("occupants").select("*").eq("tenancy_id", current.id),
      supabase.from("documents").select("*").eq("tenancy_id", current.id),
      supabase.from("rent_payments").select("*").eq("tenancy_id", current.id),
      supabase.from("inventory_checklists").select("*").eq("tenancy_id", current.id),
    ]);
    occupants = (o ?? []) as Occupant[];
    documents = (d ?? []) as DocumentRecord[];
    payments = (p ?? []) as RentPayment[];
    checklists = (c ?? []) as InventoryChecklist[];
  }

  const r = room as Room;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/properties/${propertyId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {property?.name ?? t("properties.title")}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{r.name}</h1>
              {current && (
                <Badge variant={current.status === "active" ? "default" : "secondary"}>
                  {current.status === "active"
                    ? t("rooms.occupied")
                    : t("rooms.upcoming")}
                </Badge>
              )}
              {!current && !r.is_common_area && (
                <Badge variant="outline">{t("rooms.vacant")}</Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <RoomDialog
              propertyId={propertyId}
              room={r}
              trigger={
                <Button variant="outline" size="sm">
                  <Pencil className="size-4" aria-hidden />
                  {t("common.edit")}
                </Button>
              }
            />
            <DeleteRoomButton id={r.id} propertyId={propertyId} />
            {!current && r.is_lettable && (
              <Button asChild size="sm">
                <Link href={`/properties/${propertyId}/rooms/${roomId}/tenancies/new`}>
                  <Plus className="size-4" aria-hidden />
                  {t("rooms.addTenancy")}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {!current ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <User className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">{t("rooms.noTenant")}</p>
            {r.is_lettable && (
              <Button asChild>
                <Link href={`/properties/${propertyId}/rooms/${roomId}/tenancies/new`}>
                  <Plus className="size-4" aria-hidden />
                  {t("rooms.addTenancy")}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Everything about the current occupants, in one place. */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{t("tenancy.title")}</h2>
              <Button asChild variant="outline" size="sm">
                <Link href={`/tenancies/${current.id}`}>{t("common.edit")}</Link>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {occupants.map((o) => (
                <Card key={o.id}>
                  <CardContent className="flex flex-col gap-2 p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {o.first_name} {o.surname}
                      </span>
                      {o.is_lead_tenant && (
                        <Badge variant="secondary" className="text-xs">
                          {t("tenancy.leadTenant")}
                        </Badge>
                      )}
                    </div>
                    {o.email && (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="size-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{o.email}</span>
                      </p>
                    )}
                    {o.phone && (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="size-3.5 shrink-0" aria-hidden />
                        {o.phone}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <TenancySummary tenancy={current} payments={payments} />
          </section>

          <DocumentsPanel
            tenancyId={current.id}
            occupants={occupants}
            documents={documents}
          />

          <ChecklistLauncher tenancyId={current.id} checklists={checklists} />
        </>
      )}
    </div>
  );
}
