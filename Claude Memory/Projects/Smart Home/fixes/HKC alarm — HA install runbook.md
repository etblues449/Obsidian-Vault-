# HKC Quantum 70 → Home Assistant: install runbook

**Created:** 2026-08-29 · **Panel:** HKC Quantum 70 · **Hub:** HA Green @ 192.168.0.200
**Status: step 0 RUN 2026-08-29 — SecureComm came back "Not installed", so Route A is
blocked pending an ARC engineer visit.** Steps 2-6 are written to be executed; none has been.

> Read [[hardware/HKC Quantum 70 — Home Assistant integration]] first if you want the
> reasoning. This file is just the sequence.

Roughly 30 minutes, most of it waiting for a restart. Do the steps in order — step 0
can make the rest pointless, which is why it is step 0.

---

## Step 0 — SecureComm status ✅ DONE 2026-08-29 — result: **NOT INSTALLED**

`0*9` on the keypad returns **"Not installed"**. Verified on the panel, photographed.

**This blocks Route A completely.** SecureComm is not provisioned, so there is no Site ID and
no password, so `ha-hkc` has nothing to authenticate with. Do not install the integration
yet — it cannot connect.

The panel hardware is not the problem: HKC's Q70 datasheet lists an **integrated WiFi module
for the SecureComm app**, so the radio is already in the box. "Not installed" is the panel
reporting that the SecureComm communicator is not *enabled in programming* and not registered.

### Enabling it is an engineer job — do not do it yourself

Enabling SecureComm lives in **engineer mode**: comms menu → SecureComm → enable → enter
Installation ID and password; and the Wi-Fi scan and password entry are engineer-mode only.

Published default engineer codes exist. **Do not use one.** On this system that means:

- entering engineer mode on a **Grade 2, NSI-certified** system maintained by a third party,
  which can void the maintenance agreement,
- an engineer-access event written into the panel log with your name effectively on it,
- and ARC will have changed the default code anyway.

Ten minutes of ARC's time removes all of that risk. It is not worth saving.

### Step 0a — the call to ARC (this is now the whole gate)

**ARC Alarms, 0121 475 1596.** Quote the site reference shown on the keypad's idle banner.

Ask, in order:

1. *"`0*9` says SecureComm is Not installed. Can you enable it and register the panel?"*
2. *"What does that cost — one-off, and is there a monthly SecureComm cloud charge?"*
   (publicly quoted around €9.99+VAT/month, varies by region and signup, often bundled —
   **unverified for this account**, which is exactly what you are asking)
3. *"While you're there: can you bring the Bell and Strobe outputs out to accessible
   terminals, and can one be programmed to Set/Armed status?"* — that is Route B, and it
   costs you nothing extra if they are already on site.

**Decision:**

| ARC says | Do |
|---|---|
| Enabled, no monthly charge | Route A. Continue to step 1. |
| Enabled, but a monthly fee | **C1 says stop.** Route B only — see the appendix. |
| Won't enable / wants real money | Route B only — see the appendix. |

Ask for the outputs (question 3) **whatever the answer to 1 and 2**. Route B is worth having
even if Route A works, because it is the local, sub-second, internet-independent path.

## Step 1 — get your Site ID and password (2 min) — BLOCKED until step 0a

Once ARC has enabled SecureComm, at the keypad:

```
0 * 9   then your user code
```

The display shows your **Site ID** and **password** instead of "Not installed". Write them on
paper.

**Do not type these into the vault, a note, or a commit.** They go straight into HA's config
flow, which stores them encrypted in `.storage`, and nowhere else.

## Step 2 — install ha-hkc through HACS (5 min)

1. HACS → ⋮ (top right) → **Custom repositories**
2. Repository: `https://github.com/jasonmadigan/ha-hkc` · Type: **Integration** → Add
3. Find **HKC Alarm** in the HACS list → **Download**
4. **Restart Home Assistant** (Settings → System → ⋮ → Restart). Required — it ships a
   Python dependency (`pyhkc`) that only loads on a restart.

## Step 3 — add the integration (3 min)

Settings → Devices & Services → **+ Add Integration** → **HKC Alarm**.

The form asks, in this order:

| Field | What to enter |
|---|---|
| **Alarm code** | your user code (the one you unset with) |
| **Panel password** | from `0*9` in step 1 |
| **Panel ID** | from `0*9` in step 1 |
| Additional user codes | leave blank |
| Require user PIN | **leave off** — on = HA demands the PIN on every arm/disarm |
| Update interval | **leave at 60** — the README asks for this to match the app's own polling. Minimum accepted is 30; don't. |

If it rejects the credentials it says `invalid_auth` — that is the panel refusing them, so
re-read them off the keypad rather than retrying the same values.

## Step 4 — confirm what you actually got (5 min)

Developer Tools → **States** → filter `hkc`.

Expect one panel entity and four sensors. From ha-hkc's source (v1.3.3), single-panel
installs name the device **"HKC Alarm System"**, so:

