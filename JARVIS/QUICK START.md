# JARVIS Full Automatic Assistant — Quick Start Guide

**Status:** Ready to test  
**Last Updated:** 2026-06-25

---

## What is JARVIS?

JARVIS is your full automatic personal assistant. You give it natural language requests on your phone, and it:

1. **Understands your intent** using Claude AI
2. **Executes phone actions** (alarms, messages, reminders, calendar, timers, apps)
3. **Logs everything** to your Obsidian vault
4. **Learns patterns** and anticipates your needs

---

## Right Now: Test These 5 Things

### 1. Alarm (Most Important)
- **Say:** "Set alarm for 8am tomorrow to pick up Shae"
- **Expect:** Alarm appears in Alarms app with correct time and label
- **Log:** Entry in JARVIS/Chat.md
- **Status:** ✅ **Should be working**

### 2. SMS
- **Say:** "Send SMS to John: Running 10 minutes late"
- **Expect:** Text message appears in Messages app
- **Log:** Entry in JARVIS/Chat.md
- **Status:** ⚠️ **Test & verify**

### 3. Reminder
- **Say:** "Remind me to call mum tomorrow at 2pm"
- **Expect:** Reminder appears in calendar/reminders app, notification fires at time
- **Status:** ⚠️ **Test & verify**

### 4. Calendar Event
- **Say:** "Schedule meeting with team next Monday 10am to 11am at Office"
- **Expect:** Event appears in calendar app with time and location
- **Status:** ⚠️ **Test & verify**

### 5. Open App
- **Say:** "Open Chrome"
- **Expect:** Chrome app launches
- **Status:** ⚠️ **Test & verify**

---

## How to Use JARVIS

### On Your Fold 7

1. **Press Alt+A** → Opens "Ask JARVIS" prompt
2. **Type your request** — natural language, e.g.:
   - "Set alarm for 7am on weekdays"
   - "Remind me to pay bills next Friday"
   - "Send SMS to John: I'm here"
   - "Create calendar event: Dentist appointment Wednesday 3pm"
   - "Open Obsidian"
3. **Press Enter** → JARVIS processes your request
4. **See result** → Notification shows what JARVIS did
5. **Check vault** → Entry logged in JARVIS/Chat.md

### From Your PC

1. **Edit JARVIS/Chat.md** to see all previous conversations
2. **Check JARVIS/Actions/DATE.md** for daily action summaries
3. **Review JARVIS/Actions Dashboard.md** for analytics
4. **Sync with git** to keep up-to-date

---

## Files You Have Right Now

```
JARVIS/
├── scripts/
│   └── jarvis_ask.js                     # ← Main script (just updated)
├── TASKER SETUP.md                       # ← Create these 7 Tasker tasks
├── QUICK START.md                        # ← You are here
├── PRODUCTION CHECKLIST.md               # ← Before going live
├── Actions Dashboard.md                  # ← See what JARVIS did
├── Automation Workflows.md               # ← Advanced workflows (future)
├── Chat.md                               # ← Auto-created on first use
└── Actions/
    └── 2026-06-25.md                     # ← Auto-created per day
```

---

## Setup: What You Need to Do

### 1. Create Tasker Tasks (Critical)
You need to create 7 tasks in Tasker. Each handles one phone action:
- **Jarvis Alarm** — Set alarms
- **Jarvis SMS** — Send messages
- **Jarvis Reminder** — Create reminders
- **Jarvis Calendar** — Create calendar events
- **Jarvis OpenApp** — Open apps
- **Jarvis Timer** — Set timers
- **Jarvis Notify** — Send notifications

**Where:** See `JARVIS/TASKER SETUP.md` for detailed instructions for each task.

**Time:** ~15 minutes to create all 7

### 2. Test Each Task (Critical)
Once created, test in Tasker:
```
Each task → Press play icon → Verify it works
```

### 3. Test HTTP Connectivity
Open browser on phone, visit:
```
http://localhost:1337/?task=Jarvis%20Alarm&par1=08&par2=30&par3=Test&par4=10
```
If you see a response, HTTP is working. Check Tasker logs to see if alarm was created.

### 4. Verify Obsidian Integration
- Alt+A to open Ask JARVIS
- Type: "Set alarm for 8am tomorrow"
- Check if: (a) Alarm created in Alarms app, (b) Entry appears in JARVIS/Chat.md

