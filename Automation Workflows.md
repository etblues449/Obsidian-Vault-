# JARVIS Automation Workflows — Proactive Assistance

These workflows make JARVIS truly automatic by anticipating needs and executing actions without prompting.

## Workflow Types

### 1. Daily Briefing Routine
**Trigger:** 7:00 AM every day

**Actions:**
1. Get current weather
2. Pull today's calendar events from vault
3. Check upcoming reminders (next 4 hours)
4. Read morning journal/notes
5. Generate briefing summary
6. Send notification with briefing
7. Set alarm for first calendar event (if > 1 hour away)

**Implementation:**
```javascript
// Tasker: Daily Briefing (scheduled 7:00 AM)
// 1. Fetch vault: JARVIS/Daily Plan Template
// 2. Query calendar for today's events
// 3. Build summary
// 4. Send notification
// 5. Log to vault with "routine" tag
```

---

### 2. Smart Reminders
**Trigger:** Whenever calendar event added, or time-based

**Logic:**
- 30 min before event: Send notification
- If event > 30 min away AND no reminder set: Automatically set reminder
- If location set: Send "time to leave" notification based on location distance
- Log reminder to vault with context

**Implementation:**
- Tasker monitors calendar changes
- Triggers notification task
- Logs to JARVIS/Reminders.md

---

### 3. End-of-Day Wrap-up
**Trigger:** 9:00 PM or on-demand

**Actions:**
1. Summarize today's actions from JARVIS/Actions
2. Review pending items
3. Plan tomorrow's top 3 priorities
4. Log summary to vault
5. Send notification with summary

**Vault Integration:**
- Create/update JARVIS/Daily Plan for tomorrow
- Link completed projects
- Suggest next actions

---

### 4. Weekly Review Automation
**Trigger:** Every Sunday 6:00 PM

**Actions:**
1. Compile week's actions from JARVIS/Actions
2. Analyze patterns (most common actions, times, contexts)
3. Calculate productivity metrics
4. Generate insights (e.g., "You set 12 alarms this week")
5. Create Claude Memory/Projects/Smart Home/sessions/YYYY-Www.md entry
6. Send weekly summary notification
7. Suggest optimizations

**Report Structure:**
```markdown
# Weekly Review — Week 25

## Summary
- Actions taken: 47
- Most active day: Wednesday
- Most used feature: Alarms (8)
- Average response time: 2 sec

## Patterns
- Most alarms set between 7-9am
- SMS usage peaks Wed/Thu evenings
- Calendar events clustered around Mondays

## Insights
- Try scheduling recurring reminders for Tuesday afternoon meetings
- WhatsApp is most opened app (14 times)

## Next Week Focus
- [ ] Reduce alarm snooze usage (avg 2x per alarm)
- [ ] Test voice input for SMS
- [ ] Set up recurring reminders for weekly review

## Linked Projects
- Work Financial Forecasting
- Smart Home / JARVIS
```

---

### 5. Context-Aware Suggestions
**Trigger:** When new project/event created, or periodically

**Logic:**
- If event added to "Work" calendar → suggest relevant tasks
- If reminder created about a person → suggest follow-up in a week
- If SMS sent to someone → offer reminder to follow up
- If timer set → offer related app shortcuts

**Example:** User sets reminder "Call mum tomorrow 2pm" →
- JARVIS suggests: "Want to set a follow-up reminder for next week?"
- JARVIS logs: "Family → Communication" pattern
- JARVIS recommendations: "You call mum weekly on Tuesday at 2pm. Create recurring reminder?"

---

### 6. Project Integration Automation
**Trigger:** On action request, after execution

**Smart Logging:**
- Detect project references in request
- Auto-tag action with relevant project
- Update project status if action relates to deadline
- Log to both JARVIS/Chat.md AND project-specific file

**Example:** User: "Set reminder for Doc to Learning deadline check next Friday"
→ Auto-creates reminder
→ Logs to JARVIS/Chat.md
→ Updates Claude Memory/Projects/Doc to Learning/_index.md with action
→ Links reminder to project

---

### 7. Financial Auto-Logging
**Trigger:** On expense-related actions

**Actions:**
- Detect expense mentions ("Buy coffee £4")
- Auto-log to Finance Tracker
- Categorize expense
- Update monthly budget in vault
- Alert if spending exceeds weekly threshold

