import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Archivo, Instrument_Sans, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { routing } from "@/i18n/routing";
import "../globals.css";

/**
 * The UI face — nav, labels, form fields, body copy, and anything money
 * appears in more than once. Instrument Sans's tabular figures measured
 * identical (600 units) at weight 400 AND 700, so a bold total row and the
 * regular rows above it share a digit grid — Archivo's do not (568→598
 * across the same range), which is why Archivo is display-only below.
 *
 * axes: ["wdth"] is required to expose the width axis at all; without it
 * next/font only wires up wght.
 */
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  axes: ["wdth"],
});

/**
 * The display face — the wordmark, page titles, and the one headline figure
 * per screen. Never body text: at 13px in a dense table Archivo's default
 * cut reads noticeably wider than Instrument Sans, and it exists to be the
 * loud thing precisely because it is used so rarely.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

/** Numerals face for the calendar feed URL and the build hash only. */
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
    { media: "(prefers-color-scheme: light)", color: "#F6F4EF" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0A07" },
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
      className={`${instrumentSans.variable} ${archivo.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
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
