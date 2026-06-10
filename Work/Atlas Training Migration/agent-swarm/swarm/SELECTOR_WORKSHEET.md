# Selector Worksheet — 5 minutes, fill the blanks

Goal: get the 8 values that make `config.py` live. Two ways — the **fast way**
(console snippet) or the **manual way** (right-click Inspect). Do whichever.

---

## FAST WAY (recommended)

1. Log into Atlas. Open the **Add result** form for any one staff member
   (so the staff/course/date fields are on screen).
2. Press **F12** → click the **Console** tab.
3. Open `capture_selectors.js`, copy the whole file, paste into the Console,
   press **Enter**.
4. It prints a table. Each row has a **selector** (like `#staffId`) and a
   **label** (like "Staff member") so you can tell which is which.
5. Copy the selector for each field into the blanks below.

---

## FILL THESE IN  → then paste into `config.py`

| # | What to find on the form | Selector you found | `config.py` variable |
|---|---|---|---|
| 1 | The page URL of the Add result form | `__________` | `ADD_RESULT_URL` |
| 2 | Staff name box | `__________` | `SEL_STAFF_INPUT` |
| 3 | The dropdown option that appears after typing a name | `__________` | `SEL_STAFF_OPTION` |
| 4 | Course box | `__________` | `SEL_COURSE_INPUT` |
| 5 | The course dropdown option | `__________` | `SEL_COURSE_OPTION` |
| 6 | Completed / Date-taken box | `__________` | `SEL_COMPLETED_DATE` |
| 7 | Expiry / Renewal box | `__________` | `SEL_EXPIRY_DATE` |
| 8 | **Save** button | `__________` | `SEL_SAVE` |
| 9 | Something that appears AFTER a successful save (e.g. a green "Saved" toast) | `__________` | `SEL_SAVE_SUCCESS` |

Also note:
- **Date format** the box accepts (type `03/04/2025` — does it read as 3 Apr or
  4 Mar?): `__________` → set `DATE_FORMAT` in `config.py`
  (`%d/%m/%Y` for DD/MM/YYYY).

### Notes on #3 and #5 (the dropdown options)
These two often need a tiny placeholder. If the option shows the name/course as
text, use a Playwright text selector with `{name}` / `{course}` in it, e.g.:
- `SEL_STAFF_OPTION = "li:has-text('{name}')"`
- `SEL_COURSE_OPTION = "li:has-text('{course}')"`
The `{name}` / `{course}` get filled in automatically per record. If you're not
sure, paste me what the console table showed for those rows and I'll write the
exact line.

---

## MANUAL WAY (if the console snippet doesn't work)

For each field: right-click it → **Inspect** → in the highlighted HTML look for
`id="..."`. Use `#thatId` as the selector. No id? Use `name="..."` →
`[name="thatName"]`.

---

## When done

```bash
cd agent-swarm/swarm
python preflight.py     # should now say READY ✅ (after login_bootstrap.py too)
```

Stuck on any row? Paste me the console table output and I'll fill `config.py`
for you.
