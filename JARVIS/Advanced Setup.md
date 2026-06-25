---
type: guide
source: jarvis
---

# 🚀 Advanced JARVIS Setup

Integration guides for expenses, weekly reviews, email capture, and HA automations.

---

## 1️⃣ Expense Auto-Classifier

Automatically categorize expenses as you capture them.

### Setup in QuickAdd

1. **Copy script:** `JARVIS/scripts/jarvis_expense_classifier.js`
2. **In QuickAdd**, create new **Macro** choice:
   - **Name:** "Expense"
   - **Trigger:** `Alt+E` (or your preference)
   - **Input:** Prompt "What did you spend on?"
   - **Script step:** Select `jarvis_expense_classifier.js`

3. **Test:**
   - Press `Alt+E`, type: "Spent £45 on groceries"
   - You should see notice: "JARVIS ✓ expense → Food (GBP 45.00)"
   - Check `JARVIS/Inbox` for new expense note

### How it Works

- Natural language input (e.g., "£60 fuel") → Claude classifies → Saves to Inbox with metadata
- Dataview queries in Finance Tracker auto-sum by category
- Monthly summary for your Select Lifestyles forecasting

### Categories

Food, Transport, Home, Tools, Health, Entertainment, Savings, Work, Social, Misc

---

## 2️⃣ Weekly Review Auto-Trigger

Automatically create weekly reviews on Sunday.

### Setup in QuickAdd

1. **Copy script:** `JARVIS/scripts/jarvis_weekly_trigger.js`
2. **In QuickAdd**, create new **Macro** choice:
   - **Name:** "Weekly Review"
   - **Trigger:** `Alt+W`
   - **Script step:** Select `jarvis_weekly_trigger.js`

3. **Optional — Templater Auto-Trigger:**
   - Add to your Sunday daily note template:
   ```
   <% await require('../../JARVIS/scripts/jarvis_weekly_trigger.js')(params, context); %>
   ```
   This auto-creates the review when you open your Sunday daily plan.

### How it Works

- Detects if today is Sunday; if so, creates `JARVIS/Weekly Reviews/YYYY-WXX.md`
- Populates with template: wins, captures, tasks completed, habits, reflections, next priorities
- Opens immediately for you to fill in

---

## 3️⃣ Email-to-JARVIS Capture

Forward emails to Obsidian vault.

### Option A: SMTP/Inbox Integration (Advanced)

**Future enhancement** — Use Zapier/IFTTT to forward email → JARVIS Inbox folder.

For now: Manually capture email subjects/key points to JARVIS.

### Option B: Mobile Email Shortcut

On your Fold 7:

1. Create Tasker task: "Email to JARVIS"
   - Read clipboard / from notification
   - Extract email subject + sender
   - Pass to QuickAdd `obsidian://` URI with type=email

2. Create Shortcut (iOS/Android equivalent):
   - Share email → Shortcut → Extract key info
   - Pass to Obsidian JARVIS Capture

### Example URI (Desktop)

```
obsidian://new?vault=Obsidian-Vault-&folder=JARVIS/Inbox&type=email&from=sender@example.com
```

---

## 4️⃣ Home Assistant Automation Triggers

Based on JARVIS captures, trigger HA automations.

### Example: "I'm tired" → Dim Lights

**JARVIS Capture:** "I'm tired, ready for bed"

**Claude Classification:** type = health, subtopic = tiredness

**HA Automation Script** (in HA, not Obsidian):

```yaml
automation:
  - alias: "Bedtime from JARVIS"
    trigger:
      platform: webhook
      webhook_id: jarvis-bedtime-webhook
    action:
      - service: light.turn_off
        data:
          entity_id: 
            - light.living_room_light
            - light.stairs_smart_bulb
      - service: climate.set_temperature
        data:
          entity_id: climate.bedroom
          temperature: 18
```

**JARVIS Script Step:**

In `jarvis.js`, add trigger check after capture classification:

```javascript
if (classified.type === "health" && classified.subtopic === "tiredness") {
  // Call HA automation webhook
  await requestUrl({
    url: `${CONFIG.haUrl}/api/webhook/jarvis-bedtime-webhook`,
    method: "POST",
    headers: { "Authorization": `Bearer ${CONFIG.haToken}` }
  });
}
```

