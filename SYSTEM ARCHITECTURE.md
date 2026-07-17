# JARVIS Full Automatic Assistant — System Architecture

**Complete System Design for Automatic Phone Control via Obsidian**

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Fold 7 Phone                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐              ┌──────────────┐            │
│  │   Obsidian   │◄────Ask──────┤   Claude API │            │
│  │ Vault JARVIS │ Macro        │  (Tool Use)  │            │
│  └──────────────┘              └──────────────┘            │
│       │                                                      │
│       └─────────────► HTTP Request ────────────┐            │
│                                                 │            │
│                                            ┌─────────────┐  │
│                                            │   Tasker    │  │
│                                            │  (Executor) │  │
│                                            └─────────────┘  │
│                                                 │            │
│       ┌────────────────────────────────────────┼────┐      │
│       │                                         │    │      │
│   ┌────────┐ ┌────────┐ ┌────────┐ ┌─────────┴────┴──┐  │
│   │ Alarms │ │  SMS   │ │ Remind │ │ Calendar/Apps  │  │
│   │  App   │ │  App   │ │  App   │ │   /Timers      │  │
│   └────────┘ └────────┘ └────────┘ └────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
         ▲
         │ Sync
         ▼
    GitHub Repo
```

---

## Components

### 1. Obsidian + Ask Macro
**File:** `JARVIS/scripts/jarvis_ask.js`  
**Trigger:** Alt+A keyboard shortcut  
**Role:** User interface & request processor

**Flow:**
1. User presses Alt+A
2. Obsidian opens input prompt ("Ask JARVIS...")
3. User types natural language request
4. Macro reads recent vault context (JARVIS/Inbox, Journal, Projects)
5. Sends request + context to Claude API with tool definitions
6. Receives response with tool calls
7. Executes tools by calling Tasker
8. Logs response to vault (JARVIS/Chat.md, JARVIS/Actions/)

**Why Obsidian?**
- Your brain's working memory is already here
- All context in one place (recent notes, projects, decisions)
- Single source of truth for actions and logs
- Works offline (except API calls)
- Syncs via git to keep history

---

### 2. Claude API with Tool Use
**Endpoint:** `https://api.anthropic.com/v1/messages`  
**Model:** `claude-opus-4-8`  
**Role:** AI brains that understand requests

**What JARVIS Can Do:**
- Understand natural language ("Set alarm for 8am tomorrow to pick up Shae")
- Parse parameters (time, date, label, contact, etc.)
- Call appropriate tools based on request
- Explain what it's doing
- Generate follow-up suggestions
- Learn from context (recent notes, projects, habits)

**Tools Defined:**
```
1. set_alarm — Create alarms with time, date, label
2. send_sms — Text messages to contacts
3. create_reminder — Time-based reminders
4. create_calendar_event — Calendar events with time, location
5. open_app — Launch apps (Chrome, Gmail, Obsidian, WhatsApp)
6. set_timer — Countdown timers with labels
7. send_notification — System notifications with priority levels
8. log_event — Log to vault for tracking/analysis
```

---

### 3. Tasker (Executor)
**Role:** Actually execute phone actions  
**Communication:** HTTP requests via localhost:1337  
**What It Does:**
- Receives HTTP requests from Obsidian/Ask macro
- Parses parameters from URL
- Executes corresponding Android actions
- Returns confirmation or error

**Example Flow:**
```
Ask macro → HTTP request to Tasker:
  http://localhost:1337/?task=Jarvis%20Alarm&par1=08&par2=30&par3=Pick%20up%20Shae&par4=10

Tasker receives → Creates alarm at 08:30 with label "Pick up Shae"
```

**Tasker Tasks:**
- `Jarvis Alarm` — Set Alarms
- `Jarvis SMS` — Send SMS
- `Jarvis Reminder` — Create Reminder
- `Jarvis Calendar` — Create Calendar Event
- `Jarvis OpenApp` — Open App
- `Jarvis Timer` — Set Timer
- `Jarvis Notify` — Send Notification

---

### 4. Vault Auto-Logging
**Files Created Automatically:**

```
JARVIS/
├── Chat.md                    # Every request + response logged here
├── Actions/
│   └── 2026-06-25.md         # Daily action summary (auto-created)
├── Daily Briefing Log.md      # Morning briefings (if enabled)
├── Reminders.md              # All reminders created (if tracked)
└── Actions Dashboard.md       # Dataview dashboard of all actions
```

**Why Logging?**
- Build context for future requests ("JARVIS, remind me like I did for Shae last week")
- Track patterns (Most alarms? When? Why?)
- Create audit trail (What did I do today?)
- Enable analytics and insights
- Integration with project tracking

---

## Data Flow: Complete Example

**User says:** "Set alarm for 8am tomorrow to pick up Shae"

