# 01 — Runbook (do this, in order)

A colleague who has used Claude Code once should be able to follow this. Each stage
has a paste-in prompt in `prompts/`. Don't skip the review gates.

---

## Stage 0 — Setup (15 min)
1. Clone/open this repo and `cd` into `Work/HR-Training-Migration`.
2. `pip install -r requirements.txt`
3. Put the data files into `handover/data/` (these are NOT in git — get them from
   the secure transfer):
   - `PDF1.pdf`, `PDF2.pdf`  — the 102 scanned attendance pages
   - `TrainingRecordReport.xlsx` — the current Atlas export (Atlas ▸ Reports ▸
     Training Record Report ▸ Export to Excel). **Re-export this fresh.**
   - `Atlas_Training_Master_VERIFIED.xlsx` — the prior audit's master (optional)
   - already provided: `attendance_sheets_OCR_102pages.jsonl`,
     `Discrepancy_Report_PDF_vs_VERIFIED.xlsx`, a sample `sheet_records.csv`
4. Read `03_DATA_PROTECTION.md`. Set Atlas creds as env vars (don't enter them yet).
5. Paste **prompts/01_kickoff.md** into Claude Code.

## Stage 1 — Install tools (as needed)
Per `02_TOOLCHAIN.md`. For the quickest path you only need the pip install above
plus Claude Code's built-in vision for OCR. Add `playwright-skill` before Stage 6.

## Stage 2 — Extract the sheets → `sheet_records.csv`
Paste **prompts/02_ocr_extract.md**. Output: `data/sheet_records.csv`
(`full_name, course, completion_date, source`) + `data/ocr_review.csv` for
anything unreadable.
**Do the 13 pre-cutoff pages first** (P1 p1–2, 7–12, 19–25, 28–34) — they hold the
people the prior audit missed.
➤ **Review gate:** skim the CSV; fix obvious OCR errors; confirm dedup skipped the
known duplicate scans (p43–45, p53, p79, P2 p13).

## Stage 3 — Reconcile against Atlas → create/add lists
Paste **prompts/03_reconcile.md**. It runs `scripts/reconcile.py` and produces:
- `output/staff_to_create_in_atlas.csv` — people not in the Atlas portal, split into
  `MISSED-recover-from-scratch` (prior audit missed) vs `captured-awaiting-entry`.
- `output/records_to_add.csv` — training rows to enter.
- `output/reconciliation_full.csv`, `output/summary.txt`.

## Stage 4 — Create the missing staff in Atlas
1. Review `staff_to_create_in_atlas.csv`. The `MISSED...` people are highest priority.
2. Create each as a staff record in Atlas (job role, branch, start date — fill the
   template `templates/staff_to_create_in_atlas.csv` as you go).
3. **Re-export** the Atlas Training Record Report → overwrite `data/TrainingRecordReport.xlsx`.

## Stage 5 — Re-run the loop (repeat until full accuracy)
Re-run Stage 3. The **"staff to CREATE" count should drop**. Repeat Stages 4–5
until it reaches **0** — at that point every person on every sheet exists in Atlas
and `records_to_add.csv` is the complete, correct set of training rows.
➤ This is the loop you asked for: *not in Atlas → create-list → add → repeat for
full accuracy.*

## Stage 6 — Enter the training records into Atlas
Paste **prompts/04_atlas_entry.md**. Review `records_to_add.csv`, set
`approved_yes_no = yes`, then dry-run (visible browser, 3 rows) → confirm → submit
in small supervised batches. Every entry is logged; failures are screenshotted.

## Stage 7 — Final verification
Re-export Atlas one last time and re-run `reconcile.py`. Target end state:
- `staff to CREATE = 0`
- `records to ADD = 0`
- every sheet record shows `ALREADY IN ATLAS`.
Archive the final `reconciliation_full.csv` as the completion evidence (CQC audit
trail). Done.

---

### Definition of done
100% of attendance-sheet attendees exist as Atlas staff, and 100% of their
documented training sessions are recorded in Atlas, with a final reconciliation
showing zero gaps.
