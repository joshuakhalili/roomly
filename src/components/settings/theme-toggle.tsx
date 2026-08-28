"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Monitor } from "lucide-react";

const OPTIONS = [
  { value: "light", labelKey: "settings.themeLight", Icon: Sun },
  { value: "dark", labelKey: "settings.themeDark", Icon: Moon },
  { value: "system", labelKey: "settings.themeSystem", Icon: Monitor },
] as const;

export function ThemeToggle() {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();

  /**
   * The server has no idea which theme the browser will pick — the choice
   * lives in localStorage and the OS preference. Rendering the buttons
   * unselected until mounted avoids showing "Light" as active for a moment
   * on a machine that is actually in dark mode.
   *
   * useSyncExternalStore rather than an effect: this is literally a value
   * that differs between the server snapshot and the client one, which is
   * what it exists for. Nothing to subscribe to, so the subscribe function
   * is a no-op.
   */
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map(({ value, labelKey, Icon }) => (
        <Button
          key={value}
          size="sm"
          variant={mounted && theme === value ? "default" : "outline"}
          onClick={() => setTheme(value)}
        >
          <Icon className="size-4" aria-hidden />
          {t(labelKey)}
        </Button>
      ))}
    </div>
  );
}
