/**
 * Swaps the personal login for a demo one.
 *
 * This app is going on a public GitHub profile. A real email address sitting in
 * the auth table of a portfolio piece is the same category of mistake as a real
 * tenant's phone number sitting in the seed data — so the account that owns the
 * demo has to be an account that belongs to nobody.
 *
 *   node --env-file=.env.local ./node_modules/.bin/tsx scripts/set-demo-account.ts
 *
 * Order matters and is deliberate: the demo account is created and verified
 * *before* anything is removed. Every table in this app is behind an
 * `is_admin()` policy, so deleting the last login first would lock everyone —
 * including this script's own follow-up checks — out of the data entirely.
 *
 * The password is passed in, never written here. A credential committed to a
 * repository is a credential published, however harmless the data behind it.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@roomly.app";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
const REMOVE_EMAIL = process.env.REMOVE_EMAIL;
const ORGANIZATION_ID =
  process.env.DEMO_ORGANIZATION_ID ?? "00000000-0000-4000-8000-000000000001";

if (!url || !key) {
  console.error("Missing Supabase env vars — run with node --env-file=.env.local");
  process.exit(1);
}
if (!DEMO_PASSWORD) {
  console.error("Set DEMO_PASSWORD in the environment for this run.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

async function findUser(email: string) {
  // listUsers is paged; a handful of admins will never exceed one page, but
  // assuming that silently is how a lookup starts returning null by surprise.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function main() {
  // ── 1. The demo account ────────────────────────────────────────────────
  let demo = await findUser(DEMO_EMAIL);
  if (demo) {
    const { error } = await admin.auth.admin.updateUserById(demo.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        display_name: "Demo",
        organization_id: ORGANIZATION_ID,
        organization_role: "owner",
      },
    });
    if (error) throw new Error(error.message);
    console.log(`Updated existing demo account: ${DEMO_EMAIL}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      // No inbox exists for this address, so there is no confirmation mail to
      // click. Without this the account is created and cannot sign in.
      email_confirm: true,
      user_metadata: {
        display_name: "Demo",
        organization_id: ORGANIZATION_ID,
        organization_role: "owner",
      },
    });
    if (error) throw new Error(error.message);
    demo = data.user;
    console.log(`Created demo account: ${DEMO_EMAIL}`);
  }

  /* A trigger turns every new auth user into a profile, which is what grants
     admin access. Triggers fire on insert, so an account that predates the
     trigger — or one created some other way — would have no profile and would
     log in to a wall of empty tables. Check rather than hope. */
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email")
    .eq("id", demo!.id)
    .maybeSingle();

  if (!profile) {
    const { error } = await admin.from("profiles").insert({
      id: demo!.id,
      email: DEMO_EMAIL,
      display_name: "Demo",
      organization_id: ORGANIZATION_ID,
      role: "owner",
    });
    if (error) throw new Error(`profile: ${error.message}`);
    console.log("  created its profile row (the trigger had not)");
  } else {
    console.log("  profile row present");
  }

  // ── 2. Prove it works before removing anything ─────────────────────────
  const anon = createClient(url!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data: session, error: signInError } = await anon.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD!,
  });
  if (signInError || !session.session) {
    throw new Error(`Demo sign-in failed, nothing removed: ${signInError?.message}`);
  }
  // Reading through the signed-in client, not the service key: this is what
  // proves RLS actually lets this account see the data.
  const asUser = createClient(url!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${session.session.access_token}` } },
    auth: { persistSession: false },
  });
  const { count, error: readError } = await asUser
    .from("properties")
    .select("*", { count: "exact", head: true });
  if (readError) throw new Error(`Demo account cannot read data: ${readError.message}`);
  console.log(`  signed in and read ${count} properties through RLS`);

  // ── 3. Only now, remove the personal account ───────────────────────────
  if (!REMOVE_EMAIL) {
    console.log("\nREMOVE_EMAIL not set — leaving other accounts alone.");
    return;
  }
  const victim = await findUser(REMOVE_EMAIL);
  if (!victim) {
    console.log(`\n${REMOVE_EMAIL} is not an account here; nothing to remove.`);
    return;
  }
  if (victim.id === demo!.id) throw new Error("Refusing to delete the demo account.");

  const { error } = await admin.auth.admin.deleteUser(victim.id);
  if (error) throw new Error(error.message);
  console.log(`\nRemoved ${REMOVE_EMAIL} (its profile cascades with it).`);

  const { data: left } = await admin.from("profiles").select("email").order("created_at");
  console.log("Accounts now:", left?.map((p) => p.email).join(", "));
}

main().catch((err) => {
  console.error("\nFailed:", err.message);
  process.exit(1);
});
