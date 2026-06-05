# RuView WiFi Sensing — Setup Guide

**Created:** 2026-06-05
**Source:** https://github.com/ruvnet/RuView (MIT license)
**Goal:** Turn ESP32-S3 boards + Home Assistant into a contactless WiFi sensing system (presence, breathing, heart rate, falls, sleep) — no cameras, no wearables.

> My hardware: **ESP32-S3** ✅ (supported), Home Assistant ✅.

---

## What it does

Uses WiFi Channel State Information (CSI) from ESP32-S3 boards to detect, through walls:
- **Presence / occupancy / person count**
- **Vital signs** — breathing rate (6–30 BPM), heart rate (40–120 BPM)
- **Falls**, motion level, sleep quality
- **Semantic states** published to HA: someone-sleeping, possible-distress, room-active, fall-risk-elevated, bed-exit, bathroom-occupied, elderly-inactivity-anomaly, etc.

Ships **17–21 HA entities per node** via MQTT auto-discovery.

---

## Hardware requirements

| Item | Spec | Notes |
|---|---|---|
| SoC | **ESP32-S3** | 8 MB flash + 8 MB PSRAM required |
| USB driver | Silicon Labs **CP210x** | Install on PC: https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers |
| Recommended boards | ESP32-S3-DevKitC-1, XIAO ESP32-S3 | Any ESP32-S3 w/ 8 MB flash |
| Coverage | 1 node = line-of-sight presence + vitals | **3–6 nodes per room** = full 3D mesh |

> ⚠️ Classic ESP32 / ESP32-C3 are **NOT** supported for CSI by this firmware. Only S3 (production) and C6 (research).

---

## HA prerequisites (one-time)

- [ ] Home Assistant **2025.5+**
- [ ] **Mosquitto** broker add-on installed + running (Add-on Store → one click)
- [ ] **MQTT integration** enabled, pointed at the broker
- [ ] An MQTT username/password created (used below as `homeassistant` / `MQTT_PASSWORD`)

---

## Step 1 — Flash the ESP32-S3 (do this on a PC with USB)

Prebuilt binaries (firmware **v0.6.7**) are in `firmware/esp32-csi-node/release_bins/` — no build needed.

1. Install esptool on the PC: `pip install "esptool>=5.0" nvs-partition-gen`
2. Plug the board in via USB, note the port (Windows e.g. `COM7`, Linux `/dev/ttyUSB0`).
3. Flash (8 MB board offsets):

```bash
python -m esptool --chip esp32s3 --port COM7 --baud 460800 \
  write_flash --flash_mode dio --flash_size 8MB \
  0x0     release_bins/bootloader.bin \
  0x8000  release_bins/partition-table.bin \
  0xf000  release_bins/ota_data_initial.bin \
  0x20000 release_bins/esp32-csi-node.bin
```
(For a 4 MB board use `esp32-csi-node-4mb.bin` + `partition-table-4mb.bin` and `--flash_size 4MB`.)

## Step 2 — Provision WiFi + where to send data (no reflash)

`--target-ip` = the LAN IP of the machine that will run the publisher (Step 3).

```bash
python firmware/esp32-csi-node/provision.py --port COM7 \
  --ssid "YourSSID" --password "YourPass" --target-ip 192.168.1.20
```
> First time on a recycled board, add `--reset`. State is stored per-PC, so re-provisioning from a different machine needs all flags again.

## Step 3 — Run the publisher → feeds Home Assistant

Run on any machine on the LAN (ideally the HA host). Docker is easiest:

```bash
docker run --rm --net=host \
  ruvnet/wifi-densepose:0.7.0 \
  --source esp32 --mqtt \
  --mqtt-host <YOUR_HA_IP> \
  --mqtt-username homeassistant \
  --mqtt-password-env MQTT_PASSWORD
```
Set `MQTT_PASSWORD` in the environment first.

## Step 4 — Verify in HA

- Within ~5 s: **Settings → Devices** shows a new device per node with 17–21 entities.
- Nothing shows up? Check Mosquitto is running, MQTT creds match, and the board's `--target-ip` points at the publisher host.

---

## Optional / advanced

- **Privacy mode:** add `--privacy-mode` to the publisher to strip biometric entities (heart rate, breathing, pose) from MQTT/Matter.
- **Matter bridge:** exposes to Apple Home / Google Home / Alexa / SmartThings without HA (see repo `docs/adr/ADR-122`).
- **Local UI / dev:** `cargo run -p wifi-densepose-sensing-server -- --http-port 3000 --source auto` then open http://localhost:3000
- **WASM sensing modules:** hot-loadable on the node over HTTP (port 8032), no reflash.

