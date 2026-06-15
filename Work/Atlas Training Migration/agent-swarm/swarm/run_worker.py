"""
Swarm worker. Each worker processes a contiguous shard of the priority-sorted
work queue, reusing the authenticated session from auth_state.json. Run several
in parallel with non-overlapping row ranges (static sharding).

    python run_worker.py --worker A --start 1 --end 60
    python run_worker.py --worker B --start 61 --end 120
    ...

Pilot first:  python run_worker.py --worker pilot --start 1 --end 10 --dry-run

Each worker writes its own results CSV (results/<worker>.csv) and screenshots —
no shared-file write contention. Merge with merge_results.py at the end.

The actual form interaction lives in enter_record(); its selectors come from
config.py (fill them from the portal walkthrough first). With selectors unset it
runs in --dry-run only.
"""
import argparse
import csv
import os
import random
import re
import sys
import time
from datetime import datetime

import config  # playwright is imported lazily so --dry-run needs no browser libs

QUEUE = os.path.join(os.path.dirname(__file__), "..", "work_queue.csv")
RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")
SHOTS_DIR = os.path.join(os.path.dirname(__file__), "screenshots")


def load_shard(start, end):
    with open(QUEUE, newline="") as f:
        rows = list(csv.DictReader(f))
    # rows are 1-indexed by position in the priority-sorted queue
    return rows[start - 1:end]


def throttle():
    time.sleep(random.uniform(*config.THROTTLE_SECONDS))


def selectors_ready():
    # Known-good captured selectors. Employee/course options and the success
    # signal are handled by text/label locators + dialog-close, so they don't
    # need ids here.
    must = [config.SEL_DISTRIBUTE_TO, config.SEL_COURSE_INPUT,
            config.SEL_START_DATE, config.SEL_COMPLETED_DATE, config.SEL_SAVE]
    return all(s and "TODO" not in str(s) for s in must)


def _open_add_training(page):
    """From the Manage employees page, open the Add-training dialog."""
    page.goto(config.ADD_RESULT_URL, timeout=config.NAV_TIMEOUT_MS)
    if "auth.atlas-hub.co.uk" in page.url:
        raise RuntimeError("session expired - re-run login_bootstrap.py")
    page.wait_for_load_state("domcontentloaded")
    # Open the ⋮ menu next to "Add Employee / Worker", then click ADD TRAINING.
    try:
        page.get_by_role("button", name=re.compile(r"more|options|menu", re.I)).first.click(timeout=3000)
    except Exception:  # noqa: BLE001 - menu may already be reachable
        pass
    page.get_by_text("ADD TRAINING", exact=False).first.click(timeout=8000)
    page.wait_for_selector(config.SEL_DISTRIBUTE_TO, timeout=10000)


def _pick_autocomplete(page, locator, text, what):
    """Type into an autocomplete field and click the option matching `text`."""
    locator.click()
    locator.fill("")
    locator.type(text, delay=40)
    page.wait_for_timeout(900)
    if page.get_by_text("No Result Found", exact=False).count() > 0:
        raise LookupError(f"{what} not found in Atlas: {text}")
    # Prefer an explicit listbox option, else any exact-text match, else keyboard.
    for cand in (page.get_by_role("option", name=text),
                 page.get_by_text(text, exact=True)):
        try:
            cand.first.click(timeout=2500)
            return
        except Exception:  # noqa: BLE001
            continue
    locator.press("ArrowDown")
    locator.press("Enter")


def _set_date(page, selector, value):
    el = page.locator(selector)
    el.click()
    el.fill("")
    el.type(value, delay=30)
    el.press("Escape")  # close the calendar popup


