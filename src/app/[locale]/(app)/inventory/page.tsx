import { getTranslations, getFormatter, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, ChevronRight } from "lucide-react";

interface ChecklistRow {
  id: string;
  type: "check_in" | "check_out";
  status: "draft" | "completed";
  created_at: string;
  completed_at: string | null;
  tenancies: {
    rooms: { name: string; properties: { name: string } | null } | null;
    occupants: { first_name: string; surname: string; is_lead_tenant: boolean }[];
  } | null;
}

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const format = await getFormatter();

  const supabase = await createClient();
  const { data } = await supabase
    .from("inventory_checklists")
    .select(
      "id, type, status, created_at, completed_at, tenancies(rooms(name, properties(name)), occupants(first_name, surname, is_lead_tenant))",
    )
    .order("created_at", { ascending: false });

  const checklists = (data ?? []) as unknown as ChecklistRow[];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">{t("inventory.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("inventory.subtitle")}
        </p>
      </header>

      {checklists.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ClipboardList className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              {t("inventory.noChecklists")}
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {t("inventory.noTenancies")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {checklists.map((c) => {
            const room = c.tenancies?.rooms;
            const lead =
              c.tenancies?.occupants?.find((o) => o.is_lead_tenant) ??
              c.tenancies?.occupants?.[0];

            return (
              <li key={c.id}>
                <Link href={`/inventory/${c.id}`}>
                  <Card className="transition-colors hover:bg-accent/40">
                    <CardContent className="flex items-center gap-3 p-4">
                      <ClipboardList
                        className="size-5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">
                            {room?.name ?? "—"}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {c.type === "check_in"
                              ? t("inventory.checkIn")
                              : t("inventory.checkOut")}
                          </Badge>
                          <Badge
                            variant={c.status === "completed" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {c.status === "completed"
                              ? t("inventory.statusCompleted")
                              : t("inventory.statusDraft")}
                          </Badge>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {room?.properties?.name}
                          {lead &&
                            ` · ${t("inventory.forTenancy", {
                              name: `${lead.first_name} ${lead.surname}`,
                            })}`}
                          {" · "}
                          {format.dateTime(new Date(c.created_at), {
                            dateStyle: "medium",
                          })}
                        </p>
                      </div>
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
    </div>
  );
}
