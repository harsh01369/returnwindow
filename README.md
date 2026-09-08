# ReturnWindow

Indian tax residential status is decided one financial year at a time, and a
financial year ends on 31 March. For someone moving back to India, the date they
land can therefore move a whole year of worldwide-income exposure: a foreign
pension, vested shares, rental income and capital gains either fall inside the
Indian net or they do not.

Existing calculators answer a smaller question, "what is my status this year".
ReturnWindow scans every candidate return date across a window and finds the
exact days on which the answer changes.

## What it implements

Section 6 of the Income-tax Act, 1961, as amended by the Finance Act 2020:

- **s.6(1)(a)** - 182 days in the previous year, on its own.
- **s.6(1)(c)** - 60 days in the year plus 365 across the preceding four.
- **Explanation 1(a)** - 182 days instead of 60 in the year of leaving India
  for employment abroad.
- **Explanation 1(b)** and its proviso - 182 days for a citizen or person of
  Indian origin visiting India, reduced to 120 where Indian-source income
  exceeds 15 lakh rupees.
- **s.6(1A)** - deemed residence for an Indian citizen over the 15 lakh
  threshold who is liable to tax nowhere else.
- **s.6(6)** - both limbs: non-resident in nine of ten preceding years, or 729
  days or fewer across the preceding seven.

Each year's result records which limb decided it, so the output can be checked
rather than trusted.

## Two things worth knowing

**The binding constraint is rarely the year of return.** It is usually the
729-day limb of s.6(6)(a), measured across seven years preceding a year that has
not happened yet. In the worked case in the test suite it puts the decisive date
on 12 July: arriving on 11 July puts 730 days into the lookback and costs an
entire year of shelter. No calendar intuition would look there.

**The common risk is drift, not impatience.** Often the earliest date someone is
considering is already optimal, and the useful output is not "wait" but "do not
let this slip past 31 March".

## Judgements made openly

In the year of permanent return the engine applies the 60-day test rather than
182, because Explanation 1(b) extends the threshold only for a person who
"being outside India, comes on a visit to India", and moving home to settle is
not naturally a visit. That reading is contested. Where the alternative reading
would change the answer, the result says so on the page instead of quietly
picking one.

The site carries no Transfer of Residence customs allowance figure. Published
sources currently contradict each other, and none of them traces to a CBIC
notification. A gap is better than a confident wrong number.

This is not tax advice.

## Running it

```bash
npm install
npm run dev       # local development
npm test          # 31 tests over the statutory boundaries, including 729 vs 730
npm run build     # production build
```

Everything runs in the browser. No travel history, income figure or date is
transmitted, stored or logged, and there is no backend to leak them.
