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

### Hardware
- On-hand: **6× ESP32-S3 mini** (all RuView-capable — S3). Photo-confirmed ESP32-S3-Zero form factor; genuine Waveshare = **ESP32-S3FH4R2: 4 MB flash + 2 MB PSRAM**.
- Use the **4 MB firmware**: `release_bins/esp32-csi-node-4mb.bin` + `partition-table-4mb.bin`, `--flash_size 4MB`.
- 2 MB PSRAM is below the 8 MB spec but WASM arenas only need ~640 KB; core sensing (CSI, presence, breathing, HR, fall) unaffected.
- [ ] **Definitive check** — `python -m esptool --port COM7 flash_id` confirms chip + flash size (clones vary).
- All 6 become **dedicated RuView nodes** (CSI firmware replaces ESPHome — keep separate from ESPHome radar/BLE boards).

### Strategy: reuse existing presence, add vitals + falls
Lounge automations and the bedroom LD2410C already handle **presence**. RuView's job is the *extra* layer — **breathing/HR, sleep, fall** — which are single-zone (a bed, a sofa, the stair-top) and work on 1–2 nodes. Presence is NOT the goal.

### Allocation (6 nodes)
| Zone | Nodes | Purpose | Notes |
|---|---|---|---|
| **Lounge** | **3** | Multi-person tracking + activity/pose (full mesh) | Big/RF-busy room → expect tuning; whole-room pose is best-effort |
| **My bed** | **1** | Breathing/HR + sleep tracking | Single node aimed at bed = textbook vitals setup ✅ |
| **Kids bed** | **1** | Breathing/HR + sleep (kid safety layer) | Same — line-of-sight to the bed |
| **Landing** | **1** | Fall detection on stairs | ⚠️ Weakest link — 1 node = line-of-sight only; not safety-critical. Upgrade to 2 (steal from lounge) if it misses |

### Node placement
- **Lounge (3):** spread around the main sitting area at different angles (e.g. behind TV + two opposite corners) for multistatic coverage.
- **Beds (1 each):** mount on the headboard wall or a nightstand, line-of-sight across the sleeper's torso.
- **Landing (1):** aim at the top-of-stairs / walkway zone.
- All mains-powered via USB — CSI streams continuously ~20 Hz.

### Networking
- 6 **unique static IPs**, e.g. `192.168.0.181–.186`.
  - ⚠️ Avoid `192.168.0.171` — known conflict (bedroom vs upstairs in notes).
- One **publisher** handles all nodes; map MAC → friendly room name in the zones config so HA devices are named "Lounge / My Bed / Kids Bed / Landing".
- `--target-ip` (set at provisioning) = the publisher host (HA Green or a LAN PC running Docker).
- Consider `--privacy-mode` on the **kids bed** publisher path if you don't want biometrics exposed over MQTT/Matter.

### Bring-up order
1. Flash + provision **one** node (4 MB firmware) → confirm it appears in HA via MQTT.
2. Validate breathing/HR lying still (~30–60 s calibration).
3. Roll out the rest: **my bed → kids bed → landing → lounge ×3**, unique IP each.
4. Wire automations (below).

### First HA automations to wire
- **Beds:** `someone_sleeping` → night scene / lights-off confirm; `breathing_rate`/`heart_rate` → log for sleep trends; `bed_exit` + night window → gentle pathway light.
- **Landing:** `fall` / `fall_risk_elevated` → alert notification.
- **Lounge:** `room_active` / `person_count` → enrich existing presence automations (occupancy-aware media/lighting).

### Open questions / TODO
- [ ] Verify S3 flash size on a board (`flash_id`).
- [ ] Confirm 4 MB firmware streams CSI (test node #1 first).
- [ ] Decide publisher host: HA Green (add-on/Docker) vs separate LAN PC.
- [ ] Resolve `.171` IP conflict before assigning `.181–.186`.
- [ ] Validate landing single-node fall reliability; upgrade to 2 if weak.
- [ ] 3× ESP32-C3 (separate boards, if still on hand) → ESPHome BLE proxies for the upstairs contention TODO.

---

## Reference
- Repo: https://github.com/ruvnet/RuView
- HA integration doc: `docs/integrations/home-assistant.md`
- Firmware doc: `firmware/esp32-csi-node/README.md`
- Pretrained model: https://huggingface.co/ruvnet/wifi-densepose-pretrained
