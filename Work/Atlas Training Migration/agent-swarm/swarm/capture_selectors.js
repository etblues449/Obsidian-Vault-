// ============================================================================
// Atlas selector capture — paste this into the browser Console on the Atlas
// "Add result" form (the one with staff/course/date fields visible).
//
// HOW:
//   1. Log into Atlas, open the Add result form for any staff member.
//   2. Press F12 -> "Console" tab.
//   3. Paste this whole file, press Enter.
//   4. It prints a table of every field with a ready-to-use selector.
//   5. Copy the selectors into ../swarm/config.py (see SELECTOR_WORKSHEET.md).
// ============================================================================
(() => {
  const sel = (el) => {
    if (el.id) return `#${el.id}`;
    if (el.name) return `[name="${el.name}"]`;
    const aria = el.getAttribute('aria-label');
    if (aria) return `[aria-label="${aria}"]`;
    const ph = el.placeholder;
    if (ph) return `[placeholder="${ph}"]`;
    return el.tagName.toLowerCase();
  };
  const labelFor = (el) => {
    if (el.id) {
      const l = document.querySelector(`label[for="${el.id}"]`);
      if (l) return l.innerText.trim();
    }
    const wrap = el.closest('label');
    if (wrap) return wrap.innerText.trim();
    return el.getAttribute('aria-label') || el.placeholder || '';
  };
  const rows = [];
  document.querySelectorAll('input, select, textarea, button, [role="button"], [role="combobox"]')
    .forEach((el) => {
      if (!el.offsetParent && el.type !== 'hidden') return; // visible only
      rows.push({
        kind: el.tagName.toLowerCase() + (el.type ? `:${el.type}` : ''),
        label: labelFor(el),
        text: (el.innerText || el.value || '').trim().slice(0, 40),
        selector: sel(el),
      });
    });
  console.table(rows);
  console.log('Copy the SELECTOR for: staff field, course field, completed-date '
    + 'field, expiry-date field, save button. Then fill config.py.');
  return rows;
})();
