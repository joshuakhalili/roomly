import {
  addDays,
  addMonths,
  getDaysInMonth,
  isAfter,
  parseISO,
  setDate,
  startOfDay,
} from "date-fns";
import type { RentFrequency, RentPayment } from "./types";

/** Format a Date as the YYYY-MM-DD string Postgres `date` columns expect. */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * The rent due date in a given month, clamped to that month's length.
 *
 * A tenant who moved in on the 31st has no 31st in February — without
 * clamping, `setDate(31)` on February rolls forward into March and every
 * subsequent due date drifts. Clamping keeps them on the last day instead.
 */
function dueDateInMonth(monthAnchor: Date, dueDay: number): Date {
  return setDate(monthAnchor, Math.min(dueDay, getDaysInMonth(monthAnchor)));
}

/**
 * Rent due dates for a tenancy, from its start up to `horizon`.
 *
 * Dates are generated rather than stored as a recurrence rule so each period
 * gets a real row that "mark as paid" can update.
 */
export function generateDueDates({
  startDate,
  endDate,
  frequency,
  rentDueDay,
  horizon,
}: {
  startDate: string;
  endDate?: string | null;
  frequency: RentFrequency;
  rentDueDay?: number | null;
  horizon: Date;
}): string[] {
  /* A one-off total has no cadence to walk, and the interval fallback below
     would quietly treat it as four-weekly. buildRentRows handles this case
     properly; refusing it here stops a direct caller inventing a series of
     charges nobody agreed to. */
  if (frequency === "total") return [];

  const start = startOfDay(parseISO(startDate));
  const end = endDate ? startOfDay(parseISO(endDate)) : null;
  const limit = end && isAfter(horizon, end) ? end : horizon;

  const dates: string[] = [];

  if (frequency === "monthly") {
    // Anchor to the explicit due day if set, otherwise the move-in day.
    const dueDay = rentDueDay ?? start.getDate();
    let cursor = dueDateInMonth(start, dueDay);

    // If the first due date lands before move-in (e.g. moved in on the 20th
    // with rent due on the 1st), the first payment is the following month.
    if (cursor < start) cursor = dueDateInMonth(addMonths(start, 1), dueDay);

    let monthOffset = 0;
    const base = cursor;
    while (cursor <= limit) {
      dates.push(toDateString(cursor));
      monthOffset += 1;
      // Recompute from the original anchor each time rather than adding a
      // month to the previous (already clamped) date — otherwise a February
      // clamp to the 28th would permanently drag every later month to the 28th.
      cursor = dueDateInMonth(addMonths(base, monthOffset), dueDay);
    }
    return dates;
  }

  const intervalDays =
    frequency === "weekly" ? 7 : frequency === "fortnightly" ? 14 : 28;

  let cursor = start;
  while (cursor <= limit) {
    dates.push(toDateString(cursor));
    cursor = addDays(cursor, intervalDays);
  }
  return dates;
}

/** What a tenancy needs to expose for its rent rows to be worked out. */
export interface RentSchedulable {
  id: string;
  start_date: string;
  end_date: string | null;
  rent_frequency: RentFrequency;
  rent_due_day: number | null;
  rent_amount: number;
  deposit_amount?: number | null;
  balance_due_date?: string | null;
}

/** A row as `rent_payments` stores it. */
export interface RentRow {
  tenancy_id: string;
  due_date: string;
  amount_due: number;
  status: "due";
}

/**
 * The rent rows a tenancy should have, up to `horizon`.
 *
 * This exists because the same schedule was being built independently in two
 * places — the tenancy action and the nightly cron — which is one copy too
 * many for logic that decides what someone gets charged. Pure, so it can be
 * tested without a database; both callers do their own upsert.
 *
 * Idempotent by construction: the (tenancy_id, due_date) unique constraint
 * means re-running turns into a no-op for periods that already exist.
 */
export function buildRentRows(
  tenancy: RentSchedulable,
  horizon: Date,
): RentRow[] {
  /* A short stay is not a recurrence, so it does not go through the date
     generator at all. It is at most two charges: whatever is taken to hold
     the booking, and the balance. Running it through generateDueDates would
     invent a series of monthly charges for a four-night stay. */
  if (tenancy.rent_frequency === "total") {
    const rows: RentRow[] = [];

    if (tenancy.deposit_amount) {
      rows.push({
        tenancy_id: tenancy.id,
        due_date: tenancy.start_date,
        amount_due: tenancy.deposit_amount,
        status: "due",
      });
    }

    const balanceDue = tenancy.balance_due_date ?? tenancy.start_date;

    /* Both charges landing on the same day is one charge, not two rows the
       unique constraint would silently collapse into whichever arrived
       first. Fold them together so the amount is right either way. */
    const sameDay = rows.length > 0 && rows[0].due_date === balanceDue;
    if (sameDay) {
      rows[0].amount_due += tenancy.rent_amount;
    } else {
      rows.push({
        tenancy_id: tenancy.id,
        due_date: balanceDue,
        amount_due: tenancy.rent_amount,
        status: "due",
      });
    }

    return rows;
  }

  return generateDueDates({
    startDate: tenancy.start_date,
    endDate: tenancy.end_date,
    frequency: tenancy.rent_frequency,
    rentDueDay: tenancy.rent_due_day,
    horizon,
  }).map((due_date) => ({
    tenancy_id: tenancy.id,
    due_date,
    amount_due: tenancy.rent_amount,
    status: "due" as const,
  }));
}

/** Most recent payment actually marked paid. */
export function lastPaidDate(payments: RentPayment[]): string | null {
  const paid = payments
    .filter((p) => p.status === "paid" && p.paid_at)
    .sort((a, b) => (a.paid_at! < b.paid_at! ? 1 : -1));
  return paid[0]?.paid_at ?? null;
}

/** Earliest still-unpaid due date. */
export function nextDueDate(payments: RentPayment[]): string | null {
  const outstanding = payments
    .filter((p) => p.status === "due" || p.status === "late")
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
  return outstanding[0]?.due_date ?? null;
}

/** Payments past their due date and still unpaid. */
export function overduePayments(
  payments: RentPayment[],
  today = new Date(),
): RentPayment[] {
  const todayStr = toDateString(startOfDay(today));
  return payments.filter(
    (p) => (p.status === "due" || p.status === "late") && p.due_date < todayStr,
  );
}
