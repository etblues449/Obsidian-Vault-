# Full Home Diagnosis — 2026-08-04

**Scope:** the AI-Mode camera transcript (root-caused), plus a complete diagnosis of the
Home Assistant app and everything in it — dashboards, automations, scenes, scripts,
companion app, people, areas, voice, entities, integrations, updates, cameras, resilience.
**Evidence base:** ha-doctor run 2026-08-02 (Nabu Casa), dashboard audit 2026-08-01,
session evidence 2026-08-01/02, vendor BSP + vendor Arduino example cloned and read
**today**, and two machine verifications performed today (Arduino compile, ESPHome full-config
validation). Nothing below is guessed; anything unverifiable from here is marked **LAN-ONLY**.

---

## Part 1 — The camera transcript, debugged for good

### Verdict in one line

`0x106 (ESP_ERR_NOT_SUPPORTED)` on this board is a **power problem, not a pin problem** —
the OV3660 is held off by the CH32V003 I/O expander (I²C 0x24) until **EXIO3 is driven
LOW**, and the stock Arduino `CameraWebServer` sketch contains no code that talks to the
expander. Google AI Mode kept treating it as a pin problem, so every "fix" was doomed
before upload.

### The four-layer failure chain in the transcript

| # | Layer | What the transcript did | Why it failed |
|---|---|---|---|
| 1 | Camera model define | `CAMERA_MODEL_ESP32S3_CAM_OV5640`, then `ESP_EYE`, then deleted the model system | Wrong sensor, wrong board; stock `ESP_EYE` pins are for Espressif's ESP-EYE, not this board |
| 2 | Pin maps | Pasted 3 custom pinouts (XCLK 40… = ESP32S3_CAM_LCD; XCLK 15… = ESP32S3_EYE-ish with shuffled Y2–Y5) | All three belong to *different* boards. Real map: **XCLK 38 · SIOD 8 · SIOC 7 · VSYNC 17 · HREF 18 · PCLK 41 · D0–D7 = 45,47,48,46,42,40,39,21** |
| 3 | **Camera power (the actual bug)** | Never mentioned | PWDN is **EXIO3 on the CH32V003 expander, active-high, not an ESP32 GPIO**. Sensor ACKs at 0x3C but returns garbage PID until EXIO3 is LOW → `0x106` forever |
| 4 | IDE settings | Mostly fine | Only refinement: PSRAM must be **OPI PSRAM** (octal), not generic "Enabled" |

### New evidence found today (beyond the 2026-08-01 corrected guide)

1. **Waveshare ships its own Arduino solution** — `waveshareteam/ESP32-S3-CAM-OVxxxx` →
   `examples/Arduino-v3.2.0/examples/02_CameraWebServer` (Apache-2.0). It bundles a
   modified `camera_pins.h` in which the **`CAMERA_MODEL_ESP_EYE` slot carries the real
   Waveshare pins**, plus an `io_extension` driver whose init drives all EXIO outputs LOW
   (camera on) and lights the power LED (EXIO6 HIGH). This explains a trap: with the
   *vendor's* files, "ESP_EYE" is correct; with the *stock* Espressif files, it's wrong —
   same define, different pins. Nobody in the transcript could have known.
2. **Pin map re-verified against two vendor sources today** (BSP header
   `bsp/esp32_s3_cam_ovxxxx.h` lines 113–124, and the vendor example) — matches the
   vault's map, zero mismatches. Expander register map re-confirmed too
   (0x02 mode / 0x03 out / 0x04 in / 0x05 PWM / 0x06 ADC).
3. **The corrected sketch now exists and compiles** — delivered as
   `WS_S3_CAM_OV3660_WebServer.zip`, built clean on esp32 core 3.3.11:
   `1,026,695 bytes (32%)` of the 3 MB app partition. (Telling detail: the transcript's
   own upload was 1,018,464 bytes — same example family, it only ever lacked the two
   fixes.) The vault's Arduino path is no longer "logically correct but untested" — it is
   compile-verified; only on-hardware flashing remains, which needs the physical board.

### Which board did the transcript brick?

`ai_cam` (.199) was confirmed live on ESPHome firmware on 2026-08-02, while
`landing_ai_cam_2` — the already-provisioned 2nd CAM-OV3660 — shows **unavailable** in
the registry. The transcript's upload *succeeded* onto some CAM-OV3660. **Most likely:
the Arduino experiments overwrote the 2nd board's ESPHome firmware**, which is exactly
why it dropped off HA. (Hypothesis, not verified — confirm by checking which physical
board answers on which MAC: ai_cam live MAC is `28:84:85:49:83:C8`; the handoff's
`…:86:70` is presumably the other board.)

**Consequence:** flashing [[../hardware/landing_ai_cam_2]] onto that board fixes both
problems at once — camera working *and* the satellite back in HA. First flash must be
**USB / web.esphome.io** (Arduino firmware has no ESPHome OTA); after that, OTA works.

### A real gap found and fixed in the Option B runbook

