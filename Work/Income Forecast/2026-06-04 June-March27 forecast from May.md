---
name: Income Forecast — June 2026 to March 2027 (forecast from May actuals)
description: Forecast June 2026 -> March 2027 in Income_forecast_2026.xlsx, based on May payments, using the literal payment schedule (weeks until next payment). April used as a sense-check.
type: working-note
created_at: 2026-06-04T00:00:00Z
updated_at: 2026-06-04T00:00:00Z
tags:
  - finance
  - forecast
  - income
---

# Income Forecast — June 2026 → March 2027

**Workbook:** `Income_forecast_2026.xlsx` (repo root)
**Basis:** May 2026 payments, projected forward. April used as a sense-check for any payment missed in May.

## Cadence rule (confirmed) — "weeks until next payment"

The schedule number = **weeks between payments**, taken literally:

| Schedule no. | Meaning | Payment lands |
| --- | --- | --- |
| **4** | every 4 weeks | once every 28 days (~monthly, occasionally 2 in a month) |
| **2** | every 2 weeks | fortnightly (2–3 per month) |
| **1** | weekly | every week (4–5 per month) |

Each payer is **anchored to its last payment in May** and stepped forward by its cadence. Amounts equal the previous payment. HB rows are a flat **£4,000/day**. The "Chasing" line (not in the schedule) is carried as £5,266.40 on the first Friday of each month.

> **Correction made this session:** the months previously in the workbook (and an earlier draft of these new tabs) placed the **4-weekly** payers on *every* week — inflating monthly totals to ~£3.2M. That has been corrected to the literal "every 4 weeks", bringing totals to ~£1.7–1.9M, consistent with the reconciled actuals (March 2026 = £1.47M; prior forecasts £1.7–2.0M). **June 2026 → March 2027 were all rebuilt.**

## Per-payer cadence & amount (anchored to last May payment)

| Payer | Cadence | Per payment | Last May payment |
| --- | --- | --- | --- |
| Birmingham CC – SL | every 4 wks | £59,419.08 | 28 May |
| Walsall – SL | every 4 wks | £319,655.76 | 26 May |
| Walsall – Respite | every 4 wks | £11,460.80 | 26 May |
| Kirklees – SL | every 4 wks | £5,458.48 | 26 May |
| LB Hillingdon – SL | every 4 wks | £5,203.80 | 27 May |
| NHS Birmingham & Solihull ICB | every 4 wks | £7,814.17 | 28 May |
| NHS Black Country ICB | every 4 wks | £5,499.45 | 28 May |
| Solihull MBC – SL | every 4 wks | £33,031.60 | 31 May |
| People Plus – DP | every 4 wks | £21,527.20 | 28 May |
| Middlesbrough – SL | every 4 wks | £6,115.40 | 28 May |
| Ideal for All – DP | every 4 wks | £4,131.62 | 29 May |
| Sandwell MBC – Respite | fortnightly | £41,250.75 | 18 May |
| Sandwell MBC – Daycare | fortnightly | £6,585.35 | 15 May |
| Sandwell MBC – SL | fortnightly | £132,834.80 | 25 May |
| Wolverhampton – SL | weekly (Thu) | £132,264.95 | weekly |
| Wolverhampton – Daycare | weekly (Thu) | £5,606.30 | weekly |
| Sandwell – HB | daily | £4,000/day | flat |
| Wolverhampton CC – HB | daily | £4,000/day | flat |
| Other HB and SC | daily | £4,000/day | flat |
| Haringey / Wolv Respite / Walsall Daycare | — | none | empty in Apr & May |

## April vs May sense-check — no missed payments

Every payer active in April is also active in May at the **identical per-payment rate**. The three empty payers (Haringey, Wolverhampton Respite, Walsall Daycare) are empty in both months, so nothing was missed.

## Forecast monthly totals (rows 3–25, incl. HB & SC)

| Month | Total |
| --- | --- |
| May 26 (basis) | £1,813,159.13 *(rebuilt to the same 4-weekly cadence)* |
| June 26 | £1,798,661.31 |
| July 26 | £1,907,281.81 |
| August 26 | £1,902,245.36 |
| September 26 | £1,757,410.56 |
| October 26 | £1,913,867.16 |
| November 26 | £1,798,661.31 |
| December 26 | £1,907,281.81 |
| January 27 | £1,769,410.56 |
| February 27 | £1,733,410.56 |
| March 27 | £2,244,024.20 |

> Variation comes from the 28-day cycles drifting through the calendar — some months catch a second payment for a 4-weekly payer (e.g. March 27 catches a second Walsall SL, Kirklees, Hillingdon and Walsall Respite), which is the correct behaviour of "every 4 weeks" (≈13 payments/year).

## Open items
- **May 26** has now been rebuilt to the same 4-weekly cadence (£1,813,159.13). Note: this changes a few May dates from the as-entered version (e.g. Sandwell SL 4→11 May) as a side effect of anchoring strictly to the cadence.
- Six lines on your wider schedule are **not rows** in the workbook and have no amount basis: `West Northants SL`, `People Plus - Respite`, `Walsall - HB`, `Birmingham - HB`, `Other Respite`, `HB and SC`. Provide a recent actual for any and I'll add them.