**Example:** User: "Remind me to pay electricity bill next Monday"
→ Creates reminder
→ Logs to Finance Tracker as "Upcoming: Electricity"
→ Sets calendar event for that date
→ Updates budget projection

---

### 8. Habit Tracking Automation
**Trigger:** After recurring actions or at scheduled times

**Tracking:**
- Monitor recurring reminders/alarms (e.g., "Exercise" reminder at 6am)
- Track follow-through (did reminder trigger action?)
- Build habit streaks
- Send motivation notifications
- Log completion status

**Example:**
- User sets "Morning routine" reminder at 7am daily
- JARVIS tracks if user acknowledges/completes
- Weekly report: "Morning routine: 6/7 days completed ✓"
- Monthly insight: "Habit strength increasing"

---

### 9. Smart Scheduling
**Trigger:** When new event/reminder created

**Logic:**
- Analyze user's existing schedule
- Detect free slots
- Suggest optimal times for similar events
- Learn preferences (e.g., "Meetings preferably 10am-12pm")
- Auto-resolve time conflicts

**Example:** User: "Set reminder for weekly team sync"
→ JARVIS analyzes calendar
→ Suggests: "You usually have free Wednesdays 2-3pm. Schedule for then?"
→ Auto-creates recurring reminder at that time

---

### 10. Emergency/Urgent Protocol
**Trigger:** Keywords in request ("urgent", "emergency", "immediately")

**Actions:**
- Prioritize action execution (skip confirmations if safe)
- Set high-priority notifications
- Log with urgent tag
- Alert relevant contacts if specified
- Escalate to voice notification if needed

---

## Implementation Roadmap

### Phase 1: Core (Week 1)
- [ ] Daily Briefing Routine
- [ ] Smart Reminders
- [ ] End-of-Day Wrap-up
- [ ] Project Integration Auto-logging

### Phase 2: Intelligence (Week 2)
- [ ] Weekly Review Automation
- [ ] Context-Aware Suggestions
- [ ] Financial Auto-logging
- [ ] Habit Tracking

### Phase 3: Optimization (Week 3)
- [ ] Smart Scheduling
- [ ] Emergency Protocol
- [ ] Pattern learning from actions
- [ ] ML-based suggestions (if available)

---

## Configuration Files

Create these to enable each workflow:

- `JARVIS/workflows/daily_briefing.json` — Schedule and settings
- `JARVIS/workflows/smart_reminders.json` — Reminder logic
- `JARVIS/workflows/weekly_review.json` — Report template
- `JARVIS/workflows/project_integration.json` — Project mapping
- `JARVIS/workflows/financial_tracking.json` — Expense categories
- `JARVIS/workflows/habit_tracking.json` — Habit definitions
- `JARVIS/workflows/smart_scheduling.json` — Scheduling rules

---

## Example: Daily Briefing (Full Implementation)

```javascript
// Tasker: Daily Briefing at 7:00 AM

// Step 1: Pull vault content
const briefingNote = await app.vault.adapter.read("JARVIS/Daily Plan Template.md");
const todayEvents = getTodayEvents(); // From calendar
const upcomingReminders = getReminders(now, now + 4h);

// Step 2: Build briefing
const briefing = `
🌅 **Morning Briefing — ${new Date().toLocaleDateString()}**

📅 **Today's Schedule:**
${todayEvents.map(e => `- ${e.title} at ${e.time}`).join("\n")}

🔔 **Next 4 Hours:**
${upcomingReminders.map(r => `- ${r.title} at ${r.time}`).join("\n")}

📋 **Today's Focus:**
${briefingNote}

💪 **You've got this!**
`;

// Step 3: Send notification
new Notice(briefing);

// Step 4: Log to vault
const entry = `## ${new Date().toLocaleTimeString()}\n${briefing}`;
await app.vault.append("JARVIS/Daily Briefing Log.md", entry);

// Step 5: Auto-set alarm for first event
if (todayEvents.length > 0 && todayEvents[0].time > now + 1h) {
  const firstEvent = todayEvents[0];
  setAlarm(firstEvent.time, firstEvent.title);
}
```

---

## Monitoring & Adjustment

Weekly, review:
- [ ] Which workflows executed successfully?
- [ ] Which sent helpful notifications?
- [ ] Which can be refined or combined?
- [ ] New workflows to add?
- [ ] Workflows to disable?

---

**Status:** These workflows are **templates** — configure and adapt to your specific routine and preferences.
