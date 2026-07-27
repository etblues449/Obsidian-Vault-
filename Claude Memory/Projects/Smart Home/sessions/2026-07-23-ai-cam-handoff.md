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


---

# ⛔ CORRECTION (2026-07-23, later session) — AUDIO PIN MAP ABOVE IS WRONG

The audio pin map earlier in this document (MCLK 10 / BCLK 13 / LRCK 14 / DOUT 12 /
DIN 11) was **derived from the Amazon Interface Definition image and is incorrect**.
It is the reason the speaker produced static and then silence all session. The camera
pins in that table are correct and unaffected.

## Authoritative source
Waveshare's own repo + BSP component (not the product image):

```
git clone https://github.com/waveshareteam/ESP32-S3-CAM-OVxxxx.git
```
- Audio example: `examples/ESP-IDF-v5.5.1/03_audio_play`
- BSP (managed component, from ESP Component Registry):
  `waveshare/esp32_s3_cam_ovxxxx` v2.0.1 → `include/bsp/esp32_s3_cam_ovxxxx.h`

## CORRECT audio pins (from BSP header, verified against its i2s_std_gpio_config_t)
```c
#define BSP_I2S_MCLK   (GPIO_NUM_10)   // .mclk
#define BSP_I2S_SCLK   (GPIO_NUM_11)   // .bclk
#define BSP_I2S_LCLK   (GPIO_NUM_12)   // .ws   (LRCK)
#define BSP_I2S_DOUT   (GPIO_NUM_14)   // .dout (ESP -> ES8311 DAC / speaker)
#define BSP_I2S_DSIN   (GPIO_NUM_13)   // .din  (ES7210 mics -> ESP)
```

| Signal | WRONG (was flashed) | CORRECT |
|---|---|---|
| MCLK | GPIO10 | GPIO10 (only one that was right) |
| BCLK | GPIO13 | **GPIO11** |
| LRCK | GPIO14 | **GPIO12** |
| DOUT (speaker) | GPIO12 | **GPIO14** |
| DIN (mics, for ES7210 later) | GPIO11 | **GPIO13** |

## CORRECT I²S role — `force_master: true` was ALSO wrong
BSP source `esp32_s3_cam_ovxxxx.c`:
```c
line 226: I2S_CHANNEL_DEFAULT_CONFIG(CONFIG_BSP_I2S_NUM, I2S_ROLE_MASTER);  // ESP32 = MASTER
line 305: .master_mode = false,                                            // ES8311 = SLAVE
```
→ **Remove `force_master`** from the `audio_dac:` block. ES8311 must be SLAVE; the
ESP32 drives BCLK/LRCK. A log line reading `I2S Role: SLAVE` is CORRECT, not a fault.

