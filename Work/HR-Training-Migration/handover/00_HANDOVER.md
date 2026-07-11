# HR Training Migration — Handover Pack

**Project:** Migrate historical employee training records into Citation Atlas
**Org:** UK adult social care provider (learning-disability services, ~400+ staff)
**Prepared for:** the colleague picking this up with Claude Code
**Status at handover:** audit complete; a gap was found and quantified; tools built
and tested; ready to execute the fix.

> **Read order:** this file → `01_RUNBOOK.md` → `03_DATA_PROTECTION.md`. Then paste
> `prompts/01_kickoff.md` into Claude Code. `02_TOOLCHAIN.md` tells you what to install.

---

## 1. The goal in one paragraph
Staff did mandatory face-to-face training (Safeguarding, Moving & Handling, First
Aid, Medication, Autism, PRICE/PBS, etc.). Attendance was captured on **paper sign-in
sheets**. Those need to end up in **Citation Atlas**. Atlas has **no bulk import**, so
records are entered one at a time. The job is: read the sheets → clean the data →
check what's already in Atlas → create any missing staff → enter the missing
training → prove nothing is left out.

## 2. What we have (the inputs)
| File (goes in `data/`, NOT in git) | What it is |
|---|---|
| `PDF1.pdf` (79pp) + `PDF2.pdf` (23pp) = **102 pages** | Scanned, **handwritten** Select Lifestyles attendance sheets, Aug 2025 → May 2026 |
| `TrainingRecordReport.xlsx` | The **current Atlas portal** export — 1,062 rows, **295 staff**, dates only up to **06/11/2025** |
| `Atlas_Training_Master_VERIFIED.xlsx` | A prior audit's "verified master" (1,358 rows) — useful, but **incomplete** (see §4) |
| `progressreport….xlsx` | Online-LMS % completions — a *different* system; not the migration target |

Already prepared for you in `data/`:
- `attendance_sheets_OCR_102pages.jsonl` — a first-pass OCR of **all 102 pages** (branch/course/date/surnames) you can use to cross-check and dedup.
- `Discrepancy_Report_PDF_vs_VERIFIED.xlsx` — the full audit (3 tabs: Verdict, 102-page Inventory, Missing Cohorts).
- `sheet_records.csv` — a worked sample so you can run the tools immediately.

## 3. What's already been done
- **All 102 sheets OCR'd** and inventoried (dates, courses, branches, attendees).
- **Audit of the prior "verified" master** against the sheets — claim by claim.
- **Built & tested the tooling**: the `../src/` pipeline (normalise/expiry/master/
  browser-entry) and `scripts/reconcile.py` (the Atlas cross-check + create/add lists).
- **Found and quantified the gap** (next section).

## 4. The key finding — why this isn't finished
The Atlas portal stops at **06/11/2025** (295 staff). The prior audit correctly
recovered most **post-cutoff** new-starter cohorts (Jan/Feb/Mar/May 2026) into its
master — but it **assumed everything *before* the cutoff was already complete**, and
it wasn't. Result:

- **Two whole induction cohorts (Oct 2025 and early-Nov 2025) are missing** from
  both Atlas *and* the prior master — new starters whose entire first-week training
  (Induction, First Aid, Autism, Safeguarding, Medication, PRICE) is on the sheets
  but recorded nowhere. Plus scattered Aug/Sept names.
- These people are currently **invisible in Atlas** — the exact risk this project
  exists to remove. (Specific names are in `output/staff_to_create_in_atlas.csv`
  once you run the reconcile — flagged `MISSED-recover-from-scratch`.)
- Also noted: the prior master's duplicate-scan page citations are scrambled (the
  dedup outcome is right, the page numbers aren't), so don't trust its provenance
  notes blindly. Full detail in `Discrepancy_Report_PDF_vs_VERIFIED.xlsx`.

**Bottom line:** the post-cutoff recovery is sound; the pre-cutoff sheets were never
reconciled. We fix that with the loop below.

## 5. The plan — the "create missing staff → re-run" loop
This is the heart of the handover and matches exactly what you asked for:

```
        ┌─────────────────────────────────────────────────────────┐
        │ 1. OCR the 102 sheets        → sheet_records.csv          │
        │ 2. reconcile.py vs Atlas     → who/what is missing        │
        │ 3. staff NOT in Atlas?       → staff_to_create_in_atlas   │
        │ 4. create those staff in Atlas, re-export the report      │
        │ 5. re-run reconcile.py  ── repeat until "create" = 0  ◄─┐ │
        │ 6. enter the missing training records (records_to_add)  │ │
        │ 7. final reconcile → zero gaps = DONE                   │ │
        └─────────────────────────────────────────────────────────┘
                                   └──────── loop ─────────────────┘
```

`reconcile.py` already splits the missing people into:
- **`MISSED-recover-from-scratch`** — not in Atlas *and* not in the prior master (the Oct/Nov cohorts) → top priority.
- **`captured-awaiting-entry`** — in the master but not yet keyed into Atlas.

Re-running after each batch of Atlas staff creations drives the "create" count to 0.
When it hits 0, every attendee exists in Atlas and `records_to_add.csv` is the
complete, correct list of training rows to enter. **That's "full accuracy."**

## 6. Tools to use (full detail in `02_TOOLCHAIN.md`)
- **OCR:** Claude Code built-in vision (best for handwriting) + `document-skills` PDF/XLSX skill.
- **Clean/expiry/master:** this repo's `../src/` pipeline + `config/courses.yaml` (CQC refresher intervals — *confirm against your policy*).
- **Reconcile:** `scripts/reconcile.py` (proven, see `prompts/03_reconcile.md`).
- **Atlas entry:** `lackeyjb/playwright-skill` + `../src/enter_records.py` (no bulk import → browser automation, supervised).
- **Optional:** run as a named-agent team (`prompts/05_swarm_optional.md`); pull files via a Drive MCP connection.

## 7. Folder map
```
handover/
├── 00_HANDOVER.md            ← you are here
├── 01_RUNBOOK.md             ← do-this-in-order
├── 02_TOOLCHAIN.md           ← skills / repos / connections / agents
├── 03_DATA_PROTECTION.md     ← GDPR rules (read before touching data)
├── prompts/                  ← copy-paste prompts for each stage (01–05)
├── scripts/reconcile.py      ← Atlas cross-check + create/add lists (tested)
├── templates/                ← blank create-list / add-list CSVs
└── data/                     ← (NOT in git) PDFs, Atlas export, OCR, reports
../src/                       ← extract / normalise / expiry / build_master / enter_records
../config/courses.yaml        ← course catalogue + refresher intervals
```

## 8. Definition of done
A final `reconcile.py` run showing **staff-to-create = 0** and **records-to-add = 0**
— every attendee on every sheet exists in Atlas with all their documented training.
Keep the final `reconciliation_full.csv` as the CQC/GDPR completion evidence.

## 9. Two things to double-check before you trust any number
1. The OCR is of **handwriting** — names/dates have an error margin. Always eyeball
   `sheet_records.csv` and resolve `ocr_review.csv` before creating staff.
2. **Refresher intervals** in `config/courses.yaml` are sector defaults — confirm
   them against your own CQC training matrix; they drive every expiry date.