The off-box compile path assumed `pip install esphome` gives you what the Green's add-on
has. Verified today: **PyPI tops out at 2026.6.5, which does NOT ship
`waveshare_io_ch32v003`** (the Green's 2026.7.1 add-on does — different release channel).
An off-box `esphome run ai_cam.yaml` on the PC would have failed at exactly the step the
runbook calls trivial. Fix (already inside the delivered `landing_ai_cam_2.yaml`, and to
apply to `ai_cam.yaml` for Option B): pin the official component by release tag —

```yaml
external_components:
  # …existing entries…
  - source:
      type: git
      url: https://github.com/esphome/esphome
      ref: 2026.7.1
      path: esphome/components
    components: [waveshare_io_ch32v003]
```

With that in place, the delivered config **passes full `esphome config` validation
(exit 0)** on a clean PyPI install. (The only failures seen during validation were this
sandbox's 403 on the wake-word model downloads — the vault's own law applies: never
record a 403 as a missing file. On the PC those URLs resolve.)

---

## Part 2 — Home Assistant: the full diagnosis

Hub: HA Green @ 192.168.0.200 · Core **2026.8.0b2 (beta!)** · OS 18.2.rc1 · 234
integrations · config valid · RUNNING. Diagnosed remotely via Nabu Casa; **LAN-ONLY**
items listed at the end.

### 2.1 Entities — the 30% problem

**520 entities, 156 unavailable (30%), 24 unknown.** The graveyard clusters into causes,
and most of them are *node revivals*, not registry surgery:

| Cluster | Entities (≈) | Root cause | Fix |
|---|---|---|---|
| espspeaker (Living Room ESP Speaker) | ~24 | node offline | revive/reflash (reconcile `timeout: never` + `force_master` with the I²S-mutex law first) |
| Voice PE (`home_assistant_voice_09eabd`) | ~8 | offline | power/reflash; decide its room (labelled both "Bedside" and "Lounge") |
| `landing_ai_cam_2` | ~8 | offline — likely carrying Arduino experiment firmware | flash [[../hardware/landing_ai_cam_2]] (USB first time) |
| RuView CSI node 3 + bedroom CSI ghosts | ~14 | node .227 down or renamed entities | LAN probe; DHCP-reserve MAC `e0:72:a1:e7:03:60` → .227 |
| Govee music-mode/scene/refresh remnants + smart bulbs | ~40 | six bulbs offline/unpowered or integration half-dead | power-check bulbs; if Govee LAN/cloud broke, reload integration |
| GitHub repo sensors (`etblues449_*`) | ~28 | GitHub integration entities stale (rate-limit or repo settings) | reload GitHub integration or prune to the repos you actually watch |
| Dead media duplicates (`eshare_5726`×5, `soundbar_2`, `jelly_bean_s_tv`, `sambed`, `home_group`, `living_room_speaker`) | ~15 | removed/renamed devices left behind | **delete from registry** after node revivals (eshare dupes are pure clutter) |

**Order matters:** revive nodes first, then delete what's still dead — otherwise you
delete entities that were merely asleep.

### 2.2 Automations — the "19" that are actually 8

Live registry: **8 automations** (the long-believed "~19 lounge automations" does not
match; the belief predates the registry evidence). Health:

- 3 stale since May: `bedroom_enter`, `bedroom_empty`, `landing_someone_enters` —
  all consistent with their trigger nodes (.171 bedroom presence, landing radar) being
  dead. Revive the nodes and these come back for free.
- 1 never fired: `landing_room_empty_light_off` — same dependency.
- **Zero automations reference the AI Cam** (person detection, wake word, snapshots —
  nothing). The most capable node does nothing automatic yet. Quick wins once satellites
  are up: person-at-porch notification, lounge-occupancy via camera person count,
  snapshot-on-event.
- The hub's `automations.yaml` **still isn't backed up in the vault** — top resilience
  risk (see 2.9).

### 2.3 Scenes & scripts

1 scene, no dead members; 0 scripts. Nothing broken — but for a house this instrumented,
scenes are underused: no scene for movie night / bedtime / away. Once areas are clean
(2.6), presence-driven scenes per room are the cheapest "feels magic" layer.

### 2.4 Dashboards

- **Canonical file:** `dashboard/jellybean-dashboard-v2-corrected.yaml` (README marks it).
  TV refs fixed to `media_player.jelly_beans_tv_3` (2026-08-02 decision).
- **A newer 3-view dashboard (`ui-lovelace-minimal.yaml`) exists ONLY on the hub** —
  built 2026-08-01, never committed to the vault. Either commit + deploy it as the new
  canonical, or archive it. Two "canonicals" is how the TV-entity drift happened.
- Gaps carried from the 2026-08-01 audit: `cctv_cam` has no card; RuView's 6 MQTT
  entities appear on no vault dashboard; bedroom node health card removed while
  `binary_sensor.bedroom_presence` is load-bearing in 8+ places; `.216` audio board and
  the hub itself unrepresented.
- 8 HACS deps required (mushroom, bubble-card, decluttering-card, card-mod,
  advanced-camera-card, auto-entities, apexcharts ≥2.2.0, browser_mod v2) — mushroom and
  browser_mod have pending updates (2.8).

### 2.5 Voice / Assist — 1 of 4 satellites alive

| Satellite | State | Blocker |
|---|---|---|
| ai_cam (Living Room) | **online** — Assist works, Claude agent responds | wake word regressed: current build has no `micro_wake_word` (the full config OOMs the Green's compiler — cc1plus killed). Push-button voice only. **Fix = Option B off-box compile** (runbook, now patched per Part 1) or the budgeted N100 |
| landing_ai_cam_2 | offline | likely Arduino-experiment firmware — flash delivered YAML |
| espspeaker | offline | revive + reconcile config with I²S-mutex law |
| Voice PE `09eabd` | offline | power/reflash + decide room |

Assist targeting: "Dinning Room" typo **fixed live** 2026-08-02; remaining
`no_valid_targets` causes are the 10 area-less actionables (2.6) and unexposed aliases.
Pipeline: "Home Assistant Cloud 2", finished-speaking = Aggressive; a Claude conversation
agent is active in the loop.

### 2.6 Areas — 6 rooms, 10 orphans

Living Room 142 · Kitchen 76 · Bedroom 50 · Landing 19 · Dining Room 12 · **Porch 0
entities (1 device)**. Ten actionable entities have **no area**, which is precisely what
breaks area-based voice commands:

`light.haribo_room` + `switch.haribo_room_music_mode` (→ create/assign the kids-room
area), `media_player.home_group`, `media_player.jelly_bean_s_soundbar_2` (likely a dead
dupe — check against the live soundbar), `media_player.jessa_voice_assistant`, and the
5 × `eshare_5726*` dupes (delete rather than assign).

### 2.7 People & companion app

Healthy corner of the system: `person.elliot_horton` home via `device_tracker.jelly_bean_s_phone`;
2 trackers, none stale; companion app exposing 14 entities. Two battery sensors reported
8–15% at diagnosis time — if `jb_s_phone` and `jelly_bean_s_phone` are the *same* Fold 7
registered twice, prune the stale registration so presence never flaps.

### 2.8 Updates & risk posture

4 pending: Core 2026.8.0b2→b3, OS 18.2.rc1→18.2, browser_mod v3.1.0→v3.2.0, mushroom
v5.1.1→v5.2.2. **Beta core + RC OS on the production hub.** Advice: batch all four
*after* the satellite revivals (change one variable at a time), and move back to the
stable channel at 2026.8.0 release unless chasing a specific beta fix.

### 2.9 Resilience — the single biggest risk in the whole estate

**The hub's config exists nowhere but the hub.** `automations.yaml`, `bedroom-2.yaml`,
`frigate.yaml`, scenes, scripts, the flashed `ai_cam` tuning config, and
`ui-lovelace-minimal.yaml` all live only on the Green. One SD/eMMC failure erases the
lot. On the list since 2026-08-01; it outranks every feature above. 15 minutes:
Studio Code Server → copy the six files into
`Claude Memory/Projects/Smart Home/ha-config/` → commit. (Also enable a scheduled full
HA backup off-hub — Nabu Casa cloud backup or a Samba share to the PC.)

### 2.10 LAN-ONLY items (can't be verified remotely — 10 min on the Fold/PC)

1. Re-run ha-doctor **on the LAN**: direct node probes (.199/.206/.216/.227/.234/.240)
   + `/api/error_log` (needs admin token; Nabu Casa denied it).
2. Physical power check: cctv_cam (.234, XIAO) and porch (.240) — suspected
   hardware-down, not config.
3. Which physical CAM board carries which MAC (`…:83:C8` = live ai_cam; `…:86:70` = ?).

---

## Part 3 — Ranked repair queue

**P0 — protect what exists (this week, ~30 min)**
1. Back up hub-side config into the vault (2.9). Everything else is recoverable; this isn't.
2. Commit `ui-lovelace-minimal.yaml` to the vault; declare the canonical dashboard.

**P1 — revive the fleet (one evening)**
3. Option B compile for ai_cam → "Hey Jarvis" back (runbook + PyPI-gap fix from Part 1).
4. Flash `landing_ai_cam_2.yaml` onto board #2 via USB → landing satellite + camera live.
5. Power-check/reflash: espspeaker, Voice PE, bedroom .171, cctv .234, porch .240,
   porch-servo .206. Re-run ha-doctor on the LAN afterwards and diff.

**P2 — make voice resolve everywhere (an hour)**
6. Assign the 10 area-less actionables; create the kids-room area; delete the eshare
   dupes and dead media players after revivals.
7. Expose aliases in Settings → Voice assistants; decide Voice PE's room.

**P3 — compound the wins**
8. First AI-Cam automations (person-detection notify → Fold 7; presence scenes per room).
9. Batch the 4 updates; consider leaving the beta channel.
10. Registry cleanup of whatever is still unavailable after the revivals.

*Delivered alongside: `WS_S3_CAM_OV3660_WebServer.zip` (compile-verified Arduino fix),
[[../hardware/landing_ai_cam_2]] (validated ESPHome config for board #2), and
[[../MASTER_PLAN]] v2 (the whole-home roadmap this diagnosis feeds).*
