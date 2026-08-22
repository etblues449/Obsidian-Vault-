# MEMORY.md — JARVIS long-term memory

> **Read by:** Morning Brief (Skill 1) and Connection Finder (Skill 3), capped at 6000
> chars (`MEMORY_CAP` in `Assistant Core/jarvis-skills/runner.mjs`). Keep the top of this
> file the highest-signal content — the tail is what gets truncated.
>
> **Provenance rule:** every line here is either sourced from the vault or explicitly
> marked `<!-- TO FILL -->`. Do not add plausible-sounding content. An invented memory is
> indistinguishable from a real one on the next read, and from then on the whole system
> is confidently wrong.
>
> Created 2026-07-27 during harness build. Prior to this the file did not exist, and
> Morning Brief + Connection Finder had been running against a missing primary source.

## Who

Jelly Bean (Elliot Horton). UK, Europe/London. Works in supported living at Select
Lifestyles. Builds developer tooling and home automation as serious side work, not
hobby-level.

## Working standard

The marginal cost of completeness is near zero. Whole thing, with tests and docs.
Finished product, not a plan. Permanent solve over workaround. One step at a time, each
finished before the next. Full-file rewrites for easy copy/paste.

## Hard constraints

- **C1 — £0/month, forever.** This is why the skill engine runs on GitHub Actions +
  Groq instead of n8n.cloud + the Claude API. "Free tier" usually means trial credits;
  Vapi, Retell, LiveKit Cloud, Deepgram and ElevenLabs are trial credits. Browser Web
  Speech API and Groq's free tier are genuinely free.
- **Single vault write path.** `master`, one serialized writer. A second automated
  committer (n8n's GitHub node running alongside obsidian-git) corrupted this vault
  once; recovery cost a full session.
- **Never claim an action that was not performed.** Confirming an unexecuted action is
  the worst failure mode in this system.
- **Sensitive notes never leave the vault.** Tags `sensitive` / `private` /
  `confidential` / `legal` / `financial`. This vault holds real solicitor
  correspondence, credit-card statements, tenancy agreements, income forecasts.

## Active projects

| Project | One line |
|---|---|
| Smart Home / JARVIS | HA Green + ESP32 nodes + an on-device agentic layer on the Fold 7 |
| Faceless Finance | CA-credentialed faceless YouTube channel — Wed/Fri/Sun, Wed 4PM priority |
| Doc to Learning | Single-file HTML doc→learning app on the Anthropic API |
| Work Financial Forecasting | Select Lifestyles income forecast (`.xlsm`); Claude acts as financial director |
| Trading Signals | Due-diligence work; see its own `_index.md` |
| Other Workspaces | Catch-all for smaller efforts |

## Infrastructure

```
vault repo      etblues449/Obsidian-Vault-  (branch: master)
HA Green hub    192.168.0.200
phone           Samsung Galaxy Z Fold 7, Termux
skill engine    Assistant Core/jarvis-skills/runner.mjs — Groq llama-3.3-70b-versatile
capture         Tasker → webhook → JARVIS/Inbox/   (still on paid n8n; C1 migration pending)
```

## Hard-won lessons

- **Vendor BSP beats the product image.** The Waveshare "Interface Definition" image
  gave a wrong audio pin map that cost ~4h of chasing static. Camera pins happened to be
  right; audio pins were not. Read the BSP header.
- **Documented ≠ merged ≠ running.** These three get conflated constantly and it is the
  single most expensive habit in this project. A README describing five workflows proves
  nothing about `.github/workflows/`.
- **Silent failures outrank loud ones.** A crash gets fixed. A briefing built on a
  missing source gets believed.
- **GitHub API rate-limits from shared IPs.** Use `git clone --depth 1` for bulk, or
  `raw.githubusercontent.com` with a `User-Agent` header. Never record a 403 as a
  missing file.
- **Claude Code on Termux: pin v2.1.112**, disable the auto-updater in both `~/.bashrc`
  (`DISABLE_AUTOUPDATER=1`) and `~/.claude/settings.json` (`autoUpdates: false`), or it
  silently re-breaks itself pulling a 233 MB binary Android kills mid-download.
- **git MCP: `uvx mcp-server-git`, not npx.** The npm version will not connect.
- **BLE + mmWave on one ESP32 contend.** Split across nodes; do not tune around it.

## Open questions

<!-- TO FILL — these need Elliot's input, do not guess -->
- Termux runtime path: proot-Ubuntu vs patched-native?
- Billing posture: Pro credit vs direct API key for the judgement-work bursts?
- Obsidian Sync retirement — still paying for it alongside obsidian-git?

---
*Seeded 2026-07-27. Every unmarked line above is sourced from the vault or CLAUDE.md.*
