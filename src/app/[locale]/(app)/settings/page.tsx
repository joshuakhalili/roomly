import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { ProfileForm, PasswordForm } from "@/components/settings/profile-form";
import { ThemeToggle } from "@/components/settings/theme-toggle";
import { AppSettingsForm } from "@/components/settings/app-settings-form";
import { CalendarFeedCard } from "@/components/admins/calendar-feed-card";
import { SignOutButton } from "@/components/nav/sign-out-button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Settings as SettingsIcon,
  UserRound,
  Palette,
  BellRing,
  Users,
  ShieldCheck,
  Cog,
  Info,
  ChevronRight,
} from "lucide-react";
import type { Profile } from "@/lib/types";

/**
 * The settings hub.
 *
 * Everything that is configuration rather than daily work, in one place —
 * including the two pages that used to sit in the main navigation. The
 * ordering runs from personal to shared to system: what only affects you,
 * then what affects everyone, then what the app itself is.
 */

interface SectionProps {
  title: string;
  description?: string;
  Icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}

function Section({ title, description, Icon, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function LinkRow({
  href,
  title,
  description,
  Icon,
}: {
  href: string;
  title: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:bg-secondary/40">
        <CardContent className="flex items-center gap-3 p-4">
          <Icon className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: settings }, { count: adminCount }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user?.id ?? "").single(),
      supabase.from("app_settings").select("key, value"),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);

  const setting = (key: string, fallback: string) =>
    settings?.find((s) => s.key === key)?.value ?? fallback;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const digestConfigured = Boolean(process.env.RESEND_API_KEY);

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div className="flex items-center gap-3">
        <SettingsIcon className="size-6 shrink-0" aria-hidden />
        <div>
          <h1 className="text-2xl font-semibold">{t("nav.settings")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("settings.subtitle")}
          </p>
        </div>
      </div>

      {/* ── You ─────────────────────────────────────────────────────────── */}
      <Section
        title={t("settings.account")}
        description={user?.email ?? undefined}
        Icon={UserRound}
      >
        <Card>
          <CardContent className="flex flex-col gap-6 p-4">
            {profile && (
              <ProfileForm
                profile={profile as Profile}
                digestConfigured={digestConfigured}
              />
            )}
            <Separator />
            <PasswordForm />
            <Separator />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {t("settings.signOutHelp")}
              </p>
              <SignOutButton showLabel />
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* ── Appearance ──────────────────────────────────────────────────── */}
      <Section
        title={t("settings.appearance")}
        description={t("settings.appearanceHelp")}
        Icon={Palette}
      >
        <Card>
          <CardContent className="p-4">
            <ThemeToggle />
          </CardContent>
        </Card>
      </Section>

      {/* ── Notifications ───────────────────────────────────────────────── */}
      <Section
        title={t("settings.notifications")}
        description={t("settings.notificationsHelp")}
        Icon={BellRing}
      >
        {profile && (
          <CalendarFeedCard profile={profile as Profile} appUrl={appUrl} />
        )}
      </Section>

      {/* ── Shared ──────────────────────────────────────────────────────── */}
      <Section
        title={t("settings.shared")}
        description={t("settings.sharedHelp")}
        Icon={Users}
      >
        <div className="flex flex-col gap-2">
          <LinkRow
            href="/settings/admins"
            title={t("nav.admins")}
            description={t("settings.adminsCount", { count: adminCount ?? 0 })}
            Icon={Users}
          />
          <LinkRow
            href="/settings/retention"
            title={t("nav.retention")}
            description={t("retention.subtitle")}
            Icon={ShieldCheck}
          />
        </div>
      </Section>

      {/* ── Automatic jobs ──────────────────────────────────────────────── */}
      <Section
        title={t("settings.jobs")}
        description={t("settings.jobsHelp")}
        Icon={Cog}
      >
        <Card>
          <CardContent className="p-4">
            <AppSettingsForm
              photoPurgeDays={Number(setting("photo_purge_days", "30"))}
              purgeOnTenancyEnd={
                setting("purge_photos_on_tenancy_end", "true") === "true"
              }
              moveAlertDays={Number(setting("move_alert_days", "3"))}
            />
          </CardContent>
        </Card>
      </Section>

      {/* ── About ───────────────────────────────────────────────────────── */}
      <Section title={t("settings.about")} Icon={Info}>
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">
                {t("settings.version")}
              </span>
              <span className="font-mono tabular-nums">
                {process.env.APP_VERSION}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">
                {t("settings.build")}
              </span>
              {/* The commit is what actually identifies a deploy — the
                  version string is the same for every build until someone
                  remembers to bump it. */}
              <span className="font-mono">{process.env.APP_COMMIT}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">
                {t("settings.environment")}
              </span>
              <Badge variant="outline">{process.env.APP_ENV}</Badge>
            </div>
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}
