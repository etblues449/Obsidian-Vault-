# Assist satellite → person-detection automations (Task 3)

**Date:** 2026-08-04
**Status:** **BUILT AND VALIDATED OFFLINE — NOT INSTALLED, NOT RUN ON THE HUB.**
**Artefact:** [`ha-config/packages/jarvis_assist_person.yaml`](../../../../ha-config/packages/jarvis_assist_person.yaml)

> Stating this precisely, because *documented ≠ merged ≠ running* is the most expensive
> habit in this project: the package parses, passes 35/35 structural checks, and every
> entity it names is either created by the package itself or was read from the live
> instance. **No part of it has executed on the HA Green.** The hub is on a LAN address
> the build session could not reach. Everything under *Install* and *Prove it works*
> below is still to be done, by hand, on the LAN.

---

## What was built

One Home Assistant **package** — MQTT entities, three helpers, one script and five
automations in a single file that can be dropped in or pulled out as a unit.

| # | Automation | Fires on | Does |
|---|---|---|---|
| 1a | `jarvis_ai_cam_person_light_on` | person 0 → 1+ | living room light on, flags it as auto |
| 1b | `jarvis_ai_cam_person_light_off` | person 1+ → 0, held 2 min | light off, but **only** if 1a turned it on |
| 2 | `jarvis_ai_cam_person_announce_away` | person edge, away, simple mode | `assist_satellite.announce` + phone notification |
| 3 | `jarvis_ai_cam_privacy_follows_presence` | `person.elliot_horton` home/away | publishes to `frigate/ai_cam/detect/set` |
| 4 | `jarvis_ai_cam_challenge_person` | person edge, away, challenge mode | `assist_satellite.ask_question`, branches on the matched answer id |

Supporting entities the package creates:

```
binary_sensor.ai_cam_person          frigate/ai_cam/person, count -> occupancy
binary_sensor.ai_cam_motion          frigate/ai_cam/motion
camera.ai_cam_person_snapshot        frigate/ai_cam/person/snapshot (JPEG)
switch.ai_cam_detection              frigate/ai_cam/detect/set + /detect/state
input_boolean.ai_cam_light_auto      "this package turned the light on"
input_boolean.ai_cam_auto_privacy    enables automation 3          (ships OFF)
input_boolean.ai_cam_simple_alert_only  picks automation 2 over 4  (ships OFF)
script.jarvis_person_notify          the one notification path
```

---

## Four design decisions worth knowing

### 1. The count becomes a binary_sensor, and everything triggers on the edge

Frigate publishes an integer person count on `frigate/ai_cam/person`, and an MQTT trigger
fires on **every** message — including repeats of the same count. Triggering automations
directly off MQTT is what makes the "every count update re-triggers it" problem in the
handoff real.

Converting the count to a `binary_sensor` once, and then using `from: "off" to: "on"` state
triggers everywhere, removes the problem at the source rather than guarding against it
five times. It also unlocks `for:` durations (used by 1b) and gives a dashboard-visible
entity.

### 2. The cooldown is `mode: single` plus a trailing `delay`

The handoff notes that `ask_question` blocks the automation while it waits, and that a
cooldown is needed. Both speaking automations end with a `delay` (10 min for the announce,
5 min for the challenge) and run `mode: single, max_exceeded: silent`.

While the automation is still running — including through the delay — HA drops any new
trigger silently. So the run itself *is* the cooldown. No helper, no `input_datetime`, and
critically **no self-referencing `last_triggered` template**, which would silently break
the moment an automation is renamed and its entity_id slug changes.

### 3. Automations 2 and 4 are mutually exclusive — this is a deviation from the handoff

The handoff lists the spoken alert and the challenge as separate automations, both
triggered by person detection while away. Built literally, they fire simultaneously on one
satellite with one speaker: overlapping speech, and the challenge loses its answer because
the announce is talking over the person.

`input_boolean.ai_cam_simple_alert_only` selects between them. It ships **off**, so the
challenge is the default behaviour and the simple announce is the fallback. The offline
validator asserts the two guard conditions are opposites, so this can't quietly regress.

