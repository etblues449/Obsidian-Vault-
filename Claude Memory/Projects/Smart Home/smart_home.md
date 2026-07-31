# Smart Home — detail hub

> **Reconstructed stub, 2026-07-27.** `_index.md` ended with "Full detail: [[smart_home]]"
> but no such note existed. This is a navigation hub, not a second source of truth —
> `_index.md` remains authoritative for status, decisions, and next actions.

## Network

| Device | Address |
|---|---|
| HA Green hub | `192.168.0.200` |
| `ai_cam` (Waveshare ESP32-S3-CAM-OV3660) | `192.168.0.199` |
| ESP32-S3-AUDIO-Board | `192.168.0.216` |
| RuView CSI node 3 | `192.168.0.227` |
| `cctv_cam` | `192.168.0.234` |
| `porch` | `192.168.0.240` |
| upstairs (planned move from `.171`) | `192.168.0.207` |

`192.168.0.50:8123` appears in older notes and is **stale**.

## Canonical entities and configs

- Bedroom config: `bedroom-2.yaml` — `bedroom.yaml` is broken.
- TV entity: `media_player.tv_jelly_beans_tv_2`.
- Frigate config: `/config/frigate.yaml` on HA Green — 3 cameras, CPU detector,
  MQTT to `.200`, 800x600 @ 5fps per camera.

## Hardware notes

- [[hardware/Waveshare ESP32-S3-CAM-OV3660 — Arduino IDE Setup (CORRECTED)]]
- [[hardware/ESP32-S3-AUDIO-Board — Far-Field Voice Guide]]
- [[hardware/ESP32-S3-AUDIO-Board.esphome.yaml]]

## Sessions

- [[sessions/2026-07-29]] — AI Cam complete: mics, wake word, ES7210 component
- [[sessions/2026-07-23-ai-cam-handoff]] — full AI Cam build log; vendor-BSP pinout correction
- [[sessions/2026-07-04]] — Seven-Skill Active Vault live (n8n; later superseded)
- [[sessions/2026-06-19]] — JARVIS v3 Obsidian-native complete
- [[sessions/2026-06-16]] — JARVIS phone-native v1 merged
- [[sessions/2026-06-13]] — on-device JARVIS stand-up
- [[sessions/2026-06-08]] — RuView CSI node fixed, WiFi sensing live

## Fixes

- [[fixes/2026-06-14-ip-collision-fix]] — `.171` collision, not yet applied

## The rule that cost the most to learn

For any Waveshare board the **vendor BSP is authoritative, not the product image**.
The "Interface Definition" image gave a wrong audio pin map that cost roughly four
hours. Camera pins happened to be right; audio pins were not.
