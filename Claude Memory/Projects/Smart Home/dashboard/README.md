# Dashboard files — which one is real

**CANONICAL: `jellybean-dashboard-v2-corrected.yaml`** (+ `jellybean-theme.yaml` for the
"Jelly Bean" theme). Everything else in this folder is superseded history — kept for
reference, do not deploy:

| File | Status |
|---|---|
| `jellybean-dashboard-v2-corrected.yaml` | **CANONICAL** — deploy this |
| `jellybean-theme.yaml` | **CANONICAL** — required theme, light+dark |
| `jellybean-dashboard-v2-final.yaml` | superseded — comment-only diff from corrected |
| `jellybean-dashboard-v2.yaml` | superseded — contains dead `media_player.spotifyplus_jellybean` placeholder |
| `jellybean-dashboard.yaml` | superseded — v1 |

Full audit (2026-08-01, all 5 files): [[../diagnostics/2026-08-01-dashboard-audit]] —
includes the S1 fix applied to the canonical file (4 stale `media_player.jelly_beans_tv`
refs corrected to `media_player.tv_jelly_beans_tv_2`) and the open question of
`living_room_ai_cam_*` vs `ai_cam_*` entity naming, which `ha-doctor.mjs` resolves
against the live registry.

**Required custom deps (HACS)** for the canonical file: mushroom, bubble-card,
decluttering-card, card-mod, advanced-camera-card, auto-entities, apexcharts-card
(≥2.2.0), browser_mod v2 — plus the native Spotify integration providing
`media_player.spotify_elliot_horton`.
