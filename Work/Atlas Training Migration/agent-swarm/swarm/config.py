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

# ---- Add Training form selectors (CAPTURED 2026-06-10) ----------------------
# Form: Employees → Manage → ⋮ → ADD TRAINING ("Add training history details").
# Flow: set "Add training to" = Employee → pick the person → course → dates → Add.
SEL_DISTRIBUTE_TO = "#ddlDistributeTo"     # "Add training to" dropdown
DISTRIBUTE_VALUE = "Employee"               # select this option to target one person
SEL_EMPLOYEE_PICKER = "TODO"                # control that appears after "Employee" — CONFIRM
SEL_EMPLOYEE_OPTION = "TODO"                # the matching person option — CONFIRM
SEL_COURSE_INPUT = "#SelectedCourse"       # autocomplete: type then pick
SEL_COURSE_OPTION = "TODO"                  # course autocomplete option — CONFIRM
SEL_START_DATE = "#add-training-bulk-mode_AeDatetimePicker_1_ae-input_3"
SEL_COMPLETED_DATE = "#add-training-bulk-mode_AeDatetimePicker_2_ae-input_3"
SEL_EXPIRY_DATE = "#add-training-bulk-mode_AeDatetimePicker_3_ae-input_3"  # CONFIRM _3_
SEL_SAVE = "#add-training-bulk-mode_AeButton_1_aeButton_1"
SEL_SAVE_SUCCESS = "TODO"                   # success toast/element — CONFIRM on pilot
# Optional fields on the form (not used for migration unless you want them):
SEL_COURSE_CODE = "#CourseCode"
SEL_CPD_MINUTES = "#CPDMinutes"
SEL_COURSE_GRADE = "#CourseGrade"
SEL_PROVIDER = "#Provider"
SEL_DESCRIPTION = "#Description"
# Where existing results for a worker+course are listed (dedupe check).
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
