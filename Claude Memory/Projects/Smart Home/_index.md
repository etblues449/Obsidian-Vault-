# Smart Home — Project Index

## Goal
Deeply automated, presence-aware home across lounge, bedroom, upstairs using HA Green + ESP32, with an on-device agentic JARVIS layer driving it from the Fold 7.

## Status
- Lounge: complete (~19 automations)
- Bedroom: operational (bedroom-2.yaml)
- Upstairs: BLE/radar contention unresolved
- **AI Cam (Waveshare ESP32-S3-CAM-OV3660, node `ai_cam` @ 192.168.0.199): camera DONE, speaker root-caused** — OV3660 streaming 800x600 MJPEG (`:8080`) + snapshot (`:8081`), live in Frigate with recording + person detection. Camera power gated by CH32V003 expander EXIO3 (drive LOW); amp on EXIO4 (drive HIGH). Speaker was silent/static all session because **three of the four I²S pins were wrong and the ES8311 role was inverted** — pinout had been taken from the Amazon product image rather than Waveshare's BSP. Correct: MCLK 10, **BCLK 11, LRCK 12, DOUT 14** (mic DIN 13), ES8311 = **SLAVE** (no `force_master`). Corrected config handed over for flashing; result not yet confirmed. Full detail + correction section: [[sessions/2026-07-23-ai-cam-handoff]]. (2026-07-23)
- **On-device JARVIS terminal (Fold 7): operational** — Claude Code pinned to v2.1.112 in Termux, auto mode, filesystem MCP scoped to `~/jarvis`, vault cloned on-device, Termux:API hardware tools live (battery + notification verified). See [[sessions/2026-06-13]].
- **JARVIS Phone-Native v1: complete & deployed** — Capture (text→Inbox), HA control (REST wrapper), git sync (branch-aware), daily digest (cron), one-tap Termux:Widget. Fully tested on Fold 7 (install.sh runs clean, capture + HA control working, cron scheduled). PR #52 merged to master 2026-06-16. See [[sessions/2026-06-16]] + QUICK_START.md.
- **JARVIS v3: Obsidian-native (DEPLOYED & LIVE)** — Obsidian-native brain replacing Termux. The vault IS the system: Capture (Alt+J) → Claude classifies → routes to folder; Ask (Alt+A) → Q&A grounded in last 20 captures; Digest (Alt+D) → daily 24h summary to Journal/. All run *inside Obsidian* via QuickAdd scripts calling Claude API (`claude-opus-4-8`) via `requestUrl`. Dashboards (Master Dashboard, Finance Tracker, Projects Dashboard) auto-update via Dataview. Obsidian Sync + Git backup. Secrets device-local (localStorage), never synced. **Complete 2026-06-20**: 14 docs + 6 scripts + home-screen shortcuts; all 3 core macros tested & working on Fold 7; digest running daily; Ask returning grounded answers. See [[sessions/2026-06-19]].
- **JARVIS Phone-Native v1/v2 (Termux/bash): ARCHIVED** — retired from the daily loop 2026-06-16, kept as emergency CLI only. See `Claude Memory/Skills/jarvis/phone/_ARCHIVED.md`.
- **RuView WiFi-CSI sensing: live & phone-free** — ESP32-S3 node 3 (192.168.0.227) streams CSI; local HA add-on "RuView CSI Bridge" on the hub publishes 6 MQTT entities (presence, breathing, heart-rate, motion, persons, anomaly) on the Smart Home dashboard. HA hub real IP = **192.168.0.200**. See [[sessions/2026-06-08]].
- **Seven-Skill Active Vault: LIVE (2026-07-04)** — all 5 n8n workflows published on jellybean1875.app.n8n.cloud: Note Router (capture, continuous), Morning Brief (daily 7am), Pattern Detector (Mon 8am), Connection Finder (Sun 2pm), Weekly Synthesis (Fri 6pm). Each: Schedule → GitHub reads → Claude Opus 4.8 → commit to vault, Europe/London tz. All four test-executed green — first automated reports committed (briefings/, connections/, synthesis/, patterns.md). Skills 5 & 7 (Belief Tracker, Decision Intelligence) manual via `#belief`/`#decision` tags → beliefs.md / decisions.md (both seeded). Importable JSONs: `Assistant Core/n8n/`. See [[sessions/2026-07-04]].
- **Seven-Skill engine: MIGRATED to £0 (GitHub Actions + Groq) — 2026-07-08, PR pending** — the 4 scheduled skills (Morning Brief, Connection Finder, Weekly Synthesis, Pattern Detector) are re-implemented as free GitHub Actions running a shared Node runner (`Assistant Core/jarvis-skills/runner.mjs`) that calls **Groq** (`llama-3.3-70b-versatile`, free tier) instead of the paid Claude API, and commits back to master via a single serialized rebase-retry write path. DST-correct Europe/London guards; 9/9 offline tests green. Replaces paid n8n.cloud + Claude API → satisfies C1 (£0 forever). **User action: add `GROQ_API_KEY` repo secret, then Run-workflow each once to verify** (see `Assistant Core/jarvis-skills/MIGRATION.md`). Event-driven skills 2/5/7 (capture router, belief/decision gates) have a documented £0 Phase-2 path (GitHub `on: push` router) — not yet built.
- **Voice agent (Layer B interface): LIVE & £0** — `jarvis-voice-lovat.vercel.app` (Vercel Hobby, free) using Groq `llama-3.1-8b-instant` + Browser Web Speech API (STT/TTS), reads the vault via GitHub API (octokit). Deployed from Termux. Complementary to the Obsidian-native brain (Layer A), not competing. *(Recorded here 2026-07-08 per handoff §12.7 reconciliation.)*
- **JARVIS Carousel: deployed on Vercel** — 7-slide Next.js presentation (JARVIS-Carousel/ in vault, monorepo root dir on Vercel project `jarvis-carousel`). Production branch = master.

