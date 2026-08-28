import { getTranslations, getFormatter, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddAdminDialog } from "@/components/admins/add-admin-dialog";
import { CalendarFeedCard } from "@/components/admins/calendar-feed-card";
import { UserRound } from "lucide-react";
import type { Profile } from "@/lib/types";

export default async function AdminsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const format = await getFormatter();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at");

  const all = (profiles ?? []) as Profile[];
  const me = all.find((p) => p.id === user?.id);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("admins.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("admins.subtitle")}</p>
        </div>
        <AddAdminDialog />
      </header>

      {me && <CalendarFeedCard profile={me} appUrl={appUrl} />}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("admins.title")}</h2>
        <ul className="flex flex-col gap-2">
          {all.map((p) => (
            <li key={p.id}>
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <UserRound className="size-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">
                        {p.display_name ?? p.email}
                      </span>
                      {p.id === user?.id && (
                        <Badge variant="secondary" className="text-xs">
                          {t("admins.you")}
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.email} ·{" "}
                      {format.dateTime(new Date(p.created_at), {
                        dateStyle: "medium",
                      })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
