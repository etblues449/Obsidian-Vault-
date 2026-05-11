---
name: Claude.ai account-level memory
description: The single Memory blob Claude.ai surfaces inside every project — same content shown across all 12 projects, not per-project
type: project
source: Claude.ai web account
captured: 2026-05-01
last_updated: 2026-05-08
visibility: "Only you"
---

# Claude.ai account-level memory

**Important:** Jelly Bean confirmed this same Memory text is displayed inside *every* Claude.ai project — it's account-level, not per-project. The content is Faceless-Finance-flavoured because that's the dominant purpose driving the account.

## Verbatim memory text (updated 2026-05-08)

**Work context**

Jelly Bean is an Executive Director who reports to Nick Horton. Jelly Bean also runs a CA-credentialed faceless YouTube channel focused on personal finance and investing (Faceless Finance), posting Wed/Fri/Sun with Wednesday 4PM as the priority slot; long-form content is repurposed into Shorts.

**Personal context**

Jelly Bean has an active smart home project built on Home Assistant Green with ESP32 nodes. Outside of work and content creation, interests include Linux customization, home automation, and hands-on technical tinkering.

**Top of mind**

Claude Code setup and tooling integration is actively in progress — including installation via native installer and npm, VS Code extension development, and MCP server configuration. The Work PC Obsidian sync setup is an outstanding task: install rclone, configure Google Drive bisync to `C:\Users\[WorkUsername]\Documents\ObsidianVault`, copy `sync-vault.bat` from home PC, and set up Task Scheduler (home PC sync is already working). Smart home work continues with BLE/UART contention on the upstairs nodes still to resolve.

**Brief history**

*Recent months*

Jelly Bean built a full Claude AI assistant VS Code extension from scratch using the Anthropic SDK with streaming, TypeScript, and VS Code's SecretStorage — covering code explanation, review, generation, and chat. Explored MCP server integrations including Ruflo across Claude Code CLI, Claude Desktop, and Claude.ai, learning how each surface handles MCP connections differently. Worked through Claude Code configuration issues on Windows, including removing OpenRouter/Gemini proxy settings hardcoded in VS Code's `settings.json`, fixing a non-standard Git Bash path (installed via Scoop), and reinstalling Claude Code cleanly via winget. Also investigated ESPHome OTA upload failures on an ESP32 device due to mDNS resolution issues (`cctv-.local`), with structured troubleshooting covering static IP fallback and USB flashing. Reviewed a GitLab dotfiles repository covering multiple Linux distros and BSDs, and troubleshot Samsung OTG connectivity — suggesting interest in Linux configuration and Android devices. Assisted with organizing financial statement data and reviewing legal correspondence for outstanding items, in what appears to be a support or administrative capacity.

*Long-term background*

Jelly Bean's GitHub handle is etblues449-bit; email etblues449@gmail.com has appeared in technical contexts. Long-standing interest in automation, self-hosted tooling, and hands-on configuration work across platforms.

---

**Other instructions (from Claude.ai memory)**

- Always read the relevant `Claude Memory/Projects/[Project]/_index.md` from Jelly Bean's Obsidian vault first when working on a project.
- When a task has multiple steps, complete one step at a time and wait for confirmation before proceeding.
- Be concise — give just the answer, code, or YAML with minimal explanation unless asked. No preamble or postamble.
- For automation/spreadsheet work, build in a new separate file. Never embed in existing forecast files.
- Ask before assuming — if context is unclear, ask one focused question rather than guessing.

---

## How this maps to existing notes

This is account-level memory that appears in every Claude.ai project. Updated from the 2026-05-08 export — note the memory has significantly expanded beyond the original Faceless Finance focus to cover work context (Executive Director role), smart home, and Claude Code tooling.

## Implication for Claude Code

When working in any context where this memory would be loaded by Claude.ai, assume:
- Jelly Bean is an Executive Director (work) AND CA / faceless-finance creator (side)
- Wed 4PM posting slot is a hard scheduling anchor
- Smart home BLE/UART upstairs contention is still open
- Work PC Obsidian sync (rclone + Google Drive bisync) is outstanding
