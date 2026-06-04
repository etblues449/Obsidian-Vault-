# HR Training Records Migration

Migrate historical employee training records (paper attendance sheets + assorted
spreadsheets) into **Citation Atlas**, for a UK adult social care provider.

This toolkit does steps 2-5 in plain Python you can run today, and wires up the
two external Claude Code skills that do the OCR (step 1) and browser entry
(step 6). See **REPO_EVALUATION.md** for the full write-up of the chosen repos.

```
scans/spreadsheets ─OCR─▶ input/ ─▶ extract ─▶ normalise ─▶ expiry/flag ─▶ master.xlsx ─review─▶ Atlas
       (document-SKILLs)                 (this repo's src/)                          (playwright-skill)
```

## What's here
| File | Does |
|------|------|
| `config/courses.yaml` | Course catalogue: canonical names, **CQC-aligned refresher intervals**, messy-spelling aliases. **Edit this to match your training matrix.** |
| `src/extract.py` | Reads every `.csv/.xlsx` in a folder, maps messy headers → `staff_name / course / completion_date`. |
| `src/normalise.py` | Cleans names ("Smith, John"→"John Smith", O'Brien/McDonald), fuzzy-matches course titles, parses 10+ date formats incl. Excel serials. |
| `src/expiry.py` | `expiry = completion + interval`; flags **Overdue / Expiring Soon / Valid / Unknown**. |
| `src/build_master.py` | Orchestrates the above → colour-coded `master.xlsx` (+ a **Review Queue** sheet) and `master.csv`. |
| `src/enter_records.py` | Playwright template to enter **approved** rows into Atlas row-by-row (dry-run by default). |
| `sample_data/` | Tiny synthetic messy dataset so you can see it work. |

## Quick start
```bash
pip install -r requirements.txt           # pandas, openpyxl, pyyaml, dateutil (+ optional rapidfuzz)

# Build the master sheet from the sample data:
python src/build_master.py --input sample_data --output output/master.xlsx --today 2026-06-04
```
You'll get `output/master.xlsx` (two sheets) and `output/master.csv`.

### On your real data
1. Put your spreadsheets in a folder (e.g. `input/`). For scanned/paper sheets,
   first run the **document-SKILLs PDF/OCR skill** and save its CSV output into
   the same folder. (Install: see REPO_EVALUATION.md §1.)
2. Tune `config/courses.yaml` — your real course names, aliases and refresher
   intervals. **Confirm intervals against your own CQC policy.**
3. `python src/build_master.py --input input --output output/master.xlsx`
4. **Open `master.xlsx` and review** — especially the *Review Queue* sheet
   (unmatched courses, bad dates). Fix at source or add aliases, re-run.
5. Add an `approved` column to `master.csv` (`yes` per signed-off row).
6. Enter into Atlas with the **playwright-skill** + `src/enter_records.py`:
   ```bash
   export ATLAS_URL=...  ATLAS_USERNAME=...  ATLAS_PASSWORD=...
   playwright install chromium
   python src/enter_records.py --csv output/master.csv --dry-run --limit 3   # supervise
   python src/enter_records.py --csv output/master.csv --submit              # go live
   ```

## Data protection (important)
Real employee data and credentials are **never committed** — `.gitignore` excludes
`input/`, `output/`, `real_data/` and `.env`. Only the synthetic `sample_data/`
is tracked. Keep the human-review step before any record reaches Atlas; that
review is your GDPR/CQC audit trail.

## Refresher intervals shipped (confirm against your policy)
Annual (12m): Safeguarding, Moving & Handling, BLS, Fire, Medication, IPC, GDPR,
PBS, Epilepsy/Buccal. Three-yearly (36m): First Aid at Work, Food Hygiene,
MCA/DoLS, Equality/Diversity, Health & Safety, Autism, Learning Disability,
Oliver McGowan. All editable in `config/courses.yaml`.
