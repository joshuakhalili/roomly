"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Share, X } from "lucide-react";

const DISMISSED_KEY = "install-prompt-dismissed";

/** Nothing to subscribe to — the answer can't change mid-session. */
const subscribe = () => () => {};

/** Server render: never show it, so the markup matches the first client paint. */
const getServerSnapshot = () => false;

function getClientSnapshot() {
  try {
    if (localStorage.getItem(DISMISSED_KEY)) return false;
  } catch {
    // Private browsing can throw on access — treat as "don't show".
    return false;
  }

  const isIOS = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS reports standalone mode here rather than via the media query.
    (window.navigator as { standalone?: boolean }).standalone === true;

  return isIOS && !isStandalone;
}

/**
 * iOS gives no programmatic "install this app?" prompt — adding to the home
 * screen is a manual Share-menu step that users won't guess. This banner
 * explains it once, only on iOS Safari, and only when not already installed.
 *
 * Reading the platform via useSyncExternalStore rather than an effect keeps
 * the server and client render in agreement without a setState-on-mount.
 */
export function InstallPrompt() {
  const t = useTranslations("pwa");
  const eligible = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [dismissed, setDismissed] = useState(false);

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Non-fatal — worst case the banner reappears next visit.
    }
    setDismissed(true);
  }

  if (!eligible || dismissed) return null;

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
