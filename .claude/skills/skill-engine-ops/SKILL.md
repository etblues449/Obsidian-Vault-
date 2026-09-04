---
name: skill-engine-ops
description: >-
  Operate the JARVIS scheduled "Active Vault" skill engine — Assistant
  Core/jarvis-skills/runner.mjs, the .github/workflows YAML, cron schedules, Europe/London DST
  guards, corpus caps, Groq free-tier budget, and the £0 constraint C1. Use to add, fix, re-run
  or reschedule Morning Brief, Connection Finder, Weekly Synthesis or Pattern Detector; when a
  scheduled skill produces nothing or produces ungrounded output; and when verifying that a
  documented schedule is actually merged and running. This is the ENGINE that generates Claude
  Memory/briefings/ — not the "morning" skill that renders a brief for display, and not the
  phone app (that is jarvis-core-dev).
when_to_use: >-
  Trigger on: a scheduled skill produced nothing, a briefing is empty or ungrounded, cron or
  DST is wrong, add/reschedule a skill, verify a documented schedule is actually merged and
  running, Groq quota or corpus caps, the £0 constraint. Do NOT trigger when the user simply
  wants to READ or DISPLAY today's brief — that is the separate 'morning' skill. Do NOT trigger
  for changes to the phone app at ~/jarvis-core — that is jarvis-core-dev. This owns the engine
  that WRITES Claude Memory/briefings/.
---

# Skill engine ops

Four scheduled skills, one engine, one hard constraint: **C1 — £0/month, forever.** This
engine exists because it replaced paid n8n.cloud + the paid Claude API. A change that
improves output while reintroducing cost is a regression, not an improvement.

Read `vault-conventions` for output paths and the write path.

## The engine as built

| # | Skill | Schedule (Europe/London) | Reads | Writes |
|---|---|---|---|---|
| 1 | Morning Brief | Daily 07:00 | 12 newest `JARVIS/Inbox` captures + `MEMORY.md` | `Claude Memory/briefings/YYYY-MM-DD.md` |
| 3 | Connection Finder | Sunday 14:00 | `MEMORY.md` + project `_index.md` | `Claude Memory/connections/YYYY-MM-DD.md` |
| 4 | Weekly Synthesis | Friday 18:00 | 30 newest captures + decisions/beliefs/patterns + indexes | `Claude Memory/synthesis/YYYY-Www.md` |
| 6 | Pattern Detector | Monday 08:00 | 30 newest captures + `patterns.md` | `Claude Memory/patterns.md` (rolls, ~20k kept) |

```
engine   Assistant Core/jarvis-skills/runner.mjs   (zero npm deps, Node 18+)
caps     CORPUS_CAP 30000   PER_FILE_CAP 4000   MEMORY_CAP 6000   (chars)
model    Groq openai/gpt-oss-120b   (free tier)   ← see "Model retirement" below
secret   GROQ_API_KEY
exits    0 = wrote a file OR guard-skipped     1 = real error
run      node runner.mjs --skill=<name> [--force] [--dry-run]
test     node test/local-test.mjs      (offline, no key, no network)
```

Skills 2, 5, 7 are event-driven and belong to `capture-pipeline`, not here.

## Model retirement is a live failure mode, not a footnote

**Groq decommissioned `llama-3.3-70b-versatile` on 2026-08-16** (free and developer tiers).
All four skills share `runner.mjs`, so all four failed **25 runs out of 25** — for 27 days,
with no briefing written since 2026-08-05. The runs reported *green*. `llama-3.1-8b-instant`
went the same day.

No API announces a retirement. When output stops, check the model **before** the schedule:
a `model_not_found` 404 looks nothing like a cron problem in the Actions summary, but it is
the first thing to rule out. The phone app carried the identical dead default until
2026-09-04 — the same retirement bit two subsystems independently.

## A schedule with no workflow file is not a schedule

Before calling any skill live, prove three independent things:

1. The workflow file exists **on `master`** — not in a branch, not in a PR, not in a README.
2. The cron is correct for Europe/London **at both BST and GMT**.
3. A run has actually appeared in the Actions tab.

Documented ≠ merged ≠ running. Conflating these is the standing failure of this subsystem,
and it has bitten twice for two different reasons — see the gotchas.

**And a run appearing is not a file being written.** A green Actions run has three times
meant nothing was produced: an over-strict hour guard, a masked skip, and a dead model. After
any fix, confirm a **file landed in the vault**. Green is not evidence.

## `.github/` is invisible to Obsidian — and that deletes it

