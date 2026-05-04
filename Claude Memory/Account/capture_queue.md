---
name: Capture queue
description: What's still missing from Claude.ai and how to feed it in
type: account
last_reviewed: 2026-05-04
---

# Capture queue — Claude.ai → vault

Tick items as they're pasted in.

## 1. Project Instructions — 12 projects

- [x] **Smart Home** → [[Instructions/project_smart_home_instructions]]
- [x] **skills** → [[Instructions/project_skills_instructions]]
- [x] **Studying** → [[Instructions/project_studying_instructions]]
- [x] **Code** → [[Instructions/project_code_instructions]]
- [x] **Faceless Financial** → [[Instructions/project_faceless_financial_instructions]]
- [x] **Notebook lm** → [[Instructions/project_notebook_lm_instructions]]
- [x] **Debt** → [[Instructions/project_debt_instructions]] *(full credit-card analysis prompt captured; 170 knowledge files noted)*
- [x] **Select Website** → [[Instructions/project_select_website_instructions]] *(stub created 2026-05-04 — paste instructions text from Claude.ai)*
- [x] **Linux Pc On Android** → [[Instructions/project_linux_pc_on_android_instructions]] *(stub created 2026-05-04 — paste instructions text from Claude.ai)*
- [x] **Claude Code** → [[Instructions/project_claude_code_instructions]] *(stub created 2026-05-04 — paste instructions text from Claude.ai; see duplicate note below)*
- [ ] **Claude Code (duplicate)** → ⚠️ **USER ACTION:** Log in to Claude.ai and decide — delete duplicate or rename it. If it has unique instructions/knowledge, paste into a new `project_claude_code_duplicate_instructions.md` file.
- [x] **How to use Claude** → skipped (Anthropic boilerplate, no value to capture)

## 2. Artifact source code

> ⚠️ **USER ACTION required for all items below.** These live only inside Claude.ai artifacts and must be copied out manually:
> Claude.ai → Artifacts sidebar → open each artifact → copy source → save to vault.

- [ ] **FinCast Studio v2 — Rebuilt** → save to `Projects/Faceless Finance/fincast_studio_v2.html` (or `.js`)
- [ ] **FinCast – Finance Channel App ×3** → save to `Projects/Faceless Finance/` (3 separate files)
- [ ] **VS Code extension** — 5 files to capture:
  - [ ] `src/extension.ts`
  - [ ] `src/chatPanel.ts`
  - [ ] `src/claudeClient.ts`
  - [ ] `tsconfig.json`
  - [ ] `package.json`
  - Save to: `Projects/Other Workspaces/claude-ai-assistant-vscode/`
- [ ] **Podcastfy: Complete Setup Guide** → save to `Projects/Other Workspaces/podcastfy_setup_guide.md`
- [ ] **doc_learning_app_docs.docx** (Notebook lm project, 143 lines) → save to `Projects/Doc to Learning/`

## 3. Newer chats not in the 94-conversation export

> ⚠️ **USER ACTION:** Re-export Claude.ai data.
> Claude.ai → Settings → Data privacy controls → Export data
> Import new conversations into `conversations/` once downloaded.

Export ends ~2026-03-24. Newer chats to capture:

**Smart Home (~17 newer chats):** 26 April new HA, FULL Home assistant green not appearing, Lounge presence sensor, Home Assistant system diagnostic, Upstairs Sensor config, NAS credentials, ESP factory reset, and more.

**Other projects:** Top financial influencer niches, OpenRouter SDK import setup, Email snippet review, Adding remotion skill, Product costing lifecycle, and more.

## 4. Security follow-ups

- [x] Fly.io org token revoked (2026-05-01)
- [x] Audit all captured instruction files for secrets → **Clean.** Fly.io token correctly redacted in [[Instructions/shared_claude_md_instructions]]. No other secrets found. *(audited 2026-05-04)*
- [ ] **Reissue Fly.io token** (if still needed for `etblues449/App` or Termux agent) → store in password manager only, never in project instructions
- [ ] **Audit Claude.ai project knowledge files** (170 files in Debt project + others) for secrets — cannot be done remotely; requires manual review on Claude.ai
