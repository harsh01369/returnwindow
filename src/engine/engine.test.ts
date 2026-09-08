import { describe, expect, it } from 'vitest';
import {
  daysInIndiaDuring,
  daysInPrecedingYears,
  inclusiveDays,
  mergePeriods,
  parseISO,
  previousYearOf,
  pyLabel,
} from './fy';
import { buildPresence, determineYear, project, purposeForYear, type Scenario } from './residency';
import { findCliffs, recommend, scanReturnDates } from './optimize';
import type { Profile, Status, PreviousYear } from './types';

const baseProfile: Profile = {
  isIndianCitizen: true,
  isPersonOfIndianOrigin: false,
  indianIncomeExceeds15Lakh: false,
  liableToTaxAbroad: true,
  leftIndiaForEmployment: true,
};

/** Short annual visits, roughly three weeks each December. */
function annualVisits(fromYear: number, toYear: number, days = 20) {
  const out = [];
  for (let y = fromYear; y <= toYear; y++) {
    const start = new Date(Date.UTC(y, 11, 1));
    const end = new Date(start.getTime() + (days - 1) * 86_400_000);
    out.push({ from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) });
  }
  return out;
}

describe('fiscal-year arithmetic', () => {
  it('counts both the arrival and the departure day', () => {
    expect(inclusiveDays(parseISO('2026-01-01'), parseISO('2026-01-01'))).toBe(1);
    expect(inclusiveDays(parseISO('2026-01-01'), parseISO('2026-01-31'))).toBe(31);
  });

  it('assigns January to March to the previous year that began the prior April', () => {
    expect(previousYearOf(parseISO('2026-04-01'))).toBe(2026);
    expect(previousYearOf(parseISO('2027-03-31'))).toBe(2026);
    expect(previousYearOf(parseISO('2027-04-01'))).toBe(2027);
    expect(pyLabel(2026)).toBe('FY 2026-27');
    expect(pyLabel(2009)).toBe('FY 2009-10');
  });

  it('splits a stay that straddles 31 March across two previous years', () => {
    const stay = [{ from: '2027-03-25', to: '2027-04-05' }];
    expect(daysInIndiaDuring(stay, 2026)).toBe(7); // 25-31 March
    expect(daysInIndiaDuring(stay, 2027)).toBe(5); // 1-5 April
  });

  it('does not double-count overlapping stays the user entered twice', () => {
    const overlapping = [
      { from: '2026-05-01', to: '2026-05-20' },
      { from: '2026-05-10', to: '2026-05-31' },
    ];
    expect(mergePeriods(overlapping)).toHaveLength(1);
    expect(daysInIndiaDuring(overlapping, 2026)).toBe(31);
  });

  it('merges back-to-back stays that touch', () => {
    expect(
      mergePeriods([
        { from: '2026-05-01', to: '2026-05-10' },
        { from: '2026-05-11', to: '2026-05-20' },
      ]),
    ).toHaveLength(1);
  });

  it('counts the leap day', () => {
    expect(daysInIndiaDuring([{ from: '2028-02-01', to: '2028-02-29' }], 2027)).toBe(29);
  });

  it('rejects impossible and reversed dates', () => {
    expect(() => parseISO('2026-02-30')).toThrow();
    expect(() => parseISO('26-01-01')).toThrow();
    expect(() => mergePeriods([{ from: '2026-05-10', to: '2026-05-01' }])).toThrow();
  });

  it('sums presence across the preceding four and seven years', () => {
    const visits = annualVisits(2020, 2025, 10);
    // Preceding 4 years of PY 2026 are PY 2022-2025; each December visit falls
    // in the previous year that began the prior April.
    expect(daysInPrecedingYears(visits, 2026, 4)).toBe(40);
    expect(daysInPrecedingYears(visits, 2026, 7)).toBe(60);
  });
});

