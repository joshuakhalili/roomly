"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import Script from "next/script";
import { login } from "@/lib/actions/auth";
import { routing } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CircleAlert } from "lucide-react";

declare global {
  interface Window {
    turnstile?: { reset: () => void };
  }
}

function safeDestination(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    return "/";
  const localePattern = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);
  return value.replace(localePattern, "") || "/";
}

export function LoginForm({ turnstileSiteKey }: { turnstileSiteKey?: string }) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    setError(null);
    const result = await login(formData);

    if (!result.ok) {
      setError(result.error);
      window.turnstile?.reset();
      return;
    }

    const next = safeDestination(searchParams.get("next"));
    startTransition(() => {
      router.replace(next as "/");
      router.refresh();
    });
  }

  return (
    <Card className="login-card">
      <CardContent className="pt-6">
        {turnstileSiteKey && (
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            strategy="afterInteractive"
          />
        )}
        <form
          action={(formData) => {
            startTransition(() => {
              void onSubmit(formData);
            });
          }}
          className="flex flex-col gap-4"
        >
          <div className="absolute -left-[10000px]" aria-hidden="true">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              disabled={isPending}
              className="h-11"
            />
          </div>

          {turnstileSiteKey && (
            <div
              className="cf-turnstile"
              data-sitekey={turnstileSiteKey}
              data-action="login"
              data-theme="auto"
              data-size="flexible"
            />
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={isPending}
              className="h-11"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}

          <Button type="submit" disabled={isPending} className="h-11 w-full text-base">
            {isPending ? t("auth.signingIn") : t("auth.signIn")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
