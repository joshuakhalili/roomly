import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { splitStoragePath } from "../retention";

/**
 * The retention periods themselves are enforced by SQL views and are checked
 * against real backdated data rather than here. What this file guards is the
 * one pure function standing between the erasure job and the storage API.
 */
describe("splitStoragePath", () => {
  test("splits a stored path into bucket and key", () => {
    assert.deepEqual(splitStoragePath("passports/abc/def.pdf"), {
      bucket: "passports",
      path: "abc/def.pdf",
    });
  });

  test("keeps the whole remainder as the key, including further slashes", () => {
    assert.deepEqual(splitStoragePath("inventory-photos/a/b/c/d.jpg"), {
      bucket: "inventory-photos",
      path: "a/b/c/d.jpg",
    });
  });

  // The dangerous cases. A value that parses to an empty key would be handed
  // to storage.remove() as a bucket-root reference; a leading slash would
  // name an empty bucket. Both have to come back null so the caller treats
  // the row as having no file rather than deleting something unintended.
  test("rejects a path with no bucket separator", () => {
    assert.equal(splitStoragePath("justafilename.pdf"), null);
  });

  test("rejects a bucket with an empty key", () => {
    assert.equal(splitStoragePath("passports/"), null);
  });

  test("rejects a leading slash, which would name an empty bucket", () => {
    assert.equal(splitStoragePath("/passports/a.pdf"), null);
  });

  test("rejects null and empty input", () => {
    assert.equal(splitStoragePath(null), null);
    assert.equal(splitStoragePath(""), null);
  });
});
