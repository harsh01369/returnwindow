import { useMemo, useState } from 'react';
import { project, type Scenario } from './engine/residency';
import { recommend, scanReturnDates } from './engine/optimize';
import { visitsFromAnnualDays, yearsToDeclare, type AnnualDays } from './engine/input';
import { pyLabel } from './engine/fy';
import type { Profile } from './engine/types';
import { Reasoning, Verdict, YearTable } from './components/Results';

const DEFAULTS = {
  settledAbroadSince: '2014-06-01',
  earliest: '2026-10-01',
  latest: '2027-12-31',
};

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer gap-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-paper-edge text-accent focus:ring-accent"
      />
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-faint">{hint}</span>
      </span>
    </label>
  );
}

export default function App() {
  const [settledAbroadSince, setSettled] = useState(DEFAULTS.settledAbroadSince);
  const [earliest, setEarliest] = useState(DEFAULTS.earliest);
  const [latest, setLatest] = useState(DEFAULTS.latest);
  const [profile, setProfile] = useState<Profile>({
    isIndianCitizen: true,
    isPersonOfIndianOrigin: false,
    indianIncomeExceeds15Lakh: false,
    liableToTaxAbroad: true,
    leftIndiaForEmployment: true,
  });
  const [overrides, setOverrides] = useState<Record<number, number>>({});
  const [typicalDays, setTypicalDays] = useState(25);

  const declaredYears = useMemo(() => {
    try {
      return yearsToDeclare(settledAbroadSince, earliest);
    } catch {
      return [];
    }
  }, [settledAbroadSince, earliest]);

  const annual: AnnualDays[] = useMemo(
    () =>
      declaredYears.map((py) => ({
        previousYear: py,
        label: pyLabel(py),
        days: overrides[py] ?? typicalDays,
      })),
    [declaredYears, overrides, typicalDays],
  );

  const result = useMemo(() => {
    try {
      const scenario: Scenario = {
        settledAbroadSince,
        visits: visitsFromAnnualDays(annual),
        returnDate: earliest,
        profile,
      };
      const scan = scanReturnDates(scenario, { earliest, latest });
      const rec = recommend(scan);
      const best = project({ ...scenario, returnDate: rec.bestDate });
      return { rec, best, error: null as string | null };
    } catch (e) {
      return { rec: null, best: null, error: (e as Error).message };
    }
  }, [settledAbroadSince, annual, earliest, latest, profile]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-paper-edge">
        <div className="mx-auto flex max-w-6xl items-baseline justify-between gap-4 px-5 py-4">
          <span className="font-serif text-lg font-semibold tracking-tight text-ink">
            ReturnWindow
          </span>
          <span className="hidden text-xs text-ink-faint sm:block">
            Section 6, Income-tax Act 1961 &middot; nothing you type leaves your browser
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5">
        <section className="border-b border-paper-edge py-12 sm:py-16">
          <p className="field-label">For Indians planning the move home</p>
          <h1 className="mt-3 max-w-3xl font-serif text-3xl leading-[1.15] tracking-tight text-ink sm:text-5xl">
            The date you fly home is a tax decision worth years of income.
          </h1>
          <div className="mt-6 max-w-prose space-y-4 text-base leading-relaxed text-ink-soft">
            <p>
              India decides your residential status one financial year at a time, and a financial
              year ends on 31 March. Land on the wrong side of a threshold and your foreign pension,
              your vested shares, your rental income and your capital gains become taxable in India
              a full year earlier than they needed to.
            </p>
            <p>
              Most calculators answer a smaller question: what is my status this year. That misses
              the point. The constraint that usually binds is the{' '}
              <strong className="font-semibold text-ink">729-day limb of section 6(6)(a)</strong>,
              measured across the seven years preceding a year that has not happened yet. It can put
              the decisive date in the middle of July, where no calendar intuition would look for
              it.
            </p>
          </div>
        </section>

        <div className="grid gap-10 py-12 lg:grid-cols-[22rem_1fr] lg:gap-14">
          <form className="space-y-7" onSubmit={(e) => e.preventDefault()}>
            <div>
              <h2 className="font-serif text-xl font-semibold text-ink">Your situation</h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-faint">
                This runs entirely in your browser. Nothing is uploaded, stored or logged.
              </p>
            </div>

            <div>
              <label className="field-label" htmlFor="settled">
                When did you leave India to live abroad?
              </label>
              <input
                id="settled"
                type="date"
                className="field-input tnum"
                value={settledAbroadSince}
                onChange={(e) => setSettled(e.target.value)}
              />
            </div>

            <fieldset>
              <legend className="field-label">The window you are choosing within</legend>
              <div className="mt-1.5 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-faint" htmlFor="earliest">
                    Earliest
                  </label>
                  <input
                    id="earliest"
                    type="date"
                    className="field-input tnum"
                    value={earliest}
                    onChange={(e) => setEarliest(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-ink-faint" htmlFor="latest">
                    Latest
                  </label>
                  <input
                    id="latest"
                    type="date"
                    className="field-input tnum"
                    value={latest}
                    onChange={(e) => setLatest(e.target.value)}
                  />
                </div>
              </div>
            </fieldset>

            <div>
              <label className="field-label" htmlFor="typical">
                Days a year you typically spend in India
              </label>
              <input
                id="typical"
                type="number"
                min={0}
                max={365}
                className="field-input tnum"
                value={typicalDays}
                onChange={(e) => {
                  setTypicalDays(Number(e.target.value));
                  setOverrides({});
                }}
              />
              <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
                Only per-year totals matter: the Act sums whole years, so when in the year you
                travelled never changes the answer. Adjust any single year below.
              </p>
            </div>

            {annual.length > 0 && (
              <details className="rounded-md border border-paper-edge bg-paper-raised">
                <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-ink">
                  Adjust individual years ({annual.length})
                </summary>
                <div className="max-h-64 space-y-1.5 overflow-y-auto px-3 pb-3">
                  {annual.map((a) => (
                    <div key={a.previousYear} className="flex items-center gap-3">
                      <label
                        className="w-24 shrink-0 text-xs text-ink-faint tnum"
                        htmlFor={`y-${a.previousYear}`}
                      >
                        {a.label}
                      </label>
                      <input
                        id={`y-${a.previousYear}`}
                        type="number"
                        min={0}
                        max={365}
                        value={a.days}
                        onChange={(e) =>
                          setOverrides((o) => ({ ...o, [a.previousYear]: Number(e.target.value) }))
                        }
                        className="w-full rounded border border-paper-edge px-2 py-1 text-sm tnum focus:border-accent focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </details>
            )}

            <fieldset className="divide-y divide-paper-edge/70 border-t border-paper-edge pt-1">
              <legend className="sr-only">Profile</legend>
              <Toggle
                label="I am an Indian citizen"
                hint="Drives Explanation 1 to s.6(1) and the deemed-residence rule in s.6(1A)."
                checked={profile.isIndianCitizen}
                onChange={(v) => setProfile((p) => ({ ...p, isIndianCitizen: v }))}
              />
              {!profile.isIndianCitizen && (
                <Toggle
                  label="I am a person of Indian origin"
                  hint="A PIO gets the Explanation 1(b) relaxation on visits, but is never caught by s.6(1A)."
                  checked={profile.isPersonOfIndianOrigin}
                  onChange={(v) => setProfile((p) => ({ ...p, isPersonOfIndianOrigin: v }))}
                />
              )}
              <Toggle
                label="My Indian-source income exceeds 15 lakh rupees"
                hint="Total income other than income from foreign sources. Drops the visit threshold from 182 days to 120."
                checked={profile.indianIncomeExceeds15Lakh}
                onChange={(v) => setProfile((p) => ({ ...p, indianIncomeExceeds15Lakh: v }))}
              />
              <Toggle
                label="I am liable to tax in my country of residence"
                hint="If not, and you are an Indian citizen over the 15 lakh threshold, s.6(1A) deems you resident regardless of days."
                checked={profile.liableToTaxAbroad}
                onChange={(v) => setProfile((p) => ({ ...p, liableToTaxAbroad: v }))}
              />
              <Toggle
                label="I left India for employment abroad"
                hint="Explanation 1(a) gives you 182 days instead of 60 in the year you left."
                checked={!!profile.leftIndiaForEmployment}
                onChange={(v) => setProfile((p) => ({ ...p, leftIndiaForEmployment: v }))}
              />
            </fieldset>
          </form>

          <div className="space-y-12">
            {result.error ? (
              <div className="rounded-lg border border-alarm/30 bg-alarm/[0.04] p-5">
                <h2 className="field-label text-alarm">Check your dates</h2>
                <p className="mt-2 text-sm text-ink-soft">{result.error}</p>
              </div>
            ) : (
              result.rec &&
              result.best && (
                <>
                  <Verdict recommendation={result.rec} projection={result.best} />

                  <section aria-labelledby="workings">
                    <h2 id="workings" className="font-serif text-xl font-semibold text-ink">
                      The workings
                    </h2>
                    <p className="mt-1 max-w-prose text-sm text-ink-faint">
                      Every figure below is derived, not asserted. The provisions column names the
                      limb of the Act each year turned on.
                    </p>
                    <div className="mt-5">
                      <YearTable years={result.best.years} />
                    </div>
                  </section>

                  <section aria-labelledby="reasoning">
                    <h2 id="reasoning" className="font-serif text-xl font-semibold text-ink">
                      Why each year came out that way
                    </h2>
                    <div className="mt-5">
                      <Reasoning years={result.best.years} />
                    </div>
                  </section>
                </>
              )
            )}
          </div>
        </div>

        <section className="border-t border-paper-edge py-12" aria-labelledby="method">
          <h2 id="method" className="font-serif text-2xl font-semibold text-ink">
            What this tool relies on, and what it does not
          </h2>
          <div className="mt-6 grid gap-10 md:grid-cols-2">
            <div className="max-w-prose space-y-4 text-sm leading-relaxed text-ink-soft">
              <h3 className="font-serif text-base font-semibold text-ink">The tests we apply</h3>
              <p>
                <strong className="font-semibold text-ink">Section 6(1)(a)</strong> makes you
                resident on 182 days in India in the year, on its own.
              </p>
              <p>
                <strong className="font-semibold text-ink">Section 6(1)(c)</strong> makes you
                resident on 60 days in the year plus 365 days across the preceding four.
                Explanation 1(a) raises that 60 to 182 in the year you leave India for employment
                abroad. Explanation 1(b) raises it to 182 for an Indian citizen or person of Indian
                origin who, being outside India, comes on a visit, and its proviso lowers that to
                120 where Indian-source income exceeds 15 lakh rupees.
              </p>
              <p>
                <strong className="font-semibold text-ink">Section 6(1A)</strong> deems an Indian
                citizen resident, whatever their day count, if their Indian-source income exceeds 15
                lakh rupees and they are liable to tax in no other country.
              </p>
              <p>
                <strong className="font-semibold text-ink">Section 6(6)</strong> then asks whether a
                resident is ordinarily resident. You are not ordinarily resident if you were
                non-resident in nine of the ten preceding years, or present for 729 days or fewer
                across the preceding seven. Either limb is enough.
              </p>
            </div>

            <div className="max-w-prose space-y-4 text-sm leading-relaxed text-ink-soft">
              <h3 className="font-serif text-base font-semibold text-ink">
                Two judgements we made openly
              </h3>
              <p>
                In the year you move home for good, we apply the{' '}
                <strong className="font-semibold text-ink">60-day test, not 182</strong>.
                Explanation 1(b) extends the threshold only for a person who, being outside India,
                comes on a visit to India, and moving home to settle is not naturally a visit. Not
                everyone reads it that way. Where the other reading would change your answer, we say
                so on the result rather than quietly picking one.
              </p>
              <p>We count both the day you arrive and the day you leave as days in India.</p>

              <h3 className="pt-2 font-serif text-base font-semibold text-ink">
                What we deliberately do not tell you
              </h3>
              <p>
                We do not quote a Transfer of Residence customs allowance. Published sources
                currently contradict each other on the figure, and we will not print a number we
                cannot trace to a CBIC notification. We would rather leave a gap than fill it
                confidently and wrongly.
              </p>
              <p>
                This is not tax advice, and it is no substitute for a chartered accountant who can
                see your whole position. It is a way to find the dates worth asking them about.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-paper-edge">
        <div className="mx-auto max-w-6xl px-5 py-8 text-xs leading-relaxed text-ink-faint">
          <p className="max-w-prose">
            ReturnWindow computes residential status under the Income-tax Act, 1961 as amended by
            the Finance Act 2020. It runs wholly in your browser; no travel history, income figure
            or date is transmitted or stored. Verify any decision with a qualified adviser before
            you book a flight.
          </p>
        </div>
      </footer>
    </div>
  );
}
