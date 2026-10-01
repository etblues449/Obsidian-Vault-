---
name: skill-update
description: Add or change a scheduled JARVIS skill — workflow YAML, runner, tests and docs, in one pass.
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, Skill
argument-hint: "[skill name or number, e.g. 'morning brief' or 6]"
---

# /jarvis:skill-update

Add or change a scheduled skill in the JARVIS engine: $ARGUMENTS

Load the `obsidian-vault-patterns` and `jarvis-vault-access` skills first. Work inside the vault
checkout; if the working directory is not the vault, resolve its path from the `jarvis-global`
block in `~/.claude/CLAUDE.md` before touching anything.

## Sequence

1. **Read the current state before editing.** `Assistant Core/jarvis-skills/runner.mjs` and the
   existing `.github/workflows/jarvis-*.yml`. Name the failure mode you are fixing, or the gap
   the new skill fills, in one sentence — if you cannot, stop and find out first.
2. **Edit the runner.** Skills are period-idempotent: `shouldRun` asks whether this period's
   output already exists, and each skill supplies `done(ctx)`. Do **not** add an exact-clock-hour
   guard — that bug produced eleven green runs that wrote nothing.
3. **Edit or add the workflow YAML.** One file per skill, `jarvis-<n>-<name>.yml`, delegating to
   the reusable `_jarvis-run-skill.yml`. Europe/London schedules need the paired BST/GMT crons —
   they are two attempts at the same period, not two runs.
4. **Extend `Assistant Core/jarvis-skills/test/local-test.mjs` in the same commit.** For a bug
   fix, add a regression test and prove it fails against the old behaviour before you keep it.
5. **Update the docs that make a claim about this skill** — `Assistant Core/jarvis-skills/README.md`,
   `MIGRATION.md`, and the relevant `Claude Memory/Projects/*/_index.md`.

## Verify before reporting

```bash
node "Assistant Core/jarvis-skills/test/local-test.mjs"
bash .claude/skills/vault-integrity-audit/scripts/drift-check.sh .
python3 .claude/skills/qa-boundary-check/scripts/verify-refs.py .
```

Report which of **documented / merged / running** you actually observed. A green Actions run is
not evidence of output — the engine exits 0 when it decides not to run. If you are claiming the
schedule works, cite the commit the run produced.
