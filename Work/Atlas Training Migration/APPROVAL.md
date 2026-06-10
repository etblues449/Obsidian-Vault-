---
name: Atlas Migration — Approval & Go-Live
type: project
status: awaiting-sign-off
date: 2026-06-10
---

# Atlas Training Migration — Approval & Go-Live Sheet

**Select Lifestyles Limited (Learning Disability provider) → Citation Atlas**

Sign this off to authorise entry of the verified training data into Atlas via the
swarm. Everything referenced is in this folder.

---

## 1. What will be entered

- **1,358 verified training records**, 408 staff, ~34 courses.
- Source of truth: `Atlas_Training_Master_VERIFIED.xlsx` (Excel export **+** a
  102-page paper attendance-sheet audit that recovered 417 records / 113 staff
  the spreadsheet had dropped after 06/11/2025).
- Status mix: **296 OVERDUE** (entered first), 23 expiring, 931 current,
  108 no-expiry.
- Of these, **7 are HELD** (uncertain handwritten surnames) and entered later —
  so the swarm enters **1,351** now.

## 2. How it will be entered

- **Method:** a swarm of parallel scripted Playwright workers (`agent-swarm/swarm/`)
  reusing ONE human login session. Deterministic, throttled (8–15s/record),
  dedupe-guarded, screenshot-audited.
- **Priority:** OVERDUE block (rows 1–296) first, then the rest.
- **You watch it live:** each record prints `record_id · name · course → result`
  to the console as it goes in; a screenshot is saved per record.

## 3. Decisions needed BEFORE go-live  (tick to approve)

- [ ] **Data is correct** — the 296 OVERDUE and overall figures match expectation.
- [ ] **Interval policy** — Makaton, Record Keeping, Risk Assessment, Driver
      Safety (168 records) default to **3-year** expiry. ☐ Confirm 3yr  /
      ☐ change to: __________ (fix in `work_queue.csv` first if changed).
- [ ] **Unknown course** — PDF1 p25 (17/10/2025): identify or accept it's excluded.
- [ ] **7 HELD names** — accept they're entered later once HR confirms spelling.
- [ ] **Authorisation / ToS** — automated owner-driven entry into Atlas is
      acceptable (or it will be run as *assisted* entry with a human present).
- [ ] **Method** — proceed with swarm (vs. Citation onboarding bulk-load, which
      remains the lower-risk option — see `citation-onboarding/`).

**Approver:** ______________________  **Date:** __________  **Signature:** __________

## 4. Two human-gated unlocks (cannot be automated — login/MFA)

1. **Selector walkthrough** — do one real "Add result" in Atlas and fill the
   `TODO` selectors in `agent-swarm/swarm/config.py`
   (guide: `agent-swarm/PORTAL_WALKTHROUGH_TEMPLATE.md`). ~10 min, once.
2. **Login session** — `python agent-swarm/swarm/login_bootstrap.py`, log in
   with MFA, session saved. Re-run when it expires.

## 5. Go-live (after sign-off + the two unlocks)

```bash
cd "agent-swarm/swarm"
python preflight.py                 # must read READY ✅
python run_worker.py --worker pilot --start 1 --end 10   # 10-record pilot
#   -> verify those 10 in Atlas (QA_VERIFICATION.md), then:
./run_swarm.sh 1 296 5              # the 296 OVERDUE across 5 workers (watch live)
./run_swarm.sh 297 1358 5          # the remainder
python merge_results.py            # reconcile -> must total 1,358
```

## 6. Done = signed off when

- `merge_results.py` reconciles: `DONE + SKIPPED + HELD(7) + ERROR = 1,358`.
- All 296 OVERDUE accounted for; ERRORs itemised with an owner.
- Screenshots archived. `_index.md` status updated to "Atlas entry complete".

---

### Current readiness (auto-checked 2026-06-10)
- ✅ Data verified & queued (1,358) · ✅ Swarm harness built & dry-run passing ·
  ✅ Citation bulk-load package prepared as fallback
- ⏳ Awaiting: this sign-off · selector walkthrough · login session
