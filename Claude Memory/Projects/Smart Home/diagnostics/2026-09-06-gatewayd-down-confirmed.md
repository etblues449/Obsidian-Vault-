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

---

# UPDATE 04:35 — ROOT CAUSE FOUND: a journal write storm

`/var/log/journal` turned out to be **mounted into the SSH add-on**, so the
journal could be inspected directly with `ls` — no host shell, no `journalctl`.

## Corruption: disproven

`ls /var/log/journal/*/*.journal~` → **no matches. Zero.**

systemd renames corrupt or uncleanly-closed journal files with a trailing tilde
and leaves them in place. There are none. That is the third hypothesis falsified
by measurement, after `journal-too-large` (as originally framed) and memory.

## What the directory actually shows

26 files, ~540 MB total, in
`/var/log/journal/51f5e2d181c64d64b33e13b3a0c93847/`.

Twenty-one are exactly 25,165,824 bytes (24 MB). Their mtimes:

```
Sep 5  22:10 22:28 22:39 22:50 23:08 23:31 23:43 23:54
Sep 6  00:05 00:15 00:26 00:36 01:08 01:19 01:31 01:42
       01:53 02:03 02:15 02:26 02:37
```

**A fresh 24 MB journal file every ~11 minutes.**

| Measure | Value |
|---|---|
| Write rate | ~2.2 MB/min ≈ **130 MB/hour ≈ 3 GB/day** |
| Total on disk | ~540 MB across 26 files |
| Retention span | Sep 5 22:10 → Sep 6 04:29 — **~6 hours** |

Six hours of retention on a home-automation hub. A healthy one keeps weeks.
systemd's size cap is discarding history nearly as fast as it is written.

## This unifies every symptom

| Symptom | Explained |
|---|---|
| gatewayd 20 s timeout | reading a 540 MB journal under continuous 2 MB/min append |
| Survived a full reboot | the storm resumed immediately (03:53, then 04:29) |
| Even a 10-line tail hangs | gatewayd contends with journald on the same files |
| `blk_read`/`blk_write` unmeasurable | **this is the disk I/O we could not see** |
| Add-ons >120 s to start | sustained eMMC write pressure during a 14-add-on boot |
| 40-min update check, 33 s `mkdir`, 53 s asar patch | same |

## Correction: my earlier reasoning was inverted

On 2026-09-06 I disproved `journal-too-large` using two facts. One was fine — the
79%-free disk was accurate and genuinely irrelevant, because this was never about
capacity.

**The other was backwards.** I wrote that "only three boots are tracked" was
evidence *against* a large or churning journal. It is the opposite: three boots
is simply all that fits inside six hours of retention. The short boot list was a
**symptom of the churn**, and I cited it as proof against the churn.

The script's `journal-too-large` verdict was closer to right than my
`gatewayd-down` call. Both describe downstream effects; the write storm is
upstream of both.

> Standing lesson for this vault: a number that looks like evidence *against* a
> hypothesis may be a *consequence* of it. Ask which direction the causation runs
> before spending the number.

## Still unknown: what is doing the writing

Not yet identified. Matter Server is the obvious suspect given its visible
restart loop from 04:09 onward, but that is a **guess, not a finding**.

The journal files are binary with plaintext field values, so the culprit can be
ranked without `journalctl` by extracting `CONTAINER_NAME=`, `SYSLOG_IDENTIFIER=`
and `MESSAGE=` from one rotated file and counting. A first attempt using
`tr -c '[:print:]'` returned nothing — BusyBox `tr` does not split those fields
as expected. Use `grep -ao` with a bounded character class instead.

## Fix, once the source is known

Silencing the noisy service is the actual repair. Vacuuming the journal treats
the symptom and it will refill within hours. A `SystemMaxUse` cap is still worth
setting afterwards as a guard, not as the fix.


---

# UPDATE 04:52 — the storm is NGINX, ~9.5 error lines per second

**Source:** field extraction from `system@84ea6794…1.journal` (25,165,824 bytes,
mtime Sep 5 22:10 — one complete ~11-minute storm interval), run in the SSH
add-on.

## The counts

```
MESSAGE hits:    20,465
CONTAINER hits:       11
```

Eleven containers, each appearing exactly once. That is not eleven log lines —
it is systemd de-duplicating field values and storing each distinct one once.
**Container and identifier counts cannot rank volume.** The MESSAGE values can,
because they carry connection ids and timestamps and so are each stored
separately.

