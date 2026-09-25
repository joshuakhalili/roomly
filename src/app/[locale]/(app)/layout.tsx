import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SidebarNav, BottomNav } from "@/components/nav/main-nav";
import { LanguageSwitcher } from "@/components/nav/language-switcher";
import { CommandMenu } from "@/components/nav/command-menu";
import { NewMenu } from "@/components/nav/new-menu";
import { UserMenu } from "@/components/nav/user-menu";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/brand/logo";

/**
 * Shell for every signed-in page. The proxy already guarantees there's a
 * session before this renders — the lookups here are only so the header can
 * show who's signed in and which organisation they are working in.
 *
 * The header carries the three things wanted from anywhere: find something
 * (search, ⌘K), add something (New), and the account itself.
 */
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("app");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("display_name, organizations(name)")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };
  const organization =
    (profile?.organizations as unknown as { name: string } | null)?.name ?? null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="workspace-header sticky top-0 z-40 border-b">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link
            href="/"
            className="flex shrink-0 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-48"
            aria-label={t("name")}
          >
            {/* Wordmark hides on the narrowest screens; the mark alone still
                identifies the app, which is what it is designed to do. */}
            <Logo
              variant="lockup"
              className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline"
            />
          </Link>
          <div className="flex min-w-0 flex-1 justify-center">
            <CommandMenu />
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <NewMenu />
            <LanguageSwitcher />
            <UserMenu
              email={user?.email ?? ""}
              displayName={(profile?.display_name as string | null) ?? null}
              organization={organization}
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="workspace-rail hidden w-56 shrink-0 md:block">
          <div className="sticky top-14 flex h-[calc(100dvh-3.5rem)] flex-col">
            <div className="flex-1 overflow-y-auto">
              <SidebarNav />
            </div>
            {organization && (
              <div className="shell-org m-3 flex items-center gap-2.5 rounded-lg px-3 py-2.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold">
                  {organization.slice(0, 1).toUpperCase()}
                </span>
                <span className="truncate text-sm font-medium">{organization}</span>
              </div>
            )}
          </div>
        </aside>

        {/* Bottom padding clears the mobile tab bar. */}
        <main className="workspace-main min-w-0 flex-1 p-4 pb-24 md:p-8 md:pb-8">
          {children}
        </main>
      </div>

      <BottomNav />
      <InstallPrompt />
    </div>
  );
}
