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
- QuickAdd mobile support enabled

### 2. Run JARVIS Setup

1. In Obsidian, open **QuickAdd**
2. Find **"JARVIS Setup"** macro
3. Click it or press your trigger key
4. Paste API key when prompted (get from [Anthropic Console](https://console.anthropic.com))
5. Paste Home Assistant URL + token
6. Confirm with notices "JARVIS ✓ Setup complete"

**What this does:** Stores secrets in browser localStorage (never synced, never committed)

### 3. Test Capture

1. Press your **Capture trigger** (default: `Alt+J`)
2. Type: "Got up early, feeling energized"
3. See notice: "JARVIS ✓ classified → journal"
4. Check `JARVIS/Inbox` — should have new note

### 4. Test Light Control

1. Press **Capture** again
2. Type: "Turn on living room light"
3. See notice: "JARVIS ✓ light.turn_on → light.living_room_light"
4. Check your Home Assistant dashboard — light should turn on

**If light doesn't turn on:**
- Go to `JARVIS/scripts/jarvis.js` line 39
- Find `light.living_room_light` in CONFIG.haEntities
- Replace with your actual light entity ID (check in HA → Settings → Devices → Light name)

### 5. Test Digest (24h Summary)

1. You should have 2-3 captures from steps 3-4
2. Press **Digest trigger** (default: `Alt+D`)
3. See notice: "JARVIS ✓ digest created"
4. Check `Journal/` folder — should have date-stamped summary

---

## 📅 Day 2: Daily Planning

### Morning Routine

1. **Open Master Dashboard** to see:
   - Your top 3 priorities
   - Open tasks (sorted by priority)
   - Quick wins (15 min tasks)
   - Habit checklist

2. **Create today's Daily Plan:**
   - Copy **Daily Plan Template**
   - Fill in top 3 priorities for today
   - Note your energy blocks (when you work best)
   - Log habits as you do them

3. **Review HA status:**
   - Check climate comfortable
   - Verify lights/doors as needed
   - Note anything to capture

### Throughout the Day

- **Capture wins/notes** as they happen:
  - "Completed video editing" → JARVIS → journal
  - "Spent £45 on groceries" → JARVIS → Finance Tracker auto-categorizes
  - "Made decision to use Claude API" → JARVIS → Decision Journal
  - "Feeling tired, lights too bright" → JARVIS → HA dims lights

- **Ask questions** when you need context:
  - "What did I capture about the Smart Home project this week?"
  - "What was my income last month?" (looks at Finance Tracker)
  - JARVIS grounds answer in your 20 most recent captures

### Evening Reflection

Fill in your **Daily Plan** evening section:
- What went well today?
- What was challenging?
- Tomorrow's one focus?

---

## 📊 Weekly Flow

### Every Sunday Evening

1. **Run Weekly Review:**
   - Press trigger (e.g., `Alt+W`)
   - JARVIS auto-creates `JARVIS/Weekly Reviews/2026-W25.md`
   - Opens in editor for you to complete

2. **Fill in sections:**
   - **Wins:** Key achievements this week
   - **Habits:** Check streaks (flame emoji 🔥)
   - **Finances:** Review Finance Tracker totals by category
   - **Projects:** Which projects got work this week?
   - **Reflections:** What worked? What was hard? What to change?
   - **Next week:** Top 3 priorities

3. **Check Goals & Outcomes:**
   - Compare what you captured vs. project milestones
   - Update any project status (on track/at risk/complete)
   - Note blockers for next week

---

## 💰 Finance Tracking

### Quick Expense Capture

When you spend money, capture it:

- **Natural language:** "Spent £45 on groceries"
- **JARVIS response:** Classifies as Food, saves with amount
- **Auto-categorizes** using Claude: Food, Transport, Home, Tools, Health, Entertainment, Work, Social, Savings, Misc

### Monthly Review

On the **1st of each month:**

1. **Check Finance Tracker dashboard:**
   - Total expenses (last 30 days)
   - Top spending categories
   - Comparison to budget

2. **Update Work Financial Forecasting:**
   - Review Select Lifestyles actual income vs. forecast
   - Note any unusual spending or income changes
   - Ask Claude as "financial director" for analysis

3. **Adjust next month:**
   - Are you over budget on any category?
   - Need to increase savings rate?
   - Any one-time expenses to factor out?

---

## 🏠 Smart Home Automation

### Available Commands

**Turn lights on/off:**
- "Turn on living room light" → JARVIS → HA controls
- "All lights off" → JARVIS → Turns off all configured lights
- "Set brightness to 50%" → JARVIS → Adjusts brightness

**Climate control:**
- "Make it warmer" → Increases thermostat 1°C
- "Cozy mode" → Predefined scene (dim lights, warm color, climate 20°C)

**Security:**
- "Lock the doors" → Locks configured smart locks
- "Unlock front door" → Unlocks front only

### Create Automations

In Home Assistant (Settings → Automations), create:

1. **Morning:** "7am lights on 50%, warm color"
2. **Work:** "Lights 100%, cool white, door locked"
3. **Evening:** "8pm lights to 2700K, 50% brightness"
4. **Bedtime:** "All lights off, door locked, thermostat 18°C"

Then trigger from JARVIS:
- "Goodnight" → runs Bedtime automation
- "Work mode" → runs Work automation

---

## 🎯 Project Tracking

### Add a Project

1. Open **Projects Dashboard**
2. Add section for new project:
   ```markdown
   ## 🚀 My New Project
   
   **Goal:** [What are you building?]
   
   Progress:
   - [ ] Milestone 1
   - [ ] Milestone 2
         