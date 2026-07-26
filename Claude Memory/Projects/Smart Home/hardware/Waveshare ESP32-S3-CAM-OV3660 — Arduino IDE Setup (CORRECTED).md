# Waveshare ESP32-S3-CAM-OV3660 — Setup, Corrected

**Board:** Waveshare ESP32-S3-CAM-OV3660, SKU 33700 (Amazon UK ASIN B0GS19PKNS)
**MCU:** ESP32-S3R8 — 8 MB octal PSRAM, 16 MB flash · **Camera:** OV3660
**Status of this board in JARVIS:** camera **already working** on node `ai_cam` @ 192.168.0.199 (via ESPHome, 2026-07-23). See [[../sessions/2026-07-23-ai-cam-handoff]].

---

## TL;DR — why the Google AI Mode steps kept failing

The transcript looped on `Camera init failed with error 0x106` (`ESP_ERR_NOT_SUPPORTED`) and tried to fix it by pasting three different pinouts. **None of them could ever have worked, and the pins were not even the real problem.**

This is **not a standard ESP32-CAM / AI-Thinker board.** On this board:

> **The camera's power-down (PWDN) line is not wired to any ESP32 GPIO. It is on a CH32V003 I/O-expander chip (I²C 0x24), pin EXIO3, and it is active-high.** Until you drive **EXIO3 LOW** over I²C, the OV3660 sensor is held powered-off. It will ACK on the I²C bus but return a garbage product ID → `0x106`.

The stock Arduino `CameraWebServer` sketch has **no code that talks to the CH32V003 at all.** So no matter which `board_config.h` pinout you paste, the sensor stays unpowered and you get `0x106` forever. That is exactly the loop the AI Mode session was stuck in.

On top of that, **every pinout the AI suggested was wrong**, and so was the camera-model define (`CAMERA_MODEL_ESP32S3_CAM_OV5640` — wrong sensor, wrong board).

There are two ways forward. The **recommended** one is ESPHome, because it is already proven working on this exact board. The Arduino path is possible but you must add the I/O-expander wake-up yourself.

---

## The correct hardware pin map (verified — this is ground truth)

These are the real pins for this board, confirmed working in the flashed `ai_cam` node.

| Camera signal | GPIO | | Camera signal | GPIO |
|---|---|-|---|---|
| XCLK | **38** | | D0 (Y2) | **45** |
| PCLK | **41** | | D1 (Y3) | **47** |
| VSYNC | **17** | | D2 (Y4) | **48** |
| HREF | **18** | | D3 (Y5) | **46** |
| SIOD / SDA (SCCB) | **8** | | D4 (Y6) | **42** |
| SIOC / SCL (SCCB) | **7** | | D5 (Y7) | **40** |
| RESET | **-1** | | D6 (Y8) | **39** |
| PWDN | **EXIO3** on CH32V003 (NOT a GPIO) | | D7 (Y9) | **21** |

**SCCB (camera I²C) shares the main control I²C bus** — SDA GPIO8 / SCL GPIO7, the same bus the CH32V003 (0x24), ES8311 (0x18) and ES7210 (0x40) live on. The camera sensor appears at **0x3C** *only after EXIO3 is pulled LOW.*

| CH32V003 expander pin | Function | Required state |
|---|---|---|
| **EXIO3** | Camera PWDN (active-high) | **LOW** = camera powered on |
| **EXIO4** | Audio amp enable (PA_EN) | HIGH = amp on (only needed for the speaker) |

---

## ✅ Recommended path — ESPHome (proven working on this board)

This is the config actually running on `ai_cam`. It handles the CH32V003 power-gating for you (the `switch:` block), so the camera "just works." Flash it with the ESPHome Device Builder / dashboard.

