"""Drive Citation Atlas to enter training records row-by-row (no bulk import).

This is a TEMPLATE. Citation Atlas's exact field IDs/labels are not public, so the
selectors below are placeholders marked `# TODO`. Two ways to use it:

  A) Hand it to Claude Code + the playwright-skill (lackeyjb/playwright-skill).
     Say: "Open Atlas, record the selectors for the Add Training form, and fill in
     the TODOs in enter_records.py." Claude inspects the live page and fills them.

  B) Fill the selectors yourself once, then run this script directly.

SAFETY DESIGN (important for a live HR system holding real staff data):
  * Credentials come from environment variables, never the code or the CSV.
  * --dry-run (default) navigates and fills but DOES NOT submit.
  * --limit N stops after N rows so you can supervise the first batch.
  * Only rows where `approved == yes` (a column you add after reviewing the
    master sheet) are entered. Nothing is entered without explicit sign-off.
  * Every attempt is logged to output/entry_log.csv with a screenshot on failure.

Prereqs:  pip install playwright  &&  playwright install chromium
Env:      ATLAS_URL, ATLAS_USERNAME, ATLAS_PASSWORD
Run:      python src/enter_records.py --csv output/master.csv --dry-run --limit 3
Go live:  python src/enter_records.py --csv output/master.csv --submit
"""
from __future__ import annotations

import argparse
import csv
import os
from datetime import datetime
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:  # pragma: no cover
    sync_playwright = None


def load_approved(csv_path: Path) -> list[dict]:
    with csv_path.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    # Only enter rows explicitly approved AND with the data we need.
    approved = [
        r for r in rows
        if r.get("approved", "").strip().lower() in {"yes", "y", "true", "1"}
        and r.get("staff_name") and r.get("course_canonical") and r.get("completion_date")
    ]
    return approved


def login(page) -> None:
    page.goto(os.environ["ATLAS_URL"])
    # TODO: confirm these selectors against the real Atlas login page
    page.fill("input[name='username']", os.environ["ATLAS_USERNAME"])
    page.fill("input[name='password']", os.environ["ATLAS_PASSWORD"])
    page.click("button[type='submit']")
    page.wait_for_load_state("networkidle")


def enter_one(page, row: dict, submit: bool) -> None:
    """Fill the Add Training form for a single record."""
    # TODO: replace with the real navigation to the "add training" form.
    page.click("text=Add Training")
    page.wait_for_load_state("networkidle")

    # TODO: replace selectors with the real field locators.
    page.fill("input[name='employee']", row["staff_name"])
    page.click(f"text={row['staff_name']}")          # pick from autocomplete
    page.select_option("select[name='course']", label=row["course_canonical"])
    page.fill("input[name='completion_date']", _to_atlas_date(row["completion_date"]))

    if submit:
        page.click("button:has-text('Save')")
        page.wait_for_load_state("networkidle")


def _to_atlas_date(iso: str) -> str:
    """Convert YYYY-MM-DD to the format the Atlas date field expects.

    Default assumes UK dd/mm/yyyy — adjust if Atlas uses a date picker instead.
    """
    return datetime.strptime(iso, "%Y-%m-%d").strftime("%d/%m/%Y")


def main() -> None:
    ap = argparse.ArgumentParser(description="Enter approved training records into Citation Atlas.")
    ap.add_argument("--csv", default="output/master.csv")
    ap.add_argument("--limit", type=int, default=None, help="Stop after N rows (supervise first)")
    ap.add_argument("--submit", action="store_true", help="Actually submit (default is dry-run)")
    ap.add_argument("--headless", action="store_true", help="Hide the browser window")
    args = ap.parse_args()
    submit = args.submit  # dry-run unless --submit is passed

    if sync_playwright is None:
        raise SystemExit("Playwright not installed. Run: pip install playwright && playwright install chromium")
    for var in ("ATLAS_URL", "ATLAS_USERNAME", "ATLAS_PASSWORD"):
        if not os.environ.get(var):
            raise SystemExit(f"Missing env var: {var}")

    rows = load_approved(Path(args.csv))
    if args.limit:
        rows = rows[: args.limit]
    print(f"{len(rows)} approved rows to enter ({'SUBMIT' if submit else 'DRY-RUN'})")

    log_path = Path("output/entry_log.csv")
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw, log_path.open("a", newline="", encoding="utf-8") as logfh:
        writer = csv.writer(logfh)
        browser = pw.chromium.launch(headless=args.headless)
        page = browser.new_page()
        login(page)
        for i, row in enumerate(rows, 1):
            try:
                enter_one(page, row, submit)
                status = "submitted" if submit else "dry-run-ok"
                print(f"  [{i}/{len(rows)}] {status}: {row['staff_name']} / {row['course_canonical']}")
                writer.writerow([datetime.now().isoformat(), status, row["staff_name"], row["course_canonical"]])
            except Exception as e:  # log, screenshot, continue
                shot = f"output/error_{i}.png"
                try:
                    page.screenshot(path=shot)
                except Exception:
                    shot = "(no screenshot)"
                print(f"  [{i}/{len(rows)}] FAILED: {row['staff_name']} -> {e} ({shot})")
                writer.writerow([datetime.now().isoformat(), f"error: {e}", row["staff_name"], row["course_canonical"]])
        browser.close()


if __name__ == "__main__":
    main()
