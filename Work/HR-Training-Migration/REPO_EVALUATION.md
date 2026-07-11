# Claude Code repos for the HR training-records migration — deep dive

Evaluated for: migrating historical employee training records (paper attendance
sheets + assorted spreadsheets) into Citation Atlas, for a UK adult social care
provider (learning-disability services, ~400+ staff).

The six steps of the job:
1. Extract data from messy / scanned / paper sources (OCR)
2. Normalise names, course titles and dates into a clean schema
3. Auto-calculate training expiry from completion + refresher interval (CQC-aligned)
4. Flag overdue / expiring-soon records
5. Output a reviewable Excel/CSV master
6. Drive a browser to enter records row-by-row into Atlas (no bulk import)

The two index repos asked about (`hesreallyhim/awesome-claude-code`,
`danielrosehill/Claude-Code-Repos-Index`) are curated *lists*, not tools — the
picks below come from those ecosystems plus targeted search.

---

## 1. appautomaton/document-SKILLs  — BEST MATCH (steps 1 + 5)
https://github.com/appautomaton/document-SKILLs

**What it is.** A bundle of Claude Code Skills adapted from Anthropic's official
document skills, covering PDF, Excel (XLSX), Word (DOCX) and PowerPoint (PPTX).
Two skills matter here:
- **PDF skill** — extract text & tables, fill forms, merge/split, and crucially
  **OCR scanned pages** (uses the Tesseract OCR engine under the hood, with
  poppler for PDF rendering).
- **XLSX skill** — create/edit spreadsheets: formulas, formatting, data analysis.

**Why it fits.** Covers two of your six steps in one repo: step 1 (turn scanned
attendance sheets into machine-readable text/CSV) and step 5 (produce the Excel
master). Being derived from Anthropic's own skills, it is well-structured rather
than a one-person experiment.

**Install (clone + symlink into your skills dir):**
```bash
git clone https://github.com/appautomaton/document-SKILLs.git
# symlink the skills you want into ~/.claude/skills/ (per the repo README)
```
**Prerequisites:** system tools `tesseract`, `poppler`, `pandoc`, `qpdf`,
LibreOffice; Python scripts run via `uv` (no venv needed); `npm` packages only
for the docx/pptx skills.

**Getting started:** **Intermediate.** Clone + symlink + a handful of Homebrew/apt
system installs. Comfortable-with-a-terminal level.

**How we use it in this project.** OCR lives *outside* the Python pipeline: run the
PDF skill on a folder of scans to emit CSVs, drop those CSVs into the same
`input/` folder, and `src/extract.py` ingests them alongside the native
spreadsheets. The XLSX skill can also pretty-print / pivot the final master.

**Caveats.** OCR of handwritten attendance sheets is the weakest link in the whole
job — typed/printed scans OCR well; handwriting will need human verification.
Budget review time for anything handwritten.

---

## 2. lackeyjb/playwright-skill  — for step 6 (driving Atlas)
https://github.com/lackeyjb/playwright-skill

**What it is.** A model-invoked Claude Code skill for browser automation. You
describe the task in plain English; Claude writes custom Playwright code and runs
it through a universal executor (`run.js`) that handles Node module resolution.
The browser runs **visibly by default**, returning screenshots + console output.

**Why it fits.** This is step 6 — the hardest part, because Atlas has no bulk
import. Claude reads a row from the approved master CSV, navigates the Atlas
"Add Training" form, fills each field, submits, confirms, and loops. Visible
browser = you supervise the first batch before letting it run on.

**Install (plugin route, recommended):**
```bash
/plugin marketplace add lackeyjb/playwright-skill
/plugin install playwright-skill@playwright-skill
cd ~/.claude/plugins/marketplaces/playwright-skill/skills/playwright-skill
npm run setup        # installs Playwright + Chromium
```
**Standalone route:** `git clone … && cp -r skills/playwright-skill ~/.claude/skills/ && npm run setup`.
**Prerequisites:** Node.js (Playwright + Chromium pulled by `npm run setup`).

**Getting started:** **Beginner-to-intermediate.** You don't need to know
Playwright — Claude writes it. Real friction is Atlas login/2FA and discovering
the form's field selectors (a tuning exercise, not coding). Use the skill to
record selectors, then paste them into this project's `src/enter_records.py`.

**Alternative:** `SawyerHood/dev-browser` gives persistent sandboxed browser
sessions — handy if Atlas keeps you logged in across hundreds of rows.

---

## 3. Dexploarer/claudius-skills — `data-cleaning-pipeline`  (steps 2-4)
https://github.com/Dexploarer/claudius-skills/blob/main/examples/intermediate/data-science-skills/data-cleaning-pipeline/SKILL.md

**What it is.** A pandas/polars/PySpark data-cleaning pipeline skill. It defines a
7-stage workflow: analyse → de-duplicate → handle missing values → convert types
→ detect outliers → **normalise text** → **validate**. Dates via
`pd.to_datetime()`, dups via `drop_duplicates()`, text via lowercase/strip
chains, validation via range/constraint checks. Its stated rule of thumb:
*"Always keep original data, log all cleaning steps, validate data quality."*

**Why it fits.** Steps 2-4 — normalising inconsistent names/course titles, parsing
ten different date formats into one schema, and validating before anything is
trusted. It gives Claude a repeatable scaffold instead of ad-hoc throwaway
scripts each run.

**Getting started:** **Intermediate.** It's an example skill inside a larger repo:
copy the `SKILL.md` + scripts into your skills dir and adapt to your columns.
Needs Python + pandas. Honest note: much of this layer Claude Code can also write
directly — which is exactly what the `src/normalise.py` + `src/expiry.py` in this
project do, encoding the CQC refresher intervals the generic skill doesn't know.

**Lighter alternative:** `coffeefuelbump/csv-data-summarizer-claude-skill` — quick
summary stats + missing-data detection for a first look at messy exports.

---

## How they chain together
```
[scanned sheets / PDFs]  --(document-SKILLs PDF/OCR)-->  CSVs
[existing spreadsheets]  ------------------------------>  input/ folder
                                   |
                         src/extract.py  (read + map headers)
                                   |
        src/normalise.py + claudius cleaning patterns
        (names, course fuzzy-match, date parsing)
                                   |
                 src/expiry.py  (completion + CQC interval -> expiry, flag)
                                   |
              src/build_master.py  ->  master.xlsx (+ Review Queue) + master.csv
                                   |
                         **HUMAN REVIEW** in Excel  (add `approved` column)
                                   |
        src/enter_records.py via lackeyjb/playwright-skill  -> Citation Atlas
```

## Governance note (real staff data + live HR system)
- Keep Atlas credentials out of code/CSV — env vars only (`enter_records.py` enforces this).
- Run browser automation visibly, `--dry-run` + `--limit` first, supervise the opening batch.
- Keep the human-review step on the Excel before any record is entered — that is
  your GDPR/CQC audit trail. `output/` and `input/` are git-ignored so real
  records are never committed.
