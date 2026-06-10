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
import sys
import time
from datetime import datetime

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
import config

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
    must = [config.SEL_STAFF_INPUT, config.SEL_COURSE_INPUT,
            config.SEL_COMPLETED_DATE, config.SEL_SAVE, config.SEL_SAVE_SUCCESS]
    return all(s and s != "TODO" for s in must)


def enter_record(page, rec, worker, dry_run):
    """Enter one record. Returns (status, note). status in
    DONE / SKIPPED / HOLD / ERROR."""
    if rec["flag"] == "HOLD-HR-NAME":
        return "HOLD", "uncertain surname - awaiting HR"

    if dry_run:
        return "DRYRUN", "selectors ok" if selectors_ready() else "selectors not set"

    name, course = rec["full_name"], rec["training_course"]
    page.goto(config.ADD_RESULT_URL, timeout=config.NAV_TIMEOUT_MS)
    if "auth.atlas-hub.co.uk" in page.url:
        return "ERROR", "session expired - re-run login_bootstrap.py"

    # 1. Staff (must match existing; never create new)
    page.fill(config.SEL_STAFF_INPUT, name)
    opt = config.SEL_STAFF_OPTION.format(name=name)
    try:
        page.click(opt, timeout=5000)
    except PWTimeout:
        return "ERROR", f"staff not found/ambiguous: {name}"

    # 2. Course (must match an existing Atlas course)
    page.fill(config.SEL_COURSE_INPUT, course)
    copt = config.SEL_COURSE_OPTION.format(course=course)
    try:
        page.click(copt, timeout=5000)
    except PWTimeout:
        return "ERROR", f"course missing in Atlas: {course}"

    # 3. Dedupe: skip if a result with the same completed date already exists
    if config.SEL_EXISTING_RESULTS and config.SEL_EXISTING_RESULTS != "TODO":
        existing = page.locator(config.SEL_EXISTING_RESULTS).all_inner_texts()
        if any(rec["completed_date"] in e for e in existing):
            return "SKIPPED", "already in Atlas (same completed date)"

    # 4. Dates
    page.fill(config.SEL_COMPLETED_DATE, rec["completed_date"])
    if rec["has_expiry"] == "YES" and config.SEL_EXPIRY_DATE != "TODO":
        page.fill(config.SEL_EXPIRY_DATE, rec["expiry_date"])

    # 5. Status (only if the form requires it; usually auto-derived)
    if config.SEL_STATUS and config.SEL_STATUS != "TODO":
        mapped = config.STATUS_MAP.get(rec["status"], "")
        if mapped:
            page.select_option(config.SEL_STATUS, label=mapped)

    # 6. Save + confirm
    page.click(config.SEL_SAVE)
    try:
        page.wait_for_selector(config.SEL_SAVE_SUCCESS, timeout=10000)
    except PWTimeout:
        return "ERROR", "save not confirmed"

    shot = os.path.join(SHOTS_DIR, f"{rec['record_id']}.png")
    page.screenshot(path=shot)
    return "DONE", os.path.relpath(shot)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--worker", required=True)
    ap.add_argument("--start", type=int, required=True)
    ap.add_argument("--end", type=int, required=True)
    ap.add_argument("--dry-run", action="store_true")
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

    with sync_playwright() as p, open(out_path, "w", newline="") as out:
        w = csv.writer(out)
        w.writerow(["record_id", "result", "note", "timestamp", "worker"])
        browser = p.chromium.launch(headless=config.HEADLESS)
        ctx = (browser.new_context(storage_state=config.AUTH_STATE)
               if not args.dry_run else browser.new_context())
        page = ctx.new_page()
        page.set_default_timeout(config.NAV_TIMEOUT_MS)

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

        browser.close()

    print(f"[{args.worker}] done: {counts} -> {out_path}")


if __name__ == "__main__":
    main()
