# Smart Home — Project Index

## Goal
Deeply automated, presence-aware home across lounge, bedroom, upstairs using HA Green + ESP32, with an on-device agentic JARVIS layer driving it from the Fold 7.
**The full roadmap to that goal now lives in [[MASTER_PLAN]] (2026-08-01) — phased plan, complete hardware inventory, success criteria.**

## Status
- **Master plan + HA diagnostics toolkit: BUILT (2026-08-01, PR #71)** — [[MASTER_PLAN]]; `Assistant Core/ha-diagnostics/ha-doctor.mjs` (read-only, zero-dep, 13-section HA audit — tested against a mock hub; needs an ADMIN long-lived token for template/error-log/check_config sections). Dashboard audit: [[diagnostics/2026-08-01-dashboard-audit]] — canonical dashboard's 4 stale `media_player.jelly_beans_tv` refs **fixed** to `media_player.tv_jelly_beans_tv_2`; `dashboard/README.md` now marks the canonical file.
- **⚠️ ES7210 component `ref: master` consumption is BROKEN until PR #71 merges** — the `esphome/components/es7210/` commits exist only on the PR branch (verified `git merge-base` 2026-08-01). The flashed ai_cam keeps working; any re-compile pulling `ref: master` fails until merge.
- **⚠️ Capture drift (found 2026-08-01):** newer captures land in root `Inbox/` (5 files up to 2026-07-09) but `runner.mjs` + `unified-backend.js` read `JARVIS/Inbox/` only — those captures are invisible to the engine. Fold into the Phase-2 capture router fix.
- Lounge: complete (~19 automations)
- Bedroom: operational (bedroom-2.yaml)
- Upstairs: BLE/radar contention unresolved
- **AI Cam (Waveshare ESP32-S3-CAM-OV3660, node `ai_cam` @ 192.168.0.199): COMPLETE ✅ — camera + speaker + microphones + wake word (2026-07-29)** — OV3660 streaming 800x600 MJPEG (`:8080`) + snapshot (`:8081`), live in Frigate with recording + person detection. ES8311 speaker doing TTS. **ES7210 dual mics working via a custom ESPHome component written from scratch** (`esphome/components/es7210/` in this vault) — STT confirmed transcribing verbatim in 0.04s. Plus microWakeWord "Hey Jarvis", both hardware buttons, and status LED. Full build log, register sequences and all three blockers: [[sessions/2026-07-23-ai-cam-handoff]] · session summary: [[sessions/2026-07-29]].
- **⚠️ microWakeWord regression (2026-08-02, EXPLAINED):** current ai_cam build has no mWW — the full wake-word config **OOMs the HA Green's compiler** (TFLite build; `cc1plus` killed). Target config preserved at [[hardware/ai_cam]]; options = compile off-box on the PC (recommended now) or the budgeted **N100 (~£140)**. Live MAC = `28:84:85:49:83:C8`. Push-button voice works meanwhile. See [[sessions/2026-08-02]] + [[sessions/2026-08-01-hagreen-handoff]].
- **FIRST FULL HA DIAGNOSIS: RUN 2026-08-02 ✅** — [[diagnostics/2026-08-02-ha-doctor]] via Nabu Casa. Core **2026.8.0b2 beta**, config valid; **156/520 entities unavailable** (dead nodes); **only 1 of 4 voice satellites online**; **8 automations live** (not ~19), 3 stale since May; **canonical TV entity `tv_jelly_beans_tv_2` NO LONGER EXISTS** (decision needed between `jelly_beans_tv_tv_jelly_beans_tv` and `jelly_beans_tv_3`); area **"Dinning Room" is a typo**; 10 actionable entities area-less. **Entity naming settled: live registry uses the `living_room_ai_cam_*` PREFIXED form** — Entity Reference below updated.
- **New/corrected node records (2026-08-02):** porch servo/switch node at **.206** (new, offline) · bedroom presence node = **.171** offline (earlier records called .171 "upstairs" — reconcile) · cctv_cam at .234 is a **XIAO**, offline · lounge node physically sits in the **kitchen** · **`landing_ai_cam_2` device exists** — the 2nd CAM-OV3660 was already provisioned (Landing), currently offline.
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
- **AI Cam audio: ESP32 is I²S master, ES8311 is SLAVE** — per BSP (`I2S_ROLE_MASTER` on the channel, `.master_mode = false` on the codec). **Do NOT set `force_master: true`** on this board. A log line reading `I2S Role: SLAVE` is correct here.
- **ESPHome I²S: ONE bus, multiple children (2026-07-27)** — declaring two `i2s_audio` buses on the same MCLK/BCLK/LRCK pins is a hard error ("Pin N is used in multiple places"). Correct pattern is a single bus with speaker and microphone both referencing the same `i2s_audio_id`.
- **ESPHome I²S is a mutex, not full duplex (2026-07-28)** — `I2SAudioMicrophone::start_driver_()` opens with `if (!this->parent_->try_lock()) return false;`. Only one direction can hold the bus. **`timeout: never` on a speaker holds the bus forever and permanently blocks the microphone** — must be a real value (500ms). Consequence: **no barge-in**, and continuous wake-word listening blocks non-conversational TTS.
- BLE + mmWave on same ESP32 = contention; split nodes
- **Claude Code on Termux: pin to v2.1.112, disable auto-updater** — every release from v2.1.113 onward pulls a 233 MB glibc native binary that Android kills mid-download. Disable via `DISABLE_AUTOUPDATER=1` in `~/.bashrc` **and** `autoUpdates: false` in `~/.claude/settings.json`, or it silently re-breaks itself.
- **git MCP: use `uvx mcp-server-git`, not npx** — the npm version won't connect. Falling back to the `git` CLI is fine.
- Interactive `read -s` token paste fails on mobile; let `git` prompt for credentials.

## Next Actions
- [x] **Merge PR #71** — MERGED 2026-08-02 (`bd91acb`)
- [x] **Run ha-doctor** — first full run 2026-08-02 via Nabu Casa: [[diagnostics/2026-08-02-ha-doctor]] (naming settled, TV decided, areas mapped). Remaining: one LAN run for direct node probes + error_log
- [ ] **Get "Hey Jarvis" back — run the Option B compile**: [[hardware/ai_cam-compile-runbook]] on the PC (~15 min, OTA, no USB)
- [ ] **Back up hub-side config into the vault** (`automations.yaml`, `bedroom-2.yaml`, `frigate.yaml`, scenes/scripts → `ha-config/`) — the ~19 lounge automations exist nowhere but the hub. **Include the CURRENT `ai_cam.yaml` from ESPHome Builder** — the flashed config (tuning entities, XCLK 10 MHz, quality 10) was never captured
- [ ] **Re-enable microWakeWord on ai_cam** — wake-word selects unavailable on the current build (see [[sessions/2026-08-02]]). Order matters: pull the live `ai_cam.yaml` into the vault FIRST, then re-add `micro_wake_word` and flash — don't reconstruct from memory
- [x] **AI Cam camera** — streaming, Frigate, recording, person detection (2026-07-23)
- [x] **AI Cam speaker** — corrected pins from vendor BSP; TTS confirmed audible (2026-07-23)
- [x] **AI Cam ES7210 mics** — custom ESPHome component written, STT verified (2026-07-27/28)
- [x] **AI Cam microWakeWord + buttons + LED** (2026-07-29)
- [ ] **AI Cam — light entity naming**: Assist returns `no_valid_targets` for unmapped rooms (e.g. "dining room"). Fix by creating the Area and assigning lights, or by adding aliases in Settings → Voice assistants → Expose. Best: assign lights to the **Living Room** area (where ai_cam lives) so "turn on the lights" resolves with no name at all.
- [ ] **AI Cam — unused hardware**: microSD (CLK 16 / CMD 43 / D0 44, needs `sd_mmc_card` external component) · LCD 320x240 QSPI (DATA0 1, PCLK 5, DC 3, CS 6; RST EXIO2, backlight EXIO1 PWM — **panel controller not yet identified**) · touch (RST EXIO0, INT GPIO9) · battery ADC via CH32V003 (needs component extension)
- [ ] **AI Cam — camera EXIO3 power-up race**: intermittent `ESP_ERR_NOT_SUPPORTED` at boot when the OV3660 (0x3C) hasn't woken before the camera probes. Clears on reboot. **Fix proposed 2026-08-01 (blocking `on_boot` settle delay — see the hardware guide addendum) — NOT YET FLASHED; verify with the 10-reboot protocol.**
- [ ] **Port config to 2nd CAM-OV3660 board** — new IP + new API key, otherwise identical
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
- **[[MASTER_PLAN]]** — the whole-home roadmap: inventory, phases 0–5, buy list, success criteria (2026-08-01)
- **HA diagnostics** — `Assistant Core/ha-diagnostics/` (ha-doctor.mjs + README); reports land in `diagnostics/`. Dashboard audit: [[diagnostics/2026-08-01-dashboard-audit]]
- **Vendor-BSP verification 2026-08-01** — all 22 pin/expander claims CONFIRMED; full CH32V003 register map (dir 0x02 / out 0x03 / in 0x04 / PWM 0x05 / ADC 0x06) + EXIO function table now in the hardware guide — unlocks battery ADC + LCD backlight backlog items
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
- **Waveshare ESP32-S3-CAM-OV3660 setup guide (corrected)** — full IDE + pinout + the CH32V003 EXIO3 power-gating fix that clears `0x106`; proven ESPHome config + an Arduino path. [[hardware/Waveshare ESP32-S3-CAM-OV3660 — Arduino IDE Setup (CORRECTED)]]
- **Waveshare vendor sources for this board** — repo `github.com/waveshareteam/ESP32-S3-CAM-OVxxxx` (examples `01_simple_video_server`, `02_esp_sr`, `03_audio_play`, `04_dvp_camera_display`, `05_lvgl_brookesia`, `06_usb_host_uvc`; plus `Schematic/ESP32-S3-CAM-XXXX-schematic.pdf`) and BSP component `waveshare/esp32_s3_cam_ovxxxx` on components.espressif.com. Read the BSP header for any pin question on this board.
- **ESP32-S3-AUDIO-Board far-field voice** — [[hardware/ESP32-S3-AUDIO-Board — Far-Field Voice Guide]] · [[hardware/ESP32-S3-AUDIO-Board.esphome.yaml]]. Board = ES8311 + ES7210 4-ch, dual mic. **The new ES7210 component above applies to this board too.** AEC cancels the board's *own* audio but **cannot** cancel an *external TV* (no reference signal). (2026-07-15)

Full detail: [[smart_home]]
Sessions: [[sessions/2026-07-29]] — AI Cam complete: mics, wake word, ES7210 component · [[sessions/2026-07-23-ai-cam-handoff]] — full AI Cam build log · [[sessions/2026-06-19]] — JARVIS v3 Obsidian-native complete · [[sessions/2026-06-16]] — JARVIS phone-native v1 merged · [[sessions/2026-06-13]] — on-device JARVIS stand-up · [[sessions/2026-06-08]] — RuView CSI node fixed
