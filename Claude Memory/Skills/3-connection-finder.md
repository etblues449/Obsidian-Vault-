# Connection Finder Skill

**Trigger:** Weekly (Sunday, 2:00 PM)  
**Input:** All vault notes + recent captures  
**Output:** Link graph + unexpected connections  
**Status:** ⏳ Template (ready to implement via n8n or Templater)

---

## What It Does

Runs every Sunday at 2pm. Scans your entire vault for:
- Notes that should link but don't
- Bridges between projects (same theme in Smart Home AND Faceless Finance?)
- Captures that connect to past decisions
- Missing patterns (e.g., "financial blocker → postponed project")

Generates a **connection report** (5-10 min read):
```
## Connections Found — 2026-07-07

**Surprising links:**
- Smart Home alarm → Faceless Finance recording schedule (both need phone-free mornings)
- Doc to Learning session → Work forecast adjustment (revenue model similarity)
- JARVIS capture rate → Pattern: high on Thursdays (decision fatigue link?)

**Project bridges:**
- Idea in Smart Home could accelerate Faceless Finance (automation skills overlap)
- Belief about "time blocking" appears in 3 projects — harvest into core principle

**Missing connections:**
- Smart Home expansion hasn't consulted Work's device asset list
- Belief #12 ("systems compound") relevant to Faceless Finance but not linked

**Suggests:**
- Create `Projects/System Architecture/_index.md` to cross-link all automation
- Link `Beliefs/12-compounding.md` into Faceless Finance roadmap
```

---

## Implementation

### Option A: n8n Scheduled Workflow (Recommended)
```
Trigger: Cron (Sunday 2pm)
├─ Read: All notes recursively (vault root)
├─ Parse: Extract links and backlinks from markdown
├─ Read: Recent captures (last 7 days)
├─ Claude Opus: Analyze connections + suggest bridges
├─ Build: Markdown report with surprises + suggestions
└─ Write: Claude Memory/connections/YYYY-MM-DD.md
```

### Option B: Obsidian Templater + Obsidian Graph
```javascript
// Templater script (command or hotkey)
// Uses Obsidian's graph API to extract connections
// Generates report from graph nodes + edges
const graph = app.vault.getUnresolvedLinks(); // or similar
const today = new Date().toISOString().split('T')[0];
// ... analysis + markdown output ...
```

### Option C: Local Templater Script (Manual)
- Open connection template
- Manually review recent captures
- List surprising links observed
- Save to `Claude Memory/connections/YYYY-MM-DD.md`

---

## Template Structure

```markdown
# Connections Found — YYYY-MM-DD

## Surprising Links
- [Link 1]: [Why this matters]
- [Link 2]: [Why this matters]

## Project Bridges
- [Bridge 1]: [Overlap + opportunity]
- [Bridge 2]: [Overlap + opportunity]

## Missing Connections
- [Gap 1]: [Why this should connect]
- [Gap 2]: [Why this should connect]

## Suggested Actions
1. [Action based on findings]
2. [Action based on findings]
3. [Action based on findings]

---
*Generated Sunday at 2:00 PM. Next connection scan: next Sunday at 2:00 PM.*
```

---

## Next Steps

1. Decide: n8n workflow vs. Templater vs. manual
2. If n8n: Configure cron trigger (Sundays 2pm) and Claude Opus call
3. Test: Generate one connection report manually
4. Iterate: Adjust connection criteria based on signal-to-noise ratio

**First run:** 2026-07-06 @ 2:00 PM (next Sunday)