## Key Decisions
- bedroom-2.yaml canonical (bedroom.yaml broken)
- media_player.tv_jelly_beans_tv_2 canonical TV entity
- **Frigate: RE-ADOPTED (2026-07-23)** — previously ruled out as too heavy, but now running on HA Green with 3 cameras (ai_cam + cctv_cam .234 + porch .240), CPU detector, MQTT to .200. Config `/config/frigate.yaml`. ai_cam tile confirmed live. Runs fine at 800x600/5fps per camera. Supersedes the earlier "Frigate ruled out" decision.
- **For Waveshare boards: clone the vendor repo, don't trust the product image (2026-07-23)** — `git clone https://github.com/waveshareteam/ESP32-S3-CAM-OVxxxx.git` + the BSP managed component `waveshare/esp32_s3_cam_ovxxxx` (ESP Component Registry) are the authoritative pinout. The Amazon "Interface Definition" image gave a **wrong audio pin map** that cost an entire session chasing static/silence. Camera pins from the image happened to be right; audio pins were not. **Supersedes the earlier claim that the Interface Definition image is authoritative.**
- **Waveshare ESP32-S3-CAM: camera power is expander-gated** — the OV3660 will not init (`ESP_ERR_NOT_SUPPORTED`, garbage PID) until CH32V003 EXIO3 (PWDN net) is driven LOW. Amp enable is EXIO4 driven HIGH (empirically confirmed). Sibling ESP32-S3 cam boards do NOT match this board.
- **AI Cam audio: ESP32 is I²S master, ES8311 is SLAVE** — per BSP (`I2S_ROLE_MASTER` on the channel, `.master_mode = false` on the codec). **Do NOT set `force_master: true`** on this board — that was a wrong turn taken from generic ES8311 advice. A log line reading `I2S Role: SLAVE` is correct here.
- BLE + mmWave on same ESP32 = contention; split nodes
- **Claude Code on Termux: pin to v2.1.112, disable auto-updater** — every release from v2.1.113 onward pulls a 233 MB glibc native binary that Android kills mid-download. Disable via `DISABLE_AUTOUPDATER=1` in `~/.bashrc` **and** `autoUpdates: false` in `~/.claude/settings.json`, or it silently re-breaks itself.
- **git MCP: use `uvx mcp-server-git`, not npx** — the npm version won't connect. Falling back to the `git` CLI is fine.
- Interactive `read -s` token paste fails on mobile; let `git` prompt for credentials.

