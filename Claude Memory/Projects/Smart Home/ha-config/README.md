# HA Config — Automations cleanup + JARVIS theme (2026-07-23)

Snapshot + change record for the HA Green hub (`192.168.0.200`, remote via Nabu Casa).
Done over the REST + WebSocket API using a long-lived token (since revoked).

## 1. Automations — made minimal
The hub had **36 automation entities but only 8 real automations**. The other 28 were
**ghosts**: registry entries left behind after old automations were deleted from
`automations.yaml` (state `unavailable`, config API returned `Resource not found`).

- **Deleted all 28 ghosts** from the entity registry (Lounge suite, old Bedroom
  time-split versions, duplicate Guest/Away modes, Welcome Home, etc.).
- **Renamed** the two kitchen automations for honest, consistent naming:
  - `Kitchen - Room Empty (Light Off)` → **Kitchen - Empty**
  - `Kitchen - Enter (Daytime)` → **Kitchen - Enter** (it had **no** daytime
    condition — the empty `conditions: []` was dropped).

### The 8 automations that remain (backed up in `automations/`)
| Entity | Alias | Does |
|---|---|---|
| `automation.bedroom_enter` | Bedroom - Enter | Presence on → bedroom light 70% / 4000K |
| `automation.bedroom_empty` | Bedroom - Empty | Presence off → light off |
| `automation.kitchen_enter_daytime` | Kitchen - Enter | Moving target → kitchen lights 100% / 5000K |
| `automation.kitchen_empty` | Kitchen - Empty | Empty 10 min → kitchen lights off |
| `automation.landing_someone_enters` | Landing - Enter | Presence on → landing bulb |
| `automation.landing_room_empty_light_off` | Landing - Empty | Presence off → landing bulb off |
| `automation.duck_soundbar_when_esp_speaker_is_active` | Duck soundbar when voice active | Ducks soundbar volume while the voice satellite talks, restores after |
| `automation.system_nightly_notebooklm_sync` | System - Nightly NotebookLM Sync | Time-triggered nightly sync |

> Note: the old **Lounge** automations were purged, not rebuilt — they had already
> been deleted from config (only ghosts remained). If you want lounge presence
> automations back, they need to be written fresh.

## 2. Dashboard — JARVIS colours
Dashboard `jelly-bean-s-dash` ("Jelly Bean's House", 5 views) is fully theme-driven —
**no hardcoded colours**, all via `jb-*` tokens. It was on the light theme
**"Jelly Bean Light"** (white bg / blue accent).

- Created **`themes/jarvis.yaml`** — a dark drop-in with the *same* `jb-*` / `mush-*`
  token names, recoloured to the JARVIS / V.A.U.L.T. palette:
  deep purple-black bg `#0a0612`, violet `#7c3aed` / `#d8b4fe`, mint presence `#6ee7b7`,
  lavender text `#e9e4f5`, red alert. Also themes the header, sidebar and background.
- **Switched all 5 views** from `Jelly Bean Light` → `JARVIS` via the API.

### ⚠️ One manual step to make it live
HA loads themes from a file the API can't write, so install `jarvis.yaml` on the hub:

1. Open **File editor** (or Studio Code Server) add-on in HA.
2. Put `themes/jarvis.yaml` in the **same themes folder** as `Jelly Bean Light`
   (usually `/config/themes/`). If your themes are one file (`themes.yaml`), paste the
   `JARVIS:` block into it instead.
3. **Developer Tools → YAML → Reload Themes** (or restart HA).
4. Open the dashboard — it's already pointed at JARVIS, so it goes dark immediately.

## Revert
- **Dashboard colours:** set the 5 views' theme back to `Jelly Bean Light`
  (Edit dashboard → each view → Settings → Theme), or restore
  `backups/dashboard_jelly-bean-s-dash_PRE-JARVIS.json`.
- **Automations:** the deleted ghosts did nothing (no config) — nothing to restore.
  The 8 live configs are in `automations/`.
