---
type: decision-journal
source: jarvis
---

# 📋 Decision Journal

Track major decisions, reasoning, and outcomes. Review quarterly to learn from past choices.

---

## Template: Decision Entry

Use this format when capturing a decision:

```
**Decision:** [What are you deciding?]

**Date:** [Today]

**Options considered:**
1. [Option A] — pros/cons
2. [Option B] — pros/cons  
3. [Option C] — pros/cons

**Decision made:** [Which option + key reason]

**Expected outcome:** [What should happen if this is right?]

**Review date:** [1 week / 1 month / 3 months]

**Notes:** [Context, constraints, who else is involved]
```

---

## 🎯 Active Decisions

### Smart Home Architecture (2026-06-15)
- **Decision:** Use HA Green + Obsidian (not Termux) as brain
- **Options:** Termux → n8n → JARVIS (old), HA only, Obsidian-native (chosen)
- **Reasoning:** Obsidian is single source of truth, native Obsidian API, mobile-first
- **Status:** Implemented, working
- **Review:** June 30

### Faceless Finance Platform (2026-06-10)
- **Decision:** YouTube vs. TikTok vs. Multi-platform
- **Options:** YouTube only (chosen), TikTok + YouTube, platform-agnostic CMS
- **Reasoning:** CA credentials require YouTube, better for long-form financial content
- **Status:** Channel live, first videos in progress
- **Review:** July 10 (after 3 videos)

### Doc to Learning MVP (2026-06-01)
- **Decision:** Claude API vs. Fine-tuned Claude vs. Opensource LLM
- **Options:** Claude API (chosen), Fine-tune, Opensource
- **Reasoning:** Claude API fastest MVP, most capable, no infrastructure cost
- **Status:** Design phase
- **Review:** July 1 (end of sprint 1)

---

## 📊 Decision Review (Quarterly)

```dataview
TABLE WITHOUT ID
  link(file.link, Decision) AS "Decision",
  "Review date" AS "Due",
  Status AS "Status"
FROM "JARVIS/Decision Journal"
WHERE type = "decision"
SORT "Review date" DESC
```

---

## ✅ Completed Decisions (Outcomes)

### Retire Termux + n8n Setup (2026-06-15)
- **Original:** Complex multi-service workflow
- **Decision:** Archive Termux, move to Obsidian-native
- **Outcome:** ✅ Faster development, cleaner architecture, mobile-native
- **Lesson:** Single source of truth (Obsidian) > distributed services

---

## 💭 Decision-Making Framework

When you're deciding on something major, ask:

1. **What are my real constraints?** (time, money, complexity, maintainability)
2. **What's the simplest option that solves the problem?**
3. **What could go wrong with each option?**
4. **Which decision is easiest to reverse if it's wrong?**
5. **When will I review this decision to see if it worked?**

---

**Tip:** Capture decisions immediately when captured to JARVIS as type: `decision`. Review quarterly to learn patterns in your decision-making.
