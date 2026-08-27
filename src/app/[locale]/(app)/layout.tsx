import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SidebarNav, BottomNav } from "@/components/nav/main-nav";
import { LanguageSwitcher } from "@/components/nav/language-switcher";
import { SignOutButton } from "@/components/nav/sign-out-button";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { createClient } from "@/lib/supabase/server";
import { Home } from "lucide-react";

/**
 * Shell for every signed-in page. The proxy already guarantees there's a
 * session before this renders — the check here is only so the header can
 * show who's signed in.
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

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Home className="size-5 text-primary" aria-hidden />
            <span className="hidden sm:inline">{t("name")}</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <span className="hidden max-w-[16ch] truncate text-sm text-muted-foreground lg:inline">
              {user?.email}
            </span>
            <LanguageSwitcher />
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r md:block">
          <div className="sticky top-14">
            <SidebarNav />
          </div>
        </aside>

        {/* Bottom padding clears the mobile tab bar. */}
        <main className="min-w-0 flex-1 p-4 pb-24 md:p-6 md:pb-6">
          {children}
        </main>
      </div>

      <BottomNav />
      <InstallPrompt />
    </div>
  );
}
