import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    // Every date in the app is a UK date. Pinning the zone keeps the server
    // (UTC on Vercel) and the browser from disagreeing across midnight.
    timeZone: "Europe/London",
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
