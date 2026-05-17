# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

This is **Jelly Bean's Obsidian vault** — a personal knowledge base and memory system, not a software project. It contains:

- **`Claude Memory/`** — structured memory files synced with Claude.ai: project briefs, conversation exports, account snapshots, and custom instruction captures
- **`.claudian/`** — settings for the Claudian Obsidian plugin (Claude AI assistant embedded in Obsidian)
- **`.mcp.json`** — MCP server config (currently: Google Stitch for Veo 3 video generation)
- **`scripts/`** — standalone Python utilities (e.g. `forecast_tool.py`)
- **`Work/`** — work-related notes and guides

There are no build steps, test suites, or package managers for this repo itself.

## Memory File Conventions

Files under `Claude Memory/` follow a consistent structure:

- **`MEMORY.md`** — top-level index; update this when adding new memory files
- **`Profile/user_profile.md`** — who Jelly Bean is and their active context
- **`Projects/<name>/_index.md`** — one-page project status + next actions
- **`Instructions/project_<name>_instructions.md`** — verbatim Custom Instructions from each Claude.ai project
- **`Instructions/shared_claude_md_instructions.md`** — the CLAUDE.md block shared across most Claude.ai projects
- **`conversations/`** — exported Claude.ai chat history (numbered, dated, slugged)
- **`Account/`** — Claude.ai account-level snapshots and capture queue

When updating memory, always update `MEMORY.md` to reflect new files added.

## Active Projects (summary)

| Project | Repo | Status |
|---|---|---|
| Faceless Finance | `etblues449/Faceless-Finance` | Active — Wed/Fri/Sun posting cadence |
| Smart Home (HA Green + ESP32) | n/a | Upstairs BLE/radar contention unresolved |
| Doc to Learning | n/a | Single-file HTML, Anthropic API |
| App (Expo RN + FastAPI) | `etblues449/App` | Main app repo |

Full detail for each project is in `Claude Memory/Projects/<name>/`.

## MCP / Video Pipeline

`.mcp.json` configures the **Google Stitch MCP** (`stitch.googleapis.com/mcp`), which routes to **Veo 3** for cinematic video generation. Key facts for working with this pipeline:

- Veo 3 generates **8-second clips per scene** — a 30s video needs ~4 scenes
- Scene prompts must include explicit audio direction or Veo renders silently
- Storyboard prompts must impose a word-count limit per scene (~25–30 words) or the orchestrator collapses all narration into a single scene
- The Google API key in `.mcp.json` should be rotated and stored in a password manager — not committed here

## Git Behaviour

- Branch convention: `claude/<task-slug>` — never push directly to `master`
- Always create a draft PR after pushing a new branch
- The vault is synced via Remotely Save plugin — avoid large binary commits

## Capture Queue

`Claude Memory/Account/capture_queue.md` tracks what still needs to be manually copied from Claude.ai into the vault (artifact source code, newer chat exports, duplicate project resolution). Check it before assuming memory is complete.

## Security Notes

- A Fly.io org token was present in `Instructions/shared_claude_md_instructions.md` — it was **revoked 2026-05-01** and redacted. Do not restore it.
- The Google Stitch API key in `.mcp.json` and `.claudian/claudian-settings.json` should be rotated — flag this to the user if it appears in plaintext.
- 170 knowledge files in the Claude.ai Debt project have not been audited for secrets — do not pull them into this vault until audited.
