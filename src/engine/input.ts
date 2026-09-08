/**
 * Turning what a person can actually remember into what the statute needs.
 *
 * The lookback tests in s.6(1)(c) and s.6(6)(a) sum days across *whole*
 * previous years, so the placement of a trip inside its year never changes the
 * result. Only the per-year total does. That means we can ask "how many days
 * were you in India in FY 2024-25?", which people can answer from memory or a
 * passport, instead of demanding every arrival and departure date.
 */

import { pyLabel, pyStart, toISO, addDays, previousYearOf, parseISO } from './fy';
import type { PreviousYear, StayPeriod } from './types';

export interface AnnualDays {
  previousYear: PreviousYear;
  label: string;
  days: number;
}

/** The previous years a user should be asked about: departure year to the year before return. */
export function yearsToDeclare(
  settledAbroadSince: string,
  returnDate: string,
  maxYears = 10,
): PreviousYear[] {
  const departurePY = previousYearOf(parseISO(settledAbroadSince));
  const returnPY = previousYearOf(parseISO(returnDate));
  const years: PreviousYear[] = [];
  for (let py = departurePY + 1; py < returnPY; py++) years.push(py);
  // Only the most recent years can still affect a determination: the widest
  // lookback in the Act is ten previous years.
  return years.slice(-maxYears);
}

export function emptyAnnualDays(
  settledAbroadSince: string,
  returnDate: string,
): AnnualDays[] {
  return yearsToDeclare(settledAbroadSince, returnDate).map((py) => ({
    previousYear: py,
    label: pyLabel(py),
    days: 0,
  }));
}

/**
 * Synthesise one stay block per previous year holding the declared number of
 * days. Blocks start on 1 April so they can never spill into the next year.
 */
export function visitsFromAnnualDays(annual: AnnualDays[]): StayPeriod[] {
  return annual
    .filter((a) => a.days > 0)
    .map((a) => {
      const capped = Math.min(a.days, 365);
      const start = pyStart(a.previousYear);
      return {
        from: toISO(start),
        to: toISO(addDays(start, capped - 1)),
        note: `${capped} days declared in ${a.label}`,
      };
    });
}
