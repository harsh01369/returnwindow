/**
 * Domain types for Indian residential-status determination under
 * Section 6 of the Income-tax Act, 1961.
 *
 * Vocabulary note: the Act calls a tax year a "previous year" (PY), running
 * 1 April to 31 March. We model a PY by its starting calendar year, so
 * `startYear: 2026` means 1 Apr 2026 - 31 Mar 2027, displayed "FY 2026-27".
 */

/** A previous year, identified by the calendar year in which its 1 April falls. */
export type PreviousYear = number;

/** A closed interval of physical presence in India. Both endpoints count as days in India. */
export interface StayPeriod {
  /** ISO date, YYYY-MM-DD. Day of arrival counts as a day in India. */
  from: string;
  /** ISO date, YYYY-MM-DD. Day of departure counts as a day in India. */
  to: string;
  /** Optional free-text label, e.g. "Diwali visit". Never leaves the browser. */
  note?: string;
}

/**
 * Why the individual was in India during a given previous year.
 *
 * This matters more than any other single input. Explanation 1(b) to s.6(1)
 * relaxes the 60-day test to 182 days (or 120 days for higher earners) only
 * for someone who, "being outside India, comes on a visit to India". A
 * permanent return is not a visit, so the relaxation is not available in the
 * year of return on the revenue's reading. See `InterpretationFlag`.
 */
export type PresencePurpose =
  | 'visit' // came to India on a visit while living abroad
  | 'permanent-return' // returned to India to settle
  | 'resident'; // already living in India

export interface Profile {
  /** Indian citizen, as opposed to a foreign national. Drives Expl. 1 and s.6(1A). */
  isIndianCitizen: boolean;
  /**
   * Person of Indian Origin as defined in Explanation to s.115C(e).
   * Only relevant when not an Indian citizen; PIOs get Explanation 1(b) too.
   */
  isPersonOfIndianOrigin: boolean;
  /**
   * Total income *other than income from foreign sources* exceeding Rs 15 lakh
   * in the previous year. Triggers the 120-day proviso and s.6(1A).
   * Roughly: India-sourced income. Not worldwide income.
   */
  indianIncomeExceeds15Lakh: boolean;
  /**
   * Liable to tax in another country by reason of domicile, residence or any
   * criterion of a similar nature. If false and the individual is an Indian
   * citizen over the Rs 15 lakh threshold, s.6(1A) deems them resident.
   */
  liableToTaxAbroad: boolean;
  /**
   * Left India in this previous year for the purpose of employment outside
   * India, or as a member of the crew of an Indian ship. Explanation 1(a)
   * relaxes the 60-day test to 182 days in the year of departure.
   */
  leftIndiaForEmployment?: boolean;
}

/** The three statuses that determine how much of your income India can tax. */
export type Status = 'NR' | 'RNOR' | 'ROR';

/** Which limb of Section 6 produced the outcome. */
export type ResidencyBasis =
  | 's6(1)(a) 182-day test'
  | 's6(1)(c) 60-day + 365-day test'
  | 's6(1A) deemed resident'
  | 'no test met';

/**
 * A point where the law is genuinely unsettled or fact-sensitive, and where a
 * different reading changes the answer. We surface these rather than hiding
 * them behind a single confident number.
 */
export interface InterpretationFlag {
  id: string;
  title: string;
  /** What we assumed in the figure shown. */
  assumption: string;
  /** What changes if the other reading is taken. */
  ifInsteadColumn: string;
  /** Whether this flag actually changed the outcome for this year. */
  material: boolean;
}

export interface YearDetermination {
  previousYear: PreviousYear;
  /** Display label, e.g. "FY 2026-27". */
  label: string;
  daysInIndia: number;
  /** Days in India across the four previous years immediately preceding. */
  daysInPreceding4Years: number;
  /** Days in India across the seven previous years immediately preceding. */
  daysInPreceding7Years: number;
  /** Count of the ten preceding previous years in which the person was non-resident. */
  nonResidentYearsInPreceding10: number;
  /** The day threshold actually applied by the 60-day limb, after Explanation 1. */
  secondTestThreshold: 60 | 120 | 182;
  /** Why that threshold was chosen, in plain words. */
  secondTestThresholdReason: string;
  isResident: boolean;
  basis: ResidencyBasis;
  status: Status;
  /** Why RNOR rather than ROR, when applicable. */
  notOrdinarilyResidentBasis?: string;
  flags: InterpretationFlag[];
  /** Statutory provisions actually relied on for this year. */
  citations: string[];
}

export interface Projection {
  /** The return date this projection assumes, ISO YYYY-MM-DD. */
  returnDate: string;
  years: YearDetermination[];
  /** Number of previous years, starting with the year of return, that are NR or RNOR. */
  shelteredYears: number;
  /** The first previous year in which worldwide income becomes taxable. */
  firstRORYear: PreviousYear | null;
  label: string;
}

/** One candidate return date, scored. */
export interface ReturnDateOption extends Projection {
  /** Days later than the earliest date considered. */
  daysFromEarliest: number;
  /** True if this option ties for the maximum sheltered years. */
  isOptimal: boolean;
}
