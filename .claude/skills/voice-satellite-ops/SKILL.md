---
name: voice-satellite-ops
description: >-
  Build and debug JARVIS's physical layer — ESPHome satellite nodes, ES8311/ES7210 audio,
  microWakeWord "Hey Jarvis", HA Assist pipelines, Frigate cameras, entity wiring, and the Home
  Assistant REST control path against the HA Green hub at 192.168.0.200. Use for a node that
  won't boot, a camera that won't init, a speaker that outputs static or silence, a mic that
  isn't detected, a wake word that won't trigger, an automation calling a missing entity, or
  making JARVIS actually perform a device action instead of only logging the intent. Also use
  when re-flashing or correcting an earlier node config.
when_to_use: >-
  Trigger on: node won't boot or is unreachable, camera won't init, speaker static or silence,
  mic not detected, wake word won't fire, an automation references a missing entity, JARVIS
  logged an intent instead of performing it, re-flash or correct a node config. Covers ESPHome,
  Assist, Frigate, and the HA REST path against 192.168.0.200.
---

# Voice & satellite ops

This is the only part of JARVIS that touches hardware, which makes its failures the
expensive kind. The AI Cam audio pin map cost roughly four hours of chasing static
because generic internet advice was trusted over the vendor BSP.

Read `vault-conventions` — in particular the rule that a **CORRECTION / RESOLVED /
SUPERSEDES** section in a note beats anything earlier in the vault, including the project
index. Hardware facts in this vault have been corrected in place.

## Ground truth

Do not re-derive these.

| Fact | Value |
|---|---|
| HA Green hub | `192.168.0.200` (`192.168.0.50:8123` in older docs is stale) |
| AI Cam node | `ai_cam` @ `192.168.0.199`, Waveshare ESP32-S3-CAM-OV3660 |
| AI Cam audio pins | MCLK **10** / BCLK **11** / LRCK **12** / DOUT **14** |
| AI Cam codec role | ES8311 = **SLAVE**, ESP32 = I²S master. Never `force_master: true`. `I2S Role: SLAVE` in the log is correct. |
| AI Cam camera power | CH32V003 **EXIO3 LOW**, or OV3660 fails init (`ESP_ERR_NOT_SUPPORTED`, garbage PID, `0x106`) |
| AI Cam amp enable | **EXIO4 HIGH** |
| AI Cam status | **COMPLETE (2026-07-29)** — camera, speaker, ES7210 mics, microWakeWord, buttons, LED |
| ES7210 component | Written from scratch, working. `esphome/components/es7210/` in this vault. Ported from Espressif `esp_codec_dev` v1.6.2. Reusable on any ES7210 board |
| ESP32-S3-AUDIO-Board | `192.168.0.216` — same ES7210 component applies |
| Other cameras | `cctv_cam` `.234`, `porch` `.240` — may be hardware-down, not misconfigured |
| RuView CSI node | ESP32-S3 node 3 @ `192.168.0.227` |
| Canonical bedroom config | `bedroom-2.yaml` (`bedroom.yaml` is broken) |
| Canonical TV entity | `media_player.tv_jelly_beans_tv_2` |
| Frigate | HA Green, 3 cameras, CPU detector, MQTT → `.200`, `/config/frigate.yaml`, 800x600 @ 5fps |

## The vendor BSP is authoritative

For any Waveshare board, the pin truth is:

```
github.com/waveshareteam/ESP32-S3-CAM-OVxxxx        (examples 01–06, Schematic/)
waveshare/esp32_s3_cam_ovxxxx                        (BSP, components.espressif.com)
```

The product "Interface Definition" image is **not** authoritative. On this board its
camera pins happened to be right and its audio pins were wrong. Reading the BSP header
settles a pin question in two minutes; iterating on guesses costs hours.

**When a codec is silent or produces static: stop and re-read the BSP pin map before
changing anything else.** Do not iterate.

## Rules

- **One radio concern per node.** BLE and mmWave on the same ESP32 contend. Split them
  across nodes rather than tuning around it — the upstairs contention is unresolved
  precisely because it was tuned around instead of split.
- **AEC cancels the board's own audio, not the TV's.** There is no reference signal for
  external audio, so a single 2-mic board cannot barge in over a loud TV. Whole-room
  voice needs placement, BSS direction, and 2–3 satellites; a loud-lounge primary
  ultimately needs a 4-mic XMOS array. Do not promise otherwise.
- **Verify an entity exists before writing an automation against it.** A renamed entity
  breaks silently. Never guess a similar-looking ID.
- **Read-only HA calls flow freely; state changes ask first.** Reading an entity is free.
  Calling a service that changes the house, or writes a setting, stops for an explicit
  yes. One yes authorises one action.
- **Never confirm an action you did not perform.** If the voice layer says "lights on",
  a service call must have returned success. Confirming an unexecuted action is the worst
  failure mode in this system — worse than refusing, because it destroys trust in every
  other confirmation.
- **IP before firmware.** A node unreachable at its address is a DHCP reservation or
  collision problem far more often than a firmware problem. Check the lease before you
  reflash — `.171` collisions are a recurring class here.
- **£0 applies here too.** Local Assist + on-device microWakeWord is free. Cloud STT/TTS
  subscriptions are not.

## Every hardware change ships with

```
1. The full config file, rewritten (ESPHome / HA automation YAML)
2. The pin map used AND the vendor source it came from (repo path or BSP header)
3. The exact log line that proves success (e.g. "I2S Role: SLAVE")
4. A physical verification step the user performs on the device
```

For HA control changes: name the entity ID, show the service call, and state whether it
is read-only or gated.

## Recording what you learn

Hardware knowledge that stays in chat is lost. Any corrected pin map, working config, or
disproved assumption goes to the vault keeper for a session note — write the correction
as an explicit **CORRECTION** section so it wins over the earlier claim on the next read.

## Re-running

Read the relevant handoff note before touching a node that has been worked on before
(e.g. `Claude Memory/Projects/Smart Home/sessions/2026-07-23-ai-cam-handoff.md`). Never
retry an OTA flash blindly on a device you cannot physically reach — confirm the recovery
path first.

## Gotchas

- **`timeout: never` on an ESPHome speaker silently kills the microphone forever.** The
  I²S bus is a mutex; the speaker never releases it. Nothing errors — the mic simply never
  starts. Use a real timeout (`500ms`).
- **The product "Interface Definition" image is not the BSP.** On the Waveshare
  ESP32-S3-CAM its camera pins happened to be right and its audio pins were wrong. That
  cost roughly four hours of chasing static. Read the vendor BSP header instead — two
  minutes.
- **ES8311 is the SLAVE.** `force_master: true` is wrong here. A log line reading
  `I2S Role: SLAVE` is the success condition, not a warning.
- **Camera init failure is a power problem, not a camera problem.**
  `ESP_ERR_NOT_SUPPORTED`, a garbage PID, or `0x106` means EXIO3 is not driven LOW.
- **An unreachable node is DHCP before it is firmware.** Check the lease table for a
  collision before reflashing. Reflashing first has cost time here more than once.
- **AEC cannot cancel the TV.** It cancels the board's own output; there is no reference
  signal for external audio. A single 2-mic board will not barge in over a loud room.
- **BLE and mmWave on one ESP32 contend.** Split them across nodes. The upstairs
  contention is still open precisely because it was tuned around instead of split.
- **Never speak a confirmation before the service call returns success.** A false
  confirmation destroys trust in every subsequent one.
