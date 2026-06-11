#!/usr/bin/env python3
"""
Atlas training migration — single-file Playwright runner.

Put this next to work_queue.csv. Requires:
    pip install playwright
    playwright install chromium

Usage (Windows PowerShell / any terminal):
    python atlas_swarm.py login                         # log in once (MFA) -> saves session
    python atlas_swarm.py pilot                         # 1 record, visible browser, to watch
    python atlas_swarm.py run --start 1 --end 296       # the 296 OVERDUE
    python atlas_swarm.py run --start 297 --end 1358    # the rest
    python atlas_swarm.py merge                          # reconcile -> totals

Parallel "swarm": open several terminals and give each a non-overlapping range,
e.g. 1-60, 61-120, ... Keep it to ~5 to stay human-like.

No credentials are stored here. `login` saves an authenticated browser session
to auth_state.json (keep it private; don't share/commit it).
"""
import argparse
import csv
import glob
import os
import random
import re
import sys
import time
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
QUEUE = os.path.join(HERE, "work_queue.csv")
AUTH = os.path.join(HERE, "auth_state.json")
RESULTS_DIR = os.path.join(HERE, "results")
SHOTS_DIR = os.path.join(HERE, "screenshots")

# ---- Atlas form (captured 2026-06-10) --------------------------------------
ORG = "9892b03b-455e-4b80-8490-a76073576d96"
ADD_URL = f"https://hrhs.atlas-hub.co.uk/o/{ORG}/employee/manage"
SEL_DISTRIBUTE_TO = "#ddlDistributeTo"
DISTRIBUTE_VALUE = "Employee"
SEL_COURSE_INPUT = "#SelectedCourse"
SEL_START = "#add-training-bulk-mode_AeDatetimePicker_1_ae-input_3"
SEL_COMPLETED = "#add-training-bulk-mode_AeDatetimePicker_2_ae-input_3"
SEL_EXPIRY = "#add-training-bulk-mode_AeDatetimePicker_3_ae-input_3"
SEL_SAVE = "#add-training-bulk-mode_AeButton_1_aeButton_1"

THROTTLE = (8, 15)          # seconds between records
MAX_CONSEC_ERR = 3
NAV_TIMEOUT = 30000


