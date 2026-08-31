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
- Supervisor/add-on health is **not** covered by `ha-doctor` — it audits Home Assistant
  Core only. That layer now has its own tool: **`ha-supervisor-fix.mjs`** (below).
  Frigate remains checked indirectly here: camera entity availability + stream probes.
  *(Correction, 2026-08-30: this bullet previously said the Supervisor API "can't be
  reached with a long-lived token". Core proxies the Supervisor API at `/api/hassio`,
  which an **admin** long-lived token can use — that is the path the new tool takes. It
  probes and reports which credential actually authenticated rather than assuming;
  unverified against the Green until first run.)*

## Cadence

Suggested: run before/after any HA upgrade, after adding a node, and monthly. Reports
accumulate in `Claude Memory/Projects/Smart Home/diagnostics/` — diffs between runs are
the drift signal.


---

# HA Supervisor Fix — Supervisor-layer diagnostic & repair

`ha-supervisor-fix.mjs`. Built 2026-08-30 from a supervisor log tail that carried two
unrelated defects. `ha-doctor` could not have seen either: both live below Core, in the
Supervisor.

## What it checks — and what it repairs

| # | Section | Catches | Repairs? |
|---|---|---|---|
| 1 | Auth | which credential path actually reached the Supervisor (in-cluster token vs Core's `/api/hassio` proxy) | — |
| 2 | Host | OS build, kernel, disk used/free (a full disk and a bloated journal travel together) | — |
| 3 | **Host logs** | `systemd-journal-gatewayd`: times a cheap tail *and* the boot-ID listing separately, then says which of the two root causes it is | prints exact host-shell steps |
| 4 | **Add-on options** | every installed add-on's stored options against its current schema — keys the add-on has since dropped | ✅ yes, over the API |

Section 3's two-probe design is the point. A tail read walks the journal backwards from
the end and is cheap; a boot-ID listing is not, because when gatewayd's native `/boots`
endpoint is unavailable the Supervisor falls back to scanning the journal. So:

- tail fast, boots fails → **the journal is too large to scan inside Supervisor's 20s budget**
- tail also fails → **gatewayd itself is down or wedged**

Those need completely different fixes, and the error message alone does not distinguish
them.

## Run it

```bash
# From the LAN (Fold 7 / PC). Needs an ADMIN long-lived token — the /api/hassio proxy
# is admin-only.
export HA_TOKEN='<admin long-lived access token>'
node "Assistant Core/ha-diagnostics/ha-supervisor-fix.mjs"                      # dry run
node "Assistant Core/ha-diagnostics/ha-supervisor-fix.mjs" --fix                # apply
node "Assistant Core/ha-diagnostics/ha-supervisor-fix.mjs" \
  --out "Claude Memory/Projects/Smart Home/diagnostics/$(date +%F)-supervisor.md"
```

On the hub itself (SSH & Web Terminal add-on) `SUPERVISOR_TOKEN` is already in the
environment and no token needs setting; the script prefers it automatically.

- `--fix` — apply repairs. **Without it the script writes nothing.**
- `--slug <addon>` — restrict the add-on audit to one add-on.
- `--json` / `--out <path>` — as `ha-doctor`.
- `HA_URL` — override hub URL (default `http://192.168.0.200:8123`).

## Safety

- **Dry-run by default.** The only write is `POST /addons/{slug}/options`, only under
  `--fix`.
- **It only ever removes keys the add-on's own schema no longer declares.** No value is
  changed, and an add-on that declares `schema: false` (arbitrary options legal) is
  skipped entirely.
- The pre-change options are recorded verbatim in the report as `options_before`, so any
  removal can be put back by hand.
- Add-ons are **not** restarted; the report says which ones to restart when convenient.
- No token is ever written to the report or the vault.

## Known limits (honest)

- **The journal repair is not automatable from here.** Vacuuming and capping the journal
  needs the HA OS *host* shell — SSH on port **22222** with a key in
  `CONFIG/authorized_keys` on the boot partition, or the physical console. The SSH & Web
  Terminal add-on is a container and cannot see the host journal. The script prints the
  exact command sequence and then verifies the result on the next run.
- `journalctl --vacuum-*` only reclaims **archived** journal files, so the printed steps
  `--rotate` first. Skipping that is why vacuuming often reports freeing 0 bytes.
- The persistent cap is a drop-in under `/etc/systemd/journald.conf.d/`. `/etc` is an
  overlay on HA OS — it survives reboot, but re-check it after an OS update.

## Tests

```bash
node "Assistant Core/ha-diagnostics/test/supervisor-fix-test.mjs"
```

46 assertions, fully offline: the pure logic (stale-key detection, false-value handling,
verdict classification) plus an end-to-end run against a mock Supervisor API on
loopback, which asserts that a dry run writes nothing and that `--fix` POSTs options
with the stale keys gone and every other value byte-identical.

---

# HA Entities — what is this thing actually called?

`ha-entities.mjs`. One GET, read-only, zero dependencies. Answers the question
that keeps costing time: **the registry's entity_id, not the one the YAML or a
screenshot implies.** The vault has been wrong about this twice — the first AI
Cam registered as `living_room_ai_cam_*`, which matched neither its config nor
its display name.

```bash
export HA_TOKEN='<long-lived access token>'      # shell only, never a file
node "Assistant Core/ha-diagnostics/ha-entities.mjs" cam bedroom light
```

Arguments are case-insensitive substrings, OR'd, matched against entity_id and
friendly name. No arguments = every entity. `--json` for machine-readable
output. `HA_URL` overrides the hub URL.

Output is `entity_id  state  friendly_name`, with `<-- DEAD` against anything
`unavailable`/`unknown` — a dead entity is the answer as often as a live one,
and it should not read as a normal value.

Exit codes are distinct so a failure says which failure it was: **2** no token,
**3** hub answered but rejected the token (401 = wrong/revoked/expired),
**4** hub unreachable (you are not on its LAN). 8 offline assertions cover the
filtering, the DEAD flag, `--json`, and all three failure paths.

