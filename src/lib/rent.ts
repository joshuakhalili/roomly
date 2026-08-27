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
