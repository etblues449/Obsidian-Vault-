# HKC Quantum 70 → Home Assistant: install runbook

**Created:** 2026-08-29 · **Panel:** HKC Quantum 70 · **Hub:** HA Green @ 192.168.0.200
**Status: NOT YET RUN.** Every step below is written to be executed; none has been.

> Read [[hardware/HKC Quantum 70 — Home Assistant integration]] first if you want the
> reasoning. This file is just the sequence.

Roughly 30 minutes, most of it waiting for a restart. Do the steps in order — step 0
can make the rest pointless, which is why it is step 0.

---

## Step 0 — the £0 gate (5 min, do this FIRST)

The integration talks to HKC's **SecureComm cloud**. The app is free; the *cloud service*
is publicly quoted around **€9.99+VAT/month**, varying by region and signup date, and is
often bundled by the installer at no extra charge. **I could not verify which applies to
you** — and constraint C1 says £0/month forever.

**Ring ARC Alarms: 0121 475 1596.** Ask exactly:

> "Is SecureComm on my panel billed to me, included in my maintenance, or not enabled?"

- **Included / already paid** → carry on to step 1.
- **Not enabled** → ask them to enable it; ask the cost before agreeing.
- **A monthly fee you aren't already paying** → **stop.** Route A is out on C1. Skip to
  the appendix.

## Step 1 — get your Site ID and password off the keypad (2 min)

At the panel keypad:

```
0 * 9   then your user code
```

The display shows your **Site ID** and **password**. Write them on paper.

- They appear → SecureComm is provisioned. Good.
- Nothing, or an error → not provisioned. Back to step 0, second bullet.

**Do not type these into the vault, a note, or a commit.** They go straight into HA's
config flow, which stores them encrypted in `.storage`, and nowhere else.

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

## Appendix — if step 0 says SecureComm costs money

Route A is out on C1. What remains:

1. **The local bell tap alone** (`esphome/alarm-bell-tap.yaml`). No cloud, no
   subscription, £0/month, sub-second. You lose arm/disarm and per-zone state; you keep
   the single most valuable signal — *the alarm is going off* — and you keep it working
   when the internet is down.
2. **Add a "Set" output** on the same node (the config has it commented in, on GPIO33)
   for a local armed/unarmed signal. That recovers house mode without the cloud.

Together those give you ~80% of the value for a one-off £6 and an engineer visit, with no
recurring cost and no dependency on an unofficial API. Ask ARC to terminate both outputs
at the next service — it is ten minutes of their time and keeps the Grade 2 certificate
and the maintenance agreement intact.

---

## Known limits, stated up front

- **Cloud polling, 60 s.** `iot_class: cloud_polling`. No internet, no alarm state in HA.
- **Unofficial.** No warranty; the README says HKC could block it at any time. The
  watchdog automation exists for exactly that.
- **Not for lighting.** Wireless alarm PIRs behind a 60 s poll cannot drive lights.
  Presence stays with the mmWave/radar nodes and ai_cam per [[MASTER_PLAN]] §4.
