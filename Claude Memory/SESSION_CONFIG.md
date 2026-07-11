# Claude Code on the Web — Session Config

How to start a session that won't error out. Read this before creating a new session in the web UI.

## What killed the last session

The screenshot session (`session_013bFheKJofFJqxm742iBjjm`, "8 repos / Playwright installation") died with `An error occurred while executing Claude Code` after:

1. **8 repos loaded** at once. Every repo's `CLAUDE.md` becomes project context. Every repo's `.mcp.json` is merged. Every repo's `.claude/settings.json` hooks register.
2. **`playwright` MCP auto-starting** from `Obsidian-Vault-/.mcp.json` (this is what "Playwright installation" in the title refers to — Chromium download).
3. **`Claude-Github/.claude/settings.json` hooks** firing on every tool call (`PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `Notification`, `Stop`, `SubagentStart`/`Stop`, `PreCompact`, `SessionEnd`) — 10 hooks, 3–15s timeouts, running 36KB `intelligence.cjs` + 35KB `learning-service.mjs`.
4. **Stacked heavy slash commands** in one prompt: `/github-project-management /swarm-advanced /deep-research /goal`. Any one of these is fine; four in a row blows context.
5. **Leftover background sleep timers** from an earlier render wait still pinging.

Fix the inputs, not the symptoms.

## Repo loadout by task

Load only what the task needs. The web UI lets you pick repos at session creation — pick the minimum.

| Task | Repos to load |
|---|---|
| Faceless Finance app (React in `index.html`, Worker, pipeline) | `Faceless-Finance` only |
| Faceless Finance app — Expo mobile | `faceless-finance-app` only |
| Fincast | `Fincast` (+ `fincast-worker` if touching the worker) |
| ESPHome / smart home | `esphome-devices` only |
| Skills/plugins research, MCP work | `Claude-Skills-pluggins-connections-` only |
| Vault notes, cross-project memory | `Obsidian-Vault-` only |
| Multi-repo refactor across Faceless | `Faceless-Finance` + `faceless-finance-app` (2, not 8) |
| Anything involving ruflo/claude-flow features | `Claude-Github` only |

**Never load all 8 unless you're explicitly auditing across the whole portfolio.** Even then, ask first whether the audit can be done one repo at a time.

## MCP servers — what they cost

| Server | Defined in | Cost | When to keep |
|---|---|---|---|
| `playwright` | `Obsidian-Vault-/.mcp.json` | Chromium install (~150MB) on first session, slow startup every session | Only sessions where you'll actually drive a browser |
| `claude-flow` (ruflo) | `Claude-Github/.mcp.json` | Heavy, but `autoStart: false` — won't start unless invoked | Safe to leave |
| `github` | host-provided | Cheap | Always |

If you don't need Playwright, don't load `Obsidian-Vault-`.

## Slash command rules

- **One heavy command per prompt.** Heavy = `/deep-research`, `/swarm-advanced`, `/swarm-orchestration`, `/github-project-management`, `/sparc-methodology`, `/v3-*`, anything that fans out subagents or does multi-source web fetches.
- **Don't chain them in one message.** `/deep-research X` then wait for the result, then `/goal Y` — not both at once.
- **`/goal` and `/ultraplan` are themselves orchestrators.** Don't stack them with other heavy commands.
- Cheap commands (`/init`, `/run`, `/verify`, `/code-review`, `/simplify`) can be combined freely.

## Before-you-start checklist

- [ ] Picked the minimum repo set for the task?
- [ ] If a previous session was babysitting renders/CI, **kill any background processes** before starting a new one (the leftover sleep timers in the screenshot were from a render wait that wasn't stopped).
- [ ] First message in the session is a single, scoped task — not a stack of slash commands.
- [ ] If you need Playwright, you actively want it; otherwise don't load `Obsidian-Vault-`.

## If a session does error

1. Don't retry the same big prompt. Start fresh with a narrower scope.
2. Copy any in-progress notes to the vault first (`Work/` or `Claude Memory/Projects/`) so the next session can pick up.
3. The session URL (`claude.ai/code/session_…`) is dead — don't try to teleport into it. Open a new session with fewer repos.
