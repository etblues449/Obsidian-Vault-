# JARVIS — Quick Tasker Build (6 Tasks)

**You have 1 task done (Jarvis Alarm). Build these 6 in ~10 minutes.**

Each task: Search for action → Set parameters → Save. Repeat 6 times.

---

## Task 2: Jarvis SMS

**Action:** Search "Send SMS"

**Fields:**
- Number: `%par1` (contact)
- Message: `%par2` (text)

**That's it. Save.**

---

## Task 3: Jarvis Reminder

**Action:** Search "Create Reminder"

**Fields:**
- Title: `%par1`
- Date: `%par2`
- Time: `%par3:%par4` (hours:minutes)

**Save.**

---

## Task 4: Jarvis Calendar

**Action:** Search "Create Calendar Event"

**Fields:**
- Title: `%par1`
- Date: `%par2`
- Start Time: `%par3:%par4`
- End Time: `%par5:%par6`
- Location: `%par7` (optional)

**Save.**

---

## Task 5: Jarvis Timer

**Action:** Search "Create Timer"

**Fields:**
- Duration: `%par1` (minutes)
- Label: `%par2` (optional)

**Save.**

---

## Task 6: Jarvis OpenApp

**Action:** Search "Launch App"

**Fields:**
- App Name: `%par1`

**Save.**

---

## Task 7: Jarvis Notify

**Action:** Search "Notification"

**Fields:**
- Title: `%par1`
- Message: `%par2`
- Priority: `%par3` (low/normal/high)

**Save.**

---

## That's All

Once you create these 6 tasks, JARVIS has full phone control:
- ✅ Alarms
- ✅ SMS
- ✅ Reminders
- ✅ Calendar
- ✅ Timers
- ✅ Apps
- ✅ Notifications
- ✅ Voice input

**Then:** Use Alt+A → Voice/Text → Natural language → Done.

All actions auto-log to vault.

---

**Manual Workaround (if HTTP doesn't work):**

Until HTTP server is fixed, manually trigger Tasker tasks from within Tasker and they'll still log to vault via the Ask macro.

The system is already integrated — just waiting on Tasker HTTP.
