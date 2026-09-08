/**
 * Return-date optimisation.
 *
 * The point of the exercise: residential status is decided per previous year,
 * and a previous year ends on 31 March. Two return dates a fortnight apart can
 * therefore differ by a whole year of worldwide-income exposure. This module
 * scans candidate dates and finds the exact days on which the answer changes.
 */

import { addDays, inclusiveDays, parseISO, toISO } from './fy';
import { project, type Scenario } from './residency';
import type { PreviousYear, ReturnDateOption } from './types';

export interface ScanOptions {
  /** Earliest date the individual could return, ISO. */
  earliest: string;
  /** Latest date they are willing to return, ISO. */
  latest: string;
}

/** A date on which the number of sheltered years changes. */
export interface Cliff {
  /** The last date that still gives the worse outcome. */
  dateBefore: string;
  /** The first date that gives the better outcome. */
  dateAfter: string;
  shelteredBefore: number;
  shelteredAfter: number;
  firstRORBefore: PreviousYear | null;
  firstRORAfter: PreviousYear | null;
  /** Positive when waiting until `dateAfter` buys you additional sheltered years. */
  yearsGained: number;
}

export function scanReturnDates(
  scenario: Scenario,
  options: ScanOptions,
): ReturnDateOption[] {
  const earliest = parseISO(options.earliest);
  const latest = parseISO(options.latest);
  const span = inclusiveDays(earliest, latest);
  if (span <= 0) throw new Error('The latest return date must not precede the earliest.');
  if (span > 1500) {
    throw new Error('Scan window is limited to about four years; narrow the range.');
  }

  const results: ReturnDateOption[] = [];
  for (let i = 0; i < span; i++) {
    const date = addDays(earliest, i);
    const iso = toISO(date);
    const p = project({ ...scenario, returnDate: iso });
    results.push({ ...p, daysFromEarliest: i, isOptimal: false });
  }

  const best = Math.max(...results.map((r) => r.shelteredYears));
  for (const r of results) r.isOptimal = r.shelteredYears === best;
  return results;
}

/** Find every date on which the outcome changes across a scan. */
export function findCliffs(scan: ReturnDateOption[]): Cliff[] {
  const cliffs: Cliff[] = [];
  for (let i = 1; i < scan.length; i++) {
    const before = scan[i - 1];
    const after = scan[i];
    if (before.shelteredYears !== after.shelteredYears) {
      cliffs.push({
        dateBefore: before.returnDate,
        dateAfter: after.returnDate,
        shelteredBefore: before.shelteredYears,
        shelteredAfter: after.shelteredYears,
        firstRORBefore: before.firstRORYear,
        firstRORAfter: after.firstRORYear,
        yearsGained: after.shelteredYears - before.shelteredYears,
      });
    }
  }
  return cliffs;
}

/**
 * What the window actually asks of the reader.
 *
 * `gain-available` - waiting buys a year.
 * `hold-and-protect` - the earliest date is already optimal, but slipping past
 *   a later date would cost a year. This is the more common and more easily
 *   missed case: the risk is drift, not impatience.
 * `flat` - nothing in the window changes the answer.
 */
export type Outcome = 'gain-available' | 'hold-and-protect' | 'flat';

export interface Recommendation {
  outcome: Outcome;
  /** The earliest date within the window that achieves the best outcome. */
  bestDate: string;
  bestShelteredYears: number;
  /** The outcome if they returned on the earliest date they were considering. */
  baselineDate: string;
  baselineShelteredYears: number;
  yearsGained: number;
  /** Days of waiting required to capture the gain. */
  daysToWait: number;
  /**
   * For `hold-and-protect`: the last date that still achieves the best outcome
   * before the first drop. Arriving after this costs `yearsAtRisk` years.
   */
  protectUntil?: string;
  yearsAtRisk?: number;
  cliffs: Cliff[];
}

export function recommend(scan: ReturnDateOption[]): Recommendation {
  const baseline = scan[0];
  const best = scan.find((r) => r.isOptimal)!;
  const yearsGained = best.shelteredYears - baseline.shelteredYears;
  const cliffs = findCliffs(scan);

  const common = {
    bestDate: best.returnDate,
    bestShelteredYears: best.shelteredYears,
    baselineDate: baseline.returnDate,
    baselineShelteredYears: baseline.shelteredYears,
    yearsGained,
    daysToWait: best.daysFromEarliest,
    cliffs,
  };

  if (yearsGained > 0) {
    return { ...common, outcome: 'gain-available' };
  }

  // The first date is already as good as it gets. Does the window later fall away?
  const firstDrop = scan.findIndex((r) => r.shelteredYears < best.shelteredYears);
  if (firstDrop > 0) {
    return {
      ...common,
      outcome: 'hold-and-protect',
      protectUntil: scan[firstDrop - 1].returnDate,
      yearsAtRisk: best.shelteredYears - scan[firstDrop].shelteredYears,
    };
  }

  return { ...common, outcome: 'flat' };
}
