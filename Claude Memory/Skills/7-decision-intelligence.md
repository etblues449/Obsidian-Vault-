# Decision Intelligence Skill

**Trigger:** Manual (decisions logged via `#decision` tag)  
**Input:** Capture notes tagged `#decision`, manual decision entries  
**Output:** Tracked in `Claude Memory/decisions.md`  
**Status:** ⏳ Template (ready to implement via capture tagger + manual updates)

---

## What It Does

This skill tracks every significant decision you make. A decision is a choice point where you picked one path over alternatives. Examples:

- `#decision Use unified backend instead of separate JARVIS + Job systems`
- `#decision Defer Tasker HTTP integration, use manual execution for now`
- `#decision Master branch only, no multiple writers, disable Remotely Save`
- `#decision Path 2+3: Reconcile carousel to phone-first setup + produce artifacts`

The Decision Intelligence system:
1. **Captures** tagged with `#decision` are auto-routed to decisions.md
2. **Manual entries** added when making major choices
3. **Tracks:** Decision statement + date + context + options considered + outcome
4. **Analyzes:** Decision patterns (reactive vs. proactive? speed? reversibility?)

Example decisions.md entry:

```markdown
## Decision #47: Unified Backend Architecture
**Date:** 2026-06-29  
**Context:** JARVIS (mobile) and Job (web) were separate systems
**Options Considered:**
1. Keep separate, sync via vault
2. Merge into single unified backend with dual interfaces
3. Build custom glue layer

**Chosen:** Option 2 (Unified Backend)  
**Rationale:**
- Single brain, dual interface = consistent behavior
- Eliminates sync complexity between systems
- Enables smart intent routing (action vs. conversation vs. both)

**Key Constraints:**
- Phone-first architecture (Fold 7)
- Single-writer guarantee (n8n only)
- No Mac/desktop dependencies

**Outcome:** ✅ SUCCESSFUL (backend implemented, both JARVIS + Job now call it)

**Reversibility:** LOW (would require significant refactoring, but possible)
**Speed:** MODERATE (1 session to design + implement)
**Impact:** HIGH (improves consistency across interfaces)

**Lessons Learned:**
- Unified routing is cleaner than separate systems
- Intent detection is more powerful than simple task extraction
- Dual LLM strategy (Groq + Claude) works well for mixed action/conversation
```

---

## Capture Integration

In any capture, add `#decision` tag:
```
Text: "I'm choosing to keep Tasker HTTP off for now because 
       the manual workaround is reliable and we're time-constrained. 
       Can revisit after skills framework is done."
Tag: #decision
```

The Capture Processor automatically routes to `Claude Memory/decisions.md`.

---

## Manual Decision Logging

When you make a significant choice:

1. Open `Claude Memory/decisions.md`
2. Add new decision entry:
   ```markdown
   ## Decision #[N]: [Title]
   **Date:** YYYY-MM-DD
   **Context:** [What triggered this decision]
   
   **Options Considered:**
   1. [Option A]
   2. [Option B]
   3. [Option C]
   
   **Chosen:** Option [N]
   **Rationale:** [Why this option]
   
   **Outcome:** [PENDING / ✅ SUCCESSFUL / ❌ FAILED]
   ```
3. Update outcomes over time as decisions play out

---

## Template Structure

```markdown
# Decision Log — Your Operating Decisions

*Last review: YYYY-MM-DD*

## Decision #1: [Title]
**Date:** YYYY-MM-DD  
**Context:** [What prompted this]

**Options Considered:**
1. [Option]
2. [Option]
3. [Option]

**Chosen:** Option [N]  
**Rationale:** [Why]

**Key Constraints:** [Any constraints that limited options]

**Outcome:** ✅ SUCCESSFUL / ❌ FAILED / 🔄 PENDING

**Reversibility:** [HIGH/MODERATE/LOW]  
**Speed:** [FAST/MODERATE/SLOW]  
**Impact:** [HIGH/MODERATE/LOW]

**Lessons Learned:**
- [Insight from decision]

---

## Decision #2: [Title]
...
```

---

## Implementation Options

### Option A: Capture Tagger (Automatic)
When you tag a capture `#decision`, n8n's Capture Processor extracts it and appends to `decisions.md`:
```
Capture → Tag: #decision → Route to decisions.md → Log with metadata
```

### Option B: Manual Entry
Open decisions.md when making major choices:
- Add full context (options, rationale, constraints)
- Update outcome as decision plays out

### Option C: Hybrid
- Captures tagged `#decision` auto-route (Option A)
- Major strategic decisions manually logged with rich context (Option B)

---

## Decision Review Cycle

**Monthly (e.g., first Sunday):**
```
1. Review all decisions from past month
2. Update outcomes: SUCCESSFUL / FAILED / PENDING
3. Extract lessons learned
4. Identify decision patterns (speed, reversibility, impact)
```

**Quarterly (first day of quarter):**
```
1. Review all decisions from past 90 days
2. Which decisions had highest impact?
3. Which decisions would you reverse?
4. What decision patterns are emerging? (e.g., too reactive, too slow, too risky)
```

---

## Next Steps

1. **Choose method:** Capture auto-tag vs. manual vs. hybrid
2. **If auto-tag:** Update n8n Capture Processor to detect `#decision` tag
3. **Create initial decisions.md** with 3–5 recent major decisions (e.g., from this session)
4. **Log first decision:** The unified backend choice (Decision #1)
5. **Monthly review:** First review on 2026-08-03 (first Sunday of August)

**First decision entries:** Log today's session decisions into `Claude Memory/decisions.md`:
1. Unified Backend Architecture (done)
2. Path 2+3: Reconcile carousel + produce artifacts
3. Single-writer guarantee policy (master branch only)
4. Defer Tasker HTTP, use manual execution
5. Seven skills framework deployment plan

---

## Why Track Decisions?

Your decisions shape your vault and your projects. By logging them:
- **You see patterns:** Do you rush or over-analyze?
- **You learn:** Which types of decisions work well?
- **You compound:** Previous decisions inform future ones
- **Claude understands:** When Claude has context (MEMORY.md), it can reference your decision history
