import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { authDestination, authReturnPath } from "@/lib/auth/destination";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const destination = authDestination(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await (
      await supabase()
    ).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destination, req.url));
  }
  return NextResponse.redirect(
    new URL(authReturnPath(destination, "authentication"), req.url),
  );
}
