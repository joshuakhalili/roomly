// Next 16 renamed `middleware.ts` to `proxy.ts` (Node runtime, not Edge).
// This is the single gate that makes every page require a login.
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const handleI18n = createIntlMiddleware(routing);

/** The only pages reachable without being signed in. */
const PUBLIC_PATHS = ["/login", "/auth/callback"];

/**
 * Built from routing.locales rather than written out again.
 *
 * This was a hardcoded `(en|zh)`, which is the kind of second copy that only
 * announces itself once a third language exists: an unlisted locale stops
 * matching as a public path, so /tr/login is treated as protected, redirects
 * to /tr/login, and loops.
 */
const LOCALE_PREFIX = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);

function isPublicPath(pathname: string) {
  // Strip the locale prefix ("/en/login" → "/login") before matching.
  const withoutLocale = pathname.replace(LOCALE_PREFIX, "") || "/";
  return PUBLIC_PATHS.some(
    (p) => withoutLocale === p || withoutLocale.startsWith(`${p}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Vercel redirects HTTP at the edge; this is a second, explicit guard for
  // any future proxy or self-hosted deployment that forwards plain HTTP.
  if (
    process.env.NODE_ENV === "production" &&
    request.headers.get("x-forwarded-proto") === "http"
  ) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  // The calendar feed is authenticated by its own secret token in the URL,
  // not by a session — calendar apps can't log in. It handles its own auth.
  if (pathname.startsWith("/api/calendar/")) return NextResponse.next();

  // Cron routes authenticate with CRON_SECRET, also no session involved.
  if (pathname.startsWith("/api/cron/")) return NextResponse.next();

  // Run the locale middleware first so the response carries its cookies
  // and rewrites; the auth check below then adds to that same response.
  const response = handleI18n(request);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              path: "/",
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
            }),
          );
        },
      },
    },
  );

  // getUser() revalidates the token with Supabase on every request.
  // getSession() would only decode the cookie, which a client can forge.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const locale = pathname.split("/")[1] || routing.defaultLocale;

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    // Remember where they were headed so login can send them back.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Already signed in and sitting on the login page — send them home.
  if (user && isPublicPath(pathname) && pathname.includes("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Skip Next internals and static files; match everything else.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webmanifest)$).*)"],
};
