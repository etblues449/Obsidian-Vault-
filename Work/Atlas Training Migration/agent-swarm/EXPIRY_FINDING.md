# ⚠️ Critical finding — the Add Training form has NO expiry field

Captured 2026-06-10 from the real Atlas "Add training" form. Fields are:

- **Add training to** (worker) · **Course** · Course code · CPD minutes ·
  **Start date** (required) · **Completed date** · Course grade · Provider ·
  Description.

There is **no expiry / renewal-date field.** This means:

## What it changes

1. **Our per-record expiry dates cannot be entered.** Atlas computes expiry
   itself, from the **renewal interval configured on each course** in the Atlas
   course library — not from anything we type per record.
2. Therefore the **1-year / 3-year / no-expiry policy must be set on the 37
   courses inside Atlas**, once each — not 1,351 times per record. If a course's
   renewal interval is wrong (or unset) in Atlas, every record under it gets the
   wrong (or no) expiry, regardless of our data.
3. Our master's expiry column becomes a **cross-check**, not an input: after
   entry, Atlas's computed expiry should match ours. Where it doesn't, the
   course's interval in Atlas is wrong and needs fixing there.

## Decisions / actions this creates

- [ ] **Set each course's renewal interval in Atlas** to match the agreed policy
      (1yr meds/specialist, 3yr general, no-expiry one-time). This is the real
      "interval policy" step now — done per course in Atlas, not in our sheet.
      *(Where is it? Likely Manage training → course settings. Confirm.)*
- [ ] **Confirm which date drives expiry** — Start date or Completed date? Our
      records only have a completion date. Plan: put our completed date in
      **both** Start and Completed so expiry is correct whichever Atlas uses.
- [ ] **No-expiry courses (107 records):** confirm those courses are set to "no
      renewal" in Atlas so they aren't flagged as due.

## Knock-on for the swarm

The swarm enters: worker + course + start date + completed date, then submits.
It does **not** enter expiry or status (both Atlas-derived). The QA step then
compares Atlas's computed expiry against our master to catch any course whose
interval is misconfigured.

## Open selector items still needed (one pilot record confirms them)

- `SEL_DISTRIBUTE_OPTION` — how a specific worker is selected in "Add training to".
- `SEL_COURSE_OPTION` — the course autocomplete option element.
- `SEL_SAVE_SUCCESS` — the confirmation shown after Add.
