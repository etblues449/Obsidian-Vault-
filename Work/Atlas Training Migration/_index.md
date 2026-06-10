---
name: Atlas Training Migration
description: Migrating Select Lifestyles historical staff training records into Citation Atlas with CQC-compliant expiry intervals
type: project
status: active
last_updated: 2026-06-10
---

# Atlas Training Migration — Select Lifestyles Limited

Migrating historical staff training records into **Citation Atlas** (care
compliance system), with CQC-aligned expiry intervals applied so the team can
track currency and renewals.

- **Organisation:** Select Lifestyles Limited (Learning Disability provider)
- **Target system:** Citation Atlas
- **Authority for intervals:** Skills for Care Statutory & Mandatory Training
  Guide (Dec 2025); NICE SC1 / NG67; CQC Regulation 18 (Staffing)

## CURRENT STAGE (as at 2026-06-10)

**Verified master compiled — awaiting sign-off on open items, then Atlas entry.**

We are **past a major correction**. An earlier "Ready for Approval" version
(1,062 records, built from the Excel export alone) was **superseded** after a
full audit of 102 paper attendance sheets revealed the Excel transcription had
**stopped at 06/11/2025** — ~6 months of sessions (Dec 2025–May 2026) existed
only on paper.

### Authoritative file
➡️ **`Atlas_Training_Master_VERIFIED.xlsx`** — this is the source of truth.

| | Old (CQC_Compliant) ❌ | **VERIFIED ✅ (current)** |
|---|---|---|
| Records | 1,062 | **1,358** |
| Unique staff | 295 | **408** (+113 recovered) |
| Built from | Excel export only | Excel **+ 102 attendance sheets** |
| Overdue | 333 | 296 |

The old `*_SUPERSEDED.*` files in `source-docs/` are kept for history only —
**do not sign those off or enter them into Atlas.**

### VERIFIED status breakdown (as at 04/06/2026)
- OVERDUE: **296**
- Expiring 0–30 days: 16
- Expiring 31–60 days: 7
- Current: 931
- No expiry: 108

### What the audit recovered/fixed
- +417 person-records added from attendance sheets (missing from Excel)
- +113 staff who appeared only on 2026 sheets (e.g. May induction cohort)
- De-duplicated 7 duplicate scans
- Kept latest completion date per person+course (124 repeat/refresh pairs)
- Reconciled informal name variants vs HR spellings

## OPEN ITEMS — need Elliot / HR decision before final Atlas entry

1. [ ] **Unknown course** — PDF1 p25 (session 17/10/25) has no course name. Confirm what it was.
2. [ ] **Uncertain handwritten surnames** — flagged for HR validation: Rimbould, Kaanom, Millican, Guash, Bastonoli, Salimatu Gesay, Oghenekharo (best-reading used; see Source column in master).
3. [ ] **Interval-policy confirmation** — Makaton, Record Keeping, Risk Assessment, Driver Safety were **defaulted to 3-year** (not in core CQC list). Confirm against Select Lifestyles policy. *(Note: the superseded Mapping Reference treated some of these as "no expiry" — another reason it's stale.)*
4. [ ] **Entry method decision** — Citation Atlas has **no self-serve bulk import** for historical records with expiry dates. Choose:
   - Manual "Add result" per record (slow for 1,358), or
   - Citation onboarding team bulk-load (need format from them).
5. [ ] **Priority on entry** — address the **296 OVERDUE** records first.

## CQC interval rules applied (in VERIFIED master)

- **1 year:** Medication, Buccal Midazolam, PEG, Insulin/Glucose, Diabetes,
  Dysphagia, Epilepsy, MCA/DoLS, PRICE/PBS, BLS/CPR, Nurse Lead
- **3 years:** First Aid/EFAW, Moving & Handling, Safeguarding, Fire Safety,
  Oliver McGowan/Autism, Infection Control, Food Hygiene, EDI
- **No expiry (one-time):** Induction, Care Certificate, Intensive Support
- **Assumption flag:** Makaton, Record Keeping, Risk Assessment, Driver Safety
  → defaulted to 3yr (see open item 3)

## Files in this folder

- `Atlas_Training_Master_VERIFIED.xlsx` — ✅ authoritative master (Summary,
  Discrepancy Report, Atlas Training Master sheets)
- `source-docs/` — superseded history:
  - `Atlas_Training_Master_CQC_Compliant_SUPERSEDED.xlsx`
  - `Course_Interval_Mapping_Reference_SUPERSEDED.xlsx`
  - `Atlas_Migration_Ready_For_Approval_SUPERSEDED.txt`

## Next session pickup

Start here. The two highest-leverage moves are confirming the **interval policy
(open item 3)** and the **unknown course (open item 1)**, since both alter the
master before it goes into Atlas. Then decide entry method and work the 296
OVERDUE records first.