describe('section 6(1): resident or not', () => {
  const scenario: Scenario = {
    settledAbroadSince: '2012-06-01',
    visits: [],
    returnDate: '2030-01-01',
    profile: baseProfile,
  };

  function statusFor(visits: Scenario['visits'], py: PreviousYear, prior = new Map<PreviousYear, Status>()) {
    const s = { ...scenario, visits };
    return determineYear(s, py, buildPresence(s), prior);
  }

  it('makes you resident on 182 days alone, with no four-year history', () => {
    const d = statusFor([{ from: '2025-04-01', to: '2025-09-29' }], 2025);
    expect(d.daysInIndia).toBe(182);
    expect(d.isResident).toBe(true);
    expect(d.basis).toBe('s6(1)(a) 182-day test');
  });

  it('leaves you non-resident at 181 days when the four-year history is thin', () => {
    const d = statusFor([{ from: '2025-04-01', to: '2025-09-28' }], 2025);
    expect(d.daysInIndia).toBe(181);
    expect(d.isResident).toBe(false);
  });

  it('applies the 182-day threshold to the second test for a visiting NRI', () => {
    // 400 days over the preceding four years clears the 365-day limb, and 100
    // days in the year clears 60, but Explanation 1(b) raises the bar to 182.
    const visits = [
      ...annualVisits(2021, 2024, 100),
      { from: '2025-04-01', to: '2025-07-09' }, // 100 days
    ];
    const d = statusFor(visits, 2025);
    expect(d.daysInPreceding4Years).toBeGreaterThanOrEqual(365);
    expect(d.secondTestThreshold).toBe(182);
    expect(d.isResident).toBe(false);
  });

  it('drops the threshold to 120 days once Indian income exceeds Rs 15 lakh', () => {
    const rich = { ...scenario, profile: { ...baseProfile, indianIncomeExceeds15Lakh: true } };
    const visits = [
      ...annualVisits(2021, 2024, 100),
      { from: '2025-04-01', to: '2025-08-08' }, // 130 days
    ];
    const s = { ...rich, visits };
    const d = determineYear(s, 2025, buildPresence(s), new Map());
    expect(d.secondTestThreshold).toBe(120);
    expect(d.daysInIndia).toBe(130);
    expect(d.isResident).toBe(true);
    // Resident only via the 120-day proviso, so RNOR by force of s.6(6)(c).
    expect(d.status).toBe('RNOR');
    expect(d.citations).toContain('s.6(6)(c)');
  });

  it('deems an Indian citizen resident under s.6(1A) when taxed nowhere else', () => {
    const stateless = {
      ...scenario,
      visits: [],
      profile: {
        ...baseProfile,
        indianIncomeExceeds15Lakh: true,
        liableToTaxAbroad: false,
      },
    };
    const d = determineYear(stateless, 2025, buildPresence(stateless), new Map());
    expect(d.daysInIndia).toBe(0);
    expect(d.isResident).toBe(true);
    expect(d.basis).toBe('s6(1A) deemed resident');
    expect(d.status).toBe('RNOR');
    expect(d.citations).toContain('s.6(6)(d)');
  });

  it('does not deem a foreign national resident under s.6(1A)', () => {
    const foreign = {
      ...scenario,
      profile: {
        ...baseProfile,
        isIndianCitizen: false,
        isPersonOfIndianOrigin: true,
        indianIncomeExceeds15Lakh: true,
        liableToTaxAbroad: false,
      },
    };
    const d = determineYear(foreign, 2025, buildPresence(foreign), new Map());
    expect(d.isResident).toBe(false);
    expect(d.status).toBe('NR');
  });

  it('gives the departing employee the 182-day threshold in the year they leave', () => {
    const d = statusFor([], 2012);
    expect(purposeForYear(scenario, 2012)).toBe('resident');
    expect(d.secondTestThreshold).toBe(182);
    expect(d.secondTestThresholdReason).toMatch(/Explanation 1\(a\)/);
  });
});

