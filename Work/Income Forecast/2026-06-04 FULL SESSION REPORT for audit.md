---
name: Income Forecast — Full Session Report (for audit)
description: Complete, faithful account of everything done in the Claude session that extended Income_forecast_2026.xlsx from June 2026 to March 2027. Written for independent audit.
type: report
created_at: 2026-06-04T00:00:00Z
updated_at: 2026-06-04T00:00:00Z
tags:
  - finance
  - forecast
  - income
  - report
  - audit
---

# Income Forecast — Full Session Report (for audit)

**Workbook:** `Income_forecast_2026.xlsx` (repo root of the Obsidian vault repo `etblues449/Obsidian-Vault-`)
**Branch:** `claude/relaxed-pasteur-5V11y` · **Draft PR:** #24
**Date of work:** 2026-06-04

> Scope note for auditors: this report covers a single working session. It records not only the final state but the **sequence of decisions, the one interpretation error that was made and corrected, and the bug the verification team caught**, so the trail can be checked end-to-end.

---

## 1. Objective

Extend a rolling cash-receipts income forecast for a care provider so that it runs **June 2026 → March 2027**, with each future month populated by repeating each funder's most-recent (May 2026) payment forward at the funder's own payment cadence. April 2026 is used as a control to confirm no payment was missed in May. HB/social-care rows are forecast at a flat £4,000/day.

## 2. Inputs & environment

- **Live workbook** `Income_forecast_2026.xlsx`: monthly tabs `Feb 26` … `December 26` existed at the start; each tab is a daily grid — row 1 weekday names, row 2 dates (column B = day 1), column A rows 3–25 = funders, last column = per-row Total (`=SUM`), row 26 = TOTAL (column sums).
- **An uploaded JSON transcript** of a prior Claude-for-Excel session (reconciliation of an earlier "amy vs me" May forecast). This was context only; the live workbook is the source of truth.
- **A prior vault note** `Work/Income Forecast/2026-05-10 Claude Excel session…md` documenting earlier methodology and reconciled actuals (e.g. March 2026 reconciled to £1,473,896.02; HB&SC = £4,000/day; Haringey £6,000 from May; date format, exclusions).
- **A payment schedule supplied by the user** giving each funder a number = "weeks until the next payment".

## 3. The funder cadence schedule (as supplied)

`4` = Birmingham CC SL, Haringey, Walsall Respite, Walsall Daycare, Ideal for All, Kirklees, LB Hillingdon, NHS Birmingham & Solihull ICB, NHS Black Country ICB, Sandwell HB, Solihull SL, Walsall SL, People Plus DP, People Plus Respite, Middlesbrough SL, West Northants SL, Wolverhampton CC HB, Walsall HB, Birmingham HB, Other HB and SC, Other Respite.
`2` = Sandwell Respite, Sandwell Daycare, Sandwell SL.
`1` = Wolverhampton Respite, Wolverhampton Daycare, Wolverhampton SL, HB and SC.

Rule stated by the user: *"the numbers are the amount of weeks until the next payment; all future payments are equal to the previous one; Other HB and SC is an average of £4000 a day."*

## 4. What was done, in order

1. **Parsed the JSON transcript and the live workbook** to understand structure and existing data. Found `June 26`–`December 26` were already populated (forecast from April in a prior session).
2. **First build (INCORRECT interpretation).** Derived the existing sheets' rule as "replicate each funder's May weekday pattern" and added `January 27`, `February 27`, `March 27` on that basis. This reproduced the existing June–December sheets exactly (verified cell-by-cell) — but it treated **4-weekly funders as weekly**, placing them on every matching weekday (4–5×/month). Monthly totals ≈ £3.2M. Committed/pushed.
3. **User pushback:** "I think you have got this wrong." Sent the file; user couldn't open the `.xlsx`; provided a GitHub raw download link and inline tables.
4. **Diagnosed** that the headline totals (~£3.2M) were ~2× the reconciled actuals because freq-4 funders were counted weekly. Surfaced the two readings and asked which was intended.
5. **User confirmed the literal reading:** `4 = every 4 weeks`.
6. **Rebuild (CORRECT interpretation).** Rebuilt **June 2026 → March 2027**: freq-4 = every 28 days, freq-2 = every 14 days, freq-1 = weekly, HB = £4,000/day, each freq-4/freq-2 funder anchored to its **last May payment** and stepped forward. Monthly totals dropped to ~£1.7–1.9M (consistent with reconciled actuals). Committed/pushed.
7. **User asked to apply the same cadence to May 26 (item 1 "yes").** Rebuilt May 26 on the same rule (anchored, stepped within May). Committed/pushed.
8. **Wrote a plain-English task brief** and this is where the "what am I trying to achieve" explanation was produced and saved.
9. **Verification team (two independent sub-agents).**
   - *Numbers Auditor* recomputed all ~7,700 forecast cells from the rules and diffed against the file → found **one genuine error**: `May 26 / Sandwell MBC – Daycare / 29 May` was blank but should be £6,585.35 (fortnightly chain 1→15→29; the May rebuild anchored to 15 and only stepped backward, dropping the 29th, even though the forward months already assumed it).
   - *Integrity Auditor* checked structure → all PASS (sheet order, dates/weekday headers, SUM formulas/ranges, freeze panes `B3`, no stray data, new tabs consistent). One cosmetic-only note: empty cells on the original Feb–Dec tabs are "General" format vs GBP on the three new tabs (no value affected).
