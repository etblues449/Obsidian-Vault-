# Run sheet — after the `ai_cam_outside` camera fix (2026-08-19)

**Why this exists:** the `.201` camera is working ([[2026-08-04-ai-cam-outside-camera-init]]),
but three things still need hands on hardware and one decision has now been made in the vault.
Everything here is ordered so that each step's result is unambiguous. Tick as you go.

> **Do these in order.** Steps 2 and 4 both touch `.201`. If you wire Frigate before the
> reboot protocol passes, a boot-time camera dropout will look like a Frigate problem.

---

## 1 · Torch test — is the optical path good? (5 seconds)

The only frame seen so far was at 22:07 with no IR: dark, with a faint green blob. That is
consistent with a working sensor in a dark room, and also with a covered lens.

- [ ] Open `http://192.168.0.201:8080`, shine a phone torch into the lens.
- [ ] **Brightens** → optical path good. Done, move to step 2.
- [ ] **Stays black** → check for the **peel-off protective film** Waveshare ships over the
      lens. It is nearly invisible and very easy to miss on a board that has been handled a
      lot. If there is no film, next suspect is focus — the lens barrel screws in and out.

A totally black frame is *not* an init failure — init already succeeded, so this is optics or
scene, not driver.

---

## 2 · 10-reboot protocol — is the settle delay actually reliable?

**Currently 2/10.** Two consecutive clean boots were observed in one log. The original fault
was *intermittent*, so two proves nothing durable — that is exactly the trap this protocol
exists to avoid.

Power-cycle ten times. After each boot, check the log for:

```
[C][component:209]: Setup esp32_camera took ~373ms      ← want this
[E][esp32_camera:143]: Setup Failed: ESP_ERR_NOT_SUPPORTED   ← must NOT appear
```

| # | Clean? | # | Clean? |
|---|--------|---|--------|
| 1 | ☐ | 6 | ☐ |
| 2 | ☐ | 7 | ☐ |
| 3 | ☐ | 8 | ☐ |
| 4 | ☐ | 9 | ☐ |
| 5 | ☐ | 10 | ☐ |

- [ ] **10/10 clean** → the settle delay is verified. Record it in the index and move on.
- [ ] **Any failure** → lower `priority: 700` → `620` in the `on_boot` hook of
      [[../hardware/ai_cam_outside.yaml]], reflash, restart the count at zero.
      **Do not swap hardware** — the module is proven good (JPEG initialised).

Note: occasional boots missing `0x3C` from the I²C scan while the camera streams fine are
scan timing, not a fault. `0x3C` is *not expected on that bus at all* — the sensor sits on
the camera's own SCCB pins (`I2C Pins: SDA:-1 SCL:-1`).

---

## 3 · `.199` / living-room `ai_cam` — still off the network

Unrelated fault class to the `.201` camera. Observed 2026-08-06: the WebRTC card showed
`Connection to tcp://192.168.0.199:8080 failed: No route to host`. `No route to host` is
`EHOSTUNREACH` — **the host is unreachable, not the camera failing**. A dead camera on a live
board gives *connection refused* instead. It worked the previous day, so something changed.

Cheapest check first:

- [ ] **Power-cycle the board.** 30 seconds, and it clears the "board hung" case outright.
- [ ] **Check `ai_cam`'s last-install timestamp in the ESPHome dashboard.**
      Expected **2026-07-30** (the known-good build).
      - If it *is* 2026-07-30 → nothing reflashed it; suspect the network. Go to the next box.
      - If it is **newer** → something flashed it, most likely the second unidentified job on
        the 08-04 Device Builder session (its build server showed *2 active jobs*). That
        would have crossed the standing "don't reflash `ai_cam`" constraint. Roll back to the
        2026-07-30 build.
- [ ] **IP collision at `.199`.** The config uses `manual_ip` with **no DHCP reservation**, so
      any DHCP client can be handed `.199` and fight it. Check the router lease table for MAC
      `28:84:85:49:83:C8`. If another device holds `.199`, add a reservation — this recurs
      otherwise.

> Constraint still in force: **do not reflash `ai_cam`** while esphome/esphome#16926 is open,
> unless the timestamp check above shows it has already been reflashed. It runs an older
> working build and it is the only known-good reference for the fleet.

---

## 4 · Wire `.201` into go2rtc / Frigate — only after step 2 passes

go2rtc already defines the stream
(`ai_cam_outside` → `ffmpeg:http://192.168.0.201:8080#video=h264`), so nothing changes there.

Add to `frigatestandalone.yml` alongside `ai_cam`, then restart Frigate — the block is in
[[2026-08-04-ai-cam-outside-camera-init]] under the Frigate heading. `detect:` is already set
to `800x600 @ 5fps` to match the config's `resolution: 800x600`; if you change the camera
resolution, change both or detection silently misaligns.

---

## 5 · Which binary is on `.201`? (do this before trusting the vault config)

The running image self-reports `ESPHome version 2026.7.3 compiled on 2026-08-02 01:02:49` —
the **08-02** build. Pin map, 10 MHz XCLK on GPIO38, 800x600 JPEG q12 and the 300 ms boot hook
all match [[../hardware/ai_cam_outside.yaml]] exactly, but that does **not** prove the two
2026-08-04 corrections (`min_version` removal, idempotent `switch.turn_off: camera_pwdn`) are
in the running image.

- [ ] Check the Device Builder last-install timestamp for `ai_cam_outside`.
- [ ] If it predates 2026-08-04 → reflash from the vault file so board and vault agree.
      Then **restart the 10-reboot count**, because you have changed the boot path.

---

## Decision recorded 2026-08-19 — the two board-2 configs

**`ai_cam_outside.yaml` wins as the device config.** It preserves the existing HA entity IDs,
it is the copy on the Green, and its camera is verified working. Flashing
`landing_ai_cam_2.yaml` would rename the node and rewrite every entity ID for this board.

**`landing_ai_cam_2.yaml` is retired but deliberately NOT deleted.** A feature diff shows it is
the only vault copy of work `ai_cam_outside.yaml` lacks:

| Feature | `landing_ai_cam_2` | `ai_cam_outside` |
|---|---|---|
| `voice_assistant:` (Assist satellite) | 8 refs | **0** |
| `micro_wake_word` | 9 refs | 1 |
| SD card (`sdmmc`, "SD Card", "Save Snapshot to SD") | present | **absent** |
| es8311 speaker config | 4 refs | 1 |

- [ ] Port those into `ai_cam_outside.yaml` **one at a time**, onto a board whose camera works.
      A large simultaneous change would make any camera regression impossible to attribute.

---

**Related:** [[2026-08-04-ai-cam-outside-camera-init]] · [[../hardware/ai_cam_outside.yaml]] ·
[[../hardware/landing_ai_cam_2.yaml]] · [[../hardware/ai_cam-compile-runbook]]
