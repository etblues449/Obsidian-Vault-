---
type: index
source: jarvis
---

# 📚 JARVIS v3 — Complete Index

Your Obsidian-native life automation system. Everything you need to organize, automate, and optimize your life.

---

## 🎯 Start Here

👉 **New to JARVIS?** Read: [`Getting Started.md`](Getting%20Started.md)  
This is your complete onboarding guide. Follow Day 1 setup, then daily/weekly flow.

👉 **Already set up?** Check: [`Master Dashboard.md`](Master%20Dashboard.md)  
Your daily hub for priorities, open tasks, habits, and quick actions.

---

## 📂 Core System (Capture → Organize → Review)

| File | Purpose | When to use |
|------|---------|------------|
| [`Getting Started.md`](Getting%20Started.md) | Complete onboarding guide | First time setup |
| [`SETUP.md`](SETUP.md) | Installation + configuration | Initial setup, troubleshooting |
| [`Master Dashboard.md`](Master%20Dashboard.md) | Daily command center | Every morning + check throughout day |
| [`Daily Plan Template.md`](Daily%20Plan%20Template.md) | Today's priorities + energy blocks | Copy daily, fill in your focus |
| [`Weekly Review Template.md`](Weekly%20Review%20Template.md) | Week recap + next week planning | Every Sunday evening |
| [`Capture Templates.md`](Capture%20Templates.md) | Structured formats for 7 life areas | When capturing anything important |

---

## 🧠 Life Automation (Tracking & Insights)

| File | Purpose | When to use |
|------|---------|------------|
| [`Habits.md`](Habits.md) | Daily/weekly/monthly habit tracking | Daily logging + weekly review |
| [`Finance Tracker.md`](Finance%20Tracker.md) | Expense categorization + monthly summary | Log expenses, review monthly |
| [`Goals & Outcomes.md`](Goals%20&%20Outcomes.md) | Project milestones + personal goals | Monthly goal checkpoint + quarterly review |
| [`Decision Journal.md`](Decision%20Journal.md) | Record decisions + outcomes for learning | After making major decisions |
| [`Recurring Tasks.md`](Recurring%20Tasks.md) | Project-based task templates | Weekly review planning |
| [`Projects Dashboard.md`](Projects%20Dashboard.md) | All 4 major projects + ideas backlog | Project planning + weekly review |

---

## 🚀 Advanced Features (Automation & Integration)

| File | Purpose | When to use |
|------|---------|------------|
| [`Advanced Setup.md`](Advanced%20Setup.md) | Email-to-JARVIS, HA automations, Templater triggers | After basic setup works |
| [`scripts/jarvis.js`](scripts/jarvis.js) | Main capture → classify → route brain | Runs on every capture |
| [`scripts/jarvis_setup.js`](scripts/jarvis_setup.js) | Store API keys + HA credentials | One-time setup |
| [`scripts/jarvis_ask.js`](scripts/jarvis_ask.js) | Ground Q&A on recent captures | Ask command |
| [`scripts/jarvis_digest.js`](scripts/jarvis_digest.js) | Summarize last 24h captures | Digest command |
| [`scripts/jarvis_expense_classifier.js`](scripts/jarvis_expense_classifier.js) | Auto-categorize expenses | Expense command |
| [`scripts/jarvis_weekly_trigger.js`](scripts/jarvis_weekly_trigger.js) | Auto-create weekly reviews | Sunday trigger (optional) |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   YOUR LIFE DATA                    │
│  (Captures, Expenses, Habits, Decisions, Goals)     │
└────────────────┬────────────────────────────────────┘
                 │
        ┌────────▼────────┐
        │  JARVIS INBOX   │
        │ (JARVIS/Inbox/) │
        └────────┬────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
┌───▼──┐  ┌──────▼────┐  ┌───▼──────┐
│Claude│  │Dataview   │  │Home      │
│ API  │  │Queries    │  │Assistant │
└───┬──┘  └──────┬────┘  └───┬──────┘
    │           │            │
