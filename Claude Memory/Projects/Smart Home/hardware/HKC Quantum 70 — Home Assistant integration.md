# HKC Quantum 70 → Home Assistant

**Created:** 2026-08-29 · **Status:** researched, not yet installed — nothing below has been executed
**Panel:** HKC **Quantum 70** (ASSA ABLOY group) · **Installer:** ARC Alarms, Kings Norton, Birmingham B38 8ND · 0121 475 1596 · ARCAlarms.co.uk
**Certification:** NSI logbook issued · panel is **EN 50131-1 Grade 2, Class II**

> Credentials rule: the user code, Site ID and Site password are **deliberately not written
> in this vault** (CLAUDE.md § SENSITIVE DATA). They are read off the keypad on demand — see
> §3. Never paste them into a note, an issue, or a config file that is committed.

---

## 1. Ground truth (from the panel label, keypad and HKC's own datasheet)

### The panel is WIRELESS. This is the fact that determines everything.

HKC's Q70 datasheet describes it as a *Wireless Control Panel*:

| Spec | Value |
|---|---|
| Wireless detectors | **70**, two-way HKC **SecureWave** |
| **Hardwired zones** | **1** (expandable to 10 point-ID devices) |
| Bell output | 1 hardwired **SABB** external bell |
| Comms | **Integrated WiFi module for the SecureComm app** |
| Other interfaces | Serial interface, USB (device) |
| Users / blocks | 32 users, 2 blocks |
| Current | 90 mA quiescent, 300 mA in alarm |
| Grade | EN 50131-1 Grade 2, Class II |

**Consequence:** the four "Circuits" in the NSI logbook are **paired wireless devices**, not
wired loops. There are no zone terminals to tap. Any plan that involves reading zone
resistance with an ADC — the obvious first instinct, and the wrong one here — has nothing
to connect to. The integration has to come over the air or over the app.

### The four devices

| Circuit | Device | Location | Covering |
|---|---|---|---|
| 1 | Contact | Above door (front) | Good |
| 2 | PIR | Lounge | — |
| 3 | PIR | Kitchen | — |
| 4 | Contact + shock | Utility | Good |

### Keypad quick codes (from the inner-cover label — operation, not secrets)

`0*5` User Check · `0*7` Home Alone · **`0*9` SecureComm ID** · `0#1` View User Log ·
`0#3` User Walk Test · **`0#4` Full Set** · `0#5` Full Set, no exit time · `0#6` Chime ·
**`0#7` Part Set A** · **`0#8` Part Set B** · `0#9` Bell and light test.

Keypad keys are `PLAY/QUIT`, `REC/YES`, `LIGHT/NO`. Unset = code + `YES`.
This maps 1:1 onto the handwritten crib on the NSI handbook (`OUT = #4`, `BED = #7`).

---

## 2. The three routes, and which one to take

| Route | Gets you | Cost | Latency | Verdict |
|---|---|---|---|---|
| **A — `ha-hkc` via SecureComm** | Arm/disarm + Full Set / Part Set A / Part Set B + a sensor per device | £0 hardware; **subscription risk, see §3** | ~60 s poll | **Do this first.** Zero hardware, panel already has WiFi. |
| **B — local bell-output tap** | Instant local "alarm is sounding" | ~£6 of parts | sub-second | **Do this second.** It is the answer to A's 60-second blind spot. |
| **C — SecureWave RF sniffing** | Per-device events, locally | — | — | **Don't.** Proprietary two-way encrypted 868 MHz. Not a weekend project. |

### Why A alone is not enough
`ha-hkc` polls HKC's cloud every 60 seconds. For *state* — "is the house set?" — that is
completely fine. For *an actual break-in*, a worst case of 60 seconds before HA knows is
not fine, and it is a cloud dependency in the trigger path for the one automation that
most needs to work when the internet doesn't. Route B fixes exactly that and nothing else.

---

## 3. Route A — `ha-hkc` (HACS custom repository)

**Project:** `jasonmadigan/ha-hkc`. Unofficial, no warranty, not endorsed by HKC; the
README is explicit that HKC could block it at any time. Accept that before depending on it.

### Step 1 — confirm SecureComm is provisioned, and check the bill (do this before anything else)

At the keypad: **`0*9` then your user code** → the display shows your **Site ID and
password**. If they appear, SecureComm is provisioned on the panel.

**⚠ C1 (£0/month forever) risk.** HKC's SecureComm *app* is free, but the SecureComm
**cloud service** carries a subscription — publicly quoted around €9.99 + VAT/month, and
reported to vary by region and by when the install was signed up; many installs are bundled
by the installer at no extra charge. **This is unverified for your account.** Ring ARC
Alarms on 0121 475 1596 and ask, in these words: *"is SecureComm on my panel billed to me,
included in my maintenance, or not enabled?"* If the answer is a monthly fee you aren't
already paying, Route A costs money and C1 says stop — go to Route B and treat the alarm as
a sensor-only input.

### Step 2 — install

1. HACS → three-dot menu → **Custom repositories** → add `https://github.com/jasonmadigan/ha-hkc`, type *Integration*.
2. Install, restart HA.
3. Settings → Devices & Services → **Add Integration** → **HKC Alarm**.
4. Enter **Panel ID**, **Panel Password** (both from `0*9` above, same as the app) and your **Alarm code / PIN**.
5. Leave the update interval at **60 s** — the README asks for this explicitly, to match the mobile app's own polling and not hammer HKC's API. Do not lower it.

