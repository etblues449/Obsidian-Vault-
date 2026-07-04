# Weekly Synthesis Skill

**Trigger:** Friday 6:00 PM  
**Input:** Week's captures + project progress + decisions  
**Output:** `Claude Memory/synthesis/YYYY-Www.md`  
**Status:** ⏳ Template (ready to implement via n8n or Templater)

---

## What It Does

Runs every Friday at 6pm. Pulls from the week:
- All captures (Monday–Friday)
- Project status updates (from `_index.md` files)
- Decisions made (from `decisions.md` tags)
- Beliefs affected (from `beliefs.md` tags)
- Patterns detected (from `patterns.md` this week)

Synthesizes a **week-in-review** (10–15 min read):

```
## Weekly Synthesis — W27 2026 (Jun 29 – Jul 5)

**Momentum:**
- Smart Home: Automation pipeline live, 3 test captures successful
- Faceless Finance: 2 videos uploaded (Wed/Fri schedule holding), $2.4k run rate
- Doc to Learning: API integration complete, awaiting user feedback

**Decisions:**
- Path 2+3 chosen: Unified backend reconciled, seven skills framework deployed
- Tasker HTTP setup deferred (manual execution working fine)

**Beliefs shifted:**
- "Single-writer guarantee prevents more sync conflicts" — confirmed
- "n8n webhook router is more reliable than desktop-bound Hermes" — confirmed

**Patterns:**
- Weekly captures peak on Thursdays (decision fatigue hypothesis holds)
- Smart Home captures concentrate before Wednesday Faceless Finance shoot
- Finance-related captures cluster on Monday (CFO forecasting day)

**Blockers resolved:**
- Remotely Save corruption cleared (disabled, switched to Obsidian Sync + Git)
- Tasker alarm parameters now encoding correctly

**Next week priorities:**
1. Complete remaining skill implementations (3–7)
2. Deploy Job to Vercel (backend ready)
3. Run first Morning Brief (7am, next Monday)

**Across projects:**
- 3-project sync: Smart Home automation timing affects Faceless upload, Work forecast
- Belief compounding: 12 core beliefs now powering decision-making in all 4 projects
```

---

## Implementation

### Option A: n8n Scheduled Workflow (Recommended)
```
Trigger: Cron (Friday 6pm)
├─ Read: JARVIS/Inbox/ (this week's captures)
├─ Read: Claude Memory/Projects/*/captures/ (project captures)
├─ Read: decisions.md, beliefs.md, patterns.md (this week's changes)
├─ Read: All active project _index.md files
├─ Claude Opus: Synthesize week → momentum/decisions/patterns/blockers
├─ Build: Markdown report with cross-project analysis
└─ Write: Claude Memory/synthesis/YYYY-Www.md
```

### Option B: Obsidian Templater Script
```javascript
// Templater script (command or hotkey)
// Reads markdown files from Obsidian vault
// Generates synthesis from weekly data
const now = new Date();
const weekNumber = getWeekNumber(now); // Week 1-52
const year = now.getFullYear();
const synthPath = `Claude Memory/synthesis/${year}-W${weekNumber}.md`;
// ... template + analysis ...
```

### Option C: Manual (You synthesize weekly)
- Open this template every Friday at 6pm
- Copy from captures, projects, decisions, beliefs, patterns
- Write synthesis narrative
- Save to `Claude Memory/synthesis/YYYY-Www.md`

---

## Template Structure

```markdown
# Weekly Synthesis — YYYY-Www (Start Date – End Date)

## Momentum
- **[Project 1]:** [Key progress this week]
- **[Project 2]:** [Key progress this week]
- **[Project 3]:** [Key progress this week]

## Decisions
- [Decision 1]: [Rationale]
- [Decision 2]: [Rationale]

## Beliefs Shifted
- [Belief]: [New understanding]
- [Belief]: [New understanding]

## Patterns
- [Pattern 1]: [What it means]
- [Pattern 2]: [What it means]

## Blockers Resolved
- [Blocker]: [How it was fixed]

## Next Week Priorities
1. [Priority]
2. [Priority]
3. [Priority]

## Across Projects
- [Cross-project insight 1]
- [Cross-project insight 2]

---
*Generated Friday at 6:00 PM. Next synthesis: next Friday at 6:00 PM.*
```

---

## Next Steps

1. Decide: n8n workflow vs. Templater vs. manual
2. If n8n: Set up cron (Fridays 6pm) and Claude Opus synthesis call
3. Test: Generate one weekly synthesis manually
4. Iterate: Refine synthesis depth based on time investment vs. insight value

**First run:** 2026-07-04 @ 6:00 PM (this Friday)
