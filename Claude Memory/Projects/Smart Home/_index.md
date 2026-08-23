# Smart Home — Project Index

## Goal
Deeply automated, presence-aware home across lounge, bedroom, upstairs using HA Green + ESP32, with an on-device agentic JARVIS layer driving it from the Fold 7.
**The full roadmap to that goal now lives in [[MASTER_PLAN]] (v2, 2026-08-04) — phased plan, complete hardware inventory, room-by-room end state, success criteria.**

## Status
- **2026-08-22: JARVIS v2 interface + auto-start BUILT & OFFLINE-VERIFIED (32/32 assertions) — on-device smoke test is the open gate.** The six-tab web UI is replaced by a voice-first single screen (live transcript, amber reactor control, one Memory/Tools/Status sheet), built to the 2026 ChatGPT-Voice / Gemini-Live convergence (orb screens abandoned industry-wide for voice + live transcript). New zero-dep launcher `jarvis2/server.mjs` on **:1875** fronts `jarvis-app.mjs` (:8737), proxies `/api/*` with streaming preserved chunk-for-chunk, and **auto-spawns the core if it's down**; Termux:Boot script + PWA home-screen install mean **no more typing into Termux to start the app**. Package **v2.0.1** SHA-256 `f89a2deae4e2af76c9148a7465e1207164eeb240e984624f6b057eedb3601147` *(v2.0.1 same day: pattern audit found the launcher bound to 0.0.0.0 — now loopback-only by default, `JARVIS2_BIND` env for deliberate LAN use; 29/29 re-verified. Supersedes `13471b12…` and `8923a59a…`. Artifacts live in the vault: `Assistant Core/packages/`.)*; zero existing jarvis-core files modified (delete `jarvis2/` + boot script = full revert). Phone-side always-on wake word deliberately deferred to the ESPHome satellites (Samsung audio-focus + Doze). See [[sessions/2026-08-22]] + `JARVIS_V2_REPORT_2026-08-22.md` (claude.ai Project).
- **Master plan + HA diagnostics toolkit: BUILT (2026-08-01, PR #71)** — [[MASTER_PLAN]]; `Assistant Core/ha-diagnostics/ha-doctor.mjs` (read-only, zero-dep, 13-section HA audit — tested against a mock hub; needs an ADMIN long-lived token for template/error-log/check_config sections). Dashboard audit: [[diagnostics/2026-08-01-dashboard-audit]] — canonical dashboard's 4 stale `media_player.jelly_beans_tv` refs **fixed** to `media_player.tv_jelly_beans_tv_2`; `dashboard/README.md` now marks the canonical file.
- **2026-08-04: AI-Mode camera transcript ROOT-CAUSED & CLOSED; MASTER_PLAN v2; full-home diagnosis doc** — the Google AI Mode `0x106` loop was a *power* problem (CH32V003 EXIO3), never pins; the vendor's own Arduino example was found (`ESP_EYE` slot carries the real pins — vendor-file vs stock-file trap) and an adapted sketch is **compile-proven** (esp32 core 3.3.11, 32% of 3MB app; delivered as `WS_S3_CAM_OV3660_WebServer.zip`). **[[hardware/landing_ai_cam_2]] authored + full `esphome config` validation exit 0** for reviving board #2 (which likely carries the Arduino-experiment firmware — hence `landing_ai_cam_2` offline). **Option B runbook gap found + fixed:** PyPI ESPHome (≤2026.6.5) lacks `waveshare_io_ch32v003` — pin it from the esphome repo at tag `2026.7.1` (addendum in [[hardware/ai_cam-compile-runbook]]). Consolidated diagnosis: [[diagnostics/2026-08-04-full-home-diagnosis]] (ranked P0–P3 repair queue). See [[sessions/2026-08-04]].
- **⚠️ ES7210 component `ref: master` consumption is BROKEN until PR #71 merges** — the `esphome/components/es7210/` commits exist only on the PR branch (verified `git merge-base` 2026-08-01). The flashed ai_cam keeps working; any re-compile pulling `ref: master` fails until merge. *(Resolved 2026-08-02: PR #71 MERGED — kept for history.)*
- **⚠️ Capture drift (found 2026-08-01):** newer captures land in root `Inbox/` (5 files up to 2026-07-09) but `runner.mjs` + `unified-backend.js` read `JARVIS/Inbox/` only — those captures are invisible to the engine. Fold into the Phase-2 capture router fix. *(Vault side FIXED 2026-08-02; phone leg still open.)*
- Lounge: complete (~19 automations) — **⚠️ superseded by the 2026-08-02 registry evidence: 8 automations exist hub-wide; back up the hub config before trusting either number**
- Bedroom: operational (bedroom-2.yaml)
- Upstairs: BLE/radar contention unresolved
- **AI Cam (Waveshare ESP32-S3-CAM-OV3660, node `ai_cam` @ 192.168.0.199): COMPLETE ✅ — camera + speaker + microphones + wake word (2026-07-29)** — OV3660 streaming 800x600 MJPEG (`:8080`) + snapshot (`:8081`), live in Frigate with recording + person detection. ES8311 speaker doing TTS. **ES7210 dual mics working via a custom ESPHome component written from scratch** (`esphome/components/es7210/` in this vault) — STT confirmed transcribing verbatim in 0.04s. Plus microWakeWord "Hey Jarvis", both hardware buttons, and status LED. Full build log, register sequences and all three blockers: [[sessions/2026-07-23-ai-cam-handoff]] · session summary: [[sessions/2026-07-29]].
- **⚠️ microWakeWord regression (2026-08-02, EXPLAINED):** current ai_cam build has no mWW — the full wake-word config **OOMs the HA Green's compiler** (TFLite build; `cc1plus` killed). Target config preserved at [[hardware/ai_cam]]; options = compile off-box on the PC (recommended now — **runbook patched 2026-08-04, see the PyPI-gap addendum**) or the budgeted **N100 (~£140)**. Live MAC = `28:84:85:49:83:C8`. Push-button voice works meanwhile. See [[sessions/2026-08-02]] + [[sessions/2026-08-01-hagreen-handoff]].
- **FIRST FULL HA DIAGNOSIS: RUN 2026-08-02 ✅** — [[diagnostics/2026-08-02-ha-doctor]] via Nabu Casa. Core **2026.8.0b2 beta**, config valid; **156/520 entities unavailable** (dead nodes); **only 1 of 4 voice satellites online**; **8 automations live** (not ~19), 3 stale since May; **canonical TV entity `tv_jelly_beans_tv_2` NO LONGER EXISTS** (decision needed between `jelly_beans_tv_tv_jelly_beans_tv` and `jelly_beans_tv_3`); area **"Dinning Room" is a typo**; 10 actionable entities area-less. **Entity naming settled: live registry uses the `living_room_ai_cam_*` PREFIXED form** — Entity Reference below updated. **Consolidated + expanded 2026-08-04:** [[diagnostics/2026-08-04-full-home-diagnosis]].
- **New/corrected node records (2026-08-02):** porch servo/switch node at **.206** (new, offline) · bedroom presence node = **.171** offline (earlier records called .171 "upstairs" — reconcile) · cctv_cam at .234 is a **XIAO**, offline · lounge node physically sits in the **kitchen** · **`landing_ai_cam_2` device exists** — the 2nd CAM-OV3660 was already provisioned (Landing), currently offline. **2026-08-04: revival config ready → [[hardware/landing_ai_cam_2]] (first flash USB — the board likely runs Arduino-experiment firmware, no ESPHome OTA).**
- **ES7210 ESPHome component: WRITTEN & WORKING** — did not exist in ESPHome before 2026-07-27. Ported from Espressif `esp_codec_dev` v1.6.2. Lives at `esphome/components/es7210/` in this vault, consumed over git. **Reusable on any ES7210 board** — including the ESP32-S3-AUDIO-Board at .216.
- **On-device JARVIS terminal (Fold 7): operational** — Claude Code pinned to v2.1.112 in Termux, auto mode, filesystem MCP scoped to `~/jarvis`, vault cloned on-device, Termux:API hardware tools live (battery + notification verified). See [[sessions/2026-06-13]].
- **JARVIS Phone-Native v1: complete & deployed** — Capture (text→Inbox), HA control (REST wrapper), git sync (branch-aware), daily digest (cron), one-tap Termux:Widget. Fully tested on Fold 7 (install.sh runs clean, capture + HA control working, cron scheduled). PR #52 merged to master 2026-06-16. See [[sessions/2026-06-16]] + QUICK_START.md.
- **JARVIS v3: Obsidian-native (DEPLOYED & LIVE)** — Obsidian-native brain replacing Termux. The vault IS the system: Capture (Alt+J) → Claude classifies → routes to folder; Ask (Alt+A) → Q&A grounded in last 20 captures; Digest (Alt+D) → daily 24h summary to Journal/. All run *inside Obsidian* via QuickAdd scripts calling Claude API (`claude-opus-4-8`) via `requestUrl`. Dashboards (Master Dashboard, Finance Tracker, Projects Dashboard) auto-update via Dataview. Obsidian Sync + Git backup. Secrets device-local (localStorage), never synced. **Complete 2026-06-20**: 14 docs + 6 scripts + home-screen shortcuts; all 3 core macros tested & working on Fold 7; digest running daily; Ask returning grounded answers. See [[sessions/2026-06-19]].
- **JARVIS Phone-Native v1/v2 (Termux/bash): ARCHIVED** — retired from the daily loop 2026-06-16, kept as emergency CLI only. See `Claude Memory/Skills/jarvis/phone/_ARCHIVED.md`.
- **RuView WiFi-CSI sensing: live & phone-free** — ESP32-S3 node 3 (192.168.0.227) streams CSI; local HA add-on "RuView CSI Bridge" on the hub publishes 6 MQTT entities (presence, breathing, heart-rate, motion, persons, anomaly) on the Smart Home dashboard. HA hub real IP = **192.168.0.200**. See [[sessions/2026-06-08]]. *(2026-08-01 audit: the 6 MQTT entities appear in NO vault dashboard YAML — either a UI-managed dashboard carries them or this claim is stale; ha-doctor confirms which.)*
- **⚠️ CORRECTION 2026-08-02 — the scheduled skill engine has never run on schedule.** The two "LIVE" claims below describe the *manual* path only. All 11 scheduled GitHub Actions runs started late enough to fail `runner.mjs`'s exact-London-hour guard → exit 0, `Commit and push` skipped, run reports **success**, nothing written. Every briefing/connection/synthesis/pattern file on master came from n8n (2026-07-07, 07-08) or a manual `workflow_dispatch`. Full evidence incl. job log: [[../../2026-08-02-jarvis-state-of-the-system]].
- **✅ FIXED 2026-08-02 — engine repaired, capture path repaired.** The exact-hour guard is gone: `runner.mjs` now asks *"has this period's output already been written?"* (`shouldRun` + per-skill `done(ctx)`), which is DST-safe, delay-safe and self-healing. The paired BST/GMT crons are now two attempts at the same period. **Capture Router (Skill 2) BUILT** — `.github/workflows/jarvis-2-capture-router.yml`, `on: push` to both inbox paths, deterministic rule table (no Groq call), junk quarantine to `JARVIS/Inbox/_rejected/`, `#belief`/`#decision` routing, SHA-1-keyed idempotency. The 4 captures stranded in root `Inbox/` are swept in, and the `|| "Inbox"` fallback that stranded them is fixed in both copies of `jarvis.js`. 26/26 offline tests green, including a regression test proven to fail on the old guard. **Still open: the phone leg** — Tasker's variable bug and its paid n8n webhook are unchanged.
- **Seven-Skill Active Vault: LIVE (2026-07-04)** — all 5 n8n workflows published on jellybean1875.app.n8n.cloud: Note Router (capture, continuous), Morning Brief (daily 7am), Pattern Detector (Mon 8am), Connection Finder (Sun 2pm), Weekly Synthesis (Fri 6pm). Each: Schedule → GitHub reads → Claude Opus 4.8 → commit to vault, Europe/London tz. All four test-executed green — first automated reports committed (briefings/, connections/, synthesis/, patterns.md). Skills 5 & 7 (Belief Tracker, Decision Intelligence) manual via `#belief`/`#decision` tags → beliefs.md / decisions.md (both seeded). Importable JSONs: `Assistant Core/n8n/`. See [[sessions/2026-07-04]].
- **Seven-Skill engine: MIGRATED to £0 (GitHub Actions + Groq) — 2026-07-08, PR pending** — the 4 scheduled skills (Morning Brief, Connection Finder, Weekly Synthesis, Pattern Detector) are re-implemented as free GitHub Actions running a shared Node runner (`Assistant Core/jarvis-skills/runner.mjs`) that calls **Groq** (`llama-3.3-70b-versatile`, free tier) instead of the paid Claude API, and commits back to master via a single serialized rebase-retry write path. DST-correct Europe/London guards; 9/9 offline tests green. Replaces paid n8n.cloud + Claude API → satisfies C1 (£0 forever). **User action: add `GROQ_API_KEY` repo secret, then Run-workflow each once to verify** (see `Assistant Core/jarvis-skills/MIGRATION.md`). Event-driven skills 2/5/7 (capture router, belief/decision gates) have a documented £0 Phase-2 path (GitHub `on: push` router) — not yet built.
- **Voice agent (Layer B interface): LIVE & £0** — `jarvis-voice-lovat.vercel.app` (Vercel Hobby, free) using Groq `llama-3.1-8b-instant` + Browser Web Speech API (STT/TTS), reads the vault via GitHub API (octokit). Deployed from Termux. Complementary to the Obsidian-native brain (Layer A), not competing. *(Recorded here 2026-07-08 per handoff §12.7 reconciliation.)*
- **JARVIS Carousel: deployed on Vercel** — 7-slide Next.js presentation (JARVIS-Carousel/ in vault, monorepo root dir on Vercel project `jarvis-carousel`). Production branch = master.

## Key Decisions
- bedroom-2.yaml canonical (bedroom.yaml broken)
- **Canonical TV entity: `media_player.jelly_beans_tv_3` (2026-08-02)** — decided from live registry evidence: device_class `tv`, full source_list (Bose Soundbar/Fire Stick/PS5/apps), features 221117. `media_player.jelly_beans_tv_tv_jelly_beans_tv` is the DLNA shell (dlna_dmr, no sources) — do not use. **Supersedes** `tv_jelly_beans_tv_2`, which no longer exists in the registry. Dashboard + ha-doctor updated.
- **Area "Dinning Room" renamed to "Dining Room" (2026-08-02)** — typo fixed live via the registry API; was the likely cause of the dining-room `no_valid_targets` voice miss.
- **Frigate: RE-ADOPTED (2026-07-23)** — previously ruled out as too heavy, but now running on HA Green with 3 cameras (ai_cam + cctv_cam .234 + porch .240), CPU detector, MQTT to .200. Config `/config/frigate.yaml`. ai_cam tile confirmed live. Runs fine at 800x600/5fps per camera. Supersedes the earlier "Frigate ruled out" decision.
- **For Waveshare boards: clone the vendor repo, don't trust the product image (2026-07-23)** — `git clone https://github.com/waveshareteam/ESP32-S3-CAM-OVxxxx.git` + the BSP managed component `waveshare/esp32_s3_cam_ovxxxx` (ESP Component Registry) are the authoritative pinout. The Amazon "Interface Definition" image gave a **wrong audio pin map** that cost ~4h chasing static/silence; the vendor BSP settled it in 2 minutes. Camera pins from the image happened to be right; audio pins were not. **Supersedes the earlier claim that the Interface Definition image is authoritative.**
- **Waveshare ESP32-S3-CAM: camera power is expander-gated** — the OV3660 will not init (`ESP_ERR_NOT_SUPPORTED`, garbage PID) until CH32V003 EXIO3 (PWDN net) is driven LOW. Amp enable is EXIO4 driven HIGH (empirically confirmed). Sibling ESP32-S3 cam boards do NOT match this board.
- **In vendor Arduino examples, model defines lie (2026-08-04)** — Waveshare's own `02_CameraWebServer` repurposes the `CAMERA_MODEL_ESP_EYE` slot in its bundled `camera_pins.h` to carry this board's real pins. Same define + stock Espressif files = wrong pins. Never judge a sketch by its model define; check whose `camera_pins.h` is in the folder.
- **PyPI ESPHome trails the HA add-on channel (2026-08-04)** — pip tops out at 2026.6.5 (no `waveshare_io_ch32v003`) while the Green runs add-on 2026.7.1. For off-box builds, pin official components from the esphome repo by release tag.
- **AI Cam audio: ESP32 is I²S master, ES8311 is SLAVE** — per BSP (`I2S_ROLE_MASTER` on the channel, `.master_mode = false` on the codec). **Do NOT set `force_master: true`** on this board. A log line reading `I2S Role: SLAVE` is correct here.
- **ESPHome I²S: ONE bus, multiple children (2026-07-27)** — declaring two `i2s_audio` buses on the same MCLK/BCLK/LRCK pins is a hard error ("Pin N is used in multiple places"). Correct pattern is a single bus with speaker and microphone both referencing the same `i2s_audio_id`.
- **ESPHome I²S is a mutex, not full duplex (2026-07-28)** — `I2SAudioMicrophone::start_driver_()` opens with `if (!this->parent_->try_lock()) return false;`. Only one direction can hold the bus. **`timeout: never` on a speaker holds the bus forever and permanently blocks the microphone** — must be a real value (500ms). Consequence: **no barge-in**, and continuous wake-word listening blocks non-conversational TTS.
- BLE + mmWave on same ESP32 = contention; split nodes
- **Claude Code on Termux: pin to v2.1.112, disable auto-updater** — every release from v2.1.113 onward pulls a 233 MB glibc native binary that Android kills mid-download. Disable via `DISABLE_AUTOUPDATER=1` in `~/.bashrc` **and** `autoUpdates: false` in `~/.claude/settings.json`, or it silently re-breaks itself.
- **git MCP: use `uvx mcp-server-git`, not npx** — the npm version won't connect. Falling back to the `git` CLI is fine.
- Interactive `read -s` token paste fails on mobile; let `git` prompt for credentials.

## Next Actions
- [ ] **JARVIS v2 — run the on-device smoke test + one-time boot steps** (Termux:Boot from F-Droid opened once; battery Unrestricted for Termux + Termux:Boot; Chrome → localhost:1875 → Install; then the 5-minute gate in `JARVIS_V2_REPORT_2026-08-22.md` §6 incl. the cold-reboot check)
- [ ] **Push the Fold's `jarvis-core` (now incl. `jarvis2/`) to GitHub `main`** — last recorded push **2026-08-06** (CLAUDE.md change history); 16 days of on-device work unbacked at session time. SSH key `fold7-termux` is already set up.
- [x] **Merge PR #71** — MERGED 2026-08-02 (`bd91acb`)
- [x] **Run ha-doctor** — first full run 2026-08-02 via Nabu Casa: [[diagnostics/2026-08-02-ha-doctor]] (naming settled, TV decided, areas mapped). Remaining: one LAN run for direct node probes + error_log
- [x] **Analyse + close the AI-Mode camera transcript** — root-caused (power, not pins); corrected sketch compile-verified and delivered; guide + runbook addenda committed (2026-08-04). See [[diagnostics/2026-08-04-full-home-diagnosis]] Part 1
- [ ] **Get "Hey Jarvis" back — run the Option B compile**: [[hardware/ai_cam-compile-runbook]] on the PC (~15 min, OTA, no USB). **Apply the 2026-08-04 addendum first** (pin `waveshare_io_ch32v003` from the esphome repo @ 2026.7.1 — PyPI pip install won't have it)
- [ ] **Flash board #2 with [[hardware/landing_ai_cam_2]]** — config authored + validated (exit 0) 2026-08-04; add `landing_api_encryption_key`/`landing_ota_password` secrets; **first flash via USB or web.esphome.io** (board likely runs the Arduino-experiment firmware — no ESPHome OTA); confirm .198 free or adjust
- [ ] **Back up hub-side config into the vault** (`automations.yaml`, `bedroom-2.yaml`, `frigate.yaml`, scenes/scripts → `ha-config/`) — the lounge automations exist nowhere but the hub. **Include the CURRENT `ai_cam.yaml` from ESPHome Builder** — the flashed config (tuning entities, XCLK 10 MHz, quality 10) was never captured. **P0 in the 2026-08-04 repair queue.**
- [ ] **Re-enable microWakeWord on ai_cam** — wake-word selects unavailable on the current build (see [[sessions/2026-08-02]]). Order matters: pull the live `ai_cam.yaml` into the vault FIRST, then re-add `micro_wake_word` and flash — don't reconstruct from memory
- [x] **AI Cam camera** — streaming, Frigate, recording, person detection (2026-07-23)
- [x] **AI Cam speaker** — corrected pins from vendor BSP; TTS confirmed audible (2026-07-23)
- [x] **AI Cam ES7210 mics** — custom ESPHome component written, STT verified (2026-07-27/28)
- [x] **AI Cam microWakeWord + buttons + LED** (2026-07-29)
- [ ] **AI Cam — light entity naming**: Assist returns `no_valid_targets` for unmapped rooms (e.g. "dining room"). Fix by creating the Area and assigning lights, or by adding aliases in Settings → Voice assistants → Expose. Best: assign lights to the **Living Room** area (where ai_cam lives) so "turn on the lights" resolves with no name at all. *(Area typo fixed 2026-08-02; the 10 area-less actionables are listed in the 2026-08-04 diagnosis §2.6.)*
- [ ] **AI Cam — unused hardware**: microSD (CLK 16 / CMD 43 / D0 44, needs `sd_mmc_card` external component — **now in the target config + landing yaml via `sdmmc`**) · LCD 320x240 QSPI (DATA0 1, PCLK 5, DC 3, CS 6; RST EXIO2, backlight EXIO1 PWM — **panel controller not yet identified**) · touch (RST EXIO0, INT GPIO9) · battery ADC via CH32V003 (needs component extension)
- [ ] **AI Cam — camera EXIO3 power-up race**: intermittent `ESP_ERR_NOT_SUPPORTED` at boot when the OV3660 (0x3C) hasn't woken before the camera probes. Clears on reboot. **Fix proposed 2026-08-01 (blocking `on_boot` settle delay — see the hardware guide addendum) — NOT YET FLASHED; verify with the 10-reboot protocol.**
- [x] **Port config to 2nd CAM-OV3660 board** — [[hardware/landing_ai_cam_2]] authored + validated 2026-08-04 (flashing tracked separately above)
- [ ] **AI Cam — verify cctv_cam (.234) + porch (.240)** are powered; may be hardware-down not config
- [ ] **AI Cam porch deployment** — power-bank swap model + IP67 enclosure + bracket (~£80–110). Board is battery-capable (ETA6098 charger, J4 GH1.25). **Check J4 polarity with a meter first — no reverse protection.** ~9–12h streaming on 3000mAh.
- [ ] Optional: expose AI Cam speaker as a Music Assistant target
- [x] **GitHub PAT rotated** (2026-06-15) — old exposed token revoked, new fine-grained token in Windows Credential Manager
- [x] **JARVIS v3 Obsidian-native: complete** (2026-06-19) — all docs, scripts, config + phone setup ready
- [ ] **User: Run INSTALLATION CHECKLIST.md on Fold 7** — steps 1-9, ~15 min total
- [ ] **User: Test all 5 macros** — Capture, Ask, Digest, Expense, Weekly (per step 9 of checklist)
- [ ] Fix upstairs BLE/radar contention
- [ ] **Apply .171 IP collision fix** — upstairs → .207 via ESPHome OTA. Full plan: [[fixes/2026-06-14-ip-collision-fix]]
- [ ] DHCP reservation: RuView node MAC e0:72:a1:e7:03:60 → .227
- [ ] Delete ghost "Upstairs" (.207) config in ESPHome Builder (board now runs CSI firmware)
- [ ] Order: 18650 cells, 5V servo rail
- [x] **Install Termux:Widget + JARVIS buttons** (2026-06-16) — jarvis, sync, digest shortcuts created; widget installed on home screen.
- [ ] Copy `JARVIS-CHEATSHEET.md` into `~/jarvis`
- [ ] Optional later: upgrade Claude Code to native binary via the ferrum patcher, on wifi + wakelock
- [x] **Seven-skill n8n automation: imported, tested, published** (2026-07-04)
- [ ] **Fix empty Tasker captures** — "Ask JARVIS" shortcut has fired 3× with placeholder "your note here"; input variable not reaching the webhook
- [ ] Verify first scheduled runs land: Synthesis Fri 6pm, Connection Sun 2pm, Patterns Mon 8am, Brief daily 7am
- [ ] Optional: add `#belief`/`#decision` tag routing to Note Router (skills 5 & 7 auto-capture)
- [ ] **£0 migration (GitHub Actions + Groq) — merge PR, then: (1) add `GROQ_API_KEY` repo secret, (2) Actions → Run-workflow each of the 4 skills once to verify, (3) deactivate the 4 n8n.cloud workflows.** Guide: `Assistant Core/jarvis-skills/MIGRATION.md`
- [ ] **Build Phase-2 capture router** (skills 2/5/7 as a GitHub `on: push` router → removes the paid n8n webhook; also fixes the empty-Tasker-capture bug via a junk filter)

## Reference
- **[[MASTER_PLAN]] v2 (2026-08-04)** — the whole-home roadmap: inventory, room-by-room end state, phases 0–5, buy list, success criteria
- **[[diagnostics/2026-08-04-full-home-diagnosis]]** — camera transcript root-cause + full HA app diagnosis (entities/automations/scenes/dashboards/voice/areas/people/updates/resilience) + ranked P0–P3 repair queue
- **HA diagnostics** — `Assistant Core/ha-diagnostics/` (ha-doctor.mjs + README); reports land in `diagnostics/`. Dashboard audit: [[diagnostics/2026-08-01-dashboard-audit]]
- **Vendor-BSP verification 2026-08-01** — all 22 pin/expander claims CONFIRMED; full CH32V003 register map (dir 0x02 / out 0x03 / in 0x04 / PWM 0x05 / ADC 0x06) + EXIO function table now in the hardware guide — unlocks battery ADC + LCD backlight backlog items. **Re-verified 2026-08-04 against the vendor Arduino example — zero mismatches.**
- **AI Cam (Waveshare ESP32-S3-CAM-OV3660) full handoff** — pin map (see CORRECTION + RESOLVED sections for the authoritative audio pins and working config), I²C scan, discoveries, full audio debug log, ES7210 component port, battery research: [[sessions/2026-07-23-ai-cam-handoff]]
- **ES7210 ESPHome component** — `esphome/components/es7210/` in this vault. Ported from Espressif `esp_codec_dev` v1.6.2 (`device/es7210/es7210.c` + `es7210_reg.h`). Consume via:
  ```yaml
  external_components:
    - source:
        type: git
        url: https://github.com/etblues449/Obsidian-Vault-
        ref: master
        path: esphome/components
      components: [es7210]
  ```
- **Waveshare ESP32-S3-CAM-OV3660 setup guide (corrected)** — full IDE + pinout + the CH32V003 EXIO3 power-gating fix that clears `0x106`; proven ESPHome config + a **compile-verified** Arduino path (2026-08-04 addendum). [[hardware/Waveshare ESP32-S3-CAM-OV3660 — Arduino IDE Setup (CORRECTED)]]
- **[[hardware/landing_ai_cam_2]]** — validated ESPHome config for CAM board #2 (Landing), incl. the off-box `waveshare_io_ch32v003` pin
- **Waveshare vendor sources for this board** — repo `github.com/waveshareteam/ESP32-S3-CAM-OVxxxx` (examples `01_simple_video_server`, `02_esp_sr`, `03_audio_play`, `04_dvp_camera_display`, `05_lvgl_brookesia`, `06_usb_host_uvc`; **plus `examples/Arduino-v3.2.0/` — the official Arduino examples incl. `02_CameraWebServer`**; plus `Schematic/ESP32-S3-CAM-XXXX-schematic.pdf`) and BSP component `waveshare/esp32_s3_cam_ovxxxx` on components.espressif.com. Read the BSP header for any pin question on this board.
- **ESP32-S3-AUDIO-Board far-field voice** — [[hardware/ESP32-S3-AUDIO-Board — Far-Field Voice Guide]] · [[hardware/ESP32-S3-AUDIO-Board.esphome.yaml]]. Board = ES8311 + ES7210 4-ch, dual mic. **The new ES7210 component above applies to this board too.** AEC cancels the board's *own* audio but **cannot** cancel an *external TV* (no reference signal). (2026-07-15)

Full detail: [[smart_home]]
Sessions: [[sessions/2026-08-22]] — JARVIS v2 UI + auto-start built & offline-verified · [[sessions/2026-08-04]] — camera transcript closed (compile proof), landing config, MASTER_PLAN v2, full diagnosis · [[sessions/2026-08-02]] — live ai_cam evidence + first full HA diagnosis · [[sessions/2026-08-01-hagreen-handoff]] · [[sessions/2026-07-29]] — AI Cam complete: mics, wake word, ES7210 component · [[sessions/2026-07-23-ai-cam-handoff]] — full AI Cam build log · [[sessions/2026-06-13]] — on-device JARVIS stand-up · [[sessions/2026-06-08]] — RuView CSI node fixed



## DECISION 2026-08-22 - the six-tab jarvis-app.mjs (port 8737) is THE app. jarvis2 v2 is shelved.

After seeing v2 on 1875, Jelly Bean rejected it. Locked decision, do not relitigate: the
existing six-tab core UI at http://localhost:8737/ (jarvis-core/jarvis-app.mjs) is the daily
driver and the thing to improve going forward. Improvements happen ON THIS app.

- v2 launcher stopped and its Termux:Boot script (~/.termux/boot/jarvis-boot) removed ->
  archived to ~/_archive_jarvis_20260822/boot/. At boot only start-jarvis.sh (-> 8737) runs.
- v2 code left in place at jarvis-core/jarvis2/ (harmless, unwired); full archive of old
  JARVIS attempts is a separate pending cleanup step.
- The jarvis2 v2 package/report from earlier today remain in the vault for history only,
  NOT the product. Any future session: build on jarvis-app.mjs, not jarvis2.
- Still TODO: archive the 546M ~/jarvis sprawl (2nd vault clone + gstack + openclaude) and
  the stray vault clones -> one canonical vault (~/Obsidian-Vault-, master).



## Phase 0 COMPLETE 2026-08-22 — honest self-knowledge from the live registry

First step of the North-Star roadmap (see JARVIS strategy report). Shipped
`self-knowledge.mjs` into jarvis-core (SHA-verified via vault base64 -> curl).
Reads lib/tools.mjs allTools() and emits SELF_KNOWLEDGE.md + self-knowledge.json;
`--check` is a drift gate (exit 1 if docs disagree with the live registry).
Additive only: no existing core file changed.

**Caught on first run:** the registry has **13 callable tools, not 14**. tools/
has 14 .mjs files but `vault-lib.mjs` is a shared HELPER (exports safePath/SKIP_DIRS),
not a registered tool — so the honest count is 13: database, forget, ha_control,
ha_list, ha_state, pc_control, remember, set_alarm, set_timer, update_memory,
vault_list, vault_read, vault_search. This is exactly the "documented != running"
gap the phase exists to close. Drift check: OK on device.

Package: Assistant Core/packages/phase0.tar.gz.b64 + install-phase0.sh
(SHA c49c93b51fe3f76612c8c4ca831b265ffe2957e712648137477dd9cb89ed4172).

**Next (separate approval):** wire self-knowledge.json's capabilitiesBlock into the
system prompt in lib/brain.mjs / the four prompt-building files, so JARVIS USES this
honesty. Then Phase 1 (security: injection gate + kill switch + tool-approval).



---

## 2026-08-23 — STATUS SUPERSEDED + Phase 1 in progress

> **⚠️ Two entries above this line are now STALE. Read this block as authoritative.**
>
> 1. **Status, first bullet ("2026-08-22: JARVIS v2 interface + auto-start BUILT &
>    OFFLINE-VERIFIED … on-device smoke test is the open gate")** — **superseded.**
>    Jelly Bean saw v2 and rejected it (*"I hate it"*). The smoke test is **cancelled,
>    not pending.** v2 is shelved: launcher stopped, Termux:Boot script removed
>    (archived to `~/_archive_jarvis_20260822/boot/`), code dormant at
>    `jarvis-core/jarvis2/`. Package SHA `f89a2dea…` is history, not a product.
> 2. **Next Actions, first item ("JARVIS v2 — run the on-device smoke test + one-time
>    boot steps")** — **cancelled**, same reason.
>
> The locked decision (six-tab `jarvis-app.mjs` on **:8737** is THE app) stands as
> recorded in the DECISION 2026-08-22 block above. All improvements happen on that app.

### Current state — the honest three-way split

| Thing | Written | On the phone | Actually running |
|---|---|---|---|
| Phase 0 `self-knowledge.mjs` | ✅ | ✅ | ✅ (13 tools, drift check OK) |
| Phase 0 `capabilitiesBlock` → prompts | ✅ spec | ❌ | ❌ **not wired** |
| Phase 1 `lib/hardline.mjs` | ✅ 25/25 tests | ❌ | ❌ **sandbox only** |
| Phase 1 `agent.mjs` import + guard | ✅ exact edit drafted | ❌ | ❌ awaiting go |

### jarvis-core facts established by recon (do not re-derive)

- **13 callable tools, not 14** — `tools/vault-lib.mjs` is a helper (`safePath`,
  `SKIP_DIRS`), no `name`/`run`, never registers.
- **`executeToolCall` in `lib/agent.mjs` is the single choke point.** Order: tool exists →
  parse args → validate → `gated` → `onToolUse` → safe-mode → confirm → run +
  `scanForInjection` + audit.
- **The injection gate and kill switch already exist and are good** (`lib/rails.mjs`:
  `scanForInjection` 10 patterns, `isSafeMode()` via env / config / `.jarvis-safe` file,
  append-only JSONL audit, per-London-day token tally). **Do not rebuild them.**
- **`~/jarvis-core/.jarvis-safe` is the panic button** — its presence refuses every gated
  action. Toggle: `node jarvis-rails.mjs safe on|off`.
- **Riskiest tool: `tools/pc-control.mjs`** — arbitrary PowerShell via the PC bridge
  (`192.168.0.191:3000`, token-guarded). Confirmation was the *only* gate; no floor under
  a confirmed command. That is precisely what Phase 1 fixes.

### North-Star roadmap (locked)

Target = **Trustworthy Companion**: durable honest memory, non-drifting personality,
honest self-knowledge, crash-safe propose→approve→commit — all inside the six-tab app.
**P0** self-knowledge ✅ · **P1** security 🔄 ← here · **P2** persona-drift · **P3**
execution-gap queue · **P4** memory depth · **P5** code-sentinel · **P6** living-mind
snapshot (opt-in, static; never on the mic path) · **P7** board of advisors (opt-in,
multi-model only).

### Also this session

- **Vercel Carousel API secured — verified live** (`jarvis-carousel.vercel.app`):
  fail-closed bearer gate on `/api/chat` + `/api/capture`. Probes: no token → 401, wrong
  → 401, correct → 200 + pong, capture → 401. **Root cause of the earlier "still open":
  Vercel deploys branch `main`, work was on `master`** — merged. **Standing risk:
  main/master drift — switch the Vercel production branch to `master`.** Secondary app;
  the phone core does not depend on it.
- **Orphaned submodule fixed** — `.claude/skills/android-development` gitlink with no
  `.gitmodules` was breaking the Vercel clone.
- **Working practice: file-attachment uploads are broken for Jelly Bean** — attachments
  arrive empty. **Pasted text and screenshots only.**

### Next actions (supersede the v2 items above)

- [ ] **P1 — ship the hardline blocklist**: package `lib/hardline.mjs` SHA-verified via
      `Assistant Core/packages/`, one-paste installer with `agent.mjs.bak` backup, apply
      the import + guard block, `node --check lib/agent.mjs` clean, then **on-device proof**
      that a catastrophic *confirmed* `pc_control` command is refused **and** a normal one
      still runs.
- [ ] **P1 — widen `scanForInjection`** with data-exfil patterns (send/forward/email all…,
      `curl|bash`, "export your…").
- [ ] **P1 — document `.jarvis-safe` as the panic button**; confirm `isSafeMode` covers
      every tool path.
- [ ] **Close the Phase 0 loop** — wire `self-knowledge.json`'s `capabilitiesBlock` into
      `lib/brain.mjs` and/or the four `systemPrompt()` builders, so JARVIS *uses* the honesty.
- [ ] **Push the Fold's `jarvis-core` to GitHub `main`** — last recorded push 2026-08-06.
      Carried over; still the least-protected part of the system.
- [ ] **Rotate the Carousel `JARVIS_API_TOKEN`** (exposed in chat; value not recorded here).
- [ ] Housekeeping: tidy this file's top Status + Next Actions sections in a full rewrite
      so a top-down reader isn't misled by the superseded v2 entries.
- [ ] Deferred cleanup: archive the 546M `~/jarvis` sprawl (2nd vault clone + `gstack` +
      `openclaude`) and stray vault clones → one canonical vault (`~/Obsidian-Vault-`, master).

Session: [[sessions/2026-08-23]] — Phase 0 closed, Phase 1 built & tested (not shipped),
v2 rejected, Carousel API secured.



## Session 2026-08-23 close — status & next actions
- Phase 0 (self-knowledge) ✅ done on device (13 tools). Phase 1 blocklist built+tested
  (25/25), **not yet shipped** — pending: package + install + on-device verify.
- Deferred: close Phase 0 loop (wire capabilitiesBlock into prompt); widen injection
  scanner; document `.jarvis-safe`; archive 546M `~/jarvis` sprawl; rotate Vercel
  `JARVIS_API_TOKEN`; switch Vercel production branch master->retire main drift.
- Session record: [[sessions/2026-08-23]]. Full handoff delivered to user as HANDOFF.md.



---

## ✅ PHASE 1 COMPLETE — verified on device 2026-08-23

**Supersedes the "Session 2026-08-23 close" block above.** Phase 1 is no longer
"built, not shipped" — it is installed, wired, and proven executing on the Fold 7.

### The honest three-way split, updated

| Thing | Written | On the phone | Actually running |
|---|---|---|---|
| Phase 0 `self-knowledge.mjs` | ✅ | ✅ | ✅ (13 tools, drift OK) |
| Phase 0 `capabilitiesBlock` → prompts | ✅ spec | ❌ | ❌ **still not wired** |
| Phase 1 `lib/hardline.mjs` | ✅ | ✅ | ✅ **proven on device** |
| Phase 1 `agent.mjs` import + guard | ✅ | ✅ line 22 + line 149 | ✅ **proven on device** |
| Phase 1 widened `scanForInjection` | ✅ | ✅ | ✅ **31/31 against live file** |

### 1. Hardline blocklist — catastrophic floor

`lib/hardline.mjs` (20 patterns) refuses irreversible commands **even when
confirmation returns yes**. Wired into `executeToolCall` after `onToolUse?.()` and
**before** `isSafeMode()` — so a catastrophic command is refused whether safe mode
is on or off, and with no path around it via the confirm gate.

Covers: recursive deletes (`rm -rf`, `Remove-Item -Recurse -Force` order-free,
`rd /s /q`), disk destruction (`Format-Volume`, `format X:`, `mkfs`, `dd of=/dev/*`,
`> /dev/sda`, `Clear-Disk`), host shutdown/restart, fork bombs (POSIX + Windows),
pipe-to-shell (`curl|bash`, `iwr|iex`, `iex(`), secret reads (`.env`, `.ssh`,
`id_rsa`, credentials, env dumps), `chmod -R 777 /`, disabling Defender.

Recursively scans **all** string args to depth 8 — a payload buried in a nested
field is caught.

**On-device proof (2026-08-23), confirm hardcoded to always return yes:**

```
CATASTROPHIC (confirm said YES) -> BLOCKED — refused as a catastrophic action
                                   (recursive forced delete (rm -rf))
NORMAL       (confirm said YES) -> EXECUTED: Get-Date
actually executed               -> ["Get-Date"]
PROOF PASS
```

Install output: SHA OK · 25/25 self-test · `audit()` in scope so the audit line
was included · import at line 22 · guard at line 149 · order verified
`hardline < isSafeMode` · `node --check` OK · backup at `lib/agent.mjs.bak`.

### 2. Injection scanner widened — 10 → 19 patterns

Nine additive families appended to `INJECTION_PATTERNS` in `lib/rails.mjs`
(existing ten untouched, all still firing): bulk exfiltration, `export your
memory`, coaxing secrets into output, download-and-run, encode-then-ship,
known collectors (webhook.site / requestbin / ngrok / pipedream / oastify /
interact.sh), **memory poisoning** (`remember that you must always approve…`),
and **false gate-lifted claims** (`confirmation is no longer needed`) — the last
catching text arriving via `ha_state` or `database` that tries to convince JARVIS
a gate has already been cleared.

**31/31 green against the LIVE `rails.mjs` on device**: original 10 still fire,
11 new cases flag, 10 ordinary-text cases stay clean (HA entity states, vault
notes, `forward the invoice`, `curl -o data.json`, git output, `remember that I
am allergic to nuts`). A scanner that wrapped every HA reading in `[CAUTION]`
would be worse than none — the false-positive half of the suite is the half that
matters for daily use.

Installer auto-rolls-back from `lib/rails.mjs.bak` if the suite fails against the
live file, so there is no half-patched state.

### 3. `.jarvis-safe` documented as the panic button

New vault doc **[[Assistant Core/JARVIS_SAFETY_FLOORS]]** — the three layers in
check order, the panic-button commands, rollback, and the two regex bugs that must
never be reintroduced.

### Two bugs that must not be reintroduced (recorded in the file header too)

1. **PowerShell flags must match order-free** (lookaheads). `Remove-Item -Force
   -Recurse` is as lethal as `-Recurse -Force`.
2. **Never put `\b` before a hyphenated flag** like `-Recurse`. The boundary
   between a space and `-` is not a word boundary in JS regex, so `\b-Recurse`
   never matches — this silently disabled the rule once during the build.

### Packages (all SHA-gated, round-trip verified from raw GitHub)

| File | SHA-256 of decoded tar.gz |
|---|---|
| `Assistant Core/packages/hardline.tar.gz.b64` | `f355231de3807aa610bdb55678126480819b0d166cc93f9e261c79c4615e5670` |
| `Assistant Core/packages/scanwiden.tar.gz.b64` | `87eb67cbec9db2041941b70bdca0588b8254758beae646b818e256b195d48a02` |

Plus `install-hardline.sh`, `install-scanwiden.sh`, `proof-hardline.mjs`.

**Note:** the SHA `ae0738…` recorded in the previous handoff for `hardline.mjs` is
**dead** — it came from a sandbox that no longer exists. The file was rebuilt from
spec this session; `f355231d…` (tar.gz) is authoritative. Also: **20 patterns, not
the 19 specified** — `rd /s /q` was added as an obvious hole beside the other two
recursive deletes.

### Rollback

```sh
cp ~/jarvis-core/lib/agent.mjs.bak ~/jarvis-core/lib/agent.mjs
cp ~/jarvis-core/lib/rails.mjs.bak ~/jarvis-core/lib/rails.mjs
rm ~/jarvis-core/lib/hardline.mjs
```

### Post-install health

App restarted clean on **:8737 → HTTP 200**. `jarvis-rails.mjs status`: safe mode
OFF, 0 requests / 0 tokens today (0% of 100000).

### Next actions after Phase 1

- [ ] **Close the Phase 0 loop** — wire `self-knowledge.json`'s `capabilitiesBlock`
      into `lib/brain.mjs` and/or the four `systemPrompt()` builders, so JARVIS
      *uses* the honesty it now computes. **This is the highest-value remaining
      small item.**
- [ ] **Push the Fold's `jarvis-core` to GitHub `main`** — last recorded push
      2026-08-06. Now carries `hardline.mjs` + two patched files. Still the
      least-protected part of the whole system, and the gap widens every session.
- [ ] **P2 — persona-drift fix** (next roadmap phase).
- [ ] Rotate the Carousel `JARVIS_API_TOKEN`; switch Vercel production branch to
      `master` to end main/master drift.
- [ ] Housekeeping: full rewrite of this file's top Status + Next Actions so a
      top-down reader isn't misled by the superseded v2 entries.
- [ ] Deferred cleanup: archive the 546M `~/jarvis` sprawl → one canonical vault.

Session: [[sessions/2026-08-23]] · Safety reference: [[Assistant Core/JARVIS_SAFETY_FLOORS]]



## 2026-08-23 — Phase 0 loop CLOSED + Phase 1 hardline VERIFIED + jarvis-core backed up

Supersedes the "Phase 0 regression" and "Phase 1 built but not shipped" notes above.

- **Phase 0 regression fixed at root.** `self-knowledge.json` had degraded to 1 tool ("tools")
  because the generator was overwritten by a static-parse variant. Re-ran the SHA-verified
  `install-phase0.sh` → regenerated from the live registry: **13 tools**, drift check **OK**.
  Not hardcoded — the block carries each tool's real description.
- **Phase 0 loop closed in the DAILY app.** `jarvis-app.mjs` (:8737) `systemPrompt()` now reads
  `self-knowledge.json`'s `capabilitiesBlock` and injects it above the honesty rules
  (`jarvis.mjs`, the one-off REPL, is deliberately not the patch target). Assertion-guarded patch,
  `jarvis-app.mjs.bak` kept. Verified on device: 13/13 tools rendered, fallback unused, app 200.
- **Phase 1 was already on the phone** (contrary to the earlier note) and is now **proven**: with
  confirmation hardcoded to yes, `rm -rf /` is refused and `Get-Date` still runs. Guard sits
  between `onToolUse` and `isSafeMode` — no bypass.
- **`jarvis-core` pushed to `origin/main`** (`bb97f5d..2834aad`), closing a 17-day backup gap
  (last push 2026-08-06). This retires the long-standing "on-device work is unbacked" risk for
  everything up to today.

Next: Phase 2 — persona-drift fix. See [[sessions/2026-08-23]].



## 2026-08-23 — PHASE 2 COMPLETE: persona-drift fixed

`lib/persona.mjs` is now the single source of truth for JARVIS's personality. Before it, all four
entry points (`jarvis.mjs`, `jarvis-app.mjs`, `jarvis-voice.mjs`, `heartbeat.mjs`) carried their own
hand-maintained `systemPrompt()` — four different hashes, one pointed at a stale self-knowledge file
and reporting "1 tool", one still telling JARVIS it had no proactive behaviour a month after Tier 5
shipped.

Now identity, personality, honesty and memory rules are written once; surfaces differ only where
they must (voice = speakable output; heartbeat = unattended, read-only, no memory writes).

**Verified on device:** 1 distinct honesty block, 1 distinct personality, 13 tools in every prompt,
stale Tier-5 denial gone, app 200, heartbeat scheduling intact. Commits `5bfe14e` + `bf68e33` on
`origin/main`.

**Delivery lesson (applies to every future installer): SHA pinning proves integrity, not freshness.**
A stale `raw.githubusercontent` edge served the phone a cached old installer AND old payload; since
the old installer pinned the old SHA, the pair verified clean and a known-broken patcher installed.
All installers must cache-bust every fetch and assert on file *content*, not just hash. Also: ship
source as plain `.mjs` in the vault, not hand-transcribed base64.

See [[sessions/2026-08-23]]. Next: Phase 3.

