# Atlas Swarm — runnable harness

Parallel scripted Playwright workers that enter the queued training records into
the Atlas portal, reusing one human-established login session. This is the
fast/cheap swarm for ~1,300 near-identical form-fills. (For the alternative
LLM-agent-per-record approach, see `../AGENT_RUNBOOK.md` — not recommended at
this volume.)

## Files
- `config.py` — portal URL, **selectors**, throttle, date format. Fill the
  `TODO` selectors from `../PORTAL_WALKTHROUGH_TEMPLATE.md` before a live run.
- `login_bootstrap.py` — run once (headed), log in + MFA, saves `auth_state.json`.
- `run_worker.py` — one shard of the queue; run several in parallel.
- `merge_results.py` — combine worker outputs → `../work_queue_status.csv` + recon.
- `results/`, `screenshots/` — per-run outputs (gitignored).
- `auth_state.json` — your session (gitignored, **secret**).

## Setup (on a machine with a display, your own — not the cloud container)
```bash
pip install playwright
playwright install chromium
```

## Step 1 — capture selectors (once)
Do one real "Add result" in Atlas and fill the `TODO`s in `config.py` per
`../PORTAL_WALKTHROUGH_TEMPLATE.md`. Confirm `ADD_RESULT_URL` and `DATE_FORMAT`.

## Step 2 — capture a login session (once, re-run when it expires)
```bash
python login_bootstrap.py     # browser opens; log in fully incl. MFA; press ENTER
```
Produces `auth_state.json`. **MFA is why this is manual** — it can't be headless.

## Step 3 — pilot (no writes)
```bash
python run_worker.py --worker pilot --start 1 --end 10 --dry-run
```
`--dry-run` walks the shard and checks selectors/queue without touching Atlas.
Then do a real pilot of 10 and verify in Atlas (see `../QA_VERIFICATION.md`)
before scaling.

## Step 4 — scale (static shards, non-overlapping ranges)
The queue is priority-sorted (OVERDUE first). Split it across N workers and run
them concurrently. Example for the first 296 OVERDUE across 5 workers:
```bash
python run_worker.py --worker A --start 1   --end 60  &
python run_worker.py --worker B --start 61  --end 120 &
python run_worker.py --worker C --start 121 --end 180 &
python run_worker.py --worker D --start 181 --end 240 &
python run_worker.py --worker E --start 241 --end 296 &
wait
```
Keep N small (3–5) to stay human-like and avoid bot-detection / lockout. Each
worker throttles 8–15s/record and stops itself after 3 consecutive errors.

## Step 5 — reconcile
```bash
python merge_results.py
```
Writes `../work_queue_status.csv` and prints DONE/SKIPPED/HOLD/ERROR/PENDING
counts. Target: `DONE + SKIPPED + HOLD + ERROR = 1,358`, all 7 HOLD = the
uncertain surnames, ERRORs itemised for follow-up.

## Safety / guardrails (built in)
- Reuses a human session; **never handles credentials or MFA**, never commits
  `auth_state.json`.
- HOLD-flagged rows (uncertain surnames) are skipped automatically.
- Dedupe: skips a record if Atlas already has the same staff+course+completed
  date (prevents duplicates on re-runs).
- Staff must match an existing record and course must exist — otherwise ERROR,
  never a guess / never creates new staff.
- Throttle + consecutive-error stop + per-record screenshots for audit.

## Before you go live — confirm
1. **Authorisation/ToS:** that automated owner-driven entry into Atlas is
   acceptable (or treat as assisted entry). See `ORCHESTRATION.md`.
2. **Interval policy** for the 168 CAUTION rows (Makaton / Record Keeping /
   Risk Assessment / Driver Safety) — fix expiries in `../work_queue.csv` first
   if 3-year is wrong, so you don't redo them.
