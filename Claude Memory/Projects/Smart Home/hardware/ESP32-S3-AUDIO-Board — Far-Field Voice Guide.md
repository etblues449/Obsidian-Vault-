---
tags: [smart-home, esp32, voice, jarvis, hardware]
project: Smart Home
created: 2026-07-15
device: Waveshare ESP32-S3-AUDIO-Board
status: research + build guide
---

# ESP32-S3 AI Smart Speaker — Getting the Most Out of It (Far-Field Voice, TV On or Off)

**Goal:** make the board hear "Hey Jarvis" (and commands) from anywhere in the room, with the TV on or off, wired into your existing HA Green + ESPHome + Assist stack.

**TL;DR (read this even if you read nothing else):**

1. Your board is almost certainly the **Waveshare ESP32-S3-AUDIO-Board**. Its dual-mic + ES7210 4-channel ADC gives it real **Acoustic Echo Cancellation (AEC)** and **directional source separation (BSS)** — but only in *software*, with no XMOS DSP. It is a strong **near/mid-field** device, not a magic whole-room-with-TV-blaring device.
2. **The single most important truth:** AEC cancels *the board's own speaker audio*, because it has a copy of it (a "reference" signal). It **cannot** cancel your **external TV**, because it has no reference of the TV's sound. This is the exact reason the official HA Voice hardware "won't distinguish between your voice and the TV's audio." No 2-mic board fixes this in software alone.
3. **Best results = physics + placement + numbers, not just config:** one board won't blanket a big lounge over a loud TV. Deploy **2–3 satellites per large room**, put one **closer to where you sit than to the TV**, run **on-device wake word (microWakeWord)**, enable the **full ESP-SR audio front-end (AEC + BSS + NS + AGC)**, and route media/TTS *through the board* so AEC gives you true "barge-in."
4. If, after all tuning, TV-on far-field at 3 m+ still fails, that's the **hardware ceiling of a 2-mic no-XMOS board.** The honest upgrade for the primary lounge unit is a **4-mic XMOS array** (ReSpeaker XVF3800 or HA Voice Preview Edition); keep the Waveshare boards as satellites in quieter rooms.

---

## 1. What the board actually is

The name "ESP32-S3 AI Smart Speaker Development Board, dual microphone array, noise reduction & echo cancellation, surround RGB" is the **Waveshare ESP32-S3-AUDIO-Board** (launched Aug 2025).

| Part | Spec | Why it matters for voice |
|---|---|---|
| SoC | **ESP32-S3R8** — dual LX7 @240 MHz, WiFi 4, BT 5 LE | The S3's vector/AI instructions are what let the ESP-SR audio front-end run in real time. This is the *only* ESP32 that can do this. |
| PSRAM | **8 MB** | The full AFE needs ~1.1 MB PSRAM; 8 MB is ample headroom. |
| Flash | **16 MB** | Room for wake-word + command models + OTA. |
| Codec (out) | **ES8311** mono codec → speaker header | Playback path; its output is what AEC uses as its echo reference. |
| ADC (in) | **ES7210** — 4-channel TDM audio ADC | **The key chip.** 4 channels = 2 mics + spare + a **loopback reference channel** for AEC. This is what makes hardware-grade echo cancellation possible. |
| Mics | **Dual digital MEMS array** | 2 mics ⇒ enables BSS (directional separation) + 2-mic AEC. (True beamforming really wants 3–4; see §3.) |
| Extras | 7× addressable RGB LEDs, USB-C, microSD, LCD + DVP camera FPC headers, Li-ion charger | RGB = listening/thinking/reply feedback; camera/LCD headers = future presence/UI. |

Supported stacks: **ESP-IDF** (native), **ESP-SR** (offline wake + command), **ESP-ADF** (audio pipelines), and — critically for you — **ESPHome**, which now wraps ESP-SR's audio front-end.

---

## 2. The one concept that explains everything: echo reference

Every "smart speaker that hears you over its own music" does it with **Acoustic Echo Cancellation**. AEC works like this:

