import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Checks an `Authorization: Bearer <secret>` header without leaking, through
 * response timing, how many leading characters of a guess were right. Both
 * sides are hashed first so the comparison is always the same length.
 */
export function bearerMatches(header: string | null, secret: string) {
  if (!header) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}
