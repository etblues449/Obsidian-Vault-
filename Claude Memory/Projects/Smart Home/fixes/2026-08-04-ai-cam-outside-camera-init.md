# ai_cam_outside — `esp32_camera` init failure (ESP_ERR_NOT_SUPPORTED)

**Date:** 2026-08-04 · **Board:** `ai_cam_outside` @ `192.168.0.201` · HA device **AI CAM 2**, area **Landing**
**Config:** [[../hardware/ai_cam_outside.yaml]] (rewritten, this session)
**Status:** ✅ **RESOLVED 2026-08-19 — camera initialises and streams.** Everything below is kept as the diagnostic record; the ⛔ blocks marked *(dead)* were disproved by the hardware.

---

## ✅ RESOLUTION — 2026-08-19, verified on hardware

**Observed, not inferred.** Boot log, `.201`, 21:50:

```
[C][component:209]: Setup esphome.coroutine took 300ms
[C][component:209]: Setup esp32_camera took 373ms
...
[C][esp32_camera:139]:   Resolution: 800x600 (SVGA)
[C][esp32_camera:140]:   Pixel Format: JPEG
[C][esp32_camera:153]:   JPEG Quality: 12
```

No `ESP_ERR_NOT_SUPPORTED`. The resolution / pixel-format / quality lines only print when
`esp_camera_init()` returned OK — the driver read a valid sensor PID and accepted the format.
`http://192.168.0.201:8080` renders a live MJPEG frame in a browser (checked 22:07 — dark,
expected at night with no IR, but non-uniform, so real sensor data rather than a dead output).

### What this kills

| Hypothesis | Verdict | Why |
|---|---|---|
| Sensor is a GC2145/GC0308 with no JPEG engine → **replace the module** | **DEAD** | `Pixel Format: JPEG` initialised. That path requires a hardware JPEG compression engine. **Test 1 (RGB565) is moot — do not run it.** |
| ESPHome 2026.7.3 regression per esphome/esphome#16926 → **downgrade** | **DEAD** | It works *on* 2026.7.3. No downgrade needed. Removing `min_version` stays correct as headroom, not as the fix. |
| EXIO3 power gating | **Consistent with the fix being present** | `Setup esphome.coroutine took 300ms` is the priority-700 hook's blocking `delay(300)`, running after the gpio switch platform drove EXIO3 LOW and before `esp32_camera` set up. `Camera Power Down` (EXIO3) and `Amp Enable` (EXIO4) both registered via the CH32V003 at I²C `0x24`. |

I²C bus scan found `0x18`, `0x24`, `0x40`. `0x3C` is absent and that is expected — the sensor sits
on the camera's own SCCB pins (`I2C Pins: SDA:-1 SCL:-1`), not this bus. Any future reasoning from
a `0x3C` scan result on *this* bus is unsound.

### What is still NOT established

1. **Which binary is running.** The log self-reports `ESPHome version 2026.7.3 compiled on
   2026-08-02 01:02:49` — the **08-02** build, not a fresh one. Pin map, 10 MHz XCLK on GPIO38,
   800x600 JPEG q12 and the 300 ms hook all match the vault file exactly, but it is **not proven**
   that the 08-04 corrections (`min_version` removal, idempotent `switch.turn_off: camera_pwdn`)
   are in the running image. Check the Device Builder last-install timestamp before assuming so.
2. **The settle delay is verified 2/10, not 10/10.** The original failure was intermittent, so two
   consecutive clean boots in one log prove nothing durable. Run the protocol below. A regression to
   `0x106` means `priority: 700` → `620` — **not** a hardware swap.
3. **Picture quality in daylight.** Only a dark-frame has been seen. If it stays black under a phone
   torch, check the peel-off film Waveshare ships over the lens.

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

## ⛔ RETRACTED — the registry inference was wrong

An earlier version of this note claimed the `landing_ai_cam_2` device had never
registered a camera entity or a `camera_power_down` switch, and concluded that nothing
had ever driven EXIO3 on this board.

**That was an overread.** The list it drew on
(`diagnostics/2026-08-02-ha-doctor.md`) is the *unknown-state* entity dump, not a full
device inventory — and Elliot's own registry check on 2026-08-04 shows
`camera.ai_cam_2_ai_cam_outside`, `sensor.landing_ai_cam_2_ai_cam_outside_wifi_signal`
and `..._ip_address`, none of which appear in that dump. So the dump cannot be read as
"these are the only entities this device has".

**Nothing is known either way about whether the 2026-08-02 firmware drove EXIO3.** Do not
carry the retracted claim forward.

What *is* known: the working file as of 2026-08-04 does drive it — expander declared,
`camera_pwdn` on EXIO3 `restore_mode: ALWAYS_OFF`, priority-700 blocking settle delay —
and **that file has never been flashed, because the build does not complete.** The
hypothesis is untested, not disproved.