You need the external I/O-expander component `waveshare_io_ch32v003` (see [ESPHome docs](https://esphome.io/components/waveshare_io_ch32v003/) / [component repo](https://github.com/fuzzybear62/esphome-waveshare_io_ch32v003)). Recent ESPHome ships it; if yours doesn't, add it as an external component.

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

captive_portal:

web_server:
  port: 80

# --- Control I²C bus: camera SCCB + CH32V003 + audio codecs all live here ---
i2c:
  - id: bus_a
    sda: GPIO8
    scl: GPIO7
    scan: true

# --- The piece the Arduino sketch is missing: the I/O expander ---
waveshare_io_ch32v003:
  - id: io_expander
    address: 0x24
    i2c_id: bus_a

switch:
  # EXIO3 LOW = camera powered ON. Without this you get 0x106.
  - platform: gpio
    name: "Camera Power Down"
    id: camera_pwdn
    restore_mode: ALWAYS_OFF        # ALWAYS_OFF => drives the pin LOW
    pin:
      waveshare_io_ch32v003: io_expander
      number: 3
      mode:
        output: true
  # EXIO4 HIGH = audio amp enabled (only needed if you use the speaker)
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
  i2c_id: bus_a                      # SCCB shares bus_a — do NOT use i2c_pins:
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
```

After flashing, the stream is at `http://<device-ip>:8080` and a snapshot at `:8081`.
For the **speaker** (ES8311) and **mics** (ES7210), see the full working audio blocks and the hard-won pin corrections in [[../sessions/2026-07-23-ai-cam-handoff]] — short version: I²S **MCLK 10 / BCLK 11 / LRCK 12 / DOUT 14 / DIN 13**, ES8311 is **SLAVE** (no `force_master`), amp on EXIO4.

---

## ⚙️ If you insist on Arduino IDE

You can do it, but the sketch must **wake the camera over I²C before `esp_camera_init()`**. The IDE/board setup in the transcript was *mostly* fine — here is the whole thing corrected.

### 1. Board URL, package, board — these were OK
- **File → Preferences → Additional Board Manager URLs:**
  `https://espressif.github.io/arduino-esp32/package_esp32_index.json` ✅
- **Tools → Board → Boards Manager →** install **esp32 by Espressif Systems** (3.x). ✅
- **Tools → Board →** `ESP32S3 Dev Module`. ✅

### 2. Tools menu — corrected settings
| Setting | Value | Note |
|---|---|---|
| USB CDC On Boot | **Enabled** | so Serial prints over native USB ✅ |
| CPU Frequency | 240 MHz | |
| Flash Size | **16MB (128Mb)** | ✅ |
| **PSRAM** | **OPI PSRAM** | ⚠️ **required** — this board has octal PSRAM. "Enabled"/QSPI is wrong; camera framebuffers won't allocate |
| Partition Scheme | **16M Flash (3MB APP/9.9MB FATFS)** | ✅ fine. `Huge APP (3MB No OTA/1MB SPIFFS)` also works. Either gives ≥3 MB app space |
| Upload Mode | UART0 / Hardware CDC | |

### 3. `board_config.h` — use the REAL pins (all three transcript versions were wrong)

Open **File → Examples → ESP32 → Camera → CameraWebServer**. In `board_config.h`, comment out **every** `#define CAMERA_MODEL_…` line, then define the real pins:

```cpp
#ifndef BOARD_CONFIG_H
#define BOARD_CONFIG_H

// Waveshare ESP32-S3-CAM-OV3660 (SKU 33700) — verified pin map.
// PWDN is on the CH32V003 I/O expander (EXIO3), NOT an ESP32 GPIO — see setup() below.
#define PWDN_GPIO_NUM     -1     // handled over I²C, not a GPIO
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM     38
#define SIOD_GPIO_NUM      8     // SCCB SDA (shared control I²C bus)
#define SIOC_GPIO_NUM      7     // SCCB SCL (shared control I²C bus)

#define Y9_GPIO_NUM       21     // D7
#define Y8_GPIO_NUM       39     // D6
#define Y7_GPIO_NUM       40     // D5
#define Y6_GPIO_NUM       42     // D4
#define Y5_GPIO_NUM       46     // D3
#define Y4_GPIO_NUM       48     // D2
#define Y3_GPIO_NUM       47     // D1
#define Y2_GPIO_NUM       45     // D0
#define VSYNC_GPIO_NUM    17
#define HREF_GPIO_NUM     18
#define PCLK_GPIO_NUM     41

#endif  // BOARD_CONFIG_H
```

> Note: unlike the transcript's advice, **keep** the example's structure. You are only replacing the model list + pin block. Do not delete `camera_pins.h` handling elsewhere in the example unless it fails to compile — with all models commented out and the pins defined here, it builds.

### 4. Wake the camera over I²C — the step the transcript never had

At the **top** of `CameraWebServer.ino` add `#include <Wire.h>`, and in `setup()` **before** `esp_camera_init()` (before the `config` block is used), pull EXIO3 low on the CH32V003:

```cpp
#include <Wire.h>

// CH32V003 I/O expander on the shared control bus
#define IOEXP_ADDR      0x24
#define IOEXP_REG_DIR   0x02   // direction: bit=1 => output
#define IOEXP_REG_OUT   0x03   // output level: bit=1 => HIGH, bit=0 => LOW
#define EXIO_CAM_PWDN   3      // EXIO3 = camera PWDN (active-high)
#define EXIO_AMP_EN     4      // EXIO4 = amp enable (only for speaker)

static void ioexpWrite(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(IOEXP_ADDR);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

static void powerOnCamera() {
  Wire.begin(8, 7);                       // SDA=GPIO8, SCL=GPIO7 — same bus as SCCB
  // EXIO3 as output, driven LOW = camera powered ON.
  ioexpWrite(IOEXP_REG_DIR, (1 << EXIO_CAM_PWDN));   // only EXIO3 as output
  ioexpWrite(IOEXP_REG_OUT, 0x00);                   // EXIO3 LOW
  delay(20);                                         // let the sensor rail settle
}
```

Then call `powerOnCamera();` as the **first thing** in `setup()`, before `Serial.begin` clutter and well before `esp_camera_init(&config)`.

> The register map (`0x02` direction, `0x03` output, bit = pin, 1=output/HIGH) is taken from Waveshare's own CH32V003 driver — the same logic ESPHome's `waveshare_io_ch32v003` component uses. It is reconstructed here for Arduino and is logically correct, but note it has **not been flash-tested in Arduino** — only the ESPHome path above is proven on this board. If you hit trouble, the vendor firmware in `github.com/waveshareteam/ESP32-S3-CAM-OVxxxx` is the authoritative reference.

### 5. Wi-Fi, upload, serial
- Put your SSID/password in the `ssid` / `password` strings in `CameraWebServer.ino`.
- Upload. If it hangs on "Connecting…", hold **BOOT**, tap **RST**, release **BOOT**.
- Open **Serial Monitor at 115200**, press **RST**. You should now see `Camera Ready! Use 'http://192.168.x.x'` instead of `0x106`.

---

## Point-by-point: what was wrong in the AI Mode transcript

| Transcript claim | Verdict | Correct answer |
|---|---|---|
| Board URL `package_esp32_index.json` | ✅ correct | keep it |
| esp32 core 3.x, ESP32S3 Dev Module | ✅ correct | keep it |
| Partition `16M Flash (3MB APP/9.9MB FATFS)` | ✅ fine | or `Huge APP (3MB No OTA)` |
| PSRAM "Enabled" | ⚠️ under-specified | must be **OPI PSRAM** (octal) |
| `#define CAMERA_MODEL_ESP32S3_CAM_OV5640` | ❌ wrong | wrong sensor & board — don't use a model define; define pins manually |
| `CAMERA_MODEL_ESP_EYE` (default in your file) | ❌ wrong pins | caused nothing to match |
| 1st custom pinout (XCLK 40, SIOD 17 …) | ❌ wrong | see real map above |
| 2nd/3rd custom pinout (XCLK 15, SIOD 4 …) | ❌ wrong | those are a *different* S3 board |
| "delete `#include camera_pins.h` to bypass checks" | ❌ misguided | that doesn't fix `0x106`; the sensor is simply unpowered |
| Nothing about the CH32V003 / EXIO3 | ❌ **the actual bug** | camera PWDN is EXIO3 on the expander; drive it LOW over I²C first |

**Root cause in one line:** `0x106` here is a *power* problem, not a *pin* problem — the OV3660 is held off by the CH32V003 I/O expander until EXIO3 is driven LOW, and the stock Arduino sketch never touches it.

---

## References
- Working handoff for this exact board (camera + speaker): [[../sessions/2026-07-23-ai-cam-handoff]]
- Vendor repo (ground truth): `github.com/waveshareteam/ESP32-S3-CAM-OVxxxx` — examples `01_simple_video_server`, `03_audio_play`; `Schematic/ESP32-S3-CAM-XXXX-schematic.pdf`
- Vendor BSP component: `waveshare/esp32_s3_cam_ovxxxx` on components.espressif.com
- CH32V003 I/O expander in ESPHome: https://esphome.io/components/waveshare_io_ch32v003/ · component source: https://github.com/fuzzybear62/esphome-waveshare_io_ch32v003
- Waveshare product page: https://www.waveshare.com/esp32-s3-cam-ov5640.htm · docs: https://docs.waveshare.com/ESP32-S3-CAM-OVxxxx