┌───▼────────────▼────────────▼──┐
│      ORGANIZED FOLDERS          │
│ - Journal/                      │
│ - JARVIS/Inbox (captures)       │
│ - JARVIS/Habits (tracking)      │
│ - JARVIS/Chat (Q&A history)     │
│ - JARVIS/Weekly Reviews/        │
└────────────────────────────────┘
         │
    ┌────▼─────┐
    │ Obsidian │
    │   Sync   │
    │ (mobile) │
    └──────────┘
```

---

## 🔄 Daily Workflow

```
Morning (5 min)
├─ Open Master Dashboard
├─ Review top 3 priorities
├─ Check habit checklist
└─ Open Daily Plan Template

Throughout Day
├─ Capture wins/notes as they happen
├─ Log expenses
├─ Ask questions to JARVIS
└─ Control smart home lights/climate

Evening (10 min)
├─ Digest today's captures
└─ Reflect: what went well, blockers, tomorrow's focus

Weekly (Sunday, 30 min)
├─ Run Weekly Review
├─ Check Finance Tracker
├─ Update Goals & Outcomes
├─ Plan next week's priorities
└─ Review decision outcomes
```

---

## 🎯 What Each Script Does

### `jarvis.js` (Main Brain)
**Input:** Natural language capture ("Turn on lights", "Spent £45 on groceries")  
**Process:** Send to Claude for classification with JSON schema  
**Output:** Routes to correct folder with metadata (type, category, priority)  
**Handles:** Captures, light control, Home Assistant actions

### `jarvis_setup.js` (One-Time Setup)
**Input:** User provides API key, HA URL, HA token  
**Process:** Stores in browser localStorage (never synced)  
**Output:** Confirmation notices  
**Handles:** Secret credential storage

### `jarvis_ask.js` (Q&A with Context)
**Input:** User question  
**Process:** Gets last 20 captures, sends to Claude with question  
**Output:** Grounded answer appended to JARVIS/Chat.md  
**Handles:** Context-aware questions about your life

### `jarvis_digest.js` (24h Summary)
**Input:** All captures from last 24 hours  
**Process:** Send to Claude for summarization + insights  
**Output:** Creates Journal/[date].md with summary + 3 next actions  
**Handles:** Daily digest generation

### `jarvis_expense_classifier.js` (Auto-Categorize)
**Input:** Expense description ("Spent £45 on groceries")  
**Process:** Claude extracts amount, category, description  
**Output:** Creates JARVIS/Inbox/[date]-expense-[category].md  
**Handles:** Automatic expense categorization

### `jarvis_weekly_trigger.js` (Auto-Reviews)
**Input:** Runs on Sunday (or manual trigger)  
**Process:** Creates JARVIS/Weekly Reviews/[year-week].md from template  
**Output:** Opens weekly review for you to fill in  
**Handles:** Automated weekly review creation

---

## 📊 Dataview Queries (Auto-Dashboards)

All dashboards auto-update using Dataview queries:

| Dashboard | Queries | Updates |
|-----------|---------|---------|
| **Master Dashboard** | Open tasks, weekly captures, habits, HA status | Real-time (captures change) |
| **Projects Dashboard** | Active projects table, ideas, questions | Real-time (new captures) |
| **Daily Plan** | Tasks for today (from Inbox) | Real-time |
| **Weekly Review** | Tasks completed, captures by project, habits | Real-time |
| **Finance Tracker** | Expenses by category, monthly totals, top spending | Real-time |
| **Goals & Outcomes** | Project progress, milestones, personal goals | Manual update |
| **Habits** | Current streaks, habits due today | Manual update (daily logging) |

---

## 🏠 Home Assistant Integration

**Controlled Entities:**
- Lights: `light.living_room_light`, `light.left_smart_bulb`, `light.right_smart_bulb`, `light.stairs_smart_bulb`
- Climate: Set target temperature

**How it works:**
1. You capture: "Turn on living room light"
2. Claude classifies as type: "smart-home", action: "light.turn_on"
3. `jarvis.js` calls HA REST API with bearer token
4. HA executes the action in real time

**To add more entities:**
- Edit `JARVIS/scripts/jarvis.js` line 39-50
- Add your entity ID to CONFIG.haEntities
- Test in HA Settings → Devices → Find entity ID

---

## 💡 Key Concepts

### Capture Types

- **journal** — General notes, reflections, wins
- **health** — Exercise, sleep, mood, wellness
- **task** — Todo items, actionable next steps
- **finance** — Expenses, income, spending
- **decision** — Major choices + reasoning
- **idea** — Concepts, brainstorms, future projects
- **question** — Queries to ask later
- **smart-home** — HA light/climate control

### Folder Structure

```
JARVIS/
├─ Inbox/                    (All captures land here first)
├─ Weekly Reviews/           (YYYY-WXX.md files)
├─ Chat.md                   (Ask command history)
├─ Habits.md                 (Tracking + streaks)
├─ Finance Tracker.md        (Expense dashboard)
├─ scripts/                  (All automation scripts)
├─ [templates and guides]
└─ Master Dashboard.md       (Daily hub)

