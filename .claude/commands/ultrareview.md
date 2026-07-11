---
description: Deploy parallel sub-agents to review the produced code across correctness, security, tests, and style.
argument-hint: [diff range or PR description — defaults to the current branch vs its base]
model: opus
---

# /ultrareview — multi-agent code review

> **Note:** In Claude Code's cloud/web environment a **built-in `/ultrareview`** may already exist (a billed, user-triggered multi-agent cloud review). Where the built-in is present it can take precedence over this file — that's expected. This custom version is the portable fallback that works in any repo and any Claude Code surface.

You are running the **/ultrareview** command. Review target:

> $ARGUMENTS

If empty, review the **current branch's diff against its base** (e.g. `git merge-base` with `main`/`master`, then `git diff <base>...HEAD`). Determine the actual diff before reviewing.

## Phase 1 — Gather the change set
Establish exactly what's under review: the diff, the files touched, and the stated intent (commit messages / PR description / the relevant `.claude/plans/` file if one exists). Don't review code outside the change set unless a finding requires checking a caller.

## Phase 2 — Parallel review sub-agents
Spawn **multiple review sub-agents in parallel** with the Task tool (one message, concurrent), each with a focused lens and a self-contained prompt that names the diff/files to read:
- **Correctness** — logic bugs, edge cases, error handling, off-by-ones, broken contracts, regressions in callers.
- **Security** — injection, authz/authn, secrets, unsafe input handling, OWASP-style issues.
- **Tests** — coverage of the change, missing/weak assertions, whether tests actually exercise the new behavior.
- **Style / maintainability** — consistency with existing patterns, dead code, naming, needless complexity.
Ask each agent to return findings as a short list with **severity** (blocker / high / medium / nit), a **file:line**, and a concrete suggested fix.

## Phase 3 — Synthesize
Merge the reports, drop duplicates, and rank by severity. For each finding give: severity, `file:line`, what's wrong, and the fix. Separate **blockers** (must fix before merge) from **non-blocking** suggestions. Be honest if the change is clean — don't invent problems to fill a quota.

## Phase 4 — Report
Present the prioritized review to the user. End with a clear verdict: **approve**, **approve with nits**, or **changes requested**, and the single most important next action. Do **not** fix the issues in this command unless the user asks — review only. If they want fixes, point them at `/goal` or offer to apply the blockers.
