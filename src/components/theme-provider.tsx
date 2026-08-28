"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Thin client wrapper so the server layout can mount the provider.
 *
 * The dark palette already existed in globals.css — shadcn ships it — but
 * nothing ever added the `dark` class to <html>, so none of it could apply
 * and the toaster's useTheme() had no provider to read. This connects what
 * was already there.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
