import { test } from "node:test";
import assert from "node:assert/strict";
import { inventoryPatch } from "../inventory-patch";
test("editing a cleanliness rating retains condition, notes and repair flag", () => {
  const previous = {
    condition_rating: "good",
    cleanliness_rating: "fair",
    description: "Mark near the window",
    flagged_for_maintenance: true,
  };
  const result = inventoryPatch({ cleanliness_rating: "excellent" });
  assert.equal(result.ok, true);
  if (result.ok)
    assert.deepEqual(
      { ...previous, ...result.data },
      { ...previous, cleanliness_rating: "excellent" },
    );
});
test("explicit null, empty notes and false are valid clearing operations", () => {
  const result = inventoryPatch({
    condition_rating: null,
    description: "  ",
    flagged_for_maintenance: false,
  });
  assert.deepEqual(result, {
    ok: true,
    data: {
      condition_rating: null,
      description: null,
      flagged_for_maintenance: false,
    },
  });
});
test("inventory patches reject invalid fields and cannot update ownership", () => {
  assert.equal(inventoryPatch({ condition_rating: "invalid" }).ok, false);
  assert.equal(inventoryPatch({ description: 123 }).ok, false);
  assert.equal(inventoryPatch({ flagged_for_maintenance: "true" }).ok, false);
  assert.equal(inventoryPatch({ organization_id: "other-org" }).ok, false);
  assert.deepEqual(
    inventoryPatch({ condition_rating: "good", organization_id: "other-org" }),
    { ok: true, data: { condition_rating: "good" } },
  );
});
