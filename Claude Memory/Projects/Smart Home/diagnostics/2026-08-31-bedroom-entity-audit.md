# Live Registry Audit — 2026-08-31

**Method:** `curl /api/states` from the Fold against `192.168.0.200:8123`, filtered to
`cam|bedroom|light.`. This is **live registry evidence**, not a config reading and not a
screenshot — the strongest ground truth this project has had on entity naming.

**Why it was run:** to settle AI CAM 2's entity IDs before writing an automation. It
settled that, and then turned up four broken automations nobody knew about.

---

## 1. FOUR AUTOMATIONS ARE ENABLED AND CANNOT WORK

All four are `state: on`. Every one of them targets at least one entity that does not
exist or is unavailable. They fail silently — HA shows them as healthy automations.

| Automation | Trigger entity | Target entity |
|---|---|---|
| `automation.bedroom_enter` | `binary_sensor.bedroom_bedroom_presence` — **DOES NOT EXIST** | `light.bedroom_light` — **DOES NOT EXIST** |
| `automation.bedroom_empty` | `binary_sensor.bedroom_bedroom_presence` — **DOES NOT EXIST** | `light.bedroom_light` — **DOES NOT EXIST** |
| `automation.ai_cam_person_detected_living_room_light` | `binary_sensor.ai_cam_person_occupancy` — unavailable | `light.living_room_light` — unavailable |
| `automation.ai_cam_person_cleared_living_room_light_off` | `binary_sensor.ai_cam_person_occupancy` — unavailable | `light.living_room_light` — unavailable |

The bedroom pair is the worse case: those two entity IDs are not merely offline, they are
**absent from the registry entirely**, so the automations cannot ever have fired. They
are in `ha-config/automations.yaml` (the 2026-08-23 export) exactly as written above.

This is the vault's own standing lesson made concrete: *silent failures outrank loud
ones*. A crash gets fixed; two automations sitting at `on`, doing nothing, do not.

## 2. THERE IS NO BEDROOM LIGHT ENTITY

Every `light.*` entity in the registry, with live state:

| Entity | State |
|---|---|
| `light.kitchen_light` | off |
| `light.kitchen_3` | off |
| `light.ai_cam_2_status_led` | off |
| `light.living_room_ai_cam_status_led` | off |
| `light.living_room_light` | **unavailable** |
| `light.kids_bedroom` | **unavailable** |
| `light.haribo_room` | **unavailable** |
| `light.upstairs_led_bulb` | **unavailable** |
| `light.living_room_esp_speaker_status_ring` | **unavailable** |
| `light.home_assistant_voice_09eabd_led_ring` | **unavailable** |

Ten lights, six unavailable, and **none of them is a bedroom light**. Two of the four
that do respond are ESP status LEDs, not room lighting.

Vault documents also reference `light.bedroom`, `light.left_smart_bulb`,
`light.right_smart_bulb`, `light.stairs_smart_bulb`, `light.lounge_lights`,
`light.rgbic_tv_backlight`, `light.kitchen_2` — **none of those exist either.**

**OPEN QUESTION for Elliot — this blocks the bedroom automation:** what is the bedroom
light physically? A bulb removed from HA, a Govee/SmartThings light that is offline, or
never integrated at all?

## 3. BEDROOM PRESENCE IS DOWN

The bedroom mmWave node is offline. `binary_sensor.bedroom_espectre_status` = `off`, and
every one of its ~30 entities (`radar_presence`, `moving_target`, `still_target`,
distances, energies, gate thresholds, uptime, IP, wifi) reads `unavailable`.
`binary_sensor.bedroom_csi_node_3_motion_detected` is `unavailable` too.

So even once a bedroom light exists, there is **no working presence source in that room**.

## 4. AI CAM 2 IS ALIVE — the earlier "offline" call was WRONG

**Correction.** On 2026-08-31 this board was recorded as offline, inferred from an
Entities-list screenshot in which every row showed `—`. That was a misread: the `—` was
not the state column. The board is up and healthy.

| | |
|---|---|
| Uptime | 11822 s (~3 h 17 m) |
| IP | `192.168.0.201` |
| WiFi | −60 dBm, SSID `JB's Smart 2.4G` |
| MAC | `28:84:85:49:86:70` |
| ESPHome | 2026.8.1, config hash `0xf4353173`, built 2026-08-29 05:55 |
| Internal temp | 45.6 °C |
| Reset reason | power-on event |

**The MAC confirms a standing vault hypothesis.** `sessions/2026-07-23-ai-cam-handoff`
predicted board #2 at `…:86:70`; the live registry now shows exactly that, against
`ai_cam_2`. Board #1 (`living_room_ai_cam`) is `28:84:85:49:83:C8` at `.199`. Both
boards are accounted for, both on 2026.8.1. **No USB reflash is needed.**