Other BSP details: slot format is `I2S_STD_PHILIP_SLOT_DEFAULT_CONFIG`, 16-bit
(= ESPHome's default `std` comm format, so nothing to set). `BSP_POWER_AMP_IO` is
`GPIO_NUM_NC` — confirms no direct amp GPIO; amp is via the CH32V003 expander.
EXIO4 HIGH = amp on is empirically confirmed (static was audible with it ON) — keep
`ALWAYS_ON`. EXIO3 LOW for camera power is confirmed working — keep `ALWAYS_OFF`.

Waveshare's `03_audio_play` opens the codec at 24000 Hz / 2ch; 48000 mono works fine
through the ESPHome resamplers, so sample rate was never the fault.

## Corrected audio blocks
```yaml
i2s_audio:
  - id: i2s_out
    i2s_mclk_pin: GPIO10
    i2s_bclk_pin: GPIO11
    i2s_lrclk_pin: GPIO12

audio_dac:
  - platform: es8311
    id: es8311_dac
    i2c_id: bus_a
    address: 0x18
    sample_rate: 48000
    bits_per_sample: 16bit
    use_mclk: true          # NOTE: no force_master — ES8311 is SLAVE

speaker:
  - platform: i2s_audio
    id: spk
    dac_type: external
    audio_dac: es8311_dac
    i2s_audio_id: i2s_out
    i2s_dout_pin: GPIO14
    sample_rate: 48000
    bits_per_sample: 16bit
    channel: mono
    timeout: never
```

## Lesson
For Waveshare boards, **clone the vendor repo and read the BSP header** before trusting
a product-page interface image, a datasheet diagram, or any generic ESP32-CAM guide.
The BSP is what their own firmware ships against.

**Status at time of this correction:** corrected pins + slave role handed over for
flashing; result not yet confirmed in this session. If sound works, mark the speaker
DONE and proceed to ES7210 mics on DIN **GPIO13** (I²C 0x40).


---

# ✅ RESOLVED (2026-07-23) — SPEAKER WORKING

TTS confirmed audible through the onboard speaker after flashing the corrected pins
and role from the vendor BSP. **Camera + speaker now both fully working on one board.**

**The fix that did it:**
- BCLK GPIO13 → **GPIO11**
- LRCK GPIO14 → **GPIO12**
- DOUT GPIO12 → **GPIO14**
- removed `force_master: true` (ES8311 is SLAVE; ESP32 masters the clocks)

Everything else (48000 Hz, mono, 16-bit, mixer + dual resamplers, EXIO3 LOW for camera
power, EXIO4 HIGH for amp) was already correct and unchanged.

**Root cause of the whole session's static-then-silence:** the audio pin map was taken
from the Amazon product "Interface Definition" image instead of Waveshare's BSP. Three
of four I²S pins were permuted, so speaker data was being driven onto the word-select
line. The camera pins in that image were correct, which is what made it look reliable.
Every subsequent theory (master mode, 16k vs 48k, FLAC vs MP3, APLL) was built on that
broken foundation and was a dead end.

**Time cost:** ~4 hours. **Time to settle it once the vendor repo was cloned:** ~2 min.

## Confirmed-good audio block (as flashed, working)
```yaml
i2s_audio:
  - id: i2s_out
    i2s_mclk_pin: GPIO10
    i2s_bclk_pin: GPIO11
    i2s_lrclk_pin: GPIO12

audio_dac:
  - platform: es8311
    id: es8311_dac
    i2c_id: bus_a
    address: 0x18
    sample_rate: 48000
    bits_per_sample: 16bit
    use_mclk: true

speaker:
  - platform: i2s_audio
    id: spk
    dac_type: external
    audio_dac: es8311_dac
    i2s_audio_id: i2s_out
    i2s_dout_pin: GPIO14
    sample_rate: 48000
    bits_per_sample: 16bit
    channel: mono
    timeout: never
```

## Next on this board
- **ES7210 dual mics** — DIN = **GPIO13**, I²C **0x40**. Reference: `02_esp_sr` example in
  the vendor repo. Once mics land, this board becomes a full Assist satellite
  (camera + speaker + mics) with microWakeWord.
- Optional: Music Assistant target now that the media_player is real.


---

# Battery / portable operation (researched 2026-07-23)

**The board is battery-capable by design** — confirmed from `Schematic/ESP32-S3-CAM-XXXX-schematic.pdf`
and the BSP, not from marketing copy.

Onboard hardware:
- **ETA6098** switching Li-ion charger (up to 2.5A capable; actual current set by a resistor on the
  ISET pin — Waveshare's value not verified)
- **J4** battery connector, **VBAT** net
- **CHG_STAT** charge-status line
- **PWR_KEY** power button; **VBUS/VSYS** power-path switching (runs while charging)
- Battery voltage sensing via CH32V003 ADC — BSP exposes `bsp_get_io_expander_adc()` and a
  `g09_battery` group (`BSP_BATTERY_VOLTAGE` = GPIO_NUM_NC, "Connected via IO expander ADC")

**Battery type:** single-cell 3.7V Li-ion / LiPo (4.2V float), protected pack, JST to J4.

## Runtime estimate — continuous MJPEG streaming
Workload: 800x600 @5fps + WiFi `power_save_mode: none` + camera + octal PSRAM @80MHz.
Estimated ~250–350 mA average from the cell.

| Cell | Est. continuous streaming |
|---|---|
| 2000 mAh LiPo | ~6–8 h |
| 3000 mAh | ~9–12 h |
| 18650 (3400 mAh) | ~10–14 h |

**Portable = a shift, not a season.** Fine for temporary placement / events / cable-free jobs.
Not viable as a permanent battery camera: 24/7 Frigate streaming is a mains workload, because
deep sleep (the only big power lever) is incompatible with a continuous stream.

For long life you'd change the *duty cycle*, not the battery: deep sleep + wake on motion
(PIR or an LD2410), snapshot-and-push rather than stream. Days-to-weeks life, but it leaves
Frigate's continuous pipeline.

## Cautions before connecting a cell
1. **Verify J4 polarity with a meter** against the schematic first — Waveshare JST polarity is not
   consistent across their boards; reversed will kill the board.
2. **Battery % in HA is not free.** Voltage is behind the CH32V003 ADC. The `waveshare_io_ch32v003`
   ESPHome external component in use here exposes GPIO but no ADC read — surfacing a battery sensor
   would need the component extending (see `bsp_get_io_expander_adc()` in the BSP for the register
   interface). Don't assume a percentage appears automatically.

Ties into existing next action "Order: 18650 cells" — note an 18650 needs a holder + JST pigtail;
a LiPo pouch pack with a JST already fitted is the lower-friction option.


---

# ✅ ES7210 MICROPHONES WORKING (2026-07-27)

**Wrote a custom ESPHome external component for the ES7210 — it did not exist before this.**
Confirmed initialising on hardware.

Boot log evidence:
```
[C][es7210:191]: ES7210 Audio ADC:
[C][es7210:192]:   Address: 0x40
[C][es7210:197]:   Mode: SLAVE (ESP32 drives BCLK/LRCK)
[C][es7210:198]:   Bits per sample: 16
[C][es7210:199]:   Mic gain: 30.0 dB (reg 0x0A)
[C][es7210:201]:   Channels: MIC1=YES MIC2=YES MIC3=NO MIC4=NO
[C][i2s_audio.microphone:053]: Microphone:
[C][i2s_audio.microphone:053]:   Pin: 13
```
No `Setup FAILED` = every I2C write in the init sequence was ACKed.

## Component location
Committed to this vault: **`esphome/components/es7210/`**
- `__init__.py` — namespace + class declaration
- `audio_adc.py` — the `audio_adc` platform (schema, codegen)
- `es7210.h` — register map + class
- `es7210.cpp` — implementation

Referenced from ESPHome via git:
```yaml
external_components:
  - source:
      type: git
      url: https://github.com/etblues449/Obsidian-Vault-
      ref: master
      path: esphome/components
    components: [es7210]
```
(A local copy under `/config/esphome/components/es7210/` with `type: local` works too.)

## Source of truth for the port
Espressif **`esp_codec_dev` v1.6.2**, `device/es7210/es7210.c` + `es7210_reg.h`
(downloaded from components.espressif.com). The Waveshare BSP just calls
`es7210_codec_new()` — nothing board-specific except the I2C address 0x40.

Init sequence ported verbatim from `es7210_open()`:
reset 0x00=0xFF then 0x41 → clock-off 0x01=0x3F → time control 0x09/0x0A=0x30 →
HPF 0x23=0x2A, 0x22=0x0A, 0x20=0x0A, 0x21=0x2A → slave mode (0x08 bit0=0) →
analog 0x40=0x43 → mic bias 0x41/0x42=0x70 → OSR 0x07=0x20 → mainclk 0x02=0xC1 →
word length 0x11 (16-bit = 0x60) → mic channel enable + gain → power-up 0x06=0x00 →
clock gate release 0x01=0x14.

Gain mapping mirrors `get_db()`: 3 dB steps to 33 dB, then discrete codes
0x0B=30, 0x0C=34.5, 0x0D=36, 0x0E=37.5 dB. 30 dB → reg 0x0A (confirmed in log).

**Slave mode is correct** — `es7210_config_sample()` returns immediately when
`master_mode == false`, so no LRCK/coeff table config is needed. The ESP32 drives
the clocks (matches `I2S_ROLE_MASTER` in the BSP).

## Two blockers that had to be solved
1. **ONE i2s_audio bus, not two.** Declaring `i2s_out` and `i2s_in` with the same
   MCLK/BCLK/LRCK pins triggers "Pin 10/11/12 is used in multiple places" — a hard
   error. Correct pattern: a single bus, with speaker and microphone both as children
   referencing the same `i2s_audio_id`. Both attach via `register_i2s_audio_component`
   → `cg.register_parented()`; nothing forbids two children on one bus.
2. **No ES7210 driver existed in ESPHome.** The sw3Dan external component ships
   `es8311` only. Hence this port.

## Sample rate constraint
Speaker and mic share one I2S port → shared BCLK/LRCK → **they must use the same
sample rate**. Dropped the whole chain to **16000 Hz** (was 48000). Resamplers handle
TTS arriving at other rates. MCLK correctly recalculated to 4.096 MHz (16000 × 256).

`use_microphone: true` on the **es8311** block is NOT needed and should be removed —
the mics are on the ES7210, not the ES8311.

## Still to verify
- Audio actually reaching HA (add `voice_assistant:` and check STT returns text)
- Whether the shared I2S port supports true simultaneous record+play (full duplex)
  or serialises via the bus lock — matters for barge-in
- microWakeWord "Hey Jarvis" on-device

## Board status: camera ✅ · speaker ✅ · mics ✅ (initialised)

