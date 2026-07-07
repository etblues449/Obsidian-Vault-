# Pattern Detector Skill

**Trigger:** Weekly (Monday, 8:00 AM)  
**Input:** Captures + actions from past week  
**Output:** Patterns → `Claude Memory/patterns.md`  
**Status:** ⏳ Template (ready to implement via n8n or Templater)

---

## What It Does

Runs every Monday at 8am. Analyzes the week's captures and actions for recurring patterns:

- **Time patterns:** When do decisions cluster? When is capture rate highest?
- **Behavioral patterns:** Do certain tasks/projects trigger specific response patterns?
- **Decision patterns:** Do you make similar choices on certain days or in similar contexts?
- **Resource patterns:** How do smart home automations, work tasks, and personal projects flow across the week?

Generates a **pattern report** (5–10 min read):

```
## Patterns Detected — Week of 2026-06-24

**Capture timing:**
- Peak: Thursdays (11am–2pm) — decision fatigue hypothesis
- Trough: Sundays (captures stop after 6pm)
- Volume: 24 captures this week (baseline: 18/week)

**Action patterns:**
- Smart Home: 12 automation triggers (aligned with Faceless Finance filming)
- Finance: 8 actions (Monday CFO forecasting, Friday planning)
- Doc to Learning: 3 checks (Tuesday, Thursday, Saturday)

**Decision patterns:**
- "Defer and batch" chosen 6 times (vs. 2x reactive responses)
- Decisions tend to occur in 11am–1pm window
- Multi-project decisions cluster on Wednesdays (pre-filming sync)

**Behavioral patterns:**
- When Smart Home automation succeeds → increased capture rate
- Finance alerts trigger delayed (24–48h) response
- Doc to Learning feedback prompts immediate action (same day)

**Resource flow:**
- Mon: Financial planning, work forecasts
- Tue–Thu: Smart Home dev, Faceless Finance prep
- Fri–Sat: Faceless Finance execution, review
- Sun: Strategic planning, pattern analysis

**Insights:**
- Your decision capacity peaks Monday–Wednesday
- Reactive vs. proactive ratio improving (6:2 this week)
- Cross-project synergies emerging on Wednesdays

**Next week suggestion:**
- Block Tuesday–Thursday mornings for Smart Home + Faceless Finance (aligned automation)
- Reserve Monday for finance + strategic decisions
- Sunday evening for weekly synthesis
```

---

## Implementation

### Option A: n8n Scheduled Workflow (Recommended)
```
Trigger: Cron (Monday 8am)
├─ Read: JARVIS/Inbox/ (captures from last 7 days)
├─ Read: JARVIS/actions/ or similar (actions log)
├─ Group: By timestamp, project, action type
├─ Claude Opus: Detect patterns + generate insights
├─ Build: Markdown report with timing, behavioral, decision patterns
└─ Write: Claude Memory/patterns.md (append new week's section)
```

### Option B: Obsidian Templater Script
```javascript
// Templater script (command or hotkey)
// Reads vault captures and analyzes timing/frequency
// Generates pattern markdown
const captures = await app.vault.adapter.read(...);
const now = new Date();
const weekStart = getMonday(now);
// ... pattern detection + markdown ...
```

### Option C: Manual (You detect patterns)
- Open this template every Monday at 8am
- Review captures and actions from last week
- Write down observed patterns
- Save to `Claude Memory/patterns.md`

---

## Template Structure

```markdown
# Patterns Detected — Week of YYYY-MM-DD

## Capture Timing
- **Peak:** [When captures cluster]
- **Trough:** [When captures drop]
- **Volume:** [Total this week vs. baseline]

## Action Patterns
- **[Project 1]:** [Frequency/timing]
- **[Project 2]:** [Frequency/timing]
- **[Project 3]:** [Frequency/timing]

## Decision Patterns
- [Pattern 1]: [When/how often it occurs]
- [Pattern 2]: [When/how often it occurs]

## Behavioral Patterns
- [Trigger → Response pattern 1]
- [Trigger → Response pattern 2]

## Resource Flow
- **Mon:** [What happens]
- **Tue:** [What happens]
- **Wed:** [What happens]
- **Thu:** [What happens]
- **Fri:** [What happens]
- **Sat:** [What happens]
- **Sun:** [What happens]

## Insights
- [What this pattern suggests about your decision-making]
- [How this differs from last week]
- [Opportunity for next week]

## Next Week Suggestion
- [Action based on patterns]

---
*Generated Monday at 8:00 AM. Next pattern scan: next Monday at 8:00 AM.*
```

---

## Next Steps

1. Decide: n8n workflow vs. Templater vs. manual
2. If n8n: Configure cron (Mondays 8am) and Claude Opus pattern analysis
3. Test: Analyze last week manually and generate one pattern report
4. Iterate: Refine pattern detection criteria based on signal-to-noise

**First run:** 2026-07-07 @ 8:00 AM (next Monday)