### 4. `input_boolean.ai_cam_auto_privacy` ships OFF, on purpose

Privacy-follows-presence turns Frigate detection **off while Elliot is home**. That is the
right privacy posture, but it also silences `binary_sensor.ai_cam_person` — which means
automation 1a stops turning the light on for him while he is in the house. That trade-off
is a real choice, not a detail, so the automation is installed inert and he switches it on
deliberately.

---

## Two things the handoff flagged, and where they landed

**`start_conversation` — still not used.** Core's `async_internal_start_conversation`
refuses while the pipeline's conversation engine is the built-in agent. A conversation
agent named **Claude** exists on the instance and switching the pipeline to it unblocks the
call — but that routes *every* voice command through the LLM. That is a standing decision
for Elliot, not a change an automation file should make silently. `ask_question` needs none
of it: it sets `end_stage = PipelineStage.STT` and matches sentences itself, bypassing the
conversation engine entirely. `assist-preflight.mjs` lists the conversation agents present
so the decision can be made with the facts in front of you.

**The legacy `notify.mobile_app_*` service name — now resolved by the tooling, not by
guesswork.** Image attachments require the legacy service; `notify.send_message` has no
image field. The script uses `notify.mobile_app_jelly_bean_s_phone`, inferred from the
device slug (`device_tracker.jelly_bean_s_phone` and
`sensor.jelly_bean_s_phone_battery_level` both confirm it) — **but the service itself was
never confirmed in Developer Tools, so it remains an inference.**

Two things make a wrong guess cheap rather than silent:

- the plain-text notification always goes out first over the verified
  `notify.send_message` entity path, so a bad guess costs the *picture*, never the alert;
- `assist-preflight.mjs` enumerates the hub's real `notify.mobile_app_*` services and tells
  you either "EXISTS — needs no change" or exactly which name to substitute.

If it differs, change one line: `legacy_mobile_service` at the top of
`script.jarvis_person_notify`.

---

## Install

1. **Preflight, before touching anything.** From the LAN (or with a Nabu Casa `HA_URL`):
   ```bash
   HA_TOKEN=<long-lived-token> node "Assistant Core/ha-diagnostics/assist-preflight.mjs"
   ```
   Every required check must pass. The advisory warnings about package entities not being
   present are expected at this point — the package isn't installed yet.
