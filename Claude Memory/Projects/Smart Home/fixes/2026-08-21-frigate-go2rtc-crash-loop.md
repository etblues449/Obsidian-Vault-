# Frigate add-on — go2rtc crash loop (2026-08-21)

> **Status: DIAGNOSED FROM LOGS, NOT FIXED ON HARDWARE.** Nothing in this note has been
> run against the Green. The session that wrote it had no route to `192.168.0.0/16`
> (probe: `192.168.0.200:8123` times out; the egress proxy answers `.201` with a 403 of
> its own). Every "observed" line below comes from the add-on log Elliot pasted at 22:27
> and from live entity state he pasted at 21:38 — not from a command run against the hub.

---

## What is actually broken — and what is NOT

**Home Assistant is healthy.** This was misread earlier in the session as "HA is still
booting"; that was wrong, and it matters, because waiting was the wrong response.
Evidence HA is fine:

- Live entity state for `camera.ai_cam_2_ai_cam_outside` came back with
  `last_updated: 2026-08-21T21:38:51Z`, `state: idle`, and a valid
  `/api/camera_proxy/...?token=...` picture. Serving that requires a working core.
- The log's own `/api/hassio_ingress/O71PEce.../config` referrers prove ingress is
  routing browser traffic into the add-on.

**The `.201` camera is working.** `state: idle` (not `unavailable`), fresh timestamp,
live proxy token. Nothing in this note is a camera fault.

**Only the Frigate add-on is broken.** Ports `5000` and `5001` in those nginx errors are
*inside* the add-on container — Frigate's own UI port and its auth service. They refuse
connections because **Frigate never starts**, and Frigate never starts because
**go2rtc never starts**.

---

## The loop, read off the log

Five full cycles are visible between 22:23:46 and 22:27:12. Every one is identical:

```
[INFO] Removing stale config from last run...
[INFO] Preparing new go2rtc config...
[INFO] Got IP address from supervisor: 192.168.0.200
[WARN] Failed to get WebRTC port from supervisor
curl: (7) Failed to connect to 127.0.0.1 port 1984 after 0 ms
[ERROR] The go2rtc service is not responding to ping, restarting...
[INFO] The go2rtc service exited with code 256 (by signal 15)
s6-supervise go2rtc: warning: finish script lifetime reached maximum value - sending it a SIGKILL
```

The three facts that pin the diagnosis:

1. **go2rtc never binds `1984`** — not once, in any cycle, including the very first.
   The watchdog's health-check curl fails "after 0 ms" every time. So go2rtc is dying
   (or hanging) at startup, *before* it opens its API port.
2. **go2rtc emits no output of its own** — no version banner, no config error, nothing.
   Only the add-on's own wrapper messages appear. It is dying before or while parsing.
3. **`finish script lifetime reached maximum value - sending it a SIGKILL`** — s6's
   cleanup script is itself timing out. The previous process is not reaping cleanly,
   which is how a loop like this becomes self-sustaining: a wedged process keeps
   `1984`/`8554` bound, so the next instance cannot bind either, so it dies too.

`[INFO] Starting Frigate...` appears **once** (22:23:46) and never again — Frigate is
gated behind go2rtc in the add-on's s6 dependency chain.

### Do NOT chase the `.201` reboots

go2rtc was pointed at `.201` while it was being power-cycled through the reboot
protocol, so "the camera was down, that broke go2rtc" is the obvious theory. **It is
wrong.** go2rtc starts fine with a dead source — it binds its ports and marks the stream
offline. A source that is unreachable cannot prevent it from binding `1984`. Spending
time here will cost an evening.

