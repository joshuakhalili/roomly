import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { generateJobDates } from "../jobs";

describe("generateJobDates", () => {
  test("weekly lands on the chosen day, not the start date", () => {
    // Starts Wednesday 7 Jan 2026, but the cleaner comes on Tuesdays.
    assert.deepEqual(
      generateJobDates({
        startsOn: "2026-01-07",
        frequency: "weekly",
        dayOfWeek: 2,
        horizon: new Date("2026-02-05"),
      }),
      ["2026-01-13", "2026-01-20", "2026-01-27", "2026-02-03"],
    );
  });

  test("fortnightly skips a week", () => {
    assert.deepEqual(
      generateJobDates({
        startsOn: "2026-01-05",
        frequency: "fortnightly",
        dayOfWeek: 1,
        horizon: new Date("2026-03-05"),
      }),
      ["2026-01-05", "2026-01-19", "2026-02-02", "2026-02-16", "2026-03-02"],
    );
  });

  test("clamps to the last day of short months without dragging later ones", () => {
    // The bug this guards: clamping Jan 31 to Feb 28 and then adding a month
    // to that gives Mar 28, and every month after stays wrong. March has a
    // 31st, so March must come back to it.
    assert.deepEqual(
      generateJobDates({
        startsOn: "2026-01-31",
        frequency: "monthly",
        dayOfMonth: 31,
        horizon: new Date("2026-05-15"),
      }),
      ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"],
    );
  });

  test("stops at the end date — a season that is over generates nothing", () => {
    // Grounds work, fortnightly through summer only.
    assert.deepEqual(
      generateJobDates({
        startsOn: "2026-04-06",
        endsOn: "2026-05-04",
        frequency: "fortnightly",
        dayOfWeek: 1,
        horizon: new Date("2026-12-31"),
      }),
      ["2026-04-06", "2026-04-20", "2026-05-04"],
    );
  });

  test("a finished season produces nothing at all when topping up later", () => {
    assert.deepEqual(
      generateJobDates({
        startsOn: "2025-04-07",
        endsOn: "2025-09-29",
        frequency: "fortnightly",
        dayOfWeek: 1,
        horizon: new Date("2026-12-31"),
        from: new Date("2026-08-28"),
      }),
      [],
    );
  });

  test("`from` tops up ahead without regenerating the past", () => {
    const dates = generateJobDates({
      startsOn: "2026-01-05",
      frequency: "weekly",
      dayOfWeek: 1,
      horizon: new Date("2026-03-10"),
      from: new Date("2026-03-01"),
    });
    assert.deepEqual(dates, ["2026-03-02", "2026-03-09"]);
  });

  test("monthly with no explicit day uses the start date's day", () => {
    assert.deepEqual(
      generateJobDates({
        startsOn: "2026-01-15",
        frequency: "monthly",
        dayOfMonth: null,
        horizon: new Date("2026-04-01"),
      }),
      ["2026-01-15", "2026-02-15", "2026-03-15"],
    );
  });
});
