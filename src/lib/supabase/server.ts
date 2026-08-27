import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Reads the signed-in user's session from cookies, so queries run as that
 * admin and Row Level Security applies normally.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components can't set cookies. Harmless here: the
            // middleware refreshes the session on every request anyway.
          }
        },
      },
    },
  );
}

/**
 * Privileged client that BYPASSES Row Level Security entirely.
 *
 * Only for operations that genuinely cannot run as a normal user:
 * creating admin accounts, and the scheduled cron jobs (which run with no
 * session at all). Never import this into a Client Component — the service
 * role key must never reach the browser.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });
}
