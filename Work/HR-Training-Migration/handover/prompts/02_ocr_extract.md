# Prompt 2 — OCR & extract the attendance sheets

> Use this once the `document-skills` PDF/OCR skill is installed (TOOLCHAIN.md §1).
> The sheets are **handwritten**, so a vision pass is more reliable than raw
> Tesseract — Claude Code can read the rendered page images directly.

```
The attendance sheets are scanned, handwritten "Select Lifestyles Course
Attendance Sheets". Each page has: Company/Branch, Course Name, Date of course,
Delivered by, then a grid of Forename | Surname.

For every page in handover/data/PDF1.pdf and handover/data/PDF2.pdf:
  1. Render the page to an image (pymupdf at 2x zoom) and read it.
  2. Extract: branch, course, date (dd/mm/yyyy), delivered_by, and each
     attendee's full name (Forename + Surname).
  3. Emit ONE row per (attendee x sheet) into data/sheet_records.csv with columns:
        full_name, course, completion_date, source
     where source is the page id e.g. P1_p019.

Rules:
  - There are known DUPLICATE scans — skip a page if its course+date+attendees
    exactly match an earlier page (log which ones you skipped).
  - A pre-OCR'd draft of all 102 pages (surnames only) is in
    data/attendance_sheets_OCR_102pages.jsonl — use it to cross-check your page
    list and dedup, but re-read each page to capture FULL names.
  - Flag any name/date you can't read confidently into data/ocr_review.csv
    rather than guessing.
Save sheet_records.csv and show me a 15-row sample + the total count.
```

## Tip
Do the **13 pre-cutoff pages first** (they hold the people the prior audit
missed): P1 p1–2, 7–12, 19–25, 28–34. Get those into Atlas, then do the rest.
