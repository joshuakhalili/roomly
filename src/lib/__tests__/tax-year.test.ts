import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  taxYear,
  taxYearFor,
  isInTaxYear,
  recentTaxYears,
} from "../tax-year";

describe("taxYear", () => {
  test("runs 6 April to 5 April", () => {
    const y = taxYear(2025);
    assert.equal(y.start, "2025-04-06");
    assert.equal(y.end, "2026-04-05");
    assert.equal(y.label, "2025/26");
  });

  test("pads the second half of a turn-of-century label", () => {
    // 2009/10, not 2009/1 — the naive `% 100` without padding gets this wrong.
    assert.equal(taxYear(2009).label, "2009/10");
    assert.equal(taxYear(1999).label, "1999/00");
  });
});

describe("taxYearFor", () => {
  test("5 April belongs to the year that began the previous April", () => {
    assert.equal(taxYearFor("2026-04-05").startYear, 2025);
  });

  test("6 April starts the new one", () => {
    assert.equal(taxYearFor("2026-04-06").startYear, 2026);
  });

  test("handles either side of the boundary within one calendar year", () => {
    assert.equal(taxYearFor("2026-01-31").startYear, 2025);
    assert.equal(taxYearFor("2026-12-31").startYear, 2026);
  });

  test("ignores any time component on a timestamp", () => {
    assert.equal(taxYearFor("2026-04-05T23:59:59.000Z").startYear, 2025);
  });

  test("accepts a Date, reading it in local time", () => {
    // Constructed from parts rather than parsed, so this is the local 6 April
    // rather than a UTC instant that could be 5 April somewhere west.
    assert.equal(taxYearFor(new Date(2026, 3, 6)).startYear, 2026);
    assert.equal(taxYearFor(new Date(2026, 3, 5)).startYear, 2025);
  });
});

describe("isInTaxYear", () => {
  test("includes both ends", () => {
    const y = taxYear(2025);
    assert.equal(isInTaxYear("2025-04-06", y), true);
    assert.equal(isInTaxYear("2026-04-05", y), true);
  });

  test("excludes the days either side", () => {
    const y = taxYear(2025);
    assert.equal(isInTaxYear("2025-04-05", y), false);
    assert.equal(isInTaxYear("2026-04-06", y), false);
  });
});

describe("recentTaxYears", () => {
  test("counts backwards from the year containing today", () => {
    const years = recentTaxYears(3, new Date(2026, 8, 4));
    assert.deepEqual(
      years.map((y) => y.label),
      ["2026/27", "2025/26", "2024/25"],
    );
  });

  test("always returns at least one", () => {
    assert.equal(recentTaxYears(0, new Date(2026, 8, 4)).length, 1);
  });
});
