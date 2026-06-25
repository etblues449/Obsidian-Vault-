---
type: guide
source: jarvis
---

# ✨ JARVIS v3: Getting Started

Your Obsidian-native life automation system. Complete guide to capture, organize, automate.

---

## What is JARVIS?

JARVIS is an Obsidian-based brain for your life. It intelligently captures what you do, learns from your patterns, and automates your workflow using Claude AI + Home Assistant.

**Core features:**
- 📝 **Capture** — Natural language input → Claude classifies → Routes to right folder
- 💭 **Ask** — Question grounded in your last 20 captures for context
- 📊 **Digest** — Summarizes last 24h of captures into actionable insights
- 🏠 **Control** — Smart home lights, climate, automations via Home Assistant
- 💰 **Track** — Expenses, habits, goals, decisions in one place
- 📈 **Review** — Weekly/monthly reflection with Dataview dashboards

---

## 🚀 Day 1: Basic Setup (30 min)

### 1. Install Dependencies

**On Desktop:**
- Obsidian (latest)
- QuickAdd plugin
- Templater plugin
- Dataview plugin

**On Mobile (Fold 7):**
- Obsidian app
- Obsidian Sync (or Git sync)

### 2. Install Required Plugins

In Obsidian Settings → Community Plugins:
- ✅ QuickAdd
- ✅ Templater
- ✅ Dataview

### 3. Copy JARVIS Folder to Your Vault

- Download the complete JARVIS folder
- Copy it to your vault root
- All files and scripts are included

### 4. Configure QuickAdd Scripts Folder

1. Settings → Community Plugins → QuickAdd → Options
2. Go to **Choices & Packages**
3. Set **Scripts Folder** to: `JARVIS/scripts`
4. Save

### 5. Run JARVIS Setup

1. In Obsidian, open **QuickAdd**
2. Find macro named **"JARVIS Setup"**
3. Click it or press trigger
4. Paste API key when prompted (get from [Anthropic Console](https://console.anthropic.com))
5. Paste Home Assistant URL + token
6. Confirm: "JARVIS ✓ Setup complete"

### 6. Test Capture

1. Press your **Capture trigger** (default: `Alt+J`)
2. Type: "Got up early, feeling energized"
3. See notice: "JARVIS ✓ classified → journal"
4. Check `JARVIS/Inbox` — should have new note

### 7. Test Light Control

1. Press **Capture** again
2. Type: "Turn on living room light"
3. Check your Home Assistant — light should turn on
4. **If it doesn't work:** Edit `JARVIS/scripts/jarvis.js` line 39 and replace entity ID with your actual light

### 8. Test Digest

1. You should have 2-3 captures
2. Press **Digest trigger** (default: `Alt+D`)
3. Check `Journal/` folder — summary should appear

---

## 📅 Daily Workflow

### Morning (5 min)
1. Open `Master Dashboard.md`
2. Review top 3 priorities
3. Copy `Daily Plan Template.md` and fill in

### Throughout Day
- Press `Alt+J` to capture wins/notes
- Press `Alt+E` to log expenses
- Press `Alt+A` to ask questions

### Evening (10 min)
1. Press `Alt+D` to digest
2. Fill in Daily Plan reflection

### Sunday Evening (30 min)
1. Press `Alt+W` to create weekly review
2. Fill in wins, habits, finances, reflections

---

## 📚 Files Included

**Core:**
- Getting Started.md (this file)
- Index.md (navigation)
- Master Dashboard.md (daily hub)
- SETUP.md (detailed installation)

**Templates:**
- Daily Plan Template.md
- Weekly Review Template.md
- Capture Templates.md

**Trackers:**
- Habits.md
- Finance Tracker.md
- Goals & Outcomes.md
- Decision Journal.md
- Recurring Tasks.md
- Projects Dashboard.md
- Advanced Setup.md

**Scripts:**
- jarvis.js (main classifier)
- jarvis_setup.js (store secrets)
- jarvis_ask.js (Q&A)
- jarvis_digest.js (24h summary)
- jarvis_expense_classifier.js (auto-categorize)
- jarvis_weekly_trigger.js (auto-reviews)

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| "API key not found" | Run JARVIS Setup; paste full key |
| Captures wrong folder | Check CONFIG.folders in jarvis.js |
| HA lights don't turn on | Replace entity ID in jarvis.js line 39 |
| Digest says "nothing" | Check captures exist in JARVIS/Inbox/ |

---

## 🎉 You're Ready

Press `Alt+J` and start capturing your life. JARVIS learns from your patterns and helps you automate everything.

**Welcome to JARVIS v3. 🚀**
