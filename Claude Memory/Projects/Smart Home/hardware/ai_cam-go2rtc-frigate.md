# ai_cam → go2rtc → Frigate — the working recipe

**Status: LIVE and verified 2026-08-03 ~23:35.** Frigate shows the AI Cam tile with
recording dot + person-detection active. Confirmed by screenshot, not inferred.

Companion to [[ai_cam]] and [[ai_cam-compile-runbook]].

## The constraint that dictates the whole design

The Waveshare board has **no RTSP and no RTMP**. ESPHome ships no such component —
its only video transports are `esp32_camera_web_server` (MJPEG over HTTP) and
snapshot. Anything that wants h264 must transcode off-board.

And from the ESPHome docs: *"At a given time only one stream can be served, but
multiple snapshots."* **One** MJPEG client, ever. That is why go2rtc is not optional
decoration here — it holds the single slot and fans out to Frigate, HA and browsers
from one producer. Point two things at `:8080` directly and one of them always loses.

Note the dashboard camera does NOT consume that slot: `/api/camera_proxy/` pulls over
the ESPHome **API**, not port 8080. A browser tab left open on `:8080` does.

## go2rtc add-on — `/config/go2rtc.yaml`

```yaml
streams:
  ai_cam: ffmpeg:http://192.168.0.199:8080#video=h264
  ai_cam_outside: ffmpeg:http://192.168.0.201:8080#video=h264

ffmpeg:
  h264: "-codec:v libx264 -g:v 5 -profile:v high -level:v 4.1 -preset:v superfast -tune:v zerolatency -pix_fmt:v yuv420p"

api:
  listen: ":1984"
rtsp:
  listen: ":8654"
webrtc:
  listen: ":8555"

log:
  level: info
  ffmpeg: error
```

**No trailing slash before `#`.** `:8080#video=h264` works; `:8080/#video=h264` was
what produced the 404 loop. Every working community ESP32-CAM config uses the former.

**`#hardware` deliberately omitted** — Frigate logs `Did not detect hwaccel` on the
Green, so requesting it fails.

## Frigate — `go2rtc:` block REMOVED

Frigate runs its own embedded go2rtc regardless (`go2rtc process pid: 129` in its log)
and that instance also wants 8554. Hence the standalone listens on **8654** — so
`rtsp://…:8554/ai_cam` can never silently resolve against the wrong instance.

```yaml
cameras:
  ai_cam:
    ffmpeg:
      inputs:
        - path: rtsp://192.168.0.200:8654/ai_cam
          input_args: preset-rtsp-restream
          roles: [detect, record]
    detect:
      width: 800
      height: 600
      fps: 5
```

`detect` dimensions must match `resolution:` / `max_framerate:` in [[ai_cam]].

## Why `-g:v 5` and not the default

go2rtc's built-in h264 template emits `-g 50`. At 5 fps that is **a keyframe every
10 seconds** — Frigate records in keyframe-aligned segments, so clips start late and
seek badly. `-g:v 5` = 1 keyframe/second. Costs a little bitrate; irrelevant at
800×600@5fps. The override above changes ONLY `-g`; every other flag matches what
go2rtc was already running.

## Two corrections recorded so they are not repeated

1. **`rtmp_server` does not exist in ESPHome.** It was added to [[ai_cam]] in
   `295d0f4` and reverted in `787a2d6` after checking the component index. It would
   have failed Device Builder validation and blocked the next flash.
2. **go2rtc 2-way audio does NOT work with this board.** The advanced-camera-card
   microphone button needs a camera-side audio backchannel (ONVIF / RTSP ANNOUNCE).
   The board's MJPEG carries no audio track in either direction, and the producer
   command ends in `-an`. Confirmed: the card docs themselves say *"Only Frigate
   cameras are supported"*, meaning genuinely backchannel-capable ones.

   **To actually get sound out of the board**, use its media_player entity —
   `media_player.living_room_ai_cam_ai_cam_speaker` — via `tts.speak` or
   `media_player.play_media`. Works today, no reflash. What it does not give you is
   live push-to-talk from a phone mic.

## Verify

```
go2rtc UI → go2rtc tab   : dataflow 192.168.0.199 → rtsp → h264 → webrtc
go2rtc UI → log tab      : producer errors (set ffmpeg: debug when diagnosing)
Frigate UI → Logs → go2rtc dropdown  (NOT the frigate tab — that only shows symptoms)
```

`DESCRIBE failed: 404 Not Found` from Frigate means go2rtc has the stream **named**
but its producer delivered no tracks. Always read the go2rtc log, never the Frigate one.

## Open

- **CPU on the Green is unmeasured.** Software libx264 transcode running continuously
  plus a CPU detector (`CPU detectors are not recommended` — Frigate's own log) on a
  box that already OOM'd compiling ESPHome. If ffmpeg pegs cores, first lever is
  `-preset:v ultrafast` (~20–30% more bitrate, less CPU); structural fix is the N100.
- **Recording playback not yet verified** — live view confirmed, retention untested.
- **`ai_cam_outside` (.201) expected to fail** while that board is off/bench-powered.
  Harmless to `ai_cam`; delete the line to keep the log clean.
