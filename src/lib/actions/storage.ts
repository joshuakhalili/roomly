"use server";

import { requireAdmin, type ActionResult } from "./helpers";
import { splitStoragePath } from "@/lib/retention";

/**
 * How long a signed link stays valid.
 *
 * Long enough to render a page and sit on screen while someone reads it,
 * short enough that a URL copied out of devtools is worthless by the time
 * anyone tries it.
 */
const SIGNED_URL_TTL_SECONDS = 600;

/**
 * Signs a batch of stored files, whatever buckets they happen to live in.
 *
 * `getPhotoUrls` in the inventory actions does this for one hard-wired
 * bucket, which is fine there and useless anywhere else. Every stored path
 * in this app is `"<bucket>/<path within bucket>"`, so the bucket can be read
 * off the path instead of passed in — and then a caller can hand over a mixed
 * list without knowing where anything lives.
 *
 * The returned map is keyed by the *original* stored path, so a caller looks
 * up by the value it already holds rather than reconstructing anything.
 */
export async function getSignedUrls(
  paths: string[],
): Promise<ActionResult<Record<string, string>>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (paths.length === 0) return { ok: true, data: {} };

  // Grouped per bucket: the storage API signs many paths in one call, but
  // only within a single bucket.
  const byBucket = new Map<string, string[]>();
  for (const stored of paths) {
    const ref = splitStoragePath(stored);
    if (!ref) continue;
    const list = byBucket.get(ref.bucket) ?? [];
    list.push(ref.path);
    byBucket.set(ref.bucket, list);
  }

  const map: Record<string, string> = {};
  for (const [bucket, keys] of byBucket) {
    const { data } = await auth.supabase.storage
      .from(bucket)
      .createSignedUrls(keys, SIGNED_URL_TTL_SECONDS);

    // A file that has gone missing signs as an error rather than throwing.
    // Skipping it leaves the caller with no entry for that path, which is
    // exactly what it needs to fall back to a placeholder.
    data?.forEach((entry, i) => {
      if (entry.signedUrl) map[`${bucket}/${keys[i]}`] = entry.signedUrl;
    });
  }

  return { ok: true, data: map };
}
