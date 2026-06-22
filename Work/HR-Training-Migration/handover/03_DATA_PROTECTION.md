# 03 — Data protection (read before touching the data)

This project handles **real employee personal data** (names, training history) for
a UK adult social care provider, and a **live HR system login**. Treat it like any
other special-category HR record under UK GDPR.

## Hard rules
1. **Never commit real data to git.** The repo's `.gitignore` excludes `output/`,
   `input/`, `data/`, `real_data/`, `*.xlsx` (except templates) and `.env`. Keep it
   that way. The code and docs are public-safe; the data is not.
2. **Credentials live in environment variables only** — `ATLAS_URL`,
   `ATLAS_USERNAME`, `ATLAS_PASSWORD`. Never in code, CSVs, prompts, or commits.
3. **Transfer the data folder securely** (the part containing names) — share it via
   your organisation's approved channel, not email-to-personal-account, not a
   public link.
4. **Human review before any write to Atlas.** Nothing is entered without a person
   signing off the row. That review is your CQC/GDPR audit trail.
5. **Minimise.** Only the three fields needed (name, course, completion date) plus
   provenance. Don't pull extra personal data you don't need.
6. **Keep the originals.** Never overwrite the source PDFs or the Atlas export;
   work on copies. Log every transformation (the scripts do this).

## What is safe to commit
- Everything under `handover/` EXCEPT `handover/data/` and `handover/output/`.
- The `src/` code, `config/courses.yaml`, the markdown docs, the templates.

## If in doubt
Stop and ask. A missed record can be added later; a leaked staff list cannot be
un-leaked.
