# JARVIS Full Automatic Assistant

**Status:** ✅ **COMPLETE & READY TO TEST**  
**Version:** 1.0 (Full System)  
**Built:** 2026-06-25

Your vault is your brain. You talk to JARVIS in natural language. It understands your intent, executes phone actions (alarms, SMS, reminders, calendar, timers, apps), and logs everything back to your vault.

---

## Quick Start (15 minutes)

**→ [QUICK START.md](QUICK START.md)** — Read this first

Then:
1. Create 7 Tasker tasks (see [TASKER SETUP.md](TASKER SETUP.md))
2. Test one action: Alt+A → "Set alarm for 8am" → verify it works
3. Done. JARVIS is live.

---

## What JARVIS Can Do

| Action | Command | Status |
|--------|---------|--------|
| **Alarms** | "Set alarm for 8am tomorrow" | ✅ Ready |
| **SMS** | "Send message to John: Hi" | ✅ Ready |
| **Reminders** | "Remind me at 2pm tomorrow" | ✅ Ready |
| **Calendar** | "Schedule meeting next Monday 10am" | ✅ Ready |
| **Timers** | "Set 5 minute timer" | ✅ Ready |
| **Apps** | "Open Chrome" | ✅ Ready |
| **Notifications** | "Send notification: Hey!" | ✅ Ready |
| **Auto-Logging** | Everything logged to vault | ✅ Ready |

**Coming:** Daily briefing, smart reminders, weekly reviews, project integration, habit tracking.

---

## The System (How It Works)

```
You → Obsidian (Alt+A) → Claude AI → Tasker → Phone Action
  ↓                          ↓
Input prompt         Understands intent,
                     picks right tool,
                     extracts parameters
                                ↓
                        (creates alarm/SMS/etc)
                                ↓
                            Vault logs entry
```

**Full details:** [SYSTEM ARCHITECTURE.md](SYSTEM ARCHITECTURE.md)

---

## Files You Have

```
JARVIS/
├── README.md                            ← You are here
├── QUICK START.md                       ← START HERE
├── SYSTEM ARCHITECTURE.md               ← How it all works
├── TASKER SETUP.md                      ← Create executor tasks
├── PRODUCTION CHECKLIST.md              ← Pre-launch tests
├── Automation Workflows.md              ← Future automations
├── Actions Dashboard.md                 ← Analytics dashboards
├── scripts/
│   ├── jarvis_ask.js                    ← Main script (enhanced)
│   ├── jarvis.js                        ← Original capture system
│   ├── jarvis_digest.js                 ← Daily briefing
│   └── jarvis_setup.js                  ← API key setup
└── [Auto-created on use]
    ├── Chat.md                          ← Conversation log
    └── Actions/
        └── 2026-06-25.md                ← Daily action log
```

---

## Next Steps

### This Week
1. **Read** [QUICK START.md](QUICK START.md)
2. **Create** 7 Tasker tasks ([TASKER SETUP.md](TASKER SETUP.md))
3. **Test** each action (alarm, SMS, reminder, calendar, timer, app, notify)
4. **Verify** all tests pass ([PRODUCTION CHECKLIST.md](PRODUCTION CHECKLIST.md))

### Next Week
- Enable daily briefing automation
- Set up project integration
- Configure habit tracking

### Later
- Voice input integration
- Pattern learning and smart suggestions
- Financial tracking integration

---

## How to Use (Daily)

**On your phone:**
1. Press **Alt+A** → "Ask JARVIS..." prompt appears
2. Type your request: `"Set alarm for 8am to pick up Shae"`
3. Press **Enter** → JARVIS processes it
4. See result in notification + vault log

**Examples:**
```
"Set alarm for 7am every weekday"
"Send SMS to John: Running late"
"Remind me to call mum tomorrow 2pm"
"Schedule team meeting Tuesday 10am-11am at office"
"Set 5 minute timer for cooking"
"Open Gmail"
"Send high priority notification"
```

---

## Key Files & Roles

| File | Purpose |
|------|---------|
| `jarvis_ask.js` | **Main entry point** — handles all requests via Alt+A |
| `jarvis.js` | Original capture system (still works) |
| `jarvis_setup.js` | One-time setup to store API key securely |
| `jarvis_digest.js` | Daily briefing (morning routine automation) |
| Dashboard files | Analytics and action tracking |

---

## System Requirements

✅ Obsidian with QuickAdd plugin  
✅ Tasker (with HTTP server enabled)  
✅ Fold 7 (or any Android phone)  
✅ Anthropic API key (free from [claude.ai/code](https://claude.ai/code))  
✅ Internet (for Claude API calls only)

---

## Security & Privacy

- ✅ Your vault stays on your phone (local only)
- ✅ Phone actions stay on your phone (no cloud)
- ✅ API key stored device-local, never synced
- ✅ Only API requests to Claude leave your phone (encrypted)
- ✅ Full audit trail of everything in vault

---

## Architecture

Three simple parts working together:

1. **Obsidian** — Your interface and vault (brain)
2. **Claude API** — Understanding your intent (intelligence)
3. **Tasker** — Executing phone actions (hands)

All three talk via simple HTTP requests. Loose coupling means you can upgrade any piece independently.

**Full technical details:** [SYSTEM ARCHITECTURE.md](SYSTEM ARCHITECTURE.md)

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "JARVIS: no API key" | Run JARVIS Setup macro, paste your API key |
| Alarm shows 00:00 | Pull latest from git, restart Obsidian |
| HTTP requests timeout | Enable "Allow external access" in Tasker |
| SMS not sending | Grant SMS + CONTACTS permissions in Android |
| Can't find contact | Use phone number instead of name |

**More help:** [QUICK START.md](QUICK START.md) Troubleshooting section

---

## Version History

- **v1.0** (2026-06-25) — Full Automatic Assistant complete
  - All 8 phone actions implemented
  - Complete Tasker integration
  - Vault auto-logging
  - Ready for production testing

- **v0.9** (2026-06-24) — Parameter passing fixed
  - Tasker alarm/SMS handlers working
  - URL encoding corrected

- **v0.5** (2026-06-19) — JARVIS v3 launched
  - Original Obsidian-native capture system
  - Home Assistant integration

---

## Let's Get Started

**→ Go read [QUICK START.md](QUICK START.md) right now.**

Then create Tasker tasks, test end-to-end, and start using JARVIS in your daily routine.

**JARVIS is ready. Let's make it happen.**

---

*Built by Claude for Elliot Horton*  
*JARVIS Unlimited — Your personal assistant, on your phone, in your vault*
