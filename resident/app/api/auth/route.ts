import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { checkOrigin, failure, requestBase } from "@/lib/http";
import { authDestination, authReturnPath } from "@/lib/auth/destination";
import { z } from "zod";
export async function POST(req: Request) {
  let destination = "/home";
  try {
    checkOrigin(req);
    const f = Object.fromEntries(await req.formData());
    destination = authDestination(String(f.next || ""), String(f.role || ""));
    const p = z
      .object({
        email: z.email(),
        password: z.string().min(1),
        mode: z.enum(["sign-in", "sign-up"]),
      })
      .refine((p) => p.mode !== "sign-up" || p.password.length >= 10, {
        path: ["password"],
        message: "New accounts require at least ten characters.",
      })
      .parse(f);
    const db = await supabase();
    const callback = new URL(
      "/auth/callback",
      process.env.NEXT_PUBLIC_SITE_URL,
    );
    callback.searchParams.set("next", destination);
    const { data, error } =
      p.mode === "sign-up"
        ? await db.auth.signUp({
            email: p.email,
            password: p.password,
            options: { emailRedirectTo: callback.toString() },
          })
        : await db.auth.signInWithPassword({
            email: p.email,
            password: p.password,
          });
    const next = error
      ? authReturnPath(destination, "authentication")
      : p.mode === "sign-up" && !data.session
        ? authReturnPath(destination, "email")
        : destination;
    return NextResponse.redirect(new URL(next, requestBase(req)), 303);
  } catch (e) {
    if (e instanceof z.ZodError)
      return NextResponse.redirect(
        new URL(authReturnPath(destination, "validation"), requestBase(req)),
        303,
      );
    return failure(e);
  }
}
