# Morning Brief Skill

**Trigger:** 7:00 AM daily  
**Input:** Vault snapshots (MEMORY.md, projects, captures)  
**Output:** `Claude Memory/briefings/YYYY-MM-DD.md`  
**Status:** ⏳ Template (ready to implement via n8n or Templater)

---

## What It Does

Runs at 7am. Pulls from vault:
- Today's calendar events (if available)
- Pending tasks from projects
- Recent captures (last 48h)
- Yesterday's decisions
- Current patterns

Generates a **morning briefing** (2-3 min read):
```
## Morning Brief — 2026-06-29

**Today at a glance:**
- 10am: Standup meeting
- 2pm: Doc to Learning review session
- Pending: 3 captures from yesterday

**Yesterday patterns:**
- Alignment: JARVIS + Job merged (Unified Backend live)
- Blocker: Localtunnel terminal must stay open
- Decision logged: Path 2+3 (reconcile + artifacts)

**Focus today:**
Based on yesterday's momentum, suggest top 3 tasks.
```

---

## Implementation

### Option A: n8n Scheduled Workflow
```
Trigger: Cron (7am daily)
├─ Read: MEMORY.md
├─ Read: Latest project _index.md files
├─ Read: JARVIS/Inbox/ (last 48h)
├─ Claude Haiku: Generate summary
└─ Write: Claude Memory/briefings/YYYY-MM-DD.md
```

### Option B: Obsidian Templater Script
```javascript
// Runs via Templater plugin (command or hotkey)
// Reads vault, generates briefing, inserts date
const today = new Date().toISOString().split('T')[0];
const briefingPath = `Claude Memory/briefings/${today}.md`;
// ... template content ...
```

### Option C: Manual (You run it)
- Open this template
- Fill in today's info
- Save to `Claude Memory/briefings/YYYY-MM-DD.md`

---

## Template Structure

```markdown
# Morning Brief — YYYY-MM-DD

## Today at a Glance
- [Calendar events, if any]
- [Pending project tasks]
- [Captures from yesterday]

## Yesterday Highlights
- **Alignment:** [Yesterday's wins]
- **Blockers:** [What got stuck]
- **Decisions:** [Important choices made]

## Patterns
- [Recurring themes from recent captures]
- [Active projects momentum]

## Today's Focus
1. [Top priority]
2. [Second priority]
3. [Capture/learn goal]

---
*Generated at 7:00 AM. Next briefing: tomorrow at 7:00 AM.*
```

---

## Next Steps

1. Decide: n8n workflow vs. Templater vs. manual
2. Set up trigger (cron in n8n, time trigger in Templater, or calendar reminder)
3. Test: Generate one morning briefing manually
4. Iterate: Refine briefing content based on what's useful

**First run:** 2026-06-30 @ 7:00 AM
