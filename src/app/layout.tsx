import type { ReactNode } from "react";

/**
 * Next requires a root layout, but the real <html>/<body> live in
 * [locale]/layout.tsx — that's where the language is known, and `lang`
 * has to be correct for screen readers and for Chinese font rendering.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
