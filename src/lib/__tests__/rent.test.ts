import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  generateDueDates,
  buildRentRows,
  overduePayments,
  nextDueDate,
} from "../rent";
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

describe("buildRentRows", () => {
  const horizon = new Date("2026-05-20");

  const stay = {
    id: "t1",
    start_date: "2026-06-01",
    end_date: "2026-06-05",
    rent_frequency: "total" as const,
    rent_due_day: null,
    rent_amount: 400,
  };

  test("a short stay with a deposit produces a holding charge and a balance", () => {
    assert.deepEqual(
      buildRentRows(
        { ...stay, deposit_amount: 100, balance_due_date: "2026-05-25" },
        horizon,
      ),
      [
        { tenancy_id: "t1", due_date: "2026-06-01", amount_due: 100, status: "due" },
        { tenancy_id: "t1", due_date: "2026-05-25", amount_due: 400, status: "due" },
      ],
    );
  });

  test("with no balance date the whole thing falls due on arrival", () => {
    assert.deepEqual(buildRentRows({ ...stay, deposit_amount: null }, horizon), [
      { tenancy_id: "t1", due_date: "2026-06-01", amount_due: 400, status: "due" },
    ]);
  });

  test("folds both charges into one row when they land on the same day", () => {
    // Two rows on one date would collide on the (tenancy_id, due_date) unique
    // constraint and the second would be silently dropped — leaving the guest
    // charged the deposit and nothing else.
    assert.deepEqual(
      buildRentRows(
        { ...stay, deposit_amount: 100, balance_due_date: "2026-06-01" },
        horizon,
      ),
      [
        { tenancy_id: "t1", due_date: "2026-06-01", amount_due: 500, status: "due" },
      ],
    );
  });

  test("a short stay never generates a recurring series", () => {
    const rows = buildRentRows(
      { ...stay, start_date: "2026-01-01", end_date: "2026-01-04" },
      horizon,
    );
    assert.equal(rows.length, 1);
  });

  test("a long tenancy still gets its recurring schedule", () => {
    const rows = buildRentRows(
      {
        id: "t2",
        start_date: "2026-01-15",
        end_date: null,
        rent_frequency: "monthly",
        rent_due_day: 15,
        rent_amount: 750,
      },
      horizon,
    );
    assert.deepEqual(
      rows.map((r) => r.due_date),
      ["2026-01-15", "2026-02-15", "2026-03-15", "2026-04-15", "2026-05-15"],
    );
    assert.equal(rows.every((r) => r.amount_due === 750), true);
  });
});
