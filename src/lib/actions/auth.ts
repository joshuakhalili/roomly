"use server";

import { createHmac, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./helpers";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(1024),
});

function visitorIp(requestHeaders: Headers): string {
  const raw =
    requestHeaders.get("x-vercel-forwarded-for") ??
    requestHeaders.get("x-forwarded-for") ??
    "unknown";
  return raw.split(",")[0].trim().slice(0, 128) || "unknown";
}

function attemptKey(kind: "ip" | "account", value: string): string {
  // A keyed digest keeps email addresses and IP addresses out of the table,
  // including values that would otherwise be easy to reverse with a lookup.
  const secret =
    process.env.LOGIN_RATE_LIMIT_SECRET ??
    process.env.CRON_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("No server secret is available for login throttling.");
  return `${kind}:${createHmac("sha256", secret).update(value).digest("hex")}`;
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!secret && !siteKey) return true;
  if (!secret || !siteKey || !token || token.length > 2048) return false;

  try {
    const body = new FormData();
    body.set("secret", secret);
    body.set("response", token);
    body.set("remoteip", ip);
    body.set("idempotency_key", randomUUID());

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body, signal: AbortSignal.timeout(8_000) },
    );
    if (!response.ok) return false;

    const result = (await response.json()) as {
      success?: boolean;
      action?: string;
      hostname?: string;
    };
    if (!result.success || result.action !== "login") return false;

    const expectedHostname = process.env.TURNSTILE_EXPECTED_HOSTNAME;
    return !expectedHostname || result.hostname === expectedHostname;
  } catch {
    // Bot verification fails closed when it has been configured.
    return false;
  }
}

export async function login(formData: FormData): Promise<ActionResult> {
  // A normal user never sees or fills this honeypot. It cheaply rejects the
  // broad class of bots that submit every named field, even before Turnstile
  // has been configured for a public deployment.
  if (String(formData.get("website") ?? "").trim())
    return { ok: false, error: "The email or password is incorrect." };

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success)
    return { ok: false, error: "Enter a valid email address and password." };

  const ip = visitorIp(await headers());
  const ipKey = attemptKey("ip", ip);
  const accountKey = attemptKey("account", `${ip}\n${parsed.data.email}`);
  const admin = createAdminClient();
  const { data: allowed, error: throttleError } = await admin.rpc(
    "consume_login_attempt",
    { p_ip_key: ipKey, p_account_key: accountKey },
  );

  if (throttleError || allowed !== true)
    return {
      ok: false,
      error: "Too many sign-in attempts. Wait 15 minutes and try again.",
    };

  const captchaToken = String(formData.get("cf-turnstile-response") ?? "");
  if (!(await verifyTurnstile(captchaToken, ip)))
    return { ok: false, error: "Please complete the security check and try again." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Deliberately identical for unknown users and wrong passwords.
    return { ok: false, error: "The email or password is incorrect." };
  }

  await admin.rpc("clear_login_account_attempts", {
    p_account_key: accountKey,
  });
  return { ok: true, data: undefined };
}
