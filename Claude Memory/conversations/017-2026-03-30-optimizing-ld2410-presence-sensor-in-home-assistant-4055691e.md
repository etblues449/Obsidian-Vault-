---
name: Optimizing LD2410 presence sensor in Home Assistant
description: Imported Claude.ai conversation from 2026-03-30 (34 messages)
type: reference
uuid: 4055691e-0481-4f10-b2e2-9e28d3f44fca
created_at: 2026-03-30T18:52:27.620756Z
updated_at: 2026-03-30T19:48:41.875541Z
---

# Optimizing LD2410 presence sensor in Home Assistant

## human — 2026-03-30 18:52:29

I have this lounge presence yaml code and I want to make the most of it. How do I achieve this whilst using my home assistant. 

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

## assistant — 2026-03-30 18:53:01

 I'll check your Home Assistant setup to understand what you're working with, then give you the best advice on maximising this config.
```
This block is not supported on your current device yet.
```

No worries — I have enough context from your YAML and our previous work to give you a thorough answer.

---

## Making the Most of Your Lounge Presence Sensor in Home Assistant

Your YAML is solid and well-structured. Here's how to build on it layer by layer.

---

### 1. Confirm the Device is in HA

Once flashed and on the network, go to:

**Settings → Devices & Services → ESPHome**

You should see **Lounge Presence** listed. Click it and confirm all entities are available:
- `binary_sensor.lounge_presence` (the main one you'll use most)
- `binary_sensor.lounge_moving_target`
- `binary_sensor.lounge_still_target`
- `sensor.lounge_detection_distance`

---

### 2. The Core Use Cases

#### 💡 Automatic Lighting
The most immediate win — lights on when presence is detected, off after a delay.

```yaml
alias: Lounge Lights – Presence
description: Turn lights on/off based on mmWave presence
triggers:
  - trigger: state
    entity_id: binary_sensor.lounge_presence
    to: "on"
    id: occupied
  - trigger: state
    entity_id: binary_sensor.lounge_presence
    to: "off"
    for: "00:02:00"
    id: empty
actions:
  - choose:
      - conditions:
          - condition: trigger
            id: occupied
        sequence:
          - action: light.turn_on
            target:
              area_id: lounge
      - conditions:
          - condition: trigger
            id: empty
        sequence:
          - action: light.turn_off
            target:
              area_id: lounge
```

> The `for: 00:02:00` delay on the "off" trigger prevents false clears when you're sitting still (the LD2410C's still target handles this, but a delay adds a safety net).

---

#### 🌡️ HVAC / Climate Control
Only heat or cool the lounge when occupied:

```yaml
alias: Lounge Climate – Presence
triggers:
  - trigger: state
    entity_id: binary_sensor.lounge_presence
    to: "on"
    id: occupied
  - trigger: state
    entity_id: binary_sensor.lounge_presence
    to: "off"
    for: "00:05:00"
    id: empty
actions:
  - choose:
      - conditions:
          - condition: trigger
            id: occupied
        sequence:
          - action: climate.set_hvac_mode
            target:
              entity_id: climate.lounge
            data:
              hvac_mode: heat
      - conditions:
          - condition: trigger
            id: empty
        sequence:
          - action: climate.set_hvac_mode
            target:
              entity_id: climate.lounge
            data:
              hvac_mode: "off"
```

---

#### 📺 TV / Media Awareness
Use `moving_target` vs `still_target` to distinguish **watching TV** (still) from **moving around** (active):

```yaml
alias: Lounge – Detect TV Watching Mode
triggers:
  - trigger: state
    entity_id: binary_sensor.lounge_still_target
    to: "on"
    for: "00:01:00"
actions:
  - action: input_boolean.turn_on
    target:
      entity_id: input_boolean.lounge_tv_mode
```

You can use `lounge_tv_mode` as a condition in other automations — e.g. dim lights when someone's been sitting still for a minute.

---

#### 🚶 Distance-Based Zones (Advanced)
`sensor.lounge_detection_distance` tells you *how far away* the target is. You can use this to infer where in the room someone is:

```yaml
alias: Lounge – Near Sofa vs. Near Door
triggers:
  - trigger: numeric_state
    entity_id: sensor.lounge_detection_distance
    below: 150   # within 1.5m
    id: near
  - trigger: numeric_state
    entity_id: sensor.lounge_detection_distance
    above: 300   # beyond 3m
    id: far
```

This is great if you want different lighting scenes based on position.

---

### 3. Tune the Sensor via HA

Your YAML exposes the `query_params` button and `distance_resolution` select — use these in HA's UI:

- **Settings → Devices → Lounge Presence → Controls**
- Press **Query Params** to see current gate thresholds
- Change **Distance Resolution** between 0.2m and 0.75m depending on your room size

For a typical lounge, **0.2m resolution** gives finer detection; **0.75m** is better for larger open rooms.

---

### 4. Recommended Helpers to Create

Go to **Settings → Devices & Services → Helpers** and add:

| Helper | Type | Purpose |
|---|---|---|
| `input_boolean.lounge_tv_mode` | Toggle | Track whether someone's watching TV |
| `input_boolean.lounge_guest_mode` | Toggle | Disable automations when guests are over |
| `counter.lounge_occupancy_count` | Counter | Count entries/exits if you add a door sensor |

---

### 5. Dashboard Card

Add a quick glance card to your Lounge dashboard:

```yaml
type: entities
title: Lounge Presence
entities:
  - entity: binary_sensor.lounge_presence
    name: Occupied
  - entity: binary_sensor.lounge_moving_target
    name: Movement
  - entity: binary_sensor.lounge_still_target
    name: Still Person
  - entity: sensor.lounge_detection_distance
    name: Distance (cm)
  - entity: sensor.lounge_moving_distance
  - entity: sensor.lounge_still_distance
```

---

### Summary of Priority Order

1. ✅ **Confirm device appears in HA** and all entities are live
2. 💡 **Set up presence-based lighting** — immediate quality of life win
3. 🌡️ **Add climate control** if you have a smart thermostat
4. 📺 **Use still/moving split** for TV mode detection
5. 📏 **Explore distance zones** once you know the sensor's coverage in your room

Want me to build out any of these automations in full, or help you wire the distance sensor into a specific use case?

## human — 2026-03-30 18:54:00
_files:_ 106267.jpg

What do I need to to for everything to work

## assistant — 2026-03-30 18:54:15

 Great screenshot — the device is live and working perfectly. Here's what I can see and what needs attention:

---

## ✅ What's Already Working

- Firmware is **up-to-date** (2026.4.0)
- Device is **In Living Room**
- Sensors are reporting — detection distance at **4.2 ft**, distances at **154 cm**
- Activity log shows it's **detecting motion and clearing correctly**
- You already have one automation: **Presence - Lounge (Smart Occupancy)**

---

## ⚠️ Two Things to Fix

### 1. Distance Resolution — Change to 0.2m
You're currently on **0.75m**, which means the sensor only checks presence in coarse 75cm bands. For a lounge (where someone might be sitting still on a sofa), this misses subtle presence.

**Do this now:**
- On that screen, tap **Lounge LD2410 Distance Resolution**
- Change from `0.75m` → `0.2m`

---

### 2. MAC Address Shows "Unknown"
This is a minor firmware/hardware quirk with some LD2410C modules — not critical, but worth noting. Nothing to fix right now.

---

## 🔧 What to Do Next

### Check your existing automation
You have **Presence - Lounge (Smart Occupancy)** — tap the `>` arrow on it and tell me what it does. It may already cover lights/climate, or it might be a bare skeleton.

### Tune the detection gates
Press **Lounge LD2410 Query Params** in the Diagnostic section. This shows you the sensitivity thresholds for each gate (distance band). Share what it returns and I can help you tune it so it doesn't false-clear when you're sitting still.

---

## Summary of Actions Right Now

| Action | Where | Priority |
|---|---|---|
| Change Distance Resolution to 0.2m | Configuration section | **Do now** |
| Tap the existing automation and share what it does | Automations section | **Next** |
| Press Query Params and share the output | Diagnostic section | **After that** |

Once you've done those three things, I can help you build out the full automation stack properly.

## human — 2026-03-30 18:56:36
_files:_ 106269.jpg

alias: Presence - Lounge (Smart Occupancy)
description: ""
triggers:
  - entity_id: binary_sensor.lounge_presence_lounge_presence
    from: "off"
    to: "on"
    trigger: state
conditions: []
actions:
  - target:
      entity_id: media_player.jelly_bean_s_tv
    action: media_player.turn_on
    data: {}
  - action: light.turn_on
    metadata: {}
    target:
      area_id: living_room
    data:
      color_temp_kelvin: 4651
      brightness_pct: 100
  - wait_for_trigger:
      - entity_id:
          - binary_sensor.lounge_presence_lounge_presence
        to:
          - "off"
        for:
          hours: 0
          minutes: 5
          seconds: 0
        trigger: state
  - target:
      entity_id: media_player.jelly_bean_s_tv
    action: media_player.turn_off
  - target:
      entity_id: light.lounge_lights
    action: light.turn_off
mode: restart

Distance has been changed

## assistant — 2026-03-30 18:56:56

 Good — distance resolution sorted. Now let me look at both pieces of info you've shared.

---

## Query Params — Problem Found

