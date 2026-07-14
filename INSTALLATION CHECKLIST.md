---
type: setup-checklist
source: jarvis
---

# ✅ JARVIS v3 Installation Checklist

Follow this EXACTLY in your Obsidian app. Do not skip steps.

---

## STEP 1: Install Plugins (2 min)

**Location:** Obsidian Settings ⚙️ → Community Plugins

- [ ] **QuickAdd** — Install & Enable
- [ ] **Templater** — Install & Enable  
- [ ] **Dataview** — Install & Enable

**Done?** ✅ Continue to Step 2

---

## STEP 2: Configure QuickAdd Scripts Folder (1 min)

1. Settings ⚙️ → Community Plugins → **QuickAdd**
2. Click **Options** (gear icon)
3. Go to **Choices & Packages** tab
4. Find field: **"Script files folder location"**
5. Enter: `JARVIS/scripts`
6. Click **Save**

**Done?** ✅ Continue to Step 3

---

## STEP 3: Create Macro 1 — Capture (2 min)

1. Settings ⚙️ → Community Plugins → QuickAdd → **Options**
2. Click **"Add choice"** button
3. Select **Macro**
4. Fill in these fields:

```
Name: Capture
Trigger: Alt+J
```

5. Check the box: **"Prompt for input"**
6. Set input text to: `(Leave default or set custom prompt)`
7. Click **"Save"**
8. Now click **"Add step"**
9. Select **Script** from dropdown
10. Choose: `jarvis.js`
11. Click **"Save"**

**Done?** ✅ You now have: `Alt+J` = Capture

**Continue to Step 4**

---

## STEP 4: Create Macro 2 — Ask (2 min)

1. Settings ⚙️ → Community Plugins → QuickAdd → **Options**
2. Click **"Add choice"**
3. Select **Macro**
4. Fill in:

```
Name: Ask
Trigger: Alt+A
```

5. Check: **"Prompt for input"**
6. Click **Save**
7. Click **Add step** → **Script**
8. Choose: `jarvis_ask.js`
9. Click **Save**

**Done?** ✅ You now have: `Alt+A` = Ask

**Continue to Step 5**

---

## STEP 5: Create Macro 3 — Digest (2 min)

1. Settings ⚙️ → Community Plugins → QuickAdd → **Options**
2. Click **"Add choice"**
3. Select **Macro**
4. Fill in:

```
Name: Digest
Trigger: Alt+D
```

5. **DO NOT** check "Prompt for input" (leave blank)
6. Click **Save**
7. Click **Add step** → **Script**
8. Choose: `jarvis_digest.js`
9. Click **Save**

**Done?** ✅ You now have: `Alt+D` = Digest

**Continue to Step 6**

---

## STEP 6: Create Macro 4 — Expense (2 min)

1. Settings ⚙️ → Community Plugins → QuickAdd → **Options**
2. Click **"Add choice"**
3. Select **Macro**
4. Fill in:

```
Name: Expense
Trigger: Alt+E
```

5. Check: **"Prompt for input"**
6. Set input text: `"What did you spend on?"`
7. Click **Save**
8. Click **Add step** → **Script**
9. Choose: `jarvis_expense_classifier.js`
10. Click **Save**

**Done?** ✅ You now have: `Alt+E` = Expense

**Continue to Step 7**

---

## STEP 7: Create Macro 5 — Weekly (2 min)

1. Settings ⚙️ → Community Plugins → QuickAdd → **Options**
2. Click **"Add choice"**
3. Select **Macro**
4. Fill in:

```
Name: Weekly
Trigger: Alt+W
```

5. **DO NOT** check "Prompt for input" (leave blank)
6. Click **Save**
7. Click **Add step** → **Script**
8. Choose: `jarvis_weekly_trigger.js`
9. Click **Save**

**Done?** ✅ You now have: `Alt+W` = Weekly Review

**Continue to Step 8**

---

## STEP 8: Run JARVIS Setup (3 min)

**This stores your secrets (API key, HA token) locally in your browser.**

1. You need to find your **Setup** macro (should already exist from before)
2. Run it / press its trigger
3. When prompted, paste:
   - **Claude API Key:** Get from https://console.anthropic.com/dashboard
   - **Home Assistant URL:** Your HA address (e.g., `http://192.168.1.100:8123`)
   - **HA Token:** Get from HA → Settings → Users → "Create long-lived token"

4. You should see: **"JARVIS ✓ Setup complete"**

**Done?** ✅ Continue to Step 9

---

## STEP 9: Test Everything (5 min)

### **Test 1: Capture**

