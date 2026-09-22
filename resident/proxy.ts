import { NextResponse, type NextRequest } from "next/server";
import { authDestination } from "./lib/auth/destination";
import { createServerClient } from "@supabase/ssr";
// Only coarse session routing here; every query and mutation rechecks membership/ownership.
export async function proxy(request: NextRequest) {
  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set(
    "next",
    authDestination(request.nextUrl.pathname + request.nextUrl.search),
  );
  if (process.env.DEMO_MODE !== "false") {
    return request.cookies.has("roomly_session")
      ? NextResponse.next()
      : NextResponse.redirect(signIn);
  }
  let response = NextResponse.next({ request });
  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  const {
    data: { user },
  } = await db.auth.getUser();
  return user ? response : NextResponse.redirect(signIn);
}
export const config = {
  matcher: ["/home/:path*", "/manage/:path*", "/onboarding/:path*"],
};
