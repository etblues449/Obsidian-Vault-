# AI Cam (Waveshare ESP32-S3-CAM-OV3660) — Session Handoff

**Date:** 2026-07-23 (~01:40)
**Node:** `ai_cam` · **IP:** 192.168.0.199 · **MAC:** 28:84:85:49:86:70
**HA Green:** 192.168.0.200 (HA 2026.7.3) · **ESPHome:** 2026.7.1
**Flashed via:** ESPHome Device Builder (beta) on Windows (Elliot's PC)

---

## TL;DR — where we are

- **Camera side: 100% DONE.** Streaming, snapshot, Frigate integration, recording, person detection all live and working. This is the hard-won win — the CH32V003 power-gating that defeats most people is solved.
- **Speaker side: 95% there.** The entire software chain works (media_player reaches **Playing**, DAC is master/unmuted/full-volume, amp enabled, resamplers + mixer all init). We heard **static** at 16kHz, then **silence** at 48kHz.
- **Prime remaining suspect (START HERE next session):** the media_player pipeline defaults to **FLAC**, but HA Cloud TTS sends **MP3** → format mismatch → plays silently. Fix = add `format: MP3` to both pipelines. **One flash, high confidence.**

---

## Hardware (confirmed)

- **Board:** Waveshare ESP32-S3-CAM-OV3660, SKU 33700 (Amazon UK ASIN B0GS19PKNS)
- **MCU:** ESP32-S3R8 — 8MB octal PSRAM, 16MB flash
- **Camera:** OV3660 (sensor appears at I²C 0x3C only after EXIO3 pulled LOW)
- **Audio:** ES8311 DAC (0x18), ES7210 dual-mic ADC (0x40), NS4150B amp, 1217 8Ω 2W speaker on SPK JST
- **I/O expander:** CH32V003F4U6 at I²C 0x24 — **gates camera power + amp enable**

## I²C bus (GPIO8 SDA / GPIO7 SCL) — scan confirms
| Addr | Device |
|------|--------|
| 0x18 | ES8311 audio DAC |
| 0x24 | CH32V003 I/O expander |
| 0x3C | OV3660 camera (only after EXIO3 LOW) |
| 0x40 | ES7210 mic ADC |

## Pin map (from Waveshare Interface Definition image — GROUND TRUTH)
| Signal | GPIO | | Signal | GPIO |
|--------|------|-|--------|------|
| XCLK | 38 | | I2S MCLK | 10 |
| SCCB SDA | 8 | | I2S BCLK | 13 |
| SCCB SCL | 7 | | I2S LRCK | 14 |
| VSYNC | 17 | | I2S DOUT (DAC) | 12 |
| HREF | 18 | | I2S DIN (mic) | 11 |
| PCLK | 41 | | PWDN | EXIO3 (CH32V003) |
| D0–D7 | 45,47,48,46,42,40,39,21 | | PA_EN (amp) | EXIO4 (CH32V003) |
| RESET | -1 | | | |

## Hard-won discoveries (don't re-derive these)
1. **Camera power gated by CH32V003 EXIO3** (PWDN, active-high). Must drive LOW → switch `ALWAYS_OFF`. Without it: `ESP_ERR_NOT_SUPPORTED` (sensor ACKs but PID garbage).
2. **Amp enable on CH32V003 EXIO4** → switch `ALWAYS_ON`.
3. **NOT a sibling-board pinout.** ESP32-S3-EYE / Freenove pins do NOT apply. Interface Definition image is authoritative.
4. **SCCB shares control I²C bus** — use `i2c_id: bus_a` in esp32_camera, not `i2c_pins:`.
5. **ES8311 must be I²S MASTER** (`force_master: true`) — as slave it receives data but never clocks it out → silence. This was the static→working-clock fix.
6. Board name is `esp32-s3-devkitc-1` (a typo `esp32s3-devkitc-1` warns but still builds).

---

## Audio debugging log (what we tried, in order)
| Step | Result |
|------|--------|
| Initial es8311, SLAVE mode, 16kHz | Silence, action "success" |
| `force_master: true` (→ MASTER) | **Static** — amp+speaker confirmed alive, clock now correct |
| `i2s_comm_fmt: stereo` on speaker | Invalid option, rejected |
| 48000 Hz (DAC + speaker + resamplers) | **Silence** (cleaner than static — decoder now rejecting rather than leaking) |
| Checked media_player Activity | **Playing → Idle** confirmed — software chain 100% works, signal reaches DAC |
| DAC vol / mute registers | `REG32=0xFF` (max), `REG31=0x00` (unmuted) — not the issue |
| Expanded config dump | **Found `format: FLAC` on both pipelines** — TTS sends MP3 → mismatch = silence |

**Conclusion:** every symptom (static at 16k = raw leak; clean silence at 48k = decoder rejects; Playing→Idle = pipeline runs but decodes nothing) is explained by the **FLAC/MP3 format mismatch.**

---

## ▶ NEXT SESSION — do this first (one flash)

In `ai_cam.yaml`, change the `media_player:` block to force MP3:

```yaml
media_player:
  - platform: speaker
    name: "AI Cam Speaker"
    id: cam_media
    media_pipeline:
      speaker: resample_media
      format: MP3
    announcement_pipeline:
      speaker: resample_announcement
      format: MP3
```

Also **remove any `i2s_use_apll` / `use_apll` line from the speaker block** — it's invalid there and blocks the build (was left mid-edit).

Save → validate (no red dots) → Install → OTA. Then TTS test:

```yaml
action: tts.speak
target:
  entity_id: tts.home_assistant_cloud
data:
  media_player_entity_id: media_player.ai_cam_speaker
  message: "Camera and speaker are now working"
  cache: false
```

**Fallbacks if MP3 doesn't land:**
- If `format: MP3` errors on validate → MP3 decoder not bundled. Instead make HA send FLAC (TTS engine option) OR add the audio decoder flags.
- If validates but still silent → try `i2s_use_apll: true` on the **`i2s_audio:`** block (not speaker) — per sw3Dan reference for ES8311 on shared bus.
- Last resort → drop to 16000 Hz to match the sw3Dan reference exactly.

**After speaker confirmed:** add ES7210 dual mics (DIN GPIO11), then optional voice-assistant pipeline.

---

## Known-good working YAML (camera fully working; speaker pending MP3 fix above)

```yaml
esphome:
  name: ai_cam
  friendly_name: AI Cam
  min_version: 2026.4.0
  name_add_mac_suffix: false

esp32:
  board: esp32-s3-devkitc-1
  flash_size: 16MB
  framework:
    type: esp-idf

external_components:
  - source:
      type: git
      url: https://github.com/sw3Dan/waveshare-s2-audio_esphome_voice
      ref: main
    components: [es8311]

psram:
  mode: octal
  speed: 80MHz

logger:
  level: DEBUG

api:
  encryption:
    key: !secret api_encryption_key

ota:
  - platform: esphome
    password: !secret ota_password

wifi:
  ssid: !secret wifi_ssid
  password: !secret wifi_password
  fast_connect: true
  power_save_mode: none
  reboot_timeout: 120s
  manual_ip:
    static_ip: 192.168.0.199
    gateway: 192.168.0.1
    subnet: 255.255.255.0
    dns1: 192.168.0.1
  use_address: 192.168.0.199
  ap:
    ssid: "AI-Cam-Fallback"
    password: "fallback123"

captive_portal:

web_server:
  port: 80

i2c:
  - id: bus_a
    sda: GPIO8
    scl: GPIO7
    scan: true

waveshare_io_ch32v003:
  - id: io_expander
    address: 0x24
    i2c_id: bus_a

switch:
  - platform: gpio
    name: "Camera Power Down"
    id: camera_pwdn
    restore_mode: ALWAYS_OFF
    pin:
      waveshare_io_ch32v003: io_expander
      number: 3
      mode:
        output: true
  - platform: gpio
    name: "Amp Enable"
    id: amp_enable
    restore_mode: ALWAYS_ON
    pin:
      waveshare_io_ch32v003: io_expander
      number: 4
      mode:
        output: true

esp32_camera:
  name: "AI Cam"
  external_clock:
    pin: GPIO38
    frequency: 20MHz
  i2c_id: bus_a
  data_pins: [GPIO45, GPIO47, GPIO48, GPIO46, GPIO42, GPIO40, GPIO39, GPIO21]
  vsync_pin: GPIO17
  href_pin: GPIO18
  pixel_clock_pin: GPIO41
  resolution: 800x600
  jpeg_quality: 12
  max_framerate: 5 fps

esp32_camera_web_server:
  - port: 8080
    mode: stream
  - port: 8081
    mode: snapshot

i2s_audio:
  - id: i2s_out
    i2s_lrclk_pin: GPIO14
    i2s_bclk_pin: GPIO13
    i2s_mclk_pin: GPIO10

audio_dac:
  - platform: es8311
    id: es8311_dac
    i2c_id: bus_a
    address: 0x18
    sample_rate: 48000
    bits_per_sample: 16bit
    use_mclk: true
    force_master: true

speaker:
  - platform: i2s_audio
    id: spk
    dac_type: external
    audio_dac: es8311_dac
    i2s_audio_id: i2s_out
    i2s_dout_pin: GPIO12
    sample_rate: 48000
    bits_per_sample: 16bit
    channel: mono
    timeout: never
  - platform: mixer
    id: spk_mixer
    output_speaker: spk
    source_speakers:
      - id: mixer_announcement
      - id: mixer_media
  - platform: resampler
    id: resample_media
    output_speaker: mixer_media
  - platform: resampler
    id: resample_announcement
    output_speaker: mixer_announcement

media_player:
  - platform: speaker
    name: "AI Cam Speaker"
    id: cam_media
    media_pipeline:
      speaker: resample_media
      format: MP3        # <-- THE FIX (was defaulting to FLAC)
    announcement_pipeline:
      speaker: resample_announcement
      format: MP3        # <-- THE FIX

sensor:
  - platform: wifi_signal
    name: "AI Cam WiFi Signal"
    update_interval: 60s
    entity_category: diagnostic
  - platform: uptime
    name: "AI Cam Uptime"
    update_interval: 60s
    entity_category: diagnostic

text_sensor:
  - platform: wifi_info
    ip_address:
      name: "AI Cam IP Address"
      entity_category: diagnostic
  - platform: version
    name: "AI Cam ESPHome Version"
    entity_category: diagnostic
```

---

## Frigate (working — `/config/frigate.yaml`)
- `ai_cam` stream: `http://192.168.0.199:8080#video=mjpeg` via go2rtc, MQTT to 192.168.0.200
- Detect 800x600 @ 5fps, record + snapshots 14d, person tracking — **confirmed live tile**
- `cctv_cam` (.234) and `porch` (.240) may be hardware-down, not config — verify power next time

## Entity reference
- Camera: `camera.ai_cam` / stream `:8080` / snapshot `:8081`
- Speaker: `media_player.ai_cam_speaker` (label "Speaker" under AI Cam · Living Room · ESPHome)
- Switches: `switch.ai_cam_amp_enable`, `switch.ai_cam_camera_power_down`
- Diagnostics: WiFi signal, uptime, IP, ESPHome version

## Verification URLs
- Stream: http://192.168.0.199:8080
- Snapshot: http://192.168.0.199:8081
- Web UI: http://192.168.0.199

---

*Camera: done. Speaker: one MP3 flash from done. Pick up at "NEXT SESSION" above.*


---

## ⚠️ Trap: generic ESP32-CAM audio advice (logged 2026-07-23 02:00)

Advice circulating online (and from some AI answers) tells you to set up audio on
"ESP32-S3-CAM" using **Arduino + `ESP32-audioI2S`** with:

```
audio.setPinout(47, 46, 45); // BCLK, LRC, DOUT
```

**DO NOT FOLLOW THIS ON THIS BOARD.** It is wrong on four counts:

1. **GPIO45/46/47 are CAMERA DATA PINS** on this board (D0:45, D1:47, D2:48, D3:46 —
   see boot log). Using them for I²S conflicts with the OV3660 and kills the stream.
   Real audio pins: **MCLK 10, BCLK 13, LRCK 14, DOUT 12** (already in the config).
2. **This board HAS an external DAC** — ES8311 at I²C 0x18. Claims that the "integrated
   audio module" avoids external-DAC complexity are backwards for SKU 33700.
3. **`ESP32-audioI2S` does not initialise the ES8311** over I²C — no codec setup means
   no sound regardless of pins, and no useful diagnostics.
4. **It's Arduino framework.** This node runs ESPHome/ESP-IDF with working camera,
   Frigate, HA entities and OTA. Switching frameworks discards all of that.

The ESPHome config in this document is correct. The only open item is the
media_player pipeline codec format (see NEXT SESSION above).

## Note: intermittent 0x3C absence in I²C scan
On some boots the scan lists only 0x18, 0x24, 0x40 — camera sensor 0x3C missing —
yet the camera streams normally. This is scan timing racing the EXIO3 power-up,
not a fault. Ignore it.

