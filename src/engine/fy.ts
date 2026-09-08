/**
 * Fiscal-year and day-counting utilities.
 *
 * All date arithmetic is done in UTC. A "day in India" is a calendar date on
 * which the individual was physically present in India at any point; both the
 * date of arrival and the date of departure are counted, which is the position
 * taken by the department and the one used by every reported case we are aware
 * of. Where a stay spans a 31 March, the days fall into their respective
 * previous years.
 */

import type { PreviousYear, StayPeriod } from './types';

const MS_PER_DAY = 86_400_000;

/** Parse a YYYY-MM-DD string into a UTC midnight Date. Throws on malformed input. */
export function parseISO(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) throw new Error(`Not an ISO date (YYYY-MM-DD): "${iso}"`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  // Reject impossible dates that Date would otherwise roll over, e.g. 2025-02-30.
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== mo - 1 ||
    date.getUTCDate() !== d
  ) {
    throw new Error(`Not a real calendar date: "${iso}"`);
  }
  return date;
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_PER_DAY);
}

/** Inclusive day count between two dates, so from === to yields 1. */
export function inclusiveDays(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY) + 1;
}

/** The previous year (by start calendar year) in which a date falls. */
export function previousYearOf(date: Date): PreviousYear {
  const y = date.getUTCFullYear();
  // A previous year runs 1 April to 31 March, so Jan-Mar belongs to the prior start year.
  return date.getUTCMonth() >= 3 ? y : y - 1;
}

/** 1 April of the previous year, at UTC midnight. */
export function pyStart(py: PreviousYear): Date {
  return new Date(Date.UTC(py, 3, 1));
}

/** 31 March closing the previous year, at UTC midnight. */
export function pyEnd(py: PreviousYear): Date {
  return new Date(Date.UTC(py + 1, 2, 31));
}

/** "FY 2026-27" */
export function pyLabel(py: PreviousYear): string {
  return `FY ${py}-${String((py + 1) % 100).padStart(2, '0')}`;
}

/** The assessment year for a previous year: "AY 2027-28" for PY 2026-27. */
export function assessmentYearLabel(py: PreviousYear): string {
  return `AY ${py + 1}-${String((py + 2) % 100).padStart(2, '0')}`;
}

interface Interval {
  from: number;
  to: number;
}

/**
 * Merge overlapping or touching stay periods so a day counted twice by the
 * user is not counted twice by us. Touching intervals (to === from - 1 day)
 * are merged because they represent continuous presence.
 */
export function mergePeriods(periods: StayPeriod[]): Interval[] {
  const intervals = periods
    .map((p) => {
      const from = parseISO(p.from).getTime();
      const to = parseISO(p.to).getTime();
      if (to < from) {
        throw new Error(`Stay period ends before it starts: ${p.from} to ${p.to}`);
      }
      return { from, to };
    })
    .sort((a, b) => a.from - b.from);

  const merged: Interval[] = [];
  for (const iv of intervals) {
    const last = merged[merged.length - 1];
    if (last && iv.from <= last.to + MS_PER_DAY) {
      last.to = Math.max(last.to, iv.to);
    } else {
      merged.push({ ...iv });
    }
  }
  return merged;
}

/** Days of presence in India falling within a single previous year. */
export function daysInIndiaDuring(periods: StayPeriod[], py: PreviousYear): number {
  return daysInIndiaBetween(mergePeriods(periods), pyStart(py), pyEnd(py));
}

/** Days of presence within an arbitrary closed window, given pre-merged intervals. */
export function daysInIndiaBetween(merged: Interval[], from: Date, to: Date): number {
  const lo = from.getTime();
  const hi = to.getTime();
  let total = 0;
  for (const iv of merged) {
    const start = Math.max(iv.from, lo);
    const end = Math.min(iv.to, hi);
    if (end >= start) {
      total += Math.floor((end - start) / MS_PER_DAY) + 1;
    }
  }
  return total;
}

/** Days in India summed across the `n` previous years immediately preceding `py`. */
export function daysInPrecedingYears(
  periods: StayPeriod[],
  py: PreviousYear,
  n: number,
): number {
  const merged = mergePeriods(periods);
  return daysInIndiaBetween(merged, pyStart(py - n), pyEnd(py - 1));
}
