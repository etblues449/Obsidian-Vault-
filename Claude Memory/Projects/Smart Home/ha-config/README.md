# HA config backup

Exported 2026-08-23T03:34:42.781Z from http://192.168.0.200:8123 by `ha-export.mjs`.

- automations: 11/11 exported
- scenes: 5/5 exported
- scripts: 0/0 exported

## What is NOT here (still hub-only)

The config REST API only exposes UI-managed items. These remain unbacked and must be
copied manually via Studio Code Server or Samba:

- `bedroom-2.yaml` (canonical bedroom config)
- `frigate.yaml`
- `configuration.yaml` and any YAML packages
- the flashed `ai_cam.yaml` from ESPHome Builder
- `ui-lovelace-minimal.yaml` / dashboard YAML

## Restore

These files mirror HA's own `automations.yaml` / `scenes.yaml` format. Copy the relevant
file back into `/config/` on the Green and restart HA. Verify against `snapshot.json`,
which records exactly what was captured and what was skipped.
