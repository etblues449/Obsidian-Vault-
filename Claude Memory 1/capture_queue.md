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

## 3. Newer chats ✅ — imported via 2026-05-08 export

105 total conversations now in vault (95–105 added 2026-05-09):

- [x] 095 — Phone file storage location (2026-05-01)
- [x] 096 — Syncing Claude apps with Obsidian vault (2026-05-01, 136 msgs) ⭐
- [x] 097 — Organizing Obsidian vault with project structure (2026-05-04, 202 msgs) ⭐
- [x] 098 — Recurring pop-up nuisance (2026-05-04)
- [x] 099 — Setting up Obsidian vault folder structure (2026-05-04)
- [x] 100 — Debugging code and optimization tips (2026-05-06)
- [x] 101 — Using Claude on Android devices (2026-05-07)
- [x] 102 — Samsung TV configuration through home assistant (2026-05-07, 172 msgs) ⭐
- [x] 103 — Screen fill ratio optimization (2026-05-07)
- [x] 104 — Free private servers in Roblox: worth the cost (2026-05-08)
- [x] 105 — Building a custom skill together (2026-05-08)

**Note:** All conversations from the original screenshot-confirmed list (Smart Home, Faceless Financial, Code, Studying, Debt, skills, Notebook lm) were already included in the 94-conversation May 1 export. The May 8 export added 11 newer ones above.

**Next export:** run again periodically to pick up any new chats.

## 4. Account-level memory ✅

Done — captured 2026-05-01, updated 2026-05-09 to [claude_ai_account_memory.md](claude_ai_account_memory.md).

**What changed in the memory (2026-05-08 update):** Added Executive Director / work context, smart home project, "top of mind" section covering Claude Code setup + Work PC Obsidian sync (rclone still outstanding), and a brief history section. Also added explicit Claude Code working instructions (read project _index.md first, one step at a time, be concise, etc.).

## 5. Security follow-ups

- [x] Fly.io org token revoked (2026-05-01).
- [ ] Reissue Fly.io token if still needed; store in password manager — never in Claude.ai project Instructions.
- [ ] Audit other Claude.ai projects for any other secrets in Instructions or knowledge files.