```
1. USER INPUT
   └─ Alt+A → Ask JARVIS → Type request

2. CONTEXT GATHERING (in Ask macro)
   └─ Read recent files from:
      ├─ JARVIS/Inbox/ (last captures)
      ├─ Journal/ (recent activity)
      └─ Claude Memory/Projects/ (active projects)

3. API CALL TO CLAUDE
   └─ POST https://api.anthropic.com/v1/messages
      ├─ Model: claude-opus-4-8
      ├─ System prompt: "You are JARVIS, a phone assistant..."
      ├─ Tools: [set_alarm, send_sms, create_reminder, ...]
      ├─ Message: "Context: [recent notes]\n\nRequest: Set alarm for 8am tomorrow..."
      └─ Max tokens: 2000

4. CLAUDE RESPONSE (tool use)
   └─ Content block:
      ├─ Type: text
      │  └─ Text: "Setting alarm for 8am tomorrow to pick up Shae"
      └─ Type: tool_use
         ├─ Name: set_alarm
         └─ Input:
            ├─ time: "08:00"
            ├─ date: "2026-06-26"
            ├─ label: "Pick up Shae"
            └─ snooze_minutes: 10

5. TOOL EXECUTION (in Ask macro)
   └─ For tool_use block:
      ├─ Extract: time="08:00", date="2026-06-26", label="Pick up Shae"
      ├─ Build URL: http://localhost:1337/?task=Jarvis%20Alarm&par1=08&par2=00&par3=Pick%20up%20Shae&par4=10
      └─ Call fetch(url)

6. TASKER EXECUTION
   └─ Tasker receives HTTP request
      ├─ Parse: task="Jarvis Alarm", par1=08, par2=00, par3="Pick up Shae", par4=10
      ├─ Execute: Create alarm
      │  ├─ Time: 08:00
      │  ├─ Label: "Pick up Shae"
      │  ├─ Snooze: 10 minutes
      │  └─ Sound: Notification tone
      └─ Confirm: Return success

7. NOTIFICATION TO USER
   └─ Obsidian Notice: "✓ ⏰ ALARM: 08:00 on 2026-06-26 (Pick up Shae)"

8. VAULT LOGGING
   └─ Append to JARVIS/Chat.md:
      └─ ### 2026-06-25 14:30:45
         Q: Set alarm for 8am tomorrow to pick up Shae
         
         Setting alarm for 8am tomorrow to pick up Shae
         
         **Actions:**
         - set_alarm: {"time":"08:00","date":"2026-06-26",...}

9. ACTION LOG
   └─ Append to JARVIS/Actions/2026-06-25.md:
      └─ 2026-06-25 14:30:45 | set_alarm | {"time":"08:00",...}

10. NEXT MORNING
    └─ Alarm fires at 08:00 with label "Pick up Shae"
    └─ User completes action
    └─ (Optional) Log completion to vault
```

---

## Architecture Principles

### 1. Obsidian is the Center
- Your vault is the source of truth
- All decisions and actions logged here
- Context pulled from here for every request
- Automation workflows run from here

### 2. Tasker is the Executor
- Only handles actual phone actions
- No decision-making (dumb executor)
- Receives commands via simple HTTP requests
- Returns success/failure

### 3. Claude is the Intelligence
- Understands natural language
- Decides which tools to call
- Explains what it's doing
- Can reason about context and constraints

### 4. Loose Coupling
- Ask macro doesn't depend on specific Tasker version
- Tasker doesn't depend on Obsidian (could call from anywhere)
- Claude doesn't know about Obsidian or Tasker internals
- Easy to replace any component independently

---

## Security & Privacy

```
┌──────────────────────────────────────────────────┐
│ On Your Phone (Encrypted at Rest + In Use)       │
├──────────────────────────────────────────────────┤
│ ✓ Obsidian vault (local storage)                 │
│ ✓ Tasker (local storage)                         │
│ ✓ Alarms, SMS, Calendar (local only)             │
│ ✓ Action logs (stay on phone)                    │
└──────────────────────────────────────────────────┘
         │
         ├─ API Key ──→ HTTPS ──→ Claude API
         │ (Encrypted)  (Encrypted)
         │
         ├─ Git Sync ──→ GitHub (Public repo)
         │ (Only logs, no personal data)
         │
         └─ Notes ──→ Obsidian Git (Private)
           (Optional sync)
```

**What leaves your phone:**
- API requests to Claude (encrypted, Anthropic's privacy policy)
- Action summaries to git (no personal data)

**What stays on your phone:**
- Personal vault data
- Detailed logs
- All phone actions and results
- Reminders and alarms

---

## Scalability & Extension

### Adding New Actions
1. Define tool in `TOOLS` array in jarvis_ask.js
2. Create execution handler in `executeTool()` function
3. Create corresponding Tasker task
4. Test end-to-end

### Adding New Automations
1. Create workflow in Automation Workflows.md
2. Create Tasker scheduled task
3. Sync to vault for logging
4. Monitor and refine

### Integrating with Projects
- Auto-tag actions by project
- Update project status on relevant actions
- Link reminders to project deadlines
- Create project-specific dashboards

---

## Performance Characteristics

| Component | Latency | Notes |
|-----------|---------|-------|
| Obsidian Ask macro | <100ms | Instant |
| API call to Claude | 1-3 sec | Network dependent |
| Tasker execution | <500ms | Local action |
| Vault logging | <100ms | Async |
| **Total** | **2-4 sec** | User perceives as instant |

---

## Failure Modes & Recovery

| Failure | Detection | Recovery |
|---------|-----------|----------|
| API Key missing | Shown at start | Run JARVIS Setup |
| Claude API down | HTTP error | Retry, show error notice |
| Tasker not running | HTTP timeout | User restarts Tasker |
| Network issue | API call fails | Fallback to local functions |
| Vault full | Append fails | Archive old logs |
| Malformed request | Parse error | Show error, ask for clarification |

---

## Future: Advanced Capabilities

```
Current:
  Request → Claude → Action → Log

Advanced (Coming):
  Request → Claude ──→ Action → Log
              ↓
           Memory ─→ Learn patterns
              ↓
           Suggest ─→ Proactive actions
              ↓
           Adapt ─→ Personalize behavior
```

---

**This architecture is designed to:**
- ✅ Put you (your vault) at the center
- ✅ Keep personal data on your phone
- ✅ Be simple enough to maintain
- ✅ Scale as you add automation
- ✅ Work offline (except AI calls)
- ✅ Sync reliably via git

You are in full control. JARVIS serves you, not the other way around.
