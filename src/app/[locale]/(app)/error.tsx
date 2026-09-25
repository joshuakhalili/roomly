"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { CloudOff, RotateCcw } from "lucide-react";

/**
 * When a screen fails to load, say so plainly and offer the two ways out:
 * try again, or go back to the dashboard. The shell stays put around it, so
 * the rest of the workspace is still one click away.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-muted">
        <CloudOff className="size-6 text-muted-foreground" aria-hidden />
      </span>
      <div className="max-w-sm">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("detail")}</p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-muted-foreground">{t("reference", { id: error.digest })}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => retry()}>
          <RotateCcw className="size-4" aria-hidden />
          {t("retry")}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">{t("home")}</Link>
        </Button>
      </div>
    </div>
  );
}
