# Exceptions & Unresolved Items

These are pre-flagged in `work_queue.csv` (the `flag` column). Resolve or
explicitly accept before/while the swarm runs.

## 1. HOLD — uncertain surnames (7 records, `flag=HOLD-HR-NAME`)

Handwritten 2026 surnames read with low confidence. Entering an unverified
spelling risks creating a **duplicate / wrong staff record** in Atlas.

Affected name fragments: **Rimbould, Kaanom, Millican, Guash, Bastonoli,
Salimatu Gesay, Oghenekharo**.

→ **Action:** agents set `entry_status=HOLD` and skip. HR confirms the correct
HR-system spelling, then these are entered manually (or un-flagged in the queue
and re-run). Until then they stay out of Atlas.

## 2. CAUTION — unconfirmed interval (168 records, `flag=CAUTION-INTERVAL`)

Courses **Makaton, Record Keeping, Risk Assessment, Driver Safety** are not in
the core CQC list and were **defaulted to 3-year** expiry. The superseded mapping
doc treated some as "no expiry" — so the expiry dates on these rows are an
assumption.

→ **Action:** confirm the intended interval against Select Lifestyles policy.
   - If 3-year stands → enter as-is (agents already do; expiry is in the row).
   - If they should be "no expiry" or 1-year → fix `interval_yrs`/`expiry_date`
     in the queue first, *then* enter. Don't let agents enter the wrong expiry
     and have to redo 168 records.

## 3. Unknown course — PDF1 p25 (17/10/2025)

One attendance session had no course name. It is **not** represented as an
enterable row (course unknown). → Confirm what the session was; add to the queue
only once identified.

## 4. Course-name → Atlas mapping (see `FIELD_MAPPING.md`)

Any master course label that doesn't exactly match an Atlas course must be mapped
(or the course created in Atlas by Citation) before those rows can be entered.
Agents ERROR rather than guess.

## Reconciliation math

`1,358 total = entered (DONE) + dedupe-skips (SKIPPED) + 7 HOLD + any ERROR`.
At sign-off, ERROR and HOLD counts should be explained, not silently dropped.
