import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
const sans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});
export const metadata: Metadata = {
  title: { default: "Roomly — a place for home", template: "%s · Roomly" },
  description:
    "Everything you need to settle into your home, kept clear and current.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <body className={sans.variable}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
