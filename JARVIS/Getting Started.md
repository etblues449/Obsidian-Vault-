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
   ```

3. When you work on it, **capture to JARVIS:**
   - "Made progress on [project], did [task]"
   - JARVIS tags it with project name
   - **Weekly Review** shows all project captures

### Track in Goals & Outcomes

For major projects (Faceless Finance, Smart Home, Doc to Learning, Work Forecasting):

- Define **milestones** with due dates
- Update **status** in weekly review
- Note **blockers** or **upcoming needs**
- Check progress monthly

---

## 📚 Templates You Have

| Template | Purpose | When to use |
|----------|---------|------------|
| **Daily Plan** | Today's priorities + energy blocks | Every morning (or copy weekly) |
| **Weekly Review** | Weekly wins + reflections + next priorities | Every Sunday |
| **Capture Templates** | Structured formats for different life areas | When capturing anything important |
| **Habits** | Track daily/weekly/monthly habits + streaks | Daily logging + weekly review |
| **Recurring Tasks** | Copy-paste tasks for each project | Weekly review planning |
| **Finance Tracker** | Dashboard of expenses by category | Monthly review |
| **Decision Journal** | Record major decisions + outcomes | After making a decision |
| **Goals & Outcomes** | Project milestones + personal goals | Monthly/quarterly review |

---

## 🔧 Customization

### Change Trigger Keys

In **QuickAdd settings:**

1. Go to Choices & Packages
2. Find each macro (Capture, Ask, Digest, Expense, Weekly)
3. Edit **Trigger** field
4. Save

Suggested triggers:
- `Alt+J` — Capture (J = JARVIS)
- `Alt+A` — Ask
- `Alt+D` — Digest
- `Alt+E` — Expense
- `Alt+W` — Weekly Review

### Customize HA Entities

In `JARVIS/scripts/jarvis.js` (lines 39-50):

```javascript
haEntities: {
  "light.living_room_light": "Living room main",
  "light.left_smart_bulb": "Left bedroom bulb",
  // Add your lights here
}
```

Check Home Assistant UI for exact entity IDs.

### Add Custom Capture Categories

In `JARVIS/scripts/jarvis.js` (line 80), update Claude system prompt to recognize new types:

```javascript
Your categories are: journal, health, task, finance, decision, idea, question, smart-home, [YOUR_NEW_CATEGORY]
```

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| "API key not found" notice | Run JARVIS Setup again; make sure you pasted full key |
| Captures appear in wrong folder | Check CONFIG.folders mapping in jarvis.js matches your JARVIS/ paths |
| HA lights don't turn on | Verify entity IDs in CONFIG.haEntities match your HA setup |
| Digest says "nothing captured" | Check captures exist in JARVIS/Inbox/ (check path spelling) |
| Weekly review not creating | Make sure Weekly Review Template exists at that path |
| Expense classifier returns "Misc" | Try longer/more detailed description; API key might be rate-limited |

---

## 📱 Mobile Setup (Fold 7)

### Obsidian Sync

1. Enable **Obsidian Sync** in settings
2. Sign in with your Anthropic account
3. Vault syncs automatically across devices
4. Secrets stored locally (not synced) ✅

### Quick Capture from Home Screen

**Create Tasker task:**

1. New Task: "JARVIS Capture"
2. Action: Open Obsidian
3. Load URL: `obsidian://new?vault=Obsidian-Vault-`
4. Assign to home screen widget or gesture

**Create Shortcut (Android):**

1. App: Shortcut Maker
2. URI: `obsidian://new?vault=Obsidian-Vault-&folder=JARVIS/Inbox`
3. Save to home screen as "Capture"

### Offline Support

- Captures work fully offline
- Syncs when connection returns
- QuickAdd scripts run locally (no internet needed)
- HA control needs internet (adjust in HA settings for remote access)

---

## 🎓 Learning Path

**Week 1:**
- [ ] Run Basic Setup
- [ ] Capture 5-10 items
- [ ] Do one Digest
- [ ] Try one light control

**Week 2:**
- [ ] Create your first Weekly Review
- [ ] Start daily habit logging
- [ ] Capture expenses for 1 week
- [ ] Read Capture Templates, try each one

**Week 3:**
- [ ] Complete first full week (daily plans + weekly review)
- [ ] Set up Monthly Finance Review
- [ ] Define 4 project milestones in Goals & Outcomes

**Week 4:**
- [ ] Complete first month
- [ ] Monthly reflection (what worked, what to improve)
- [ ] Add 2-3 HA automations
- [ ] Try Advanced Setup (Expense Classifier, Weekly Trigger)

---

## 📞 Support

**Errors with scripts?**
- Check browser console (`Ctrl+Shift+I` in Obsidian)
- Verify API key is valid
- Restart Obsidian

**HA integration not working?**
- Test URL in browser: `http://your-ha-ip:8123/api/`
- Verify bearer token is correct
- Check entity IDs exist in HA

**Questions about setup?**
- Read `JARVIS/SETUP.md` for detailed setup
- Check `JARVIS/Advanced Setup.md` for advanced features
- All scripts documented in `JARVIS/scripts/` folder

---

## 🎉 You're Ready

You now have:

✅ A personal AI assistant (Claude) in Obsidian  
✅ Automatic capture + categorization  
✅ Smart home control (lights, climate, etc.)  
✅ Life tracking (habits, goals, finances, decisions)  
✅ Weekly reviews + dashboards  
✅ Mobile sync + offline support  
✅ Extensible (add automations, email integration, etc.)  

**Start with:** Press your Capture trigger and describe what you're doing right now.

JARVIS will learn from your captures, help you plan your week, track your projects, and eventually automate your entire life.

**Welcome to JARVIS v3. 🚀**
