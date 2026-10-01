---
name: jarvis-orchestrator
description: >-
  Coordinate the JARVIS agent team across vault integrity, capture pipeline, skill engine,
  the phone codebase, voice/Home Assistant, and boundary QA. Use ONLY when work spans two or
  more of those layers — building or fixing a subsystem end-to-end, a full system health check,
  a session start or end, a release, or a follow-up that reaches across layers ("continue where
  we left off", "re-run the whole thing", "fix everything you found"). A request confined to ONE
  layer belongs to that layer's own skill, not here: a capture bug goes to capture-pipeline, a
  schedule problem to skill-engine-ops, a change to the phone app (lib/, tools/, jarvis-app.mjs,
  a test) to jarvis-core-dev, a vault audit to vault-integrity-audit, a node or entity problem to
  voice-satellite-ops. Simple lookups and single questions need no skill at all.
when_to_use: >-
  Trigger when work spans two or more JARVIS layers, or for a full health check, session
  start/end, or a cross-layer follow-up. Do NOT trigger for single-layer work — a capture bug
  goes to capture-pipeline, a schedule problem to skill-engine-ops, a phone-app code change to
  jarvis-core-dev, a vault audit to vault-integrity-audit, a node or entity problem to
  voice-satellite-ops.
---

# JARVIS orchestrator

Coordinates five specialist agents over the JARVIS system. Read `vault-conventions`
before anything touches the vault.

**Execution mode: hybrid.**

| Phase | Mode | Why |
|---|---|---|
| 1 — Context | direct | cheap, sequential, no coordination value |
| 2 — Audit | sub-agents, parallel | independent read-only reconnaissance; nothing to negotiate |
| 3 — Build | agent team | agents must exchange findings mid-flight; QA runs incrementally |
| 4 — Commit | single agent | the write path is serialized by design |

Phase 2 is fan-out because parallel readers have nothing to say to each other. Phase 3
is a team because the capture engineer's routing rules and the vault keeper's folder
tree are decided *together*, and QA has to interrupt while work is still cheap to change.

## The team

| Agent | Owns | Type |
|---|---|---|
| `jarvis-vault-keeper` | vault state, session protocol, **sole git write path** | general-purpose |
| `jarvis-capture-engineer` | phone → transport → vault; skills 2/5/7 | general-purpose |
| `jarvis-skill-engine` | `runner.mjs`, workflows, DST, C1 (£0); **and `~/jarvis-core`, the phone app — see `jarvis-core-dev`** | general-purpose |
| `jarvis-voice-ha` | ESPHome, Assist, HA control, entity truth | general-purpose |
| `jarvis-integration-qa` | boundary checks, S1 veto | general-purpose |

All `Agent` calls pass `model: "opus"`. Five members with 4–5 tasks each sits in the
mid-size band; do not add a sixth without removing one — coordination overhead grows
faster than throughput.

**The phone codebase is a skill, not a sixth agent.** `~/jarvis-core` (repo
`etblues449/jarvis-core`, branch `main`) had no owner until 2026-09-04, which is why work
on it ran unharnessed. Rather than breach the five-agent cap, `jarvis-core-dev` carries the
"how" and `jarvis-skill-engine` carries the "who". Note the two repos use different
branches — the vault is `master`, jarvis-core is `main`.

`webapp-reviewer` is **not** on this team. It is a narrow read-only reviewer frozen to
Carousel baseline `d8e5532`. Call it directly for baseline-diff questions.

## Phase 0 — context check (always first)

Decide which mode you are in before doing anything:

| Condition | Mode |
|---|---|
| `_workspace/` absent | **initial run** — full Phase 1→5 |
| `_workspace/` present + user asks for a partial change | **partial re-run** — re-invoke only the owning agent; keep everything else |
| `_workspace/` present + user supplies new input | **fresh run** — move `_workspace/` → `_workspace_prev/`, then diff against it and report regressions |
| `_workspace/` present + prior run ended with an unpushed commit | **resolve first** — clear that before starting new work |

Never silently discard `_workspace/`. Intermediate artefacts are the audit trail.

## Phase 1 — context

1. Session start: read the seven mandatory files. **Report missing ones as missing.**
2. `git clone --depth 1 -b master` a scratch copy. Do not audit through the GitHub API —
   a 403 rate-limit reads exactly like a missing file, which is the worst false positive
   available here.
3. Identify which layers the request touches → which agents are needed. A single-layer
   request does not need the team.

## Phase 2 — audit (parallel sub-agents, read-only)

Spawn only the agents whose layer is in scope, `run_in_background: true`:

```
Agent(jarvis-vault-keeper,      "audit vault state",        model: opus)
Agent(jarvis-skill-engine,      "audit engine + schedules", model: opus)
Agent(jarvis-capture-engineer,  "audit capture path",       model: opus)
Agent(jarvis-voice-ha,          "audit nodes + entities",   model: opus)
```

Each returns findings **and a reference manifest** — every path, entity ID, secret, URL
and schedule it relied on. The manifest is not optional; it is QA's input.

Then run the bundled checkers and fold their output in:

```
bash .claude/skills/vault-integrity-audit/scripts/drift-check.sh <vault>
python3 .claude/skills/qa-boundary-check/scripts/verify-refs.py <vault>
```

When the phone app is in scope, its own pre-flight belongs here too — `node jarvis-doctor.mjs`
reports whether jarvis-core will actually run on this device, and `node self-knowledge.mjs
--check` gates documentation against the live tool registry.

## Phase 3 — build (agent team, incremental QA)

```
TeamCreate(jarvis, [vault-keeper, capture-engineer, skill-engine, voice-ha, integration-qa])
TaskCreate(one task per finding, dependencies declared)
```

Members self-coordinate via `SendMessage`. Two standing rules:

- **QA runs after each module completes, not once at the end.** A boundary defect found
  after five modules costs five times as much to locate.
- **Owners fix; QA reports.** QA has no Write/Edit tools. If QA repaired what it found,
  the signal about which agent's process leaked would be destroyed.

## Phase 4 — commit (single agent)

`jarvis-vault-keeper` alone commits, through one serialized rebase-retry push to
`master`. Before it commits, QA hands it a consolidated findings table.

**QA's veto:** an unresolved **S1** (silent-failure) FAIL blocks the commit. S2 and S3
are reported, not blocking. This is QA's only veto — it exists because silent failures
are the class that actually ships here.

## Phase 5 — session end

1. Update the relevant `Projects/<Project>/_index.md`.
2. Write `Projects/<Project>/sessions/YYYY-MM-DD.md`.
3. Tick `Account/capture_queue.md`.
4. Present every changed file before pushing.

## Data passing

| Strategy | Used for |
|---|---|
| Task-based (`TaskCreate`/`TaskUpdate`) | coordination, dependencies, progress |
| File-based (`_workspace/`) | artefacts, manifests, audit trail |
| Message-based (`SendMessage`) | live findings, conflicts, QA interrupts |

File naming: `_workspace/{phase}_{agent}_{artifact}.{ext}` — e.g.
`02_skill-engine_manifest.md`. Final outputs go to real vault paths; `_workspace/` is
kept for post-hoc verification.

## Error handling

| Situation | Action |
|---|---|
| An agent fails | retry once. On second failure, proceed without it and **name the omission in the report** — never present a partial run as complete. |
| Two agents propose conflicting edits to one file | do not merge. Surface both with attribution; escalate to the user. |
| Conflicting data between sources | keep both, cite both origins. Deleting one side destroys the evidence that they disagreed. |
| QA cannot run a check | `UNVERIFIED`, never `PASS`. Name what access was missing. |
| GitHub API 403 | re-check via `git clone --depth 1` or `raw.githubusercontent.com` + `User-Agent`. Never record a rate-limit as a missing file. |
| A change would introduce a recurring cost | stop. Report the C1 (£0) violation and propose the free path before building. |
| Push rejected | pull --rebase, retry once. Never force-push. |

## Test scenarios

**Normal flow — "the morning brief has been empty for a week".**
Phase 1 reads context. Phase 2 sends `skill-engine` and `vault-keeper` out in parallel;
`verify-refs.py` reports `runner.mjs` reads `Claude Memory/MEMORY.md`, absent → S1. Phase
3: vault-keeper creates the file (real content, not invented), skill-engine confirms the
workflow is on `master`, QA re-verifies both sides. Phase 4: one commit, QA table
attached. Phase 5: index + session note + queue ticked.

**Error flow — HA unreachable during an entity check.**
`voice-ha` cannot resolve `media_player.jelly_beans_tv_3` because the hub is unreachable.
It does **not** guess a similar ID — and in particular does not fall back to
`media_player.tv_jelly_beans_tv_2`, a retired ID that still appears in older vault notes
and no longer exists in the registry. QA marks the check `UNVERIFIED` (not FAIL, not PASS)
and names the missing access. The orchestrator proceeds with the vault work, and the report
states plainly that entity verification did not run. Nothing claims to have been checked.

**Follow-up flow — "redo just the capture part".**
Phase 0 finds `_workspace/` and a partial-change request → partial re-run. Only
`capture-engineer` is re-invoked; it reads the prior rule table first so new rules do
not contradict old ones. QA re-tests prior FAILs and marks each FIXED / STILL FAILING /
REGRESSED before anything new is accepted.

## Gotchas

- **Documented, merged, and running are three states.** This project conflates them
  routinely and it is the most expensive habit in it. Report which one each claim reached.
- **A doc claiming something is broken costs as much as one claiming it works.** On
  2026-09-04 a stale handoff described a working tool as a stub; half a session went into
  rebuilding it. Read the code before writing code for it.
- **A partial run presented as complete is the worst possible output.** If an agent
  failed and you proceeded, name the omission in the report.
- **Never merge two agents' conflicting edits to one file silently.** Surface both with
  attribution and escalate. Silent merges destroy the evidence that they disagreed.
- **Never let QA repair what it finds.** It has no Write or Edit tools by design; a
  checker that fixes things destroys the signal about which agent's process leaked.
- **A checker must derive from the code, never restate it.** A verification tool holding a
  constant that also lives in the thing it verifies will drift, then report the stale value
  confidently — worse than no check at all.
- **Do not audit through the GitHub API.** A mid-run 403 will be recorded as missing
  files and poison every downstream decision.
- **`_workspace/` is the audit trail.** Never discard it silently — move it to
  `_workspace_prev/` and diff against it.
