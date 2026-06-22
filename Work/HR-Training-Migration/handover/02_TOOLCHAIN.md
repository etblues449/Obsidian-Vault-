# 02 — Toolchain: skills, repos, connections & agents to use

Everything your colleague needs, and *why* each piece is here. Install only what
each stage needs — you don't need all of it at once.

## Claude Code skills / repos

| # | Tool | Used for (stage) | Install | Difficulty |
|---|------|------------------|---------|------------|
| 1 | **document-skills** (PDF/OCR + XLSX) — `appautomaton/document-SKILLs`, adapted from Anthropic's official skills | OCR the scanned attendance sheets (stage 2) and pretty Excel output (stage 5) | clone repo → symlink the `pdf` and `xlsx` skill folders into `~/.claude/skills/`; install `tesseract poppler pandoc qpdf` | Intermediate |
| 2 | **playwright-skill** — `lackeyjb/playwright-skill` | Drive Citation Atlas to enter records row-by-row — Atlas has no bulk import (stage 6) | `/plugin marketplace add lackeyjb/playwright-skill` then `/plugin install`, then `npm run setup` | Beginner–Intermediate |
| 3 | **This repo's pipeline** (`../src/`) | Normalise names/courses/dates, expiry/flagging, build master, browser-entry base | `pip install -r ../requirements.txt` | Beginner |
| 4 | **reconcile.py** (`scripts/`) | The core "is this person/record in Atlas?" check + the create/add lists | nothing extra (pandas/openpyxl) | Beginner |

> Note on OCR: the sheets are **handwritten**. Claude Code's built-in vision (just
> reading the rendered page images) is usually more accurate on handwriting than
> raw Tesseract. The `document-skills` PDF skill is still useful for any typed/
> printed pages and for the Excel output. Prompt 2 uses the vision approach.

## Connections (MCP) — optional, nice-to-have

| Connection | Why it could help | Required? |
|------------|-------------------|-----------|
| **Google Drive / OneDrive MCP** | Pull the source PDFs + Atlas export straight from your shared drive instead of manual download | No — manual file drop works |
| **Filesystem MCP** | Let Claude read/write the `data/` folder directly | Usually built-in |
| **Excel/Sheets MCP** | Review the master + create-list in a spreadsheet UI mid-run | No |

Citation Atlas itself has **no public API/MCP** that we rely on — that's exactly
why stage 6 uses browser automation rather than an integration.

## Agents (Claude Code subagents) — optional

Use the named-agent pipeline in `prompts/05_swarm_optional.md` if you like. Roles:

| Agent | Job |
|-------|-----|
| `researcher` | Read the handover, inventory the 102 pages, find duplicate scans |
| `extractor` / `coder` | OCR the PDFs → `sheet_records.csv` |
| `reconciler` | Run `reconcile.py`, produce create/add lists |
| `reviewer` | Sanity-check OCR confidence, names, dates before sign-off |

Keep the **Atlas browser-entry stage manual and supervised** — do not delegate live
data entry to an autonomous agent.

## Minimum viable path (if short on time)
You can finish the whole job with just **#3 + #4 + Claude Code's built-in vision**
for OCR, and do the Atlas entry by hand for the (small) missed cohort. Add the
`playwright-skill` only if the volume justifies automating data entry.