```
                    ┌─────────────── reference (what we are PLAYING) ───────────────┐
                    │                                                               ▼
   speaker  ◀── ES8311 ◀── audio out                                    ┌──────── AEC ───────┐
                                                                        │ mic_in − reference │──▶ clean voice
   your voice + speaker echo ──▶ mics ──▶ ES7210 ch0/1 ─────────────────▶│                    │
   TV audio ─────────────────▶ mics ──▶ ES7210 ───────────────────────▶ (no reference!) ─────┘  ← TV survives
```

- **Board's own audio** (music, TTS, or *any media you route through it*): AEC has the reference → it subtracts it → you can shout "stop" over full-volume playback ("barge-in"). ✅
- **External TV / another speaker**: the board has **no reference signal** for it → AEC has nothing to subtract → **the TV comes through with your voice.** ❌

This is not a bug or a tuning problem — it is the physics of echo cancellation. It's why every consumer smart speaker also struggles when a *separate* TV is loud, and why the fixes below lean on **placement, direction (BSS), and multiple devices**, not on AEC.

**Practical consequence:** the biggest lever you have against the TV is to **make the board the thing that plays the TV/media audio** (so AEC gets a reference), or failing that, to **exploit direction and distance** (BSS + placement + more satellites).

---

## 3. The ESP-SR Audio Front-End (AFE) — every tool you get

ESP-SR's AFE is the software DSP chain that runs on the S3. Full chain costs ≈ **22% CPU, 48 KB SRAM, 1.1 MB PSRAM** — trivial on this 8 MB board. Modules:

| Module | What it does | Use for TV/far-field? |
|---|---|---|
| **AEC** (Acoustic Echo Cancellation) | Removes the echo of **the board's own** playback using the reference channel. 2-mic capable. | ✅ Essential for barge-in over *your* media/TTS. Useless against *external* TV (no reference). |
| **BSS** (Blind Source Separation) | Uses the 2 mics to detect the **direction** of sound and enhance the target direction while suppressing others. | ✅ **Your best weapon against the TV** — if you and the TV are at different angles from the board, BSS pulls your voice out. |
| **NS** (Noise Suppression) | Suppresses **stationary** non-speech noise (hum, fan, HVAC). | ⚠️ Helps with constant hum; weak against TV *dialogue* (non-stationary). Don't over-crank — it adds artifacts that hurt recognition. |
| **AGC** (Automatic Gain Control) | Amplifies weak (far) input to a usable level. | ✅ Lifts your far voice; set moderately. |
| **VAD** (Voice Activity Detection) | Flags speech vs non-speech per frame; used for end-pointing. | ✅ Cleaner command capture / faster turn-taking. |
| **WakeNet / microWakeWord** | Neural wake-word engine, runs on-device. | ✅ Fires *before* anything hits the network; robust models are noise-trained. |
| **MISO / MultiNet** | Multi-in-single-out selection; offline **command** recognition. | ✅ Bonus: fully-local commands even if HA/Wi-Fi is down (§7). |

**Mic geometry:** ESP-SR's 2-mic algorithms want the two mics **20–80 mm apart** (the Waveshare array is within this). Two mics give you *directional separation and 2-mic AEC*, which is genuinely good for near/mid-field. What two mics **cannot** match is a **3–4 mic beamforming array with a dedicated XMOS DSP** (Korvo-1 = 3 mic; ReSpeaker / HA Voice PE = 4 mic + XMOS) for **far-field over loud noise**. Set expectations accordingly (§6).

---

## 4. Two software roads

### Road A — ESPHome + HA Assist  ← recommended, fits your stack
Native to your HA Green + ESPHome world. ESPHome (2026.x) now exposes ES7210 + the ESP-SR audio front-end, so you get **on-device AEC (+ optional BSS/NS/AGC) and microWakeWord**, feeding straight into your Assist pipeline. Requires **Home Assistant ≥ 2026.6.0** (dual-channel mic support) and a recent ESPHome (field-tested on **2026.6.4**). Standalone AEC uses ≈ 80 KB internal RAM; mode **`sr_low_cost`** is the recommended balance for voice-assistant + wake word.

