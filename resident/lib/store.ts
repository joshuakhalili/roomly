import "server-only";
import { environment } from "./env";
import { demoTransaction, readDemo } from "./demo/store";
import { emptyState, TABLES, type Actor, type State } from "./model";
import { supabase } from "./supabase/server";
export async function readState(): Promise<State> {
  if (environment().demo) return readDemo();
  const db = await supabase();
  const s = emptyState();
  const rows = await Promise.all(
    TABLES.map(async (table) => {
      const { data, error } = await db.from(table).select("*");
      if (error) throw new Error(`DATABASE_READ_FAILED:${table}`);
      return [table, data] as const;
    }),
  );
  for (const [table, data] of rows) Object.assign(s, { [table]: data });
  // Residents cannot select working content rows. A security-definer function returns only visible snapshots.
  const { data, error } = await db.rpc("resident_content");
  if (error) throw new Error("CONTENT_READ_FAILED");
  const existing = new Set(s.content_blocks.map((b) => b.id));
  s.content_blocks.push(
    ...(data || []).filter((b: { id: string }) => !existing.has(b.id)),
  );
  return s;
}
export async function transaction<T>(
  actor: Actor,
  fn: (s: State) => Promise<T>,
): Promise<T> {
  if (environment().demo) return demoTransaction(fn);
  const before = await readState();
  const after = structuredClone(before);
  const value = await fn(after);
  const changes = TABLES.flatMap((table) =>
    after[table]
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
  const { error } = await (
    await supabase()
  ).rpc("apply_roomly_changes", { changes });
  if (error)
    throw new Error(
      error.message.includes("CONTENT_VERSION_CONFLICT")
        ? "CONTENT_VERSION_CONFLICT"
        : "DATABASE_WRITE_FAILED",
    );
  return value;
}
