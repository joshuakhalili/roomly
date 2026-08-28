import {
  addDays,
  addMonths,
  getDaysInMonth,
  parseISO,
  setDate,
  startOfDay,
} from "date-fns";
import type { RecurrenceFrequency } from "./types";

/**
 * Working out which dates a standing arrangement falls on.
 *
 * The same shape as the rent schedule, and it inherits the same trap: a
 * monthly job set for the 31st has no 31st in February. Clamping is easy;
 * the bug is clamping and then counting forward from the clamped date, which
 * drags every later month back to the 28th and never recovers.
 */

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function dayInMonth(monthAnchor: Date, dayOfMonth: number): Date {
  return setDate(monthAnchor, Math.min(dayOfMonth, getDaysInMonth(monthAnchor)));
}

/** Moves forward to the next occurrence of `dayOfWeek` (0 = Sunday). */
function nextWeekday(from: Date, dayOfWeek: number): Date {
  const delta = (dayOfWeek - from.getDay() + 7) % 7;
  return addDays(from, delta);
}

export function generateJobDates({
  startsOn,
  endsOn,
  frequency,
  dayOfWeek,
  dayOfMonth,
  horizon,
  from,
}: {
  startsOn: string;
  endsOn?: string | null;
  frequency: RecurrenceFrequency;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  /** Generate no further ahead than this. */
  horizon: Date;
  /** Ignore anything before this — used to top up without regenerating history. */
  from?: Date;
}): string[] {
  const start = startOfDay(parseISO(startsOn));
  const end = endsOn ? startOfDay(parseISO(endsOn)) : null;
  const limit = startOfDay(horizon);
  const floor = from ? startOfDay(from) : start;

  // A season-bounded arrangement whose season is over produces nothing,
  // rather than a winter's worth of jobs to cancel one at a time.
  if (end && end < floor) return [];

  const dates: string[] = [];

  if (frequency === "monthly") {
    const day = dayOfMonth ?? start.getDate();
    for (let i = 0; i < 240; i++) {
      // Recomputed from the original start each time, never by stepping on
      // from the previous (possibly clamped) date.
      const cursor = dayInMonth(addMonths(start, i), day);
      if (cursor > limit) break;
      if (end && cursor > end) break;
      if (cursor >= floor && cursor >= start) dates.push(toDateString(cursor));
    }
    return dates;
  }

  const step = frequency === "weekly" ? 7 : 14;
  const first =
    dayOfWeek === null || dayOfWeek === undefined
      ? start
      : nextWeekday(start, dayOfWeek);

  for (let i = 0; i < 520; i++) {
    const cursor = addDays(first, i * step);
    if (cursor > limit) break;
    if (end && cursor > end) break;
    if (cursor >= floor) dates.push(toDateString(cursor));
  }
  return dates;
}