---

## Testing Checklist

| Test | Command | Expected Result | Status |
|------|---------|-----------------|--------|
| Alarm | "Set alarm for 8am" | Alarm in Alarms app | [ ] |
| SMS | "Send SMS to [name]: Hi" | Text in Messages app | [ ] |
| Reminder | "Remind me tomorrow at 2pm" | Reminder appears | [ ] |
| Calendar | "Schedule event tomorrow 10am" | Event in calendar | [ ] |
| Timer | "Set 5 minute timer" | Timer counts down | [ ] |
| App | "Open Chrome" | Chrome launches | [ ] |
| Vault Log | Check after any action | Entry in JARVIS/Chat.md | [ ] |

Once all 7 are ✓, you're ready for daily use.

---

## Troubleshooting

### "JARVIS: no API key"
- Run JARVIS Setup macro first
- Enter your Anthropic API key when prompted

### "HTTP request failed" / No actions execute
- Make sure Tasker is running
- Go to Tasker Prefs → Misc → Enable "Allow external access"
- Check Tasker logs for errors

### Alarm shows "00:00" or "%label" literally
- Make sure you have the latest `jarvis_ask.js` from git
- Pull latest from branch `claude/admiring-cori-j8ctlm`
- Restart Obsidian to reload the script

### SMS not sending / Can't find contact
- Grant Tasker SMS and CONTACTS permissions
- Test with direct phone number instead of contact name
- Check Tasker logs for errors

### Calendar event not appearing
- Verify calendar has write permissions in Android settings
- Try creating a calendar event manually first
- Check if event is being created on correct calendar

---

## Typical Usage Patterns

### Morning
```
"Good morning, JARVIS"
→ JARVIS: Morning briefing (weather, calendar, top 3 tasks)
→ Auto-sets reminders for your day
```

### During Day
```
"Set alarm for 3pm reminder to call John"
→ Alarm created, logged
→ Notification at 3pm
```

### Evening
```
"What did I do today?"
→ JARVIS: Summary of all actions taken
→ Suggestions for tomorrow
```

---

## Important: Security

- **API Key:** Never share your Anthropic API key
- **Personal Data:** Reminders and messages stay on your phone
- **Logs:** JARVIS/Chat.md is local to your vault (not synced to public repo)
- **Permissions:** JARVIS only uses permissions it needs

---

## Next Steps (After Testing)

1. **Verify all 7 actions work** ← DO THIS FIRST
2. **Set up automation workflows** (see Automation Workflows.md)
3. **Configure daily routines** (morning briefing, evening wrap-up)
4. **Link to projects** (auto-log actions to project files)
5. **Enable habit tracking** (monitor pattern and streaks)

---

## Getting Help

- **Obsidian Issues?** Check plugin docs, restart app
- **Tasker Issues?** Check Tasker logs, verify permissions  
- **API Issues?** Check API key validity, rate limits
- **Vault Issues?** Check git sync, file paths

---

## Command Examples

Try these natural language requests:

```
Alarms:
- "Set alarm for 7am every weekday"
- "Wake me up in 10 minutes"
- "Alarm for tomorrow at 8am - picking up Shae"

Messages:
- "Send SMS to John: Running late"
- "Text mum: I'm home"

Reminders:
- "Remind me to call the dentist tomorrow"
- "Reminder: Pay bills next Friday 9am"
- "Remind me to drink water every 2 hours"

Calendar:
- "Schedule dentist appointment Wednesday 3pm"
- "Create meeting: Team sync Tuesday 10am in office"
- "Add vacation day: June 30 - July 3"

Timers:
- "Set 5 minute timer for cooking"
- "Start 25 minute Pomodoro"

Apps:
- "Open WhatsApp"
- "Launch Gmail"
- "Show me Chrome"

Context:
- "What's my schedule today?"
- "Any reminders in the next 2 hours?"
- "What did I do yesterday?"
```

---

**Ready to get started?**

1. ✅ Create the 7 Tasker tasks (TASKER SETUP.md)
2. ✅ Test each one (press play in Tasker)
3. ✅ Test from Obsidian: Alt+A → Ask JARVIS → "Set alarm for 8am"
4. ✅ Verify alarm appears and Chat.md logs entry
5. ✅ Come back and mark tests as complete above

**Then: JARVIS is live and ready to assist.**
