# Tasker HTTP Bridge — The Real Fix

**Status:** V.A.U.L.T. app side DONE (deployed). Phone side: ~5 minutes below.
**Why it never worked before:** `Preferences → Misc → Allow External Access` does **not** start an HTTP server — it only allows control via intents/ADB. Tasker's HTTP server only runs while an **Event → HTTP Request profile** is active. We were testing a server that was never running. This doc builds the server properly.

---

## What you get

Say into V.A.U.L.T.: *"set an alarm for 7:30"* →
1. Capture files to the vault (as now), **and**
2. V.A.U.L.T. POSTs `{"task":"Jarvis Alarm","par1":"07:30","par2":"JARVIS"}` to `http://localhost:1337/` on the phone, **and**
3. Tasker's bridge profile catches it and runs your existing **Jarvis Alarm** task → alarm is set, hands-free.

If the bridge is off, V.A.U.L.T. shows an amber **"TAP TO SET VIA CLOCK APP"** button instead (system intent fallback) — so actions work either way.

---

## Build the bridge (Tasker, ~5 min)

### 1. The Task: `JARVIS Bridge`

Tasker → **Tasks** tab → **+** → name: `JARVIS Bridge`

Add **Action 1**: search **Perform Task**
- **Name:** `%http_request_body.task`
- **Parameter 1 (%par1):** `%http_request_body.par1`
- **Parameter 2 (%par2):** `%http_request_body.par2`

(That's Tasker's structured-variable access — it reads the JSON body's fields directly. The task name arrives dynamically, so this one bridge dispatches ALL your Jarvis tasks: Alarm, Timer, SMS, Reminder, Calendar, OpenApp, Notify.)

Add **Action 2**: search **HTTP Response**
- **Status:** 200
- **Body:** `{"ok":true}`

Back-arrow to save.

### 2. The Profile: HTTP server on port 1337

Tasker → **Profiles** tab → **+** → **Event** → **Net** → **HTTP Request**
- **Port:** `1337`
- **Path:** leave blank (matches any)
- **Methods:** leave blank or `POST`

Link it to the **JARVIS Bridge** task → back-arrow to save → make sure the profile toggle is **ON**.

### 3. Keep it alive

- Tasker → Preferences → **Monitor** → set **Run in Foreground** ON (persistent notification keeps Android from killing the server)
- Battery optimisation for Tasker: set to **Unrestricted** (Settings → Apps → Tasker → Battery)

---

## Test it (on the phone)

**Test A — server up?** In any phone browser, open:
```
http://localhost:1337/
```
Anything other than "connection refused" (even an error page) = server is listening.

**Test B — full loop.** In V.A.U.L.T., capture: `set an alarm for 9:15`
- Green `⚡ ALARM 09:15 → SENT TO TASKER` banner = bridge worked → check the Clock app: alarm exists.
- Amber `BRIDGE OFFLINE` banner = profile not active or port mismatch → re-check step 2.

**Test C — direct (Termux or any terminal):**
```bash
curl -s -X POST http://localhost:1337/ -d '{"task":"Jarvis Notify","par1":"Bridge works","par2":"JARVIS"}'
```
Expect a notification titled "Bridge works".

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Connection refused on Test A | Profile is off, or Tasker was killed — toggle profile on, enable Run in Foreground |
| Banner says SENT but nothing happens | Task name mismatch — bridge sends `Jarvis Alarm` / `Jarvis Timer`; your Tasker task names must match exactly |
| Alarm sets wrong time | Your `Jarvis Alarm` task expects `%par1` as `HH:MM` — check the Set Alarm action uses `%par1` split on `:` (hours/minutes) |
| Works on wifi, dies later | Battery optimisation killed Tasker — set to Unrestricted |
| `%http_request_body.task` comes through literally | Old Tasker version — structured variables need Tasker 6.0+; update Tasker |

---

## Actions V.A.U.L.T. currently detects

| You say | Bridge call | Fallback intent |
|---|---|---|
| "…alarm for 7:30…" / "alarm at 6 am" | `Jarvis Alarm` par1=`07:30` | Clock app SET_ALARM |
| "…timer for 20 min…" / "timer 1 hour" | `Jarvis Timer` par1=minutes | Clock app SET_TIMER |

More verbs (SMS, reminder, calendar, open app, notify) can be added to the app's `detectAction()` — the bridge already handles ALL of them since it dispatches by task name.
