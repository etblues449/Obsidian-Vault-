---
name: Shared CLAUDE.md project instructions
description: The CLAUDE.md-style instructions block pasted into multiple Claude.ai project Custom Instructions fields (Studying, Code, Faceless Financial, Notebook lm — and as the second half of Smart Home)
type: project
captured: 2026-05-01
note: A Fly.io org token was originally appended to this block; revoked and removed
---

# Shared CLAUDE.md project instructions

Used as Custom Instructions in Claude.ai projects: **Studying, Code, Faceless Financial, Notebook lm**, and appended to **Smart Home** after its home-automation preamble.

> ⚠️ A live Fly.io org API token was originally appended below the body. Token was revoked 2026-05-01 and is **not** stored in this vault. Reissue and store in a password manager.

---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About This Setup

GitHub account: **etblues449**
Platform: Linux (also uses Android/Termux for mobile agent work)
`gh` CLI is installed and authenticated.

## My Projects

| Repo | What it is |
|------|-----------|
| `etblues449/App` | Main project — Expo RN app + FastAPI backend + MongoDB + Termux agent |
| `etblues449/Claude-Github` | Claude Code experiments |
| `etblues449/Faceless-Finance` | Finance/HTML project |
| `etblues449/Fincast` | Video management dashboard |
| `etblues449/t4trade-telegram-bot` | Telegram trading bot (Python) |
| `etblues449/Telegram-forwarder` | Telegram message forwarder (Python) |
| `etblues449/Select-lifestyles-Website-` | HTML website |
| `etblues449/Studying-` | Study/learning repo |
| `etblues449/just-the-docs` | Docs (Ruby/Jekyll) |

## Tech Stack I Use

- **Mobile:** Expo SDK 54, React Native, expo-router, TypeScript
- **Backend:** FastAPI, Motor (async MongoDB), Python, asyncio
- **Database:** MongoDB
- **Bots:** Python Telegram bots (python-telegram-bot / telethon)
- **AI/LLM:** Ollama (qwen2.5-coder:1.5b), Claude API, Google Gemini
- **Mobile shell:** Termux on Android
- **Package managers:** yarn (frontend), pip (Python)

## MCP Servers

**Supermemory** — configured in `/home/user/App/.mcp.json`

```json
{ "type": "http", "url": "https://mcp.supermemory.ai/mcp" }
```

Requires OAuth login on first use. Use `mcp__supermemory__authenticate` tool to start the flow.

## Skills Installed (~/.claude/skills/)

138 skills total. Key ones:

**From levnikolaevich/claude-code-skills:**
- `ln-001-push-all` — push all changes
- `ln-002-session-analyzer` — analyse session history
- `ln-010-dev-environment-setup` — set up dev environment
- `ln-011-agent-installer` — install agents
- `ln-012-mcp-configurator` — configure MCP servers
- `ln-020-codegraph` — visualise codebase graph
- `ln-100-documents-pipeline` — docs generation pipeline
- `ln-200-scope-decomposer` through `ln-230-story-prioritizer` — epic/story/task planning
- `ln-300-task-coordinator` through `ln-316` — task execution and review workers
- `ln-400-story-executor` through `ln-404` — story/task execution
- `ln-500-story-quality-gate`, `ln-510-quality-coordinator` — quality gates
- `ln-610` through `ln-654` — auditors (security, docs, code, tests, patterns, performance, DB)
- `ln-700-project-bootstrap` through `ln-783` — project setup, Docker, CI/CD, linting, testing
- `ln-810` through `ln-840` — performance optimisation, dependency upgrades
- `ln-910` through `ln-914` — GitHub triage, community engagement

**Other:**
- `supermemory-integrate` — Supermemory memory integration

## Git Behaviour

A Stop hook (`~/.claude/stop-hook-git-check.sh`) runs after every session and will warn if there are uncommitted changes, untracked files, or unpushed commits. Always commit and push before finishing.

Branch convention (enforced by harness): work on `claude/<task-slug>` branches, never push directly to `main`.

Always create a draft PR after pushing a new branch.

## App-Specific Dev Commands

### Frontend (Expo)

```bash
cd frontend && yarn install
yarn start          # dev server + QR code
yarn android / yarn ios / yarn web
yarn lint
```

### Backend (FastAPI)

```bash
cd backend && pip install -r requirements.txt
uvicorn server:app --reload --port 8001
```

Needs `backend/.env` with `MONGO_URL` and `DB_NAME`.

### Backend Tests

```bash
cd backend
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001 pytest tests/
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001 pytest tests/test_agent_endpoints.py
```

Tests hit a live server — MongoDB and the backend must be running.

### Termux Agent (Android)

```bash
python termux_agent.py   # starts HTTP API on :8080
```

Set Remote Mode in app Settings with URL `http://<phone-ip>:8080`.

## Key Env Variable

`EXPO_PUBLIC_BACKEND_URL` — used by both the Expo frontend and backend test suite.

---

Then on your machine run:

```bash
mkdir -p ~/.claude
# paste into ~/.claude/CLAUDE.md
```

That's it — both the Claude Code CLI and VS Code extension will pick it up automatically from that location.

## fly.io org token

`<REDACTED — Fly.io org token; revoked 2026-05-01; reissue and store in password manager, never in project instructions>`

```powershell
$env:FLY_API_TOKEN = "<REDACTED>"
& "$env:USERPROFILE\.local\bin\spawn" claude sprite
```

---

## Discrepancy with current global CLAUDE.md

The user's current `~/.claude/CLAUDE.md` (Windows machine) lists Platform as **Windows**, this version says **Linux**. Likely a leftover from when the file was written on/for the Termux/Linux machine. Reconcile when convenient.
