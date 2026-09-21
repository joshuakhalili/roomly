import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
export async function database() {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(readFileSync("tests/integration/supabase-shims.sql", "utf8"));
    for (const name of readdirSync("supabase/migrations")
      .filter((name) => name.endsWith(".sql"))
      .sort()) {
      await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
    }
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
export async function identity(
  db: PGlite,
  id: string,
  email = "resident@example.test",
) {
  await db.exec("reset role");
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.email',$2,false),set_config('request.jwt.claim.role','authenticated',false)",
    [id, email],
  );
  await db.exec("set role authenticated");
}
