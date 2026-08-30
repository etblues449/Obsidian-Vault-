# Supervisor Log Triage — 2026-08-30

**Source:** `supervisor_20260830T015413.750Z.log.txt`, supplied by Elliot. **100 lines —
a tail, not the whole log.** It spans 02:50:22 → 02:53:26 Europe/London (= 01:50:22 →
01:53:26 UTC, ending 47s before the 01:54:13Z export). Everything below is read off
those 100 lines; anything that needs the hub to answer is marked **LAN-ONLY** and is
what the new tool measures.

**Two unrelated defects, different layers, different severities.** Both sit in the
Supervisor, which is why the existing `ha-doctor` (Core REST API only) has never
reported either.

---

## Defect 1 — the host log subsystem is broken (real, user-visible)

### The error

```
supervisor.exceptions.HostLogError: Could not get a list of boot IDs from systemd-journal-gatewayd
```

Logged as ERROR twice in 27 seconds (02:50:22.964, 02:50:49.942), each time with a full
traceback, each time surfacing as `supervisor.api.utils: Unexpected error during API call`.

### The chain, exactly as the traceback gives it

```
api/host.py:240        list_boots
  → host/logs.py:186   get_boot_ids
  → host/logs.py:122   _get_boot_ids_legacy      ← raises HostLogError
  → host/logs.py:120   text = await resp.text()
  → aiohttp                                       ← asyncio.TimeoutError
```

with `timeout=ClientTimeout(total=20)` visible at the head of the first traceback.

### What that proves

1. **Supervisor is on the fallback path.** Line 51 says so in its own words:
   `Could not get /boots from systemd-journal-gatewayd, using fallback.` The native
   `/boots` endpoint is not answering, so Supervisor drops to `_get_boot_ids_legacy`.
2. **The fallback is expensive and does not finish.** The legacy method derives boot IDs
   by reading journal entries rather than asking for a boot list. Both tracebacks are
   timeouts against the same 20s budget, but they fail at *different stages* — the first
   in `resp.start(conn)` (no response headers within 20s), the second inside
   `resp.text()` (headers arrived, body never completed). A response that starts and
   then stalls mid-body is what a long scan looks like, not what a dead socket looks
   like.
