# Field Mapping — Master → Atlas form

Source: `work_queue.csv` (derived from `Atlas_Training_Master_VERIFIED.xlsx`).
Atlas field names marked `‹CONFIRM›` until `PORTAL_WALKTHROUGH_TEMPLATE.md` is done.

| Master / queue column | Atlas form field ‹CONFIRM› | Transform / rule |
|---|---|---|
| `full_name` | Staff member (select existing) | Match existing staff. Never create new. See name notes below. |
| `training_course` | Training course (dropdown) | Use Atlas label per course table below. |
| `completed_date` | Completed / Date taken | Source is `DD/MM/YYYY`. Reformat to the field's format. |
| `expiry_date` | Expiry / Renewal date | Only if `has_expiry=YES`. Leave blank for one-time courses. |
| `interval_yrs` | (usually not entered) | Informational. If Atlas sets expiry from course interval, verify it equals `expiry_date`; prefer master value on mismatch. |
| `status` | (usually derived) | If Atlas derives from dates, do nothing. Else: OVERDUE/EXPIRING/CURRENT map to Atlas's equivalent labels. |
| `source` | — | Internal provenance, not entered. |

## Value rules

- **Dates:** master uses `DD/MM/YYYY`. Confirm Atlas's accepted format and
  convert consistently. Watch for US `MM/DD` traps on ambiguous dates.
- **No-expiry (108 records):** `has_expiry=NO`, `interval_yrs` blank,
  status `NO EXPIRY` — one-time courses (Induction, Care Certificate, Intensive
  Support, plus other induction-type subjects). Leave expiry empty.
- **Status values present:** OVERDUE (296), EXPIRING (0-30d) (16),
  EXPIRING (31-60d) (7), CURRENT (931), NO EXPIRY (108).

## Course-name reconciliation

The master uses these 34 course labels. Before launch, map any that don't match
the Atlas course list **exactly** (Atlas selection must hit an existing course;
a missing course → ERROR, not a guess). Known abbreviations to verify in Atlas:

- `PRICE (PBS)` → confirm Atlas label (PRICE / Positive Behaviour Support / PBS)
- `First Aid` → EFAW / First Aid at Work?
- `Medication` → Safe Handling & Administration of Medication / Management
  Medication Level 2? (master may have collapsed variants — check)
- `MCA/DoLS`, `Buccal Midazolam`, `PEG`, `Moving & Handling`, `Oliver McGowan /
  Autism`, `Infection Control`, `EDI`, `Food Hygiene` → confirm exact Atlas text.

> Action: open the Atlas course dropdown once, export/screenshot the full course
> list, and complete a `master course → Atlas course` lookup table here. Any
> master course with no Atlas equivalent must be raised with Citation (course
> created in Atlas) before those rows can be entered.

## Name notes

- Master keeps HR/official spellings where known; informal variants were already
  reconciled (Renae→Renee, Jo→Joanne, Viv→Vivienne, Eliott→Elliot,
  Hazelhurst→Hazlehurst).
- **7 rows flagged `HOLD-HR-NAME`** (uncertain handwritten surnames) must NOT be
  entered until HR confirms spelling — see `EXCEPTIONS.md`.