**The other difference the handoff surfaced but didn't weigh:** `ai_cam` (working) was
compiled **2026-07-30**; `ai_cam_outside` (failing) was compiled **2026-08-02 on
2026.7.3**. Both are 2026.x, so "all of 2026.x is broken" is already falsified by
`ai_cam` itself — but a version bump on the Green between those two dates fits #16926
exactly, and is the single largest uncontrolled difference between the two boards.

---

---

## ⚠️ THE CURRENT BLOCKER IS THE BUILD, NOT THE CAMERA (2026-08-04)

Device Builder 1.7.0 / ESPHome 2026.7.3. Log kept at
`hardware/ai_cam_outside-install-2026-08-04.log`. It ends:

```
-- Building ESP-IDF components for target esp32s3
-- ESP-TEE is currently supported only on the esp32c6;esp32h2;esp32c5 SoCs
-- Project sdkconfig file /data/build/ai_cam_outside/sdkconfig.ai_cam_outside
```

then the UI shows **"WebSocket connection closed"** at **16m 58s**, with **2 active jobs**
on the build server.

**Read that carefully — the compile had not started.** Those are the last lines of the
*cmake configure* stage. Sixteen minutes to reach the end of configure is the Green under
memory pressure, not a YAML fault. Nothing in the config failed; `esphome` validated it
and generated C++ cleanly (the only messages are the expected strapping-pin warnings on
GPIO45/46/0 — those are camera data pins D0/D3 on this board — and the
`Charger Connected: falling back to polling mode` note for the expander pin).

Order of response:

1. **"WebSocket connection closed" is the browser losing the log stream.** It is not
   proof the build died — Device Builder keeps going server-side. Check Build server →
   jobs before concluding anything.
2. **Do NOT click "cleaning the build files for this device."** The dialog offers it and
   it is the wrong move here: it throws away the `sdkconfig` and ccache that the 16
   minutes just produced, so the next attempt pays the cost again. ESP-IDF 5.5.5 was
   being installed and cached for the first time for this device — that one-off is most
   of the 16 minutes, and a plain **Retry** skips it.
3. **Build one device at a time.** Two concurrent ESP-IDF builds is what puts a 4 GB
   Green into swap. `compile_process_limit: 1` caps parallelism *within* a build, not
   across builds.
4. **If it keeps dying, compile off-box on the PC.** [[../hardware/ai_cam-compile-runbook]]
   exists for exactly this failure mode (it was written when the Green OOM-killed the
   mWW build) and OTA reaches `.201` with no USB cable. Substitute `ai_cam_outside.yaml`
   for `ai_cam.yaml` and `192.168.0.201` for `.199`; the `secrets.yaml` step is unchanged.

   > **⛔ CORRECTED 2026-08-04** — an earlier version of this note said the config "needs
   > no external components at all". That is wrong for an off-box build, and it would
   > have wasted a session. Parallel work on master found that **PyPI ESPHome tops out at
   > 2026.6.5 and does not ship `waveshare_io_ch32v003`** — only the Green's 2026.7.1
   > add-on has it. Building this file on the PC therefore fails at validation with an
   > unknown-component error that gives no hint about the channel gap. The fix is to pin
   > the official component from the esphome repo at tag `2026.7.1`; the block is in
   > `ai_cam_outside.yaml`, commented, ready to uncomment. The runbook carries the same
   > addendum.

## ⚠️ Two configs now exist for this one board — decide before flashing

`hardware/ai_cam_outside.yaml` (node `ai_cam_outside`, **.201**, friendly_name
"AI Cam Outside") and [[../hardware/landing_ai_cam_2.yaml]] (node `landing_ai_cam_2`,
**.198**, friendly_name "Landing AI Cam") are **both configs for CAM board #2** — HA
device *AI CAM 2*, area *Landing*. They were authored in parallel on 2026-08-04 and
disagree on node name, static IP and device name.

**Flashing the `landing_ai_cam_2` one renames the HA device, which rewrites every entity
ID for this board** (live form is `landing_ai_cam_2_ai_cam_outside_*`) and breaks anything
referencing them.

**Recommendation — keep `ai_cam_outside.yaml`:** it preserves the existing entity IDs, it
is the copy actually on the Green, and it is the one being iterated on. Fold in the two
things the `landing_ai_cam_2` work got right — the `waveshare_io_ch32v003` pin at tag
`2026.7.1` (**done**, above) and the **USB-first-flash** point (board #2 probably carries
Arduino-experiment firmware from the transcript session, so there may be no ESPHome OTA
to talk to; confirm by MAC — `…83:C8` is the live `ai_cam`, `…86:70` is presumed board 2).

This is Elliot's call, not mine — but leaving both files in `hardware/` is the drift this
vault has been bitten by before. Retire whichever loses.

Until a build lands on the board, **every camera hypothesis below is untested**.

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

> **`min_version: 2026.4.0` was in the working file and has been removed.** It silently
> blocks this entire test — a downgrade fails validation instead of building. Do not add
> it back until the camera is confirmed working.

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
