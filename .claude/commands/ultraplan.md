---
description: Deploy parallel sub-agents to research, then produce a rigorous step-by-step "ultra plan" for a goal.
argument-hint: <goal or task to plan>
model: opus
---

# /ultraplan — deep, sub-agent-researched planning

You are running the **/ultraplan** command. The goal to plan is:

> $ARGUMENTS

If the goal above is empty, ask the user for the goal in one sentence and stop until they answer.

Your job is to produce an **ultra plan**: a deeply-researched, unambiguous, step-by-step implementation plan that a separate execution pass (the `/goal` command) can follow without re-deriving context. **Do NOT implement anything in this command** — planning only.

## Phase 1 — Frame the goal
- Restate the goal in your own words and list the explicit **success criteria** (how we will know it's done). These criteria are the contract `/goal` will loop against, so make them concrete and checkable (e.g. "tests in X pass", "endpoint returns 200", "file Y contains Z").
- Note constraints, non-goals, and anything risky or irreversible.

## Phase 2 — Parallel research (sub-agents)
Spawn **multiple sub-agents in parallel** with the Task tool (send them in a single message so they run concurrently). Tailor the set to the goal, e.g.:
- One or more `Explore` agents to map the relevant files, existing patterns, and where the change must land.
- A `general-purpose` agent for any open research question (libraries, APIs, prior art) that needs more than a couple of lookups.
Give each agent a self-contained prompt and ask for a short, structured report. Do not duplicate their searches yourself — wait for their findings.

## Phase 3 — Synthesize the plan
From the agents' reports, write the plan as an **ordered checklist of steps**. Each step must include:
- **What** to change (specific files / functions, with `path:line` where known).
- **Why** it's needed (one line).
- **How to verify** that step in isolation (command to run, expected output, or observable behavior).
Call out ordering dependencies, migration/rollback concerns, and any decision points that need a human.

## Phase 4 — Persist the plan
Write the plan to `.claude/plans/<slug>.md` where `<slug>` is a short kebab-case name derived from the goal. Use this structure:

```
# Plan: <goal title>
Status: DRAFT
Created: <date>

## Goal
<one paragraph>

## Success criteria
- [ ] criterion 1
- [ ] criterion 2

## Steps
- [ ] 1. <what> — <why>  (verify: <how>)
- [ ] 2. ...

## Risks / decisions for human
- ...
```

If a plan file for this goal already exists, read it first and update it rather than clobbering completed checkboxes.

## Phase 5 — Present, do not implement
Reply to the user with: the path to the plan file, the success criteria, the step count, and any decision points that need their input. Tell them they can run **`/goal`** to execute this plan, or **`/agents`** to run it in the background. Then stop.
