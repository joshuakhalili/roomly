import assert from "node:assert/strict";
import test from "node:test";
import { organizationStoragePath } from "../organization";

const ORGANIZATION_ID = "f25b6452-d2dd-4afb-8614-bd7905e19177";

test("storage paths are rooted in the organization", () => {
  assert.equal(
    organizationStoragePath(ORGANIZATION_ID, "property", "abc", "photo.jpg"),
    `${ORGANIZATION_ID}/property/abc/photo.jpg`,
  );
});

test("storage paths reject invalid organization ids", () => {
  assert.throws(
    () => organizationStoragePath("not-an-org", "photo.jpg"),
    /Invalid organization id/,
  );
});

test("storage paths reject traversal", () => {
  assert.throws(
    () => organizationStoragePath(ORGANIZATION_ID, "../private"),
    /Invalid storage path/,
  );
});
