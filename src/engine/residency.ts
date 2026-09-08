/**
 * Residential-status determination under Section 6 of the Income-tax Act, 1961,
 * as amended by the Finance Act 2020.
 *
 * The engine is deliberately explicit about *which limb* produced an answer and
 * *which threshold* was applied, because in return-date planning the difference
 * between a 60-day and a 182-day threshold is usually the whole question.
 */

import {
  daysInIndiaDuring,
  daysInPrecedingYears,
  parseISO,
  previousYearOf,
  pyEnd,
  pyLabel,
  toISO,
} from './fy';
import type {
  InterpretationFlag,
  PresencePurpose,
  PreviousYear,
  Profile,
  Projection,
  ResidencyBasis,
  Status,
  StayPeriod,
  YearDetermination,
} from './types';

export interface Scenario {
  /**
   * The date the individual left India to live abroad. Presence before this
   * date is treated as continuous residence in India.
   */
  settledAbroadSince: string;
  /** Visits to India while living abroad. */
  visits: StayPeriod[];
  /** The date of permanent return to India. */
  returnDate: string;
  profile: Profile;
  /** How many previous years to project past the year of return. Default 5. */
  horizonYears?: number;
}

/**
 * Build the full presence timeline: continuously in India until departure,
 * discrete visits while abroad, then continuously in India from the return date.
 */
export function buildPresence(scenario: Scenario): StayPeriod[] {
  const departure = parseISO(scenario.settledAbroadSince);
  const ret = parseISO(scenario.returnDate);
  if (ret.getTime() < departure.getTime()) {
    throw new Error('Return date cannot precede the date of leaving India.');
  }

  // Look back far enough to evaluate the ten-preceding-years test in the
  // earliest year we report on.
  const historyStart = new Date(Date.UTC(departure.getUTCFullYear() - 12, 3, 1));
  const horizon = scenario.horizonYears ?? 5;
  const lastPY = previousYearOf(ret) + horizon;

  return [
    { from: toISO(historyStart), to: scenario.settledAbroadSince, note: 'Living in India' },
    ...scenario.visits,
    { from: scenario.returnDate, to: toISO(pyEnd(lastPY)), note: 'Returned to India' },
  ];
}

/** Classify why the individual was present in India during a given previous year. */
export function purposeForYear(scenario: Scenario, py: PreviousYear): PresencePurpose {
  const departurePY = previousYearOf(parseISO(scenario.settledAbroadSince));
  const returnPY = previousYearOf(parseISO(scenario.returnDate));
  // The year of departure is not a visit either: the individual began it living
  // in India. Explanation 1(b) is therefore unavailable that year, and only
  // Explanation 1(a) can relax the threshold, and only for an employment move.
  if (py <= departurePY) return 'resident';
  if (py < returnPY) return 'visit';
  if (py === returnPY) return 'permanent-return';
  return 'resident';
}

interface ThresholdChoice {
  threshold: 60 | 120 | 182;
  reason: string;
  flags: InterpretationFlag[];
}

/**
 * Choose the day threshold for the second limb of s.6(1) after applying
 * Explanation 1. Returns any interpretive flags raised along the way.
 */
export function chooseSecondTestThreshold(
  scenario: Scenario,
  py: PreviousYear,
  purpose: PresencePurpose,
): ThresholdChoice {
  const { profile } = scenario;
  const departurePY = previousYearOf(parseISO(scenario.settledAbroadSince));
  const isIndianOrigin = profile.isIndianCitizen || profile.isPersonOfIndianOrigin;

  // Explanation 1(a): left India in this year for employment abroad, or as
  // crew of an Indian ship. Available to Indian citizens only.
  if (
    py === departurePY &&
    profile.leftIndiaForEmployment &&
    profile.isIndianCitizen
  ) {
    return {
      threshold: 182,
      reason:
        'Left India during this year for employment abroad, so Explanation 1(a) to s.6(1) substitutes 182 days for 60 days.',
      flags: [],
    };
  }

  // Explanation 1(b): applies to someone who, "being outside India, comes on a
  // visit to India". A permanent return is not a visit.
  if (isIndianOrigin && purpose === 'visit') {
    if (profile.indianIncomeExceeds15Lakh) {
      return {
        threshold: 120,
        reason:
          'Visiting India while living abroad, with Indian-source income over Rs 15 lakh, so the proviso to Explanation 1(b) substitutes 120 days for 60 days.',
        flags: [],
      };
    }
    return {
      threshold: 182,
      reason:
        'Visiting India while living abroad, so Explanation 1(b) substitutes 182 days for 60 days.',
      flags: [],
    };
  }

  if (isIndianOrigin && purpose === 'permanent-return') {
    const relaxed: 120 | 182 = profile.indianIncomeExceeds15Lakh ? 120 : 182;
    return {
      threshold: 60,
      reason:
        'This is the year of permanent return, not a visit, so the Explanation 1(b) relaxation is not applied and the base 60-day test in s.6(1)(c) governs.',
      flags: [
        {
          id: 'return-year-is-not-a-visit',
          title: 'Is the year you move back a "visit"?',
          assumption: `We applied the 60-day test to ${pyLabel(py)}. Explanation 1(b) extends that to ${relaxed} days only for a person who "being outside India, comes on a visit to India", and a move home to settle is not naturally a visit.`,
          ifInsteadColumn: `If the ${relaxed}-day threshold were held to apply to the year of return, you would need ${relaxed} days in India before becoming resident, which can move your first taxable year back by one full year.`,
          material: false, // set by the caller once day counts are known
        },
      ],
    };
  }

  return {
    threshold: 60,
    reason: 'Base test in s.6(1)(c): 60 days in the year plus 365 days over the preceding four years.',
    flags: [],
  };
}

