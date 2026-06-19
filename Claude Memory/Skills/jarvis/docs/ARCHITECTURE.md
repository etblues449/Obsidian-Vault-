# Jarvis — Verified Architecture & Decisions

**Researched 2026-06-08** via parallel web research against official docs (Obsidian, QuickAdd, Advanced URI, Tasker, Home Assistant, n8n) and recent (2024-2026) real-world setups. This is the "why" behind the build. Where the convenient default is wrong for this stack, it's flagged.

## The spine

```
Fold 7 (HTTP Shortcuts / Tasker: 1-tap or voice → POST {text,source,ts})
   └─► n8n on PC ─► Claude classify (JSON: type/project/dest/content/ha_action/confidence)
                     ├─ note/task/idea/journal ─► Obsidian Local REST API (PC) ─► Obsidian Sync ─► all devices
                     ├─ ha_action ─────────────► HA REST /api/services/<domain>/<service>
                     ├─ cast/show ─────────────► HA cast.show_lovelace_view → Chromecast/Google TV
                     └─ push to PC ────────────► ntfy topic the PC subscribes to
Offline fallback: Obsidian QuickAdd capture (Advanced URI + Shortcut Maker) → Inbox/ → drained later
Live house control: HA Assist + LLM agent (Assist API tool-calling)
```

## Decision 1 — Capture is a webhook POST, not a vault write

**Two verified constraints force this:**
1. Every phone-side path that writes into the vault (`obsidian://new`, Advanced URI, QuickAdd-via-URI) **opens the Obsidian app** — not a background write.
2. **Obsidian Sync only runs while the app is foregrounded.** So even a direct background file write doesn't reach other devices until you next open Obsidian.

→ For frictionless "speak and forget," POST to n8n; n8n writes vault-side. The QuickAdd capture path is the **offline fallback** (PC/n8n down, off-LAN), drained later by `scripts/process-inbox.sh`.

