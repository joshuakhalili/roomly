import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { byName, naturalCompare } from "../utils";
import { bearerMatches } from "../security/bearer";
import { fetchAll } from "../supabase/fetch-all";

describe("byName", () => {
  test("puts Room 2 before Room 10", () => {
    const rooms = ["Room 10", "Room 2", "Room 1", "Kitchen", "Room 11"].map((name) => ({ name }));
    assert.deepEqual(
      byName(rooms).map((r) => r.name),
      ["Kitchen", "Room 1", "Room 2", "Room 10", "Room 11"],
    );
  });
  test("ignores case and tolerates null", () => {
    assert.equal(naturalCompare("flat a", "Flat A"), 0);
    assert.deepEqual(byName(null), []);
  });
  test("does not reorder the array it was given", () => {
    const input = [{ name: "B" }, { name: "A" }];
    byName(input);
    assert.equal(input[0].name, "B");
  });
});

describe("bearerMatches", () => {
  test("accepts only the exact header", () => {
    assert.equal(bearerMatches("Bearer s3cret", "s3cret"), true);
    assert.equal(bearerMatches("Bearer s3cre", "s3cret"), false);
    assert.equal(bearerMatches("s3cret", "s3cret"), false);
    assert.equal(bearerMatches(null, "s3cret"), false);
  });
});

describe("fetchAll", () => {
  const table = Array.from({ length: 2345 }, (_, i) => i);
  const page = (from: number, to: number) =>
    Promise.resolve({ data: table.slice(from, to + 1), error: null });

  test("reads past the 1,000 row page limit", async () => {
    const { data, error } = await fetchAll(page);
    assert.equal(error, null);
    assert.equal(data.length, 2345);
    assert.equal(data.at(-1), 2344);
  });
  test("stops on an exact multiple of the page size", async () => {
    let calls = 0;
    const exact = Array.from({ length: 2000 }, (_, i) => i);
    const { data } = await fetchAll((from, to) => {
      calls++;
      return Promise.resolve({ data: exact.slice(from, to + 1), error: null });
    });
    assert.equal(data.length, 2000);
    assert.equal(calls, 3);
  });
  test("returns the error with whatever was read before it", async () => {
    const { data, error } = await fetchAll((from, to) =>
      Promise.resolve(
        from === 0
          ? { data: table.slice(from, to + 1), error: null }
          : { data: null, error: { message: "timeout" } },
      ),
    );
    assert.equal(error, "timeout");
    assert.equal(data.length, 1000);
  });
});
