# Outlook Organizer

PowerShell-COM scripts to reorganise an Outlook desktop mailbox without admin rights, Graph API, or app registration. Uses the local Outlook client.

## Requirements
- Windows
- Outlook desktop installed and signed in to your work account
- Outlook **must be running** while these scripts execute

## Workflow

| Step | Script | Effect |
|------|--------|--------|
| 1 | `scripts/01-survey.ps1` | Read-only. Writes `output/survey.json`. |
| 2 | (Claude proposes plan) | `output/plan.json` for your review. |
| 3 | `scripts/02-apply.ps1 -DryRun` | Prints every move/folder/rule it would create. Changes nothing. |
| 4 | `scripts/02-apply.ps1` | Real run. Moves messages, creates folders, applies categories, creates rules. **Never deletes.** |

## Running scripts

Open PowerShell, `cd` into `scripts`, then:

```powershell
powershell -ExecutionPolicy Bypass -File .\01-survey.ps1
```

If you get a COM security prompt from Outlook, click **Allow**.

## Safety

- No script in this folder will ever delete a message.
- Step 2's plan is reviewable before any change is made.
- Step 3 is a full dry-run.
- Originals can be restored by moving messages back from their new folder.
