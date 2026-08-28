import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { routing } from "@/i18n/routing";
import "../globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

/**
 * The numerals face, for rent totals, occupancy figures and dates.
 *
 * globals.css already pointed `--font-mono` at `--font-geist-mono`, which was
 * never defined anywhere — so `font-mono` silently did nothing. This is that
 * fix and the "we need a face for data" decision in one: Geist Mono is from the
 * same family as the UI face, so nothing new has to be designed around.
 */
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "app" });

  return {
    title: { default: t("name"), template: `%s · ${t("name")}` },
    description: "Private property management tool",
    // This tool is for one small team. It should never be indexed.
    robots: { index: false, follow: false, nocache: true },
    appleWebApp: {
      capable: true,
      title: t("shortName"),
      statusBarStyle: "default",
    },
  };
}

export const viewport: Viewport = {
  // Two values so iOS paints the status bar to match the active theme
  // rather than showing a dark strip above a light page.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  // Let iOS fill the notch area when installed to the home screen.
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Required for static rendering to work with next-intl.
  setRequestLocale(locale);

  return (
    // suppressHydrationWarning is required by next-themes: it writes the
    // theme class onto <html> before React hydrates, so the server's markup
    // and the client's first render legitimately differ on this one element.
    <html
      lang={locale === "zh" ? "zh-Hans" : "en"}
      className={`${geist.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {/* The gradient, behind everything. Fixed and pointer-events-none, so
            it never scrolls with content or intercepts a click. */}
        <div className="aurora" aria-hidden />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider>
            {children}
            <Toaster position="top-center" />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
