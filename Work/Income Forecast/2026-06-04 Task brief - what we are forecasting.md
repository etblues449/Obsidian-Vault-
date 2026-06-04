---
name: Income Forecast — Task Brief (objective & method)
description: Plain-English explanation of what the June 2026 -> March 2027 income forecast task is trying to achieve, its method, and its rules.
type: brief
created_at: 2026-06-04T00:00:00Z
updated_at: 2026-06-04T00:00:00Z
tags:
  - finance
  - forecast
  - income
  - brief
---

# Income Forecast — what this task is trying to achieve

## Business context
Rolling income forecast for a care provider whose revenue comes from a fixed set of funders —
local authorities (Birmingham, Walsall, Sandwell, Wolverhampton, Solihull, Kirklees, Hillingdon,
Middlesbrough, West Northants, Haringey), NHS ICBs, and direct-payment bodies (Ideal for All,
People Plus) — plus a daily housing-benefit / social-care receipts stream ("HB and SC").

The workbook `Income_forecast_2026.xlsx` is a rolling cash-receipts forecast: one tab per month,
each a daily grid (a column per day, a row per funder), showing which payments land on which day
and the monthly total.

## Core objective
Project income forward from **June 2026 through March 2027**, month by month, populating each
future tab with the payments expected from every funder — a forward view of monthly cash
receipts ~a year out.

## Method
1. **Base it on May 2026's payments** — the most recent complete month. May defines who pays,
   how much, and on what rhythm. Future payments equal the previous (May) payment — no growth or
   rate changes, just repeating known recurring amounts forward.
2. **Sense-check May against April** — confirm nothing was *missed* in May (every funder paying in
   April also appears in May at the same rate). Result: April and May agreed; no missed payments.
3. **Timing from the payment schedule** — each funder has a cadence in "weeks until next payment":
   - 1 = weekly, 2 = fortnightly, 4 = every four weeks.
   Each funder is anchored to its **last May payment** and the same amount repeats forward at that
   interval (every 7 / 14 / 28 days) across June -> March.
   Key point: "4" = once every four weeks (~monthly), NOT every week.

## Special rules
- **HB / "Other HB and SC" = flat GBP4,000 per day** (averaged daily receipts, not scheduled invoices).
- **Amounts held constant** — future payments equal the most recent equivalent; no indexation.
- **No-activity funders stay blank** — no basis to forecast (Haringey, Wolverhampton Respite,
  Walsall Daycare).

## Definition of done
Every month Jun 2026 -> Mar 2027 fully populated with each funder's payments on the correct days at
the correct recurrence, amounts carried from May, producing believable monthly totals (~GBP1.7-1.9M)
that tie back to reconciled history — with April as the control proving May was a clean base.
