# Supervisor log subsystem — `gatewayd-down` CONFIRMED

**Date:** 2026-09-06
**Method:** live Supervisor API probes from the SSH & Web Terminal add-on on the
Green, using the `SUPERVISOR_TOKEN` already present in that container. No token
was minted, moved or written to disk.
**Status:** confirmed against the live hub. This supersedes the "two candidates,
A favoured" state recorded in PR #85.

---

## Verdict

`gatewayd-down`. `systemd-journal-gatewayd` is wedged: it does not answer even a
bounded ten-line tail, and has not for the duration of every probe below.

## Evidence

| Probe | Needs gatewayd? | Result |
|---|---|---|
| `GET /host/logs?lines=10` | yes | **timed out, 20.00 s** |
| `GET /host/logs` + `Range: entries=:-10:` | yes | **timed out, 20.00 s** |
| `GET /host/logs/boots/0` + `Range` | yes | **timed out, 20.00 s** |
| `GET /host/logs/identifiers` | yes | **timed out, 15.01 s** |
| `GET /host/logs/boots` | **no — Supervisor cache** | 200, **1.07 s** |

Every path that reads journal *content* hangs. The only endpoint that answers is
the cached boot-ID map, which Supervisor serves from memory without touching
gatewayd.

`/host/logs/boots` returned three boots:
`{-2: 79e25336…, -1: 29fb5d79…, 0: ecf3fdd3…}`.

## Why the original error looked like a boot-ID problem

The supervisor log tail showed `HostLogError ... systemd-journal-gatewayd` twice
in 27 s, each a 20 s timeout, on the boot-ID listing — which is what pointed the
first analysis at `/boots`.

Both faces are the same fault. On a **cold** Supervisor start the boot-ID cache
is empty, so populating it *does* call gatewayd, hangs, and times out at 20 s.
Once the cache is warm, `/boots` answers instantly from memory while everything
else still hangs. The boot-ID listing was never the broken thing; it was the
first thing to *notice* the breakage.

## Two hypotheses killed

**`journal-too-large` — dead, twice over.**

- `disk_free` **362.9 GB** of 461.4 total (`disk_used` 84.1). 79% free. There is
  no capacity pressure of any kind.
- Only **three boots** are tracked. A journal large enough to choke a scan would
  carry far more history than that.

**"The Green's disk is slow" — unsupported, and not disproven either.**

Raised on 2026-09-06 from a Claude Desktop add-on restart log (40-minute update
check, 33 s `mkdir`+`chown`, 53 s asar patch). The disk figures above give it no
support. `disk_life_time` is `null`, so eMMC wear cannot be read from the
Supervisor API — the slow-startup question is **unmeasured, not answered**, and
stays open as a separate item.

> Do not merge these two findings. They were investigated together and they are
> not the same problem.

## What this actually costs

Nothing the house does day-to-day. Core, automations, add-ons and voice are
unaffected. What is lost is **host log visibility** — Settings → System → Logs →
Host will hang, and so will any tooling that reads host logs.

That matters here for one specific reason: the host journal is the instrument
that would explain the 40-minute add-on startup. Fixing gatewayd is a
prerequisite for diagnosing that, not a fix for it.

## Repair (not yet applied)

Requires the **HA OS host shell** — SSH on port **22222**, key in
`CONFIG/authorized_keys` on the boot partition, or the physical console.
**Not the SSH add-on**: that is a container and cannot see host systemd. This
was verified the hard way — `node` is not even installed in that container.

```bash
systemctl status systemd-journal-gatewayd.socket
systemctl restart systemd-journal-gatewayd.socket
systemctl restart systemd-journal-gatewayd.service
ls -l /run/systemd-journal-gatewayd.sock
```

If the socket unit will not start, the journal itself is likely corrupt:
`journalctl --verify`, then `journalctl --rotate`, then reboot the host.

Without port-22222 access, a **host reboot** (Settings → System → ⋮ → Restart
Home Assistant → Reboot System) restarts gatewayd as a side effect. Heavier, and
it does not tell you *why* it wedged.

