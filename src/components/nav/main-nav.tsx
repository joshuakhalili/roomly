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
  Users,
  UserRound,
  FolderLock,
} from "lucide-react";

const ITEMS = [
  { href: "/", labelKey: "dashboard", Icon: LayoutDashboard },
  { href: "/properties", labelKey: "properties", Icon: Building2 },
  { href: "/tenants", labelKey: "tenants", Icon: UserRound },
  { href: "/rent", labelKey: "rent", Icon: Banknote },
  { href: "/inventory", labelKey: "inventory", Icon: ClipboardList },
  { href: "/documents", labelKey: "documents", Icon: FolderLock },
  { href: "/analytics", labelKey: "analytics", Icon: ChartLine },
  { href: "/admins", labelKey: "admins", Icon: Users },
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
    <nav className="flex flex-col gap-1 p-3">
      {ITEMS.map(({ href, labelKey, Icon }) => (
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
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-8">
        {ITEMS.map(({ href, labelKey, Icon }) => (
          <li key={href}>
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
