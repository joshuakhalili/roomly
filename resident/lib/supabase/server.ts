import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
export async function supabase() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          try {
            values.forEach((v) => jar.set(v.name, v.value, v.options));
          } catch {
            /* RSC cannot refresh cookies; auth routes can. */
          }
        },
      },
    },
  );
}
