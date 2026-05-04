---
name: LD2410 radar sensor configuration for bedroom
description: Imported Claude.ai conversation from 2026-03-28 (8 messages)
type: reference
uuid: 14a6019d-bd94-4663-88ad-7d89c8dd2232
created_at: 2026-03-28T03:50:49.540924Z
updated_at: 2026-03-31T22:06:50.676212Z
---

# LD2410 radar sensor configuration for bedroom

## human — 2026-03-28 03:50:50

this code is correct 

```esphome
esphome:
  name: lounge-presence
  friendly_name: Lounge Presence

esp32:
  board: esp32-s3-devkitc-1
  framework:
    type: arduino

logger:
  baud_rate: 0

wifi:
  ssid: "JB's Smart 2.4G"
  password: "VeseyRD2026!"
  fast_connect: true
  output_power: "8.5dB"
  ap:
    ssid: "Lounge-Presence-Fallback"
    password: "fallback123"

api:
  encryption:
    key: !secret api_encryption_key

ota:
  - platform: esphome

uart:
  id: ld2410_uart
  tx_pin: GPIO18
  rx_pin: GPIO17
  baud_rate: 256000
  parity: NONE
  stop_bits: 1

ld2410:
  id: presence_sensor
  uart_id: ld2410_uart

binary_sensor:
  - platform: ld2410
    has_moving_target:
      name: "Lounge Moving Target"
    has_still_target:
      name: "Lounge Still Target"
    has_target:
      name: "Lounge Presence"

sensor:
  - platform: ld2410
    moving_distance:
      name: "Lounge Moving Distance"
      filters:
        - throttle: 1500ms
    still_distance:
      name: "Lounge Still Distance"
      filters:
        - throttle: 1500ms
    detection_distance:
      name: "Lounge Detection Distance"
      filters:
        - throttle: 1500ms

text_sensor:
  - platform: ld2410
    version:
      name: "Lounge LD2410 Firmware Version"
    mac_address:
      name: "Lounge LD2410 MAC Address"

button:
  - platform: ld2410
    factory_reset:
      name: "Lounge LD2410 Factory Reset"
    restart:
      name: "Lounge LD2410 Restart"
    query_params:
      name: "Lounge LD2410 Query Params"

select:
  - platform: ld2410
    distance_resolution:
      name: "Lounge LD2410 Distance Resolution"
    baud_rate:
      name: "Lounge LD2410 Baud Rate"
```

is this a correct one aswell for my bedroom 

```esphome
substitutions:
  dev_name: "bedroom"
  friendly_name: Upstairs
  ip_static: 192.168.0.171

esphome:
  name: ${dev_name}
  friendly_name: ${friendly_name}
  name_add_mac_suffix: false

esp32:
  board: esp32-s3-devkitc-1
  framework:
    type: esp-idf

logger:

api:
  encryption:
    key: !secret api_encryption_key

ota:
  - platform: esphome
    password: !secret ota_password
    

wifi:
  networks:
    - ssid: !secret wifi_ssid
      password: !secret wifi_password
      priority: 0
  fast_connect: true
  power_save_mode: none
  reboot_timeout: 0s

  manual_ip:
    static_ip: 192.168.0.171
    gateway: 192.168.0.1
    subnet: 255.255.255.0
    dns1: 192.168.0.1

  use_address: 192.168.0.171

  ap:
    ssid: "Upstairs Fallback Hotspot"
    password: "fallback123"

captive_portal:

# esp32_ble:
#   max_connections: 6

# bluetooth_proxy:
#   active: true
#   connection_slots: 6

# --- LD2410C Radar (UART) ---
uart:
  tx_pin: GPIO17
  rx_pin: GPIO16
  baud_rate: 115200
        
ld2410:
  id: upstairs_radar

binary_sensor:
  - platform: ld2410
    ld2410_id: upstairs_radar

    has_target:
      id: upstairs_presence
      name: "Upstairs Presence"
      filters:
        - delayed_off: 2s        # improved stability

    has_moving_target:
      name: "Upstairs Motion"
      filters:
        - delayed_off: 1.5s      # smoother motion handling

    has_still_target:
      name: "Upstairs Still Presence"
      filters:
        - delayed_off: 5s        # reduces flicker; reliable still detection

sensor:
  - platform: ld2410
    ld2410_id: upstairs_radar
    moving_distance:
      name: "Upstairs Radar Moving Distance"
      filters:
        - throttle: 200ms
    still_distance:
      name: "Upstairs Radar Still Distance"
      filters:
        - throttle: 200ms
    moving_energy:
      name: "Upstairs Radar Moving Energy"
      filters:
        - throttle: 200ms
    still_energy:
      name: "Upstairs Radar Still Energy"
      filters:
        - throttle: 200ms
```

## assistant — 2026-03-28 03:51:01

 Looking at your bedroom config, there are a few things to flag:

**Issues to fix:**

