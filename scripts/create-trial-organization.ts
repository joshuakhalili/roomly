/**
 * Creates one isolated trial business and its owner login.
 *
 * Example:
 *   TRIAL_PASSWORD='a-long-one-off-password' npm run create-trial -- \
 *     --name 'Acme Lettings' --slug acme-lettings --email owner@example.com
 *
 * The password is intentionally an environment variable so it never lands in
 * shell history, source control, or this file.
 */
import { createClient } from "@supabase/supabase-js";

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.TRIAL_PASSWORD;
const name = argument("name");
const slug = argument("slug")?.toLowerCase();
const email = argument("email")?.toLowerCase();

if (!url || !key) {
  console.error("Missing Supabase environment variables. Run with --env-file=.env.local.");
  process.exit(1);
}
if (!name || !slug || !email || !password) {
  console.error(
    "Required: --name, --slug, --email and the TRIAL_PASSWORD environment variable.",
  );
  process.exit(1);
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error("The slug may contain lowercase letters, numbers and single hyphens.");
  process.exit(1);
}
if (password.length < 12) {
  console.error("TRIAL_PASSWORD must be at least 12 characters.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: existing, error: lookupError } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", slug!)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);

  let organizationId = existing?.id as string | undefined;
  if (!organizationId) {
    const { data, error } = await admin.rpc("create_trial_organization", {
      org_name: name,
      org_slug: slug,
    });
    if (error) throw new Error(`organization: ${error.message}`);
    organizationId = data as string;
  }

  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: name,
      organization_id: organizationId,
      organization_role: "owner",
    },
  });
  if (userError) throw new Error(`owner account: ${userError.message}`);
  if (!created.user) throw new Error("Supabase did not return the owner account.");

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    email,
    display_name: name,
    organization_id: organizationId,
    role: "owner",
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    throw new Error(`owner profile: ${profileError.message}`);
  }

  console.log(`Trial ready: ${name}`);
  console.log(`Owner: ${created.user?.email}`);
  console.log(`Organization: ${organizationId}`);
  console.log("Storage allowance: 100MB");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
