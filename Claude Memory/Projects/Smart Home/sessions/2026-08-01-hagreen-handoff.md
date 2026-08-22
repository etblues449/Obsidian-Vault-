# Session handoff — HA Green session, 2026-08-01 22:17 → 2026-08-02 01:55 UTC

> Provenance: handoff produced by a parallel Claude session working directly on the HA
> Green (files under `/home/claude/` on the hub — NOT in this vault). Pasted into the
> remote session 2026-08-02 and preserved here verbatim-in-substance. One internal
> contradiction annotated at the bottom. The full `ai_cam_final.yaml` from this session
> is preserved as [[../hardware/ai_cam]].

## Summary

Rebuilt Jelly Bean's House dashboard from scratch with a minimalist 3-view layout
(Home, Rooms, System). Fixed Frigate add-on startup and integration URL. Advanced
ai_cam config to include micro_wake_word (hey_jarvis) and SD card snapshot support.
All YAML validated; **ai_cam blocked on HA Green compile memory exhaustion.**

## Dashboard
- Output: `/home/claude/ui-lovelace-minimal.yaml` (ready to deploy — **on the hub, not in the vault**)
- Three views (Home, Rooms, System); all HACS cards preserved (Mushroom, Bubble, auto-entities, …)
- "All entities fixed: TV, soundbar, bedroom lights, presence sensors, voice satellites, Frigate cameras"
- Tested on Z Fold 7; waiting on Frigate connection to restore `advanced-camera-card`

## Frigate
- Running cleanly, no crash loop
- go2rtc pulls MJPEG from ai_cam (192.168.0.199:8080) → h264 RTSP restream
- Integration URL: `http://ccab4aaf-frigate-fa-beta:5000` (beta add-on hostname — the suffix matters)
- Once connected: `camera.ai_cam`, `binary_sensor.ai_cam_person_occupancy`, `sensor.ai_cam_person_count`
- Pending: add porch cam (.240) once ai_cam stable

## AI Cam
- Final config: `/home/claude/ai_cam_final.yaml` (= [[../hardware/ai_cam]] in this vault)
- Adds: micro_wake_word (hey_jarvis via substitution), SD snapshots (TF-07F: CLK 16 / CMD 43 / D0 44),
  camera tuning suite, boot/user buttons, status LED, `logger baud_rate: 0` (GPIO43/44 dual-use UART/SD)
- **BLOCKER: compile dies at 1165/1615 files — `Killed signal terminated program cc1plus`.**
  Linux OOM killer during TFLite Micro (wake-word model) compilation on the Green.
  Tried: stopping Frigate/Music Assistant/Studio Code Server/Govee2MQTT/RuView, clean cache,
  `compile_process_limit: 1` — insufficient.

## Fallback options (as written in the handoff)
- **A — drop wake word** (compiles on Green; push-to-talk only)
- **B — compile off-box** (Windows + ESPHome; full feature set; factory-flash via web.esphome.io)
- **C — wait for N100** (~£140 mini PC, already budgeted; compiles anything in <1 min)

## Offline nodes (deferred list from the handoff)
- Bedroom presence **192.168.0.171** — offline, needs reflash *(vault previously recorded .171 as the UPSTAIRS node — conflict, reconcile)*
- Porch servo/switch **192.168.0.206** — offline, needs reflash *(new node, first record in the vault)*
- CCTV cam **XIAO** at **192.168.0.234** — offline, needs inspection
- Lounge node rename — physically in the **kitchen**; entity IDs need update

## Key learnings
- **Device Builder rewrites blocks it doesn't recognise** — use Studio Code Server for configs with external components
- GPIO43/44 (U0TXD/RXD) double as SD_CMD/SD_D0 — serial logging must be off or the card won't mount
- **Wake word (TFLite) is the compile-memory ceiling; HA Green is margin-zero** — on-device TTS,
  a second camera, etc. all point at the N100 upgrade
- Frigate beta hostname is `ccab4aaf-frigate-fa-beta:5000`, not the stable name
- Snapshot counter survives reboots (`restore_value: yes`), writes snap1.jpg, snap2.jpg, …

## Files from that session
| File (on the hub) | Purpose | Status |
|---|---|---|
| `ui-lovelace-minimal.yaml` | 3-view dashboard | ready to deploy — **needs committing to the vault** |
| `ai_cam_final.yaml` | full config, wake word + SD | blocked on Green compile (Option A/B) |
| `ai_cam_mww.yaml` | fallback config | known-good |

## ⚠️ Annotation (2026-08-02, remote session)

The handoff's Option A contradicts itself: titled "Drop Wake Word (Keeps SD)" but describes
`ai_cam_mww.yaml` as "wake-word-only, no SD" while ALSO saying it loses the wake word and
keeps SD. The files table calls `ai_cam_mww.yaml` "Wake word only, no SD". **Before relying
on `ai_cam_mww.yaml`, open it and check which features it actually contains** — the name
suggests wake-word-only; at least one of the handoff's descriptions is wrong.