- `alarm_control_panel.hkc_alarm_system`
- `sensor.hkc_alarm_system_<zone description>` ×4 — the descriptions are whatever ARC
  programmed, so these are the one thing you have to read rather than predict.

**Write the four sensor IDs down.** Step 5 needs them.

State meanings, confirmed from source:

| Panel state | Means | Keypad |
|---|---|---|
| `armed_away` | Full Set | `0#4` |
| `armed_home` | Part Set A | `0#7` (your "BED") |
| `armed_night` | Part Set B | `0#8` |
| `disarmed` | Unset | code + YES |
| `triggered` | In alarm | — |

Zone sensors read **`Open` / `Closed` / `Tamper` / `Inhibited` / `Unused` / `Unknown`** —
they are *not* binary sensors, so `is_state(..., 'on')` will never match. Note also that a
zone reads `Open` if it triggered within 60 s of the panel's clock, so a PIR shows `Open`
for up to a minute after it sees you.

**Quick proof it works:** open the front door and watch that sensor flip within ~60 s.

## Step 5 — the automation layer (10 min)

`ha-config/hub/packages/alarm.yaml` in this vault gives you house-mode sensors, intrusion
response, set/unset actions, an integration watchdog, and a zone-fault warning at set time.

1. In `configuration.yaml`, once, at top level:
   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```
2. Copy `alarm.yaml` to `/config/packages/alarm.yaml` on the hub.
3. Fix the two things it can't know:
   - `scene.evening_arrival` — create it, or repoint that action at a real scene
   - if step 4 showed a **different** device name (2-block panels go "multi-view"),
     search/replace `hkc_alarm_system` throughout
4. Developer Tools → **Check configuration** → then restart.

`notify.mobile_app_jelly_bean_s_phone` is already correct — taken from your live
`configuration.yaml`, not guessed.

## Step 6 — test it properly (5 min)

1. Set the alarm (`0#4`), watch `sensor.house_security_mode` → **Away** within 60 s.
2. Unset → **Home**.
3. **Do not test the intrusion automation by letting the bell run.** Temporarily change
   the trigger in `alarm_intrusion_response` to a helper toggle, fire that, confirm the
   push and the lights, then change it back. Your neighbours and the ARC log will thank
   you.

---

## Appendix — Route B, the local path (now the likely primary)

Needed if ARC won't enable SecureComm, or enables it with a monthly charge (C1 says no).
Worth building **even if Route A works**, because it is local and sub-second.

### What the panel gives you

The Q70 has **two high-current outputs: Bell and Strobe** (HKC Q70 install manual). Those
are the tap points. Note your external sounder may be HKC's **RF SABB** — a *wireless* bell —
in which case the hardwired Bell/Strobe terminals are sitting unused on the board, which
makes them easier to borrow, not harder.

Ask ARC for, in order of preference:

1. **A spare output programmed to "Set/Armed"** plus the **Bell** output, both brought out to
   accessible terminals. This is the good outcome: local house mode *and* local alarm.
2. **Bell output only.** Still gets you the single most valuable signal in the system —
   *the alarm is sounding* — locally, in well under a second, with no internet.

### Then

`ha-config/hub/esphome/alarm-bell-tap.yaml` is written and waiting. It is an opto-isolated
tap: the ESP32 shares no ground with the panel, draws nothing from it, and pulling its power
leaves the alarm completely unaffected. GPIO32 is the Bell input; GPIO33 is commented in for
the Set output — uncomment it if you get outcome 1.

Parts: an ESP32 devkit, a PC817 opto, a 2k2 and a 10k resistor. About £6, all likely already
in your parts box. Power it from its **own** USB supply, never panel AUX — the Q70's battery
is sized for a Grade 2 standby calculation and an ESP32 eats that margin.

**Commission it properly** — the four checks at the bottom of the ESPHome file, especially
the multimeter polarity check in both set and unset states. Get that backwards and the
intrusion automation fires when nothing is wrong.

### What Route B gives you vs Route A

| | Route A (SecureComm) | Route B (local tap) |
|---|---|---|
| Alarm sounding | ≤60 s, via cloud | **sub-second, local** |
| Set / unset state | yes | only with outcome 1 |
| Per-zone Open/Closed | yes, all four | no |
| Arm / disarm from HA | yes | no |
| Works with no internet | no | **yes** |
| Monthly cost | **possibly** | £0 |

They are complementary, not alternatives. If ARC enables SecureComm for free, do both.

## Known limits, stated up front

- **Cloud polling, 60 s.** `iot_class: cloud_polling`. No internet, no alarm state in HA.
- **Unofficial.** No warranty; the README says HKC could block it at any time. The
  watchdog automation exists for exactly that.
- **Not for lighting.** Wireless alarm PIRs behind a 60 s poll cannot drive lights.
  Presence stays with the mmWave/radar nodes and ai_cam per [[MASTER_PLAN]] §4.
