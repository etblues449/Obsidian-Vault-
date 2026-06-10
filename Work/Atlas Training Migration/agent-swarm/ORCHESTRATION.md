# Atlas Swarm — START HERE (Orchestration)

**Goal:** enter 1,358 verified training records into the Citation Atlas web
portal using a swarm of browser-driving agents, in parallel, without collisions
or duplicates.

> Authoritative data: `../Atlas_Training_Master_VERIFIED.xlsx`
> Work queue: `work_queue.csv` (and `.json`) — the single source agents read/write.

---

## ⚠️ Read before you launch (4 blockers)

1. **Atlas has no self-serve bulk import** for historical records with expiry
   dates (per Citation). The *sanctioned* fast path is Citation's onboarding
   team bulk-loading a spreadsheet. A browser swarm is the DIY alternative —
   use it only if Citation can't/won't bulk-load in your timeframe.
2. **Authorisation / ToS.** Automating a third-party SaaS with a swarm may
   breach Atlas terms and can trip bot-detection (CAPTCHA, rate-limits, account
   lock). Confirm with Citation that automated entry by the account owner is
   acceptable, or treat the agents as "assisted manual entry" (human logged in,
   agent fills forms) rather than headless bots.
3. **Credentials never go in these files or agent prompts.** A human logs into
   Atlas and hands each agent an *already-authenticated browser session*. Agents
   must never see, type, or store the Atlas password/MFA.
4. **Open data items still unresolved** (see `EXCEPTIONS.md`). 7 records are on
   HOLD (uncertain surnames — entering them risks duplicate staff in Atlas) and
   168 carry an unconfirmed interval. These are pre-flagged in `work_queue.csv`.

If any of 1–4 is a no, stop and resolve it before spinning up the swarm.

---

## The documents in this folder

| File | Purpose |
|---|---|
| `ORCHESTRATION.md` (this file) | How the swarm is partitioned, claims work, avoids dupes, and reports progress |
| `AGENT_RUNBOOK.md` | The per-record SOP — give this to each agent verbatim as its instructions |
| `FIELD_MAPPING.md` | Source column → Atlas form field, with exact value transforms |
| `EXCEPTIONS.md` | Records to HOLD/skip and the unresolved policy questions |
| `QA_VERIFICATION.md` | Post-entry verification + reconciliation checklist |
| `work_queue.csv` / `.json` | The 1,358-record claimable task list (source of truth for progress) |
| `PORTAL_WALKTHROUGH_TEMPLATE.md` | Fill this in from ONE manual entry to capture the real selectors before launch |

---

## Step 0 — Capture the real portal flow (do this ONCE, manually)

The runbook below is correct on *logic* but cannot contain real CSS selectors /
field labels until someone records one real entry. A human (or one agent with a
human watching) does a single "Add result" in Atlas and fills in
`PORTAL_WALKTHROUGH_TEMPLATE.md`: the URL, the exact field labels, dropdown
behaviour (does it autocomplete staff names? create-new vs select-existing?),
the date format the field accepts, and the save/confirm step. **Do not launch
the swarm until that template is filled** — otherwise every agent fails
identically.

## Step 1 — Partition the work (sharding)

Agents must never work the same record. Shard by **`record_id` ranges** taken
in **priority order** (the CSV is already sorted: OVERDUE → EXPIRING → CURRENT →
NO EXPIRY). Recommended: start with a **small pilot** then scale.

- **Pilot:** 1 agent, first 10 OVERDUE rows. Verify in Atlas. Fix the runbook.
- **Scale:** N agents (start N=3–5, not 50). Lower N = lower lock/ban risk.

Two collision-safe options:

- **Static shards (simplest):** split the queue into N contiguous blocks and
  hand each agent its block (e.g. Agent A = rows 1–60, B = 61–120 …). No shared
  state needed; just don't overlap ranges. Process OVERDUE block first.
- **Dynamic claim (resilient):** agents atomically claim the next `PENDING` row
  by writing their id into `claimed_by` + setting `entry_status=IN_PROGRESS`
  before acting. Requires a lock so two agents don't grab the same row — see
  "Claiming protocol" below.

For ≤5 agents, **static shards are simpler and safe**. Use dynamic claim only if
you want fault-tolerance (an agent dying mid-block).

## Step 2 — Claiming protocol (only if using dynamic claim)

`work_queue.csv` is not concurrency-safe if many writers hit it at once. Use ONE
coordinator:
- A single **coordinator agent/process** owns the CSV. Workers ask it "give me
  the next record"; it marks `IN_PROGRESS` + `claimed_by` and hands it over.
- On success worker reports back → coordinator sets `DONE` + writes the Atlas
  confirmation id into `atlas_confirmation`.
- On failure → `ERROR` with reason in `agent_notes`; coordinator re-queues or
  parks it.
- Never let workers write the shared CSV directly in parallel.

## Step 3 — The dedupe rule (critical)

**One record = unique (`full_name` + `training_course` + `completed_date`).**
Before saving, the agent searches Atlas for that staff+course; if a result with
the same completed date already exists, it **SKIPs** (`entry_status=SKIPPED`,
note "already in Atlas") rather than creating a duplicate. The master already
de-duplicated and kept the latest completion per person+course, so within the
queue each row is unique — this guard catches re-runs and prior manual entries.

## Step 4 — Rate & safety limits

- Throttle: ~1 record / 8–15s per agent (human-like). Don't hammer.
- Hard stop on: repeated CAPTCHA, "unusual activity" warning, session logout,
  or 3 consecutive save failures → pause that agent, alert the human.
- Each agent keeps an append-only log (`logs/agent-<id>.log`): record_id,
  timestamp, action, result, Atlas confirmation/screenshot path.
- Screenshot the Atlas confirmation after each save (audit trail).

## Step 5 — Reconcile (see `QA_VERIFICATION.md`)

When `entry_status` is all DONE/SKIPPED/HOLD: pull an Atlas training export and
diff against `work_queue.csv` — counts must reconcile (entered + skipped-dupes +
held = 1,358). Spot-check a sample of OVERDUE entries for correct dates/expiry.

---

## Suggested launch order

1. Fill `PORTAL_WALKTHROUGH_TEMPLATE.md` from one manual entry.
2. Resolve / accept the `EXCEPTIONS.md` items (or accept HOLD on the 7).
3. Pilot: 1 agent × 10 OVERDUE rows → QA → tune runbook.
4. Scale to 3–5 agents, OVERDUE block first (296 rows), then the rest.
5. Reconcile and sign off.
