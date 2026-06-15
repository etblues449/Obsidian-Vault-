# Jarvis 5-Day Rollout

Living checklist. Tick items as completed. State mirror: `Inbox/.jarvis-state.yaml`.

## Day 1 — Phone Capture / offline fallback (30 min)

> No native Obsidian Android widget can trigger a command/QuickAdd — verified. So the one-tap launch uses Advanced URI + a tiny launcher app. This is the OFFLINE FALLBACK layer; the primary path is Day 2.

- [ ] Install Obsidian Mobile on Fold 7 (Play Store); open the synced vault
- [ ] Install **QuickAdd** and **Advanced URI** community plugins, enable both
- [ ] QuickAdd → Add Choice `Jarvis Capture` → type **Capture** → file `Inbox/quick-capture.md`, Create-if-missing ON, Bottom of file, format `- {{DATE:YYYY-MM-DD HH:mm}} :: {{VALUE}}`
- [ ] Toggle the **⚡ lightning bolt** on the choice (makes it a command)
- [ ] Command palette → **Advanced URI: Copy URI for command** → pick `QuickAdd: Jarvis Capture` (gives the `obsidian://advanced-uri?...commandid=quickadd%3Achoice%3A...` URI)
- [ ] Install **Shortcut Maker** (free) → new shortcut → Action `android.intent.action.VIEW` → Data = that URI → label "📥 Jarvis" → add to homescreen
- [ ] Test: tap icon → Obsidian opens QuickAdd prompt → type "first jarvis test" → confirm it lands at the bottom of `Inbox/quick-capture.md`

**Done when:** one tap → type → saved to vault inbox (opens the app; syncs when foregrounded — fine for fallback).

See `docs/PHONE_SETUP.md` for the full method and alternatives (MacroDroid direct-append, dedicated capture apps).

## Day 2 — n8n + Webhook (1 hr)

- [ ] Install n8n on Windows PC (Docker: `docker run -it --rm -p 5678:5678 n8nio/n8n`, or self-hosted desktop app)
- [ ] Open `http://localhost:5678` — complete onboarding
- [ ] Create new workflow: **Jarvis Capture Router**
- [ ] Add **Webhook** trigger node — path: `jarvis-capture`, method: POST
- [ ] Note webhook URL (e.g. `http://192.168.0.X:5678/webhook/jarvis-capture`)
- [ ] Open port 5678 on PC firewall (only LAN — `192.168.0.0/24`)
- [ ] Phone trigger app — pick one (or both): **HTTP Shortcuts** (free/FOSS, lightest for tap-to-send) and/or **Tasker** (paid, for voice + chaining)
- [ ] Create Tasker task: **Jarvis Voice** → **Get Voice** (`%VOICE`) → **Net → HTTP Request** POST (Content-Type application/json) body `{"text":"%VOICE","source":"tasker-voice","ts":"%TIMES"}`
- [ ] Bind to a one-tap launcher (cover-screen quick-tile / side-key double-press / homescreen icon)
- [ ] (Hands-free) add Tasker **Assistant Action** profile so "OK Google, run Jarvis capture in Tasker" fires it — US-English only; re-test after Gemini updates
- [ ] Test: trigger task, say "test capture", verify n8n shows incoming webhook execution

**Done when:** voice on phone → n8n receives `{"text": "..."}` reliably.

## Day 3 — Claude Classification (2 hrs)

- [ ] In the n8n workflow, add an HTTP node calling Anthropic API with the captured text + classification prompt
- [ ] Prompt asks Claude to return JSON: `{"type": "note|task|ha_action|idea|journal", "project": "smart_home|finance|...", "destination_file": "...", "content": "...", "tags": [...]}`
- [ ] Add **Switch** node routing on `type`
- [ ] Install the **Obsidian Local REST API** plugin in desktop Obsidian on the PC (note its `:27124` URL + bearer token)
- [ ] For each branch, write the file via n8n → **Obsidian Local REST API** (`POST /vault/<path>` append; `PATCH` to target a heading) — desktop Obsidian writes it, then **Obsidian Sync** fans out to the Fold 7 + laptop
- [ ] Add a **fallback branch**: if the REST call errors (PC/Obsidian off), write via the **Filesystem node** to the synced vault folder
- [ ] (Optional) install the `Wade11s/n8n-nodes-obsidian` community node so you don't hand-roll the HTTP calls
- [ ] Do NOT use the GitHub-commit node as the vault writer (git + Obsidian Sync conflict; mobile git is unreliable)
- [ ] Add fallback branch → append to `Inbox/quick-capture.md`
- [ ] Test the full flow with 5 different inputs (one of each type)
- [ ] Confirm Faceless Finance, Smart Home, Studying all received correctly

**Done when:** "play Spotify on lounge TV" hits HA, "video idea: X" lands in Faceless Finance inbox, "remind me Y" creates a task, all in <5 seconds.

## Day 4 — HA Webhook + Event Logging (2 hrs)

- [ ] In HA, create a Long-Lived Access Token (Profile → Security → Long-lived tokens)
- [ ] Add token + HA URL (`http://192.168.0.50:8123`) to `Claude Memory/Skills/jarvis/config.yaml` (gitignored)
- [ ] In n8n classification flow, for `type: ha_action`, call HA REST API `/api/services/<domain>/<service>` with the entity_id
- [ ] In HA, create automation: on significant events (presence change, motion, scene activation), POST to n8n webhook `/jarvis-event` with payload `{"event": "...", "data": {...}}`
- [ ] n8n workflow **Jarvis Event Logger** appends events to `Claude Memory/Projects/Smart Home/event_log.md` (or per-day file)
- [ ] Test: voice "movie mode", verify HA scene runs AND event logged in vault
- [ ] Test: walk into lounge → presence sensor fires → event logged

**Done when:** voice commands run HA actions; HA events stream into vault.

## Day 5 — Sync channels + backup + Final (1 hr)

**Obsidian Sync is the live channel to all devices. git is PC/laptop-only backup. Never put Obsidian Git on the Fold 7.**

- [ ] Confirm Obsidian Sync is delivering PC ↔ Fold 7 ↔ laptop (it already is)
- [ ] On **PC/laptop only**: install Obsidian **Git** community plugin (or a scheduled `git add/commit/push`) → periodic commit/push *after* Sync settles, as backup + audit history
- [ ] Gitignore `.obsidian/workspace*.json`, `.trash`, and `*conflict*` files
- [ ] Confirm backup pushes reach the remote
- [ ] Do NOT install Obsidian Git on the Fold 7 — the phone gets everything from Obsidian Sync
- [ ] Full end-to-end test from each device:
  - [ ] Fold 7: voice → POST → classified → written via Local REST API → appears on phone via Sync
  - [ ] PC: see the new capture
  - [ ] HA: trigger an event → see it in `event_log.md`
- [ ] Update `Claude Memory/MEMORY.md` with "Jarvis live as of YYYY-MM-DD"

**Done when:** everything syncs, no manual steps, JARVIS is your daily driver.

---

## After Day 5 — Optional Enhancements

- [ ] Whisper API instead of Android's voice recogniser (better accuracy, costs ~$0.006/min)
- [ ] Daily 8 AM digest workflow (n8n schedule trigger → Claude → push notification or Obsidian daily note)
- [ ] Per-project Claude classifier prompts (smarter routing for finance vs smart home vs studying)
- [ ] HA scene suggestion ML (analyse event_log, suggest automations)
- [ ] Bidirectional: edits in vault → push to HA dashboards / TV display
