import { test } from "node:test";
import assert from "node:assert/strict";
import { database } from "./database";
test("all historical migrations apply without changes and keep RLS enabled", async () => {
  const db = await database();
  try {
    const result = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r'",
    );
    assert(result.rows.length > 30);
    assert.deepEqual(
      result.rows.filter((r) => !r.relrowsecurity),
      [],
    );
  } finally {
    await db.close();
  }
});