def load_shard(start, end):
    with open(QUEUE, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    return rows[start - 1:end]


# ---- login -----------------------------------------------------------------
def cmd_login(_):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(headless=False)
        ctx = b.new_context()
        pg = ctx.new_page()
        pg.goto(ADD_URL)
        print("\n>>> Log in fully (username, password, MFA) until you see the")
        print(">>> Manage employees page. Then press ENTER here.\n")
        input()
        if "auth.atlas-hub.co.uk" in pg.url:
            print("Still on the login page — not saved. Finish login and re-run.")
            b.close(); sys.exit(1)
        ctx.storage_state(path=AUTH)
        print(f"Saved session -> {AUTH}")
        b.close()


# ---- entry -----------------------------------------------------------------
def open_dialog(pg):
    pg.goto(ADD_URL, timeout=NAV_TIMEOUT)
    if "auth.atlas-hub.co.uk" in pg.url:
        raise RuntimeError("session expired - run: python atlas_swarm.py login")
    pg.wait_for_load_state("domcontentloaded")
    item = pg.locator("#addTraining_txtSpan_1")
    # The "Add Training" item is hidden until the ⋮ menu next to "Add Employee /
    # Worker" is opened. Find and click that icon button in-page (no need to know
    # its exact selector), then click the now-visible item.
    if not item.is_visible():
        pg.wait_for_timeout(600)
        pg.evaluate(
            """() => {
                const add = [...document.querySelectorAll('button,a')]
                    .find(b => /add employee/i.test(b.innerText||''));
                if (!add) return;
                const scopes = [add.parentElement,
                                add.parentElement && add.parentElement.parentElement]
                    .filter(Boolean);
                const seen = new Set();
                for (const s of scopes) {
                    for (const c of s.querySelectorAll('button,[role=button]')) {
                        if (c === add || seen.has(c)) continue;
                        seen.add(c);
                        if ((c.innerText||'').trim().length <= 2) c.click();
                    }
                }
            }"""
        )
        try:
            item.wait_for(state="visible", timeout=4000)
        except Exception:
            raise RuntimeError(
                "could not open the ⋮ menu automatically - send the console-snippet "
                "table so the kebab selector can be hard-set")
    item.click(timeout=8000)
    pg.wait_for_selector(SEL_DISTRIBUTE_TO, timeout=10000)


def pick_autocomplete(pg, locator, text, what):
    locator.click()
    locator.fill("")
    locator.type(text, delay=40)
    pg.wait_for_timeout(900)
    if pg.get_by_text("No Result Found", exact=False).count() > 0:
        raise LookupError(f"{what} not found in Atlas: {text}")
    for cand in (pg.get_by_role("option", name=text), pg.get_by_text(text, exact=True)):
        try:
            cand.first.click(timeout=2500)
            return
        except Exception:
            continue
    locator.press("ArrowDown")
    locator.press("Enter")


def set_date(pg, sel, value):
    el = pg.locator(sel)
    el.click(); el.fill(""); el.type(value, delay=30); el.press("Escape")


def enter_record(pg, rec):
    if rec.get("flag") == "HOLD-HR-NAME":
        return "HOLD", "uncertain surname - awaiting HR"
    name, course = rec["full_name"], rec["training_course"]
    try:
        open_dialog(pg)
    except RuntimeError as e:
        return "ERROR", str(e)
    pg.select_option(SEL_DISTRIBUTE_TO, label=DISTRIBUTE_VALUE)
    try:
        pick_autocomplete(pg, pg.get_by_label("Employee", exact=True), name, "staff member")
        pick_autocomplete(pg, pg.locator(SEL_COURSE_INPUT), course, "course")
    except LookupError as e:
        return "ERROR", str(e)
    set_date(pg, SEL_START, rec["completed_date"])
    set_date(pg, SEL_COMPLETED, rec["completed_date"])
    if rec.get("has_expiry") == "YES" and rec.get("expiry_date"):
        set_date(pg, SEL_EXPIRY, rec["expiry_date"])
    pg.click(SEL_SAVE)
    from playwright.sync_api import TimeoutError as PWT
    try:
        pg.wait_for_selector("text=Add training history details", state="detached", timeout=10000)
    except PWT:
        return "ERROR", "save not confirmed (dialog stayed open - check validation)"
    shot = os.path.join(SHOTS_DIR, f"{rec['record_id']}.png")
    pg.screenshot(path=shot)
    return "DONE", os.path.relpath(shot, HERE)


def run_range(start, end, label, headed, pilot=False):
    from playwright.sync_api import sync_playwright
    os.makedirs(RESULTS_DIR, exist_ok=True)
    os.makedirs(SHOTS_DIR, exist_ok=True)
    if not os.path.exists(AUTH):
        sys.exit("No auth_state.json. Run: python atlas_swarm.py login")
    shard = load_shard(start, end)
    out_path = os.path.join(RESULTS_DIR, f"{label}.csv")
    consec, counts = 0, {}
    with sync_playwright() as p, open(out_path, "w", newline="", encoding="utf-8") as out:
        w = csv.writer(out); w.writerow(["record_id", "result", "note", "timestamp", "worker"])
        b = p.chromium.launch(headless=not (headed or pilot))
        ctx = b.new_context(storage_state=AUTH)
        pg = ctx.new_page(); pg.set_default_timeout(NAV_TIMEOUT)
        for rec in shard:
            try:
                status, note = enter_record(pg, rec)
            except Exception as e:  # noqa: BLE001
                status, note = "ERROR", f"{type(e).__name__}: {e}"
            counts[status] = counts.get(status, 0) + 1
            w.writerow([rec["record_id"], status, note, datetime.now().isoformat(timespec="seconds"), label]); out.flush()
            print(f"[{label}] {rec['record_id']} {rec['full_name']:<26} {rec['training_course']:<28} -> {status} ({note})")
            consec = consec + 1 if status == "ERROR" else 0
            if consec >= MAX_CONSEC_ERR:
                print(f"[{label}] {consec} errors in a row - stopping. Check session / form / CAPTCHA.")
                break
            if status not in ("HOLD",):
                time.sleep(random.uniform(*THROTTLE))
        b.close()
    print(f"[{label}] done: {counts} -> {out_path}")


def cmd_pilot(a):
    run_range(1, 3, "pilot", headed=True, pilot=True)


def cmd_run(a):
    run_range(a.start, a.end, a.worker, headed=a.headed)


def cmd_merge(_):
    latest = {}
    for fp in glob.glob(os.path.join(RESULTS_DIR, "*.csv")):
        with open(fp, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                rid, ts = r["record_id"], r["timestamp"]
                if rid not in latest or ts >= latest[rid][1]:
                    latest[rid] = (r["result"], ts)
    with open(QUEUE, newline="", encoding="utf-8") as f:
        total = sum(1 for _ in csv.DictReader(f))
    counts = {}
    for res, _ in latest.values():
        counts[res] = counts.get(res, 0) + 1
    attempted = sum(counts.values())
    print(f"Total in queue: {total}")
    for k in sorted(counts):
        print(f"  {k:<10} {counts[k]}")
    print(f"  {'(untouched)':<10} {total - attempted}")
    done = counts.get("DONE", 0) + counts.get("SKIPPED", 0)
    print(f"\nDONE+SKIPPED={done}  HOLD={counts.get('HOLD',0)}  "
          f"ERROR={counts.get('ERROR',0)}  untouched={total-attempted}  / {total}")


def main():
    ap = argparse.ArgumentParser(description="Atlas training migration runner")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("login").set_defaults(func=cmd_login)
    sub.add_parser("pilot").set_defaults(func=cmd_pilot)
    sub.add_parser("merge").set_defaults(func=cmd_merge)
    r = sub.add_parser("run")
    r.add_argument("--start", type=int, required=True)
    r.add_argument("--end", type=int, required=True)
    r.add_argument("--worker", default="A")
    r.add_argument("--headed", action="store_true")
    r.set_defaults(func=cmd_run)
    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