def enter_record(page, rec, worker, dry_run):
    """Enter one record. Returns (status, note). status in
    DONE / SKIPPED / HOLD / ERROR."""
    if rec["flag"] == "HOLD-HR-NAME":
        return "HOLD", "uncertain surname - awaiting HR"

    if dry_run:
        return "DRYRUN", "selectors ok" if selectors_ready() else "selectors not set"

    name, course = rec["full_name"], rec["training_course"]
    try:
        _open_add_training(page)
    except RuntimeError as e:
        return "ERROR", str(e)

    # 1. Add training to -> Employee
    page.select_option(config.SEL_DISTRIBUTE_TO, label=config.DISTRIBUTE_VALUE)

    # 2. Employee (type-to-search; located by its "Employee" label)
    try:
        emp = page.get_by_label("Employee", exact=True)
        _pick_autocomplete(page, emp, name, "staff member")
    except LookupError as e:
        return "ERROR", str(e)

    # 3. Course (autocomplete by id)
    try:
        _pick_autocomplete(page, page.locator(config.SEL_COURSE_INPUT), course, "course")
    except LookupError as e:
        return "ERROR", str(e)

    # 4. Dates. We only hold a completion date, and Start is required, so
    #    Start = Completed = our completed_date. Expiry from our master.
    _set_date(page, config.SEL_START_DATE, rec["completed_date"])
    _set_date(page, config.SEL_COMPLETED_DATE, rec["completed_date"])
    if rec["has_expiry"] == "YES" and rec["expiry_date"]:
        _set_date(page, config.SEL_EXPIRY_DATE, rec["expiry_date"])

    # 5. Submit
    page.click(config.SEL_SAVE)

    # 6. Success = the dialog closes (title detaches), else a configured toast.
    from playwright.sync_api import TimeoutError as PWTimeoutError  # lazy
    try:
        page.wait_for_selector("text=Add training history details",
                               state="detached", timeout=10000)
    except PWTimeoutError:
        if config.SEL_SAVE_SUCCESS and "TODO" not in config.SEL_SAVE_SUCCESS:
            try:
                page.wait_for_selector(config.SEL_SAVE_SUCCESS, timeout=4000)
            except PWTimeoutError:
                return "ERROR", "save not confirmed"
        else:
            return "ERROR", "save not confirmed (dialog stayed open - check validation)"

    shot = os.path.join(SHOTS_DIR, f"{rec['record_id']}.png")
    page.screenshot(path=shot)
    return "DONE", os.path.relpath(shot)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--worker", required=True)
    ap.add_argument("--start", type=int, required=True)
    ap.add_argument("--end", type=int, required=True)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--headed", action="store_true",
                    help="show the browser (use for the pilot to watch/debug)")
    args = ap.parse_args()

    os.makedirs(RESULTS_DIR, exist_ok=True)
    os.makedirs(SHOTS_DIR, exist_ok=True)

    if not args.dry_run and not os.path.exists(config.AUTH_STATE):
        sys.exit("No auth_state.json. Run login_bootstrap.py first.")
    if not args.dry_run and not selectors_ready():
        sys.exit("Form selectors not set in config.py. Do the walkthrough first, "
                 "or use --dry-run.")

    shard = load_shard(args.start, args.end)
    out_path = os.path.join(RESULTS_DIR, f"{args.worker}.csv")
    consec_err = 0
    counts = {}

    out = open(out_path, "w", newline="")
    w = csv.writer(out)
    w.writerow(["record_id", "result", "note", "timestamp", "worker"])

    # Browser only for live runs; --dry-run needs no playwright at all.
    page = browser = pw = None
    if not args.dry_run:
        from playwright.sync_api import sync_playwright  # lazy import
        pw = sync_playwright().start()
        browser = pw.chromium.launch(headless=config.HEADLESS and not args.headed)
        ctx = browser.new_context(storage_state=config.AUTH_STATE)
        page = ctx.new_page()
        page.set_default_timeout(config.NAV_TIMEOUT_MS)

    try:
        for rec in shard:
            try:
                status, note = enter_record(page, rec, args.worker, args.dry_run)
            except Exception as e:  # noqa: BLE001
                status, note = "ERROR", f"{type(e).__name__}: {e}"

            counts[status] = counts.get(status, 0) + 1
            w.writerow([rec["record_id"], status, note,
                        datetime.now().isoformat(timespec="seconds"), args.worker])
            out.flush()
            print(f"[{args.worker}] {rec['record_id']} {rec['full_name']:<28} "
                  f"{rec['training_course']:<30} -> {status} ({note})")

            consec_err = consec_err + 1 if status == "ERROR" else 0
            if consec_err >= config.MAX_CONSECUTIVE_ERRORS:
                print(f"[{args.worker}] {consec_err} consecutive errors - stopping. "
                      "Check session / selectors / CAPTCHA.")
                break
            if status not in ("HOLD", "SKIPPED", "DRYRUN"):
                throttle()
    finally:
        out.close()
        if browser:
            browser.close()
        if pw:
            pw.stop()

    print(f"[{args.worker}] done: {counts} -> {out_path}")


if __name__ == "__main__":
    main()
