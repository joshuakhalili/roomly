import { getTranslations, setRequestLocale } from "next-intl/server";
import { byName } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScheduleBoard } from "@/components/maintenance/schedule-board";
import { ContactsPanel } from "@/components/maintenance/contacts-panel";
import { AssetsPanel } from "@/components/maintenance/assets-panel";
import { Wrench } from "lucide-react";
import type {
  Asset,
  Contact,
  DocumentRecord,
  JobRecurrence,
  JobWithContext,
  Property,
  Room,
  ServiceType,
} from "@/lib/types";

/**
 * Maintenance: the work, who does it, and what you own.
 *
 * Three tabs rather than one long page. The schedule needs a calendar, a
 * list and a detail panel sharing the screen, which leaves no room for an
 * address book underneath — and contacts and assets are each things you go
 * looking for deliberately, not things you scan past on the way to today's
 * jobs.
 */

/** Jobs either side of now — enough for the calendar to page through. */
const WINDOW_MONTHS = 6;

function windowBounds() {
  const from = new Date();
  from.setMonth(from.getMonth() - WINDOW_MONTHS);
  const to = new Date();
  to.setMonth(to.getMonth() + WINDOW_MONTHS);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export default async function MaintenancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const { from, to } = windowBounds();

  const [
    { data: jobsRaw },
    { data: properties },
    { data: rooms },
    { data: serviceTypes },
    { data: contacts },
    { data: assets },
    { data: recurrences },
    { data: attachments },
  ] = await Promise.all([
    supabase
      .from("maintenance_jobs")
      .select(
        "*, properties(name), rooms(name), service_types(name, slug), contacts(name)",
      )
      .gte("scheduled_for", from)
      .lte("scheduled_for", to)
      .order("scheduled_for"),
    supabase.from("properties").select("*").order("name"),
    supabase.from("rooms").select("*").order("name"),
    supabase
      .from("service_types")
      .select("*")
      .eq("is_archived", false)
      .order("sort_order"),
    supabase
      .from("contacts")
      .select("*")
      .eq("is_archived", false)
      .order("name"),
    supabase
      .from("assets")
      .select("*")
      .order("purchased_on", { ascending: false, nullsFirst: false }),
    supabase.from("job_recurrences").select("*").eq("is_active", true),
    // Only the paperwork attached from in here — the wider library is its
    // own page and does not belong on this one.
    supabase
      .from("documents")
      .select("*")
      .or("maintenance_job_id.not.is.null,asset_id.not.is.null"),
  ]);

  // Flattened here rather than in the client: the joined shape PostgREST
  // returns is awkward to thread through three components.
  const jobs: JobWithContext[] = (jobsRaw ?? []).map((j) => {
    const row = j as Record<string, unknown>;
    const property = row.properties as { name: string } | null;
    const room = row.rooms as { name: string } | null;
    const service = row.service_types as {
      name: string;
      slug: string | null;
    } | null;
    const contact = row.contacts as { name: string } | null;
    return {
      ...(j as unknown as JobWithContext),
      property_name: property?.name ?? null,
      room_name: room?.name ?? null,
      service_type_name: service?.name ?? null,
      service_type_slug: service?.slug ?? null,
      contact_name: contact?.name ?? null,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Wrench className="size-6 shrink-0" aria-hidden />
        <div>
          <h1 className="text-2xl font-semibold">{t("nav.maintenance")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("maintenance.subtitle")}
          </p>
        </div>
      </div>

      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">{t("maintenance.schedule")}</TabsTrigger>
          <TabsTrigger value="contacts">{t("maintenance.contacts")}</TabsTrigger>
          <TabsTrigger value="assets">{t("maintenance.assets")}</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="mt-4">
          <ScheduleBoard
            jobs={jobs}
            properties={(properties ?? []) as Property[]}
            rooms={byName(rooms as Room[] | null)}
            serviceTypes={(serviceTypes ?? []) as ServiceType[]}
            contacts={(contacts ?? []) as Contact[]}
            recurrences={(recurrences ?? []) as JobRecurrence[]}
            documents={(attachments ?? []) as DocumentRecord[]}
          />
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          <ContactsPanel
            contacts={(contacts ?? []) as Contact[]}
            serviceTypes={(serviceTypes ?? []) as ServiceType[]}
            properties={(properties ?? []) as Property[]}
            jobs={jobs}
          />
        </TabsContent>

        <TabsContent value="assets" className="mt-4">
          <AssetsPanel
            assets={(assets ?? []) as Asset[]}
            properties={(properties ?? []) as Property[]}
            rooms={byName(rooms as Room[] | null)}
            documents={(attachments ?? []) as DocumentRecord[]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
