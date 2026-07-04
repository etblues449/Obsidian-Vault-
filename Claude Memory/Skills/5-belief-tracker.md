# Belief Tracker Skill

**Trigger:** Manual (when beliefs shift or tagged in captures)  
**Input:** Capture notes tagged `#belief`, manual belief logging  
**Output:** Tracked in `Claude Memory/beliefs.md`  
**Status:** ⏳ Template (ready to implement via capture tagger + manual updates)

---

## What It Does

This skill runs when you capture a belief update or manually log a belief shift. Beliefs are your operating assumptions — the rules you navigate by. Examples:

- `#belief Single-writer guarantee prevents sync conflicts`
- `#belief Automated systems compound over time`
- `#belief Tasker + n8n is more reliable than desktop-based automation`
- `#belief Time-blocking defends focus better than priority lists`

The Belief Tracker:
1. **Captures** tagged with `#belief` are auto-routed to beliefs.md
2. **Manual entries** added when you shift a core assumption
3. **Tracks:** Belief statement + context + date logged + evidence
4. **Synthesizes:** Monthly belief audit (which beliefs are holding? which have failed?)

Example beliefs.md entry:

```markdown
## Belief #12: Automated systems compound over time
**Logged:** 2026-06-29  
**Evidence:**
- n8n webhook captures → Claude classification → GitHub commit
- Repetition weekly: Connection Finder + Pattern Detector reveal new links
- 4-week observation: Vault intelligence increasing exponentially

**Tests:**
- ✅ One week: 3 unexpected connections found
- ✅ Two weeks: Pattern Detector flagged recurring decision-making gap
- ✅ Four weeks: Synthesis revealed cross-project synergy

**Status:** HOLDING (high confidence)
```

---

## Capture Integration

In any capture, add `#belief` tag:
```
Text: "I notice I'm most creative when I block Monday morning — 
       maybe single-task focus works better than multitasking."
Tag: #belief
```

The Capture Processor automatically routes to `Claude Memory/beliefs.md`.

---

## Manual Belief Logging

When you consciously shift or confirm a belief:

1. Open `Claude Memory/beliefs.md`
2. Add new belief entry:
   ```markdown
   ## Belief #[N]: [Statement]
   **Logged:** YYYY-MM-DD
   **Evidence:**
   - [Observation 1]
   - [Observation 2]
   
   **Status:** NEW (unconfirmed)
   ```
3. As evidence accumulates, update status → HOLDING / SHIFTING / REJECTED

---

## Template Structure

```markdown
# Core Beliefs — Decision Operating System

*Last audit: YYYY-MM-DD*

## Belief #1: [Statement]
**Logged:** YYYY-MM-DD  
**Evidence:**
- [Observation 1]
- [Observation 2]

**Status:** HOLDING / SHIFTING / REJECTED

---

## Belief #2: [Statement]
...
```

---

## Implementation Options

### Option A: Capture Tagger (Automatic)
When you tag a capture `#belief`, n8n's Capture Processor extracts it and appends to `beliefs.md`:
```
Capture → Tag: #belief → Route to beliefs.md → Log with metadata
```

### Option B: Manual Entry
Open beliefs.md whenever you want to log a belief shift:
- Add entry with date, statement, initial evidence
- Update as evidence accumulates

### Option C: Hybrid
- Captures tagged `#belief` auto-route (Option A)
- Major belief shifts manually entered with richer context (Option B)

---

## Belief Audit Cycle

**Monthly (e.g., first Sunday):**
```
1. Review all beliefs from past month
2. Mark status: HOLDING / SHIFTING / REJECTED
3. For SHIFTING beliefs: what evidence contradicts them?
4. For NEW beliefs: ready to promote from experimental?
```

---

## Next Steps

1. **Choose method:** Capture auto-tag vs. manual vs. hybrid
2. **If auto-tag:** Update n8n Capture Processor to detect `#belief` tag
3. **Create initial beliefs.md** with 3–5 core assumptions you already hold
4. **Log first belief:** When a capture or decision shifts your thinking
5. **Monthly audit:** First review on 2026-08-03 (first Sunday of August)

**First belief entry:** Log today's working assumptions into `Claude Memory/beliefs.md`
