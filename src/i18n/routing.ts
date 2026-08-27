import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "zh"],
  defaultLocale: "en",
  // Keep the locale in the URL for both languages ("/en/rent", "/zh/rent").
  // Without this, English URLs have no prefix and the language switcher has
  // to special-case the default locale.
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
