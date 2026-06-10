# QA & Verification

Run during the pilot and again at the end. The swarm isn't "done" until this
reconciles.

## Per-record (every agent, every save)

- [ ] Atlas confirmation/success message seen and screenshotted → `logs/<record_id>.png`
- [ ] Staff name matched an **existing** record (no new staff created)
- [ ] Course matched an existing Atlas course (exact)
- [ ] Completed date entered = `completed_date` (correct DD/MM, no US flip)
- [ ] Expiry = `expiry_date` (or blank for `has_expiry=NO`); if Atlas auto-set a
      different expiry, the delta is noted
- [ ] `entry_status` + `atlas_confirmation` written back to the queue

## Pilot gate (after first 10 OVERDUE)

- [ ] Open each of the 10 in Atlas UI and eyeball-confirm fields
- [ ] No duplicates created; no wrong-staff matches
- [ ] Runbook `‹CONFIRM›` placeholders all replaced with real values
- [ ] Date format verified on a deliberately ambiguous date (e.g. 03/04/2025)
- → Only then scale up.

## Final reconciliation

1. Export the training results from Atlas (or pull a report).
2. Diff against `work_queue.csv`:
   - `DONE` rows present in Atlas with matching staff/course/completed/expiry
   - `SKIPPED` rows correspond to a pre-existing Atlas entry (legit dupe)
   - `HOLD` = 7 (the uncertain surnames), still out
   - `ERROR` rows itemised with reason and a remediation owner
3. **Count check:** `DONE + SKIPPED + HOLD + ERROR = 1,358`.
4. Spot-check a random 30 (weighted to OVERDUE) for field accuracy.
5. Confirm the **296 OVERDUE** are all entered/accounted for (priority block).

## Sign-off

- [ ] Counts reconcile to 1,358
- [ ] OVERDUE block fully accounted for
- [ ] HOLD/ERROR lists have named follow-up owners
- [ ] Screenshots/logs archived in `logs/`
- [ ] Update `../_index.md` status → "Atlas entry complete (date), N entered,
      M skipped-dupes, 7 held, K errors"
