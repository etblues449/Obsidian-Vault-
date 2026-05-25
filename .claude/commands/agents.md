---
description: Dispatch the current task to background sub-agents and hand control back, freeing the session.
argument-hint: [task to run in background — defaults to the active plan]
model: opus
---

# /agents — run in the background (zoom out)

You are running the **/agents** command. Work to dispatch:

> $ARGUMENTS

The intent is to **zoom out of the session**: delegate the work to background sub-agent(s) so the user gets their interactive session back immediately, and let the agents grind while they're away.

## Phase 0 — Decide what to dispatch
- If `$ARGUMENTS` describes a task, dispatch that.
- If it's empty, look in `.claude/plans/` for the most recent plan and dispatch its remaining unchecked steps.
- If there's nothing actionable, ask the user what to run in the background and stop.

## Phase 1 — Split into independent units
Break the work into chunks that can run **in parallel without stepping on each other** (separate files/areas). Truly independent chunks → multiple background agents. A strictly sequential job → a single background agent that runs the steps in order. Avoid having two agents edit the same files at once.

## Phase 2 — Launch in the background
Launch each chunk with the Task tool using **`run_in_background: true`**. Give every agent a **self-contained** prompt — it can't see this conversation — including: the goal, the relevant file paths, how to verify its own work, and an instruction to not take risky/irreversible actions without surfacing them. Prefer the `general-purpose` agent for build/edit work and `Explore` for read-only research.

If the work depends on an ultra plan, point each agent at `.claude/plans/<slug>.md` and have it update the checkboxes as it completes steps, so progress is visible in the file.

## Phase 3 — Hand control back
Do **not** sleep, poll, or busy-wait for the agents — you'll be notified automatically when each finishes. Reply to the user with: what's now running in the background, which agent owns which chunk, and that you'll surface results when they land. Then end your turn so the session is free.

## Phase 4 — On completion (when notified)
When a background agent reports back, verify its output didn't break anything (build/tests if relevant), update the plan file if one is in play, and give the user a short status update. If an agent got stuck or did something risky, surface it rather than silently moving on.