3. This is the documented upstream failure mode: on a system that has been up a while
   and has generated a lot of journal, the boot listing returns nothing or errors
   (home-assistant/supervisor#5389).

### Impact — stated precisely

Boot IDs back the **boot selector on Settings → System → Logs** (and `ha host logs
--boot`). While this fails, that control is broken and the API call 500s. **Nothing in
these 100 lines shows Core, add-ons, automations or the voice satellites affected**, and
add-on/core log views use identifiers rather than boot IDs, so they are expected to keep
working. It is a broken diagnostic surface — which matters here precisely because this
vault's standing lesson is that *silent failures outrank loud ones* and the log viewer is
how the loud ones get read.

### The two possible causes — and they need opposite fixes

| | Cause | Signature | Fix |
|---|---|---|---|
| A | Journal too large for the legacy scan | a cheap tail read answers fast, the boot listing does not | rotate + vacuum + cap the journal |
| B | `systemd-journal-gatewayd` down or wedged | even a cheap tail read fails | restart the gateway / socket unit |

The error message is identical either way, so **guessing here would be guessing**. The
new tool times both probes separately and returns a verdict. From the tail alone A is the
better bet — a wedged gateway would not have produced a response that began streaming and
then stalled mid-body — but that is an inference, not a measurement. **LAN-ONLY: run the
tool.**

### The repair (A), once confirmed

Host shell — HA OS SSH on port **22222** (key in `CONFIG/authorized_keys` on the boot
partition) or the physical console. The SSH & Web Terminal add-on is a container and
cannot see the host journal.

```bash
journalctl --disk-usage          # measure first
journalctl --rotate              # vacuum only reclaims ARCHIVED files...
journalctl --vacuum-size=100M    # ...so rotate before vacuuming
journalctl --disk-usage          # confirm it shrank
```

Then cap it so it cannot regrow:

```bash
mkdir -p /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/10-jarvis-cap.conf <<'EOF'
[Journal]
SystemMaxUse=100M
SystemMaxFiles=8
RuntimeMaxUse=32M
EOF
systemctl restart systemd-journald
```

`/etc` is an overlay on HA OS: this survives reboot, but re-check it after an OS update.

---

## Defect 2 — stale add-on options (cosmetic, and fixed over the API)

```
WARNING (MainThread) [supervisor.apps.options] Option 'use_new_device_builder' does not
  exist in the schema for ESPHome Device Builder (beta) (5c53de3b_esphome-beta)
WARNING (MainThread) [supervisor.apps.options] Option 'status_use_ping' does not exist
  in the schema for ESPHome Device Builder (beta) (5c53de3b_esphome-beta)
```

`use_new_device_builder` was the **temporary opt-in toggle** during the Device Builder
beta (ESPHome 2026.5.0). Once Device Builder became the default and the legacy dashboard
was retired, the add-on dropped the option from its schema — but the key Elliot set stays
in the add-on's stored options forever, and Supervisor re-validates on every options load
and warns again. `status_use_ping` is the same shape of problem in the same add-on.

**Impact: noise only.** The add-on runs; unknown keys are ignored, not fatal. It is worth
clearing anyway because these two warnings are exactly the kind of permanent background
noise that trains you to skim the supervisor log — which is the habit that hides a real
warning later.

**Fix:** read the add-on's stored options, drop the keys its current schema no longer
declares, write the rest back unchanged. Automated in the tool below.

---

## What was built for this

`Assistant Core/ha-diagnostics/ha-supervisor-fix.mjs` — zero-dependency Node, companion
to `ha-doctor.mjs`, covering the Supervisor layer `ha-doctor` explicitly does not.
Full docs in `Assistant Core/ha-diagnostics/README.md`.

- **Diagnoses defect 1** by timing a cheap tail and the boot-ID listing separately, and
  returns `healthy` / `boots-marginal` / `journal-too-large` / `gatewayd-down` — then
  prints the matching host-shell repair. `boots-marginal` catches the case where the
  listing still succeeds but already exceeds Supervisor's own 20s budget, i.e. it is
  about to start failing.
- **Repairs defect 2** over the API, for *any* add-on rather than just this one: it
  diffs each add-on's stored options against its live schema. Dry-run by default; `--fix`
  writes. It only ever removes keys, never edits a value, skips add-ons that declare
  `schema: false`, and records the pre-change options verbatim so a removal is reversible.
- **46 offline assertions**, `Assistant Core/ha-diagnostics/test/supervisor-fix-test.mjs`,
  including an end-to-end run against a mock Supervisor on loopback that proves a dry run
  writes nothing and that `--fix` sends the cleaned options with every surviving value
  byte-identical. The suite found a real bug during development: the request helper
  spread its options after the header object, so any call carrying custom headers lost
  its `Authorization` header — the tail probe would have failed against the real hub and
  been misread as `gatewayd-down`.

### Run it

```bash
export HA_TOKEN='<ADMIN long-lived access token>'   # /api/hassio proxy is admin-only
node "Assistant Core/ha-diagnostics/ha-supervisor-fix.mjs"          # dry run, read-only
node "Assistant Core/ha-diagnostics/ha-supervisor-fix.mjs" --fix    # clears the stale keys
node "Assistant Core/ha-diagnostics/ha-supervisor-fix.mjs" \
  --out "Claude Memory/Projects/Smart Home/diagnostics/$(date +%F)-supervisor.md"
```

On the hub (SSH & Web Terminal add-on) `SUPERVISOR_TOKEN` is already in the environment
and is preferred automatically — no token to set.

---

## Status — say which state each thing is actually in

| Item | State |
|---|---|
| Defect 1 root cause | **Narrowed to two candidates, A favoured.** Not confirmed — needs the LAN probe. |
| Defect 1 repair | **Written and documented. Not run.** Needs the HA OS host shell. |
| Defect 2 repair | **Built and test-proven against a mock. Not yet run against the Green.** |
| Tool | **46/46 offline assertions green.** Never yet pointed at the real hub. |

Nothing here has touched the hub. The vault-side work is done; the on-hub run is the open
gate.

## Not knowable from a 100-line tail

- How large the journal actually is, and whether the disk is filling behind it.
- Whether the boot-ID failure is constant or occasional — two samples, 27s apart, is not
  a rate.
- Whether anything else in the supervisor log is failing outside this 3-minute window.
  If the full log is exported later, re-triage it; this note covers the tail only.