- Sources: [QuickAdd #451](https://github.com/chhoumann/quickadd/discussions/451), [Obsidian forum: Tasker quick capture](https://forum.obsidian.md/t/tasker-for-mobile-quick-capture/95141), [Android append tutorial](https://forum.obsidian.md/t/quick-way-to-add-or-append-notes-without-opening-obsidian-android-tutorial/57547)

## Decision 2 — Vault writes go through Obsidian Local REST API, NOT git

**This overrides the skill's earlier GitHub-node default.** The vault runs **both** Obsidian Sync (reaches the phone) and git (remote branch). Letting two sync engines manage the same files causes conflicts, and:
- Git + Obsidian Sync on one vault is explicitly discouraged — "designed to replace, not complement, each other, and they may conflict."
- The **Obsidian Git plugin on Android is "highly unstable on mobile"** (isomorphic-git) per its maintainer — a git push from n8n may never reach the Fold 7.

**Resolution:**
- **Obsidian Sync** = the live multi-device channel. Automations write *through* it via the **Local REST API plugin on the always-on PC** (`POST/PATCH http://PC:27123|27124/vault/<path>`), and desktop Obsidian does the write so there's no on-disk race.
- **git** = backup + audit + Claude's desktop read/write, **PC/laptop only**, periodic commit/push after Sync settles. **Never** on the Fold 7.
- The Local REST API plugin is **desktop-only** (Node/Electron) → it runs on the PC, which is fine (same box as n8n + desktop Obsidian). Single point of failure: if the PC/Obsidian is off, writes fail → add an n8n **Filesystem-node fallback**.
- Community nodes so you don't hand-roll HTTP: `Wade11s/n8n-nodes-obsidian`, `j-shelfwood/n8n-nodes-obsidian-local-rest-api`.

- Sources: [Git on Sync vaults](https://forum.obsidian.md/t/using-git-on-obsidian-sync-vaults/60958), [obsidian-git mobile instability](https://github.com/Vinzent03/obsidian-git), [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api), [mobile-only limitation](https://docs.obsidian.md/Plugins/Getting+started/Mobile+development), [Wade11s node](https://github.com/Wade11s/n8n-nodes-obsidian), [j-shelfwood node](https://github.com/j-shelfwood/n8n-nodes-obsidian-local-rest-api)

## Decision 3 — Live house control via HA Assist, not n8n

HA's Assist (2025+ releases) does LLM tool-calling against the **Assist API** over exposed entities — lights/climate/scenes/scripts — with hybrid fast-path, per-device room context, streaming TTS, and proactive prompts. Lower latency and more reliable than routing "turn on the lights" through n8n. Reserve n8n's HA REST path for `ha_action` items that arrive through *capture*. (Optional unified-n8n path: `webhook-conversation` integration, needs HA ≥ 2026.4.)

- Sources: [HA AI blog Sept 2025](https://www.home-assistant.io/blog/2025/09/11/ai-in-home-assistant/), [HA LLM/Assist API docs](https://developers.home-assistant.io/docs/core/llm/), [webhook-conversation](https://github.com/EuleMitKeule/webhook-conversation)

## Phone capture mechanics (verified)

- **No native Obsidian Android widget triggers a command/QuickAdd/URI** (Mobile 1.11.0 widgets: Open Note, New Note, Search, Daily Note, Open Obsidian). One-tap launch of QuickAdd needs **Advanced URI** (`commandid=quickadd:choice:<UUID>`, get it via "Advanced URI: Copy URI for command") wrapped in **Shortcut Maker** (or MacroDroid for direct append).
- **Primary trigger apps:** HTTP Shortcuts (FOSS, lightest) or Tasker (`Get Voice` → `%VOICE` → Net→HTTP Request POST; the old HTTP Post action is deprecated).
- **Hands-free:** Tasker **Assistant Action** ("OK Google, run *Jarvis capture* in Tasker") — US-English only, may break under the Gemini cutover (re-test); power-button fallback unaffected.
- **Dead ends:** Gemini & Bixby cannot write to Obsidian/n8n directly (Keep/Reminder only); Bixby Quick Commands removed 2025.
- **Voice quality:** built-in STT ~90-93% (free, fine for short notes); Whisper ~95-98% (~$0.003-0.006/min) for long/noisy dictation.

- Sources: [Mobile 1.11.0 changelog](https://obsidian.md/changelog/2025-12-10-mobile-v1.11.0/), [Advanced URI](https://github.com/Vinzent03/obsidian-advanced-uri), [Tasker Get Voice](https://tasker.joaoapps.com/userguide/en/help/ah_get_voice.html), [Tasker HTTP Request](https://tasker.joaoapps.com/userguide/en/help/ah_http_request.html), [Tasker Assistant Action](https://tasker.joaoapps.com/userguide/en/help/eh_assistant_action.html), [HTTP Shortcuts](https://github.com/Waboodoo/HTTP-Shortcuts)

## Casting / push (verified caveats)

- **Samsung TVs:** native media-cast/DLNA is flaky — use SamsungTV integration for power/app/source/volume only. For "show this on the TV," cast a Lovelace view to a **Chromecast/Google TV** (`cast.show_lovelace_view`); re-cast every ~9 min (CATT / Continuously Casting Dashboards) since Cast sessions die.
- **Push to PC:** **ntfy** (self-host, HA native) for links/text/alerts; files via a synced folder + an ntfy link. Pushover if you need file attachments.

- Sources: [HA Cast](https://www.home-assistant.io/integrations/cast/), [Samsung DLNA issues](https://community.home-assistant.io/t/media-cast-dlna-not-working-with-samsung-tvs-or-smart-monitors/693075), [ntfy](https://ntfy.sh/)

## Highest-risk parts (and how they're de-risked)

1. **git vs Obsidian Sync** (highest) → Sync is sole live channel; git PC/laptop-only backup; never on phone. (Decision 2)
2. **Local REST API depends on PC + desktop Obsidian running** → n8n Filesystem-node fallback; keep PC/Obsidian on autostart; heartbeat monitor.
3. **Samsung TV casting + dead entities** → cast to Chromecast not Samsung; hard-code known-good IDs (`media_player.tv_jelly_beans_tv_2`, `media_player.select_source` + `"Spotify - Music and Podcasts"`, `bedroom-2.yaml`) and exclude broken ones (`media_player.jelly_beans_tv`, `spotcast.start`, contended upstairs node).

## Version flags
- `webhook-conversation` needs HA ≥ 2026.4. Confirm HA build for Assist proactive/per-device-LLM features (2025 releases).
- Tasker Assistant Action: US-English; survival post-Gemini-cutover unconfirmed — re-test after updates.
- Pick the current Anthropic model at build time (the workflow ships a placeholder); the architecture is model-agnostic.
