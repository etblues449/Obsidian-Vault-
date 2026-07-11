# Prompt 1 — Kickoff (paste into Claude Code on day one)

> Copy everything in the box into Claude Code, after you've put the data files in
> `data/` (see RUNBOOK step 0). Edit the bits in **CAPS** if your paths differ.

```
You are helping me finish an HR training-records migration for a UK adult social
care provider. Read these files in this folder before doing anything:
  - handover/00_HANDOVER.md   (context + the plan)
  - handover/01_RUNBOOK.md    (the step-by-step you will follow)
  - handover/03_DATA_PROTECTION.md  (rules you must never break)

Then confirm back to me, in your own words:
  1. The goal of the project and the "create missing staff -> re-run" loop.
  2. Which data files you can see in handover/data/ and which are still missing.
  3. The exact next command you will run.

Do NOT enter anything into Atlas, and do NOT commit any file containing real
staff names to git. Wait for my go-ahead after each stage.
```

## What good looks like
Claude should restate: extract 102 sheets → normalise → reconcile against the
Atlas export → produce `staff_to_create_in_atlas.csv` + `records_to_add.csv` →
you create the missing staff in Atlas → re-export → re-run reconcile until the
"create staff" count hits 0 → then enter the training records.