## Next Actions
- [ ] **AI Cam speaker — flash the corrected pins** (BCLK 11, LRCK 12, DOUT 14, remove `force_master`) → Install/OTA → `tts.speak` test. Full corrected YAML in the CORRECTION section of [[sessions/2026-07-23-ai-cam-handoff]]
- [ ] **AI Cam — add ES7210 dual mics** once speaker confirmed: DIN = **GPIO13**, I²C 0x40
- [ ] **AI Cam — verify cctv_cam (.234) + porch (.240)** are powered; may be hardware-down not config
- [x] **GitHub PAT rotated** (2026-06-15) — old exposed token revoked, new fine-grained token in Windows Credential Manager
- [x] **JARVIS v3 Obsidian-native: complete** (2026-06-19) — all docs, scripts, config + phone setup ready
- [ ] **User: Run INSTALLATION CHECKLIST.md on Fold 7** — steps 1-9, ~15 min total
- [ ] **User: Test all 5 macros** — Capture, Ask, Digest, Expense, Weekly (per step 9 of checklist)
- [ ] Fix upstairs BLE/radar contention
- [ ] **Apply .171 IP collision fix** — upstairs → .207 via ESPHome OTA. Full plan: [[fixes/2026-06-14-ip-collision-fix]]
- [ ] DHCP reservation: RuView node MAC e0:72:a1:e7:03:60 → .227
- [ ] Delete ghost "Upstairs" (.207) config in ESPHome Builder (board now runs CSI firmware)
- [ ] Order: 18650 cells, ESP32-S3-CAM, 5V servo rail
- [x] **Install Termux:Widget + JARVIS buttons** (2026-06-16) — jarvis, sync, digest shortcuts created; widget installed on home screen. Shortcut may need Termux:Widget rebuild if pointing to Obsidian instead of Termux.
- [ ] Copy `JARVIS-CHEATSHEET.md` into `~/jarvis`
- [ ] Optional later: upgrade Claude Code to native binary via the ferrum patcher, on wifi + wakelock
- [x] **Seven-skill n8n automation: imported, tested, published** (2026-07-04)
- [ ] **Fix empty Tasker captures** — "Ask JARVIS" shortcut has fired 3× with placeholder "your note here"; input variable not reaching the webhook
- [ ] Verify first scheduled runs land: Synthesis Fri 6pm, Connection Sun 2pm, Patterns Mon 8am, Brief daily 7am
- [ ] Optional: add `#belief`/`#decision` tag routing to Note Router (skills 5 & 7 auto-capture)
- [ ] **£0 migration (GitHub Actions + Groq) — merge PR, then: (1) add `GROQ_API_KEY` repo secret, (2) Actions → Run-workflow each of the 4 skills once to verify, (3) deactivate the 4 n8n.cloud workflows.** Guide: `Assistant Core/jarvis-skills/MIGRATION.md`
- [ ] **Build Phase-2 capture router** (skills 2/5/7 as a GitHub `on: push` router → removes the paid n8n webhook; also fixes the empty-Tasker-capture bug via a junk filter)

## Reference
- **AI Cam (Waveshare ESP32-S3-CAM-OV3660) full handoff** — pin map (see CORRECTION section for the authoritative audio pins), I²C scan, discoveries, audio debug log, corrected YAML, next steps: [[sessions/2026-07-23-ai-cam-handoff]] (2026-07-23)
- **Waveshare vendor sources for this board** — repo `github.com/waveshareteam/ESP32-S3-CAM-OVxxxx` (examples `01_simple_video_server`, `02_esp_sr`, `03_audio_play`, `04_dvp_camera_display`, `05_lvgl_brookesia`, `06_usb_host_uvc`; plus `Schematic/ESP32-S3-CAM-XXXX-schematic.pdf`) and BSP component `waveshare/esp32_s3_cam_ovxxxx` on components.espressif.com. Read the BSP header for any pin question on this board.
- **ESP32-S3-AUDIO-Board far-field voice** (research + build guide + ready-to-flash ESPHome config) — [[hardware/ESP32-S3-AUDIO-Board — Far-Field Voice Guide]] · [[hardware/ESP32-S3-AUDIO-Board.esphome.yaml]]. Key finding: board = Waveshare ESP32-S3-AUDIO-Board (ES8311 + ES7210 4-ch, dual mic). AEC cancels the board's *own* audio (great barge-in) but **cannot** cancel an *external TV* (no reference signal) — so whole-room-over-TV needs placement + BSS direction + 2-3 satellites, and ultimately a 4-mic XMOS array for the loud-lounge primary. Road A = ESPHome + Assist (AEC+BSS+NS+AGC + microWakeWord "Hey Jarvis"). (2026-07-15)

Full detail: [[smart_home]]
Sessions: [[sessions/2026-07-23-ai-cam-handoff]] — AI Cam camera done, speaker pin map corrected from vendor BSP · [[sessions/2026-06-19]] — JARVIS v3 Obsidian-native complete & production-ready · [[sessions/2026-06-16]] — JARVIS phone-native v1 complete + merged · [[sessions/2026-06-13]] — on-device JARVIS stand-up · [[sessions/2026-06-08]] — RuView CSI node fixed + WiFi sensing live