`[WARN] Failed to get WebRTC port from supervisor` is almost certainly benign (no WebRTC
port mapped in the add-on's network config) and appears on healthy installs too.

---

## Recovery ladder — stop at the first step that brings it up

Run these on the Green. Each step is a strictly bigger hammer; do not skip ahead.

### Step 1 — full stop, then start (clears a wedged process holding the ports)

A **restart** may not clear this, because the thing that is stuck is the process s6
cannot reap. A **stop → verify stopped → start** does.

- Settings → Add-ons → Frigate → **Stop**.
- Wait for the status to actually read *Stopped* — do not just count to ten.
- **Start**.

Then watch the log for a go2rtc banner and the absence of `port 1984` curl failures.
If `Starting Frigate...` is followed by Frigate's own startup lines, you are done —
go to [Wiring `.201` into Frigate](#wiring-201-into-frigate).

### Step 2 — bisect the `go2rtc:` block

If it still loops, the next most likely cause is the generated go2rtc config. The
add-on rebuilds `/dev/shm/go2rtc.yaml` from the `go2rtc:` section of the Frigate config
on every cycle (that is what `Preparing new go2rtc config...` is doing) — and go2rtc
exits immediately on a config it cannot parse, which matches "no output, never binds".

- Open the Frigate config (`frigatestandalone.yml`).
- Comment out the **entire** `go2rtc:` section.
- Stop → start the add-on.
- **Comes up clean ⇒ the `go2rtc:` block is the culprit.** Re-add streams one at a time,
  stopping and starting between each, until it breaks again. The last one added is it.
- **Still loops ⇒ it is not the config.** Go to step 3.

Watch for the ordinary YAML traps in that block: a tab character, an unquoted `#` inside
a stream URL (`#video=h264` **must** be quoted or the rest of the line is a comment), or
a stream name containing a character go2rtc rejects.

> The `#video=h264` fragment is the sharp edge here. In YAML,
> `ai_cam_outside: ffmpeg:http://192.168.0.201:8080#video=h264` silently truncates to
> `ffmpeg:http://192.168.0.201:8080`. It needs quoting:
> `ai_cam_outside: "ffmpeg:http://192.168.0.201:8080#video=h264"`.

### Step 3 — port conflict / host reboot

If a zombie is holding `1984` or `8554`, nothing inside the add-on will clear it.

- Reboot the Green (Settings → System → **Restart Home Assistant** → *Restart host*).
- If it loops again immediately after a host reboot, the ports are being taken by
  **another add-on**, not a zombie. Check anything else that serves RTSP or WebRTC.

### Step 4 — reinstall the add-on

Last resort, and safe for your data: uninstall and reinstall the Frigate add-on.
Recordings live in the share/media directories, not in the add-on container. **Copy
`frigatestandalone.yml` somewhere off the Green first** — see the vault gap below.

---

## Wiring `.201` into Frigate

Only once the add-on comes up clean. Two edits, both in `frigatestandalone.yml`.

**1 — the go2rtc stream** (quote the URL; see the trap above):

```yaml
go2rtc:
  streams:
    ai_cam_outside: "ffmpeg:http://192.168.0.201:8080#video=h264"
```

**2 — the camera**, alongside the existing `ai_cam:` under `cameras:`:

```yaml
  ai_cam_outside:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/ai_cam_outside
          roles: [detect, record]
    detect:
      width: 800
      height: 600
      fps: 5
    objects:
      track: [person]
    record:
      enabled: true
      retain:
        days: 14
    snapshots:
      enabled: true
```

**Changed from the block in [[2026-08-04-ai-cam-outside-camera-init]]:** that one used
`rtsp://192.168.0.200:8554/...`, which sends Frigate's own traffic out to the LAN IP and
back into the same container. `127.0.0.1` is the form Frigate documents for a go2rtc
restream and removes a failure mode while you are still debugging. Functionally the same
stream when everything is healthy.

`detect: 800x600 @ 5fps` matches `resolution: 800x600` / `max_framerate: 5 fps` in
[[../hardware/ai_cam_outside.yaml]] (verified against the file, lines 372–374). **Change
one and you must change the other**, or detection silently misaligns with the frame.

One more constraint, from the config's own comment block: **the board serves exactly one
stream client at a time**, so go2rtc must be the only consumer of `:8080`. Close any
browser tab left open on `http://192.168.0.201:8080` before testing, or go2rtc will be
fighting it for the socket.

---

## Open drift — worth ten minutes, do not let it rot

**The live speaker entity has no source in the winning config.** HA has
`media_player.ai_cam_2_ai_cam_outside_speaker`. But
[[../hardware/ai_cam_outside.yaml]] — the file the index declares the winner for this
board — contains **no `media_player:` and no `speaker:` block** (grepped 2026-08-21).
Only [[../hardware/landing_ai_cam_2.yaml]] has them (`speaker:` L241, `media_player:`
L327, "Landing AI Cam Speaker" L329).

Two readings, and they lead to opposite actions:

1. **Registry leftover.** The entity is stale, from firmware the board carried earlier.
   It would read `unavailable`. Harmless; delete it.
2. **The running firmware is not the vault file.** Something with a speaker block is on
   the board, and `hardware/ai_cam_outside.yaml` does not describe what is running.

**Discriminating check:** Developer Tools → States →
`media_player.ai_cam_2_ai_cam_outside_speaker`. `unavailable` ⇒ reading 1. Any real state
⇒ reading 2, and the vault is wrong about this board.

This is the same open question as the index's *"confirm WHICH binary is on the board"*
item and step 5 of [[2026-08-19-run-sheet-post-camera-fix]] — still unanswered. Note the
entity-ID prefix `ai_cam_2_` is **not** evidence either way: HA freezes a device's entity
IDs at first adoption, so they keep the old slug through any later ESPHome node rename.

**`frigatestandalone.yml` is not in the vault.** It exists only on the Green. That makes
step 2 above riskier than it needs to be and step 4 genuinely dangerous. It is already
logged as P0 in the index's *"back up hub-side config into the vault"* action — this is
the second time it has blocked work. Copy it to `ha-config/` at the first opportunity.

---

## Reference

- Camera diagnosis history: [[2026-08-04-ai-cam-outside-camera-init]]
- Post-fix run sheet: [[2026-08-19-run-sheet-post-camera-fix]]
- Device config: [[../hardware/ai_cam_outside.yaml]]
- Porting source (superseded as a device config): [[../hardware/landing_ai_cam_2.yaml]]
