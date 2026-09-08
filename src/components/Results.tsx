import type { Recommendation } from '../engine/optimize';
import type { Projection, Status, YearDetermination } from '../engine/types';
import { assessmentYearLabel } from '../engine/fy';

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

const STATUS_COPY: Record<Status, { name: string; taxed: string }> = {
  NR: { name: 'Non-resident', taxed: 'India taxes only your Indian-source income.' },
  RNOR: {
    name: 'Resident but not ordinarily resident',
    taxed:
      'India taxes your Indian-source income, plus income from a business controlled in or a profession set up in India. Your other foreign income stays outside the Indian net.',
  },
  ROR: {
    name: 'Resident and ordinarily resident',
    taxed: 'India taxes your worldwide income, including foreign pensions, rent and capital gains.',
  },
};

function StatusPill({ status }: { status: Status }) {
  const sheltered = status !== 'ROR';
  return (
    <span
      className={[
        'inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-semibold tracking-wide',
        sheltered ? 'bg-shelter/10 text-shelter' : 'bg-alarm/10 text-alarm',
      ].join(' ')}
    >
      {status}
    </span>
  );
}

/** A horizontal strip of financial years, so the cliff is visible at a glance. */
function Timeline({ years }: { years: YearDetermination[] }) {
  return (
    <div className="flex gap-1" role="list" aria-label="Projected status by financial year">
      {years.map((y) => (
        <div
          key={y.previousYear}
          role="listitem"
          className={[
            'flex-1 rounded-sm px-2 py-2.5 text-center',
            y.status === 'ROR' ? 'bg-alarm/10' : 'bg-shelter/10',
          ].join(' ')}
          title={`${y.label}: ${STATUS_COPY[y.status].name}`}
        >
          <div className="text-2xs text-ink-faint tnum">{y.label.replace('FY ', '')}</div>
          <div
            className={[
              'mt-0.5 text-xs font-semibold',
              y.status === 'ROR' ? 'text-alarm' : 'text-shelter',
            ].join(' ')}
          >
            {y.status}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Verdict({
  recommendation,
  projection,
}: {
  recommendation: Recommendation;
  projection: Projection;
}) {
  const {
    outcome,
    yearsGained,
    bestDate,
    daysToWait,
    baselineDate,
    protectUntil,
    yearsAtRisk,
    cliffs,
  } = recommendation;

  const tone =
    outcome === 'gain-available'
      ? 'border-shelter/30 bg-shelter/[0.04]'
      : outcome === 'hold-and-protect'
        ? 'border-accent/30 bg-accent/[0.05]'
        : 'border-paper-edge bg-paper-raised';

  const heading =
    outcome === 'gain-available'
      ? 'There is a date worth waiting for'
      : outcome === 'hold-and-protect'
        ? 'You are already on the right side of the line'
        : 'No cliff inside your window';

  return (
    <section aria-labelledby="verdict-heading" className="space-y-5">
      <div className={`rounded-lg border p-5 sm:p-6 ${tone}`}>
        <h2 id="verdict-heading" className="field-label">
          {heading}
        </h2>

        {outcome === 'gain-available' && (
          <>
            <p className="mt-2 font-serif text-2xl leading-snug text-ink sm:text-3xl">
              Arrive on or after{' '}
              <strong className="font-semibold text-shelter">{formatDate(bestDate)}</strong>.
            </p>
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">
              Waiting {daysToWait} {daysToWait === 1 ? 'day' : 'days'} past{' '}
              {formatDate(baselineDate)} buys you {yearsGained} further{' '}
              {yearsGained === 1 ? 'financial year' : 'financial years'} before India begins taxing
              your worldwide income. Your foreign pension, dividends, rent and capital gains stay
              outside the Indian net for that extra year.
            </p>
          </>
        )}

        {outcome === 'hold-and-protect' && protectUntil && (
          <>
            <p className="mt-2 font-serif text-2xl leading-snug text-ink sm:text-3xl">
              Do not let the move slip past{' '}
              <strong className="font-semibold text-accent">{formatDate(protectUntil)}</strong>.
            </p>
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">
              Every date from {formatDate(baselineDate)} to {formatDate(protectUntil)} gives you the
              same, best available outcome. Arriving after that costs {yearsAtRisk}{' '}
              {yearsAtRisk === 1 ? 'financial year' : 'financial years'} of shelter. The risk here
              is drift, not impatience: a delayed shipping container or a late school admission can
              quietly cost you a year of tax on your worldwide income.
            </p>
          </>
        )}

        {outcome === 'flat' && (
          <>
            <p className="mt-2 font-serif text-2xl leading-snug text-ink sm:text-3xl">
              Every date in your window gives the same answer.
            </p>
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">
              Across the dates you are considering, your status projection does not change. Widening
              the window, or correcting your day counts, may expose a cliff.
            </p>
          </>
        )}

        <p className="mt-4 text-sm text-ink-soft">
          Worldwide income first becomes taxable in{' '}
          <strong className="font-semibold text-ink">
            {projection.firstRORYear
              ? `FY ${projection.firstRORYear}-${String((projection.firstRORYear + 1) % 100).padStart(2, '0')}`
              : 'no year within the projection'}
          </strong>
          {projection.firstRORYear ? ` (${assessmentYearLabel(projection.firstRORYear)}).` : '.'}
        </p>
      </div>

      <div>
        <h3 className="field-label mb-2">Projected status, financial year by financial year</h3>
        <Timeline years={projection.years} />
      </div>

      {cliffs.length > 0 && (
        <div className="rounded-lg border border-paper-edge bg-paper-raised p-5">
          <h3 className="field-label">Where the answer flips</h3>
          <ul className="mt-3 space-y-3">
            {cliffs.map((c) => (
              <li key={c.dateAfter} className="text-sm leading-relaxed text-ink-soft">
                <span className="tnum font-medium text-ink">
                  Arriving {formatDate(c.dateAfter)} rather than {formatDate(c.dateBefore)}
                </span>
                {c.yearsGained > 0 ? ' buys you ' : ' costs you '}
                <strong
                  className={c.yearsGained > 0 ? 'font-semibold text-shelter' : 'font-semibold text-alarm'}
                >
                  {Math.abs(c.yearsGained)}{' '}
                  {Math.abs(c.yearsGained) === 1 ? 'sheltered year' : 'sheltered years'}
                </strong>
                {'. '}
                <span className="text-ink-faint">
                  One day either side of this date is the whole difference.
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function YearTable({ years }: { years: YearDetermination[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <caption className="sr-only">
          Residential status determination for each projected financial year
        </caption>
        <thead>
          <tr className="border-b border-paper-edge text-left">
            {[
              'Financial year',
              'Days in India',
              'Prior 4 yrs',
              'Prior 7 yrs',
              'Threshold applied',
              'Status',
              'Provisions relied on',
            ].map((h) => (
              <th key={h} scope="col" className="py-2 pr-4 font-semibold text-2xs uppercase tracking-[0.08em] text-ink-faint">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((y) => (
            <tr key={y.previousYear} className="border-b border-paper-edge/60 align-top">
              <th scope="row" className="py-2.5 pr-4 text-left font-medium text-ink tnum">
                {y.label}
              </th>
              <td className="py-2.5 pr-4 tnum text-ink-soft">{y.daysInIndia}</td>
              <td className="py-2.5 pr-4 tnum text-ink-soft">{y.daysInPreceding4Years}</td>
              <td className="py-2.5 pr-4 tnum text-ink-soft">
                {y.daysInPreceding7Years}
                {y.daysInPreceding7Years <= 729 && y.isResident && (
                  <span className="ml-1 text-2xs text-shelter">≤729</span>
                )}
              </td>
              <td className="py-2.5 pr-4 tnum text-ink-soft">{y.secondTestThreshold} days</td>
              <td className="py-2.5 pr-4">
                <StatusPill status={y.status} />
              </td>
              <td className="py-2.5 pr-4 text-2xs leading-relaxed text-ink-faint">
                {y.citations.join(', ') || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Reasoning({ years }: { years: YearDetermination[] }) {
  const materialFlags = years.flatMap((y) =>
    y.flags.filter((f) => f.material).map((f) => ({ ...f, year: y.label })),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {years.map((y) => (
          <div key={y.previousYear} className="border-l-2 border-paper-edge pl-4">
            <p className="text-sm font-medium text-ink">
              {y.label} — {STATUS_COPY[y.status].name}
            </p>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-soft">
              {y.secondTestThresholdReason} You were in India for {y.daysInIndia}{' '}
              {y.daysInIndia === 1 ? 'day' : 'days'}, with {y.daysInPreceding4Years} days across the
              preceding four years.{' '}
              {y.notOrdinarilyResidentBasis ?? ''}
            </p>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-faint">
              {STATUS_COPY[y.status].taxed}
            </p>
          </div>
        ))}
      </div>

      {materialFlags.length > 0 && (
        <div className="rounded-lg border border-accent/30 bg-accent/[0.05] p-5">
          <h3 className="field-label text-accent">Where reasonable people disagree</h3>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft">
            These points are genuinely unsettled, and the reading we took changed your answer. We
            show them rather than hide them behind one confident number.
          </p>
          <ul className="mt-4 space-y-4">
            {materialFlags.map((f) => (
              <li key={`${f.year}-${f.id}`}>
                <p className="text-sm font-medium text-ink">
                  {f.title} <span className="text-ink-faint">({f.year})</span>
                </p>
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-soft">
                  {f.assumption}
                </p>
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-faint">
                  {f.ifInsteadColumn}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
