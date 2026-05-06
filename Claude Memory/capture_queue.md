---
name: Capture queue
description: What's still missing from Claude.ai and how to feed it in
type: project
---

# Capture queue — Claude.ai → vault

Tick items as they're pasted in.

## 1. Project Instructions (system prompts) — 12 projects

- [x] **Smart Home** → [project_smart_home_instructions.md](project_smart_home_instructions.md) — full text captured 2026-05-01 (Fly.io token redacted)
- [x] **skills** → [project_skills_instructions.md](project_skills_instructions.md) — short one-liner captured
- [x] **Studying** → [project_studying_instructions.md](project_studying_instructions.md) — uses [shared_claude_md_instructions.md](shared_claude_md_instructions.md)
- [x] **Code** (Claude Code + OpenRouter) → [project_code_instructions.md](project_code_instructions.md) — uses shared CLAUDE.md
- [x] **Faceless Financial And Investment Content** → [project_faceless_financial_instructions.md](project_faceless_financial_instructions.md) — uses shared CLAUDE.md
- [x] **Notebook lm** → [project_notebook_lm_instructions.md](project_notebook_lm_instructions.md) — uses shared CLAUDE.md
- [ ] **Debt** → [project_debt_instructions.md](project_debt_instructions.md) — only first line visible ("Here's a clear, robust prompt..."). Paste full text to fill.
- [ ] **Select Website** → no screenshot yet → [project_select_website_instructions.md](project_select_website_instructions.md)
- [ ] **Linux Pc On Android** → no screenshot yet → [project_linux_pc_on_android_instructions.md](project_linux_pc_on_android_instructions.md)
- [ ] **Claude Code** (one of two) → no screenshot yet → [project_claude_code_instructions.md](project_claude_code_instructions.md)
- [ ] **Claude Code (duplicate)** → decide: delete on Claude.ai or keep separately
- [ ] **How to use Claude** (example project) → likely skip; Anthropic boilerplate

**Confirm:** is Debt's full Custom Instructions text different from the shared CLAUDE.md? The visible first line ("Here's a clear, robust prompt...") suggests yes.

**Confirm:** Notebook lm's project memory text differs from the account-level Faceless-Finance memory — it's about web-based learning tools / Cost Management. Is the Memory really per-project there, or is it overriding the account memory only inside that project?

## 2. Artifact source code

For each artifact → open on Claude.ai → copy contents → paste here. I'll write to the matching file.

- [ ] FinCast Studio v2 — Rebuilt → `artifacts/fincast_studio_v2.html` (or whatever language)
- [ ] FinCast – Finance Channel App ×3 → `artifacts/fincast_finance_channel_v1.*`, `_v2`, `_v3` (the published one is the dashboard with 1,420 / 7,000 / 2 metrics)
- [ ] src/extension.ts → `artifacts/claude_ai_assistant_vscode/extension.ts`
- [ ] src/chatPanel.ts → `artifacts/claude_ai_assistant_vscode/chatPanel.ts`
- [ ] src/claudeClient.ts → `artifacts/claude_ai_assistant_vscode/claudeClient.ts`
- [ ] tsconfig.json → `artifacts/claude_ai_assistant_vscode/tsconfig.json`
- [ ] package.json → `artifacts/claude_ai_assistant_vscode/package.json`
- [ ] Podcastfy: Complete Setup Guide for Windows and Android → `artifacts/podcastfy_setup_guide.md`
- [ ] `doc_learning_app_docs.docx` (Notebook lm project, 143 lines) → `artifacts/doc_learning_app_docs.md`

## 3. Newer chats not in the 94-conversation export

The export ends ~2026-03-24. Confirmed newer (from screenshots):

**Smart Home** (~17 newer chats):
- [ ] 26 April new HA
- [ ] FULL Home assistant green not appearing in app ⭐
- [ ] Lounge presence sensor
- [ ] Home Assistant system diagnostic ⭐
- [ ] Home assistant diagnostic and setup ⭐
- [ ] Upstairs Sensor config (22 Apr)
- [ ] Adding SmartThings sensor to lounge automations (22 Apr)
- [ ] Hardware build list with components (21 Apr)
- [ ] NAS and Home Assistant credentials (21 Apr)
- [ ] ESP factory reset and Home Assistant reinstall (21 Apr)
- [ ] Home automation system handover summary (21 Apr)
- [ ] Conversation history unavailable (18 Apr)
- [ ] Automations and apps overview (15 Apr)
- [ ] MQTT IO configuration with YAML (11 Apr)
- [ ] NotebookLM integration continuation (11 Apr)
- [ ] Android Studio on mobile with Gemini (11 Apr)
- [ ] LD2410 radar sensor configuration for bedroom (31 Mar)
- [ ] Bedroom radar configuration / Dashboard setup / ESP32 S3 switch node setup — verify against export, may be duplicates

**Faceless Financial:**
- [ ] Top financial influencer and investment niches (4d)
- [ ] Converting Anthropic courses into video content (4d)

**Code:**
- [ ] OpenRouter SDK import setup (22 Apr)

**Studying:**
- [ ] Import GitHub project files (3d)

**Debt:**
- [ ] Email snippet review (22 Apr)

**skills:**
- [ ] Adding remotion best practices skill (4d)
- [ ] Learning Remotion through video resources (15 Apr)

**Notebook lm:**
- [ ] Product costing and lifecycle cost management (3d)
- [ ] Installing Podcastfy for notebook LM (14 Apr)

**Standalone (sidebar):**
- [ ] I want you to build a persiste… (full title?)
- [ ] Adding Composio MCP integration

**Best path:** re-export Claude.ai data (Settings → Privacy → Export data). When the new ZIP arrives, point me at it and I'll diff against `CONVERSATIONS_INDEX.md` and import only the new ones.

## 4. Account-level memory ✅

Done — captured 2026-05-01 to [claude_ai_account_memory.md](claude_ai_account_memory.md).

## 5. Security follow-ups

- [x] Fly.io org token revoked (2026-05-01).
- [ ] Reissue Fly.io token if still needed; store in password manager — never in Claude.ai project Instructions.
- [ ] Audit other Claude.ai projects for any other secrets in Instructions or knowledge files.
