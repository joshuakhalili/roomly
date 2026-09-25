import {
  LayoutDashboard,
  Building2,
  Banknote,
  ClipboardList,
  ChartLine,
  UserRound,
  FolderLock,
  ShieldCheck,
  Wrench,
  Receipt,
  Settings,
} from "lucide-react";

/**
 * Every destination, the same on both layouts and in the command menu.
 *
 * Admins and Retention used to sit here as top-level items, which forced one
 * of them to be desktop-only — two different navigations depending on the
 * device. They are both settings rather than daily work, so they moved under
 * Settings. Everything left is something you might open on any given day.
 */
export const NAV_ITEMS = [
  { href: "/", labelKey: "dashboard", Icon: LayoutDashboard },
  { href: "/properties", labelKey: "properties", Icon: Building2 },
  { href: "/tenants", labelKey: "tenants", Icon: UserRound },
  { href: "/rent", labelKey: "rent", Icon: Banknote },
  { href: "/inventory", labelKey: "inventory", Icon: ClipboardList },
  { href: "/compliance", labelKey: "compliance", Icon: ShieldCheck },
  { href: "/documents", labelKey: "documents", Icon: FolderLock },
  { href: "/maintenance", labelKey: "maintenance", Icon: Wrench },
  { href: "/expenses", labelKey: "expenses", Icon: Receipt },
  { href: "/analytics", labelKey: "analytics", Icon: ChartLine },
  { href: "/settings", labelKey: "settings", Icon: Settings },
] as const;