---

## Reality check / open questions

- This is **edge hardware + DSP**, not plug-and-play. Expect tuning. Calibration is ~30–60 s of "ambient learning" per node.
- Accuracy: v2 encoder reports **82.3% held-out** temporal-triplet accuracy (the old "100% presence" claim was retracted). Treat vitals as *trend indicators*, not medical-grade.
- A single node is line-of-sight only; meaningful room coverage wants 3–6 nodes.
- Firmware flashing + provisioning need a **PC** (can't be done from phone).

---

## My deployment plan (6× ESP32-S3 mini)

### Hardware — CONFIRMED via esptool flash_id (COM20)
- Real chip: **ESP32-S3 (QFN56) rev v0.2**, `MAC 20:6e:f1:b1:05:c8`. Verbatim features:
  **Embedded Flash 4 MB (XMC) + Embedded PSRAM 2 MB (AP_3v3)**, dual-core 240 MHz, USB-Serial/JTAG.
- ⚠️ ESPHome Builder's "8 MB DevKitM-1" was just the **selected board profile, not the real silicon** — esptool confirms **4 MB flash / 2 MB PSRAM** (≈ ESP32-S3FH4R2). Trust `flash_id`, not the builder.
- ✅ Use the **4 MB firmware**: `release_bins/esp32-csi-node-4mb.bin` + `partition-table-4mb.bin` + `bootloader.bin` + `ota_data_initial.bin`, `--flash_size 4MB`.
- ✅ **PSRAM confirmed: 2 MB** — above RuView's ~640 KB WASM-arena need. Below the 8 MB "spec" but fine for core CSI/presence/breathing/HR/fall. **No PSRAM blocker.**
- These boards are **dedicated RuView nodes** — do NOT set up in ESPHome Device Builder / click Install; RuView CSI firmware replaces ESPHome.
- ⚠️ **Port lock:** only one app can hold COM20. Fully close the web.esphome.io / esptool-js browser tab before running esptool, or you get `Access is denied (PermissionError)`.

### Strategy: reuse existing presence, add vitals + falls
Lounge automations and the bedroom LD2410C already handle **presence**. RuView's job is the *extra* layer — **breathing/HR, sleep, fall** — which are single-zone (a bed, a sofa, the stair-top) and work on 1–2 nodes. Presence is NOT the goal.

### Allocation (6 nodes)
| Zone | Nodes | Purpose | Notes |
|---|---|---|---|
| **Lounge** | **2** | Multi-person presence + activity (bistatic line) | 2-node bistatic; loses full 3-node pose triangulation, fine for activity in a big RF-busy room |
| **My bed** | **1** | Breathing/HR + sleep tracking | Single node aimed at bed = textbook vitals setup ✅ |
| **Kids bed** | **1** | Breathing/HR + sleep (kid safety layer) | Same — line-of-sight to the bed |
| **Landing** | **2** | Fall detection on stairs | Bistatic pair (node each side of stair-top, facing each other) — far more reliable than 1 node for the safety-relevant fall signal ✅ |

### Node placement
- **Lounge (2):** opposite sides of the main sitting area, facing each other (bistatic line through the room).
- **Beds (1 each):** mount on the headboard wall or a nightstand, line-of-sight across the sleeper's torso.
- **Landing (2):** one each side of the top-of-stairs, facing each other across the fall zone.
- All mains-powered via USB — CSI streams continuously ~20 Hz.

### Networking
- 6 **unique static IPs**, e.g. `192.168.0.181–.186`.
  - ⚠️ Avoid `192.168.0.171` — known conflict (bedroom vs upstairs in notes).
- One **publisher** handles all nodes; map MAC → friendly room name in the zones config (Lounge ×2, My Bed, Kids Bed, Landing ×2).
- `--target-ip` (set at provisioning) = the publisher host (HA Green or a LAN PC running Docker).
- Consider `--privacy-mode` on the **kids bed** publisher path if you don't want biometrics exposed over MQTT/Matter.

### Flashing (verified from RuView repo — run at PC over USB-C)
**Get the files:** bins are in the repo tree (not release assets). Download whole repo ZIP
`https://github.com/ruvnet/RuView/archive/refs/heads/main.zip` → extract → bins +`provision.py`
under `RuView-main\firmware\esp32-csi-node\`. (Direct raw files also work:
`github.com/ruvnet/RuView/raw/main/firmware/esp32-csi-node/release_bins/<file>`.)
Bins live in `firmware/esp32-csi-node/release_bins/`. **4-file flash, no merged bin.** App at `0x20000` (OTA layout). Confirmed **4 MB** chip → use the **4 MB** bins. Board = **COM20** (esptool v5 works; `flash_id` is now `flash-id`). Close any browser serial tab first.
```bash
# 1. Identify (confirms S3 + 4 MB)
python -m esptool --port COM20 flash-id
# 2. Erase
python -m esptool --chip esp32s3 --port COM20 erase-flash
# 3. Flash (4 MB)
python -m esptool --chip esp32s3 --port COM20 --baud 460800 \
  write-flash --flash-mode dio --flash-size 4MB \
  0x0     bootloader.bin \
  0x8000  partition-table-4mb.bin \
  0xf000  ota_data_initial.bin \
  0x20000 esp32-csi-node-4mb.bin
# 4. Provision WiFi + publisher IP (no reflash)
python provision.py --port COM20 --ssid "SSID" --password "PASS" --target-ip 192.168.0.200
```
- esptool v5 prints a deprecation note for the old underscore commands (`flash_id`, `write_flash`); both still work, hyphen form is current.
- `--target-ip` = **publisher host**. HA is at **192.168.0.200** (seen in browser) — use that if the RuView publisher/MQTT runs on the HA box; NOT the node's own static IP.
- Node static IPs (`.181–.186`) are set separately; avoid `.171`.
- COM port changes per board/cable — re-run `flash_id` to confirm for each node.

### Bring-up order
1. Flash + provision **one** node (4 MB firmware) → confirm it appears in HA via MQTT.
2. Validate breathing/HR lying still (~30–60 s calibration).
3. Roll out the rest: **my bed → kids bed → landing ×2 → lounge ×2**, unique IP each.
4. Wire automations (below).

### First HA automations to wire
- **Beds:** `someone_sleeping` → night scene / lights-off confirm; `breathing_rate`/`heart_rate` → log for sleep trends; `bed_exit` + night window → gentle pathway light.
- **Landing:** `fall` → critical alert + stairs light (paste-ready YAML below).
- **Lounge:** `room_active` / `person_count` → enrich existing presence automations (occupancy-aware media/lighting).

### Automations (paste-ready)

**Landing — fall detected → critical alert + stairs light.** Matches existing new-style convention
(`triggers/conditions/actions`) and `notify.mobile_app_jelly_bean_s_phone`.
```yaml
# Landing fall detection (RuView) — critical alert + stairs light
- id: landing_fall_detected
  alias: Landing - Fall Detected
  triggers:
    - trigger: state
      entity_id: binary_sensor.landing_fall   # confirm exact id after MQTT discovery
      to: "on"
  conditions: []
  actions:
    - action: light.turn_on
      target:
        entity_id: light.stairs_smart_bulb
    - action: notify.mobile_app_jelly_bean_s_phone
      data:
        title: "🚨 FALL DETECTED — Landing"
        message: "Possible fall on the landing/stairs. Check now."
        data:           # cross-platform critical alert (bypasses silent + DND)
          push:         # iOS keys (Android ignores these)
            sound:
              name: default
              critical: 1
              volume: 1.0
          ttl: 0        # Android keys (iOS ignores these)
          priority: high
          channel: alarm_stream
  mode: single
```
- **Entity id is provisional** — `binary_sensor.landing_fall` is the expected name; RuView generates
  the real id from the publisher's zone/room config. Confirm in HA → Developer Tools → States and
  update `entity_id` if it differs.
- **Optional debounce:** add `for: "00:00:02"` under the trigger if tuning shows brief false `fall` blips.

**Test it:** Developer Tools → States, set `binary_sensor.landing_fall` to `on` (or use the
automation's *Run*) → confirm the critical push lands (bypassing silent) and `light.stairs_smart_bulb`
turns on.

**My bed — sleep + night bed-exit.** Vitals sensors (`sensor.my_bed_breathing_rate`,
`sensor.my_bed_heart_rate`) auto-log to HA Recorder/history — no automation needed; just chart them
for sleep trends.
```yaml
# My bed — asleep → confirm bedroom lights off (pairs with existing 23:59 off)
- id: my_bed_sleeping_lights_off
  alias: My Bed - Asleep, Lights Off
  triggers:
    - trigger: state
      entity_id: binary_sensor.my_bed_sleeping   # confirm id after MQTT discovery
      to: "on"
      for: "00:02:00"                             # asleep ≥2 min before acting
  conditions:
    - condition: time
      after: "21:30:00"
      before: "06:00:00"
  actions:
    - action: light.turn_off
      target:
        entity_id:
          - light.left_smart_bulb
          - light.right_smart_bulb
  mode: single

# My bed — bed exit at night → gentle pathway light, auto-off after 3 min
- id: my_bed_exit_pathway
  alias: My Bed - Night Bed-Exit Pathway Light
  triggers:
    - trigger: state
      entity_id: binary_sensor.my_bed_bed_exit    # confirm id after MQTT discovery
      to: "on"
  conditions:
    - condition: time
      after: "22:00:00"
      before: "06:30:00"
  actions:
    - action: light.turn_on
      target:
        entity_id: light.stairs_smart_bulb
      data:
        brightness_pct: 15
    - delay: "00:03:00"
    - action: light.turn_off
      target:
        entity_id: light.stairs_smart_bulb
  mode: restart   # re-trigger resets the 3-min timer
```

**Kids bed — distress heads-up.** Standard alert (upgrade to the critical `push` block from the
landing automation if you want it to bypass silent). Vitals also auto-log.
```yaml
# Kids bed — possible distress → notify parent phone
- id: kids_bed_distress_alert
  alias: Kids Bed - Possible Distress
  triggers:
    - trigger: state
      entity_id: binary_sensor.kids_bed_possible_distress   # confirm id after MQTT discovery
      to: "on"
  conditions: []
  actions:
    - action: notify.mobile_app_jelly_bean_s_phone
      data:
        title: "⚠️ Kids Bed — Possible Distress"
        message: "RuView flagged possible distress at the kids' bed. Check on them."
  mode: single
```
- All `binary_sensor.my_bed_*` / `binary_sensor.kids_bed_*` ids are **provisional** — RuView mints
  them from each node's zone name; confirm in Developer Tools → States and adjust.
- `light.left_smart_bulb` / `light.right_smart_bulb` are assumed to be the master-bedroom pair; swap
  if the bed sits in a different room. Kids' room light entity unknown — add a `light.turn_off` there
  if you want the same sleep behaviour for them.

### Go-live checklist — drafts → all 4 firing
The YAML is correct, but automations can't fire until the RuView entities exist in HA. Path:
1. **Flash + provision** the nodes (PC, COM19) — at minimum the landing pair + both beds.
2. **MQTT prerequisites:** Mosquitto add-on running + MQTT integration enabled; run the publisher with
   `--mqtt --mqtt-host <HA_IP> ...`. Entities appear via auto-discovery (~17–21/node).
3. **Confirm real entity ids** in HA → Developer Tools → States (search `landing`, `my_bed`, `kids`).
   Patch the `entity_id:` lines if they differ from the provisional names. *This is the #1 reason an
   automation silently won't fire.*
4. **Paste** the YAML (Settings → Automations → ⋮ → Edit in YAML, or `automations.yaml`) → reload automations.
5. **Test each** with Developer Tools → States (force the trigger sensor `on`) or the automation's *Run*:
   - Landing fall → critical push lands (bypasses silent) + stairs light on.
   - My bed asleep (night) → bedroom bulbs off.
   - My bed exit (night) → stairs light @15%, off after 3 min.
   - Kids distress → phone notification.
6. **Tune:** watch a day for false positives; add the `for:` debounce if a sensor flaps.

### Open questions / TODO
- [ ] Verify S3 flash size on a board (`flash_id`).
- [ ] Confirm 4 MB firmware streams CSI (test node #1 first).
- [ ] Decide publisher host: HA Green (add-on/Docker) vs separate LAN PC.
- [ ] Resolve `.171` IP conflict before assigning `.181–.186`.
- [ ] Tune landing bistatic pair facing-geometry for fall detection coverage.
- [ ] 3× ESP32-C3 (separate boards, if still on hand) → ESPHome BLE proxies for the upstairs contention TODO.

---

## Reference
- Repo: https://github.com/ruvnet/RuView
- HA integration doc: `docs/integrations/home-assistant.md`
- Firmware doc: `firmware/esp32-csi-node/README.md`
- Pretrained model: https://huggingface.co/ruvnet/wifi-densepose-pretrained
