# Prompt 5 — Optional: run it as a coordinated agent team

> Only if your colleague is comfortable with Claude Code's subagents. For a job
> this size a small named-agent pipeline keeps each concern clean. Skip this and
> use prompts 2–4 sequentially if you prefer simplicity.

```
Run this migration as a coordinated team. Spawn these named agents in ONE message,
each background, each knowing who to hand off to:

- researcher : read handover/00_HANDOVER.md + 01_RUNBOOK.md, confirm the data
               files present, list the 102 pages and known duplicate scans.
               SendMessage findings to 'extractor'.
- extractor  : OCR PDF1+PDF2 (vision), produce data/sheet_records.csv with full
               names. SendMessage to 'reconciler' when done.
- reconciler : run handover/scripts/reconcile.py vs the Atlas export; produce the
               create-list + add-list; SendMessage the summary to 'reviewer'.
- reviewer   : sanity-check names/dates against handover/data discrepancy report,
               flag low-confidence OCR, and report back to me (the lead).

Do NOT enter anything into Atlas and do NOT commit PII. Stop at the reviewer and
wait for me before any Atlas entry.
```

## Notes
- Agent entry/exit is logged; if an agent stalls, message it directly rather than
  re-spawning.
- The browser-entry stage (prompt 4) stays manual/supervised — don't hand that to
  an autonomous agent.
