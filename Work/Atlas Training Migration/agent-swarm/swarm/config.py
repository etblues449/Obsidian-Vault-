"""
Atlas swarm configuration.

Fill the SELECTOR values from ONE authenticated walkthrough of the
"Add result" form (see ../PORTAL_WALKTHROUGH_TEMPLATE.md). Everything marked
TODO is unknown until then; the harness runs end-to-end once they're set.

No secrets live here. The login session is captured separately into
auth_state.json (gitignored) by login_bootstrap.py.
"""

# ---- Portal -----------------------------------------------------------------
ORG_ID = "9892b03b-455e-4b80-8490-a76073576d96"
BASE = "https://hrhs.atlas-hub.co.uk"
# Deep link to the page where a training result is added. CONFIRM the exact path
# during the walkthrough (employee/manage may not be the add-result form itself).
ADD_RESULT_URL = f"{BASE}/o/{ORG_ID}/employee/manage"  # TODO confirm

AUTH_STATE = "auth_state.json"  # produced by login_bootstrap.py (gitignored)

# ---- Login selectors (CONFIRMED 2026-06-10 for step 1) ----------------------
SEL_LOGIN_USER = "#signInName"
SEL_LOGIN_USER_SUBMIT = "#next"
SEL_LOGIN_PASS = "#password"          # TODO confirm on real login
SEL_LOGIN_PASS_SUBMIT = "#next"       # TODO confirm
# A selector that only exists once authenticated (used to detect "logged in").
SEL_LOGGED_IN = "TODO_authenticated_only_element"

# ---- Add-result form selectors (TODO from walkthrough) ----------------------
SEL_STAFF_INPUT = "TODO"      # staff name search/select
SEL_STAFF_OPTION = "TODO"     # template for the matching dropdown option
SEL_COURSE_INPUT = "TODO"     # course select/search
SEL_COURSE_OPTION = "TODO"
SEL_COMPLETED_DATE = "TODO"
SEL_EXPIRY_DATE = "TODO"
SEL_STATUS = "TODO"           # may not exist if status is auto-derived
SEL_SAVE = "TODO"
SEL_SAVE_SUCCESS = "TODO"     # element/text confirming the save
# Where existing results for a staff+course are listed (dedupe check).
SEL_EXISTING_RESULTS = "TODO"

# ---- Behaviour --------------------------------------------------------------
DATE_FORMAT = "%d/%m/%Y"      # format the Atlas field accepts; CONFIRM
THROTTLE_SECONDS = (8, 15)    # random delay between records (min, max)
MAX_CONSECUTIVE_ERRORS = 3    # stop the worker and alert
HEADLESS = True               # workers headless; bootstrap runs headed
NAV_TIMEOUT_MS = 30000

# Status values Atlas expects, mapped from our queue (only if SEL_STATUS used).
STATUS_MAP = {
    "OVERDUE": "Overdue",
    "EXPIRING (0-30d)": "Expiring",
    "EXPIRING (31-60d)": "Expiring",
    "CURRENT": "Current",
    "NO EXPIRY": "",
}
