# ai_cam_outside — `esp32_camera` init failure (ESP_ERR_NOT_SUPPORTED)

**Date:** 2026-08-04 · **Board:** `ai_cam_outside` @ `192.168.0.201` · HA device **AI CAM 2**, area **Landing**
**Config:** [[../hardware/ai_cam_outside.yaml]] (rewritten, this session)
**Status:** diagnosis corrected; config shipped; **not yet flashed or verified on hardware**

---

## ⛔ CORRECTION — the handoff's central deduction does not hold

The 2026-08-04 handoff states:

> The sensor is powered and answering on I2C, so this is **not** the power-down-pin /
> indeterminate-state cause reported in #16926, and not a wiring fault.

**An I2C ACK at 0x3C does not prove the sensor is powered.** This vault documented the
opposite signature over a year of work on the sibling board:

- `hardware/Waveshare ESP32-S3-CAM-OV3660 — Arduino IDE Setup (CORRECTED).md`:
  > Until you drive **EXIO3 LOW** over I²C, the OV3660 sensor is held powered-off.
  > **It will ACK on the I²C bus but return a garbage product ID** → `0x106`.
- `sessions/2026-07-23-ai-cam-handoff.md`:
  > Camera power gated by CH32V003 EXIO3 (PWDN, active-high). Must drive LOW → switch
  > `ALWAYS_OFF`. Without it: `ESP_ERR_NOT_SUPPORTED` (**sensor ACKs but PID garbage**).

`0x106` *is* `ESP_ERR_NOT_SUPPORTED`. So the exact observation used to rule the power
cause **out** is the documented signature of the power cause. The deduction is unsound.

**But the conclusion may still be right, for a reason the handoff didn't give.** The
2026-08-01 schematic verification found CAM_PWDN carries a **10K pull-down (R8)**, and
the CH32V003 resets to DIR=0xFF (all inputs). A config that never touches the expander
leaves EXIO3 floating → R8 pulls it low → the camera *is* powered. So "0x3C answers" is
consistent with both a healthy sensor and a power-gated one. **It discriminates nothing.**

## ⛔ CORRECTION — `ESP_ERR_NOT_SUPPORTED` has at least three causes, and the pasted log cannot separate them

`esp_camera_init()` returns this same errno from more than one place:

| # | Cause | Where | What it means |
|---|---|---|---|
| 1 | PID/VER read back as garbage — sensor not awake | `camera_probe()` | power gating (EXIO3) or a bad/absent XCLK |
| 2 | PID/VER read back cleanly but match no sensor in the driver table | `camera_probe()` | a genuinely different sensor, or one whose driver isn't compiled in |
| 3 | `PIXFORMAT_JPEG` requested, sensor reports `support_jpeg = false` | `esp_camera_init()` | the handoff's GC2145/GC0308 hypothesis |

Causes 1 and 2 share a log line (`Detected camera not supported.`) and are told apart by
the **PID value** printed just before it. Cause 3 has its own distinct message.

The log in the handoff is **`dump_config()` output only** — `[C][esp32_camera:139…143]`
are the dump lines, which report the errno and never the reason. The lines that
discriminate are emitted earlier in boot under the **ESP-IDF `camera` tag**, not
ESPHome's `esp32_camera` tag, and only at DEBUG level.

**This means Test 1 in the handoff (reflash with RGB565) is not the cheapest decisive
test — reading the existing boot log is, and it costs one reboot and zero flashes.**

## ⛔ CORRECTION — #16926 does not say what the handoff says it says

The handoff claims:

> In #16926 the same error signature shows up as ESP32-CAM boards that shipped with a
> GC2145 instead of a genuine OV2640.

Read live 2026-08-04, the issue says the reverse. It is open, and it reports:

- Affected: **Seeed XIAO ESP32S3 Sense (OV2640)** and **AI Thinker ESP32-CAM (OV3660)** —
  **OV3660 is explicitly named as affected**.
- Blamed on "ESPHome 2026.x with the updated esp-idf framework".
- > "Both boards confirmed working with Arduino CameraWebServer example firmware, ruling
  > out hardware faults."

So #16926 is evidence *against* the wrong-sensor hypothesis, not for it. It describes
genuine OV3660 hardware failing under ESPHome 2026.x and working under Arduino.

---

## What the registry actually shows about this board

From `diagnostics/2026-08-02-ha-doctor.md`, the entities `landing_ai_cam_2` has ever
registered are:

```
update.landing_ai_cam_2_firmware
select.landing_ai_cam_2_assistant            select.landing_ai_cam_2_assistant_2
select.landing_ai_cam_2_wake_word            select.landing_ai_cam_2_wake_word_2
select.landing_ai_cam_2_finished_speaking_detection
assist_satellite.landing_ai_cam_2_assist_satellite
```

**No camera entity, and — decisively — no `switch.…_camera_power_down` and no
`switch.…_amp_enable`.** The working board has `switch.living_room_ai_cam_camera_power_down`
(ha-doctor checks it explicitly). So the config flashed on `.201` has never declared the
CH32V003 expander at all, and nothing has ever driven EXIO3 on this board.

*Caveat, stated honestly:* that snapshot is 2026-08-02 and the device was offline, so it
reflects the last build that connected, not necessarily the current one. It is strong
evidence, not proof.

**The other difference the handoff surfaced but didn't weigh:** `ai_cam` (working) was
compiled **2026-07-30**; `ai_cam_outside` (failing) was compiled **2026-08-02 on
2026.7.3**. Both are 2026.x, so "all of 2026.x is broken" is already falsified by
`ai_cam` itself — but a version bump on the Green between those two dates fits #16926
exactly, and is the single largest uncontrolled difference between the two boards.

