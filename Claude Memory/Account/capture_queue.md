---
name: Capture queue
description: What's still missing from Claude.ai and how to feed it in
type: account
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
- [ ] **Debt** → [[Instructions/project_debt_instructions]] — only first line captured; paste full text
- [ ] **Select Website** → not yet captured
- [ ] **Linux Pc On Android** → not yet captured
- [ ] **Claude Code** (one of two) → not yet captured
- [ ] **Claude Code (duplicate)** → decide: delete on Claude.ai or keep
- [ ] **How to use Claude** → likely skip (Anthropic boilerplate)

## 2. Artifact source code

- [ ] FinCast Studio v2 — Rebuilt
- [ ] FinCast – Finance Channel App ×3
- [ ] src/extension.ts, chatPanel.ts, claudeClient.ts, tsconfig.json, package.json (VS Code extension)
- [ ] Podcastfy: Complete Setup Guide
- [ ] doc_learning_app_docs.docx (Notebook lm project, 143 lines)

## 3. Newer chats not in the 94-conversation export

Export ends ~2026-03-24. Re-export Claude.ai data (Settings → Privacy → Export data) to capture all newer chats.

**Smart Home (~17 newer chats):** 26 April new HA, FULL Home assistant green not appearing, Lounge presence sensor, Home Assistant system diagnostic, Upstairs Sensor config, NAS credentials, ESP factory reset, and more.

**Other projects:** Top financial influencer niches, OpenRouter SDK import setup, Email snippet review, Adding remotion skill, Product costing lifecycle, and more.

## 4. Security follow-ups

- [x] Fly.io org token revoked (2026-05-01)
- [ ] Reissue Fly.io token if still needed; store in password manager only
- [ ] Audit other projects for secrets in Instructions or knowledge files
