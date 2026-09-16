/** Live smoke test for the organisation boundary. Creates disposable records. */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) throw new Error("Missing Supabase environment variables.");

const admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
const marker = `${Date.now()}-${randomBytes(4).toString("hex")}`;
const email = `roomly-isolation-${marker}@example.invalid`;
const password = randomBytes(24).toString("base64url");
const legacyOrganizationId = "00000000-0000-4000-8000-000000000001";

let organizationId: string | undefined;
let userId: string | undefined;
let propertyId: string | undefined;
let storagePath: string | undefined;

async function main() {
  const { data: organization, error: organizationError } = await admin.rpc(
    "create_trial_organization",
    { org_name: "Isolation smoke test", org_slug: `isolation-${marker}` },
  );
  if (organizationError) throw organizationError;
  organizationId = organization as string;

  const { data: account, error: accountError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (accountError || !account.user) throw accountError ?? new Error("No test user.");
  userId = account.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    email,
    display_name: "Isolation test",
    organization_id: organizationId,
    role: "staff",
  });
  if (profileError) throw profileError;

  const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  const { count, error: readError } = await client
    .from("properties")
    .select("id", { count: "exact", head: true });
  if (readError) throw readError;
  if (count !== 0) throw new Error(`Cross-organisation read exposed ${count} properties.`);

  const { data: property, error: ownWriteError } = await client
    .from("properties")
    .insert({ name: "Isolation test property" })
    .select("id")
    .single();
  if (ownWriteError) throw ownWriteError;
  propertyId = property.id;

  const { error: foreignWriteError } = await client.from("properties").insert({
    organization_id: legacyOrganizationId,
    name: "Must not be written",
  });
  if (!foreignWriteError) throw new Error("Cross-organisation database write was accepted.");

  storagePath = `${organizationId}/isolation/${marker}.pdf`;
  const { error: ownStorageError } = await client.storage
    .from("handbooks")
    .upload(storagePath, Buffer.from("%PDF-1.4\n"), { contentType: "application/pdf" });
  if (ownStorageError) throw ownStorageError;

  const { error: foreignStorageError } = await client.storage
    .from("handbooks")
    .upload(`${legacyOrganizationId}/isolation/${marker}.pdf`, Buffer.from("%PDF-1.4\n"), {
      contentType: "application/pdf",
    });
  if (!foreignStorageError) throw new Error("Cross-organisation storage write was accepted.");

  console.log("Multi-tenant isolation smoke test passed.");
}

main()
  .finally(async () => {
    if (storagePath) await admin.storage.from("handbooks").remove([storagePath]);
    if (propertyId) await admin.from("properties").delete().eq("id", propertyId);
    if (userId) await admin.auth.admin.deleteUser(userId);
    if (organizationId) {
      for (const table of [
        "checklist_section_templates",
        "unit_area_defaults",
        "area_types",
        "message_templates",
        "app_settings",
        "retention_rules",
        "document_requirements",
        "service_types",
        "expense_categories",
      ]) {
        await admin.from(table).delete().eq("organization_id", organizationId);
      }
      await admin.from("organizations").delete().eq("id", organizationId);
    }
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