## Note on the tooling

`ha-supervisor-fix.mjs` classifies this case correctly — `classifyLogSubsystem`
guards `!tail.ok → gatewayd-down` at line 88, before the `journal-too-large`
fallback. Its own doc comment assumes the tail is the cheap probe and `/boots`
the expensive one, which reality inverted; the guard catches it regardless. The
implementation is sounder than its narrative. No code change needed.

The script did **not** run against the hub — no Node in the SSH add-on. These
probes are a hand-rolled equivalent of its two timed calls, using the same
endpoints and the same classification rule. That distinction is deliberate: the
script's 46 offline assertions still have not met a real hub.

---

# UPDATE 03:55–04:16 — a host reboot did NOT fix it

**Source:** supervisor log tail supplied by the user, covering a host boot at
~03:55:43 (Rauc marked slot A / kernel.0 good — that only happens on a real host
boot) through 04:16:23.

## The remedy above is insufficient

At **04:07:27**, twelve minutes after the host booted, Supervisor logged the
identical failure:

```
ERROR ... Could not get a list of boot IDs from systemd-journal-gatewayd
INFO  ... Could not get /boots from systemd-journal-gatewayd, using fallback.
ERROR ... Unexpected error during API call ... _get_boot_ids_legacy
          ... timeout=ClientTimeout(total=20) ... HostLogError
```

A reboot restarts gatewayd. Gatewayd came back and **still cannot serve the
journal**. So this is not a transient wedge that a restart clears — the
`systemctl restart` remedy prescribed by `ha-supervisor-fix.mjs` would very
likely not have fixed it either. Something persistent is wrong.

**One thing this does confirm:** the cold-cache explanation was right. Post-boot
the boot-ID cache is empty, so Supervisor tries to populate it, hits gatewayd,
and times out — reproducing the *original* error exactly. Earlier tonight the
same endpoint answered in 1.07 s purely because the cache was warm.

## The bigger signal: the box is starved

Across this one startup:

| Time | Event |
|---|---|
| 03:55:43 → 04:05:14 | Supervisor took **9.5 minutes** to reach "up and running" |
| 04:03:52 | Speech-to-Phrase — **start timeout >120 s** |
| 04:04:59 | Frigate (Full Access) — **start timeout >120 s** |
| 04:16:23 | Matter Server — **start timeout >120 s** |
| 04:08:24 | Watchdog found a problem with the observer plugin |
| 04:08:53 | Speech-to-Phrase SIGKILLed (**137**) after ~78 s failing to stop |
| 04:09:43 | Matter Server SIGKILLed (**137**) after ~108 s failing to stop |

Exit 137 is 128+9 — SIGKILL. Here it follows an explicit Supervisor *stop*, so
it is a **graceful-shutdown timeout**, not proof of the OOM killer. Be precise
about that. What the whole set does establish is that processes on this box are
extremely slow both to start and to respond to SIGTERM.

That is resource contention. **Which** resource is not yet measured — and the
2026-09-06 disk reading (79% free) rules out capacity, not speed. Memory is the
leading candidate given the workload: this 4 GB ARM board is running Mosquitto,
go2rtc, ssh_tunnel, ESPHome, Tailscale, SSH, Matter, Samba, Configurator, Music
Assistant, Speech-to-Phrase, openWakeWord, Frigate in full-access mode, **and**
the Claude Desktop add-on — which carries an X server, Electron and a WebRTC
streaming stack.

> This is a hypothesis with converging evidence, not a finding. It has not been
> measured. Do not record it as a cause until `/supervisor/stats`, per-add-on
> stats and `/proc/meminfo` have been read.

**If it holds, it subsumes the separate open item.** The 40-minute Claude Desktop
update check, the 33 s `mkdir` and the 53 s asar patch all fall out of a starved
box — and so, plausibly, does gatewayd being unable to answer within 20 s. That
would make the gatewayd fault a *symptom*, not the disease, and restarting it
would be treating the wrong thing. That is exactly what the reboot result above
suggests.

## Two unrelated defects in the same log

