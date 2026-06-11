# HANDOVER — Atlas Training Migration (Claude in Chrome)

**Full operating brief.** Paste this whole file into the Claude panel in the
Atlas browser tab, attach `work_queue.csv`, and tell it to begin.

---

## 1. Who you are / what you're doing
You are operating **inside Elliot's logged-in Citation Atlas tab**
(`hrhs.atlas-hub.co.uk`, org: **Select Lifestyles Limited**, a Learning
Disability provider). You can see the page — work **visually**, you don't need
CSS selectors. Your job: enter **1,358 historical staff training records** into
Atlas through the **"Add Training"** form, one record at a time, accurately, and
without creating duplicates or wrong people.

This is a CQC-compliance migration: the records are real training that staff
have done; Atlas needs them so currency/expiry tracking is correct.

## 2. The data
- Source: **`work_queue.csv`** (attached). 1,358 rows, already sorted with the
  **296 OVERDUE records first**, then expiring, then current, then no-expiry.
- Columns: `record_id, status, training_course, full_name, completed_date,
  expiry_date, has_expiry, flag` (plus a few you can ignore).
- **Dates are DD/MM/YYYY** (UK). 09/09/2024 = 9 September 2024.
- A second file, **`entry_log.csv`**, lists every record_id with blank
  `outcome` / `atlas_note` columns — fill it in as you go (this is the audit
  trail and the reconciliation at the end).

## 3. Where the form is
Left sidebar **Employees / Workers → Manage** → top-right **⋮** (the three-dots
button next to the pink **"Add Employee / Worker"**) → **Add Training**.
A side panel titled **"Add training history details"** opens.

## 4. Per-record procedure (repeat for each row, in file order)
1. Open the **Add Training** panel (⋮ → Add Training).
2. **"Add training to"** → select **Employee**.
3. **Employee** box → type `full_name`, wait for suggestions, click the matching
   person.
   - If it shows **"No Result Found"** → outcome = **ERROR**, note "staff not
     found", close the panel, move on. **Never create a new employee.**
   - If several people share the name and you can't tell which → **ERROR**,
     "ambiguous staff", move on.
4. **Course** → type `training_course`, pick the matching course.
   - No match in Atlas's list → **ERROR**, "course missing", move on. Don't
     guess or pick a near-name. (See §7 on course-name differences.)
5. **Start date** → `completed_date`. (We only hold a completion date, and Start
   is required, so use the completion date here too.)
6. **Completed date** → `completed_date`.
7. **Expiry date** → `expiry_date`.
   - If `has_expiry` = **NO** (a one-time course), **leave Expiry blank**.
8. Leave Course code / CPD / grade / provider / description **blank**.
9. Click **Add**. Confirm the panel closes / a success message shows.
10. Write the outcome in `entry_log.csv` against this `record_id`:
    **DONE / SKIPPED / HOLD / ERROR** + a short note.

## 5. Hard rules
- **HOLD — skip these 7 records** (uncertain handwritten surnames; entering them
  risks creating a wrong/duplicate staff member). Mark each **HOLD**, don't
  enter:
  | record_id | name | course |
  |---|---|---|
  | ATL-0106 | Amy Bastonoli | PRICE (PBS) |
  | ATL-0130 | Ann Guash | PRICE (PBS) |
  | ATL-0340 | David Rimbould | Moving & Handling |
  | ATL-0432 | Fatima Kaanom | Moving & Handling |
  | ATL-0561 | Jade Millican | Moving & Handling |
  | ATL-1124 | Salimatu Gesay | Record Keeping |
  | ATL-0930 | Oghenekharo | Induction |
  (They're also tagged `flag = HOLD-HR-NAME` in the data.)
- **No duplicates.** Before saving, if Atlas already shows that **person +
  course** with the **same completed date**, don't add it again → **SKIPPED**,
  note "already in Atlas".
- **Never invent** a name, course, or date. Unsure about anything → **ERROR**,
  note why, move on. Accuracy beats completeness.
- **Order:** go top-to-bottom in the file (OVERDUE first). Don't skip ahead.
- **Pace:** a few seconds per record; don't machine-gun it.

## 6. Dates — important check
The format is **DD/MM/YYYY**. The first unambiguous test is **ATL-0006**:
`13/11/2024` must save as **13 November 2024**. If Atlas rejects it (treats 13 as
a month), the date field wants a different format — **stop and tell Elliot**
before doing more.

## 7. Course-name differences
Our course labels may not match Atlas's library exactly (e.g. "PRICE (PBS)",
"Moving & Handling", "MCA / DoLS", "First Aid"). Pick the course in Atlas that
clearly corresponds. If there's genuinely no matching course in Atlas, that
course needs creating by an admin — log those records **ERROR "course missing"**
and list the course names for Elliot rather than forcing a wrong match.

## 8. Pause-and-tell-Elliot conditions
- A **CAPTCHA** or **"unusual activity"** warning.
- You get **logged out** / asked to re-authenticate.
- The **13/11/2024** date won't save (format issue).
- A course is missing for many records (needs admin to add it).
- Anything that would require guessing a person's identity.

## 9. Reporting & reconciliation
- After **every 25 records**, post a running tally:
  **DONE / SKIPPED / HOLD / ERROR**, plus the `record_id`s of any ERRORs.
- Keep `entry_log.csv` updated so the final state is auditable.
- **Target reconciliation:** `DONE + SKIPPED + HOLD(7) + ERROR = 1,358`.
- Address the **296 OVERDUE** first — those are the compliance priority.

## 10. Authority for the data (already agreed — no need to re-decide)
Intervals from Skills for Care Statutory & Mandatory Training Guide (2025) +
NICE SC1/NG67 + CQC Regulation 18. Makaton, Record Keeping, Risk Assessment,
Driver Safety = **3-year** (signed off by Elliot). 107 one-time courses
(induction, Care Certificate, etc.) have **no expiry**. Expiry dates are already
calculated in the data — just enter them.

## 11. Start here (first 3, report each before continuing)
| record_id | full_name | course | completed | expiry |
|---|---|---|---|---|
| ATL-0001 | Abduli Msongo | Epilepsy | 09/09/2024 | 09/09/2025 |
| ATL-0003 | Abduli Msongo | Medication | 09/09/2024 | 09/09/2025 |
| ATL-0006 | Abdulrahmon Ayo Hussein | PRICE (PBS) | 13/11/2024 | 13/11/2025 |

Do these three, confirm they saved correctly in Atlas (open the person's
Training to verify the dates), report the results, then continue through the
file.