## 5. ENTITY IDs — the device carries TWO prefixes at once

Neither the ESPHome config (`friendly_name: AI Cam Outside`) nor the HA display name
("AI CAM 2") predicts the IDs. The device was renamed and only *some* entities
re-slugged, so both prefixes are live simultaneously:

**`ai_cam_2_*`** — buttons, switches, most sensors:

| Entity | State |
|---|---|
| `binary_sensor.ai_cam_2_user_button` | off |
| `binary_sensor.ai_cam_2_boot_button` | off |
| `binary_sensor.ai_cam_2_charger_connected` | off |
| `button.ai_cam_2_play_chime` | unknown *(normal for a button)* |
| `button.ai_cam_2_start_voice_assistant` | unknown |
| `button.ai_cam_2_stop_audio` / `_restart` / `_safe_mode_boot` | unknown |
| `light.ai_cam_2_status_led` | off |
| `switch.ai_cam_2_wake_word_enabled` | **on** |
| `media_player.ai_cam_2_ai_cam_outside_speaker` | idle |
| `sensor.ai_cam_2_ai_cam_outside_*` | bssid / heap / mac / psram / ssid / temp / loop / reset |
| `sensor.ai_cam_2_sd_card` | Unavailable |

**`landing_ai_cam_2_*`** — assist stack, network sensors, amp/camera switches:

| Entity | State |
|---|---|
| `assist_satellite.landing_ai_cam_2_assist_satellite` | **idle** |
| `select.landing_ai_cam_2_assistant` / `_assistant_2` | preferred |
| `select.landing_ai_cam_2_finished_speaking_detection` | aggressive |
| `select.landing_ai_cam_2_wake_word` / `_wake_word_2` | **unavailable** |
| `switch.landing_ai_cam_2_amp_enable` | on |
| `switch.landing_ai_cam_2_camera_power_down` | **on** |
| `sensor.landing_ai_cam_2_ai_cam_outside_ip_address` | 192.168.0.201 |
| `update.landing_ai_cam_2_firmware` | off |

The `landing_` prefix is the fossil: this board was provisioned on the Landing, and the
slug survived the move to the Bedroom. That resolves the recorded area conflict — the
vault said Landing because it *was* Landing; HA says Bedroom because it is now.

## 6. TWO MORE DEFECTS THE AUDIT EXPOSED

**a. AI CAM 2's camera is powered down.** `switch.landing_ai_cam_2_camera_power_down` =
`on`. Per the canonical check, EXIO3 HIGH holds the OV3660 off; this switch must be
**off** for the camera to work. Board #1's equivalent is correctly `off`.

**b. Wake word is enabled but has no selectable model, on BOTH boards.**
`switch.ai_cam_2_wake_word_enabled` = `on`, yet
`select.landing_ai_cam_2_wake_word` and `_wake_word_2` are **unavailable** — and
`select.living_room_ai_cam_wake_word` / `_2` are unavailable too. These are the two
red-badged rows in the screenshot. Consistent with the recorded microWakeWord
regression (the full mWW config OOMs the Green's compiler), now confirmed on both boards
from the live registry rather than from a build log.

**c. Frigate appears to be down entirely.** Every Frigate-shaped entity is unavailable:
`camera.ai_cam`, `image.ai_cam_person`, `binary_sensor.ai_cam_person_occupancy`,
`binary_sensor.ai_cam_motion`, `binary_sensor.ai_cam_all_occupancy`,
`sensor.ai_cam_*_count`, `sensor.ai_cam_review_status`, and all six `switch.ai_cam_*`
controls. The ESPHome camera itself is fine (`camera.living_room_ai_cam_ai_cam` = `idle`),
so this is the Frigate add-on or its integration, not the hardware. The index's claim
that AI Cam is "live in Frigate with recording + person detection" is **currently false**.

---

## What this does and does not establish

**Established, from live registry data:** the entity IDs in §5, the four broken
automations in §1, the absence of any bedroom light in §2, the bedroom radar being down
in §3, AI CAM 2 being alive in §4, and the three defects in §6.

**Not established:** *why* `binary_sensor.bedroom_bedroom_presence` and
`light.bedroom_light` are absent — whether they were renamed, removed, or never existed.
The automations referencing them date from before the 2026-08-23 export; nothing in the
vault records their removal.

**Not checked:** anything outside the `cam|bedroom|light.` filter. A full census needs
`ha-doctor.mjs`, which now has a working credential path.
