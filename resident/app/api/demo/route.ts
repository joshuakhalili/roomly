import { authDestination } from "@/lib/auth/destination";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { environment } from "@/lib/env";
import { ID, hashToken } from "@/lib/demo/seed";
import { createDemoSession } from "@/lib/demo/store";
import { checkOrigin, failure, requestBase } from "@/lib/http";
export async function POST(req: Request) {
  if (!environment().demo) return new Response(null, { status: 404 });
  try {
    checkOrigin(req);
    const f = await req.formData();
    const identity = String(f.get("identity"));
    const ids: Record<string, string> = {
      manager: ID.manager,
      resident: ID.resident,
      newManager: ID.newManager,
      newResident: ID.newResident,
    };
    if (!ids[identity]) return new Response(null, { status: 400 });
    const token = randomBytes(32).toString("base64url");
    createDemoSession(hashToken(token), ids[identity]);
    const next = String(f.get("next") || "");
    const destination = next
      ? authDestination(next)
      : identity === "manager"
        ? "/manage"
        : identity === "newManager"
          ? "/onboarding/manager"
          : "/home";
    const response = NextResponse.redirect(
      new URL(destination, requestBase(req)),
      303,
    );
    response.cookies.set("roomly_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(req.url).protocol === "https:",
      path: "/",
      maxAge: 7 * 86400,
    });
    return response;
  } catch (e) {
    return failure(e);
  }
}
