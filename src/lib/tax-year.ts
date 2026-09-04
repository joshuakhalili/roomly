/**
 * UK tax years, which are not calendar years.
 *
 * A landlord's expenses are totalled 6 April to 5 April, because that is the
 * period an accountant and HMRC both work in. Grouping by calendar year would
 * produce a number that looks right, reconciles against nothing, and is wrong
 * by however much was spent in the first week of April.
 *
 * The boundary is genuinely awkward — 5 April belongs to the year that
 * started the previous 6 April — so it lives here, once, with tests, rather
 * than being re-derived at each call site.
 */

/** A tax year, with both ends inclusive. */
export interface TaxYear {
  /** The calendar year it starts in: 2025 for 2025/26. */
  startYear: number;
  /** First day, inclusive. `2025-04-06`. */
  start: string;
  /** Last day, inclusive. `2026-04-05`. */
  end: string;
  /** How it is written down: `2025/26`. */
  label: string;
}

/** The tax year beginning on 6 April of `startYear`. */
export function taxYear(startYear: number): TaxYear {
  const endYear = startYear + 1;
  return {
    startYear,
    start: `${startYear}-04-06`,
    end: `${endYear}-04-05`,
    // Two digits at the end, zero-padded: 2009/10, never 2009/1.
    label: `${startYear}/${String(endYear % 100).padStart(2, "0")}`,
  };
}

/**
 * The tax year a given date falls in.
 *
 * Accepts the ISO strings the database stores, so callers don't have to parse
 * first. Compared as strings rather than Dates deliberately — a `date` column
 * has no time or zone, and turning it into a Date introduces both.
 */
export function taxYearFor(date: string | Date): TaxYear {
  const iso =
    typeof date === "string"
      ? date.slice(0, 10)
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const year = Number(iso.slice(0, 4));
  const monthDay = iso.slice(5, 10);

  // On or after 6 April the year has started; before that, we are still in
  // the one that began last April.
  return taxYear(monthDay >= "04-06" ? year : year - 1);
}

/** Whether an ISO date falls inside a tax year. Both ends inclusive. */
export function isInTaxYear(date: string, year: TaxYear): boolean {
  const iso = date.slice(0, 10);
  return iso >= year.start && iso <= year.end;
}

/**
 * The current tax year and the ones before it, newest first.
 *
 * What a year selector is filled with. There is no point offering years the
 * business did not exist for, but that is the caller's judgement to make from
 * its own data — this just counts backwards.
 */
export function recentTaxYears(count: number, today: Date = new Date()): TaxYear[] {
  const current = taxYearFor(today);
  return Array.from({ length: Math.max(1, count) }, (_, i) =>
    taxYear(current.startYear - i),
  );
}