2. **Enable packages** in `configuration.yaml`, once, if not already there:
   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```
3. **Copy** `ha-config/packages/jarvis_assist_person.yaml` to `<ha-config>/packages/`.
4. **Developer Tools → YAML → Check configuration.** Do not skip this; a package error
   takes the whole config down on restart.
5. **Restart Home Assistant.**
6. **Post-install preflight:**
   ```bash
   HA_TOKEN=<long-lived-token> node "Assistant Core/ha-diagnostics/assist-preflight.mjs" --post
   ```
   All 28 checks required, including the eight package entities and the five automations.

---

## Prove it works — the "done when" protocol

The handoff's completion bar is: *person detection reliably drives the light, an away-mode
spoken alert fires, and the challenge automation runs end-to-end with its trace showing a
matched answer id.* Each of those is checkable.

### Test A — MQTT plumbing (do this first; everything else depends on it)

Walk in front of the camera. In Developer Tools → States, watch
`binary_sensor.ai_cam_person` go `off` → `on`, then back to `off` about 30 s after you
leave frame.

- **Stays `unavailable`** → the availability topic is the problem: check `frigate/available`
  is publishing `online`, and that the MQTT integration is connected to `192.168.0.200:1883`
  as user `frigate`.
- **Never changes** → subscribe to `frigate/ai_cam/person` in Developer Tools → MQTT →
  Listen. No messages means Frigate isn't detecting; messages but no state change means the
  `value_template` is the suspect.

### Test B — light on and off

With the sensor working: light comes on as you enter, and goes off two minutes after the
last detection. Then the case that matters — switch the light on **by hand**, walk through
frame, leave, and confirm it is **still on** two minutes later.
`input_boolean.ai_cam_light_auto` is what makes that work.

### Test C — away-mode spoken alert

Set `input_boolean.ai_cam_simple_alert_only` **on**, set `person.elliot_horton` to
`not_home` (Developer Tools → States, or actually leave), trigger a detection. Speech from
the camera speaker, notification on the phone. Then confirm the cooldown: trigger again
within ten minutes and check the trace shows the run being dropped, not queued.

### Test D — the challenge, end to end

Set `input_boolean.ai_cam_simple_alert_only` back **off**. Away, trigger a detection, and
answer *"I have a parcel"* aloud.

Expected: it replies about the porch, and the phone notification arrives with a snapshot.
**Then open Settings → Automations → *AI Cam - challenge a person detected while away* →
Traces, and confirm the `choose` step took the `delivery` branch with `reply.id` set to
`delivery`.** That trace is the actual evidence — the spoken reply alone doesn't prove the
branch matched rather than the default firing.

### Test E — the default branch, which is the one that matters

Same setup, but **say nothing**. Expected: the firm "you are being recorded" announcement,
a notification titled *UNANSWERED person at the camera* saying `(silence)`, and a trace
showing `default` taken with no `reply.id`. Repeat once saying something deliberately
unmatched ("lovely weather") — same default branch, notification quoting what was heard.

---

## Known limitations, stated up front

- **No live listen-in, and none is possible.** ESPHome exposes `voice_assistant.start`,
  `start_continuous` and `stop`; all are pipeline-bound, and `start_continuous` re-runs the
  *pipeline* in a loop rather than opening a subscribable audio stream.
- **No two-way audio in the camera card.** The go2rtc source is video-only MJPEG — there is
  no audio track and no backchannel. Frigate's audio MQTT topics will never fire for the
  same reason.
- **Only `ai_cam` is covered.** `frigatestandalone.yml` defines exactly one camera. Adding
  `ai_cam_outside` is a copy of the `ai_cam` block pointing at
  `rtsp://192.168.0.200:8554/ai_cam_outside` plus a Frigate restart — but that is pointless
  until Task 2 gets its camera initialising.
- **`notify.big_pad` is unconfirmed.** The handoff lists three notify entities; ha-doctor
  counted two notify entities on 2026-08-02. The package targets only the two phone
  entities. Preflight reports which of the three actually exist.
- **The light automation has no darkness condition.** It will switch the light on at
  midday. If that grates, add a `sun` or illuminance condition to automation 1a — the knob
  is deliberately left off rather than guessed at.

---

## Verification performed in the build session

| Check | Result |
|---|---|
| `validate-assist-package.py` — structure, entity boundary, 4 recorded gotchas | **35/35 pass**, exit 0 |
| Same validator against 5 deliberately-broken copies | **all 5 correctly fail**, exit 1 |
| `assist-preflight.mjs` — syntax | `node --check` clean |
| `assist-preflight.mjs` against a mock hub, pre-install | 15/15 required, 13 advisory, exit 0 |
| `assist-preflight.mjs` against a mock hub, post-install | 28/28 required, exit 0 |
| `assist-preflight.mjs` against a mock hub with faults injected | 12/15, 3 required failures, exit 1 |
| **Anything at all against the real HA Green** | **not done — hub unreachable from the build session** |

The negative tests matter more than the positive ones: a validator that cannot go red
proves nothing. Removing a cooldown, un-guarding a `reply.id` read, making an answer id a
bare `no`, reverting to `person.elliot`, or letting automations 2 and 4 both fire — each of
those was injected and each was caught.

---

## Reference

- Handoff: `Downloads\handoff.md` (2026-08-04) §TASK 3 — the verified live tests
- `Downloads\handsoff (1).md` §0 entity list, §6b Assist satellite detail, §9d challenge
  automation — **not present in the vault**; this package was written from the Task 3
  section alone
- `Downloads\frigatestandalone.yml` — Frigate config, one camera
- Package: `ha-config/packages/jarvis_assist_person.yaml`
- Offline validator: `Assistant Core/ha-diagnostics/test/validate-assist-package.py`
- Live preflight: `Assistant Core/ha-diagnostics/assist-preflight.mjs`
- Hub diagnosis that corroborated the entity ids: [[../diagnostics/2026-08-02-ha-doctor]]