Journal/
├─ [date].md                 (Daily digest)
├─ [other notes]
```

### Security

- **API Key:** Stored in browser localStorage (mobile-safe, never synced)
- **HA Token:** Stored in localStorage (only your device, no cloud)
- **Captures:** Synced via Obsidian Sync (encrypted) or Git
- **Never stored in notes:** Passwords, tokens, credit card numbers

---

## 🚀 Next Steps

**Already set up? Choose your next step:**

1. **Start capturing** → Press trigger, describe what you're doing
2. **Set up expenses** → Try expense auto-classifier
3. **Configure HA** → Add more smart home entities to control
4. **Weekly reviews** → Copy template, fill in this Sunday
5. **Advanced** → Read Advanced Setup for email integration + HA automations

**Not set up yet?**

1. → Read [`Getting Started.md`](Getting%20Started.md)
2. → Follow SETUP steps
3. → Test capture + light control
4. → Do your first daily plan

---

## 📚 File Quick-Jump

### Guides & Getting Started
- [`Getting Started.md`](Getting%20Started.md) — Complete onboarding
- [`SETUP.md`](SETUP.md) — Installation + troubleshooting
- [`Advanced Setup.md`](Advanced%20Setup.md) — Advanced automations

### Daily Life
- [`Master Dashboard.md`](Master%20Dashboard.md) — Your daily hub
- [`Daily Plan Template.md`](Daily%20Plan%20Template.md) — Today's plan
- [`Capture Templates.md`](Capture%20Templates.md) — How to capture

### Tracking & Review
- [`Weekly Review Template.md`](Weekly%20Review%20Template.md) — Weekly recap
- [`Habits.md`](Habits.md) — Habit tracking
- [`Finance Tracker.md`](Finance%20Tracker.md) — Expense dashboard
- [`Goals & Outcomes.md`](Goals%20&%20Outcomes.md) — Project tracking

### Reference
- [`Projects Dashboard.md`](Projects%20Dashboard.md) — All projects
- [`Decision Journal.md`](Decision%20Journal.md) — Decision tracking
- [`Recurring Tasks.md`](Recurring%20Tasks.md) — Task templates
- [`Index.md`](Index.md) — This file

---

## ❓ Quick Questions

**"Where do my captures go?"**  
→ JARVIS/Inbox/, automatically organized by type

**"How do I ask JARVIS a question?"**  
→ Press Ask trigger (e.g., `Alt+A`), type question, it grounds answer in your recent captures

**"Can I use JARVIS offline?"**  
→ Yes! Captures work fully offline, sync when you reconnect

**"How do I customize triggers?"**  
→ Edit QuickAdd settings, change trigger key for each macro

**"What if I want to add my own automation?"**  
→ See Advanced Setup.md for HA automations, Templater triggers, email integration

---

**Ready? Start with Getting Started.md** ✨
