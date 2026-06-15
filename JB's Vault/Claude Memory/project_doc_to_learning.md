---
name: Doc to Learning App (Notebook lm project)
description: Single-file HTML app converting uploaded docs to Podcast / Video / Lesson formats via Anthropic API; pre-loaded with Cost Management notes
type: project
originSessionId: 1c29e19b-fa2c-4cb0-b81e-4fd96ed50ef6
---
**What it is:** Single-file HTML application that transforms uploaded documents (PDF/Word, drag-and-drop) into one of three formats — two-host Podcast Script, Video Script, or Interactive Lesson Plan.

**Why:** Built for academic / coursework use. Source material is Cost Management content (product lifecycle, target costing, value analysis, lifecycle costing) — likely tied to ongoing exam prep / studying.

**How to apply:** When the user references the "Doc to Learning App", "Notebook lm" project, or asks about doc-to-learning conversion, the stack and design are fixed (below). Note: Claude inside the artifact UI cannot trigger Generate remotely — the user must click the button themselves.

**Stack:**
- Single-file HTML
- Direct Anthropic API integration (model: `claude-sonnet-4`)
- Drag-and-drop PDF/Word upload, tab-based format selection, copy-to-clipboard, loading/error states

**Design:**
- Editorial aesthetic — DM Serif Display, DM Mono, Instrument Sans
- Warm paper-toned palette: rust, sage, cream