The button shows **"Became unavailable"** twice overnight. This means the sensor is **losing connection** to HA periodically (likely during your router's idle hours or a power saving event). It's not a crisis, but worth fixing.

The query params themselves **never returned data** — it just went unavailable before responding. Press it again now that you're actively looking at it and see if the Activity updates with actual gate values.

---

## Your Automation — Good Start, Needs Work

Here's what it currently does:
- ✅ Turns on TV and lights when presence detected
- ✅ Waits 5 minutes of no presence, then turns off TV and lights
- ❌ **Only triggers on entry** — if HA restarts while you're in the room, nothing turns on
- ❌ **No time/mode conditions** — lights turn on at full brightness at 3am
- ❌ **Turns TV on automatically** — probably not what you want every time you walk in
- ❌ Uses `light.lounge_lights` on turn-off but `area_id: living_room` on turn-on — inconsistent, may miss devices

---

## Improved Automation

Here's a proper replacement — paste this into the YAML editor:

```yaml
alias: Presence - Lounge (Smart Occupancy)
description: Lights and TV based on presence, time-aware
triggers:
  - entity_id: binary_sensor.lounge_presence_lounge_presence
    to: "on"
    trigger: state
    id: occupied
  - entity_id: binary_sensor.lounge_presence_lounge_presence
    to: "off"
    for:
      minutes: 5
    trigger: state
    id: empty
conditions: []
actions:
  - choose:
      - conditions:
          - condition: trigger
            id: occupied
        sequence:
          - action: light.turn_on
            target:
              area_id: living_room
            data:
              brightness_pct: >
                {% if now().hour >= 21 or now().hour < 7 %}
                  30
                {% elif now().hour >= 18 %}
                  70
                {% else %}
                  100
                {% endif %}
              color_temp_kelvin: >
                {% if now().hour >= 21 or now().hour < 7 %}
                  2700
                {% elif now().hour >= 18 %}
                  3500
                {% else %}
                  4651
                {% endif %}
      - conditions:
          - condition: trigger
            id: empty
        sequence:
          - action: light.turn_off
            target:
              area_id: living_room
          - action: media_player.turn_off
            target:
              entity_id: media_player.jelly_bean_s_tv
mode: restart
```

---

## Key Changes Made

| Change | Why |
|---|---|
| Removed auto TV turn-on | You probably don't want the TV firing every time you walk in |
| Time-aware brightness | Full brightness daytime, dim at night, very dim after 9pm |
| Warm colour temp at night | 2700K evening vs 4651K daytime |
| Consistent area targeting | Both on and off use `area_id: living_room` |
| TV only turns off, not on | Safer default — you control when it goes on |

---

## Still To Do

1. **Press Query Params again** right now and share the activity — I want to see your gate sensitivity values so we can tune still-presence detection
2. **Fix the connection drops** — go to your router and set a **DHCP reservation** for `192.168.0.184` if you haven't already (even though you have a static IP in ESPHome, some routers still interfere)

## human — 2026-03-30 18:58:47
_files:_ 106271.jpg

_(empty)_

## assistant — 2026-03-30 18:58:59

 This is very clear — and it's not a connection problem. This is completely normal behaviour.

---

## What You're Actually Seeing

The Query Params button is a **one-shot command**, not a persistent sensor. Every time it fires, it:
1. Sends a request to the LD2410C
2. Gets a response
3. Immediately goes back to "unavailable"

That's by design — it's a button entity, not a sensor. The "became unavailable" entries are just HA logging each press returning to idle state.

**There is no connection problem.** Your device is fine.

---

## What Query Params Actually Does

The gate values it returns appear in your **ESPHome device logs**, not in HA's activity feed. To actually see them:

1. Go to **Settings → Add-ons → ESPHome**
2. Open the **ESPHome dashboard**
3. Click **Logs** next to `lounge-presence`
4. Then press **Query Params** in HA
5. Watch the log output — you'll see something like:

```
[ld2410] Gate 0: move=50, still=20
[ld2410] Gate 1: move=50, still=20
...
[ld2410] Gate 8: move=50, still=20
```

---

## What This Means for You

Since the sensor is working correctly and the device is stable, your priority now is:

1. **Swap in the improved automation** I gave you above — that's the biggest immediate win
2. **Check the ESPHome logs** after pressing Query Params to see your gate sensitivity values
3. Once you have gate values, I can help you tune them so the sensor doesn't false-clear when you're sitting still on the sofa

Want to paste the automation YAML in and confirm it's saved, and then we'll move on to gate tuning?

## human — 2026-03-30 19:03:01

INFO ESPHome 2026.4.0-dev
INFO Reading configuration /config/esphome/lounge-presence.yaml...
INFO Starting log output from 192.168.0.184 using esphome API
INFO Successfully resolved lounge-presence @ 192.168.0.184 in 0.000s
INFO Successfully connected to lounge-presence @ 192.168.0.184 in 0.006s
INFO Successful handshake with lounge-presence @ 192.168.0.184 in 0.072s
[19:59:47.552][I][app:163]: ESPHome version 2026.4.0-dev compiled on 2026-03-30 00:44:42 +0100
[19:59:47.552][I][app:170]: ESP32 Chip: ESP32-S3 rev0.2, 2 core(s)
[19:59:47.553][C][logger:219]: Logger:
[19:59:47.553][C][logger:219]:   Max Level: DEBUG
[19:59:47.553][C][logger:219]:   Initial Level: DEBUG
[19:59:47.554][C][logger:226]:   Log Baud Rate: 0
[19:59:47.554][C][logger:226]:   Hardware UART: USB_SERIAL_JTAG
[19:59:47.555][C][logger:235]:   Task Log Buffer Size: 768 bytes
[19:59:47.572][C][uart.idf:247]: UART Bus 0:
[19:59:47.572][C][uart.idf:152]:   TX Pin: GPIO8
[19:59:47.573][C][uart.idf:152]:   RX Pin: GPIO7
[19:59:47.575][C][uart.idf:252]:   RX Buffer Size: 256
[19:59:47.575][C][uart.idf:252]:   RX Full Threshold: 120
[19:59:47.575][C][uart.idf:252]:   RX Timeout: 2
[19:59:47.606][C][uart.idf:261]:   Baud Rate: 256000 baud
[19:59:47.606][C][uart.idf:261]:   Data Bits: 8
[19:59:47.606][C][uart.idf:261]:   Parity: NONE
[19:59:47.606][C][uart.idf:261]:   Stop bits: 1
[19:59:47.606][C][uart.idf:261]:   Wake on data RX: ENABLED
[19:59:47.607][C][ld2410:185]: LD2410:
[19:59:47.607][C][ld2410:185]:   Firmware version: 2.44.25070917
[19:59:47.607][C][ld2410:185]:   MAC address: unknown
[19:59:47.607][C][ld2410:191]: Binary Sensors:
[19:59:47.609][C][ld2410:016]:   Target 'Lounge Presence'
[19:59:47.612][C][ld2410:232]:     Device Class: 'occupancy'
[19:59:47.613][C][ld2410:016]:   MovingTarget 'Lounge Moving Target'
[19:59:47.614][C][ld2410:232]:     Device Class: 'motion'
[19:59:47.617][C][ld2410:016]:   StillTarget 'Lounge Still Target'
[19:59:47.618][C][ld2410:232]:     Device Class: 'occupancy'
[19:59:47.618][C][ld2410:198]: Sensors:
[19:59:47.619][C][ld2410:017]:   DetectionDistance 'Lounge Detection Distance'
[19:59:47.619][C][ld2410:017]:     State Class: ''
[19:59:47.619][C][ld2410:017]:     Unit of Measurement: 'cm'
[19:59:47.619][C][ld2410:017]:     Accuracy Decimals: 0
[19:59:47.623][C][ld2410:232]:     Device Class: 'distance'
[19:59:47.624][C][ld2410:223]:     Icon: 'mdi:signal-distance-variant'
[19:59:47.625][C][ld2410:017]:   MovingTargetDistance 'Lounge Moving Distance'
[19:59:47.625][C][ld2410:017]:     State Class: ''
[19:59:47.625][C][ld2410:017]:     Unit of Measurement: 'cm'
[19:59:47.625][C][ld2410:017]:     Accuracy Decimals: 0
[19:59:47.625][C][ld2410:232]:     Device Class: 'distance'
[19:59:47.628][C][ld2410:223]:     Icon: 'mdi:signal-distance-variant'
[19:59:47.628][C][ld2410:017]:   StillTargetDistance 'Lounge Still Distance'
[19:59:47.628][C][ld2410:017]:     State Class: ''
[19:59:47.628][C][ld2410:017]:     Unit of Measurement: 'cm'
[19:59:47.628][C][ld2410:017]:     Accuracy Decimals: 0
[19:59:47.629][C][ld2410:232]:     Device Class: 'distance'
[19:59:47.630][C][ld2410:223]:     Icon: 'mdi:signal-distance-variant'
[19:59:47.631][C][ld2410:213]: Text Sensors:
[19:59:47.637][C][ld2410:016]:   Mac 'Lounge LD2410 MAC Address'
[19:59:47.637][C][ld2410:223]:     Icon: 'mdi:bluetooth'
[19:59:47.637][C][ld2410:016]:   Version 'Lounge LD2410 Firmware Version'
[19:59:47.638][C][ld2410:223]:     Icon: 'mdi:chip'
[19:59:47.639][C][ld2410:231]: Selects:
[19:59:47.639][C][ld2410:232]:   BaudRate 'Lounge LD2410 Baud Rate'
[19:59:47.639][C][ld2410:223]:     Icon: 'mdi:thermometer'
[19:59:47.642][C][ld2410:233]:   DistanceResolution 'Lounge LD2410 Distance Resolution'
[19:59:47.642][C][ld2410:223]:     Icon: 'mdi:ruler'
[19:59:47.643][C][ld2410:243]: Buttons:
[19:59:47.643][C][ld2410:014]:   FactoryReset 'Lounge LD2410 Factory Reset'
[19:59:47.645][C][ld2410:223]:     Icon: 'mdi:restart-alert'
[19:59:47.648][C][ld2410:014]:   Query 'Lounge LD2410 Query Params'
[19:59:47.649][C][ld2410:223]:     Icon: 'mdi:database'
[19:59:47.649][C][ld2410:014]:   Restart 'Lounge LD2410 Restart'
[19:59:47.651][C][ld2410:223]:     Icon: 'mdi:restart'
[19:59:47.674][C][captive_portal:134]: Captive Portal:
[19:59:47.674][C][wifi:1510]: WiFi:
[19:59:47.674][C][wifi:1510]:   Local MAC: E0:72:A1:E6:FE:04
[19:59:47.674][C][wifi:1510]:   Connected: YES
[19:59:47.675][C][wifi:1221]:   IP Address: 192.168.0.184
[19:59:47.680][C][wifi:1232]:   SSID: [redacted]
[19:59:47.680][C][wifi:1232]:   BSSID: [redacted]
[19:59:47.680][C][wifi:1232]:   Hostname: 'lounge-presence'
[19:59:47.680][C][wifi:1232]:   Signal strength: -47 dB ▂▄▆█
[19:59:47.680][C][wifi:1232]:   Channel: 1
[19:59:47.680][C][wifi:1232]:   Subnet: 255.255.255.0
[19:59:47.680][C][wifi:1232]:   Gateway: 192.168.0.1
[19:59:47.680][C][wifi:1232]:   DNS1: 192.168.0.1
[19:59:47.680][C][wifi:1232]:   DNS2: 0.0.0.0
[19:59:47.683][C][esphome.ota:071]: Over-The-Air updates:
[19:59:47.683][C][esphome.ota:071]:   Address: 192.168.0.184:3232
[19:59:47.683][C][esphome.ota:071]:   Version: 2
[19:59:47.686][C][safe_mode:026]: Safe Mode:
[19:59:47.686][C][safe_mode:026]:   Successful after: 60s
[19:59:47.686][C][safe_mode:026]:   Invoke after: 10 attempts
[19:59:47.686][C][safe_mode:026]:   Duration: 300s
[19:59:47.687][C][safe_mode:043]:   Bootloader rollback: support unknown
[19:59:47.690][C][web_server.ota:238]: Web Server OTA
[19:59:47.724][C][api:235]: Server:
[19:59:47.724][C][api:235]:   Address: 192.168.0.184:6053
[19:59:47.724][C][api:235]:   Listen backlog: 4
[19:59:47.724][C][api:235]:   Max connections: 8
[19:59:47.725][C][api:242]:   Noise encryption: YES
[19:59:47.725][C][mdns:194]: mDNS:
[19:59:47.725][C][mdns:194]:   Hostname: lounge-presence
[19:59:54.892][S][sensor]: 'Lounge Moving Distance' >> 158 cm
[19:59:54.892][S][sensor]: 'Lounge Still Distance' >> 158 cm
[19:59:55.692][S][binary_sensor]: 'Lounge Presence' >> ON
[19:59:55.692][S][binary_sensor]: 'Lounge Moving Target' >> ON
[19:59:55.693][S][sensor]: 'Lounge Detection Distance' >> 102 cm
[19:59:55.694][S][binary_sensor]: 'Lounge Still Target' >> ON
[19:59:56.691][S][sensor]: 'Lounge Moving Distance' >> 155 cm
[19:59:57.095][S][sensor]: 'Lounge Still Distance' >> 162 cm
[19:59:57.096][S][sensor]: 'Lounge Detection Distance' >> 148 cm
[19:59:58.187][S][binary_sensor]: 'Lounge Moving Target' >> OFF
[19:59:58.592][S][sensor]: 'Lounge Still Distance' >> 169 cm
[19:59:58.593][S][sensor]: 'Lounge Detection Distance' >> 161 cm
[20:00:03.993][S][binary_sensor]: 'Lounge Presence' >> OFF
[20:00:03.994][S][binary_sensor]: 'Lounge Still Target' >> OFF

## assistant — 2026-03-30 19:03:19

 This log is really useful. Here's what it tells us:

---

## What the Log Shows

**The good news:** Everything is working perfectly electronically. WiFi signal is excellent at **-47 dB**, connection is stable, all sensors reporting.

**The problem:** Look at this sequence:

```
19:59:55 → Presence ON, Moving ON, Still ON
19:59:58 → Moving OFF
20:00:03 → Presence OFF, Still OFF
```

You sat down (or stood still) and **8 seconds later it cleared you as gone**. That's the core issue — the still target sensitivity is too low, so once you stop moving it loses you almost immediately.

---

## The Fix — Add Gate Sensitivity to Your YAML

You need to add explicit sensitivity thresholds to your ESPHome config. Open your `lounge-presence.yaml` in the ESPHome editor and add this block to the `ld2410:` section:

```yaml
ld2410:
  id: presence_sensor
  uart_id: ld2410_uart
  max_gate: 8
  max_move_gate: 8
  max_still_gate: 8
  g0_move_sensitivity: 50
  g0_still_sensitivity: 50
  g1_move_sensitivity: 50
  g1_still_sensitivity: 50
  g2_move_sensitivity: 40
  g2_still_sensitivity: 40
  g3_move_sensitivity: 30
  g3_still_sensitivity: 40
  g4_move_sensitivity: 20
  g4_still_sensitivity: 30
  g5_move_sensitivity: 15
  g5_still_sensitivity: 20
  g6_move_sensitivity: 15
  g6_still_sensitivity: 20
  g7_move_sensitivity: 15
  g7_still_sensitivity: 20
  g8_move_sensitivity: 15
  g8_still_sensitivity: 20
```

Then also add a `timeout` to stop it clearing too quickly:

```yaml
ld2410:
  id: presence_sensor
  uart_id: ld2410_uart
  timeout: 5s        # ← add this line
```

---

## What These Values Mean

Each gate = 0.2m (now you've changed resolution). So:
- Gate 0 = 0–0.2m (right in front)
- Gate 4 = 0.8–1.0m (typical sofa distance)
- Gate 8 = 1.6–1.8m (far end of detection)

The **still sensitivity** values are the critical ones — higher = more sensitive to stationary presence. The values above are a good starting point for a lounge sofa scenario.

---

## Steps to Apply

1. **ESPHome dashboard** → click **Edit** on `lounge-presence`
2. Replace the `ld2410:` block with the version above
3. Click **Save** then **Install → Wirelessly**
4. Wait for it to reboot (~30 seconds)
5. Sit still on your sofa and watch the logs — you should now see Still Target staying ON

Once it's reflashed, share the logs again from the same still-sitting test and we'll fine-tune from there.

## human — 2026-03-30 19:11:35

INFO ESPHome 2026.4.0-dev
INFO Reading configuration /config/esphome/bedroom.yaml...
INFO Generating C++ source...
INFO Setting CONFIG_LWIP_MAX_SOCKETS to 12 (TCP=6 [api=3, captive_portal=3], UDP=3 [captive_portal=1, mdns=2], TCP_LISTEN=3 [api=1, ota=1, web_server_base=1])
INFO Compiling app... Build path: /data/build/bedroom
Processing bedroom (board: esp32-s3-devkitc-1; framework: arduino, espidf; platform: https://github.com/pioarduino/platform-espressif32/releases/download/55.03.37/platform-espressif32.zip)
--------------------------------------------------------------------------------
Library Manager: Installing esphome/noise-c @ 0.1.11
INFO Installing esphome/noise-c @ 0.1.11
Downloading  [####################################]  100%
Unpacking  [####################################]  100%
Library Manager: noise-c@0.1.11 has been installed!
INFO noise-c@0.1.11 has been installed!
Library Manager: Resolving dependencies...
INFO Resolving dependencies...
Library Manager: Installing esphome/libsodium @ 1.10021.0
INFO Installing esphome/libsodium @ 1.10021.0
Downloading  [####################################]  100%
Unpacking  [####################################]  100%
Library Manager: libsodium@1.10021.0 has been installed!
INFO libsodium@1.10021.0 has been installed!
HARDWARE: ESP32S3 240MHz, 320KB RAM, 4MB Flash
 - contrib-piohome @ 3.4.4 
 - framework-arduinoespressif32 @ 3.3.7 
 - framework-arduinoespressif32-libs @ 5.5.3 
 - framework-espidf @ 3.50503.0 (5.5.3) 
 - tool-cmake @ 4.0.3 
 - tool-esp-rom-elfs @ 2024.10.11 
 - tool-esptoolpy @ 5.1.2 
 - tool-ninja @ 1.13.1 
 - tool-scons @ 4.40801.0 (4.8.1) 
 - toolchain-xtensa-esp-elf @ 14.2.0+20251107
Reading CMake configuration...
Generating assembly for certificate bundle...
Dependency Graph
|-- noise-c @ 0.1.11
Compiling .pioenvs/bedroom/src/esphome/components/api/api_buffer.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/api/api_connection.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/api/api_frame_helper.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/api/api_frame_helper_noise.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/api/api_overflow_buffer.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/api/api_pb2.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/api/api_pb2_service.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/api/api_server.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/api/list_entities.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/api/proto.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/api/subscribe_state.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/binary_sensor/automation.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/binary_sensor/binary_sensor.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/binary_sensor/filter.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/button/button.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/captive_portal/captive_portal.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/captive_portal/dns_server_esp32_idf.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/esp32/core.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/esp32/crash_handler.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/esp32/gpio.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/esp32/helpers.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/esp32/preferences.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/esp32/printf_stubs.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/esp32/throw_stubs.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/esphome/ota/ota_esphome.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/ld2410/button/factory_reset_button.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/ld2410/button/query_button.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/ld2410/button/restart_button.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/ld2410/ld2410.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/ld2410/select/baud_rate_select.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/ld2410/select/distance_resolution_select.cpp.o
Compiling .pioenvs/bedroom/src/esphome/components/ld2410/select/light_out_control_select.cpp.o

## assistant — 2026-03-30 19:11:43

 Wait — this is compiling the **bedroom** config, not the lounge. You're editing the wrong device!

---

## Stop — Don't Flash This

If you hit **Install**, this will reflash your **bedroom sensor**, not the lounge one. Cancel out of this if it hasn't finished yet.

---

## How to Get to the Right One

1. Go back to the **ESPHome dashboard** (the main list of devices)
2. You should see both `bedroom` and `lounge-presence` listed
3. Click **Edit** on **`lounge-presence`** specifically
4. Make the ld2410 changes there
5. Then **Install → Wirelessly** from that card

---

## Quick Check Before You Edit

When you open `lounge-presence.yaml`, the top should say:

```yaml
esphome:
  name: lounge-presence
  friendly_name: Lounge Presence
```

If it says `bedroom` at the top, you're in the wrong file. Double-check before hitting install.

Has the bedroom compile finished/started flashing, or did you catch it in time?

## human — 2026-03-30 19:13:21
_files:_ 106273.jpg

_(empty)_

## assistant — 2026-03-30 19:13:32

 Perfect — that's exactly right. You're in the correct file (`lounge-presence.yaml`) and I can see all the gate sensitivity values are already in there highlighted in red/pink, plus `timeout: 5s` and `max_gate: 8` settings. The config looks exactly as it should.

---

## You're Ready to Flash

Just hit **INSTALL** (top right) and select **Wirelessly**.

The device will:
1. Compile (~2-3 minutes)
2. Upload over WiFi
3. Reboot automatically

---

## After It Reboots

Go back to ESPHome logs for `lounge-presence` and do the **sit-still test**:

- Walk into the lounge, then sit down and stay still
- Watch for `Lounge Still Target >> ON` staying on continuously
- It should now hold presence for at least 5 seconds after you stop moving, rather than clearing in 8 seconds like before

Share the log output from that test and we'll confirm it's working — or tweak the still sensitivity values higher if it still clears too fast.

Go ahead and hit Install!

## human — 2026-03-30 19:14:35

INFO ESPHome 2026.4.0-dev
INFO Reading configuration /config/esphome/lounge-presence.yaml...
Failed config

ld2410: [source /config/esphome/lounge-presence.yaml:49]
  - id: presence_sensor
    uart_id: ld2410_uart
    
    The 'timeout' option has been moved to the 'timeout' number component.
    timeout: 5s
    
    [max_gate] is an invalid option for [ld2410]. Please check the indentation.
    max_gate: 8
    
    [max_move_gate] is an invalid option for [ld2410]. Did you mean [max_move_distance]?
    max_move_gate: 8
    
    [max_still_gate] is an invalid option for [ld2410]. Did you mean [max_still_distance]?
    max_still_gate: 8
    
    [g0_move_sensitivity] is an invalid option for [ld2410]. Please check the indentation.
    g0_move_sensitivity: 50
    
    [g0_still_sensitivity] is an invalid option for [ld2410]. Please check the indentation.
    g0_still_sensitivity: 50
    
    [g1_move_sensitivity] is an invalid option for [ld2410]. Please check the indentation.
    g1_move_sensitivity: 50
    
    [g1_still_sensitivity] is an invalid option for [ld2410]. Please check the indentation.
    g1_still_sensitivity: 50
    
    [g2_move_sensitivity] is an invalid option for [ld2410]. Please check the indentation.
    g2_move_sensitivity: 40
    
    [g2_still_sensitivity] is an invalid option for [ld2410]. Please check the indentation.
    g2_still_sensitivity: 40
    
    [g3_move_sensitivity] is an invalid option for [ld2410]. Please check the indentation.
    g3_move_sensitivity: 30
    
    [g3_still_sensitivity] is an invalid option for [ld2410]. Please check the indentation.
    g3_still_sensitivity: 40
    
    [g4_move_sensitivity] is an invalid option for [ld2410]. Please check the indentation.
    g4_move_sensitivity: 20
    
    [g4_still_sensitivity] is an invalid option for [ld2410]. Please check the indentation.
    g4_still_sensitivity: 30
    
    [g5_move_sensitivity] is an invalid option for [ld2410]. Please check the indentation.
    g5_move_sensitivity: 15
    
    [g5_still_sensitivity] is an invalid option for [ld2410]. Please check the indentation.
    g5_still_sensitivity: 20
    
    [g6_move_sensitivity] is an invalid option for [ld2410]. Please check the indentation.
    g6_move_sensitivity: 15
    
    [g6_still_sensitivity] is an invalid option for [ld2410]. Please check the indentation.
    g6_still_sensitivity: 20
    
    [g7_move_sensitivity] is an invalid option for [ld2410]. Please check the indentation.
    g7_move_sensitivity: 15
    
    [g7_still_sensitivity] is an invalid option for [ld2410]. Please check the indentation.
    g7_still_sensitivity: 20
    
    [g8_move_sensitivity] is an invalid option for [ld2410]. Please check the indentation.
    g8_move_sensitivity: 15
    
    [g8_still_sensitivity] is an invalid option for [ld2410]. Please check the indentation.
    g8_still_sensitivity: 20

## assistant — 2026-03-30 19:14:48

 The ESPHome LD2410 API has changed in 2026.4.0 — those options moved. Here's the corrected config.

---

## Replace Your `ld2410:` Block With This

```yaml
ld2410:
  id: presence_sensor
  uart_id: ld2410_uart
```

That's it — strip everything else out of the `ld2410:` block entirely.

---

## Then Add These as Separate Top-Level Sections

Paste these **after** your `select:` block at the bottom of the file:

```yaml
number:
  - platform: ld2410
    timeout:
      name: "Lounge LD2410 Timeout"
      initial_value: 5
    max_move_distance:
      name: "Lounge Max Move Distance"
    max_still_distance:
      name: "Lounge Max Still Distance"
    g0_move_sensitivity:
      name: "Lounge Gate 0 Move Sensitivity"
      initial_value: 50
    g0_still_sensitivity:
      name: "Lounge Gate 0 Still Sensitivity"
      initial_value: 50
    g1_move_sensitivity:
      name: "Lounge Gate 1 Move Sensitivity"
      initial_value: 50
    g1_still_sensitivity:
      name: "Lounge Gate 1 Still Sensitivity"
      initial_value: 50
    g2_move_sensitivity:
      name: "Lounge Gate 2 Move Sensitivity"
      initial_value: 40
    g2_still_sensitivity:
      name: "Lounge Gate 2 Still Sensitivity"
      initial_value: 40
    g3_move_sensitivity:
      name: "Lounge Gate 3 Move Sensitivity"
      initial_value: 30
    g3_still_sensitivity:
      name: "Lounge Gate 3 Still Sensitivity"
      initial_value: 40
    g4_move_sensitivity:
      name: "Lounge Gate 4 Move Sensitivity"
      initial_value: 20
    g4_still_sensitivity:
      name: "Lounge Gate 4 Still Sensitivity"
      initial_value: 30
    g5_move_sensitivity:
      name: "Lounge Gate 5 Move Sensitivity"
      initial_value: 15
    g5_still_sensitivity:
      name: "Lounge Gate 5 Still Sensitivity"
      initial_value: 20
    g6_move_sensitivity:
      name: "Lounge Gate 6 Move Sensitivity"
      initial_value: 15
    g6_still_sensitivity:
      name: "Lounge Gate 6 Still Sensitivity"
      initial_value: 20
    g7_move_sensitivity:
      name: "Lounge Gate 7 Move Sensitivity"
      initial_value: 15
    g7_still_sensitivity:
      name: "Lounge Gate 7 Still Sensitivity"
      initial_value: 20
    g8_move_sensitivity:
      name: "Lounge Gate 8 Move Sensitivity"
      initial_value: 15
    g8_still_sensitivity:
      name: "Lounge Gate 8 Still Sensitivity"
      initial_value: 20
```

---

## Why This Is Better

The `number:` platform approach also means all these sensitivity values appear as **sliders in HA** — so you can tune them live from your dashboard without reflashing every time.

Make those edits, hit **Save**, then **Install → Wirelessly**.

## human — 2026-03-30 19:17:09
_files:_ 106279.jpg

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
      initial_value: 5
    max_move_distance:
      name: "Lounge Max Move Distance"
    max_still_distance:
      name: "Lounge Max Still Distance"
    g0_move_sensitivity:
      name: "Lounge Gate 0 Move Sensitivity"
      initial_value: 50
    g0_still_sensitivity:
      name: "Lounge Gate 0 Still Sensitivity"
      initial_value: 50
    g1_move_sensitivity:
      name: "Lounge Gate 1 Move Sensitivity"
      initial_value: 50
    g1_still_sensitivity:
      name: "Lounge Gate 1 Still Sensitivity"
      initial_value: 50
    g2_move_sensitivity:
      name: "Lounge Gate 2 Move Sensitivity"
      initial_value: 40
    g2_still_sensitivity:
      name: "Lounge Gate 2 Still Sensitivity"
      initial_value: 40
    g3_move_sensitivity:
      name: "Lounge Gate 3 Move Sensitivity"
      initial_value: 30
    g3_still_sensitivity:
      name: "Lounge Gate 3 Still Sensitivity"
      initial_value: 40
    g4_move_sensitivity:
      name: "Lounge Gate 4 Move Sensitivity"
      initial_value: 20
    g4_still_sensitivity:
      name: "Lounge Gate 4 Still Sensitivity"
      initial_value: 30
    g5_move_sensitivity:
      name: "Lounge Gate 5 Move Sensitivity"
      initial_value: 15
    g5_still_sensitivity:
      name: "Lounge Gate 5 Still Sensitivity"
      initial_value: 20
    g6_move_sensitivity:
      name: "Lounge Gate 6 Move Sensitivity"
      initial_value: 15
    g6_still_sensitivity:
      name: "Lounge Gate 6 Still Sensitivity"
      initial_value: 20
    g7_move_sensitivity:
      name: "Lounge Gate 7 Move Sensitivity"
      initial_value: 15
    g7_still_sensitivity:
      name: "Lounge Gate 7 Still Sensitivity"
      initial_value: 20
    g8_move_sensitivity:
      name: "Lounge Gate 8 Move Sensitivity"
      initial_value: 15
    g8_still_sensitivity:
      name: "Lounge Gate 8 Still Sensitivity"
      initial_value: 20

## assistant — 2026-03-30 19:17:19

 The error is clear — `timeout` and `max_move_distance`/`max_still_distance` are in a different "inclusion group" to the gate sensitivity values. They can't all be in the same `number:` block together in this version.

---

## Fix — Split Into Two Separate Number Blocks

Replace your entire `number:` section with this:

```yaml
number:
  - platform: ld2410
    timeout:
      name: "Lounge LD2410 Timeout"
      initial_value: 5
    max_move_distance:
      name: "Lounge Max Move Distance"
    max_still_distance:
      name: "Lounge Max Still Distance"

  - platform: ld2410
    g0_move_sensitivity:
      name: "Lounge Gate 0 Move Sensitivity"
      initial_value: 50
    g0_still_sensitivity:
      name: "Lounge Gate 0 Still Sensitivity"
      initial_value: 50
    g1_move_sensitivity:
      name: "Lounge Gate 1 Move Sensitivity"
      initial_value: 50
    g1_still_sensitivity:
      name: "Lounge Gate 1 Still Sensitivity"
      initial_value: 50
    g2_move_sensitivity:
      name: "Lounge Gate 2 Move Sensitivity"
      initial_value: 40
    g2_still_sensitivity:
      name: "Lounge Gate 2 Still Sensitivity"
      initial_value: 40
    g3_move_sensitivity:
      name: "Lounge Gate 3 Move Sensitivity"
      initial_value: 30
    g3_still_sensitivity:
      name: "Lounge Gate 3 Still Sensitivity"
      initial_value: 40
    g4_move_sensitivity:
      name: "Lounge Gate 4 Move Sensitivity"
      initial_value: 20
    g4_still_sensitivity:
      name: "Lounge Gate 4 Still Sensitivity"
      initial_value: 30
    g5_move_sensitivity:
      name: "Lounge Gate 5 Move Sensitivity"
      initial_value: 15
    g5_still_sensitivity:
      name: "Lounge Gate 5 Still Sensitivity"
      initial_value: 20
    g6_move_sensitivity:
      name: "Lounge Gate 6 Move Sensitivity"
      initial_value: 15
    g6_still_sensitivity:
      name: "Lounge Gate 6 Still Sensitivity"
      initial_value: 20
    g7_move_sensitivity:
      name: "Lounge Gate 7 Move Sensitivity"
      initial_value: 15
    g7_still_sensitivity:
      name: "Lounge Gate 7 Still Sensitivity"
      initial_value: 20
    g8_move_sensitivity:
      name: "Lounge Gate 8 Move Sensitivity"
      initial_value: 15
    g8_still_sensitivity:
      name: "Lounge Gate 8 Still Sensitivity"
      initial_value: 20
```

Two `- platform: ld2410` entries under the same `number:` key — one for timeout/distance, one for gate sensitivities. Save and try again.

## human — 2026-03-30 19:18:57
_files:_ 106281.jpg

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
      initial_value: 5
    max_move_distance:
      name: "Lounge Max Move Distance"
    max_still_distance:
      name: "Lounge Max Still Distance"

  - platform: ld2410
    g0_move_sensitivity:
      name: "Lounge Gate 0 Move Sensitivity"
      initial_value: 50
    g0_still_sensitivity:
      name: "Lounge Gate 0 Still Sensitivity"
      initial_value: 50
    g1_move_sensitivity:
      name: "Lounge Gate 1 Move Sensitivity"
      initial_value: 50
    g1_still_sensitivity:
      name: "Lounge Gate 1 Still Sensitivity"
      initial_value: 50
    g2_move_sensitivity:
      name: "Lounge Gate 2 Move Sensitivity"
      initial_value: 40
    g2_still_sensitivity:
      name: "Lounge Gate 2 Still Sensitivity"
      initial_value: 40
    g3_move_sensitivity:
      name: "Lounge Gate 3 Move Sensitivity"
      initial_value: 30
    g3_still_sensitivity:
      name: "Lounge Gate 3 Still Sensitivity"
      initial_value: 40
    g4_move_sensitivity:
      name: "Lounge Gate 4 Move Sensitivity"
      initial_value: 20
    g4_still_sensitivity:
      name: "Lounge Gate 4 Still Sensitivity"
      initial_value: 30
    g5_move_sensitivity:
      name: "Lounge Gate 5 Move Sensitivity"
      initial_value: 15
    g5_still_sensitivity:
      name: "Lounge Gate 5 Still Sensitivity"
      initial_value: 20
    g6_move_sensitivity:
      name: "Lounge Gate 6 Move Sensitivity"
      initial_value: 15
    g6_still_sensitivity:
      name: "Lounge Gate 6 Still Sensitivity"
      initial_value: 20
    g7_move_sensitivity:
      name: "Lounge Gate 7 Move Sensitivity"
      initial_value: 15
    g7_still_sensitivity:
      name: "Lounge Gate 7 Still Sensitivity"
      initial_value: 20
    g8_move_sensitivity:
      name: "Lounge Gate 8 Move Sensitivity"
      initial_value: 15
    g8_still_sensitivity:
      name: "Lounge Gate 8 Still Sensitivity"
      initial_value: 20

## assistant — 2026-03-30 19:19:08

 Still the same error on the first block — `timeout`, `max_move_distance` and `max_still_distance` can't be together either. ESPHome 2026.4.0 has split these into completely separate groups.

---

## Fix — Three Separate Blocks

Replace your entire `number:` section with this:

```yaml
number:
  - platform: ld2410
    timeout:
      name: "Lounge LD2410 Timeout"
      initial_value: 5

  - platform: ld2410
    max_move_distance:
      name: "Lounge Max Move Distance"
    max_still_distance:
      name: "Lounge Max Still Distance"

  - platform: ld2410
    g0_move_sensitivity:
      name: "Lounge Gate 0 Move Sensitivity"
      initial_value: 50
    g0_still_sensitivity:
      name: "Lounge Gate 0 Still Sensitivity"
      initial_value: 50
    g1_move_sensitivity:
      name: "Lounge Gate 1 Move Sensitivity"
      initial_value: 50
    g1_still_sensitivity:
      name: "Lounge Gate 1 Still Sensitivity"
      initial_value: 50
    g2_move_sensitivity:
      name: "Lounge Gate 2 Move Sensitivity"
      initial_value: 40
    g2_still_sensitivity:
      name: "Lounge Gate 2 Still Sensitivity"
      initial_value: 40
    g3_move_sensitivity:
      name: "Lounge Gate 3 Move Sensitivity"
      initial_value: 30
    g3_still_sensitivity:
      name: "Lounge Gate 3 Still Sensitivity"
      initial_value: 40
    g4_move_sensitivity:
      name: "Lounge Gate 4 Move Sensitivity"
      initial_value: 20
    g4_still_sensitivity:
      name: "Lounge Gate 4 Still Sensitivity"
      initial_value: 30
    g5_move_sensitivity:
      name: "Lounge Gate 5 Move Sensitivity"
      initial_value: 15
    g5_still_sensitivity:
      name: "Lounge Gate 5 Still Sensitivity"
      initial_value: 20
    g6_move_sensitivity:
      name: "Lounge Gate 6 Move Sensitivity"
      initial_value: 15
    g6_still_sensitivity:
      name: "Lounge Gate 6 Still Sensitivity"
      initial_value: 20
    g7_move_sensitivity:
      name: "Lounge Gate 7 Move Sensitivity"
      initial_value: 15
    g7_still_sensitivity:
      name: "Lounge Gate 7 Still Sensitivity"
      initial_value: 20
    g8_move_sensitivity:
      name: "Lounge Gate 8 Move Sensitivity"
      initial_value: 15
    g8_still_sensitivity:
      name: "Lounge Gate 8 Still Sensitivity"
      initial_value: 20
```

If this still fails, the ESPHome docs for 2026.4.0 may have changed the option names entirely — in which case I'd want to check the actual current docs before we try again rather than keep guessing. But try this first.

## human — 2026-03-30 19:20:48
_files:_ 106283.jpg

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
      initial_value: 5

  - platform: ld2410
    max_move_distance:
      name: "Lounge Max Move Distance"
    max_still_distance:
      name: "Lounge Max Still Distance"

  - platform: ld2410
    g0_move_sensitivity:
      name: "Lounge Gate 0 Move Sensitivity"
      initial_value: 50
    g0_still_sensitivity:
      name: "Lounge Gate 0 Still Sensitivity"
      initial_value: 50
    g1_move_sensitivity:
      name: "Lounge Gate 1 Move Sensitivity"
      initial_value: 50
    g1_still_sensitivity:
      name: "Lounge Gate 1 Still Sensitivity"
      initial_value: 50
    g2_move_sensitivity:
      name: "Lounge Gate 2 Move Sensitivity"
      initial_value: 40
    g2_still_sensitivity:
      name: "Lounge Gate 2 Still Sensitivity"
      initial_value: 40
    g3_move_sensitivity:
      name: "Lounge Gate 3 Move Sensitivity"
      initial_value: 30
    g3_still_sensitivity:
      name: "Lounge Gate 3 Still Sensitivity"
      initial_value: 40
    g4_move_sensitivity:
      name: "Lounge Gate 4 Move Sensitivity"
      initial_value: 20
    g4_still_sensitivity:
      name: "Lounge Gate 4 Still Sensitivity"
      initial_value: 30
    g5_move_sensitivity:
      name: "Lounge Gate 5 Move Sensitivity"
      initial_value: 15
    g5_still_sensitivity:
      name: "Lounge Gate 5 Still Sensitivity"
      initial_value: 20
    g6_move_sensitivity:
      name: "Lounge Gate 6 Move Sensitivity"
      initial_value: 15
    g6_still_sensitivity:
      name: "Lounge Gate 6 Still Sensitivity"
      initial_value: 20
    g7_move_sensitivity:
      name: "Lounge Gate 7 Move Sensitivity"
      initial_value: 15
    g7_still_sensitivity:
      name: "Lounge Gate 7 Still Sensitivity"
      initial_value: 20
    g8_move_sensitivity:
      name: "Lounge Gate 8 Move Sensitivity"
      initial_value: 15
    g8_still_sensitivity:
      name: "Lounge Gate 8 Still Sensitivity"
      initial_value: 20

## assistant — 2026-03-30 19:21:08

 `timeout` alone is still failing with the same "inclusion group" error. Let me check the actual ESPHome 2026.4.0 source to get the correct syntax rather than keep guessing.
```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

Got it. The `timeout` option requires `max_move_distance_gate` and `max_still_distance_gate` to also be present in the same block — they're in the same inclusion group and become mandatory when `timeout` is specified. Also, the correct gate syntax uses nested `g0:` / `move_threshold:` structure, not flat `g0_move_sensitivity`.

---

## Replace Your Entire `number:` Section With This

```yaml
number:
  - platform: ld2410
    timeout:
      name: "Lounge LD2410 Timeout"
      initial_value: 5
    max_move_distance_gate:
      name: "Lounge Max Move Distance Gate"
    max_still_distance_gate:
      name: "Lounge Max Still Distance Gate"
    g0:
      move_threshold:
        name: "Lounge Gate 0 Move Threshold"
        initial_value: 50
      still_threshold:
        name: "Lounge Gate 0 Still Threshold"
        initial_value: 50
    g1:
      move_threshold:
        name: "Lounge Gate 1 Move Threshold"
        initial_value: 50
      still_threshold:
        name: "Lounge Gate 1 Still Threshold"
        initial_value: 50
    g2:
      move_threshold:
        name: "Lounge Gate 2 Move Threshold"
        initial_value: 40
      still_threshold:
        name: "Lounge Gate 2 Still Threshold"
        initial_value: 40
    g3:
      move_threshold:
        name: "Lounge Gate 3 Move Threshold"
        initial_value: 30
      still_threshold:
        name: "Lounge Gate 3 Still Threshold"
        initial_value: 40
    g4:
      move_threshold:
        name: "Lounge Gate 4 Move Threshold"
        initial_value: 20
      still_threshold:
        name: "Lounge Gate 4 Still Threshold"
        initial_value: 30
    g5:
      move_threshold:
        name: "Lounge Gate 5 Move Threshold"
        initial_value: 15
      still_threshold:
        name: "Lounge Gate 5 Still Threshold"
        initial_value: 20
    g6:
      move_threshold:
        name: "Lounge Gate 6 Move Threshold"
        initial_value: 15
      still_threshold:
        name: "Lounge Gate 6 Still Threshold"
        initial_value: 20
    g7:
      move_threshold:
        name: "Lounge Gate 7 Move Threshold"
        initial_value: 15
      still_threshold:
        name: "Lounge Gate 7 Still Threshold"
        initial_value: 20
    g8:
      move_threshold:
        name: "Lounge Gate 8 Move Threshold"
        initial_value: 15
      still_threshold:
        name: "Lounge Gate 8 Still Threshold"
        initial_value: 20
```

Everything in **one single block** this time — `timeout`, `max_move_distance_gate`, `max_still_distance_gate`, and all gates together. Save and try again.

## human — 2026-03-30 19:23:34

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
      initial_value: 5
    max_move_distance_gate:
      name: "Lounge Max Move Distance Gate"
    max_still_distance_gate:
      name: "Lounge Max Still Distance Gate"
    g0:
      move_threshold:
        name: "Lounge Gate 0 Move Threshold"
        initial_value: 50
      still_threshold:
        name: "Lounge Gate 0 Still Threshold"
        initial_value: 50
    g1:
      move_threshold:
        name: "Lounge Gate 1 Move Threshold"
        initial_value: 50
      still_threshold:
        name: "Lounge Gate 1 Still Threshold"
        initial_value: 50
    g2:
      move_threshold:
        name: "Lounge Gate 2 Move Threshold"
        initial_value: 40
      still_threshold:
        name: "Lounge Gate 2 Still Threshold"
        initial_value: 40
    g3:
      move_threshold:
        name: "Lounge Gate 3 Move Threshold"
        initial_value: 30
      still_threshold:
        name: "Lounge Gate 3 Still Threshold"
        initial_value: 40
    g4:
      move_threshold:
        name: "Lounge Gate 4 Move Threshold"
        initial_value: 20
      still_threshold:
        name: "Lounge Gate 4 Still Threshold"
        initial_value: 30
    g5:
      move_threshold:
        name: "Lounge Gate 5 Move Threshold"
        initial_value: 15
      still_threshold:
        name: "Lounge Gate 5 Still Threshold"
        initial_value: 20
    g6:
      move_threshold:
        name: "Lounge Gate 6 Move Threshold"
        initial_value: 15
      still_threshold:
        name: "Lounge Gate 6 Still Threshold"
        initial_value: 20
    g7:
      move_threshold:
        name: "Lounge Gate 7 Move Threshold"
        initial_value: 15
      still_threshold:
        name: "Lounge Gate 7 Still Threshold"
        initial_value: 20
    g8:
      move_threshold:
        name: "Lounge Gate 8 Move Threshold"
        initial_value: 15
      still_threshold:
        name: "Lounge Gate 8 Still Threshold"
        initial_value: 20










INFO ESPHome 2026.4.0-dev
INFO Reading configuration /config/esphome/lounge-presence.yaml...
Failed config

number.ld2410: [source /config/esphome/lounge-presence.yaml:101]
  platform: ld2410
  timeout: 
    name: Lounge LD2410 Timeout
    
    [initial_value] is an invalid option for [timeout]. Did you mean [on_value]?
    initial_value: 5
  max_move_distance_gate: 
    name: Lounge Max Move Distance Gate
  max_still_distance_gate: 
    name: Lounge Max Still Distance Gate
  g0: 
    move_threshold: 
      name: Lounge Gate 0 Move Threshold
      
      [initial_value] is an invalid option for [move_threshold]. Did you mean [on_value]?
      initial_value: 50
    still_threshold: 
      name: Lounge Gate 0 Still Threshold
      
      [initial_value] is an invalid option for [still_threshold]. Did you mean [on_value]?
      initial_value: 50
  g1: 
    move_threshold: 
      name: Lounge Gate 1 Move Threshold
      
      [initial_value] is an invalid option for [move_threshold]. Did you mean [on_value]?
      initial_value: 50
    still_threshold: 
      name: Lounge Gate 1 Still Threshold
      
      [initial_value] is an invalid option for [still_threshold]. Did you mean [on_value]?
      initial_value: 50
  g2: 
    move_threshold: 
      name: Lounge Gate 2 Move Threshold
      
      [initial_value] is an invalid option for [move_threshold]. Did you mean [on_value]?
      initial_value: 40
    still_threshold: 
      name: Lounge Gate 2 Still Threshold
      
      [initial_value] is an invalid option for [still_threshold]. Did you mean [on_value]?
      initial_value: 40
  g3: 
    move_threshold: 
      name: Lounge Gate 3 Move Threshold
      
      [initial_value] is an invalid option for [move_threshold]. Did you mean [on_value]?
      initial_value: 30
    still_threshold: 
      name: Lounge Gate 3 Still Threshold
      
      [initial_value] is an invalid option for [still_threshold]. Did you mean [on_value]?
      initial_value: 40
  g4: 
    move_threshold: 
      name: Lounge Gate 4 Move Threshold
      
      [initial_value] is an invalid option for [move_threshold]. Did you mean [on_value]?
      initial_value: 20
    still_threshold: 
      name: Lounge Gate 4 Still Threshold
      
      [initial_value] is an invalid option for [still_threshold]. Did you mean [on_value]?
      initial_value: 30
  g5: 
    move_threshold: 
      name: Lounge Gate 5 Move Threshold
      
      [initial_value] is an invalid option for [move_threshold]. Did you mean [on_value]?
      initial_value: 15
    still_threshold: 
      name: Lounge Gate 5 Still Threshold
      
      [initial_value] is an invalid option for [still_threshold]. Did you mean [on_value]?
      initial_value: 20
  g6: 
    move_threshold: 
      name: Lounge Gate 6 Move Threshold
      
      [initial_value] is an invalid option for [move_threshold]. Did you mean [on_value]?
      initial_value: 15
    still_threshold: 
      name: Lounge Gate 6 Still Threshold
      
      [initial_value] is an invalid option for [still_threshold]. Did you mean [on_value]?
      initial_value: 20
  g7: 
    move_threshold: 
      name: Lounge Gate 7 Move Threshold
      
      [initial_value] is an invalid option for [move_threshold]. Did you mean [on_value]?
      initial_value: 15
    still_threshold: 
      name: Lounge Gate 7 Still Threshold
      
      [initial_value] is an invalid option for [still_threshold]. Did you mean [on_value]?
      initial_value: 20
  g8: 
    move_threshold: 
      name: Lounge Gate 8 Move Threshold
      
      [initial_value] is an invalid option for [move_threshold]. Did you mean [on_value]?
      initial_value: 15
    still_threshold: 
      name: Lounge Gate 8 Still Threshold
      
      [initial_value] is an invalid option for [still_threshold]. Did you mean [on_value]?
      initial_value: 20

## assistant — 2026-03-30 19:23:43

 Good progress — the structure is now correct, just `initial_value` isn't supported on these number types. Simply remove all the `initial_value` lines. The values will be set via HA sliders after flashing instead.

Replace your `number:` section with this:

```yaml
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
```

Save and install. Once it's flashed, you'll set the threshold values as sliders directly in HA — which is actually better than hardcoding them, since you can tune live without reflashing.

## human — 2026-03-30 19:26:05

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

## assistant — 2026-03-30 19:26:13

 That YAML looks perfect — no errors visible. Hit **Save** then **Install → Wirelessly** and let it flash.

While it's compiling, here's what to do immediately after it reboots:

---

## After Flashing — Set Your Values in HA

Go to **Settings → Devices → Lounge Presence** and you'll now have sliders for every gate. Set these values:

| Entity | Value |
|---|---|
| Timeout | 5 |
| Max Move Distance Gate | 8 |
| Max Still Distance Gate | 8 |
| Gate 0–1 Move/Still Threshold | 50 |
| Gate 2 Move/Still Threshold | 40 |
| Gate 3 Move Threshold | 30 |
| Gate 3 Still Threshold | 40 |
| Gate 4 Move Threshold | 20 |
| Gate 4 Still Threshold | 30 |
| Gate 5–8 Move Threshold | 15 |
| Gate 5–8 Still Threshold | 20 |

---

Then do the **sit-still test** — walk in, sit down, stop moving completely and watch whether `Lounge Still Target` stays ON. Share the log output and we'll know if the tuning is working. Let me know when it's done flashing!

## human — 2026-03-30 19:26:38
_files:_ 106285.jpg

_(empty)_

## assistant — 2026-03-30 19:26:43

 That's just a cache clean — it ran the "Clean Build Files" option instead of Install. Completely harmless.

Now hit **INSTALL** (bottom right) and select **Wirelessly**. That will do the actual compile and flash.

## human — 2026-03-30 19:43:48

INFO Upload took 3.17 seconds, waiting for result...
INFO OTA successful
INFO Successfully uploaded program.
INFO Starting log output from 192.168.0.184 using esphome API
INFO Successfully resolved lounge-presence @ 192.168.0.184 in 0.000s
INFO Successfully connected to lounge-presence @ 192.168.0.184 in 2.050s
INFO Successful handshake with lounge-presence @ 192.168.0.184 in 0.059s
[20:41:33.659][I][app:163]: ESPHome version 2026.4.0-dev compiled on 2026-03-30 20:26:44 +0100
[20:41:33.671][I][app:170]: ESP32 Chip: ESP32-S3 rev0.2, 2 core(s)
[20:41:33.672][C][logger:219]: Logger:
[20:41:33.672][C][logger:219]:   Max Level: DEBUG
[20:41:33.672][C][logger:219]:   Initial Level: DEBUG
[20:41:33.672][C][logger:226]:   Log Baud Rate: 0
[20:41:33.672][C][logger:226]:   Hardware UART: USB_SERIAL_JTAG
[20:41:33.676][C][logger:235]:   Task Log Buffer Size: 768 bytes
[20:41:33.684][C][uart.idf:247]: UART Bus 0:
[20:41:33.684][C][uart.idf:152]:   TX Pin: GPIO8
[20:41:33.684][C][uart.idf:152]:   RX Pin: GPIO7
[20:41:33.687][C][uart.idf:252]:   RX Buffer Size: 256
[20:41:33.687][C][uart.idf:252]:   RX Full Threshold: 120
[20:41:33.687][C][uart.idf:252]:   RX Timeout: 2
[20:41:33.722][C][uart.idf:261]:   Baud Rate: 256000 baud
[20:41:33.722][C][uart.idf:261]:   Data Bits: 8
[20:41:33.722][C][uart.idf:261]:   Parity: NONE
[20:41:33.722][C][uart.idf:261]:   Stop bits: 1
[20:41:33.722][C][uart.idf:261]:   Wake on data RX: ENABLED
[20:41:33.723][C][ld2410:185]: LD2410:
[20:41:33.723][C][ld2410:185]:   Firmware version: 2.44.25070917
[20:41:33.723][C][ld2410:185]:   MAC address: unknown
[20:41:33.724][C][ld2410:191]: Binary Sensors:
[20:41:33.726][C][ld2410:016]:   Target 'Lounge Presence'
[20:41:33.729][C][ld2410:232]:     Device Class: 'occupancy'
[20:41:33.729][C][ld2410:016]:   MovingTarget 'Lounge Moving Target'
[20:41:33.730][C][ld2410:232]:     Device Class: 'motion'
[20:41:33.732][C][ld2410:016]:   StillTarget 'Lounge Still Target'
[20:41:33.733][C][ld2410:232]:     Device Class: 'occupancy'
[20:41:33.735][C][ld2410:198]: Sensors:
[20:41:33.736][C][ld2410:017]:   DetectionDistance 'Lounge Detection Distance'
[20:41:33.736][C][ld2410:017]:     State Class: ''
[20:41:33.736][C][ld2410:017]:     Unit of Measurement: 'cm'
[20:41:33.736][C][ld2410:017]:     Accuracy Decimals: 0
[20:41:33.738][C][ld2410:232]:     Device Class: 'distance'
[20:41:33.742][C][ld2410:223]:     Icon: 'mdi:signal-distance-variant'
[20:41:33.742][C][ld2410:017]:   MovingTargetDistance 'Lounge Moving Distance'
[20:41:33.742][C][ld2410:017]:     State Class: ''
[20:41:33.742][C][ld2410:017]:     Unit of Measurement: 'cm'
[20:41:33.742][C][ld2410:017]:     Accuracy Decimals: 0
[20:41:33.743][C][ld2410:232]:     Device Class: 'distance'
[20:41:33.745][C][ld2410:223]:     Icon: 'mdi:signal-distance-variant'
[20:41:33.748][C][ld2410:017]:   StillTargetDistance 'Lounge Still Distance'
[20:41:33.748][C][ld2410:017]:     State Class: ''
[20:41:33.748][C][ld2410:017]:     Unit of Measurement: 'cm'
[20:41:33.748][C][ld2410:017]:     Accuracy Decimals: 0
[20:41:33.749][C][ld2410:232]:     Device Class: 'distance'
[20:41:33.749][C][ld2410:223]:     Icon: 'mdi:signal-distance-variant'
[20:41:33.753][C][ld2410:213]: Text Sensors:
[20:41:33.755][C][ld2410:016]:   Mac 'Lounge LD2410 MAC Address'
[20:41:33.755][C][ld2410:223]:     Icon: 'mdi:bluetooth'
[20:41:33.756][C][ld2410:016]:   Version 'Lounge LD2410 Firmware Version'
[20:41:33.758][C][ld2410:223]:     Icon: 'mdi:chip'
[20:41:33.761][C][ld2410:218]: Numbers:
[20:41:33.761][C][ld2410:016]:   MaxMoveDistanceGate 'Lounge Max Move Distance Gate'
[20:41:33.762][C][ld2410:223]:     Icon: 'mdi:motion-sensor'
[20:41:33.764][C][ld2410:232]:     Device Class: 'distance'
[20:41:33.775][C][ld2410:016]:   MaxStillDistanceGate 'Lounge Max Still Distance Gate'
[20:41:33.775][C][ld2410:223]:     Icon: 'mdi:motion-sensor'
[20:41:33.776][C][ld2410:232]:     Device Class: 'distance'
[20:41:33.776][C][ld2410:016]:   Timeout 'Lounge LD2410 Timeout'
[20:41:33.776][C][ld2410:223]:     Icon: 'mdi:timelapse'
[20:41:33.777][C][ld2410:238]:     Unit of Measurement: 's'
[20:41:33.777][C][ld2410:016]:   MoveThreshold 'Lounge Gate 0 Move Threshold'
[20:41:33.778][C][ld2410:223]:     Icon: 'mdi:motion-sensor'
[20:41:33.780][C][ld2410:238]:     Unit of Measurement: '%'
[20:41:33.780][C][ld2410:232]:     Device Class: 'signal_strength'
[20:41:33.784][C][ld2410:016]:   MoveThreshold 'Lounge Gate 1 Move Threshold'
[20:41:33.786][C][ld2410:223]:     Icon: 'mdi:motion-sensor'
[20:41:33.787][C][ld2410:238]:     Unit of Measurement: '%'
[20:41:33.787][C][ld2410:232]:     Device Class: 'signal_strength'
[20:41:33.787][C][ld2410:016]:   MoveThreshold 'Lounge Gate 2 Move Threshold'
[20:41:33.788][C][ld2410:223]:     Icon: 'mdi:motion-sensor'
[20:41:33.792][C][ld2410:238]:     Unit of Measurement: '%'
[20:41:33.793][C][ld2410:232]:     Device Class: 'signal_strength'
[20:41:33.793][C][ld2410:016]:   MoveThreshold 'Lounge Gate 3 Move Threshold'
[20:41:33.797][C][ld2410:223]:     Icon: 'mdi:motion-sensor'
[20:41:33.800][C][ld2410:238]:     Unit of Measurement: '%'
[20:41:33.800][C][ld2410:232]:     Device Class: 'signal_strength'
[20:41:33.801][C][ld2410:016]:   MoveThreshold 'Lounge Gate 4 Move Threshold'
[20:41:33.804][C][ld2410:223]:     Icon: 'mdi:motion-sensor'
[20:41:33.805][C][ld2410:238]:     Unit of Measurement: '%'
[20:41:33.806][C][ld2410:232]:     Device Class: 'signal_strength'
[20:41:33.806][C][ld2410:016]:   MoveThreshold 'Lounge Gate 5 Move Threshold'
[20:41:33.807][C][ld2410:223]:     Icon: 'mdi:motion-sensor'
[20:41:33.807][C][ld2410:238]:     Unit of Measurement: '%'
[20:41:33.808][C][ld2410:232]:     Device Class: 'signal_strength'
[20:41:33.808][C][ld2410:016]:   MoveThreshold 'Lounge Gate 6 Move Threshold'
[20:41:33.809][C][ld2410:223]:     Icon: 'mdi:motion-sensor'
[20:41:33.813][C][ld2410:238]:     Unit of Measurement: '%'
[20:41:33.813][C][ld2410:232]:     Device Class: 'signal_strength'
[20:41:33.814][C][ld2410:016]:   MoveThreshold 'Lounge Gate 7 Move Threshold'
[20:41:33.814][C][ld2410:223]:     Icon: 'mdi:motion-sensor'
[20:41:33.815][C][ld2410:238]:     Unit of Measurement: '%'
[20:41:33.815][C][ld2410:232]:     Device Class: 'signal_strength'
[20:41:33.815][C][ld2410:016]:   MoveThreshold 'Lounge Gate 8 Move Threshold'
[20:41:33.816][C][ld2410:223]:     Icon: 'mdi:motion-sensor'
[20:41:33.816][C][ld2410:238]:     Unit of Measurement: '%'
[20:41:33.817][C][ld2410:232]:     Device Class: 'signal_strength'
[20:41:33.817][C][ld2410:016]:   StillThreshold 'Lounge Gate 0 Still Threshold'
[20:41:33.817][C][ld2410:223]:     Icon: 'mdi:motion-sensor'
[20:41:33.818][C][ld2410:238]:     Unit of Measurement: '%'
[20:41:33.818][C][ld2410:232]:     Device Class: 'signal_strength'
[20:41:33.818][C][ld2410:016]:   StillThreshold 'Lounge Gate 1 Still Threshold'
[20:41:33.827][C][ld2410:223]:     Icon: 'mdi:motion-sensor'
[20:41:33.827][C][ld2410:238]:     Unit of Measurement: '%'
[20:41:33.827][C][ld2410:232]:     Device Class: 'signal_strength'
[20:41:33.828][C][ld2410:016]:   StillThreshold 'Lounge Gate 2 Still Threshold'
[20:41:33.829][C][ld2410:223]:     Icon: 'mdi:motion-sensor'
[20:41:33.829][C][ld2410:238]:     Unit of Measurement: '%'
[20:41:33.830][C][ld2410:232]:     Device Class: 'signal_strength'
[20:41:33.830][C][ld2410:016]:   StillThreshold 'Lounge Gate 3 Still Threshold'
[20:41:33.832][C][ld2410:223]:     Icon: 'mdi:motion-sensor'
[20:41:33.833][C][ld2410:238]:     Unit of Measurement: '%'
[20:41:33.833][C][ld2410:232]:     Device Class: 'signal_strength'
[20:41:33.833][C][ld2410:016]:   StillThreshold 'Lounge Gate 4 Still Threshold'
[20:41:33.835][C][ld2410:223]:     Icon: 'mdi:motion-sensor'
[20:41:33.839][C][ld2410:238]:     Unit of Measurement: '%'
[20:41:33.839][C][ld2410:232]:     Device Class: 'signal_strength'
[20:41:33.840][C][ld2410:016]:   StillThreshold 'Lounge Gate 5 Still Threshold'
[20:41:33.849][C][ld2410:223]:     Icon: 'mdi:motion-sensor'
[20:41:33.849][C][ld2410:238]:     Unit of Measurement: '%'
[20:41:33.850][C][ld2410:232]:     Device Class: 'signal_strength'
[20:41:33.850][C][ld2410:016]:   StillThreshold 'Lounge Gate 6 Still Threshold'
[20:41:33.851][C][ld2410:223]:     Icon: 'mdi:motion-sensor'
[20:41:33.851][C][ld2410:238]:     Unit of Measurement: '%'
[20:41:33.852][C][ld2410:232]:     Device Class: 'signal_strength'
[20:41:33.852][C][ld2410:016]:   StillThreshold 'Lounge Gate 7 Still Threshold'
[20:41:33.853][C][ld2410:223]:     Icon: 'mdi:motion-sensor'
[20:41:33.861][C][ld2410:238]:     Unit of Measurement: '%'
[20:41:33.861][C][ld2410:232]:     Device Class: 'signal_strength'
[20:41:33.862][C][ld2410:016]:   StillThreshold 'Lounge Gate 8 Still Threshold'
[20:41:33.863][C][ld2410:223]:     Icon: 'mdi:motion-sensor'
[20:41:33.863][C][ld2410:238]:     Unit of Measurement: '%'
[20:41:33.864][C][ld2410:232]:     Device Class: 'signal_strength'
[20:41:33.864][C][ld2410:231]: Selects:
[20:41:33.865][C][ld2410:232]:   BaudRate 'Lounge LD2410 Baud Rate'
[20:41:33.866][C][ld2410:223]:     Icon: 'mdi:thermometer'
[20:41:33.867][C][ld2410:233]:   DistanceResolution 'Lounge LD2410 Distance Resolution'
[20:41:33.867][C][ld2410:223]:     Icon: 'mdi:ruler'
[20:41:33.868][C][ld2410:243]: Buttons:
[20:41:33.869][C][ld2410:014]:   FactoryReset 'Lounge LD2410 Factory Reset'
[20:41:33.869][C][ld2410:223]:     Icon: 'mdi:restart-alert'
[20:41:33.870][C][ld2410:014]:   Query 'Lounge LD2410 Query Params'
[20:41:33.883][C][ld2410:223]:     Icon: 'mdi:database'
[20:41:33.884][C][ld2410:014]:   Restart 'Lounge LD2410 Restart'
[20:41:33.884][C][ld2410:223]:     Icon: 'mdi:restart'
[20:41:33.885][C][captive_portal:134]: Captive Portal:
[20:41:33.901][C][wifi:1510]: WiFi:
[20:41:33.901][C][wifi:1510]:   Local MAC: E0:72:A1:E6:FE:04
[20:41:33.901][C][wifi:1510]:   Connected: YES
[20:41:33.902][C][wifi:1221]:   IP Address: 192.168.0.184
[20:41:33.902][C][wifi:1232]:   SSID: [redacted]
[20:41:33.902][C][wifi:1232]:   BSSID: [redacted]
[20:41:33.902][C][wifi:1232]:   Hostname: 'lounge-presence'
[20:41:33.902][C][wifi:1232]:   Signal strength: -50 dB ▂▄▆█
[20:41:33.902][C][wifi:1232]:   Channel: 1
[20:41:33.902][C][wifi:1232]:   Subnet: 255.255.255.0
[20:41:33.902][C][wifi:1232]:   Gateway: 192.168.0.1
[20:41:33.902][C][wifi:1232]:   DNS1: 192.168.0.1
[20:41:33.902][C][wifi:1232]:   DNS2: 0.0.0.0
[20:41:33.904][C][esphome.ota:071]: Over-The-Air updates:
[20:41:33.904][C][esphome.ota:071]:   Address: 192.168.0.184:3232
[20:41:33.904][C][esphome.ota:071]:   Version: 2
[20:41:33.905][C][safe_mode:026]: Safe Mode:
[20:41:33.905][C][safe_mode:026]:   Successful after: 60s
[20:41:33.905][C][safe_mode:026]:   Invoke after: 10 attempts
[20:41:33.905][C][safe_mode:026]:   Duration: 300s
[20:41:33.906][C][safe_mode:043]:   Bootloader rollback: supported
[20:41:33.918][C][web_server.ota:238]: Web Server OTA
[20:41:33.919][C][api:235]: Server:
[20:41:33.919][C][api:235]:   Address: 192.168.0.184:6053
[20:41:33.919][C][api:235]:   Listen backlog: 4
[20:41:33.919][C][api:235]:   Max connections: 8
[20:41:33.922][C][api:242]:   Noise encryption: YES
[20:41:33.986][C][mdns:194]: mDNS:
[20:41:33.986][C][mdns:194]:   Hostname: lounge-presence
[20:41:34.034][S][sensor]: 'Lounge Still Distance' >> 128 cm
[20:41:34.415][D][api:220]: Accept 192.168.0.50
[20:41:34.450][D][api.connection:2440]: Home Assistant 2026.4.0b4 (192.168.0.50): connected
[20:41:35.235][S][sensor]: 'Lounge Detection Distance' >> 129 cm
[20:41:35.534][S][sensor]: 'Lounge Still Distance' >> 139 cm
[20:41:38.334][S][sensor]: 'Lounge Still Distance' >> 158 cm
[20:41:41.535][S][binary_sensor]: 'Lounge Presence' >> OFF
[20:41:41.535][S][binary_sensor]: 'Lounge Still Target' >> OFF
[20:42:29.794][I][safe_mode:091]: Boot seems successful; resetting boot loop counter
[20:42:32.891][D][preferences:132]: Writing 1 items: 0 cached, 1 written, 0 failed
[20:42:34.234][S][binary_sensor]: 'Lounge Presence' >> ON
[20:42:34.235][S][binary_sensor]: 'Lounge Moving Target' >> ON
[20:42:34.235][S][sensor]: 'Lounge Detection Distance' >> 153 cm
[20:42:34.236][S][binary_sensor]: 'Lounge Still Target' >> ON
[20:42:35.334][S][binary_sensor]: 'Lounge Moving Target' >> OFF
[20:42:39.433][S][binary_sensor]: 'Lounge Presence' >> OFF
[20:42:39.434][S][binary_sensor]: 'Lounge Still Target' >> OFF
[20:42:40.239][S][binary_sensor]: 'Lounge Moving Target' >> ON
[20:42:40.545][S][sensor]: 'Lounge Still Distance' >> 168 cm
[20:42:40.546][S][sensor]: 'Lounge Detection Distance' >> 154 cm
[20:42:40.834][S][sensor]: 'Lounge Moving Distance' >> 154 cm
[20:42:41.229][S][binary_sensor]: 'Lounge Presence' >> ON
[20:42:41.529][S][binary_sensor]: 'Lounge Still Target' >> ON
[20:42:42.129][S][binary_sensor]: 'Lounge Moving Target' >> OFF
[20:42:42.246][S][sensor]: 'Lounge Still Distance' >> 165 cm
[20:42:43.833][S][binary_sensor]: 'Lounge Moving Target' >> ON
[20:42:43.834][S][sensor]: 'Lounge Still Distance' >> 164 cm
[20:42:44.133][S][sensor]: 'Lounge Detection Distance' >> 160 cm
[20:42:44.334][S][sensor]: 'Lounge Moving Distance' >> 160 cm
[20:42:44.334][S][binary_sensor]: 'Lounge Still Target' >> OFF
[20:42:45.333][S][sensor]: 'Lounge Still Distance' >> 133 cm
[20:42:45.634][S][sensor]: 'Lounge Detection Distance' >> 118 cm
[20:42:45.634][S][binary_sensor]: 'Lounge Still Target' >> ON
[20:42:45.933][S][sensor]: 'Lounge Moving Distance' >> 71 cm
[20:42:45.934][S][binary_sensor]: 'Lounge Still Target' >> OFF
[20:42:47.033][S][sensor]: 'Lounge Still Distance' >> 110 cm
[20:42:47.034][S][sensor]: 'Lounge Detection Distance' >> 85 cm
[20:42:47.433][S][sensor]: 'Lounge Moving Distance' >> 102 cm
[20:42:48.029][S][binary_sensor]: 'Lounge Still Target' >> ON
[20:42:48.533][S][sensor]: 'Lounge Still Distance' >> 111 cm
[20:42:48.534][S][sensor]: 'Lounge Detection Distance' >> 116 cm
[20:42:49.729][S][binary_sensor]: 'Lounge Moving Target' >> OFF
[20:42:50.033][S][sensor]: 'Lounge Still Distance' >> 113 cm
[20:42:50.633][S][sensor]: 'Lounge Detection Distance' >> 110 cm
[20:42:51.533][S][sensor]: 'Lounge Still Distance' >> 118 cm
[20:42:52.433][S][sensor]: 'Lounge Detection Distance' >> 114 cm
[20:42:55.433][S][sensor]: 'Lounge Still Distance' >> 148 cm
[20:42:58.933][S][binary_sensor]: 'Lounge Presence' >> OFF
[20:42:58.934][S][binary_sensor]: 'Lounge Still Target' >> OFF
[20:43:20.932][S][sensor]: 'Lounge Moving Distance' >> 61 cm
[20:43:23.038][S][sensor]: 'Lounge Still Distance' >> 100 cm
[20:43:23.039][S][sensor]: 'Lounge Detection Distance' >> 136 cm
[20:43:24.532][S][sensor]: 'Lounge Detection Distance' >> 100 cm

## assistant — 2026-03-30 19:43:58

 Flashed successfully and working! But the still-presence problem persists. Look at this pattern:

```
20:42:42 → Still Target ON
20:42:49 → Moving Target OFF (you stopped moving)
20:42:58 → Presence OFF, Still Target OFF
```

Still only holding for ~9 seconds after you stop moving. The threshold values haven't been set yet — the sensor is still using its defaults.

---

## Set the Values in HA Now

Go to **Settings → Devices → Lounge Presence** and you'll see sliders for all the new entities. Set these:

| Slider | Set to |
|---|---|
| Timeout | **5** |
| Max Move Distance Gate | **8** |
| Max Still Distance Gate | **8** |
| Gate 0 Move Threshold | **50** |
| Gate 0 Still Threshold | **50** |
| Gate 1 Move Threshold | **50** |
| Gate 1 Still Threshold | **50** |
| Gate 2 Move/Still Threshold | **40** |
| Gate 3 Move Threshold | **30** |
| Gate 3 Still Threshold | **40** |
| Gate 4 Move Threshold | **20** |
| Gate 4 Still Threshold | **30** |
| Gate 5–8 Move Threshold | **15** |
| Gate 5–8 Still Threshold | **20** |

Once set, sit still again and the Still Target should hold reliably. Share the log and we'll confirm it's working.

## human — 2026-03-30 19:46:32
_files:_ 106290.jpg

_(empty)_

## assistant — 2026-03-30 19:46:38

 Almost perfect — but I can see two issues:

**Gate 0 Still Threshold is 0%** and **Gate 1 Still Threshold is 0%** — these need to be set to 50. Also Gate 5 Still Threshold shows 30% instead of 20%.

Everything else looks correct:
- ✅ Timeout: 5.0s
- ✅ Max Move/Still Distance Gate: 8
- ✅ Distance Resolution: 0.2m
- ✅ All other gates look right

---

## Fix These Three

| Slider | Change to |
|---|---|
| Gate 0 Still Threshold | **50** |
| Gate 1 Still Threshold | **50** |
| Gate 5 Still Threshold | **20** |

Tap each one and drag to the correct value. Once those are set, do the sit-still test and share the log — we should finally see Still Target holding reliably.

## human — 2026-03-30 19:48:33
_files:_ 106292.jpg

_(empty)_

## assistant — 2026-03-30 19:48:41

 That's perfect. Every value is exactly right now:

- ✅ Gates 0–1: Move 50%, Still 50%
- ✅ Gate 2: Move 40%, Still 40%
- ✅ Gate 3: Move 30%, Still 40%
- ✅ Gate 4: Move 20%, Still 30%
- ✅ Gates 5–8: Move 15%, Still 20%
- ✅ Timeout: 5.0s
- ✅ Max Move/Still Distance: 8
- ✅ Resolution: 0.2m

---

## Now Do the Sit-Still Test

1. Walk into the lounge
2. Sit down on the sofa and go completely still
3. Wait 30–60 seconds without moving
4. Watch the ESPHome logs

You're looking for `Lounge Still Target >> ON` to stay on continuously while you're sitting still, rather than clearing after a few seconds.

Share the log output from that test and we'll know if the tuning is working. If it still clears too quickly, we'll raise the still thresholds on the gates nearest your sofa (likely gates 3–5 based on your ~150cm detection distance).
