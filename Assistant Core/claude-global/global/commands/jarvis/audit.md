---
name: audit
description: Reconcile what the vault's documents claim against what actually exists, and write the findings down.
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, Skill
argument-hint: "[optional scope, e.g. 'skill engine' or 'capture path']"
---

# /jarvis:audit

Reconcile documents against reality: $ARGUMENTS

Load `jarvis-vault-access` first. This exists because of the single most expensive habit in this
project: conflating **documented**, **merged** and **running**. A README describing five
workflows proves nothing about `.github/workflows/`. A green Actions run proves nothing about
output. A `✅` in an index proves nothing at all.

## Sequence

1. **Run the bundled checkers** and read the output rather than the exit code.

   ```bash
   bash .claude/skills/vault-integrity-audit/scripts/drift-check.sh .
   python3 .claude/skills/qa-boundary-check/scripts/verify-refs.py .
   ```

2. **Test each status claim against an observable artefact.** For every `LIVE` / `DEPLOYED` /
   `✅` in the scope you were given, name the thing that would exist if it were true — a commit,
   a file, a merged branch, a registry entry — and go look. Record the evidence or the absence.
3. **Check the boundaries, not the files.** A path a script reads against the real tree. An
   entity ID an automation calls against the live registry. A workflow a README documents
   against `.github/workflows/`. A secret a runner requires against the configured secrets. A
   wikilink against a real note.
4. **Write the findings** to `Claude Memory/YYYY-MM-DD-jarvis-state-of-the-system.md`, severity
   first. Each finding carries the evidence that proves it — a SHA, a path, a log line. A
   finding with no evidence is a guess and must be labelled as one.
5. **File every actionable item** in `Claude Memory/Account/capture_queue.md`, and correct the
   documents that were wrong — the index, `MEMORY.md`, `CLAUDE.md` change history. An audit that
   leaves the false claim in place has not finished.

## Rules

- **Never repair by weakening the check.** If a checker fails, fix the thing it caught.
- **Never synthesise a missing file.** Report it MISSING. An invented memory is
  indistinguishable from a real one on the next read.
- **Sensitive notes are out of scope for the report.** Confirming a `sensitive` / `private` /
  `confidential` / `legal` / `financial` note exists is fine; quoting or summarising it is not.
- Correct a prior finding of your own plainly if the evidence has moved on, and say what changed.
