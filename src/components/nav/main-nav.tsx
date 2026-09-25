"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { usePathname, Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { NAV_ITEMS as ITEMS } from "@/components/nav/nav-items";

/**
 * The same ten, grouped for the sidebar.
 *
 * Grouped by the question each answers rather than by how often it is used:
 * "how are we doing" (Overview), "who is where and have they paid"
 * (Lettings), "what is on file and what did it cost" (Records). Ten flat
 * items is a list you read top to bottom every time; four small groups is one
 * you learn the shape of and then stop reading.
 *
 * Phones expose four daily destinations and an accessible menu for the full workspace.
 */
const GROUPS = [
  { labelKey: "groupOverview", hrefs: ["/", "/analytics"] },
  { labelKey: "groupLettings", hrefs: ["/properties", "/tenants", "/rent"] },
  {
    labelKey: "groupRecords",
    hrefs: ["/inventory", "/compliance", "/documents", "/maintenance", "/expenses"],
  },
  { labelKey: "groupSystem", hrefs: ["/settings"] },
] as const;

function useIsActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Sidebar — desktop only. */
export function SidebarNav() {
  const t = useTranslations("nav");
  const isActive = useIsActive();

  return (
    <nav className="flex flex-col gap-5 p-3">
      {GROUPS.map((group) => (
        <div key={group.labelKey} className="flex flex-col gap-1">
          <h2 className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {t(group.labelKey)}
          </h2>
          {group.hrefs.map((href) => {
            const item = ITEMS.find((i) => i.href === href);
            if (!item) return null;
            const { Icon, labelKey } = item;
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive(href)
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {t(labelKey)}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/**
 * Bottom tab bar — phone only. Fixed to the bottom with safe-area padding so
 * it clears the iPhone home indicator when installed to the home screen.
 */
export function BottomNav() {
  const t = useTranslations("nav");
  const isActive = useIsActive();
  const [open, setOpen] = useState(false);
  const primary = ITEMS.filter((item) =>
    ["/", "/properties", "/rent", "/inventory"].includes(item.href),
  );
  return (
    <nav
      aria-label={t("mobileNavigation")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {primary.map(({ href, labelKey, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium",
                isActive(href) ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon size={20} aria-hidden />
              <span className="max-w-full truncate">{t(labelKey)}</span>
            </Link>
          </li>
        ))}
        <li>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className="flex min-h-16 w-full flex-col items-center justify-center gap-1 text-[10px] font-medium">
              <Menu size={20} aria-hidden />
              {t("more")}
            </DialogTrigger>
            <DialogContent className="max-h-[85dvh] overflow-y-auto">
              <DialogTitle>{t("mobileNavigation")}</DialogTitle>
              <DialogDescription className="sr-only">
                {t("allDestinations")}
              </DialogDescription>
              <div className="grid grid-cols-2 gap-2">
                {ITEMS.map(({ href, labelKey, Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(href) ? "page" : undefined}
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-md p-3 text-sm",
                      isActive(href)
                        ? "bg-secondary text-primary"
                        : "hover:bg-muted",
                    )}
                  >
                    <Icon size={18} aria-hidden />
                    {t(labelKey)}
                  </Link>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </li>
      </ul>
    </nav>
  );
}
