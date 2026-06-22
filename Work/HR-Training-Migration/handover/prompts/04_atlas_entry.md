# Prompt 4 — Enter records into Atlas (browser automation)

> Use after the loop in prompt 3 reaches "staff to CREATE = 0" and you have
> reviewed `records_to_add.csv`. Requires the `playwright-skill` (TOOLCHAIN.md §2).

```
We now have handover/output/records_to_add.csv — training records that exist on
paper but not yet in Atlas. I have reviewed it and set approved_yes_no = yes on
the rows to enter.

Citation Atlas has no bulk import, so drive the browser to add them one at a time
using ../src/enter_records.py as the base. Steps:
  1. Open Atlas, navigate to the "Add Training" form, and record the real field
     selectors (employee picker, course dropdown, completion-date field, save).
     Fill those selectors into src/enter_records.py (replace the # TODO lines).
  2. Run a DRY RUN first, 3 rows, browser visible:
        python src/enter_records.py --csv handover/output/records_to_add.csv --dry-run --limit 3
     Show me screenshots so I can confirm the form is being filled correctly.
  3. Only after I confirm, run for real in small batches (--submit), logging each
     entry to output/entry_log.csv and screenshotting any failure.

Credentials come from the ATLAS_URL / ATLAS_USERNAME / ATLAS_PASSWORD env vars —
never put them in code or the CSV. Stop and ask me if anything looks off.
```

## Safety
Visible browser, dry-run first, small batches, human watching the opening batch.
Atlas is a live system holding real staff data — there is no undo.
