---
name: Income Forecast — June 2026 to March 2027 (forecast from May actuals)
description: Extended the Income_forecast_2026.xlsx forecast through March 2027, based on May payments, with an April sense-check for missed payments.
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
**Basis:** May 2026 actual payments, replicated forward. April 2026 used as a sense-check for any payment missed in May.

## What was done

1. **Confirmed the forecasting rule** from the existing populated months. Each payer's May payment pattern (same weekday, same amount, same cadence) is repeated into every forward month. The rule was reverse-engineered and **reproduces the existing June→December sheets exactly** (verified cell-by-cell, all 7 months match).
2. **Extended the forecast to March 2027** by adding three new tabs — `January 27`, `February 27`, `March 27` — built with the identical rule. (The workbook previously stopped at `December 26`.)
3. **Ran the April vs May sense-check** — no missed payments found.

## Forecasting rule (per payer)

| Cadence | Payers | How it's placed |
| --- | --- | --- |
| **Weekly** (every occurrence of a fixed weekday) | Birmingham CC SL (Thu £59,419.08), Wolv Daycare (Thu £5,606.30), Walsall Respite (Tue £11,460.80), Ideal (Fri £4,131.62), Kirklees (Tue £5,458.48), Hillingdon (Wed £5,203.80), NHS B&S (Thu £7,814.17), NHS Black Country (Thu £5,499.45), Solihull SL (Sun £33,031.60), Walsall SL (Tue £319,655.76), Wolv SL (Thu £132,264.95), People Plus (Thu £21,527.20), Middlesbrough (Thu £6,115.40) | Same weekday, every week |
| **Fortnightly** (specific weekday ordinals) | Sandwell Respite (1st & 3rd Mon £41,250.75), Sandwell Daycare (1st & 3rd Fri £6,585.35), Sandwell SL (1st & 4th Mon £132,834.80) | Same ordinal weekday positions as May |
| **Daily flat £4,000** | Sandwell HB, Wolverhampton CC HB, Other HB and SC | £4,000 every calendar day |
| **One-off (carried forward)** | Chasing (1st Fri £5,266.40) | First Friday of each month |
| **No payments** | Haringey, Wolverhampton Respite, Walsall Daycare | Left blank (no basis in April or May) |

## April vs May sense-check — RESULT: no missed payments

Every payer that appears in April also appears in May at the **identical per-payment rate**. The only month-to-month differences are:
- the number of times a weekday lands in the month (e.g. 5 Thursdays in April vs 4 in May), and
- the daily £4,000 rows (30 days in April vs 31 in May).

The three payers with no May payment — **Haringey, Wolverhampton Respite, Walsall Daycare** — are also empty in April, so nothing was missed; they simply have no recurring payment to forecast.

## Forecast monthly totals (rows 3–25, incl. HB & SC)

| Month | Total |
| --- | --- |
| May 26 (actual basis) | £3,244,525.86 |
| June 26 | £3,531,937.68 |
| July 26 | £3,454,944.61 |
| August 26 | £3,240,394.24 |
| September 26 | £3,537,141.48 |
| October 26 | £3,449,740.81 |
| November 26 | £3,228,394.24 |
| December 26 | £3,787,388.03 |
| **January 27** | **£3,244,525.86** |
| **February 27** | **£3,171,362.64** |
| **March 27** | **£3,549,141.48** |

> Month-to-month variation is driven entirely by how many of each weekday fall in the month (4 vs 5) and the number of days (28/30/31). Cross-check: **January 27 = May 26 to the penny** — both are 31-day months starting on a Friday, so they share the same weekday layout and therefore the same forecast.

## Note on the wider payment schedule

The schedule you provided lists several lines that are **not tracked as rows** in this workbook and therefore have no amount basis to forecast from:
`West Northants - Supported Living`, `People Plus - Respite`, `Walsall - HB`, `Birmingham - HB`, `Other Respite`, `HB and SC`.

These were left out rather than inventing figures. If they should be forecast, supply (or point to) a recent actual payment for each and I'll add them with the same method. The "weeks until next payment" numbers you listed match the cadence already in the sheet (4 = weekly, 2 = fortnightly, 1 = the weekly Wolverhampton lines).
