"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Share, X } from "lucide-react";

const DISMISSED_KEY = "install-prompt-dismissed";

/**
 * iOS gives no programmatic "install this app?" prompt — adding to the home
 * screen is a manual Share-menu step that users won't guess. This banner
 * explains it once, only on iOS Safari, and only when not already installed.
 */
export function InstallPrompt() {
  const t = useTranslations("pwa");
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Wrapped: some privacy modes throw on localStorage access outright.
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      return;
    }

    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS exposes standalone mode off navigator, not the media query.
      (window.navigator as { standalone?: boolean }).standalone === true;

    if (isIOS && !isStandalone) setShow(true);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Non-fatal — worst case the banner reappears next visit.
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-20 z-50 rounded-lg border bg-card p-4 shadow-lg md:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      role="dialog"
      aria-label={t("installTitle")}
    >
      <div className="flex items-start gap-3">
        <Share className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t("installTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("installBody")}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-2 size-8 shrink-0"
          onClick={dismiss}
          aria-label={t("dismiss")}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
