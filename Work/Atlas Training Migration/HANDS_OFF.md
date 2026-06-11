# HANDS-OFF RUN — Atlas Training Migration (Claude in Chrome)

Run this **autonomously**: you (Claude) open the form, fill it, **and click Add
yourself** — no pausing for confirmation on each record. You still keep the few
hard safety rules below, because hands-off is exactly when a single wrong action
repeats hundreds of times.

> Operating inside Elliot's logged-in Atlas tab (Select Lifestyles Limited).
> Data: `work_queue.csv` (1,358 records, OVERDUE first). Dates DD/MM/YYYY.

---

## NON-NEGOTIABLE GUARDS (keep even when hands-off)
1. **"Add training to" = Employee only.** Never All employees / Site / Department
   / Employee group. If it's not "Employee", do not click Add.
2. **Add-only.** Only the Add Training panel + Add button. Never delete, edit,
   import, or "Update Employees", and never click a delete/remove icon.
3. **One correct, existing person per record.** If not found after variant search
   (below), log MISSING and skip — never create a new employee.
4. **Backup first** (⋮ → EXPORT) before entering anything.
5. **Self-verify** (see checkpoints) — don't run blind to the end.

## Per-record (repeat automatically, in file order)
1. ⋮ → **Add Training**.
2. **Add training to** → **Employee**.
3. **Employee** → type `full_name`; if "No Result Found", try **surname only**,
   **first name**, and obvious spelling variants (Renae→Renee, Jo→Joanne,
   Eliott→Elliot). If a variant matches the same person, use them. If still not
   found → **MISSING** (log record_id+name+course), skip.
4. **Course** → type `training_course`, pick the match. No match → **ERROR
   "course missing"**, skip (don't guess).
5. **Start date** = `completed_date`. **Completed date** = `completed_date`.
6. **Expiry date** = `expiry_date` (blank if `has_expiry` = NO).
7. Leave code/CPD/grade/provider/description blank.
8. **Dedupe:** if Atlas already shows this person+course with the same completed
   date, **SKIPPED** (don't add again).
9. Click **Add**; confirm it saved.
10. Log outcome against `record_id`: DONE / SKIPPED / MISSING / HOLD / ERROR.

## Skip automatically — the 7 HOLD records
ATL-0106 Amy Bastonoli · ATL-0130 Ann Guash · ATL-0340 David Rimbould ·
ATL-0432 Fatima Kaanom · ATL-0561 Jade Millican · ATL-1124 Salimatu Gesay ·
ATL-0930 Oghenekharo. Mark HOLD, do not enter.

## Checkpoints (mandatory, even hands-off)
- **First 3 records:** after saving, open those people's Training in Atlas and
  confirm the dates landed right — especially **ATL-0006 = 13/11/2024 must read
  as 13 November 2024**. If wrong, STOP and report (don't continue).
- **Then run continuously**, but every **50 records** post a tally
  (DONE/SKIPPED/MISSING/ERROR + any ERROR/MISSING ids).
- **After the 296 OVERDUE**, pause once and report before doing the rest.

## STOP immediately and report if…
- A CAPTCHA / "unusual activity" warning, or you get logged out.
- The 13/11/2024 date won't save (format problem).
- **3 errors in a row**, or the same error repeating (systematic problem).
- Any delete/confirm/"are you sure" dialog, or anything outside the Add Training
  flow.
- A course is missing for many records (needs an admin to create it).

## End
Reconcile: `DONE + SKIPPED + MISSING + HOLD(7) + ERROR = 1,358`. Report the final
tally and the MISSING + ERROR lists for Elliot to finish manually.

---
**Note:** the in-browser Claude may still insist on confirming some steps — that's
its own safeguard, not something this file overrides. If it won't run fully
hands-off, let it; supervised is slower but safe.