- **Corrupt backup.** `Can't read backup tarfile
  /data/backup/Automatic_backup_2026.7.4_2026-07-31_05.34_30005300.tar:
  "filename './backup.json' not found"`. One of 13 backup files is unreadable.
- **No current backup.** Supervisor raised `no_current_backup` and suggested
  `create_full_backup` (04:05:14). Combined with the above, backup coverage on
  this system should be treated as unproven.

## Revised next step

Do **not** restart gatewayd first. Measure the resource pressure first — a
restart would destroy the state that identifies the real cause, and the reboot
already showed a restart does not hold.

---

# UPDATE 04:23 — memory measured, hypothesis DISPROVEN

Measured from the Advanced SSH add-on (`a0d7b954_ssh`) via `/proc/meminfo` and
the Supervisor stats API.

```
MemTotal      3,915 MB
MemFree          89 MB
MemAvailable  1,519 MB   ← 38% available
Cached        1,373 MB
```

| Container | Memory | CPU |
|---|---|---|
| Frigate (full access) | 787 MB (19.2%) | 25.9% |
| Music Assistant | 422 MB (10.3%) | 0.6% |
| Claude Desktop | 361 MB (8.8%) | 1.3% |
| Supervisor | 110 MB (2.7%) | 0.08% |

**The memory-starvation hypothesis is dead.** `MemFree: 89 MB` looks alarming and
is not — Linux spends free RAM on page cache (1.37 GB, reclaimable). The number
that matters is `MemAvailable`, and 1.5 GB free on a 4 GB board is comfortable.
No container is close to a limit; nothing is CPU-pegged.

That is **two** unifying theories now falsified by measurement:
`journal-too-large` (79% disk free, 3 boots) and memory pressure. Both were
plausible. Neither survived a number.

### What this does NOT settle

- These are **steady-state** figures. The 120 s timeouts occurred during startup
  with ~14 add-ons booting at once — a different regime. Startup contention is
  not ruled out.
- `blk_read` and `blk_write` are **0 on every container**, including Frigate,
  which certainly writes video. cgroup block-I/O accounting is not wired up here,
  so **disk I/O is unmeasured** — not proven fine.

## New leading hypothesis: a corrupt journal file

It is the only candidate left that fits every constraint:

| Observation | Corrupt journal explains it? |
|---|---|
| Survived a full host reboot | ✅ the file persists on disk |
| Disk 79% free | ✅ irrelevant to corruption |
| Memory and CPU healthy | ✅ irrelevant to corruption |
| Only journal *reads* break | ✅ exactly the blast radius |
| Cached `/boots` still answers | ✅ never touches gatewayd |
| Invisible to every resource metric | ✅ |

This is also the fallback `ha-supervisor-fix.mjs` already names: `journalctl
--verify`, then `--rotate`. Testing it needs `journalctl`, i.e. host access —
which is still the blocker.

**Status: hypothesis. Not measured. Do not record as cause.**

## Separate live fault: Matter Server is in a restart loop

| Time | Event |
|---|---|
| 04:16:23 | Timeout while waiting for Matter Server to start (>120 s) |
| 04:19:13 | `core_matter_server is already running!` |
| 04:21:13 | Timeout while waiting for Matter Server to start (>120 s) — again |

Earlier in the same window it was SIGKILLed (137) at 04:09:43 after failing to
stop, then restarted at 04:14:07. This add-on is not converging. It is an
independent defect from the gatewayd fault and should be tracked separately.

The observer plugin also tripped Supervisor's own watchdog at 04:08:24 and was
restarted.

## Environment note

The shell used for all these probes is the **Advanced SSH & Web Terminal**
add-on (`a0d7b954_ssh`, `ghcr.io/hassio-addons/ssh` 24.1.3) — confirmed by its
own API calls appearing in the log at 04:23:49–04:23:55. It is Alpine: no
`systemctl`, no `node`, no `journalctl`, and its `/run` is a separate namespace
from the host's. If its protection mode is disabled it may have a route to the
host; that has not been checked yet.

