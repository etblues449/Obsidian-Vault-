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
