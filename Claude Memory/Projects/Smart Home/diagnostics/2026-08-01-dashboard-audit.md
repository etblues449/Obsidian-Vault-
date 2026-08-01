# Dashboard audit — 2026-08-01

All 5 files in `dashboard/` read in full and cross-checked against the Smart Home
index's canonical decisions. Canonical file: **`jellybean-dashboard-v2-corrected.yaml`**
(`-v2-final` is a comment-only twin; the commit claiming an "indentation fix" between
them changed no config line).

## S1 — wrong/contradictory entity references

1. **FIXED 2026-08-01 (this branch):** the canonical file referenced the stale
   `media_player.jelly_beans_tv` in 4 places (lines 416, 429, 432, 536 — Now Playing
   card + 2 visibility conditions + Lounge TV card). The "corrected TV entity" commit
   (`96e459b`) had actually corrected it in the **wrong direction** — v1 and v2 had the
   canonical `media_player.tv_jelly_beans_tv_2` all along. All 4 now corrected.
2. **OPEN — needs the live registry:** the dashboards use `living_room_ai_cam_*`
   prefixed entity IDs (~28 refs, e.g. `media_player.living_room_ai_cam_ai_cam_speaker`,
   `switch.living_room_ai_cam_amp_enable`) while the index's Entity Reference documents
   the short forms (`media_player.ai_cam_speaker`, `switch.ai_cam_amp_enable`,
   `switch.ai_cam_camera_power_down`). One side is stale — probably HA's device-name
   prefixing ("Living Room AI Cam") renamed them after the index was written.
   **`ha-doctor.mjs` §12 now checks both forms and reports which is live.** Whichever
   loses gets updated (dashboard YAMLs or index).
3. Superseded `-v2.yaml` only: dead placeholder `media_player.spotifyplus_jellybean`
   (3 refs). Resolved in the canonical file via native `media_player.spotify_elliot_horton`.
   Only dangerous if the wrong file is deployed.

## S2 — coverage and dependency gaps

- **Four near-identical dashboard copies** invite deploying the wrong one →
  `README.md` now marks the canonical; consider archiving the other three
  (user call — not deleted).
- **8 HACS deps required** (mushroom, bubble-card, decluttering-card, card-mod,
  advanced-camera-card, auto-entities, apexcharts-card ≥2.2.0, browser_mod v2) +
  native Spotify integration. Any missing → dead cards.
- **`cctv_cam` (.234) has no card in the canonical file** (removed by `96e459b`) —
  a documented live Frigate camera is invisible on the dashboard.
- **Bedroom node health unmonitored**: the Bedroom Radar health card was removed while
  `binary_sensor.bedroom_presence` remains load-bearing in 8+ places (greeting, chips,
  charts, room view). If that node dies, presence features fail with no visible cause.
- **RuView CSI's 6 MQTT entities appear in NO dashboard version** — the index claim
  "on the Smart Home dashboard" does not hold for any file in the vault. Either a
  UI-managed (server-side) dashboard carries them, or the claim is stale.
  Only `sensor.ruview_csi_node_3_wifi_signal` is shown.

## S3 — cosmetic / informational

- `assist_satellite.home_assistant_voice` labelled "Bedside Voice" (Rooms → Bedroom)
  and "Voice PE — Lounge" (System → Voice) — same entity, two locations; align once
  its real position is decided.
- ESP32-S3-AUDIO-Board (.216) and the HA Green hub itself have zero dashboard
  representation in any version.
- Lounge presence card is titled "Kitchen Radar" (matches the combined
  "Lounge / Kitchen Radar" node naming — rename if confusing).
- `-v2-final` header still advertises the retired SpotifyPlus deps.
- `jellybean-theme.yaml` is clean — valid, light+dark, matches `theme: Jelly Bean` refs.

## Entities the dashboards revealed (not in the index's reference list)

`binary_sensor.lounge_presence` · `binary_sensor.bedroom_presence` ·
`binary_sensor.landing_presence` · `light.lounge_lights` · `sensor.lounge_wifi_signal` ·
`sensor.ruview_csi_node_3_wifi_signal` · `assist_satellite.home_assistant_voice`
(a HA Voice PE exists!) · `media_player.spotify_elliot_horton` ·
`sensor.bedroom_wifi_signal` (bedroom radar node).

## Next verification step

Run `ha-doctor.mjs` on the LAN — it settles items 2 (naming), the RuView dashboard
claim, and whether every entity above actually exists.
