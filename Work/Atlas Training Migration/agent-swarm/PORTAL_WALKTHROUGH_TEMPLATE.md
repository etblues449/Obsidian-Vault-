# Atlas Portal Walkthrough — fill from ONE manual entry

Complete this by doing a single real "Add result" in Atlas (human-led). Every
`‹CONFIRM›` in the runbook/field-map comes from here. **Swarm does not launch
until this is filled.**

## Access
- Atlas URL (training/add-result page): `__________`
- Login method (SSO / user+pass / MFA): `__________`
  - (Agents use an already-authenticated session — record HOW a session is
    established for the human, not the credentials themselves.)

## The "Add result" flow — capture each step
1. Path to the form (menu clicks): `__________`
2. **Staff field:** label = `____`; type = (autocomplete / dropdown / search);
   does it create-new or only select-existing? `____`; what a no-match looks
   like: `____`
3. **Course field:** label = `____`; full list exported? (Y/N) → save the list
   into `FIELD_MAPPING.md`. How a missing course presents: `____`
4. **Completed/Date field:** label = `____`; accepted format = `____`
   (test 03/04/2025 — does it read as 3 Apr or 4 Mar?): `____`
5. **Expiry field:** label = `____`; is it manual or auto-derived from course
   interval? `____`; how is "no expiry" represented? `____`
6. **Status/result:** derived from dates automatically, or set manually? `____`;
   if manual, the available options: `____`
7. **Save button** label/selector: `____`; success confirmation looks like:
   `____`; is there a confirmation/reference id? `____`
8. **Dedupe view:** where do existing results for a staff+course show? `____`

## Anti-bot observations
- Any CAPTCHA / rate warnings during manual entry? `____`
- Session timeout length: `____`
- Any "are you sure / bulk" guards: `____`

## Selectors (if using Playwright/browser automation)
Paste the resolved CSS/ARIA selectors for each field above so agents are
deterministic:
- staff: `____`
- course: `____`
- completed: `____`
- expiry: `____`
- save: `____`
- success indicator: `____`