/** Determine status for one previous year, given the statuses already computed for prior years. */
export function determineYear(
  scenario: Scenario,
  py: PreviousYear,
  presence: StayPeriod[],
  priorStatuses: Map<PreviousYear, Status>,
): YearDetermination {
  const { profile } = scenario;
  const purpose = purposeForYear(scenario, py);

  const daysInIndia = daysInIndiaDuring(presence, py);
  const daysInPreceding4Years = daysInPrecedingYears(presence, py, 4);
  const daysInPreceding7Years = daysInPrecedingYears(presence, py, 7);

  let nonResidentYearsInPreceding10 = 0;
  for (let i = 1; i <= 10; i++) {
    if (priorStatuses.get(py - i) === 'NR') nonResidentYearsInPreceding10++;
  }

  const { threshold, reason, flags } = chooseSecondTestThreshold(scenario, py, purpose);

  const citations: string[] = [];
  const meets182 = daysInIndia >= 182;
  const meetsSecondTest = daysInIndia >= threshold && daysInPreceding4Years >= 365;

  let isResident = meets182 || meetsSecondTest;
  let basis: ResidencyBasis = meets182
    ? 's6(1)(a) 182-day test'
    : meetsSecondTest
      ? 's6(1)(c) 60-day + 365-day test'
      : 'no test met';

  if (meets182) citations.push('s.6(1)(a)');
  if (meetsSecondTest) citations.push('s.6(1)(c)', 'Explanation 1 to s.6(1)');

  // Section 6(1A): deemed residence for Indian citizens who are stateless for
  // tax. Applies only where the individual is not already resident under 6(1).
  let deemedResident = false;
  if (
    !isResident &&
    profile.isIndianCitizen &&
    profile.indianIncomeExceeds15Lakh &&
    !profile.liableToTaxAbroad
  ) {
    deemedResident = true;
    isResident = true;
    basis = 's6(1A) deemed resident';
    citations.push('s.6(1A)');
  }

  // Section 6(6): ordinarily resident, or not.
  let status: Status;
  let notOrdinarilyResidentBasis: string | undefined;

  if (!isResident) {
    status = 'NR';
  } else if (deemedResident) {
    status = 'RNOR';
    notOrdinarilyResidentBasis =
      'A person deemed resident under s.6(1A) is not ordinarily resident by force of s.6(6)(d).';
    citations.push('s.6(6)(d)');
  } else if (threshold === 120 && daysInIndia >= 120 && daysInIndia < 182) {
    status = 'RNOR';
    notOrdinarilyResidentBasis =
      'Resident only because of the 120-day proviso, and so not ordinarily resident under s.6(6)(c).';
    citations.push('s.6(6)(c)');
  } else if (nonResidentYearsInPreceding10 >= 9) {
    status = 'RNOR';
    notOrdinarilyResidentBasis = `Non-resident in ${nonResidentYearsInPreceding10} of the 10 preceding previous years, satisfying the first limb of s.6(6)(a).`;
    citations.push('s.6(6)(a)');
  } else if (daysInPreceding7Years <= 729) {
    status = 'RNOR';
    notOrdinarilyResidentBasis = `Present in India for ${daysInPreceding7Years} days across the 7 preceding previous years, which is 729 or fewer, satisfying the second limb of s.6(6)(a).`;
    citations.push('s.6(6)(a)');
  } else {
    status = 'ROR';
  }

  // A flag is only worth showing if the alternative reading changes the answer.
  const materialFlags = flags.map((f) => {
    if (f.id !== 'return-year-is-not-a-visit') return f;
    const relaxed = profile.indianIncomeExceeds15Lakh ? 120 : 182;
    const wouldBeResidentUnderRelaxed =
      meets182 || (daysInIndia >= relaxed && daysInPreceding4Years >= 365);
    return { ...f, material: isResident && !wouldBeResidentUnderRelaxed };
  });

  return {
    previousYear: py,
    label: pyLabel(py),
    daysInIndia,
    daysInPreceding4Years,
    daysInPreceding7Years,
    nonResidentYearsInPreceding10,
    secondTestThreshold: threshold,
    secondTestThresholdReason: reason,
    isResident,
    basis,
    status,
    notOrdinarilyResidentBasis,
    flags: materialFlags,
    citations: Array.from(new Set(citations)),
  };
}

/**
 * Project residential status across the year of return and the following years.
 *
 * Years are evaluated in order because s.6(6)(a) depends on the statuses of the
 * ten preceding previous years, which we must therefore have already decided.
 */
export function project(scenario: Scenario): Projection {
  const presence = buildPresence(scenario);
  const departurePY = previousYearOf(parseISO(scenario.settledAbroadSince));
  const returnPY = previousYearOf(parseISO(scenario.returnDate));
  const horizon = scenario.horizonYears ?? 5;

  // Evaluate from well before departure so the 9-of-10 and 7-year lookbacks are
  // populated with real determinations rather than assumptions.
  const firstPY = departurePY - 11;
  const lastPY = returnPY + horizon;

  const statuses = new Map<PreviousYear, Status>();
  const all: YearDetermination[] = [];

  for (let py = firstPY; py <= lastPY; py++) {
    const det = determineYear(scenario, py, presence, statuses);
    statuses.set(py, det.status);
    all.push(det);
  }

  // Report only from the year of return onwards; the history is scaffolding.
  const years = all.filter((y) => y.previousYear >= returnPY);

  let shelteredYears = 0;
  for (const y of years) {
    if (y.status === 'ROR') break;
    shelteredYears++;
  }
  const firstROR = years.find((y) => y.status === 'ROR');

  return {
    returnDate: scenario.returnDate,
    years,
    shelteredYears,
    firstRORYear: firstROR ? firstROR.previousYear : null,
    label: pyLabel(returnPY),
  };
}