Because the Q70 has an **integrated WiFi module**, the README's GSM rate-limiting warning
does not apply to this panel.

### Step 3 — what you get

- One `alarm_control_panel` entity. States map: **Full Set → `armed_away`**,
  **Part Set A → `armed_home`**, **Part Set B → `armed_night`**, plus `disarmed`.
  Arm and disarm both work.
- One sensor per input, state `Open` / `Closed` — i.e. all four devices above.
- Attributes for command feedback: *Last Command*, *Last Command State*, *Last Command
  Result*, with timestamps.

**Entity IDs, derived from ha-hkc v1.3.3 source** (not guessed): single-panel installs
label the device `HKC Alarm System` (`helpers.py:95`), and the panel entity carries no name
of its own (`alarm_control_panel.py:54`), so:

- `alarm_control_panel.hkc_alarm_system`
- `sensor.hkc_alarm_system_<zone description>` x4 — descriptions are whatever ARC programmed,
  so these four are the only IDs still to read off the registry.

A 2-block panel goes "multi-view" and is named per block instead; check Developer Tools
before assuming. `ha-config/hub/packages/alarm.yaml` is written against the single-view IDs.

**Zone sensors are not binary sensors.** States are `Open` / `Closed` / `Tamper` /
`Inhibited` / `Unused` / `Unknown` (`sensor.py:133-153`), so `is_state(..., 'on')` never
matches. A zone also reads `Open` if it triggered within 60 s of panel time — i.e. a PIR
shows `Open` for up to a minute after it sees you.

---

## 4. Route B — local bell tap (`esphome/alarm-bell-tap.yaml`)

The panel has a hardwired **SABB external bell output**. An opto-isolator across it gives
Home Assistant a sub-second, LAN-local, internet-independent "the alarm is sounding" signal.

**This is work inside a Grade 2, NSI-certified panel.** See §6 before opening the lid. The
clean version of this job is to ask ARC to terminate a spare programmable output to a pair
of terminals for you — an engineer visit, done properly, no certificate risk.

Wiring and the ESPHome config: `ha-config/hub/esphome/alarm-bell-tap.yaml`.

---

## 5. What these four sensors are actually good for

Be honest about this, because it changes what you build on top.

**Good for — security state and events:**
- A real house mode for JARVIS: set / part-set / unset as the top-level context that
  everything else keys off (away lighting, heating setback, camera arming, TTS suppression).
- Front-door and utility-door open events.
- Alarm-triggered response: lights to 100 %, Frigate record, TTS, push to the Fold 7.

**Bad for — occupancy and lighting:**
Wireless alarm PIRs are battery-powered (CR123A, ~8 µA quiescent) and deliberately throttle
how often they transmit, so they cannot be polled like a mains occupancy sensor. Combined
with a 60-second cloud poll on Route A, the lounge and kitchen PIRs are **unsuitable for
driving lights** — you would get a light that comes on a minute late and stays on. *(The
exact re-trigger lockout for your specific detectors is not documented in the public
datasheets — read it off the device manual or a walk test before relying on any figure.)*

You already have the right tool for presence: the mmWave/radar nodes and the ai_cam person
detection in `MASTER_PLAN` §4. **Leave lighting to those. Use the alarm for security only.**
Two systems, two jobs — do not merge them.

---

## 6. Before you touch the panel — the certification question

This is a professionally installed, **NSI**-logged, **EN 50131 Grade 2** system with a
maintenance relationship with ARC Alarms.

- Route A touches **nothing** physical. It is an app-level integration and carries no
  certificate or contract risk.
- Route B puts a device across the bell output. On a graded system that is engineer work.
  Doing it yourself can invalidate the maintenance agreement, and a bell-output fault will
  be logged against you.
- Opening the enclosure will raise a **tamper** on a set system. Unset first; expect the
  event in the log either way.

**Recommended:** do Route A yourself. Ask ARC to fit Route B — a spare programmable output
brought out to terminals — at the next service visit. It is ten minutes of their time and it
keeps the certificate and the contract intact.

---

## 7. Open items

> Step-by-step install sequence: [[fixes/HKC alarm — HA install runbook]]

- [ ] `0*9` + user code → confirm Site ID/password exist (i.e. SecureComm provisioned)
- [ ] **Ring ARC Alarms 0121 475 1596 — is SecureComm billed? (C1 gate)**
- [ ] Install `ha-hkc` via HACS; record the real entity IDs
- [ ] Fix the `# CONFIRM` placeholders in `packages/alarm.yaml`, then enable it
- [ ] Ask ARC to terminate a spare programmable output for the local tap
- [ ] Read the detectors' re-trigger lockout off their manual — settles §5 with a number

## Sources

- HKC Quantum 70 datasheet — hkcsecurity.com/ie/en/documents/panels/Q70.pdf
- `jasonmadigan/ha-hkc` README — github.com/jasonmadigan/ha-hkc
- HKC SecureComm FAQ — hkcsecurity.com/gb/en/documents/alarm-user-/App_SecureComm_FAQ_Jan_2022.pdf
- Panel inner-cover label and NSI logbook, photographed 2026-08-29