1. **UART baud rate mismatch** — You have `baud_rate: 115200` but the LD2410 default is `256000`. Your lounge config uses 256000 correctly. Unless you've manually changed the sensor's baud rate, this will prevent communication.

2. **UART pins** — GPIO17/GPIO16 are fine for an ESP32-S3, but double-check these are actually wired to your LD2410's TX/RX respectively (remember TX→RX and RX→TX cross-wiring).

3. **`reboot_timeout: 0s`** — This disables the automatic reboot if WiFi drops permanently. That can leave a device stuck offline forever with no recovery. I'd suggest `reboot_timeout: 15min` instead.

4. **`ld2410_id` on binary/sensor** — You've referenced `upstairs_radar` as the `ld2410_id` which is correct, but your lounge config doesn't use this parameter (it works because there's only one LD2410). Both approaches are valid, yours is actually more explicit and better practice.

**Things that look good:**
- The `delayed_off` filters on binary sensors are a nice improvement over the lounge config — much better for presence stability
- Static IP setup is solid
- `power_save_mode: none` is correct for a presence sensor
- `esp-idf` framework is generally more stable than `arduino` for S3 boards

**Quick fix summary:**
```yaml
uart:
  tx_pin: GPIO17
  rx_pin: GPIO16
  baud_rate: 256000  # ← change this
```

And consider changing `reboot_timeout: 0s` to `reboot_timeout: 15min`. Everything else looks correct.

## human — 2026-03-31 20:35:28

esphome:
  name: lounge-presence
  friendly_name: Lounge Presence

esp32:
  board: esp32-s3-devkitc-1
  framework:
    type: arduino

logger:
  baud_rate: 0

wifi:
  ssid: "JB's Smart 2.4G"
  password: "VeseyRD2026!"
  fast_connect: true
  output_power: "8.5dB"
  power_save_mode: none
  reboot_timeout: 0s
  ap:
    ssid: "Lounge-Presence-Fallback"
    password: "fallback123"

  manual_ip:
    static_ip: 192.168.0.184
    gateway: 192.168.0.1
    subnet: 255.255.255.0
    dns1: 192.168.0.1

  use_address: 192.168.0.184

captive_portal:

api:
  encryption:
    key: !secret api_encryption_key

ota:
  - platform: esphome

uart:
  id: ld2410_uart
  tx_pin: GPIO8
  rx_pin: GPIO7
  baud_rate: 256000
  parity: NONE
  stop_bits: 1

ld2410:
  id: presence_sensor
  uart_id: ld2410_uart
  
binary_sensor:
  - platform: ld2410
    has_moving_target:
      name: "Lounge Moving Target"
    has_still_target:
      name: "Lounge Still Target"
    has_target:
      name: "Lounge Presence"

sensor:
  - platform: ld2410
    moving_distance:
      name: "Lounge Moving Distance"
      filters:
        - throttle: 1500ms
    still_distance:
      name: "Lounge Still Distance"
      filters:
        - throttle: 1500ms
    detection_distance:
      name: "Lounge Detection Distance"
      filters:
        - throttle: 1500ms

text_sensor:
  - platform: ld2410
    version:
      name: "Lounge LD2410 Firmware Version"
    mac_address:
      name: "Lounge LD2410 MAC Address"

button:
  - platform: ld2410
    factory_reset:
      name: "Lounge LD2410 Factory Reset"
    restart:
      name: "Lounge LD2410 Restart"
    query_params:
      name: "Lounge LD2410 Query Params"

select:
  - platform: ld2410
    distance_resolution:
      name: "Lounge LD2410 Distance Resolution"
    baud_rate:
      name: "Lounge LD2410 Baud Rate"

number:
  - platform: ld2410
    timeout:
      name: "Lounge LD2410 Timeout"
    max_move_distance_gate:
      name: "Lounge Max Move Distance Gate"
    max_still_distance_gate:
      name: "Lounge Max Still Distance Gate"
    g0:
      move_threshold:
        name: "Lounge Gate 0 Move Threshold"
      still_threshold:
        name: "Lounge Gate 0 Still Threshold"
    g1:
      move_threshold:
        name: "Lounge Gate 1 Move Threshold"
      still_threshold:
        name: "Lounge Gate 1 Still Threshold"
    g2:
      move_threshold:
        name: "Lounge Gate 2 Move Threshold"
      still_threshold:
        name: "Lounge Gate 2 Still Threshold"
    g3:
      move_threshold:
        name: "Lounge Gate 3 Move Threshold"
      still_threshold:
        name: "Lounge Gate 3 Still Threshold"
    g4:
      move_threshold:
        name: "Lounge Gate 4 Move Threshold"
      still_threshold:
        name: "Lounge Gate 4 Still Threshold"
    g5:
      move_threshold:
        name: "Lounge Gate 5 Move Threshold"
      still_threshold:
        name: "Lounge Gate 5 Still Threshold"
    g6:
      move_threshold:
        name: "Lounge Gate 6 Move Threshold"
      still_threshold:
        name: "Lounge Gate 6 Still Threshold"
    g7:
      move_threshold:
        name: "Lounge Gate 7 Move Threshold"
      still_threshold:
        name: "Lounge Gate 7 Still Threshold"
    g8:
      move_threshold:
        name: "Lounge Gate 8 Move Threshold"
      still_threshold:
        name: "Lounge Gate 8 Still Threshold"


This yaml is running, but when I am sitting still the power still turns off within minutes. Also the tv keeps turning off.

## assistant — 2026-03-31 20:35:48

 This is a classic LD2410 still-presence tuning problem. The sensor isn't detecting you when you're sitting still (low movement), so Home Assistant thinks the room is empty.

**Root causes:**

1. **No `delayed_off` filters** — the presence binary sensor flickers off the moment the radar loses confidence, instantly triggering your automations
2. **Gate thresholds likely too high** — the still-energy sensitivity for gates 2-5 (typical sofa-sitting range, ~1-3m) probably needs lowering so weaker still signatures register
3. **Timeout too short** — the LD2410's onboard timeout (how long it holds presence after last detection) may be set very low

---

**Fix 1 — Add `delayed_off` to your binary sensors (do this first):**

```yaml
binary_sensor:
  - platform: ld2410
    ld2410_id: presence_sensor
    has_moving_target:
      name: "Lounge Moving Target"
    has_still_target:
      name: "Lounge Still Target"
      filters:
        - delayed_off: 10s       # holds still-presence for 10s after signal drops
    has_target:
      name: "Lounge Presence"
      filters:
        - delayed_off: 30s       # main presence — 30s grace before automations fire
```

Use `has_target` (not `has_still_target`) as the trigger for your TV/lights automations.

---

**Fix 2 — Increase the onboard timeout via HA:**

In Home Assistant, find the **"Lounge LD2410 Timeout"** number entity (exposed by your `number:` block) and set it to **5–10 seconds**. This is the radar's internal hold time after it last detects anything.

---

**Fix 3 — Lower still-detection thresholds:**

In HA, find the gate still threshold number entities and reduce gates 2–5 (covers roughly 0.75m–2.5m from sensor). Try dropping them from the default (~40) down to **15–25**. This makes the sensor more sensitive to subtle still presence like breathing or slight body movement.

---

**Fix 4 — Also fix `reboot_timeout: 0s` while you're in there:**

```yaml
wifi:
  reboot_timeout: 15min   # prevents permanent offline if WiFi drops
```

---

**Quick action priority:**
1. Flash with `delayed_off: 30s` on `has_target` → test immediately
2. Set timeout to 10s in HA UI
3. Lower gate 2-5 still thresholds to ~20 in HA UI
4. Fine-tune from there

The `delayed_off: 30s` alone will likely stop the TV turning off while you're sitting still.

## human — 2026-03-31 21:09:43
_files:_ 106731.jpg, 106733.jpg

_(empty)_

## assistant — 2026-03-31 21:09:57

 Two separate issues visible in your screenshots:

---

**Image 2 — Good news: ESPHome flash succeeded ✅**

The lounge-presence firmware compiled and flashed successfully. 50.2% flash, 12.7% RAM — plenty of headroom.

---

**Image 1 — SmartThings 401 Unauthorized error ⚠️**

Your automation is trying to turn on `media_player.jelly_bean_s_tv` via a SmartThings API call, but it's getting a `401 Unauthorized` from `api.smartthings.com`. This means:

- Your SmartThings Personal Access Token has **expired or been revoked**
- Or the SmartThings integration in Home Assistant needs **re-authenticating**

**Fix it:**

1. Go to **Home Assistant → Settings → Devices & Services → SmartThings**
2. Delete and re-add the integration, or re-enter your token
3. Generate a new token at **account.smartthings.com → Personal Access Tokens**
4. Make sure the token has `r:devices:*` and `x:devices:*` scopes (read + execute)

---

**Broader suggestion — ditch SmartThings for TV control:**

If your TV supports it, there are better local options:

| TV Brand | Better HA Integration |
|---|---|
| Samsung | `samsungtv_smart` custom integration |
| LG | `webostv` (built-in HA) |
| Sony | `braviatv` (built-in HA) |
| Any | `media_player` via wake-on-LAN + CEC |

What brand is your TV? I can point you to the right local integration and remove the SmartThings dependency entirely.

## human — 2026-03-31 22:06:45

Where do I add the token in ha

## assistant — 2026-03-31 22:06:50

 Go to **Settings → Devices & Services → SmartThings** and click **Configure** (or **Reconfigure**) on the existing integration entry — there'll be a field to paste your new token there.

If that doesn't appear:

1. **Delete** the SmartThings integration entirely
2. Click **+ Add Integration**, search SmartThings
3. It'll ask for your Personal Access Token — paste it there

To generate the token, go to **account.smartthings.com → My Account → Personal Access Tokens → Generate new token**, and tick all the device scopes.

What brand is the TV? If it's Samsung there's a much better local integration that bypasses SmartThings completely.
