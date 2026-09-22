import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { State } from "../model";
import { seed } from "./seed";
const globalStore = globalThis as typeof globalThis & {
  roomlyDb?: DatabaseSync;
  roomlyQueue?: Promise<unknown>;
};
function database() {
  if (!globalStore.roomlyDb) {
    const path = resolve(
      /* turbopackIgnore: true */ process.env.ROOMLY_DEMO_DB ||
        ".roomly/demo.sqlite",
    );
    mkdirSync(dirname(path), { recursive: true });
    const db = new DatabaseSync(path);
    db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS roomly_state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS demo_sessions (token_hash TEXT PRIMARY KEY, profile_id TEXT NOT NULL, expires_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS demo_files (id TEXT PRIMARY KEY, bytes BLOB NOT NULL);",
    );
    if (!db.prepare("SELECT id FROM roomly_state WHERE id=1").get())
      db.prepare("INSERT INTO roomly_state VALUES(1,?)").run(
        JSON.stringify(seed()),
      );
    globalStore.roomlyDb = db;
  }
  return globalStore.roomlyDb;
}
export function readDemo(): State {
  return JSON.parse(
    database().prepare("SELECT data FROM roomly_state WHERE id=1").get()!
      .data as string,
  );
}
export async function demoTransaction<T>(
  fn: (s: State) => Promise<T> | T,
): Promise<T> {
  const previous = globalStore.roomlyQueue || Promise.resolve();
  let unlock!: () => void;
  globalStore.roomlyQueue = new Promise<void>((r) => (unlock = r));
  await previous;
  const db = database();
  db.exec("BEGIN IMMEDIATE");
  try {
    const s = readDemo();
    const result = await fn(s);
    db.prepare("UPDATE roomly_state SET data=? WHERE id=1").run(
      JSON.stringify(s),
    );
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  } finally {
    unlock();
  }
}
export function createDemoSession(hash: string, id: string) {
  database()
    .prepare("INSERT INTO demo_sessions VALUES(?,?,?)")
    .run(hash, id, Date.now() + 7 * 86400000);
}
export function demoSession(hash: string) {
  return database()
    .prepare(
      "SELECT profile_id FROM demo_sessions WHERE token_hash=? AND expires_at>?",
    )
    .get(hash, Date.now())?.profile_id as string | undefined;
}
export function storeDemoFile(id: string, bytes: Uint8Array) {
  database().prepare("INSERT INTO demo_files VALUES(?,?)").run(id, bytes);
}
export function readDemoFile(id: string) {
  return database().prepare("SELECT bytes FROM demo_files WHERE id=?").get(id)
    ?.bytes as Uint8Array | undefined;
}
