# Citation Onboarding — Historical Training Bulk Load

**From:** Select Lifestyles Limited (Learning Disability provider)
**Re:** Bulk-loading historical staff training records into Atlas
**Date:** 2026-06-10

## What this is

A cleaned, verified set of historical training records for bulk entry into
Atlas, so existing currency/expiry shows correctly rather than re-entering 1,300+
records by hand. Compiled from our training database **plus** a full audit of 102
paper attendance sheets (which recovered ~6 months of sessions missing from the
spreadsheet).

## Files

- **`Citation_Bulk_Load.xlsx`** — sheet **"Bulk Load"** = the records to load;
  sheet **"Held - needs HR name check"** = 7 records excluded pending a name check
  (don't load these yet).
- **`Citation_Bulk_Load.csv`** — same Bulk Load data, plain CSV.

## Columns

| Column | Notes |
|---|---|
| Full Name | Staff member — should match the Atlas staff record |
| Training Course | Course name (see mapping note below) |
| Completed Date | **DD/MM/YYYY** |
| Expiry Date | **DD/MM/YYYY**; blank = one-time course, no expiry |
| Interval (yrs) | 1 or 3; blank = no expiry. The expiry already reflects this. |
| Status | OVERDUE / EXPIRING / CURRENT / NO EXPIRY (as at 04/06/2026) — informational |

## Counts (to reconcile against your load)

- **Records to load: 1,351**
  - With expiry date: 1,244
  - No expiry (one-time): 107
  - By status: OVERDUE 296 · EXPIRING 0–30d 16 · EXPIRING 31–60d 7 · CURRENT 925 · NO EXPIRY 107
- Held / excluded (name check): **7**  → 1,351 + 7 = 1,358 verified total
- Unique staff: 408 · Unique courses: ~34

## Questions for your onboarding team (please confirm)

1. **Can you bulk-load historical results with our own completion AND expiry
   dates** (i.e. set arbitrary/back-dated expiry), rather than Atlas
   auto-calculating expiry from a course interval? This matters because some of
   our expiries are back-dated and several courses are "no expiry".
2. **What exact file format / template do you need?** We can match it — column
   order, date format, a staff/course ID instead of name, separate files per
   course, etc. Tell us and we'll regenerate.
3. **Staff matching:** do you match on full name, email, or an Atlas staff ID?
   If ID/email, send us the staff list and we'll map.
4. **Course matching:** do our course names need to match your Atlas course
   library exactly? If so, please share the course list so we can reconcile
   (a few of our labels may differ). Any course not in Atlas — can you create it
   as part of onboarding?
5. **One-time / no-expiry courses (107):** confirm these load with a blank
   expiry and won't be auto-flagged as overdue.
6. **Turnaround & priority:** the **296 OVERDUE** are the priority — can these go
   first if a staged load is easier?

## Notes / assumptions to flag

- **Interval assumptions:** Makaton, Record Keeping, Risk Assessment, Driver
  Safety aren't in the core CQC list — we defaulted them to a **3-year** expiry.
  If your standard differs, tell us and we'll adjust before load.
- **Authority for intervals:** Skills for Care Statutory & Mandatory Training
  Guide (2025); NICE SC1/NG67; CQC Regulation 18.
- **Held 7:** uncertain handwritten surnames on 2026 attendance sheets — withheld
  to avoid creating duplicate/mis-named staff; we'll supply once HR confirms.

## If bulk load isn't possible

If Atlas can't import historical results with arbitrary expiry dates via your
team, we'll fall back to assisted manual entry (priority: the 296 OVERDUE first).
Please confirm which path applies.