---

## Ordered diagnosis — cheapest and most decisive first

### Test 0 — read the PID. No flash. Settles all three hypotheses at once.

The current build already logs this if `logger: level: DEBUG` is set. Reboot the board
and read the boot log (ESPHome dashboard log view, or USB serial), looking for the
**`camera`** tag — *not* `esp32_camera` — near the start of setup:

```
Detected camera at address=0x3c
Camera PID=0x…  VER=0x…  MIDL=0x…  MIDH=0x…
```

then one of:

| Line that follows | Verdict |
|---|---|
| `Detected camera not supported.` **with PID=0x3660** | Genuine OV3660. Sensor is fine. → **#16926 / version. Go to Test 3.** |
| `Detected camera not supported.` with PID=**0x2145** / **0x0308** | GC2145 / GC0308. No JPEG engine. → **module must be replaced.** |
| `Detected camera not supported.` with PID=**0x0000 / 0xFFFF / garbage** | Sensor not awake — power or XCLK. → **Test 1, then Test 4.** |
| `JPEG format is not supported on this sensor` | The handoff's hypothesis, **confirmed outright**. → module replacement. |

Exact wording may vary slightly by esp32-camera version — grep the log for `PID` and for
the `camera` tag rather than matching strings literally. **This one line replaces the
handoff's Test 1 entirely**, and unlike Test 1 it also distinguishes power failure from
sensor identity.

If DEBUG logging isn't on, that alone is the reason you've never seen these lines — the
rewritten config sets it.

### Test 1 — flash the rewritten config

[[../hardware/ai_cam_outside.yaml]]. It adds the expander, drives EXIO3
LOW deterministically, adds the priority-700 blocking settle delay, and fixes the compile
blocker by removing the fallback AP rather than adding a secret.

It also clears the `ap_fallback_password` problem the correct way: an open or weak
fallback AP on an outdoor board that also runs `captive_portal` and `web_server: 80` is
an unauthenticated route onto the LAN. Removing the block loses nothing — `reboot_timeout`
plus OTA already recover the node.

> **The settle delay has never been flashed on any board.** It was proposed 2026-08-01
> and left unverified. Verify it with the 10-reboot protocol below before recording it as
> working anywhere.

### Test 2 — RGB565 probe (only if Test 0 gave no PID line)

The commented block in the config. Initialises under RGB565 but not JPEG → no hardware
JPEG engine → module replacement. Note that `esp32_camera_web_server` cannot serve
RGB565, so this is a diagnostic only: no `:8080`, no go2rtc, no Frigate.

### Test 3 — the version test (leading candidate if PID reads 0x3660)

Read the known-good version off the working board first — **do not guess it**:

```
Developer Tools → States → sensor.living_room_ai_cam_ai_cam_esphome_version
```

(confirm the exact ID there; the rewritten config adds the same sensor to this board so
the two become directly comparable). Then rebuild `ai_cam_outside` against that version,
or pin the framework in the `esp32:` block. Pinning the framework is the more surgical
move, since #16926 blames the esp-idf bump rather than ESPHome itself.

The config deliberately carries **no `min_version:`** so this downgrade is not blocked.

### Test 4 — XCLK margin (cheap, unlikely, last)

`external_clock: frequency: 20MHz`. Held at 10 MHz in the shipped config because that is
what the **known-good** board runs — changing it moves away from the working reference,
so do it only after Test 0 has ruled out sensor identity.

---

## 10-reboot verification protocol (for the settle delay)

Reboot 10 times. `[E][esp32_camera:143]: Setup Failed: ESP_ERR_NOT_SUPPORTED` must not
appear once. If it still does, the camera set up before the trigger ran — lower
`priority: 700` to `620` and repeat. An async `delay:` will not work here; the blocking
lambda is the point.

Occasional boots missing `0x3C` from the I2C scan while the camera streams fine are scan
timing, not a fault.

---

## Frigate — for when the camera initialises

`frigatestandalone.yml` currently defines exactly one camera. Add alongside `ai_cam`,
then restart Frigate. **Pointless until the camera initialises** — do not add it first.

```yaml
  ai_cam_outside:
    ffmpeg:
      inputs:
        - path: rtsp://192.168.0.200:8554/ai_cam_outside
          roles: [detect, record]
    detect:
      width: 800
      height: 600
      fps: 5
    objects:
      track: [person]
    record:
      enabled: true
      retain:
        days: 14
    snapshots:
      enabled: true
```

go2rtc already has the stream defined
(`ai_cam_outside` → `ffmpeg:http://192.168.0.201:8080#video=h264`), so nothing changes there.

---

## The outcome worth banking regardless

The audio chain does not depend on `esp32_camera`, and the I2C scan already proves both
codecs are alive. This board is currently **fully offline** — ha-doctor found only 1 of 4
voice satellites online, with `landing_ai_cam_2` unavailable. The rewritten config brings
it back as a working Assist satellite (mic, speaker, `announce`, `ask_question`,
push-button voice) **whether or not the camera ever initialises**. On a landing that is
plausibly worth more than the video was.

`micro_wake_word` is deliberately omitted — the TFLite build OOM-kills the Green's
compiler on this board family. Compile off-box per
[[../hardware/ai_cam-compile-runbook]] to add it.

## Not done here

Nothing in this note has been run against hardware. I have no route to `192.168.0.200`
or `.201` from this environment, and the working file
`C:\Users\ellio\Downloads\ai_cam_outside.yaml` is on the PC, so the "what changed"
list is reconstructed from the handoff's description of it plus the registry snapshot —
not from a diff against the actual file.
