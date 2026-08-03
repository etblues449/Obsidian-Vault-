# handsoff.md — WebRTC card + person-detection automations

**Why this file exists:** this session has no `HA_TOKEN` — the WebSocket deploys used
in [[../sessions/2026-08-02]] aren't available here. Everything below is steps for
Elliot to execute in the HA UI / HACS, not something I ran. Each section states
what it delivers and what it does not.

Requested against [AlexxIT/WebRTC](https://github.com/AlexxIT/WebRTC), verified
section-by-section against its README rather than assumed. Companion to
[[ai_cam-go2rtc-frigate]] — read that first for how go2rtc/Frigate are already wired.

## 1. go2rtc

Already satisfied. You have go2rtc running (confirmed live 2026-08-03), with `ai_cam`
and `ai_cam_outside` as named streams. This card is a second **consumer** of that
same go2rtc instance — it does not replace or duplicate it. Nothing to do here.

## 2. Installation

**Via HACS:**
1. HACS → Integrations → ⋮ → Custom repositories → add `AlexxIT/WebRTC`, category
   "Integration" (skip this if HACS already indexes it — check search first)
2. HACS → Integrations → search "WebRTC" → Install
3. Restart Home Assistant

**If not using HACS**, download the latest release, extract the `webrtc` folder into
`/config/custom_components/`, restart.

**YAML-mode dashboards only** (skip if using the UI dashboard editor — yours are
storage-mode, per [[../sessions/2026-08-02]]) — add the resource:
```yaml
resources:
  - url: /webrtc/webrtc-camera.js
    type: module
```

## 3. Configuration

The integration itself needs no `configuration.yaml` block — add it via
Settings → Devices & Services → Add Integration → WebRTC. It auto-discovers the
go2rtc instance if one is already running under Frigate; since yours is standalone
on non-default ports, point the **card** at it explicitly instead (safer than relying
on auto-discovery):

```yaml
type: custom:webrtc-camera
url: ai_cam
server: http://192.168.0.200:1984/
```

`192.168.0.200` = the Green; `1984` = the `api.listen` port set in
[[ai_cam-go2rtc-frigate]]'s go2rtc config.

## 4. Custom card

Drop-in dashboard card, full-featured:

```yaml
type: custom:webrtc-camera
url: ai_cam
server: http://192.168.0.200:1984/
title: Living Room
poster: /api/camera_proxy/camera.living_room_ai_cam_ai_cam
digital_ptz:
  mouse_wheel_zoom: true
  touch_pinch_zoom: true
ui: true
```

`poster` reuses the existing ESPHome API snapshot endpoint as the loading image —
no extra config needed on that side. Duplicate the block with `url: ai_cam_outside`
for the second board once it's permanently sited.

## 5. Templates

Shortcut buttons and PTZ controls accept JS template expressions reading live HA
state — e.g. a shortcut that changes icon based on a light's current state:

```yaml
shortcuts:
  - name: Lounge Light
    icon: ${ states['light.living_room_light'].state === 'on' ? 'mdi:lightbulb-on' : 'mdi:lightbulb-off' }
    service: light.toggle
    service_data:
      entity_id: light.living_room_light
```

This is genuinely new capability — nothing built so far exposes HA state inside the
camera card itself.

## 6. Two-way audio — same hardware limit as before, restated once

The `media: video,audio,microphone` config option below is real and does work —
**with a camera whose go2rtc source carries an audio track.** The ai_cam's does not:
the producer command ends in `-an` (audio explicitly stripped) because the board's
MJPEG stream has no audio in either direction. No card, integration, or config
change manufactures a backchannel that doesn't exist at the source — this is a
firmware/hardware fact, not a settings gap. Full detail: [[ai_cam-go2rtc-frigate]],
section "Two corrections."

The config, for when it's relevant (a future camera board with real 2-way audio):
```yaml
type: custom:webrtc-camera
url: some_future_camera
media: video,audio,microphone
```
Requires: HA served over **HTTPS only** (browser enforces this for mic access),
WebRTC mode specifically (not MSE/HLS/MJPEG), and on mobile, microphone permission
granted to the HA app.

**What actually works today for ai_cam speaker output** — unchanged advice, still
correct: `media_player.living_room_ai_cam_ai_cam_speaker` via `tts.speak` or
`media_player.play_media`. One-way, HA→speaker, no reflash needed.

## 7. Cast or share stream

Two independent features, both real:
- **Cast**: send the stream to a Google Cast device from the card's UI directly —
  no extra config, appears automatically if Cast devices are on the network.
- **Share link**: generates a temporary or permanent URL that plays the stream
  without HA login — useful for sharing a view with someone outside the household.
  Configured per-card; see the card's own settings panel (⋮ on the card in edit mode).

## 8. Stream to camera

This is a **virtual media_player entity** backed by the WebRTC integration, a second
route to push audio into a camera's speaker alongside the ESPHome-native one:

```yaml
media_player:
  - platform: webrtc
    name: Camera Audio
    stream: ai_cam
    audio: pcmu/48000
```

**Do not add this for ai_cam.** It still requires an audio-capable go2rtc source —
same constraint as §6, since the producer strips audio. If a future board changes
that, this becomes relevant; today `media_player.living_room_ai_cam_ai_cam_speaker`
already does the job natively with zero extra moving parts.

---

## 9. Person detection → activate HA devices

This is genuinely new automation, not just card polish, and it's the most directly
useful item on this page. Frigate is **already** detecting people —
`objects: track: [person]` has been in the camera config since
[[ai_cam-go2rtc-frigate]] — what's missing is HA reacting to it.

**Verified against Frigate's own MQTT docs** (not guessed): every camera publishes a
live count on `frigate/<camera_name>/<label>` — for this camera,
`frigate/ai_cam/person`, payload = integer count of currently-tracked people
(`0` when clear, `1+` when present). This is simpler and more robust than parsing
the full `frigate/events` JSON stream, and doesn't depend on guessing an
integration-generated entity_id I can't check without live registry access this
session.

**Automation — turn on the living room light while someone's on camera:**
```yaml
alias: AI Cam person detected -> living room light
triggers:
  - trigger: mqtt
    topic: frigate/ai_cam/person
condition:
  - condition: template
    value_template: "{{ trigger.payload | int(0) > 0 }}"
actions:
  - action: light.turn_on
    target:
      entity_id: light.living_room_light
mode: single
```

**Turn it back off when the count returns to zero** (separate automation, so the
light doesn't flicker off mid-detection due to `mode: single` above):
```yaml
alias: AI Cam person cleared -> living room light off
triggers:
  - trigger: mqtt
    topic: frigate/ai_cam/person
condition:
  - condition: template
    value_template: "{{ trigger.payload | int(0) == 0 }}"
actions:
  - action: light.turn_off
    target:
      entity_id: light.living_room_light
mode: single
```

Swap `light.living_room_light` for any HA target — a switch, a scene, a notification,
`media_player.living_room_ai_cam_ai_cam_speaker` via `tts.speak` for an audible
alert. `frigate/ai_cam/person/active` (same doc) is the count of objects Frigate
considers *currently moving*, if you want stricter presence than the passive count.

**Not yet done, deliberately left out:** zone-restricted triggers (e.g. "only the
doorway area of frame"). That needs a Frigate `zones:` block defined against this
camera's coordinate space, which doesn't exist yet in the config — a real follow-up,
not a gap in this page.
