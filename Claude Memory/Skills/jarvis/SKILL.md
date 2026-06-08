---
name: "Jarvis"
description: "Phone-driven capture and routing system that turns spoken or typed input into the right action - file a note in the Obsidian Vault, add a task, trigger a Home Assistant scene, cast to a TV, or push to a Windows PC. Also builds the underlying infrastructure (Obsidian Quick Capture + Tasker + n8n + HA webhooks) following a 5-day rollout. Use when the user prefixes input with 'jarvis', says 'capture this / note this / remind me / file under [project] / turn on / play / cast', mentions setting up the Jarvis or quick-capture system, or when the Obsidian /Inbox/ has items waiting to be processed."
---

# Jarvis

Phone-first, Obsidian-Vault-as-source-of-truth capture and routing system across the user's Samsung Fold 7, Windows PC/laptop, TVs, and Home Assistant Green.

## Two Modes — Pick Automatically

When invoked, decide which mode based on input and vault state:

1. **BUILD mode** — User mentions "set up", "install", "build jarvis", or `Inbox/.jarvis-state.yaml` shows incomplete days. Walk through the 5-day rollout in `resources/roadmap.md`, one day at a time, status-aware.
2. **RUN mode** — User gives an actionable input ("capture X", "note: Y", "remind me", "turn on lounge lights", "play Spotify on TV", "file under smart home") OR `/Inbox/` has unprocessed items. Classify, route, confirm.

Check state first: `bash scripts/status.sh` — tells you which mode to enter.

## Core Loop (RUN mode)

For every input:

1. **Classify** using rules in `resources/classification.md`:
   - Note / idea / journal → Obsidian write
   - Task / reminder → task file with due date
   - HA action (lights, scenes, TV, media) → HA REST call
   - PC/TV push → HA cast service or file drop into synced folder
   - Project-tagged ("under finance", "for smart home") → append to that project's file
2. **Route** to the correct destination (see Project Map below).
3. **Confirm** in one line what you did and where it landed.

Never ask follow-up questions for trivial captures — make a reasonable call and tell the user where it went. Only ask if the input is genuinely ambiguous (e.g., "do that thing").

## Project Map (vault layout — match what already exists)

| Trigger words / topics | Destination file |
|---|---|
| smart home, HA, lights, TV automation, ESPHome, lounge, bedroom node | `Claude Memory/Projects/Smart Home/_inbox.md` (notes) — entity catalog stays in `Claude Memory/project_smart_home.md` (reference only) |
| video idea, faceless finance, thumbnail, script, hook | `Claude Memory/Projects/Faceless Finance/_inbox.md` |
| studying, course, lesson, learning | `Claude Memory/project_studying_instructions.md` |
| debt, payoff, budget | `Claude Memory/project_debt_instructions.md` |
| skill idea, claude skill, plugin | `Claude Memory/project_skills_instructions.md` |
| code, dev task, refactor, bug | `Work/` (right project subfolder) |
| journal, daily, reflection | `Journal/YYYY-MM-DD.md` (create file with date) |
| reminder, todo, task, "remind me" | `Tasks/open.md` (append checkbox row) |
| unclassified / fast dump | `Inbox/YYYY-MM-DD.md` (append, processed later) |

If a destination file doesn't exist yet, create it from the matching template in `resources/templates/`.

## Home Assistant Actions

When input is a device/scene command:

1. Read `resources/config.example.yaml` → user's actual config lives at `Claude Memory/Skills/jarvis/config.yaml` (gitignored, contains HA URL + long-lived token).
2. Map natural language to entity via the canonical list in `Claude Memory/project_smart_home.md` (e.g., "lounge TV" → `media_player.tv_jelly_beans_tv_2`, NOT `media_player.jelly_beans_tv` which is broken).
3. Call `bash scripts/ha-call.sh <service> <entity_id> [json-data]` — wrapper around HA REST API.
4. Confirm: "Lounge lights on" or report the HA error verbatim.

See `docs/HA_INTEGRATION.md` for the entity catalog and webhook patterns (lounge motion webhook at `http://192.168.0.50:8123/api/webhook/lounge_motion`).

## Inbox Drain

If `Inbox/` contains files with unprocessed content (no `processed: true` frontmatter):

1. Read each in turn.
2. Classify and route per the Project Map.
3. Mark the inbox item `processed: true` with `routed_to: <path>` in frontmatter (don't delete — keeps an audit trail).
4. Report a summary: "Drained 7 items → 3 to smart home, 2 video ideas, 1 task, 1 journal."

Run via: `bash scripts/process-inbox.sh`

## Setup (BUILD mode) — 5-Day Rollout

Walk through `resources/roadmap.md` one day at a time. The roadmap is a living checklist — tick items as you complete them. Don't try to do all 5 days in one session unless the user pushes.

Quick summary:
- **Day 1 (30 min):** Obsidian Mobile + Quick Capture plugin + `/Inbox/` folder + Fold 7 homescreen widget
- **Day 2 (1 hr):** n8n on PC + webhook endpoint + Tasker → webhook test
- **Day 3 (2 hrs):** Claude classification node in n8n + full flow test
- **Day 4 (2 hrs):** HA webhook + event logging into vault
- **Day 5 (1 hr):** GitHub auto-sync for vault + final test

Full walkthrough: `docs/PHONE_SETUP.md` → `docs/N8N_WORKFLOWS.md` → `docs/HA_INTEGRATION.md`.

State tracked in: `Inbox/.jarvis-state.yaml` (created by `scripts/setup.sh` on first run).

## Files in This Skill

- `scripts/setup.sh` — Run the next day's setup steps; state-aware
- `scripts/status.sh` — Show what's built vs pending; tells you which mode to enter
- `scripts/process-inbox.sh` — Drain `/Inbox/` items into routed files
- `scripts/ha-call.sh` — Wrapper for HA REST API calls
- `scripts/install.sh` — Symlink skill into `~/.claude/skills/` on a new device
- `resources/classification.md` — Routing decision rules (read this when classifying)
- `resources/roadmap.md` — 5-day setup checklist (read in BUILD mode)
- `resources/config.example.yaml` — Config template (HA URL/token, n8n webhook, paths)
- `resources/n8n-capture-router.json` — Ready-to-import n8n workflow (phone → classify → route → confirm)
- `resources/templates/` — Markdown templates for note/task/journal/idea/inbox-item
- `docs/PHONE_SETUP.md` — Fold 7 setup: Obsidian Quick Capture, Tasker action, widget
- `docs/HA_INTEGRATION.md` — HA entities, REST patterns, webhooks
- `docs/N8N_WORKFLOWS.md` — Classification workflow design
- `docs/DAILY_DRIVER.md` — How the user uses Jarvis day-to-day once built

## Rules

- **Vault is the source of truth.** Never store state outside `/home/user/Obsidian-Vault-/` or its synced equivalent.
- **Never commit `config.yaml`** (it has the HA token). Only `config.example.yaml` is checked in.
- **Match existing file structure** — don't invent new folders if a project file already exists. Check `Claude Memory/` first.
- **One-line confirmations.** Don't narrate routing logic to the user.
- **Idempotent.** Re-running setup or inbox-drain should never duplicate or break state.
- **Voice-friendly output.** When confirming, keep it under 15 words so it reads well via TTS.
