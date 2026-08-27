// Next 16 renamed `middleware.ts` to `proxy.ts` (Node runtime, not Edge).
// This is the single gate that makes every page require a login.
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const handleI18n = createIntlMiddleware(routing);

/** The only pages reachable without being signed in. */
const PUBLIC_PATHS = ["/login", "/auth/callback"];

function isPublicPath(pathname: string) {
  // Strip the locale prefix ("/en/login" → "/login") before matching.
  const withoutLocale = pathname.replace(/^\/(en|zh)(?=\/|$)/, "") || "/";
  return PUBLIC_PATHS.some(
    (p) => withoutLocale === p || withoutLocale.startsWith(`${p}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
            response.cookies.set(name, value, options),
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