## What is filling the file

| Distinct variants | Shape (normalised: digits→N) |
|---:|---|
| **3,156** | `N-N-N N:N:N.N  N/N/N N:N:N [error] N#N: *N auth request unexpected status: N` |
| **3,155** | `N-N-N N:N:N.N  N/N/N N:N:N [error] N#N: *N connect() failed (N: Connection …` |
| 468 | `INFO:… hass_configurator.configurator:N.N.N.N - "GET / HTTP/N.N"` |
| 371 | `AVC apparmor="DENIED" operation="capable" profile="hassio-supervisor///usr/bin/git"` |
| 234 | `… - - [N/Sep/…] "" N "-" "-" "-" request_time="` |
| 215 | `… - - [N/Sep/…] "GET /ws HTTP/N.N" N N "-" "Mo…` |
| 141 | `AVC apparmor="DENIED" … profile="hassio-supervisor" comm="bash"` |

**6,311 nginx error lines in one 11-minute file — about 9.5 per second.** Just
under a third of all distinct messages, and the largest share of bytes, since
they are the longest lines.

## The two top shapes are ONE fault

They arrive within one of each other (3,156 vs 3,155). That is not two problems:

- `connect() failed (111: Connection refused) … while connecting to upstream` —
  nginx cannot reach the service behind it.
- `auth request unexpected status: 502` — nginx's `auth_request` subrequest hits
  that same dead upstream, gets a 502, and logs a second line.

One refusing upstream, two log lines per request, on a client that retries
continuously. That is the write storm in one sentence.

The `hass_configurator` rows corroborate it from the client side: 468 `GET /`
plus `HTTP Error N: Bad Gateway` and `Exception getting bootstrap` — something is
serving 502 to whoever asks.

## Which nginx — strong candidate, NOT yet confirmed

The message begins with **two** timestamps: `N-N-N N:N:N.N` then `N/N/N N:N:N`.
The second is nginx's own `error_log` format; the first is an add-on's s6 log
prefix wrapping it. So this is nginx running *inside an add-on*, not the host.

Of the eleven containers present, the one that ships an internal nginx using
`auth_request` in front of a Python backend is **Frigate**
(`app_ccab4aaf_frigate-fa`) — which is also the highest-CPU container on the box
at 25.9%.

> This is a strong candidate on shape and elimination. It is **not confirmed**.
> Confirmation is one line away: the untruncated error line ends with
> `upstream: "http://127.0.0.1:PORT/…"`, which names the port and settles it.
> Do not act on the guess.

## Third finding, unrelated: AppArmor is denying the Supervisor

512 `apparmor="DENIED"` records in 11 minutes — 371 against
`profile="hassio-supervisor///usr/bin/git"` and 141 against
`profile="hassio-supervisor"` with `comm="bash"`. The Supervisor's git
operations are being refused by its own AppArmor profile. That is its own
defect, it is noisy, and it is **not** the storm. Track separately.

The kernel audit subsystem is also logging into the journal (`SYSCALL`,
`PROCTITLE`, `BPF prog-id=N op=LOAD/UNLOAD`) — small volume, worth noting only
because auditd on a home hub is usually pure overhead.

## Tooling built from this

`Assistant Core/ha-diagnostics/journal-storm.sh` — the whole probe as a
committed, tested script. Read-only. Sections: inventory, rotation cadence and
derived write rate, live sample, field-readability sanity check, presence lists,
ranking by bytes, and untruncated samples of the top shapes.

Four bugs were caught by its tests before it shipped, all of which would have
produced a confident wrong answer rather than an error:

| Bug | What it would have reported |
|---|---|
| `grep -c` on a binary journal | "nothing is readable" on a file holding 20,465 fields |
| divide-before-multiply on the rate | "0 MB/hour" during a live storm |
| `sh` has no locals; helper clobbered `$b` | "shrank from 3 MB to 3 MB" |
| search literal built from the *normalised* shape | empty sample sections under correct headers |

The first of those actually fired during this investigation and was overridden
by hand. It is now pinned by a test.

## Next step

Run `journal-storm.sh` (or grep the untruncated line) and read the `upstream:`
field. Then silence that service. Do not vacuum: it refills in hours and
destroys the evidence.
