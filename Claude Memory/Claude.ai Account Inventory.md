---
source: Claude.ai web account (Jelly Bean)
captured: 2026-05-01
captured_from: screenshots of Projects, Artifacts, and Chat sidebar
---

# Claude.ai Account Inventory

Snapshot of what exists in the Claude.ai web account, captured from screenshots. Full project instructions, artifact source, and chat transcripts are NOT here unless they came from the data export — paste in as needed.

Cross-reference: full text of 94 chats up to ~2026-03-24 lives in [conversations/](conversations/) (see [CONVERSATIONS_INDEX.md](CONVERSATIONS_INDEX.md)).

---

## Account-level Memory

Claude.ai surfaces a single Memory blob inside *every* project — same content across all 12. Captured verbatim in [claude_ai_account_memory.md](claude_ai_account_memory.md). Last updated in Claude.ai ~2026-04-20.

Implication: when looking at any project on Claude.ai, that same Faceless-Finance / CA memory is in context, regardless of project topic.

---

## Projects (12)

| Project | Description (as shown) | Updated |
|---|---|---|
| Notebook lm | Instructions ref CLAUDE.md ("guidance to Claude Code"); file: `doc_learning_app_docs.docx` (143 lines); chats: "Product costing and lifecycle cost management" (2d), "Installing Podcastfy for notebook LM" (16d); 1% capacity used | 3 days ago |
| Select Website |  | 3 days ago |
| Linux Pc On Android |  | 3 days ago |
| Studying |  | 3 days ago |
| Code | Claude Code + OpenRouter | 3 days ago |
| Smart Home | I have different smart appliances that I want to be able to talk to eachother | 3 days ago |
| skills |  | 3 days ago |
| Faceless Financial And Investment Content |  | 3 days ago |
| Claude Code | Code | 3 days ago |
| Claude Code (duplicate) | Code | 3 days ago |
| Debt | Marital debt | 16 days ago |
| How to use Claude (example project) | An example project that also doubles as a how-to guide for using Claude. Chat with it to learn more about how to get the most out of chatting with Claude! | 1 month ago |

**Flag:** Two "Claude Code" projects with the same name and same description — likely an accidental duplicate to clean up.

Detail notes already exist for:
- [Smart Home](project_smart_home.md)
- [Faceless Financial](project_faceless_finance.md)
- [Notebook lm / Doc to Learning](project_doc_to_learning.md)
- [Other workspaces](project_other_workspaces.md) — covers Debt, Studying, Linux PC on Android, Select Website, Code/skills

---

## Artifacts (visible in screenshot)

| Artifact | Last edited | Notes |
|---|---|---|
| FinCast Studio v2 — Rebuilt | 6 days ago | (preview blank in screenshot) |
| FinCast – Finance Channel App | 6 days ago | |
| FinCast – Finance Channel App | 6 days ago | |
| FinCast – Finance Channel App | 8 days ago | Published; dashboard with 1,420 / 7,000 / 2 metrics |
| src/extension.ts | 16 days ago | VS Code extension entry point — `ChatViewProvider`, `resetClient` |
| src/chatPanel.ts | 16 days ago | `ChatViewProvider` implementing `vscode.WebviewViewProvider` |
| src/claudeClient.ts | 16 days ago | Anthropic SDK client; `MessageRole = "user" \| "assistant"` |
| tsconfig.json | 16 days ago | Node16 / ES2020 / outDir ./out |
| package.json | 16 days ago | `claude-ai-assistant` v0.0.1, vscode ^1.85.0, AI/Other categories |
| tsconfig.json (dup) | 16 days ago | |
| package.json (dup) | 16 days ago | |
| Podcastfy: Complete Setup Guide for Windows and Android | (date cut off) | Open-source Python tool: websites/PDFs/YouTube → AI podcast-style audio |

**Inferred project:** the four `src/*` + `tsconfig.json` + `package.json` artifacts together form the **`claude-ai-assistant` VS Code extension** (referenced in user_profile.md). FinCast appears to be a separate published artifact related to Faceless Finance work.

---

## Chat sidebar — snapshot

### Pinned

1. Home Assistant system diagnostic
2. Installing OpenRouter SDK
3. Home assistant diagnostic and setup
4. 26 April 26 New HA
5. FULL Home assistant green not appearing
6. I want you to build a persiste… (truncated)
7. Faceless Financial And Investment Co… (truncated — project link, not chat)
8. Studying (project link)
9. Debt (project link)
10. Smart Home (project link)

### Recents (visible)

- Untitled
- Starting from scratch
- Import GitHub project files
- ESP32 S3 switch node setup
- Product costing and lifecycle cost manage…
- Bedroom radar configuration
- Dashboard setup
- Top financial influencer and investment ni…
- Adding remotion best practices skill
- Converting Anthropic courses into video c…
- Personalized certification recommendation…
- Linking project folders to code
- SSH configuration setup
- Samsung TV Home Assistant setup guide
- Building a custom skill together
- Cloning the superpowers repository
- Easy guide needed
- How compound interest works
- Cloning Claude-Github repository
- Adding Composio MCP integration

### Coverage gap

The 94-conversation export imported into [conversations/](conversations/) goes up to ~2026-03-24. Chats that look newer than that and are NOT in the export:

- 26 April 26 New HA
- FULL Home assistant green not appearing
- Home Assistant system diagnostic (may be a re-pin of an existing one)
- Installing OpenRouter SDK (may be an older one — check index)
- "I want you to build a persiste…"
- Adding Composio MCP integration

**To capture these:** export Claude.ai data again from Settings → Data privacy controls → Export data, then re-run the import into `conversations/`.

### Already imported

The Recents list overlaps heavily with the 94 imported chats — Bedroom radar configuration, ESP32 S3 switch node setup, Product costing and lifecycle cost management, Dashboard setup, Samsung TV Home Assistant setup guide, etc. all appear in [CONVERSATIONS_INDEX.md](CONVERSATIONS_INDEX.md).
