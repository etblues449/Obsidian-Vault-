# Smart Home — Project Index

## Goal
Deeply automated, presence-aware home across lounge, bedroom, upstairs using HA Green + ESP32, with an on-device agentic JARVIS layer driving it from the Fold 7.

## Status
- Lounge: complete (~19 automations)
- Bedroom: operational (bedroom-2.yaml)
- Upstairs: BLE/radar contention unresolved
- **On-device JARVIS terminal (Fold 7): operational** — Claude Code pinned to v2.1.112 in Termux, auto mode, filesystem MCP scoped to `~/jarvis`, vault cloned on-device, Termux:API hardware tools live (battery + notification verified). See [[sessions/2026-06-13]].
- **JARVIS Phone-Native v1: complete & deployed** — Capture (text→Inbox), HA control (REST wrapper), git sync (branch-aware), daily digest (cron), one-tap Termux:Widget. Fully tested on Fold 7 (install.sh runs clean, capture + HA control working, cron scheduled). PR #52 merged to master 2026-06-16. See [[sessions/2026-06-16]] + QUICK_START.md.
- **JARVIS v3: Obsidian-native (current direction)** — pivoted away from Termux as the focal point. The vault IS the brain: capture via Advanced URI → QuickAdd; classification/routing/HA/digest run *inside Obsidian* as QuickAdd user scripts calling the Claude API (`claude-opus-4-8`, structured outputs) via `requestUrl`; Smart Connections for vault-wide chat; Obsidian Sync primary + Git backup. Secrets device-local (localStorage), never committed. Built 2026-06-16 — code + docs in `Claude Memory/Skills/jarvis/obsidian/`. Next: install on Fold 7 per SETUP.md.
- **JARVIS Phone-Native v1/v2 (Termux/bash): ARCHIVED** — retired from the daily loop 2026-06-16, kept as emergency CLI only. See `Claude Memory/Skills/jarvis/phone/_ARCHIVED.md`.
- **RuView WiFi-CSI sensing: live & phone-free** — ESP32-S3 node 3 (192.168.0.227) streams CSI; local HA add-on "RuView CSI Bridge" on the hub publishes 6 MQTT entities (presence, breathing, heart-rate, motion, persons, anomaly) on the Smart Home dashboard. HA hub real IP = **192.168.0.200**. See [[sessions/2026-06-08]].

## Key Decisions
- bedroom-2.yaml canonical (bedroom.yaml broken)
- media_player.tv_jelly_beans_tv_2 canonical TV entity
- Frigate ruled out (too heavy for HA Green)
- BLE + mmWave on same ESP32 = contention; split nodes
- **Claude Code on Termux: pin to v2.1.112, disable auto-updater** — every release from v2.1.113 onward pulls a 233 MB glibc native binary that Android kills mid-download. Disable via `DISABLE_AUTOUPDATER=1` in `~/.bashrc` **and** `autoUpdates: false` in `~/.claude/settings.json`, or it silently re-breaks itself.
- **git MCP: use `uvx mcp-server-git`, not npx** — the npm version won't connect. Falling back to the `git` CLI is fine.
- Interactive `read -s` token paste fails on mobile; let `git` prompt for credentials.

## Next Actions
- [x] **GitHub PAT rotated** (2026-06-15) — old exposed token revoked, new fine-grained token in Windows Credential Manager
- [ ] Fix upstairs BLE/radar contention
- [ ] **Apply .171 IP collision fix** — upstairs → .207 via ESPHome OTA. Full plan: [[fixes/2026-06-14-ip-collision-fix]]
- [ ] DHCP reservation: RuView node MAC e0:72:a1:e7:03:60 → .227
- [ ] Delete ghost "Upstairs" (.207) config in ESPHome Builder (board now runs CSI firmware)
- [ ] Order: 18650 cells, ESP32-S3-CAM, 5V servo rail
- [x] **Install Termux:Widget + JARVIS buttons** (2026-06-16) — jarvis, sync, digest shortcuts created; widget installed on home screen. Shortcut may need Termux:Widget rebuild if pointing to Obsidian instead of Termux.
- [ ] Copy `JARVIS-CHEATSHEET.md` into `~/jarvis`
- [ ] Optional later: upgrade Claude Code to native binary via the ferrum patcher, on wifi + wakelock

## Reference
Full detail: [[smart_home]]
Sessions: [[sessions/2026-06-16]] — JARVIS phone-native v1 complete + merged · [[sessions/2026-06-13]] — on-device JARVIS stand-up · [[sessions/2026-06-08]] — RuView CSI node fixed + WiFi sensing live