10. **Fixed the bug:** added £6,585.35 to `May 26` Sandwell Daycare on 29 May. May total → £1,813,159.13. Committed/pushed.
11. **Composio:** initiated (but did **not** complete) a Google Sheets connection so the forecast could be exported to a cross-device Google Sheet. Connection requires the user's OAuth; not yet authorized.
12. **Declined an unrelated auth link.** The user pasted `clawhub.ai/cli/auth?…` (`label_b64` decodes to "CLI token"; same source as an earlier `clawdhub install cc-godmode` line). This is **not** the Composio link and is an unknown third-party CLI-token grant — I refused to open or complete it.

## 5. Final methodology (authoritative)

Each funder repeats its May per-payment amount forward at its cadence, anchored to its last May payment:

| Funder | Row | Cadence | Per payment | Anchor (last May) |
|---|---|---|---|---|
| Birmingham CC – SL | 3 | every 4 wks (28d) | £59,419.08 | 28 May |
| Haringey | 4 | — | none (empty Apr & May) | — |
| Sandwell MBC – Respite | 5 | fortnightly (14d) | £41,250.75 | 18 May |
| Sandwell MBC – Daycare | 6 | fortnightly (14d) | £6,585.35 | 29 May* |
| Wolverhampton – Respite | 7 | — | none (empty) | — |
| Wolverhampton – Daycare | 8 | weekly (Thu) | £5,606.30 | weekly |
| Walsall – Respite | 9 | every 4 wks | £11,460.80 | 26 May |
| Walsall – Daycare | 10 | — | none (empty) | — |
| Ideal for All – DP | 11 | every 4 wks | £4,131.62 | 29 May |
| Kirklees – SL | 12 | every 4 wks | £5,458.48 | 26 May |
| LB Hillingdon – SL | 13 | every 4 wks | £5,203.80 | 27 May |
| NHS Birmingham & Solihull ICB | 14 | every 4 wks | £7,814.17 | 28 May |
| NHS Black Country ICB | 15 | every 4 wks | £5,499.45 | 28 May |
| Sandwell – HB | 16 | daily | £4,000/day | flat |
| Sandwell MBC – SL | 17 | fortnightly (14d) | £132,834.80 | 25 May |
| Solihull MBC – SL | 18 | every 4 wks | £33,031.60 | 31 May |
| Walsall – SL | 19 | every 4 wks | £319,655.76 | 26 May |
| Wolverhampton – SL | 20 | weekly (Thu) | £132,264.95 | weekly |
| People Plus – DP | 21 | every 4 wks | £21,527.20 | 28 May |
| Middlesbrough – SL | 22 | every 4 wks | £6,115.40 | 28 May |
| Wolverhampton CC – HB | 23 | daily | £4,000/day | flat |
| Chasing | 24 | first Friday/month | £5,266.40 | not in schedule |
| Other HB and SC | 25 | daily | £4,000/day | flat |

\*Sandwell Daycare anchor corrected to 29 May after the audit (was effectively 15 May, dropping the 29th).

Behaviour of "every 4 weeks": a 28-day cycle yields ≈13 payments/year, so most months show one payment for a freq-4 funder and the occasional month catches two (e.g. March 27 catches a second Walsall SL, Kirklees, Hillingdon, Walsall Respite). This is correct, not a duplication.

## 6. Final monthly totals (rows 3–25, incl. HB & SC)

| Month | Total |
|---|---|
| May 26 (basis, rebuilt) | £1,813,159.13 |
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

> Note for auditors: the workbook's Total column and TOTAL row are `=SUM()` formulas with **no cached results** (openpyxl `data_only` returns None). The figures above are independent data-region recomputes; opening the file in Excel will calculate the same. The pre-existing Feb 26–April 26 / earlier actuals tabs were **not** in scope and were left as-is.

## 7. April vs May sense-check — no missed payments

Every funder active in April is also active in May at the **identical per-payment rate**; differences are only the number of weekday occurrences (e.g. 5 Thursdays in April vs 4 in May) and the day count on the £4,000/day rows. The three funders empty in May (Haringey, Wolverhampton Respite, Walsall Daycare) are empty in April too — nothing missed.

## 8. Open items / caveats (for the auditors to weigh)

1. **Six schedule lines are not rows in the workbook** and have no amount basis, so they were **excluded, not invented**: `West Northants SL`, `People Plus – Respite`, `Walsall – HB`, `Birmingham – HB`, `Other Respite`, `HB and SC`. Need a recent actual for each to include them.
2. **Anchor sensitivity.** Rebuilding May to the strict cadence shifted a couple of May dates vs the as-entered file (e.g. Sandwell SL 4 May → 11 May). Amounts unchanged; only the placement day moved.
3. **Cosmetic format inconsistency** (empty cells General vs GBP on new tabs) — no value impact; not corrected.
4. **"Chasing" (£5,266.40)** is not in the supplied schedule; it was carried forward as first-Friday/month to match the pre-existing tabs. Confirm whether it should remain.
5. **May 26 is now a forecast-style rebuild, not raw actuals.** If May should reflect the literal bank actuals instead of the modelled cadence, that needs the actual May bank data.
6. **Composio Google Sheets export** is initiated but not authorized; nothing has been pushed externally.

## 9. Commits on the branch (chronological)

1. Add Jan/Feb/Mar 27 tabs (first, weekly-multiplied interpretation).
2. Rebuild with literal cadence (4 = every 4 weeks) for June 26 → March 27.
3. Apply 4-weekly cadence to May 26.
4. Add task brief.
5. Fix missing May 29 Sandwell Daycare payment (found by audit).

All pushed to `claude/relaxed-pasteur-5V11y`; draft PR #24.
