import { z } from "zod";
export function environment() {
  const demo = process.env.DEMO_MODE !== "false";
  if (!demo)
    z.object({
      NEXT_PUBLIC_SUPABASE_URL: z.url(),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
      OPENAI_API_KEY: z.string().min(20),
      NEXT_PUBLIC_SITE_URL: z.url(),
    }).parse(process.env);
  if (process.env.VERCEL && demo)
    throw new Error(
      "Set DEMO_MODE=false for a public Vercel deployment. Demo identities are for local review only.",
    );
  return { demo };
}
