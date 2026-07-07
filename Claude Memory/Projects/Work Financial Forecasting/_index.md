# Work Financial Forecasting — Project Index

## Goal
Maintain the Select Lifestyles income forecast (`Income_forecast_2026.xlsm`) covering Feb 26 → March 27. Elliot acts as financial director on this workbook — owns the forecasting rules, reconciliations against MAR P / APR P / MAY P actuals, and structural decisions about how authority income is modelled.

## Status
- 14 monthly tabs live: Feb 26 → March 27
- March 26 ✓ reconciled to MAR P (£0 gap; £2,158,304.27 = £1,473,896.02 + £684,408.25 excluded)
- April 26 ✓ reconciled to APR P (`[Excluded-Org-1]` £75,000 removed; HB&SC £205,632)
- May 26 partial — first 8 days from MAY P actuals (£559,777); rest still forecast
- July 26 → March 27: forecast from June figures, monthly tabs created
- VBA preserved throughout — must keep using `openpyxl.load_workbook(data_only=False, keep_vba=True)`

## Methodology
- **Date format**: `1 February 2026` (`d mmmm yyyy`) in row 2 of every monthly sheet
- **Sheet naming**: `Feb 26`, `March 26`, …, `March 27` (full month name except Feb)
- **Source-of-truth for actuals**: monthly `P` tabs (MAR P, APR P, MAY P) contain all bank transactions; named-payer rows are extracted and the residual flows into "Other HB and SC"
- **Forecasting rules to honour**:
  - Wolverhampton Daycare = £5,606.30 every Thursday, split out of the Wolverhampton CC lump sum (subtract from SL on the same date)
  - Other HB and SC = flat £4,000/day in any forecast month
  - Haringey = £6,000 per 4-weekly payment from May 26 onwards (April £19,385 was backdated, do not propagate)
  - Excluded from HB&SC residual: `[Excluded-A]`, `[Excluded-B]`, `[Internal-Company]` (3 variants), `[Excluded-Org-1]`
- **Payer frequencies**: see frequency table in [[Work/Income Forecast/2026-05-10 Claude Excel session - Feb to Mar 27 forecast]]
- **Anonymisation**: care-recipient and internal-company names replaced with codes in the vault transcript; real-name mapping lives only on the work-controlled device, never in this repo

## Key decisions
- Forecast horizon fixed at Feb 26 → March 27 (14 months, one tab each)
- "Other HB and SC" modelled as £4,000/day rather than per-recipient — too many sub-£1,000 entries to justify itemising
- Wolverhampton Daycare extracted from the CC lump sum because the bank entries combine Daycare + SL; restoring the £5,606.30 Thursday split keeps SL comparable across months
- Forecast months derive from the most recent actuals available (June actuals → Jul 26 onwards), not from the same-month-prior-year
- Internal-company transfers are excluded from income, not just netted — keeps "income" clean for the director view
- Workbook is `.xlsm`; never resave through a path that strips VBA

## Next actions
- [ ] Replace remaining May 26 forecast with MAY P actuals once the full month lands
- [ ] Bring June 26 actuals in from JUN P and re-base Jul 26 → Mar 27 if patterns shift
- [ ] Confirm `[Excluded-Org-1]` and `[Org-Reference-4]` classification (flagged in April as likely-not-HB&SC)
- [ ] Decide whether Walsall SL doubled-up June figure (£686,155 vs £343,077 baseline) should persist or normalise
- [ ] Set up a reconciliation check that runs each month: `[Month] tab total + excluded == [MONTH] P Grand Total`

## Reference
- Full session transcript + reconciliation evidence: [[Work/Income Forecast/2026-05-10 Claude Excel session - Feb to Mar 27 forecast]]
- Workbook location: `vault/Income_forecast_2026.xlsx` (current copy); production `.xlsm` lives on the work device
