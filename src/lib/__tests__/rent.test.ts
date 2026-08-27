import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { generateDueDates, overduePayments, nextDueDate } from "../rent";
import type { RentPayment } from "../types";

describe("generateDueDates", () => {
  test("keeps a normal mid-month due day stable", () => {
    assert.deepEqual(
      generateDueDates({
        startDate: "2026-01-15",
        frequency: "monthly",
        rentDueDay: 15,
        horizon: new Date("2026-05-20"),
      }),
      ["2026-01-15", "2026-02-15", "2026-03-15", "2026-04-15", "2026-05-15"],
    );
  });

  test("clamps to the last day of short months without drifting afterwards", () => {
    // The bug this guards: clamping Jan 31 → Feb 28 and then adding a month
    // to *that* would pin every later month to the 28th. March must be 31st.
    assert.deepEqual(
      generateDueDates({
        startDate: "2026-01-31",
        frequency: "monthly",
        rentDueDay: 31,
        horizon: new Date("2026-07-15"),
      }),
      [
        "2026-01-31",
        "2026-02-28",
        "2026-03-31",
        "2026-04-30",
        "2026-05-31",
        "2026-06-30",
      ],
    );
  });

  test("starts the following month when the due day precedes move-in", () => {
    assert.deepEqual(
      generateDueDates({
        startDate: "2026-01-20",
        frequency: "monthly",
        rentDueDay: 1,
        horizon: new Date("2026-04-10"),
      }),
      ["2026-02-01", "2026-03-01", "2026-04-01"],
    );
  });

  test("handles weekly frequency", () => {
    assert.deepEqual(
      generateDueDates({
        startDate: "2026-03-02",
        frequency: "weekly",
        horizon: new Date("2026-03-30"),
      }),
      ["2026-03-02", "2026-03-09", "2026-03-16", "2026-03-23", "2026-03-30"],
    );
  });

  test("stops at the tenancy end date", () => {
    assert.deepEqual(
      generateDueDates({
        startDate: "2026-01-15",
        endDate: "2026-04-14",
        frequency: "monthly",
        rentDueDay: 15,
        horizon: new Date("2026-12-01"),
      }),
      ["2026-01-15", "2026-02-15", "2026-03-15"],
    );
  });
});

const payment = (over: Partial<RentPayment>): RentPayment => ({
  id: "1",
  tenancy_id: "t",
  due_date: "2026-01-15",
  amount_due: 800,
  status: "due",
  paid_at: null,
  notes: null,
  created_at: "",
  ...over,
});

describe("overduePayments", () => {
  test("does not flag a payment due today — the tenant still has the day", () => {
    const result = overduePayments(
      [payment({ due_date: "2026-01-15" })],
      new Date("2026-01-15T12:00:00"),
    );
    assert.equal(result.length, 0);
  });

  test("flags a payment once its due date has passed", () => {
    const result = overduePayments(
      [payment({ due_date: "2026-01-15" })],
      new Date("2026-01-16T09:00:00"),
    );
    assert.equal(result.length, 1);
  });

  test("ignores payments already marked paid", () => {
    const result = overduePayments(
      [payment({ due_date: "2026-01-15", status: "paid", paid_at: "2026-01-14" })],
      new Date("2026-02-01"),
    );
    assert.equal(result.length, 0);
  });
});

describe("nextDueDate", () => {
  test("returns the earliest outstanding payment", () => {
    assert.equal(
      nextDueDate([
        payment({ id: "b", due_date: "2026-03-15" }),
        payment({ id: "a", due_date: "2026-02-15" }),
        payment({ id: "p", due_date: "2026-01-15", status: "paid" }),
      ]),
      "2026-02-15",
    );
  });
});
