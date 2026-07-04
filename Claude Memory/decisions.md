# Decision Log — Operating Decisions

*Maintained by Skill 7 (Decision Intelligence). Captures tagged `#decision` route here; review monthly.*
*Last review: 2026-07-04 (seeded)*

---

## Decision #1: Unified Backend Architecture
**Date:** 2026-06-29
**Context:** JARVIS (mobile) and Job (web) were separate systems solving the same problem
**Options Considered:**
1. Keep separate, sync via vault
2. Merge into single unified backend with dual interfaces
3. Build custom glue layer

**Chosen:** Option 2 (Unified Backend)
**Rationale:** Single brain, dual interface = consistent behaviour; enables intent routing (action vs conversation vs both)
**Outcome:** ✅ SUCCESSFUL (unified-backend.js implemented)
**Reversibility:** LOW · **Impact:** HIGH

---

## Decision #2: Path 2+3 — Reconcile carousel + produce artifacts
**Date:** 2026-06-29
**Context:** 25-slide carousel playbook assumed Mac + Claude Desktop + Hermes; actual setup is phone-first
**Chosen:** Strip desktop assumptions, keep the seven-skill active vault model, implement via n8n + Templater
**Outcome:** ✅ SUCCESSFUL (all 7 skill templates + n8n workflows shipped)
**Reversibility:** MODERATE · **Impact:** HIGH

---

## Decision #3: Single-writer guarantee, master branch only
**Date:** 2026-06-12
**Context:** Remotely Save created sync conflicts and duplicate vault folders
**Chosen:** Only n8n writes captures; Obsidian Sync + Git as sync substrate; no second writer, no Hermes, no Claude Desktop MCP
**Outcome:** ✅ SUCCESSFUL (zero conflicts since)
**Reversibility:** HIGH · **Impact:** HIGH

---

## Decision #4: Defer Tasker HTTP integration
**Date:** 2026-06-29
**Context:** Tasker HTTP server (localhost:1337) not responding despite settings enabled
**Chosen:** Manual Tasker task execution for now; revisit after skills framework is live
**Outcome:** 🔄 PENDING (revisit)
**Reversibility:** HIGH · **Impact:** LOW

---

## Decision #5: Deploy skills as n8n scheduled workflows
**Date:** 2026-07-04
**Context:** Skills 1, 3, 4, 6 need automation; options were n8n cron, Templater, or manual
**Chosen:** n8n cloud workflows (already hosts the capture router; runs without any device on)
**Outcome:** 🔄 PENDING (first runs this week)
**Reversibility:** HIGH · **Impact:** HIGH
