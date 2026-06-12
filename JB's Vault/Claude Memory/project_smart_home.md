---
name: Smart Home project — Home Assistant Green + ESP32 nodes
description: State of Jelly Bean's smart-home build: lounge complete, bedroom-2 operational, upstairs node has BLE/UART contention to resolve
type: project
originSessionId: 1c29e19b-fa2c-4cb0-b81e-4fd96ed50ef6
---
**Setup:** Home Assistant OS on Home Assistant Green. Multi-room (lounge, bedroom, upstairs). Integrations: SmartThings, Govee, SamsungTV Smart (custom), ESPHome mmWave radar, repurposed Android phone as lounge sensor node.

**Why:** Building a deeply automated, presence-aware home — context-sensitive lighting, media, security.

**How to apply:** When the user mentions automations, ESPHome, HA, or specific entities below, defer to the canonical entities/configs listed here — old/broken ones are explicitly named so they can be avoided.

---

**Lounge — ~19 automations complete:** presence-based entry (day/evening/night), movie mode w/ Govee DreamView, TV-off light restoration, kids bedtime weekend dimming, room-empty shutdown, still-presence sitting, sound detection, silence timeout, volume/ambient brightness, low-light gentle on, high-volume night warning, intruder alert (sound + no presence), camera motion webhook.

Canonical entities:
- TV: `media_player.tv_jelly_beans_tv_2` — NOT `media_player.jelly_beans_tv` (broken)
- Lights: `light.right_smart_bulb`, `light.left_smart_bulb`, `light.living_room_light`, `light.rgbic_tv_backlight`, `light.stairs_smart_bulb`
- TV backlight DreamView: `switch.rgbic_tv_backlight_dreamview`
- Spotify source: `Spotify - Music and Podcasts` via `media_player.select_source` — NOT `spotcast.start` (broken)
- Android phone sensors: `binary_sensor.sound_sensor_labs_sound`, `sensor.sound_sensor_labs_volume`, `sensor.light_sensor_labs_brightness_intensity`
- Camera MJPEG: `http://192.168.0.215:8080`; motion webhook (Tasker): `http://192.168.0.50:8123/api/webhook/lounge_motion`
- Movie Mode: `brightness_pct: 100`, `rgb_color: [255, 255, 255]`, `color_temp_kelvin: 6500`
- Lounge ESPHome reference baseline node: IP 192.168.0.184

**Bedroom node** — `bedroom-2.yaml`, IP 192.168.0.171. Operational. LD2410C radar live (GPIO8/GPIO7 UART, fw 2.44.25070917). Flicker fix: timeout 60s, still-gates 2–5 ≈ 20. Automations: light on via presence 07:30–23:59; unconditional off at 23:59 and 07:30. **`bedroom.yaml` is broken — ignore; `bedroom-2.yaml` is canonical.** HA path: `/config/esphome/bedroom-2.yaml`.

**Upstairs node** — same IP 192.168.0.171 in notes (likely conflict — needs clarifying). YAML correct (GPIO8/GPIO7, `rx_buffer_size: 512`, `esp-idf` framework) but BLE proxy + radar on same ESP32 = `Max command length exceeded` spam. Fix path: reduce BLE duty cycle via `esp32_ble_tracker` scan params, or split BLE proxy onto a dedicated node.

**To order:** 18650 cells, mic-equipped ESP32-S3, ESP32-S3-CAM, 5V servo power rail.
**On hand:** HA Green, ESP32-S3-Zero boards, LD2410C modules, MPU6050 IMUs, ~40× SG90 servos, TP4056 chargers, old Android phone.

**Learnings to honour:**
- `media_player.jelly_beans_tv` and `spotcast.start` are broken — never use
- `binary_sensor` mjpeg platform is invalid in modern HA
- OTA flashing unreliable when devices drop during ~19-min compile — fall back to USB flashing via web.esphome.io (Chrome)
- BLE proxy + mmWave radar on same ESP32 = resource contention; separate them
- Frigate is unsuitable for HA Green hardware constraints
