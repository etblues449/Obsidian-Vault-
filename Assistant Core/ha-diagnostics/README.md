# HA Doctor — full Home Assistant diagnostic (read-only, £0)

One zero-dependency Node script that audits the HA Green hub end-to-end and writes a
Markdown health report into the vault. Built 2026-08-01 because the hub at
`192.168.0.200` is LAN-only — no cloud session can diagnose it directly, so the
diagnosis has to run **from a device on the same network** (Fold 7 / Termux, or the PC).

## What it checks

| # | Section | What it catches |
|---|---|---|
| 1 | Core config | version, `RUNNING` vs safe mode, timezone (must be `Europe/London`), integration count |
| 2 | Config validity | `check_config` — YAML errors that will bite on the next restart |
| 3 | Entity census | totals by domain, every `unavailable`/`unknown` entity (dead nodes, removed devices) |
| 4 | Automations | off / **unavailable (broken)** / never-triggered / stale >30d |
| 5 | Scenes | members that no longer exist or are unavailable |
| 6 | Scripts | count, never-run |
| 7 | People & presence | person entities, attached trackers, stale trackers >48h |
| 8 | Companion app | `mobile_app` entities present, battery sensors, dead entries |
| 9 | Areas | actionable entities (lights/switches/players/cameras…) with **no Area** — the exact cause of Assist's `no_valid_targets` |
| 10 | Updates | pending `update.*` entities (core, ESPHome nodes, add-ons) |
| 11 | Node reachability | probes ai_cam `.199` (+ stream `:8080` / snapshot `:8081`), audio board `.216`, RuView `.227`, cctv `.234`, porch `.240` |
| 12 | JARVIS canonical checks | `media_player.tv_jelly_beans_tv_2` exists · `camera.ai_cam` live · **`switch.ai_cam_camera_power_down` OFF** (EXIO3 LOW = camera powered) · **`switch.ai_cam_amp_enable` ON** · RuView CSI entities fresh |
| 13 | Error log | ERROR/WARNING counts + last 10 errors |

Output = summary with ✅/⚠️/❌, a ranked **action-item checklist**, and full JSON detail.

## Run it

```bash
# Termux (Fold 7) or PC, same LAN as the hub. Node >= 18.
cd ~/Obsidian-Vault-        # or wherever the vault is cloned
export HA_TOKEN='<long-lived access token>'   # HA → profile → Security → Long-lived access tokens

node "Assistant Core/ha-diagnostics/ha-doctor.mjs" \
  --out "Claude Memory/Projects/Smart Home/diagnostics/$(date +%F)-ha-doctor.md"
```

Then commit the report via the normal single write path (obsidian-git / `git pull --rebase` + push to `master`) and any Claude session can read and act on it.

- `--json` — machine-readable output to stdout instead of Markdown.
- `HA_URL` — override hub URL (default `http://192.168.0.200:8123`).
- No `--out` — prints the Markdown report to stdout.

## Safety

- **Read-only.** GETs plus two safe POSTs: `/api/template` (renders a template, changes nothing) and `/api/config/core/check_config` (validation only).
- **The token is never written anywhere** — env var only, consistent with the vault secrets rule.
- The report contains entity IDs and states only — no credentials, no note contents.

## Known limits (honest)

- **Assist "exposed entities" can't be read over the REST API** — no endpoint exposes the
  expose/alias list. Check manually: Settings → Voice assistants → Expose. The Areas
  section (9) is the automated proxy: fix areas and most voice-target misses go away.
- `check_config` needs an **admin** user's token; with a non-admin token that section
  degrades to a warning and everything else still runs.
- Dashboards are stored server-side (`.storage/lovelace*`) and are not readable via the
  REST API — dashboard review stays a vault-side job (see
  `Claude Memory/Projects/Smart Home/dashboard/`).
- Supervisor/add-on health (Frigate container etc.) needs the Supervisor API, which a
  long-lived token can't reach. Frigate is checked indirectly: camera entity availability
  + stream probes.

## Cadence

Suggested: run before/after any HA upgrade, after adding a node, and monthly. Reports
accumulate in `Claude Memory/Projects/Smart Home/diagnostics/` — diffs between runs are
the drift signal.
