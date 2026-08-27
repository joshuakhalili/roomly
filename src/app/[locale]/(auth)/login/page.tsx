import { Suspense } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Home } from "lucide-react";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary">
            <Home className="size-6 text-primary-foreground" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold">{t("app.name")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("auth.signInSubtitle")}
          </p>
        </div>
        {/* LoginForm reads ?next= from the URL, which needs a Suspense
            boundary so the rest of the page can still prerender. */}
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
