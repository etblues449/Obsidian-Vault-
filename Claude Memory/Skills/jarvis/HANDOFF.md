# Jarvis Build — HANDOFF

> **For:** the next Claude Code chat (likely a fresh session on the Windows PC). Read this top-to-bottom before doing anything else. It is the source of truth for what we're building, what's done, and the next concrete action.
>
> **Last updated:** 2026-06-10
> **Current device context:** user just moved from phone (Samsung Fold 7) to Windows PC. Vault on disk at `C:\Users\ElliotHorton\Documents\ObsidianVault`.
> **Active branch:** `claude/adoring-allen-LY2kF`
> **Open PR:** [#25 (draft)](https://github.com/etblues449/Obsidian-Vault-/pull/25)
> **Immediate blocker:** PC needs `git pull` — three doc/script files (`PC_SETUP.md`, `HA_ASSIST_SETUP.md`, `day2-windows-setup.ps1`, `n8n-event-logger.json`) are pushed to the remote but not yet synced to this PC. See §5.

---

## 1. North star

Build **Jarvis** — a phone- and voice-driven capture + house-control system for the Obsidian Vault and Home Assistant. The user (Elliot) wants to:

- **Capture anything, anywhere, in one tap or one phrase**: spoken/typed input → AI-classified → routed to the right vault note (task / journal / project inbox / HA command).
- **Talk to the house in real time**: "Jarvis, dim the lounge", "Jarvis, play Spotify on the lounge TV" — answered locally with low latency.
- **Cross-device, durable, low-friction**: everything syncs to phone + PC + tablet via Obsidian Sync. The system survives the PC being off (offline fallback) and survives the phone being off (PC path keeps working).

**Rollout: 5 days.** Day 1 is done. Day 2 starts as soon as we get past the `git pull` blocker.

---

## 2. Architecture — VERIFIED DESIGN, DO NOT RELITIGATE

Two independent paths, by deliberate decision:

### Path A — Capture (n8n on PC)

```
Phone (homescreen icon + Tasker voice, future)
   │  POST  /webhook/jarvis-capture  {"text": "..."}
   ▼
n8n (Docker on Windows PC, port 5678)
   ├─ Classify (Anthropic Messages API, classifier prompt mirrors classification.md)
   ├─ Parse  (Code node, tolerant JSON parse + confidence floor)
   └─ Switch on type
        ├─ ha_action  → Call Home Assistant REST (/api/services/...)
        └─ everything else → Append to Vault via Obsidian Local REST API
                              ↓
                              Desktop Obsidian writes the file
                              ↓
                              Obsidian Sync fans out to phone/PC/tablet
```

**Webhook URL the phone will POST to:** `http://<PC-LAN-IP>:5678/webhook/jarvis-capture`

### Path B — Live house control (HA Assist + LLM, NOT n8n)

```
"Jarvis, dim the lounge"  (Voice → HA Companion app on phone, or Assist on HA dashboard)
   ▼
HA Voice Assistant pipeline
   ├─ Fast-path: built-in intent matcher tries first (no LLM, free, <1s)
   └─ LLM agent: Anthropic Claude Haiku 4.5 with HA tool-calling
        ↓ picks the right service + entity from the EXPOSED list
        ↓ calls light.turn_on / media_player.select_source / etc.
```

n8n's HA REST branch is **only** for captured `ha_action` items ("remind me to turn off the kitchen light at 11pm tomorrow"). Live control is HA Assist. Don't route real-time voice through n8n — too slow, too fragile.

### Why these choices (don't second-guess)

| Decision | Why | Where it lives |
|---|---|---|
| Vault writes via Obsidian Local REST API plugin, **not git, not GitHub node** | Git + Obsidian Sync on the same vault conflict. Mobile git (isomorphic-git in obsidian-git) is "highly unstable on mobile" per its maintainer — the Fold 7 may never get the change. Local REST API plugin on the PC writes through desktop Obsidian, then Obsidian Sync fans out reliably. | `docs/N8N_WORKFLOWS.md` §"Write to vault — VERIFIED recommendation"; `docs/ARCHITECTURE.md` Decision 1 |
| Live HA control via HA Assist + LLM, **not n8n** | HA Assist's built-in intent matcher resolves "turn on the lights" locally in <1s with no LLM tokens. LLM only fires on the hard ones. Routing every voice command through n8n adds latency and a single point of failure. | `docs/ARCHITECTURE.md` Decision 3; `docs/HA_ASSIST_SETUP.md` |
| Claude Haiku 4.5 as the HA LLM (step up to Sonnet 4.6 only if needed) | Cheapest viable; instruction-following is good enough that it doesn't invent entity names, which matters given the broken-entity landmines. Fast-path means most commands skip the LLM. | `docs/HA_ASSIST_SETUP.md` "Recommended LLM agent" |
| Phone offline fallback = QuickAdd → `Inbox/quick-capture.md`, drained later | When the PC is off, the phone STILL captures. Classification happens later via `scripts/process-inbox.sh`. No data loss. | `Inbox/quick-capture.md`; `docs/PHONE_SETUP.md` |
| Spotify on the lounge TV via `media_player.select_source` "Spotify - Music and Podcasts", **NOT spotcast** | spotcast was broken in this house. The media_player.select_source path is the canonical way. | `docs/HA_INTEGRATION.md`; `docs/HA_ASSIST_SETUP.md` "Recommended expose-list" |

---

## 3. What's done so far

### ✅ Day 1 — Phone capture (LIVE, end-to-end working)

The user can tap a homescreen icon on the Fold 7, get a popup, type or paste anything, hit submit, and the line lands in `Inbox/quick-capture.md` and syncs to PC/tablet via Obsidian Sync.

**Stack that landed it:**
1. QuickAdd plugin installed on the phone — choice called **`Jarvis Capture`**, capture target `Inbox/quick-capture.md`, format `- {{DATE:YYYY-MM-DD HH:mm}} :: {{VALUE}}`, "Create file if it doesn't exist" ON, write position bottom-of-file. The ⚡ lightning bolt is enabled (registers it as an Obsidian command).
2. Advanced URI plugin installed on the phone.
3. Shortcut Maker (by Rushikesh Kamewar, free Play Store app) used to build a **custom Intent shortcut** — Action `android.intent.action.VIEW`, Data = the URI generated by Advanced URI's `Copy URI for command` command (with "Don't specify a file" selected, then filter "jarvis" → "QuickAdd: Jarvis Capture").
4. Saved to home screen as **`📥 Jarvis`**.

**Round-trip verified:** capture written via icon, appears in phone's `Inbox/quick-capture.md` preview. Note: the sandbox container's vault snapshot is stale and won't show recent captures — confirmed via the user's phone preview.

### ✅ Day 1 polish (in progress / user-driven on phone tonight)

- (A) Delete leftover `Jarvis/` folder from the vault — long-press in Obsidian on phone, delete. Folder doesn't exist in the sandbox snapshot, so it's phone-side only.
- (B) Voice trigger: Google Assistant Routine — phrase "Jarvis" → action "Open shortcut" → pick `📥 Jarvis`. Result: "Hey Google, Jarvis" → capture popup.
- (C) Round-trip test capture confirmed in `Inbox/quick-capture.md`.

### ✅ Build artifacts pushed (PR #25, branch `claude/adoring-allen-LY2kF`)

All committed to remote; **not yet pulled on the PC** — see §5.

| File | Purpose | Status |
|---|---|---|
| `Claude Memory/Skills/jarvis/SKILL.md` | Skill entry, project map | Already in vault |
| `docs/ARCHITECTURE.md` | Verified design decisions (the two paths above) | Already in vault |
| `docs/PHONE_SETUP.md` | Phone-side setup (QuickAdd + Advanced URI + Shortcut Maker) | Already in vault |
| `docs/N8N_WORKFLOWS.md` | Workflow design, env vars, write-path recommendation | Already in vault |
| `docs/HA_INTEGRATION.md` | HA entity catalog + broken-entity landmines | Already in vault |
| `docs/DAILY_DRIVER.md` | Daily usage patterns | Already in vault |
| **`docs/HA_ASSIST_SETUP.md`** | NEW — Day 4 live control: Claude agent, exposed entities, pipeline, phone usage | **Pushed, needs PC pull** |
| **`docs/PC_SETUP.md`** | NEW — Day 2/3 Windows checklist + troubleshooting table | **Pushed, needs PC pull** |
| `resources/classification.md` | Routing decision tree (classifier system prompt mirrors this) | Already in vault |
| `resources/config.example.yaml` | Config template (real `config.yaml` is gitignored) | Already in vault |
| `resources/roadmap.md` | 5-day rollout checklist | Already in vault |
| `resources/templates/` | Note/task/journal/idea/inbox templates | Already in vault |
| **`resources/n8n-capture-router.json`** | UPDATED — node params validated against current n8n schemas via the n8n MCP server (was hand-guessed before; now correct) | **Pushed, needs PC pull** |
| **`resources/n8n-event-logger.json`** | NEW — Workflow 2: HA event → markdown row → append to `Smart Home/event_log.md` | **Pushed, needs PC pull** |
| `scripts/setup.sh`, `status.sh`, `process-inbox.sh`, `ha-call.sh`, `install.sh` | Bash skill helpers | Already in vault |
| **`scripts/day2-windows-setup.ps1`** | NEW — Idempotent PowerShell installer: Docker check, n8n volume + container, LAN IP discovery, prints manual steps | **Pushed, needs PC pull** |

### What was researched + verified (don't re-research)

- **Obsidian Local REST API plugin** is the right vault-write path. Plugin: `coddingtonbear/obsidian-local-rest-api`. Default ports 27123 HTTP (off) / 27124 HTTPS self-signed (on). Bearer token from plugin settings. Must change bind address `127.0.0.1` → `0.0.0.0` for Docker access.
- **n8n install method**: Docker (`docker.n8n.io/n8nio/n8n`) over `npx n8n` or n8n Desktop, because of `--restart unless-stopped`, persistent named volume, and upgrade story.
- **n8n MCP server validation** was used to confirm node param accuracy for: `webhook 2.1`, `httpRequest 4.4`, `code 2`, `switch 3.4`, `respondToWebhook 1.5`. These versions are pinned in the JSON.
- **HA Assist + LLM**: integrations work, current as of HA 2025.6+. Recommended model: Claude Haiku 4.5. Sources cited inline in `HA_ASSIST_SETUP.md`.

---

## 4. Critical facts the new chat MUST internalise

### Identity / paths

- **User**: Elliot Horton (`elliothorton5@gmail.com`).
- **Vault folder on PC**: `C:\Users\ElliotHorton\Documents\ObsidianVault` (one word, no space — confirmed via `Get-ChildItem` search).
- **Vault folder on sandbox (Linux)**: `/home/user/Obsidian-Vault-` (this is what Claude reads from in the remote execution env).
- **Vault display name in Obsidian**: `Obsidian Vault — primary` (with em-dash + spaces — important for any `obsidian://` URLs).
- **GitHub repo**: `etblues449/Obsidian-Vault-`.
- **Active branch**: `claude/adoring-allen-LY2kF` (do all work here).
- **Open PR**: #25, draft, base `main`.

### Home Assistant

- **HA URL**: `http://192.168.0.50:8123` (HA Green / HA OS).
- **HA token**: long-lived, generated from HA → profile (bottom-left) → Security → Long-lived access tokens → Create. User needs to grab one when setting `HA_TOKEN` in n8n.
- **Canonical entities** (use these, NOT the broken old names):
  - Lounge TV: `media_player.tv_jelly_beans_tv_2` — **NOT** `media_player.jelly_beans_tv` (broken).
  - Lounge lights: `light.living_room_light`, `light.left_smart_bulb`, `light.right_smart_bulb`, `light.rgbic_tv_backlight`, `light.stairs_smart_bulb`.
  - Lounge TV backlight switch: `switch.rgbic_tv_backlight_dreamview`.
  - Bedroom: ESPHome node `bedroom-2.yaml` — **NOT** `bedroom.yaml` (broken).
  - Spotify: cast via `media_player.select_source` on the lounge TV with source `"Spotify - Music and Podcasts"` — **NOT** `spotcast.start` (spotcast was broken).
  - Upstairs node: BLE/radar contention, don't trust entities from there in any automation.
  - Scene: `scene.movie_mode`.
- **Do NOT expose to HA Assist**: any of the broken entities above, plus locks/garage (safety). The Assist agent's system prompt also hard-excludes them as defence-in-depth.

### Plugins already installed in the vault config (`.obsidian/plugins/`)

- `obsidian-local-rest-api` ✅ (saves Day 3 install work)
- `obsidian-git` (PC-only; gitignore `.obsidian/workspace*.json`, `.trash`, conflict files — never install on the Fold 7)
- `remotely-save`
- `claudian`, `obsidian-importer`, `obsidian-style-settings`, `obsidian-tasks-plugin`, `obsidian42-brat`, `shell-path-copy`, `smart-connections`, `smart-context`, `smart-lookup`, `smart-templates`

Plugins installed phone-side only (not in the synced `.obsidian/plugins/` because Obsidian Sync's plugin-sync option may be off):
- QuickAdd (configured with the `Jarvis Capture` choice — ⚡ ON)
- Advanced URI

### n8n env vars (needed in §6 of `PC_SETUP.md`)

| Variable | Value |
|---|---|
| `ANTHROPIC_KEY` | `sk-ant-...` (user provides) |
| `HA_URL` | `http://192.168.0.50:8123` |
| `HA_TOKEN` | long-lived from HA |
| `OBSIDIAN_REST_URL` | `https://host.docker.internal:27124` — **MUST be `host.docker.internal`, NOT `localhost`** from inside the Docker container. `localhost` would refer to the container itself, not the PC. |
| `OBSIDIAN_REST_TOKEN` | from the Local REST API plugin settings on this PC |

---

## 5. Immediate next step — UNBLOCK THE PC

The user is sitting at the PowerShell prompt at `C:\Users\ElliotHorton\Documents\ObsidianVault`. The `.ps1` doesn't exist on the PC yet because my commits live in the GitHub remote but haven't been pulled. The vault uses Obsidian Sync (which syncs file content between the user's own devices) — but the sandbox Claude isn't an Obsidian Sync client. So changes from a Claude session must be `git pull`ed.

### Run on the PC

```powershell
git status
git branch --show-current
git remote -v
```

If `git status` works and the branch exists, then:

```powershell
git fetch origin
git checkout claude/adoring-allen-LY2kF
git pull origin claude/adoring-allen-LY2kF
```

Verify:

```powershell
Test-Path ".\Claude Memory\Skills\jarvis\scripts\day2-windows-setup.ps1"
# expect: True
Test-Path ".\Claude Memory\Skills\jarvis\docs\PC_SETUP.md"
# expect: True
```

Then run the setup (note the `&` call operator — required because of the space in "Claude Memory"):

```powershell
& ".\Claude Memory\Skills\jarvis\scripts\day2-windows-setup.ps1"
```

### Failure modes to expect

- **`git status` errors with "not a git repository"** → the vault folder isn't a git clone. Two options: (a) clone the repo somewhere else and copy the four new files into the vault folder; (b) `git init` here and connect it to the remote, then pull (more work, risk of merge mess). Ask the user.
- **`git pull` merge conflict** → the PC has uncommitted local changes. Stash → pull → unstash. Likely candidates: `.obsidian/workspace.json` (should be gitignored), notes the user edited.
- **Local REST API certificate errors in step 5** → `host.docker.internal` on the n8n side resolves to the PC; the plugin's self-signed cert on :27124 is rejected. The workflow JSON's vault-writer node already has `allowUnauthorizedCerts: true` — make sure that's preserved. Or temporarily flip plugin to HTTP :27123 for testing.

### Once the script finishes

Open `docs/PC_SETUP.md` and follow §4 → §9. The script prints the same steps but the doc has the troubleshooting table at §11 and verified sources at the end.

---

## 6. Remaining rollout

| Day | Goal | Status |
|---|---|---|
| **1** | Phone capture works in one tap | ✅ done (homescreen icon → QuickAdd → `Inbox/quick-capture.md` → Obsidian Sync) |
| **2** | Windows n8n stand-up: Docker + n8n container + Local REST API + import the Capture Router workflow + smoke-test with curl | 🟡 in progress — blocked on `git pull` |
| **3** | End-to-end Capture Router test: phone POSTs to n8n → classifier routes → vault note appears → also test the `ha_action` path with a safe service call (e.g. `light.turn_on light.living_room_light`) | not started |
| **4** | HA Assist + Claude conversation agent: add the Anthropic integration, build the Voice Assistant pipeline, expose the canonical entities with aliases, paste the system prompt, test from HA Companion app on the phone — follow `docs/HA_ASSIST_SETUP.md` | not started |
| **5** | Polish: Filesystem-node fallback wired to the vault-writer's error output (so captures don't fail when Obsidian is off), Event Logger workflow imported + HA `rest_command.jarvis_event` automation, daily 8AM digest workflow (Schedule trigger → list yesterday's inbox + events → Claude summary → push notification + `Journal/YYYY-MM-DD.md`) | not started |

### Future workflows (post-launch, parked)

- Weekly review (Sunday 6PM)
- HA pattern miner (read `event_log.md`, propose automations)
- Tasker on the phone for voice → n8n webhook (alternative to current homescreen icon path)

---

## 7. Decisions to honour (don't relitigate in the new chat)

1. **Vault writes go through Obsidian Local REST API on the PC**, then Obsidian Sync. NOT git. NOT the n8n GitHub node. NOT writes from the phone directly.
2. **Live HA voice control is HA Assist + LLM**, not n8n. n8n's HA branch is only for captured `ha_action` items.
3. **Claude Haiku 4.5** is the HA conversation agent. Step up to Sonnet 4.6 only if Haiku is consistently too thin for the user's commands. Don't switch to OpenAI/Gemini unless the user asks.
4. **Spotify** is `media_player.select_source` with source `"Spotify - Music and Podcasts"`. Spotcast is broken — do not propose it.
5. **n8n on Docker** (`docker.n8n.io/n8nio/n8n`), not n8n Desktop, not `npx n8n`.
6. **Phone offline fallback** = the existing QuickAdd → `Inbox/quick-capture.md` path. Always works, no LLM, drained later by `scripts/process-inbox.sh`.
7. **Branch discipline**: all work on `claude/adoring-allen-LY2kF`. PR #25 is the destination for all related commits.

---

## 8. Gotchas already discovered (don't repeat)

| Gotcha | Resolution |
|---|---|
| Hand-typed `obsidian://` URLs use the vault folder name, but the **real vault name** in Obsidian is `Obsidian Vault — primary` (em-dash + spaces). Hand-typed URLs failed silently. | Always use Advanced URI's `Copy URI for command` → pick "Don't specify a file" → filter the command → paste. Obsidian writes the URL with the correct vault name. |
| Chrome address bar treats `obsidian://` as a search query (DNS NXDOMAIN). | Don't test URLs in Chrome. Use Shortcut Maker's custom Intent or Advanced URI's copy command. |
| Shortcut Maker's **Website** tile strips the `:` from custom schemes. | Use the custom **Intents** tile instead — tap the `➕` icon top-right to open a blank intent (the listed items are prebuilt system intents, useless here). |
| Shortcut Maker's "Activities" tile lists app activities, not a URI builder. Easy to wander into by mistake. | Custom URI → **Intents → ➕**, fill Action `android.intent.action.VIEW`, Data = the URL. |
| Inside n8n's Docker container, `localhost` = the container, not the PC. Vault writes silently failed when using `localhost`. | `OBSIDIAN_REST_URL = https://host.docker.internal:27124`. Documented in `PC_SETUP.md` §6 and §11. |
| Obsidian Local REST API binds to `127.0.0.1` by default. Docker can't reach it. | Change bind address to `0.0.0.0` in plugin settings. |
| Self-signed cert on :27124 fails by default in n8n HTTP node. | The workflow JSON's vault-writer node has `allowUnauthorizedCerts: true`. If anyone rebuilds the node by hand, re-enable that option, or switch the URL to `http://...:27123` after enabling HTTP in the plugin. |
| There was a leftover `Jarvis/Inbox/quick-notes.md` from earlier experimentation, parallel to `Inbox/quick-capture.md`. Two inboxes = confusion. | User is deleting `Jarvis/` from the phone tonight. Folder doesn't exist in the sandbox snapshot — phone-side only. |
| `obsidian-git` plugin on mobile = unstable (per maintainer). | Never enable it on the Fold 7. PC-only. |
| Sandbox container is a **static snapshot** of the vault, not a live Obsidian Sync client. Recent phone captures won't appear here. | When you need the live state, use the n8n write path or have the user paste content. Don't trust this snapshot for "is X file there?" beyond what's committed in git. |

---

## 9. Open TODOs / known gaps

- 🟡 **Filesystem-node fallback** on the vault-writer's error output (Day 5 polish). Workflow JSON has it noted in the `notes` field but doesn't include the fallback node yet. Add after the happy path tests green.
- 🟡 **HA `rest_command.jarvis_event`** (Day 5) — the HA-side automation that POSTs to the Event Logger workflow's webhook. Not yet documented step-by-step.
- 🟡 **Daily digest workflow** (Day 5) — Schedule trigger → Claude summary → push notification + journal write. Not built.
- 🟡 **Tasker voice → webhook** path (deferred, optional) — currently the homescreen icon + Google Assistant routine cover the voice case. Tasker would give richer parameter passing if desired.
- 🟢 **Remote captures via Tailscale / Cloudflare Tunnel** — out of scope. Mention only if user asks.

---

## 10. Git / PR state

- Branch: `claude/adoring-allen-LY2kF`
- Latest commit pushed: `073fba9` ("Add PC_SETUP.md — Day 2/3 Windows checklist")
- Preceding commits on this branch (most recent first):
  - `073fba9` — PC_SETUP.md
  - `e69bcb2` — HA_ASSIST_SETUP.md + validated n8n-capture-router.json + n8n-event-logger.json + day2-windows-setup.ps1
  - `46aaea6` — Correct Jarvis design from verified research
  - `b7c3bd1` — Make Jarvis runnable out of the box
  - `3866899` — Add Jarvis skill: phone-driven capture + HA routing
- Open PR: [#25 (draft)](https://github.com/etblues449/Obsidian-Vault-/pull/25)
- Other repos cloned for this user (not in scope this session unless asked): `etblues449/Claude-Github`, `etblues449/Claude-Skills-pluggins-connections-`, `etblues449/esphome-devices`, `etblues449/App`.

---

## 11. Quick-start for the new chat

If you're a fresh Claude session opening this for the first time:

1. **Read §1, §2, §4, §5** at minimum. Then skim the rest.
2. **Invoke the `jarvis` skill** (it's a Claude Code Skill registered in this vault — `Claude Memory/Skills/jarvis/SKILL.md` is its entry).
3. **Confirm with the user** which device they're on right now (PC? Phone? Both?) and where in the rollout they are. Default assumption: PC, blocked on git pull, want to proceed with Day 2.
4. **Execute §5** — get the `git pull` working, then hand off to `docs/PC_SETUP.md`.
5. **Don't relitigate** the architectural decisions in §7. The user worked through them already; revisiting wastes time. New questions are welcome; relitigation isn't.
6. **Token discipline**: the user is paying for Anthropic calls in n8n (cheap, but real). Keep the classifier prompt tight; keep the HA agent on Haiku unless we have a clear reason to upgrade.

Good luck. Continue the build.
