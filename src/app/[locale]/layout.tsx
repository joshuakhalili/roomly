import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Geist } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { routing } from "@/i18n/routing";
import "../globals.css";

const geist = Geist({ variable: "--font-sans", subsets: ["latin"] });

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
  themeColor: "#0f172a",
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
    <html lang={locale === "zh" ? "zh-Hans" : "en"} className={geist.variable}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <NextIntlClientProvider>
          {children}
          <Toaster position="top-center" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
