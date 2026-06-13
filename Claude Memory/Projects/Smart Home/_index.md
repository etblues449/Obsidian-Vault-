# Smart Home — Project Index

## Goal
Deeply automated, presence-aware home across lounge, bedroom, upstairs using HA Green + ESP32, with an on-device agentic JARVIS layer driving it from the Fold 7.

## Status
- Lounge: complete (~19 automations)
- Bedroom: operational (bedroom-2.yaml)
- Upstairs: BLE/radar contention unresolved
- **On-device JARVIS terminal (Fold 7): operational** — Claude Code pinned to v2.1.112 in Termux, auto mode, filesystem MCP scoped to `~/jarvis`, vault cloned on-device, Termux:API hardware tools live (battery + notification verified). See [[sessions/2026-06-13]].

## Key Decisions
- bedroom-2.yaml canonical (bedroom.yaml broken)
- media_player.tv_jelly_beans_tv_2 canonical TV entity
- Frigate ruled out (too heavy for HA Green)
- BLE + mmWave on same ESP32 = contention; split nodes
- **Claude Code on Termux: pin to v2.1.112, disable auto-updater** — every release from v2.1.113 onward pulls a 233 MB glibc native binary that Android kills mid-download. Disable via `DISABLE_AUTOUPDATER=1` in `~/.bashrc` **and** `autoUpdates: false` in `~/.claude/settings.json`, or it silently re-breaks itself.
- **git MCP: use `uvx mcp-server-git`, not npx** — the npm version won't connect. Falling back to the `git` CLI is fine.
- Interactive `read -s` token paste fails on mobile; let `git` prompt for credentials.

## Next Actions
- [ ] Fix upstairs BLE/radar contention
- [ ] Clarify IP conflict (upstairs vs bedroom both 192.168.0.171)
- [ ] Order: 18650 cells, ESP32-S3-CAM, 5V servo rail
- [ ] Install Termux:Widget + add JARVIS home-screen launcher icon (final tap-to-launch step)
- [ ] Copy `JARVIS-CHEATSHEET.md` into `~/jarvis`
- [ ] Optional later: upgrade Claude Code to native binary via the ferrum patcher, on wifi + wakelock

## Reference
Full detail: [[smart_home]]
Sessions: [[sessions/2026-06-13]] — on-device JARVIS stand-up
