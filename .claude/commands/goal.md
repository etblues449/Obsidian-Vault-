---
description: Execute an ultra plan in a verify-gated loop until the goal's success criteria are met.
argument-hint: [plan slug | goal — defaults to the most recent plan]
model: opus
---

# /goal — verify-gated execution loop

You are running the **/goal** command. Target:

> $ARGUMENTS

## Phase 0 — Load the plan
- If `$ARGUMENTS` names a plan slug, open `.claude/plans/<slug>.md`.
- If it's empty, find the most recently modified file in `.claude/plans/` (ignore `.gitkeep`) and use that.
- If it describes a goal with **no** matching plan, tell the user no plan exists and suggest running **`/ultraplan`** first, then stop.

Read the whole plan, including its **success criteria** and the current state of every checkbox. Treat the success criteria as the loop's exit condition.

## Phase 1 — Execute, verify-gated
Work the unchecked steps **in order**. This is a loop, not a single pass:

1. Implement the next unchecked step (smallest correct change).
2. **Verify it** using that step's stated check — run the build, tests, linter, or observe the behavior. For UI/frontend steps, actually exercise the feature, don't assume.
3. If verification **passes**: mark the step `[x]` in the plan file and continue to the next step.
4. If verification **fails**: diagnose the root cause and retry the step. Do **not** disable checks, skip tests, or fake success to get past a gate.
5. Repeat until all steps are checked.

**Stop conditions — stop the loop and report instead of grinding:**
- All success criteria are met (success).
- The same step fails ~3 times despite different fixes (you're stuck — report the diagnosis).
- A step requires a risky/irreversible action (force-push, data deletion, dropping tables, prod changes) or a decision the plan flagged for a human — pause and ask.
- The plan turns out to be wrong or incomplete — stop and recommend re-running `/ultraplan`.

## Phase 2 — Final verification
When you believe the goal is done, run the success criteria **as a whole** one more time (full test/build, not just the last step's check). Only then update the plan header to `Status: DONE`.

## Phase 3 — Report
Summarize for the user in a few sentences: what was completed, the final verification result, anything left unchecked and why, and the next action (e.g. commit/push, or `/ultrareview`). Keep it tight.