describe('section 6(6): ordinarily resident, or not', () => {
  it('treats 729 days over seven years as not ordinarily resident, and 730 as ordinarily resident', () => {
    // Build presence that lands exactly on each side of the statutory boundary.
    function build(daysInPrior7: number) {
      const scenario: Scenario = {
        settledAbroadSince: '2000-06-01',
        visits: [],
        returnDate: '2030-01-01',
        profile: baseProfile,
      };
      // One contiguous block wholly inside the seven previous years preceding
      // PY 2026, which are PY 2019 through PY 2025.
      const start = parseISO('2021-04-01');
      const end = new Date(start.getTime() + (daysInPrior7 - 1) * 86_400_000);
      const block = { from: '2021-04-01', to: end.toISOString().slice(0, 10) };
      // Make the year under test resident on the 182-day limb alone.
      const testYear = { from: '2026-04-01', to: '2026-12-31' };
      const presence = [block, testYear];
      // Leave two of the ten preceding years resident so the nine-of-ten limb
      // cannot fire and mask the day-count limb we are testing.
      const prior = new Map<PreviousYear, Status>();
      for (let i = 1; i <= 10; i++) prior.set(2026 - i, i <= 2 ? 'ROR' : 'NR');
      return determineYear({ ...scenario, visits: presence }, 2026, presence, prior);
    }

    const atBoundary = build(729);
    expect(atBoundary.daysInPreceding7Years).toBe(729);
    expect(atBoundary.isResident).toBe(true);
    expect(atBoundary.status).toBe('RNOR');

    const overBoundary = build(730);
    expect(overBoundary.daysInPreceding7Years).toBe(730);
    expect(overBoundary.status).toBe('ROR');
  });

  it('uses the nine-of-ten limb independently of the day count', () => {
    const scenario: Scenario = {
      settledAbroadSince: '2015-06-01',
      visits: [],
      returnDate: '2030-01-01',
      profile: baseProfile,
    };
    const presence = [{ from: '2026-04-01', to: '2027-03-31' }];
    const prior = new Map<PreviousYear, Status>();
    for (let i = 1; i <= 10; i++) prior.set(2026 - i, 'NR');
    const d = determineYear(scenario, 2026, presence, prior);
    expect(d.nonResidentYearsInPreceding10).toBe(10);
    expect(d.status).toBe('RNOR');
    expect(d.notOrdinarilyResidentBasis).toMatch(/first limb/);
  });
});

describe('the year of permanent return is not a visit', () => {
  const scenario: Scenario = {
    settledAbroadSince: '2012-06-01',
    visits: annualVisits(2018, 2025, 100), // heavy visitor: clears the 365-day limb
    returnDate: '2026-12-01',
    profile: baseProfile,
  };

  it('applies the 60-day test in the year of return', () => {
    const d = project(scenario).years[0];
    expect(purposeForYear(scenario, 2026)).toBe('permanent-return');
    expect(d.secondTestThreshold).toBe(60);
    expect(d.secondTestThresholdReason).toMatch(/not a visit/);
  });

  it('flags the point as material when the alternative reading flips the year', () => {
    const d = project(scenario).years[0];
    // 1 Dec to 31 Mar is 121 days: resident on the 60-day test, not on 182.
    expect(d.daysInIndia).toBe(121);
    expect(d.isResident).toBe(true);
    const flag = d.flags.find((f) => f.id === 'return-year-is-not-a-visit');
    expect(flag?.material).toBe(true);
  });

  it('does not raise the flag when the reading makes no difference', () => {
    // Returning in April, the year of return exceeds 182 days either way.
    const early = project({ ...scenario, returnDate: '2026-04-01' }).years[0];
    expect(early.daysInIndia).toBeGreaterThanOrEqual(182);
    expect(early.flags.find((f) => f.id === 'return-year-is-not-a-visit')?.material).toBe(false);
  });
});

describe('projection for a typical returning NRI', () => {
  const scenario: Scenario = {
    settledAbroadSince: '2012-06-01',
    visits: annualVisits(2013, 2025, 20), // three weeks a year, so no 365-day history
    returnDate: '2027-02-01',
    profile: baseProfile,
  };

  it('shelters the year of return plus two RNOR years', () => {
    const p = project(scenario);
    const [first, second, third, fourth] = p.years;

    expect(first.label).toBe('FY 2026-27');
    expect(first.daysInIndia).toBe(59); // 1 Feb to 31 Mar 2027
    expect(first.status).toBe('NR');

    expect(second.status).toBe('RNOR');
    expect(third.status).toBe('RNOR');
    expect(fourth.status).toBe('ROR');

    expect(p.shelteredYears).toBe(3);
    expect(p.firstRORYear).toBe(2029);
  });

  it('loses a whole sheltered year to a single day, via the seven-year lookback', () => {
    // The binding constraint is not the year of return at all: it is the
    // 729-day limb of s.6(6)(a) measured two years later. Returning one day
    // earlier puts 730 days into the seven preceding years of FY 2028-29.
    const later = project({ ...scenario, returnDate: '2026-07-12' });
    const earlier = project({ ...scenario, returnDate: '2026-07-11' });

    const laterThirdYear = later.years.find((y) => y.previousYear === 2028)!;
    const earlierThirdYear = earlier.years.find((y) => y.previousYear === 2028)!;

    expect(laterThirdYear.daysInPreceding7Years).toBe(729);
    expect(laterThirdYear.status).toBe('RNOR');
    expect(earlierThirdYear.daysInPreceding7Years).toBe(730);
    expect(earlierThirdYear.status).toBe('ROR');

    expect(later.shelteredYears).toBe(3);
    expect(earlier.shelteredYears).toBe(2);
    expect(later.firstRORYear).toBe(2029);
    expect(earlier.firstRORYear).toBe(2028);
  });

  it('separates the year-of-return NR boundary from the ROR onset', () => {
    // 1 October leaves exactly 182 days and makes the year of return resident;
    // 2 October leaves 181 and makes it non-resident. Both are sheltered, so
    // the count is unchanged: these are two genuinely different questions.
    const onOct1 = project({ ...scenario, returnDate: '2026-10-01' });
    const onOct2 = project({ ...scenario, returnDate: '2026-10-02' });

    expect(onOct1.years[0].daysInIndia).toBe(182);
    expect(onOct1.years[0].status).toBe('RNOR');
    expect(onOct2.years[0].daysInIndia).toBe(181);
    expect(onOct2.years[0].status).toBe('NR');
    expect(onOct1.shelteredYears).toBe(onOct2.shelteredYears);
  });
});