- **Pros:** turnkey Assist integration, OTA, "Hey Jarvis" community wake word, exposes `noise_suppression_level`, `auto_gain`, `volume_multiplier`, per-mic `gain_factor`.
- **Cons:** slightly less tuning depth than raw ESP-IDF; 2-mic ceiling remains.
- **Verdict:** start here. It gets you ~90% of the way with 10% of the effort. See the ready-to-flash config: [[ESP32-S3-AUDIO-Board.esphome.yaml]].

### Road B — ESP-IDF + ESP-Skainet / ESP-ADF  ← maximum performance, more work
Program the board natively with Espressif's ESP-Skainet, exposing **every AFE knob** and offline **MultiNet** command recognition. You can bridge it to HA over **Wyoming** or a custom API, but you lose turnkey Assist and take on real firmware maintenance.
- **Do this only if** Road A's far-field-over-TV proves insufficient *and* you don't want to buy a 4-mic array.

---

## 5. The build recipe for "anywhere in the room, TV on or off"

Do these in order; each is cheap and compounding.

**A. Numbers beat wishes — deploy multiple satellites.**
One 2-mic board will not cover a large lounge over a loud TV, any more than one Alexa covers a house. HA runs ~5 simultaneous satellites comfortably on a Pi-4-class box; the **last satellite to hear the wake word wins**, and microWakeWord keeps CPU/network load tiny. Put **2–3 nodes** in a big room: one by the seating, one by the door/kitchen pass-through.

**B. Beat the inverse-square law — placement is free SNR.**
Sound falls off with distance²; moving a satellite **1 m closer to your seat than to the TV** can swing the signal-to-noise ratio more than any setting. Guidelines:
- Put a satellite **closer to where you actually sit** than to the TV speakers.
- Keep it **off the TV's direct acoustic axis** so BSS sees you and the TV at different angles.
- **20–30 cm off walls**, not jammed in a corner (reduces reflections).
- Away from vents/vibrating appliances. A rug or curtains help recognition more than any software tweak.

**C. Give AEC a reference wherever you can.**
- Route **music/podcasts/TTS through the board** → AEC nukes its own output → true "stop"/"pause" barge-in at full volume.
- For the **TV** specifically, the strongest structural fix is to feed the AFE a **TV reference** (e.g. make the board part of the TV audio path) — otherwise you're relying on BSS + placement, not AEC.

**D. Turn on the right AFE modules (Road A settings).**
- **AEC:** always on (`sr_low_cost`).
- **BSS / source separation:** on — your main directional edge over the TV.
- **NS (`noise_suppression_level`):** **2–3**, not 4. Over-suppression creates "musical noise" that *lowers* wake-word accuracy.
- **AGC (`auto_gain`):** ~**15–20 dBFS** to lift far voice; back off if you get clipping/false wakes.
- **`volume_multiplier`:** raise only if your voice is still too quiet after AGC.

**E. Tune the wake word.**
- Use **microWakeWord** on-device with a **distinctive phrase** — "**Hey Jarvis**" (community-trained, on-theme, and less TV-triggered than short words).
- If the TV causes **false wakes**, **raise the probability threshold**; if it **misses** you, lower it slightly. Trade sensitivity against false-accepts deliberately.

**F. Room acoustics (last 10%).** Soft furnishings, rug, curtains, avoid a glass/tile echo chamber.

---

## 6. Honest expectation table

| Scenario | Single Waveshare board (tuned) | With 2–3 satellites + placement |
|---|---|---|
| Near-field, 0–1 m, TV off | Excellent | Excellent |
| Mid-field, 1–3 m, TV off | Good | Excellent |
| Mid-field, 1–3 m, **TV on (moderate)** | Fair (BSS helps if off-axis) | Good |
| Far-field, 3 m+, TV off | Fair | Good |
| Far-field, 3 m+, **TV on (loud)** | **Poor** — 2-mic ceiling | **Fair–Good** (nearest node wins) |
| Barge-in over **the board's own** music/TTS | **Excellent** (AEC) | Excellent |