---

## 5️⃣ Smart Home Automations

### Light Automations

```yaml
automation:
  - alias: "Work Mode: Lights On"
    trigger:
      platform: state
      entity_id: input_select.mode
      to: "work"
    action:
      - service: light.turn_on
        data:
          entity_id: light.living_room_light
          brightness: 255
          color_temp: 4000

  - alias: "Relax Mode: Lights Dim"
    trigger:
      platform: state
      entity_id: input_select.mode
      to: "relax"
    action:
      - service: light.turn_on
        data:
          entity_id: all_lights
          brightness: 150
          color_temp: 2700
```

### Time-Based Automations

```yaml
automation:
  - alias: "Morning routine: Lights to 50%"
    trigger:
      platform: time
      at: "07:00:00"
    action:
      - service: light.turn_on
        data:
          entity_id: light.living_room_light
          brightness: 128

  - alias: "Evening: Prepare for bed"
    trigger:
      platform: time
      at: "22:00:00"
    action:
      - service: light.turn_off
        entity_id: all_lights
```

---

## 6️⃣ Recurring Task Auto-Generation

### Manual Approach (Weekly)

In your **Weekly Review** template, include:

```markdown
## Weekly Recurring Tasks

### Faceless Finance (if Wed/Fri/Sun this week)
- [ ] Brainstorm video idea
- [ ] Research & script
- [ ] Film & edit
- [ ] Upload
- [ ] Engage/analytics

### Smart Home
- [ ] Test sensors & logs
- [ ] Plan improvements

### Doc to Learning
- [ ] Dev sprint / Demo week
```

### Automated Approach (Advanced)

**Templater** code to auto-insert tasks:

```javascript
<%
const today = new Date();
const dayOfWeek = today.getDay();

// Is it a Wed/Fri/Sun?
const isFacelessDay = [0, 3, 5].includes(dayOfWeek);
const isSunday = dayOfWeek === 0;

let tasks = [];
if (isFacelessDay) tasks.push("Faceless Finance: [task]");
if (isSunday) tasks.push("Smart Home: Weekly review");
%>

## Auto-Generated Tasks
<% tasks.map(t => `- [ ] ${t}`).join('\n') %>
```

---

## 7️⃣ Mobile Setup (Fold 7 Optimizations)

### Tasker Integration

1. **Task: "JARVIS Capture"**
   - Trigger: Custom button / voice command "Hey JARVIS"
   - Action: Open Obsidian with `obsidian://new?vault=...`
   - Continue: Stay in current app

2. **Task: "JARVIS Quick Ask"**
   - Trigger: Long-press power button
   - Action: Open JARVIS/Chat.md and prompt for question

3. **Task: "HA Quick Control"**
   - Trigger: Home Assistant companion app action
   - Action: Light toggle, scene select

### Home Assistant Companion App

1. **Install** Home Assistant app on Fold 7
2. **Configure** quick actions:
   - Light toggle
   - Scene: "Movie" / "Work" / "Relax"
   - Door lock check
3. **Pin to home screen**

---

## 8️⃣ Troubleshooting

| Issue | Solution |
|-------|----------|
| Expense classifier returns "Misc" | Check API key is valid; try longer description |
| Weekly review not triggering | Verify Templater is installed; check task triggers |
| HA webhook not responding | Test webhook in HA developer tools; check bearer token |
| Email forwarding fails | Check SMTP/Zapier config; fall back to manual capture |
| Light control slow | Reduce HA entity list in CONFIG; use entity groups |

---

**Next Steps:**

1. ✅ Set up Expense Classifier (most impactful for Finance Tracker)
2. ✅ Add Weekly Review trigger to QuickAdd
3. ✅ Configure HA automations for bedtime/work modes
4. ⏳ Explore email-to-JARVIS when ready
5. ⏳ Advanced task auto-generation with Templater

**All scripts are located in:** `JARVIS/scripts/`

**All templates are located in:** `JARVIS/` (Daily Plan, Weekly Review, Capture Templates, etc.)
