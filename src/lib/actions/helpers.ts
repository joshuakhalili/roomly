import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Every mutation goes through here.
 *
 * Row Level Security already blocks unauthenticated writes at the database,
 * but checking here too means a signed-out request fails fast with a clear
 * message instead of a confusing Postgres policy error — defence in depth,
 * not a replacement for it.
 */
export async function requireAdmin(): Promise<
  { ok: true; supabase: SupabaseClient; userId: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not signed in." };
  return { ok: true, supabase, userId: user.id };
}

/**
 * Turns a Postgres error into something an admin can act on.
 * Raw driver messages ("violates foreign key constraint …") are noise to
 * someone who just wants to know what went wrong.
 */
export function friendlyError(error: { code?: string; message: string }): string {
  switch (error.code) {
    case "23505":
      return "That already exists.";
    case "23503":
      return "That refers to something which no longer exists.";
    case "42501":
      return "You do not have permission to do that.";
    default:
      return error.message;
  }
}

/** Reads an optional text field, converting blanks to null for the database. */
export function optionalText(value: FormDataEntryValue | null): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "" ? null : text;
}

/** Reads an optional number field, returning null when blank or invalid. */
export function optionalNumber(value: FormDataEntryValue | null): number | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (text === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalises a UK-or-international phone number to E.164 (+447700900000).
 *
 * This matters beyond tidiness: the WhatsApp reminder link (wa.me/<number>)
 * silently fails on anything else, so a number saved as "07700 900000"
 * would produce a dead button rather than an error.
 */
export function normalisePhone(input: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed === "") return null;

  const digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  // A leading 0 is a national trunk prefix; assume UK and swap it for +44.
  if (digits.startsWith("0")) return `+44${digits.slice(1)}`;
  if (digits.startsWith("44")) return `+${digits}`;
  return `+${digits}`;
}
