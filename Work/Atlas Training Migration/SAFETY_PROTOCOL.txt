# SAFETY PROTOCOL — operating the live Atlas portal

This is a **live production care-compliance system**. The goal: every record
entered **correctly**, nothing **mass-applied**, nothing **edited or deleted by
accident**, and a way to **prove and reverse** anything that goes wrong. Read
this before any automated or assisted entry. The rules here override speed.

---

## 0. The 6 golden rules (non-negotiable)

1. **ONLY ever add training.** Use the **Add Training** panel and the **Add**
   button. Never Edit, Delete, Remove, Archive, Import, "Update Employees", or
   any bulk action.
2. **"Add training to" = Employee. ALWAYS.** Never select *All employees in the
   company*, *Site*, *Employee group*, or *Department or team*. Those apply one
   course to **many people at once** — the single most dangerous action on this
   screen. If "Employee" isn't selected, **do not click Add**.
3. **One named person per record.** Confirm the specific person is selected
   before saving. No person selected, or scope not "Employee" → **stop**.
4. **Never invent or guess.** Wrong/unknown person, course, or date → log ERROR
   and move on. Accuracy beats completeness.
5. **Verify every save.** A record isn't "done" until you've seen it saved
   against the **right person**. Don't assume.
6. **When unsure, stop and ask a human.** Any unexpected dialog, confirmation
   prompt, or destructive-looking button → pause, don't click through.

---

## 1. Before you start (do these once)

- [ ] **EXPORT a backup first.** On Employees → Manage, the ⋮ menu has **EXPORT**
      — export the current employee/training data and save it with today's date.
      This is your "before" snapshot and your rollback reference. **Do not skip
      this.**
- [ ] **Confirm the right organisation.** Top-right should read **Elliot Horton
      / Select Lifestyles Limited**, URL contains the org id
      `9892b03b-...576d96`. If it shows a different company, stop.
- [ ] **Close other editors.** No one else (and no other tab/agent) should be
      editing Atlas at the same time — concurrent edits cause collisions and
      duplicates.
- [ ] **Single operator.** One agent / one session only. No parallel swarm
      against this portal (it collides on one login and trips bot-detection).

## 2. The catastrophic risks, and how each is blocked

| Risk | Consequence | Control |
|---|---|---|
| Pick a bulk scope ("All employees" / Department) | One course applied to 408 staff; reversal = deleting hundreds | **Rule 2**: Employee scope only, verified before every Add |
| Click Delete / Remove on an existing record | Real training history lost | **Rule 1**: never touch delete controls; add-only |
| Edit/overwrite an existing entry | Existing record corrupted | **Rule 1**: only the Add Training panel; never open/modify existing records |
| Use IMPORT / Update Employees | Mass overwrite of employee data | **Rule 1**: those ⋮ items are off-limits |
| Wrong person via autocomplete | Training on the wrong file | **Rule 5**: confirm the exact name before save |
| Date flips (mm/dd) | Wrong expiry / false compliance | §4 date check; the 13/11/2024 test |
| Duplicate entries | Inflated/again records | Dedupe check before each save |
| Silent save failure (network) | Thinks done, isn't | **Rule 5**: confirm the record appears |
| Session expiry mid-run | Partial/failed saves unnoticed | §5 batch checkpoints; re-login and re-verify |

**Key reassurance:** because we are **add-only** and never use delete, the
worst realistic accident is *extra/wrong records* — which are identifiable in
the log and removable deliberately — not silent loss of existing history. The
one exception is bulk-scope (Rule 2), which is why that rule is absolute.

## 3. Per-record verification (every single record)

1. Scope shows **Employee**, and the **correct named person** is selected.
2. Course is the intended course (closest exact match; never a guess).
3. Start = Completed = the record's completed date; Expiry = the record's expiry
   (blank for no-expiry courses).
4. Click **Add**; **see the confirmation** / panel close.
5. Mark the outcome in `entry_log.csv` (DONE / SKIPPED / HOLD / ERROR + note).
6. Periodically (and always for the first few), open the person's **Training**
   list and confirm the new record is there with the **right dates**.

## 4. Dates

UK **DD/MM/YYYY**. First proof is **ATL-0006 = 13/11/2024 → must read as 13
November 2024**. If Atlas rejects it, the field wants another format — **stop and
flag it** before continuing. Also confirm the **expiry you typed is what's
stored** (if Atlas recalculates expiry from the course, your value may be
overridden — check on the pilot and report).

## 5. Work in batches with checkpoints

- **Batch 1: the 296 OVERDUE only** (rows 1–296). **Stop and report** the tally
  before going further. Spot-check ~5 of them in Atlas.
- Then proceed in **blocks of ~100–200**, pausing to report after each.
- This keeps sessions fresh, catches any systematic error early (before it's
  repeated 1,000 times), and is easy to resume across sittings.
- **Don't run unattended** for the first batch — watch the first ~10 live.

## 6. Stop immediately and tell a human if…

- Scope won't stay on "Employee", or a person can't be uniquely identified.
- Any **Delete/confirm/"are you sure"** dialog appears.
- A **CAPTCHA** or **"unusual activity"** warning.
- You're **logged out** or asked to re-authenticate.
- The **13/11/2024** date won't save.
- A course is missing for **many** records (needs an admin to add it).
- Anything behaves differently from this protocol.

## 7. After each batch — recording & reconciliation

- Keep `entry_log.csv` current (every record_id has an outcome).
- After a batch, **EXPORT from Atlas again** and compare the new training count
  to your log — the increase should equal your DONE count for the batch.
- **Final reconciliation:** `DONE + SKIPPED + HOLD(7) + ERROR = 1,358`, and an
  Atlas export of training records matches the master for the people entered.

## 8. If something goes wrong (recovery)

1. **Stop.** Don't try to "fix it fast" with more clicks.
2. Use `entry_log.csv` to see exactly what was entered and when.
3. Compare against the **pre-start export** (§1) to identify any unintended
   change.
4. If bulk-scope was triggered: list the affected staff from the export diff and
   remove those specific erroneous records deliberately (or ask Citation
   support) — don't bulk-delete blindly.
5. Document what happened so the master/log stays the source of truth.

---

**One-line summary for the operator:** *Add-only, Employee-scope-only, verify
every save, export a backup first, work the 296 OVERDUE as batch 1 and stop to
report — and when in doubt, don't click, ask.*
