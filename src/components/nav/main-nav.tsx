"use client";

import { usePathname, Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  Banknote,
  ClipboardList,
  ChartLine,
  UserRound,
  FolderLock,
  Wrench,
  Settings,
} from "lucide-react";

/**
 * Eight destinations, the same on both layouts.
 *
 * Admins and Retention used to sit here as top-level items, which pushed
 * the phone's tab bar to nine and forced one of them to be desktop-only —
 * two different navigations depending on the device. They are both settings
 * rather than daily work, so they moved under Settings and the count came
 * back down. Everything left is something you might open on any given day.
 */
const ITEMS = [
  { href: "/", labelKey: "dashboard", Icon: LayoutDashboard },
  { href: "/properties", labelKey: "properties", Icon: Building2 },
  { href: "/tenants", labelKey: "tenants", Icon: UserRound },
  { href: "/rent", labelKey: "rent", Icon: Banknote },
  { href: "/inventory", labelKey: "inventory", Icon: ClipboardList },
  { href: "/documents", labelKey: "documents", Icon: FolderLock },
  { href: "/maintenance", labelKey: "maintenance", Icon: Wrench },
  { href: "/analytics", labelKey: "analytics", Icon: ChartLine },
  { href: "/settings", labelKey: "settings", Icon: Settings },
] as const;

/**
 * The same eight, grouped for the sidebar.
 *
 * Grouped by the question each answers rather than by how often it is used:
 * "how are we doing" (Overview), "who is where and have they paid"
 * (Lettings), "what is on file" (Records). Eight flat items is a list you
 * read top to bottom every time; four small groups is one you learn the
 * shape of and then stop reading.
 *
 * The phone's tab bar stays flat — headers cost vertical space a fixed
 * bottom bar does not have, and eight icons across is already scannable.
 */
const GROUPS = [
  { labelKey: "groupOverview", hrefs: ["/", "/analytics"] },
  { labelKey: "groupLettings", hrefs: ["/properties", "/tenants", "/rent"] },
  { labelKey: "groupRecords", hrefs: ["/inventory", "/documents", "/maintenance"] },
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

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Scrolls rather than squeezing. Nine items across a 375px phone
          leaves 41px each, which fits the icons and truncates every label
          to two characters. Fixed-width items with snap points keep the
          labels readable and the first five visible without scrolling. */}
      <ul className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ITEMS.map(({ href, labelKey, Icon }) => (
          <li key={href} className="w-[4.5rem] shrink-0 snap-start">
            <Link
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors",
                isActive(href)
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden />
              <span className="truncate leading-none">{t(labelKey)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
