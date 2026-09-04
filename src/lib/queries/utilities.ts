import type { RentFrequency, Tenancy, UtilityBill } from "@/lib/types";

/**
 * How many times a rent falls due in a month, on average.
 *
 * Weekly rent is not four times a month — it is 52/12, which is 4.33. Getting
 * this wrong understates a weekly letting's income by about 8%, which is
 * enough to turn a healthy bills margin into an apparent loss.
 */
const PER_MONTH: Record<string, number> = {
  weekly: 52 / 12,
  fortnightly: 26 / 12,
  four_weekly: 13 / 12,
  monthly: 1,
};

/** A month's rent from a letting, or null if it does not recur. */
function monthlyRent(tenancy: {
  rent_amount: number;
  rent_frequency: RentFrequency;
}): number | null {
  const factor = PER_MONTH[tenancy.rent_frequency];
  return factor === undefined ? null : Number(tenancy.rent_amount) * factor;
}

export interface BillsMargin {
  /** Utilities billed over the window. */
  spend: number;
  /** Rent collected over the same window from lettings that include bills. */
  collected: number;
  /** collected − spend. Negative means the utilities are eating the rent. */
  margin: number;
  /** How many lettings here actually include bills. */
  lettings: number;
  /** Whether there is enough to draw a conclusion from. */
  hasData: boolean;
}

/**
 * What the bills-included lettings brought in, against what the utilities
 * cost, over a window of months.
 *
 * The comparison nothing else in the app makes. A landlord sets a
 * bills-included rent once, from what usage looked like at the time, and then
 * the standing charge moves and nobody notices until the year-end accounts.
 *
 * Deliberately approximate, and honest about it: bills are matched to the
 * window by their period end, and rent is a monthly equivalent rather than
 * what was actually banked. Precise enough to answer "is this letting
 * underwater", which is the question. Not an accounting statement.
 */
export function billsMargin(
  bills: UtilityBill[],
  tenancies: Tenancy[],
  months = 12,
  today: Date = new Date(),
): BillsMargin {
  const from = new Date(today);
  from.setMonth(from.getMonth() - months);
  const fromStr = from.toISOString().slice(0, 10);

  const spend = bills
    .filter((b) => b.period_end >= fromStr)
    .reduce((sum, b) => sum + Number(b.amount), 0);

  const included = tenancies.filter(
    (t) => t.bills_included && (t.status === "active" || t.status === "ended"),
  );

  /* Counted over the months each letting was actually running inside the
     window, not the whole window — a room let for two of the last twelve
     months did not collect a year of rent, and pretending it did would hide
     a genuine shortfall behind income that never arrived. */
  const collected = included.reduce((sum, t) => {
    const perMonth = monthlyRent(t);
    if (perMonth === null) return sum;

    const start = t.start_date > fromStr ? t.start_date : fromStr;
    const todayStr = today.toISOString().slice(0, 10);
    const end = t.end_date && t.end_date < todayStr ? t.end_date : todayStr;
    if (end <= start) return sum;

    const overlapMonths =
      (new Date(end).getTime() - new Date(start).getTime()) /
      (1000 * 60 * 60 * 24 * 30.44);

    return sum + perMonth * overlapMonths;
  }, 0);

  return {
    spend,
    collected,
    margin: collected - spend,
    lettings: included.length,
    // One bill and no bills-included letting is not a comparison, it is half
    // of one — showing a margin from it would be inventing a conclusion.
    hasData: bills.length > 0 && included.length > 0,
  };
}