1. Press `Alt+J`
2. Type: `"Got up early, feeling energized"`
3. **Expected:** Notice appears: `"JARVIS ✓ classified → journal"`
4. **Check:** Go to `JARVIS/Inbox` folder — new note should be there

- [ ] Capture works ✅

### **Test 2: Light Control (if you have HA)**

1. Press `Alt+J`
2. Type: `"Turn on living room light"`
3. **Expected:** Notice: `"JARVIS ✓ light.turn_on → light.living_room_light"`
4. **Check:** Your HA dashboard — light should turn on

- [ ] Light control works ✅

**If light doesn't turn on:**
- Go to `JARVIS/scripts/jarvis.js`
- Find line 39: `"light.living_room_light"`
- Replace with your actual light entity ID from HA

### **Test 3: Expense**

1. Press `Alt+E`
2. Type: `"Spent £45 on groceries"`
3. **Expected:** `"JARVIS ✓ expense → Food (GBP 45.00)"`
4. **Check:** `JARVIS/Inbox` — new expense file

- [ ] Expense works ✅

### **Test 4: Digest**

1. You should have 2-3 captures from tests above
2. Press `Alt+D`
3. **Expected:** `"JARVIS ✓ digest created"`
4. **Check:** `Journal/` folder — summary file with today's date

- [ ] Digest works ✅

### **Test 5: Weekly Review (Only on Sunday)**

1. Press `Alt+W`
2. If today is Sunday: Creates `JARVIS/Weekly Reviews/2026-WXX.md`
3. If today is NOT Sunday: Shows notice "Weekly review runs on Sunday"

- [ ] Weekly works ✅

**Done?** ✅ ALL TESTS PASSED — JARVIS IS WORKING!

---

## STEP 10: Start Using JARVIS

### **Daily Routine**

**Morning (5 min):**
- [ ] Open `Master Dashboard.md`
- [ ] Review your top 3 priorities
- [ ] Check your habit checklist
- [ ] Copy `Daily Plan Template.md` and fill in

**Throughout Day:**
- [ ] Press `Alt+J` to capture wins/notes
- [ ] Press `Alt+E` to log expenses
- [ ] Press `Alt+A` to ask questions

**Evening (10 min):**
- [ ] Press `Alt+D` to digest today
- [ ] Fill in your Daily Plan evening reflection

**Sunday Evening (30 min):**
- [ ] Press `Alt+W` to create weekly review
- [ ] Fill in wins, habits, finances, reflections
- [ ] Plan next week

---

## 📚 Files You Have

```
JARVIS/
├── Getting Started.md         ⭐ READ AFTER SETUP
├── Index.md                   Dashboard navigation
├── Master Dashboard.md        Daily command center
├── Daily Plan Template.md     Copy daily
├── Weekly Review Template.md  Copy on Sunday
├── Capture Templates.md       7 capture formats
├── Habits.md                  Track habits
├── Finance Tracker.md         Expense dashboard
├── Goals & Outcomes.md        Project milestones
├── Decision Journal.md        Track decisions
├── Recurring Tasks.md         Task templates
├── Projects Dashboard.md      All 4 projects
├── Advanced Setup.md          Advanced features
├── SETUP.md                   Detailed guide
│
└── scripts/
    ├── jarvis.js
    ├── jarvis_setup.js
    ├── jarvis_ask.js
    ├── jarvis_digest.js
    ├── jarvis_expense_classifier.js
    └── jarvis_weekly_trigger.js
```

---

## ✅ Setup Complete Checklist

- [ ] Step 1: Plugins installed (QuickAdd, Templater, Dataview)
- [ ] Step 2: QuickAdd scripts folder configured
- [ ] Step 3: Capture macro created (`Alt+J`)
- [ ] Step 4: Ask macro created (`Alt+A`)
- [ ] Step 5: Digest macro created (`Alt+D`)
- [ ] Step 6: Expense macro created (`Alt+E`)
- [ ] Step 7: Weekly macro created (`Alt+W`)
- [ ] Step 8: JARVIS Setup run (secrets stored)
- [ ] Step 9: All 5 tests passed
- [ ] Step 10: Ready to use!

---

## 🎉 YOU'RE DONE!

JARVIS is now fully installed and working in your Obsidian vault.

**Start with:** Open `Getting Started.md` to understand how to use everything.

**Then:** Press `Alt+J` and start capturing your life.

---

**Questions?** Check:
- `Getting Started.md` — Complete onboarding
- `Index.md` — File navigation
- `Advanced Setup.md` — Advanced features

**Welcome to JARVIS v3. 🚀**