The workflows vanished from `master` three separate times (`7f9097d9`, `9fd5e00e`,
`4bdb3bf1`). Root cause, found 2026-08-23: **Obsidian does not index dotfolders**, so
obsidian-git's `git add -A` from the vault root stages `.github/**` as *deletions*. It also
explains the earlier "8 files deleted by an unidentified client" — no mystery client existed.

All six were restored, and a **pre-commit hook** at `.git/hooks/pre-commit` now refuses any
commit staging a deletion under `.github/`. Hooks are local and untracked, so obsidian-git
cannot remove it — but that also means **a fresh clone does not have it**. Reinstall the hook
on any new machine.

If obsidian-git ever fails to commit, that is the hook working. Read the message before
reaching for `--no-verify`.

## DST is a correctness bug

GitHub cron is UTC and has no timezone. "07:00 London" is 06:00 UTC in summer and 07:00
UTC in winter. Two viable approaches:

- Schedule the workflow **hourly-ish** around the target and guard in-runner against the
  actual London wall clock via full-ICU `Intl`. Robust, costs a few no-op runs.
- Schedule two crons, one per DST half, with in-runner guards. Fewer runs, more moving parts.

Either way the in-runner guard is mandatory — it is the thing that is actually correct.
Verify your reasoning against a date in June *and* a date in December before shipping.

**The guard must ask "has this period's output been written?", not "is it exactly 07:00?"**
The original exact-hour match failed every one of 11 scheduled runs, because a run that starts
at 07:04 is normal. `shouldRun` + per-skill `done(ctx)` is DST-safe, delay-safe and
self-healing; the paired BST/GMT crons become two attempts at the same period rather than two
separate schedules.

**A guard-skip is success.** Exit 0 with no file written when the guard says "not yet" is
correct. Never add a retry that defeats a guard.

## Output honesty

A briefing must never assert something its sources did not contain. If a read source is
missing, run with what remains and **state the omission inside the generated document**.
A briefing that silently lost its primary source reads exactly like a good one — that is
what makes a missing `MEMORY.md` an S1 defect rather than a cosmetic one.

On Groq 429: back off, retry once, then exit 0 with no write and log the skip. Never
emit a partial or invented briefing.

## Corpus caps

The caps exist to stay under Groq's free-tier tokens-per-minute. Raising one to improve
output quality is a **C1 decision**, not a tuning decision — surface it for a call, don't
just do it. Truncate at the cap boundary and note the truncation; never silently drop the
tail.

## Write serialization

The workflow commits via a single rebase-retry push to `master`. Four skills must never
push concurrently. A fifth skill joins the same serialization — it does not get its own
push path.

## Every change ships with

```
1. The changed file(s), rewritten in full
2. node runner.mjs --skill=<name> --dry-run   output
3. node test/local-test.mjs                    (assertion count, all green)
4. A DST statement: correct at BST and GMT, with the reasoning shown
5. A C1 statement: £0 impact, or an explicit flag
6. Proof a FILE LANDED in the vault — not that a run went green
```

Keep the offline suite offline. CI that needs a secret to test is CI that quietly stops
running.

## Re-running

Before changing a prompt, read the last three generated outputs — a prompt change alters
every future briefing, and you cannot judge it without seeing what the current one
actually produces. Record what changed and why in the session note.

When picking up prior engine work, first check whether the previous session's workflow
files were actually committed. That single check would have caught the gap twice.

## Gotchas

- **A README documenting five workflows proves nothing about `.github/workflows/`.** This
  ran undetected: the engine was code with no trigger while every document described it as
  live. Fixed 2026-08-23 — but verify against `master`, never against a document.
- **Obsidian cannot see dotfolders, so obsidian-git deletes `.github/`.** Three occurrences.
  The pre-commit hook blocks it, but hooks are untracked — reinstall on any fresh clone.
- **A green run is not a written file.** Three separate causes have produced green runs with
  no output: an exact-hour guard, a masked skip message, and a retired model. Check the vault.
- **Models get retired without warning.** 25/25 runs failed for 27 days on a `model_not_found`
  that no monitoring surfaced. Check the model first when output stops.
- **GitHub cron is UTC and has no timezone.** One cron per skill is correct for half the
  year and silently wrong for the other half. Two crons plus the in-runner guard is the
  fix, not redundancy.
- **`Intl` needs full-ICU.** On a stripped Node build the London DST guard returns
  nonsense and fails *quietly*. Assert on it before trusting any time comparison.
- **Guard-skip is success.** Exit 0 with no write when the guard says "not yet" is
  correct. A retry that defeats a guard produces duplicate briefings.
- **A missing input does not crash the runner.** It produces a confident, well-formed,
  ungrounded document. State the omission inside the output.
- **Raising a corpus cap is a cost decision, not a tuning decision.** The caps exist to
  stay inside Groq's free tier. Surface it; do not just raise it.
