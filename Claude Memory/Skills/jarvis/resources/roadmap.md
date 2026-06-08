# Jarvis 5-Day Rollout

Living checklist. Tick items as completed. State mirror: `Inbox/.jarvis-state.yaml`.

## Day 1 — Phone Capture (30 min)

- [ ] Install Obsidian Mobile on Fold 7 (Play Store)
- [ ] Open the vault on the Fold 7 (Obsidian Sync or local sync via Syncthing)
- [ ] Install **Quick Capture** community plugin (Settings → Community plugins → Browse → "Quick Capture")
- [ ] Configure Quick Capture target file: `Inbox/quick-capture.md`
- [ ] Create `Inbox/` folder in vault if missing
- [ ] Add Quick Capture widget to Fold 7 homescreen (long-press homescreen → Widgets → Obsidian → Quick Capture)
- [ ] Test: tap widget, type "first jarvis test", verify it lands in `Inbox/quick-capture.md`

**Done when:** widget on homescreen, one tap → typing → saved to vault inbox.

See `docs/PHONE_SETUP.md` for screenshots and gotchas.

## Day 2 — n8n + Webhook (1 hr)

- [ ] Install n8n on Windows PC (Docker: `docker run -it --rm -p 5678:5678 n8nio/n8n`, or self-hosted desktop app)
- [ ] Open `http://localhost:5678` — complete onboarding
- [ ] Create new workflow: **Jarvis Capture Router**
- [ ] Add **Webhook** trigger node — path: `jarvis-capture`, method: POST
- [ ] Note webhook URL (e.g. `http://192.168.0.X:5678/webhook/jarvis-capture`)
- [ ] Open port 5678 on PC firewall (only LAN — `192.168.0.0/24`)
- [ ] Install **Tasker** on Fold 7 (Play Store, paid)
- [ ] Create Tasker task: **Jarvis Voice** → Voice Recognise → HTTP Request POST to webhook URL with `{"text": "%VOICE"}`
- [ ] Bind task to quick-tile or assistant button or homescreen shortcut
- [ ] Test: trigger task, say "test capture", verify n8n shows incoming webhook execution

**Done when:** voice on phone → n8n receives `{"text": "..."}` reliably.

## Day 3 — Claude Classification (2 hrs)

- [ ] In the n8n workflow, add an HTTP node calling Anthropic API with the captured text + classification prompt
- [ ] Prompt asks Claude to return JSON: `{"type": "note|task|ha_action|idea|journal", "project": "smart_home|finance|...", "destination_file": "...", "content": "...", "tags": [...]}`
- [ ] Add **Switch** node routing on `type`
- [ ] For each branch, write the appropriate file in the vault via the n8n **GitHub** node or a self-hosted **Filesystem** node (since the vault is git-tracked, GitHub commit works cross-device)
- [ ] Alternative: write to a shared folder that Obsidian Sync picks up
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

## Day 5 — GitHub Auto-Sync + Final (1 hr)

- [ ] Confirm Obsidian vault is a git repo (it already is — branch `claude/adoring-allen-LY2kF`)
- [ ] Install Obsidian **Git** community plugin
- [ ] Configure: auto-pull on startup, auto-commit-and-push every 10 min
- [ ] Confirm pushes reach the remote
- [ ] Full end-to-end test from each device:
  - [ ] Fold 7: voice → captured + classified + filed
  - [ ] PC: open vault → see new capture within 10 min
  - [ ] HA: trigger an event → see it in vault
- [ ] Update `Claude Memory/MEMORY.md` with "Jarvis live as of YYYY-MM-DD"

**Done when:** everything syncs, no manual steps, JARVIS is your daily driver.

---

## After Day 5 — Optional Enhancements

- [ ] Whisper API instead of Android's voice recogniser (better accuracy, costs ~$0.006/min)
- [ ] Daily 8 AM digest workflow (n8n schedule trigger → Claude → push notification or Obsidian daily note)
- [ ] Per-project Claude classifier prompts (smarter routing for finance vs smart home vs studying)
- [ ] HA scene suggestion ML (analyse event_log, suggest automations)
- [ ] Bidirectional: edits in vault → push to HA dashboards / TV display
