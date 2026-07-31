---
name: skill-engine-ops
description: >-
  Operate the JARVIS scheduled "Active Vault" skill engine — Assistant
  Core/jarvis-skills/runner.mjs, the .github/workflows YAML, cron schedules, Europe/London DST
  guards, corpus caps, Groq free-tier budget, and the £0 constraint C1. Use to add, fix, re-run
  or reschedule Morning Brief, Connection Finder, Weekly Synthesis or Pattern Detector; when a
  scheduled skill produces nothing or produces ungrounded output; and when verifying that a
  documented schedule is actually merged and running. This is the ENGINE that generates Claude
  Memory/briefings/ — not the "morning" skill that renders a brief for display.
when_to_use: >-
  Trigger on: a scheduled skill produced nothing, a briefing is empty or ungrounded, cron or
  DST is wrong, add/reschedule a skill, verify a documented schedule is actually merged and
  running, Groq quota or corpus caps, the £0 constraint. Do NOT trigger when the user simply
  wants to READ or DISPLAY today's brief — that is the separate 'morning' skill. This owns the
  engine that WRITES Claude Memory/briefings/.
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
model    Groq llama-3.3-70b-versatile   (free tier)
secret   GROQ_API_KEY
exits    0 = wrote a file OR guard-skipped     1 = real error
run      node runner.mjs --skill=<name> [--force] [--dry-run]
test     node test/local-test.mjs      (offline, no key, no network)
```

Skills 2, 5, 7 are event-driven and belong to `capture-pipeline`, not here.

## A schedule with no workflow file is not a schedule

Before calling any skill live, prove three independent things:

1. The workflow file exists **on `master`** — not in a branch, not in a PR, not in a README.
2. The cron is correct for Europe/London **at both BST and GMT**.
3. A run has actually appeared in the Actions tab.

Documented ≠ merged ≠ running. Conflating these is the standing failure of this
subsystem: the README describes five workflow files, and `.github/workflows/` does not
exist on `master`. The engine is currently code with no trigger.

## DST is a correctness bug

GitHub cron is UTC and has no timezone. "07:00 London" is 06:00 UTC in summer and 07:00
UTC in winter. Two viable approaches:

- Schedule the workflow **hourly-ish** around the target and guard in-runner against the
  actual London wall clock via full-ICU `Intl`. Robust, costs a few no-op runs.
- Schedule two crons, one per DST half, with in-runner guards. Fewer runs, more moving parts.

Either way the in-runner guard is mandatory — it is the thing that is actually correct.
Verify your reasoning against a date in June *and* a date in December before shipping.

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
```

Keep the offline suite offline. CI that needs a secret to test is CI that quietly stops
running.

## Re-running

Before changing a prompt, read the last three generated outputs — a prompt change alters
every future briefing, and you cannot judge it without seeing what the current one
actually produces. Record what changed and why in the session note.

When picking up prior engine work, first check whether the previous session's workflow
files were actually committed. That single check would have caught the current gap.

## Gotchas

- **A README documenting five workflows proves nothing about `.github/workflows/`.** This
  exact gap ran undetected: the engine was code with no trigger, and every document
  described it as live.
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