The bottom-right cell is where hardware wins: if loud-TV-at-distance is a hard requirement for the **primary lounge unit**, a **4-mic XMOS array** (ReSpeaker XVF3800 / HA Voice Preview Edition) is the honest fix. Use it as the lounge primary and keep the Waveshare boards as satellites elsewhere — they're excellent in bedrooms, kitchen, office where noise is lower.

---

## 7. Bonus: squeeze extra value out of the hardware

- **Fully-offline commands:** ESP-SR **MultiNet** recognizes a set of command phrases *on-device* — lights/scenes still work if HA or Wi-Fi is down. Great resilience layer for JARVIS.
- **RGB feedback:** drive the 7 LEDs for **listening / thinking / speaking / error** states (WLED-style or ESPHome light effects) — big usability win for far-field ("did it hear me?").
- **LCD + camera headers:** future presence detection / a little status display; pairs with your RuView CSI presence work.
- **It's also a media_player:** the ES8311 + speaker means the same box can be your room's TTS output and a small music endpoint — which, per §5C, is exactly what makes AEC barge-in shine.

---

## 8. Recommendation for *your* setup (JARVIS / HA Green)

1. **Flash Road A** ([[ESP32-S3-AUDIO-Board.esphome.yaml]]) — ES7210 4-ch + ESP-SR AFE (AEC+BSS+NS+AGC) + microWakeWord "Hey Jarvis", into Assist. Confirm HA ≥ 2026.6.0 and a current ESPHome first.
2. **Place it closer to your seat than the TV, off-axis.** Test wake at 1 m / 3 m / across-room, TV off then on. Log what works.
3. If the lounge-with-loud-TV case fails at distance, **add a second Waveshare satellite** on the other side of the seating before spending money.
4. Only if that's still not enough, buy **one 4-mic XMOS array** as the lounge primary; redeploy the Waveshare boards to bedroom/kitchen/office where they'll excel.
5. Wire the **RGB states** and (optionally) **MultiNet offline commands** for the full JARVIS feel and network-down resilience.

---

## Sources
- [Waveshare ESP32-S3-AUDIO-Board (product page)](https://www.waveshare.com/esp32-s3-audio-board.htm)
- [CNX Software — ESP32-S3-AUDIO-Board devkit writeup](https://www.cnx-software.com/2025/08/30/esp32-s3-audio-board-smart-speaker-devkit-dual-mic-array-lcd-camera-rgb-leds/)
- [ESP-SR Audio Front-End Framework (ESP32-S3)](https://docs.espressif.com/projects/esp-sr/en/latest/esp32s3/audio_front_end/README.html)
- [ESP Audio Front-End Algorithms (Espressif)](https://www.espressif.com/en/solutions/audio-solutions/esp-afe)
- [ESP-SR Acoustic Echo Cancellation](https://docs.espressif.com/projects/esp-sr/en/latest/esp32/acoustic_echo_cancellation/README.html)
- [ESPHome ES7210 audio ADC component](https://esphome.io/components/audio_adc/es7210/)
- [ESPHome Voice Assistant component](https://esphome.io/components/voice_assistant/)
- [ESPHome Microphone components](https://esphome.io/components/microphone/)
- [Home Assistant Voice Preview Edition](https://www.home-assistant.io/voice-pe/)
- [HA Voice PE review — TV noise limitation](https://manualdousuario.net/en/home-assistant-voice-preview-edition-foss-smart-home-review/)
- [On-device wake word on ESP32-S3 (Voice: Chapter 6)](https://www.home-assistant.io/blog/2024/02/21/voice-chapter-6/)
- [The Home Assistant approach to wake words](https://www.home-assistant.io/voice_control/about_wake_word/)
- [Best HA Voice Satellites 2026 (far-field / XMOS comparison)](https://www.smarthomeexplorer.com/guides/best-home-assistant-voice-satellite-2026)
- [ESP32-S3-Korvo-2 (2-mic) user guide](https://docs.espressif.com/projects/esp-adf/en/latest/design-guide/dev-boards/user-guide-esp32-s3-korvo-2.html)
