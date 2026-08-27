import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware replacements for next/link and next/navigation.
// Import Link, redirect, usePathname and useRouter from HERE, not from Next
// directly — these keep the current language when navigating.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
