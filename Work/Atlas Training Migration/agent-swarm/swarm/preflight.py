"""
Readiness check. Tells you exactly what's still needed before a live swarm run.

    python preflight.py
"""
import csv
import os
import config

HERE = os.path.dirname(__file__)
QUEUE = os.path.join(HERE, "..", "work_queue.csv")

MUST_SELECTORS = {
    "ADD_RESULT_URL": config.ADD_RESULT_URL,
    "SEL_STAFF_INPUT": config.SEL_STAFF_INPUT,
    "SEL_STAFF_OPTION": config.SEL_STAFF_OPTION,
    "SEL_COURSE_INPUT": config.SEL_COURSE_INPUT,
    "SEL_COURSE_OPTION": config.SEL_COURSE_OPTION,
    "SEL_COMPLETED_DATE": config.SEL_COMPLETED_DATE,
    "SEL_SAVE": config.SEL_SAVE,
    "SEL_SAVE_SUCCESS": config.SEL_SAVE_SUCCESS,
}


def main():
    ok = True

    # Queue
    if os.path.exists(QUEUE):
        n = sum(1 for _ in csv.DictReader(open(QUEUE)))
        print(f"  [OK]   work_queue.csv found ({n} records)")
    else:
        ok = False
        print("  [MISS] work_queue.csv not found")

    # Login session
    auth = os.path.join(HERE, config.AUTH_STATE)
    if os.path.exists(auth):
        print(f"  [OK]   {config.AUTH_STATE} present (login session captured)")
    else:
        ok = False
        print(f"  [MISS] {config.AUTH_STATE} — run: python login_bootstrap.py")

    # Selectors
    unset = [k for k, v in MUST_SELECTORS.items() if not v or "TODO" in str(v)]
    if unset:
        ok = False
        print(f"  [MISS] selectors not set in config.py: {', '.join(unset)}")
        print("         -> do one authenticated walkthrough "
              "(../PORTAL_WALKTHROUGH_TEMPLATE.md)")
    else:
        print("  [OK]   all required selectors set")

    print()
    if ok:
        print("READY ✅  — pilot:  python run_worker.py --worker pilot "
              "--start 1 --end 10")
    else:
        print("NOT READY ❌ — resolve the [MISS] items above. "
              "Dry-run works now: python run_worker.py --worker pilot "
              "--start 1 --end 10 --dry-run")


if __name__ == "__main__":
    main()
