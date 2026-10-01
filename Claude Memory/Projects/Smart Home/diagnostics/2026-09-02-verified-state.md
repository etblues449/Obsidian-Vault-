# Smart Home — Verified Live State (2026-09-02)

Full read-only audit + targeted fixes, verified against the live **HA Green** (192.168.0.200, Core **2026.9.0b4**, HAOS 18.2) over the Core API, plus the local PC Docker stack and network. Cross-referenced against the claude.ai "Smart Home" project. See also [[_index]] and [[MASTER_PLAN]].

## Corrections to project memory (drift found)

| Memory said | Verified reality (2026-09-02) |
|---|---|
| `.205` = "Landing" LD2410 node | **It is the `bedroom_espectre` node in HA** — ESPectre CSI + LD2410 board (MAC `e0:72:a1:e7:f2:c8`, on COM6). "Landing" and "Bedroom" have been the same physical node under two names. Re-flashed 2026-08-29 with compiled-in Wi-Fi creds. |
| Lounge presence = `.184` | No `.184`. Live LD2410 node is **kitchen-presence at `.185`**. |
| Music Assistant = stable | **DOWN** — add-on error, integration can't reach `ws://d-music-assistant`. |
| Editor = "Studio Code Server" | **Not installed** — only File editor. Update guidance or reinstall. |
| Core = 2026.8.x | **2026.9.0b4** (beta; b5 available). |
| Fire Stick = unconfirmed | **CONFIRMED `media_player.fire_tv_192_168_0_183`**. Installed apps: Netflix, Disney+, Plex, Spotify, VLC, BBC iPlayer, **Alph IPTV**, Downloader. |
| AI Cam Outside `.201` = "black frames" | Whole node **fully offline** (still needs OV3660 module swap). |

## Fixes applied this session (via HA config API; backup `/config/automations.yaml.bak-20260902-claude`)

- **Bedroom Enter/Empty** repointed to `binary_sensor.bedroom_espectre_radar_presence` + `light.bedroom` (were `*_bedroom_presence` + `light.bedroom_light`, dead since May). Node `.205`/bedroom_espectre came back online 2026-09-02 (uptime reset, wifi −40), so these now fire.
- **New: `AI Cam person -> lounge TV + Fire Stick (evening)`** — person after sunset & not away → lounge TV + Fire Stick on → launches **Alph IPTV** (`monkey -p com.alph.alphiptviptvbox`). Paired **off-when-clear** automation (15 min).

## Node status (2026-09-02)

**Online:** AI Cam indoor (`.199`), Kitchen Presence (`.185`), Bedroom/ESPectre (`.205`, recovered).
**Offline / off-network (need physical power/Wi-Fi check):** HA Voice 09eabd + Jessa Voice (`.204`), ESP Speaker, AI Cam Outside (`.201`), CSI Node 3 (`.209`).
Entities: **760 total, ~231 stale** (~30%) — most stranded by the offline nodes.

## Redundant infrastructure (not in the house design)

- **Second Home Assistant** in Docker on the PC (`192.168.0.190:8123`, HA 2026.8.2, configured) duplicating the Green box — split-brain risk. Decide one authoritative HA.
- **Idle PC Docker stack:** grafana, influxdb, nodered (empty flows), 2nd mosquitto (no clients), 2nd esphome (0 devices) — scaffolding from the deprioritised RuView experiment.

## Stale project knowledge files to retire

`Config/Automation/Bedroom/Landing/Lounge Yaml "14"` & `"28"` sets, `Automation 11 April 26`, `Lounge Yaml 06 April 26` — point-in-time snapshots, not synced mirrors.

## Confirmed working

HA Green core · Frigate 0.17.2 · AI Cam `.199` · Kitchen `.185` · Bedroom/ESPectre `.205` · Mosquitto (Green) · ESPHome Builder · Tailscale · Speech-to-Phrase · openWakeWord · Matter · Spotify · Govee · Nabu Casa.

## Still outstanding (project "on the horizon", still true)

N100 mini-PC (Green box memory ceiling: 83 MB free / 81% swap at audit) · permanent SSD data disk (off the USB stick) · AI Cam Outside OV3660 module swap · MQTT password `frigate123` rotation · revive the offline voice/speaker nodes.
