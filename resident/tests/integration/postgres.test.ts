import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { seed, ID } from "../../lib/demo/seed";
import { TABLES } from "../../lib/model";
let db: PGlite;
const otherRoom = "30000000-0000-4000-8000-000000000002";
async function asUser(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.query("select set_config('request.jwt.claim.email',$1,false)", [
    "demo@example.org",
  ]);
  await db.exec("set role authenticated");
}
beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email',current_setting('request.jwt.claim.email',true)) $$; grant usage on schema auth to authenticated,anon; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;`,
  );
  for (const name of readdirSync("supabase/migrations").sort())
    await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
  const s = seed();
  const seedSql = [
    "-- Fictional demo data for local Supabase only. Never load into a customer project.",
  ];
  for (const p of s.profiles) {
    await db.query("insert into auth.users(id) values($1)", [p.id]);
    seedSql.push(
      `insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('${p.id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${p.id.slice(-1)}@roomly.example',crypt('Roomly-local-only-2026',gen_salt('bf')),now(),'{}','{}',now(),now()) on conflict(id) do nothing;`,
    );
  }
  for (const table of TABLES)
    for (const row of s[table]) {
      const columns = Object.keys(row);
      const update = columns
        .filter((c) => c !== "id")
        .map((c) => `"${c}"=excluded."${c}"`)
        .join(",");
      await db.query(
        `insert into public.${table} select * from jsonb_populate_record(null::public.${table},$1) on conflict(id) do update set ${update}`,
        [JSON.stringify(row)],
      );
      seedSql.push(
        `insert into public.${table} select * from jsonb_populate_record(null::public.${table},'${JSON.stringify(row).replaceAll("'", "''")}'::jsonb) on conflict(id) do nothing;`,
      );
    }
  await db.exec(
    `insert into rooms select '${otherRoom}',created_at,updated_at,property_id,'Other room',capacity,manager_contact_json,emergency_contact_json,default_locale,supported_locales,languages_reviewed from rooms limit 1;`,
  );
  if (process.env.GENERATE_FIXTURES === "true") {
    writeFileSync("supabase/seed.sql", seedSql.join("\n") + "\n");
    const columns = await db.query<{
      table_name: string;
      column_name: string;
      data_type: string;
      udt_name: string;
      is_nullable: string;
    }>(
      "select table_name,column_name,data_type,udt_name,is_nullable from information_schema.columns where table_schema='public' order by table_name,ordinal_position",
    );
    const map = (c: (typeof columns.rows)[number]) => {
      const t =
        c.data_type === "ARRAY"
          ? "string[]"
          : c.udt_name === "jsonb"
            ? "Json"
            : c.data_type === "boolean"
              ? "boolean"
              : /integer|numeric|bigint/.test(c.data_type)
                ? "number"
                : "string";
      return t + (c.is_nullable === "YES" ? " | null" : "");
    };
    let types =
      "// Generated from the applied PostgreSQL migrations (PGlite introspection).\nexport type Json = string | number | boolean | null | { [key:string]: Json | undefined } | Json[];\nexport type Database = { public: { Tables: {\n";
    for (const table of TABLES) {
      types += `${table}: { Row: {\n`;
      for (const c of columns.rows.filter((c) => c.table_name === table))
        types += `${c.column_name}: ${map(c)};\n`;
      types +=
        '}; Insert: Partial<Database["public"]["Tables"]["' +
        table +
        '"]["Row"]>; Update: Partial<Database["public"]["Tables"]["' +
        table +
        '"]["Row"]>; Relationships: [] };\n';
    }
    types +=
      "}; Views: Record<string,never>; Functions: Record<string,{Args:Record<string,unknown>;Returns:Json}>; Enums: Record<string,never>; CompositeTypes: Record<string,never> } };\n";
    writeFileSync("lib/supabase/database.types.ts", types);
  }
});
afterAll(async () => {
  await db?.close();
});
describe("actual PostgreSQL migrations and RLS", () => {
  it("enables RLS on every public table", async () => {
    await db.exec("reset role");
    const result = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r'",
    );
    expect(result.rows).toHaveLength(20);
    expect(result.rows.every((r) => r.relrowsecurity)).toBe(true);
  });
  it("resident cannot select working drafts or other room", async () => {
    await asUser(ID.resident);
    expect((await db.query("select * from content_blocks")).rows).toHaveLength(
      0,
    );
    expect((await db.query("select * from rooms")).rows).toHaveLength(1);
    expect((await db.query("select resident_content()")).rows).toHaveLength(16);
  });
  it("outsider cannot read organisation, rooms, memberships or content", async () => {
    await asUser(ID.newResident);
    for (const table of [
      "organisations",
      "properties",
      "rooms",
      "memberships",
      "content_blocks",
      "maintenance_requests",
    ])
      expect((await db.query(`select * from ${table}`)).rows).toHaveLength(0);
    expect((await db.query("select resident_content()")).rows).toHaveLength(0);
  });
  it("cross-room question insert is rejected", async () => {
    await asUser(ID.resident);
    await expect(
      db.query(
        "insert into question_logs(membership_id,room_id,question_redacted,category,outcome) values($1,$2,'x','x','unknown')",
        [ID.membership, otherRoom],
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("cross-organisation manager cannot write another home", async () => {
    await asUser(ID.newManager);
    await expect(
      db.query(
        "insert into invites(room_id,created_by,token_hash,expires_at) values($1,$2,'x',now()+interval '1 day')",
        [ID.room, ID.newManager],
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("resident cannot forge acknowledgement version", async () => {
    await asUser(ID.resident);
    await expect(
      db.query(
        "insert into acknowledgements(membership_id,content_block_id,content_version) values($1,$2,999)",
        [ID.membership, "50000000-0000-4000-8000-000000000008"],
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("safe invite resolver exposes only preview fields and claim is single-use", async () => {
    await db.exec("reset role");
    await db.query(
      "insert into invites(room_id,created_by,token_hash,expires_at) values($1,$2,encode(digest($3,'sha256'),'hex'),now()+interval '1 day')",
      [ID.room, ID.manager, "test-token-for-postgres-claim-0000000000"],
    );
    await asUser(ID.newResident);
    const preview = await db.query<{ value: Record<string, unknown> }>(
      "select resolve_invite('test-token-for-postgres-claim-0000000000') as value",
    );
    expect(Object.keys(preview.rows[0].value).sort()).toEqual([
      "expiresAt",
      "inviter",
      "propertyName",
      "welcome",
    ]);
    await db.query(
      "select claim_invite('test-token-for-postgres-claim-0000000000')",
    );
    await expect(
      db.query(
        "select claim_invite('test-token-for-postgres-claim-0000000000')",
      ),
    ).rejects.toThrow("INVITE_UNAVAILABLE");
  });
  it("resident repair visibility and internal event denial", async () => {
    await asUser(ID.newResident);
    expect(
      (await db.query("select * from maintenance_requests")).rows,
    ).toHaveLength(0);
    await asUser(ID.resident);
    expect(
      (await db.query("select * from maintenance_requests")).rows,
    ).toHaveLength(1);
  });
  it("full-text retrieval stays within the active home", async () => {
    await asUser(ID.resident);
    const own = await db.query("select search_home_content($1,$2)", [
      ID.room,
      "bins",
    ]);
    expect(own.rows.length).toBeGreaterThan(0);
    expect(
      (await db.query("select search_home_content($1,$2)", [otherRoom, "bins"]))
        .rows,
    ).toHaveLength(0);
  });
  it("atomic change sets reject invalid content versions", async () => {
    await asUser(ID.manager);
    const row = (
      await db.query<Record<string, unknown>>(
        "select * from content_blocks limit 1",
      )
    ).rows[0];
    await expect(
      db.query("select apply_roomly_changes($1)", [
        JSON.stringify([
          { table: "content_blocks", row, before: { ...row, version: 999 } },
        ]),
      ]),
    ).rejects.toThrow("CONTENT_VERSION_CONFLICT");
  });
});

describe("domain transactions executed through PostgreSQL RLS", () => {
  it("persists manager onboarding and publishes a separate organisation through the same change-set function", async () => {
    const { execute } = await import("../../lib/domain");
    const { DemoAIProvider } = await import("../../lib/ai/provider");
    const s = seed();
    const actor = { id: ID.newManager };
    const provider = new DemoAIProvider();
    await asUser(actor.id);
    for (const [step, values] of [
      [0, {}],
      [1, { organisationName: "Separate organisation", managerName: "Alex" }],
      [
        2,
        {
          propertyName: "Separate property",
          address: "20 Example Road",
          city: "Cambridge",
          postcode: "CB1 2AB",
        },
      ],
      [
        3,
        {
          roomName: "Room A",
          capacity: "4",
          managerPhone: "07700 900111",
          emergencyPhone: "07700 900112",
        },
      ],
      [4, { notes: "Bins are collected on Tuesday." }],
      [5, {}],
      [6, {}],
    ] as [number, Record<string, string>][]) {
      const before = structuredClone(s);
      await execute(
        s,
        actor,
        "saveManagerOnboardingStep",
        { step, values, advance: true },
        provider,
      );
      const changes = TABLES.flatMap((table) =>
        s[table]
          .filter(
            (row) =>
              JSON.stringify(row) !==
              JSON.stringify(before[table].find((old) => old.id === row.id)),
          )
          .map((row) => ({
            table,
            row,
            before: before[table].find((old) => old.id === row.id) || null,
          })),
      );
      await db.query("select apply_roomly_changes($1)", [
        JSON.stringify(changes),
      ]);
    }
    expect((await db.query("select * from organisations")).rows).toHaveLength(
      1,
    );
    expect(
      (await db.query("select * from manager_onboarding")).rows[0],
    ).toMatchObject({ step: 7, completed: true });
    expect((await db.query("select resident_content()")).rows).toHaveLength(0);
    await expect(
      db.query(
        "insert into invites(room_id,created_by,token_hash,expires_at) values($1,$2,'other-org-token',now()+interval '1 day')",
        [ID.room, actor.id],
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("translation publication through RLS", () => {
  it("does not expose a draft translation and serves the released locale snapshot", async () => {
    await asUser(ID.manager);
    await db.query(
      "update translations set body='PRIVATE TRANSLATION DRAFT',status='draft' where locale='zh-CN'",
    );
    await asUser(ID.resident);
    await db.query("update profiles set locale='zh-CN' where id=$1", [
      ID.resident,
    ]);
    expect((await db.query("select * from translations")).rows).toHaveLength(0);
    const visible = await db.query("select resident_content()");
    expect(JSON.stringify(visible.rows)).toContain("垃圾");
    expect(JSON.stringify(visible.rows)).not.toContain(
      "PRIVATE TRANSLATION DRAFT",
    );
    await db.query("update profiles set locale='en-GB' where id=$1", [
      ID.resident,
    ]);
  });
});