describe('return-date optimisation', () => {
  const lightVisitor: Scenario = {
    settledAbroadSince: '2012-06-01',
    visits: annualVisits(2013, 2025, 20),
    returnDate: '2026-06-01',
    profile: baseProfile,
  };

  it('finds the mid-July cliff that no calendar intuition would suggest', () => {
    const scan = scanReturnDates(lightVisitor, { earliest: '2026-06-01', latest: '2027-03-01' });
    const cliffs = findCliffs(scan);
    const gain = cliffs.find((c) => c.yearsGained > 0);
    expect(gain?.dateAfter).toBe('2026-07-12');
    expect(gain?.yearsGained).toBe(1);
    expect(gain?.firstRORBefore).toBe(2028);
    expect(gain?.firstRORAfter).toBe(2029);
  });

  it('moves the cliff to 1 February for a heavy visitor caught by the 60-day test', () => {
    const heavy: Scenario = { ...lightVisitor, visits: annualVisits(2018, 2025, 100) };
    const scan = scanReturnDates(heavy, { earliest: '2026-06-01', latest: '2027-03-20' });
    const gain = findCliffs(scan).find((c) => c.yearsGained > 0);
    expect(gain?.dateAfter).toBe('2027-02-01');
  });

  it('recommends the earliest date achieving the best outcome', () => {
    const scan = scanReturnDates(lightVisitor, { earliest: '2026-06-01', latest: '2027-03-01' });
    const rec = recommend(scan);
    expect(rec.bestDate).toBe('2026-07-12');
    expect(rec.daysToWait).toBe(41);
    expect(rec.yearsGained).toBe(1);
    expect(rec.baselineShelteredYears).toBe(rec.bestShelteredYears - 1);
  });

  it('warns about drift when the earliest date is already optimal', () => {
    // Starting after the July cliff, the best outcome is already in hand; the
    // real risk is slipping past the date where it falls away again.
    const scan = scanReturnDates(lightVisitor, { earliest: '2026-10-01', latest: '2027-12-31' });
    const rec = recommend(scan);
    expect(rec.outcome).toBe('hold-and-protect');
    expect(rec.yearsGained).toBe(0);
    expect(rec.protectUntil).toBeDefined();
    expect(rec.yearsAtRisk).toBeGreaterThan(0);
    // The date it tells you to protect must really be the last good one.
    const protectIdx = scan.findIndex((s) => s.returnDate === rec.protectUntil);
    expect(scan[protectIdx].shelteredYears).toBe(rec.bestShelteredYears);
    expect(scan[protectIdx + 1].shelteredYears).toBeLessThan(rec.bestShelteredYears);
  });

  it('reports a genuinely flat window as flat', () => {
    const scan = scanReturnDates(lightVisitor, { earliest: '2026-10-01', latest: '2026-11-01' });
    expect(recommend(scan).outcome).toBe('flat');
  });

  it('labels a window that starts before the cliff as a gain', () => {
    const scan = scanReturnDates(lightVisitor, { earliest: '2026-06-01', latest: '2027-03-01' });
    expect(recommend(scan).outcome).toBe('gain-available');
  });

  it('refuses a scan window that is too wide to be meaningful', () => {
    expect(() =>
      scanReturnDates(lightVisitor, { earliest: '2026-01-01', latest: '2032-01-01' }),
    ).toThrow(/four years/);
  });

  it('rejects a return date before the date of leaving India', () => {
    expect(() => project({ ...lightVisitor, returnDate: '2010-01-01' })).toThrow();
  });
});
