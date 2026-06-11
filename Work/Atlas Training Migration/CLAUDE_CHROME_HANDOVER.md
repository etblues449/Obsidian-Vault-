# HANDOVER — Atlas training migration (for Claude in Chrome)

You are operating **inside Elliot's logged-in Atlas browser tab**. Your job is to
enter historical staff training records into Atlas via the "Add Training" form.
You can see the page, so work visually — you do not need CSS selectors.

## Context
- Org: **Select Lifestyles Limited** (Learning Disability provider) in Citation
  **Atlas** (`hrhs.atlas-hub.co.uk`). Elliot is logged in.
- Source data: **1,358 verified training records** in `work_queue.csv`
  (priority-sorted: 296 OVERDUE first). Elliot will paste rows to you, or you
  read them from the file he provides. Columns:
  `record_id, status, training_course, full_name, completed_date, expiry_date,
   has_expiry, flag, ...`
- Dates are **DD/MM/YYYY**.

## Where the form is
Left sidebar **Employees / Workers → Manage** → top-right **⋮** (next to the pink
"Add Employee / Worker") → **Add Training**. A panel "Add training history
details" opens.

## Per-record steps (one record at a time)
1. Open the Add Training panel (as above).
2. **Add training to** → choose **Employee**.
3. **Employee** box → type the `full_name`, wait for the suggestion, click the
   matching person. If it says **"No Result Found"**, STOP this record, log it as
   ERROR "staff not found", move on. Never create a new employee.
4. **Course** → type `training_course`, pick the matching course. If none
   matches, STOP, log ERROR "course missing", move on. Don't guess.
5. **Start date** → `completed_date` (we only hold the completion date; Start is
   required, so use it here too).
6. **Completed date** → `completed_date`.
7. **Expiry date** → `expiry_date`. If `has_expiry` is NO (one-time course),
   leave Expiry blank.
8. Click **Add**. Confirm the panel closes / a success appears.
9. Record the outcome (DONE / SKIPPED / ERROR + reason) against `record_id`.

## Hard rules
- **Skip the 7 `flag = HOLD-HR-NAME` records** (uncertain surnames). Mark HOLD.
- **No duplicates:** if Atlas already shows that person + course with the same
  completed date, skip it (SKIPPED).
- **Never invent** a name, course, or date. Unsure → ERROR and move on.
- Go **OVERDUE first** (the file is already in that order).
- Pace yourself (a few seconds per record); if a CAPTCHA / "unusual activity"
  appears, stop and tell Elliot.

## Progress / reporting
- Keep a running tally: DONE / SKIPPED / HOLD / ERROR, by `record_id`.
- Target reconciliation: `DONE + SKIPPED + HOLD(7) + ERROR = 1,358`.
- After each batch (say 25), report the tally and any ERROR record_ids so Elliot
  can follow up.

## Known form facts (captured 2026-06-10)
- "Add training to" dropdown options: All employees / Site / Employee group /
  Department or team / **Employee** (use Employee).
- Employee and Course are **type-to-search autocompletes**.
- Start / Completed / Expiry are calendar fields that also accept typed
  DD/MM/YYYY.
- The form is bulk-capable but we use it one person at a time for per-record
  dates.

## Authority for the data (already agreed)
Intervals: Skills for Care (2025) + NICE SC1/NG67 + CQC Reg 18. Makaton, Record
Keeping, Risk Assessment, Driver Safety = 3-year (signed off). 107 one-time
courses have no expiry.

## First three records (to start / sanity-check)
| record_id | full_name | course | completed | expiry |
|---|---|---|---|---|
| ATL-0001 | Abduli Msongo | Epilepsy | 09/09/2024 | 09/09/2025 |
| ATL-0003 | Abduli Msongo | Medication | 09/09/2024 | 09/09/2025 |
| ATL-0006 | Abdulrahmon Ayo Hussein | PRICE (PBS) | 13/11/2024 | 13/11/2025 |

Do ATL-0006 carefully — 13/11/2024 must read as **13 November 2024** (UK format).
If Atlas rejects it as an invalid date, the field wants a different format — flag
that to Elliot before continuing.
