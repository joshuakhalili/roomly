import { Suspense } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";
import { LanguageSwitcher } from "@/components/nav/language-switcher";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/brand/logo";
import { Banknote, ShieldCheck, ClipboardCheck } from "lucide-react";

/**
 * Sign in. The left half says what the product is for in three lines of
 * the interface itself, rather than a slogan: the three things a letting
 * team opens Roomly to check. The right half is only the form.
 */
export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const moments = [
    { Icon: Banknote, title: t("login.momentRent"), detail: t("login.momentRentDetail") },
    { Icon: ShieldCheck, title: t("login.momentCompliance"), detail: t("login.momentComplianceDetail") },
    { Icon: ClipboardCheck, title: t("login.momentInventory"), detail: t("login.momentInventoryDetail") },
  ];

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="login-brand relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <Logo variant="lockup" className="relative z-10" />
        <div className="relative z-10 max-w-md">
          <h2 className="login-headline">{t("login.headline")}</h2>
          <p className="mt-4 text-base opacity-80">{t("login.lede")}</p>
          <ul className="mt-10 flex flex-col gap-3">
            {moments.map(({ Icon, title, detail }, i) => (
              <li
                key={title}
                className="login-moment flex items-center gap-4 rounded-2xl p-4"
                style={{ animationDelay: `${180 + i * 90}ms` }}
              >
                <span className="login-moment-icon flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-xs opacity-75">{detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-xs opacity-60">{t("login.languages")}</p>
      </section>

      <section className="relative flex items-center justify-center p-6">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col gap-2">
            <Logo variant="mark" className="mb-4 size-10 text-foreground lg:hidden" />
            <h1 className="text-3xl font-semibold">{t("login.welcome")}</h1>
            <p className="text-sm text-muted-foreground">{t("auth.signInSubtitle")}</p>
          </div>
          {/* LoginForm reads ?next= from the URL, which needs a Suspense
              boundary so the rest of the page can still prerender. */}
          <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
            <LoginForm
              turnstileSiteKey={
                process.env.TURNSTILE_SECRET_KEY
                  ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
                  : undefined
              }
            />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
