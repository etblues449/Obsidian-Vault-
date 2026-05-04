---
name: Automations and apps overview
description: Imported Claude.ai conversation from 2026-04-15 (34 messages)
type: reference
uuid: 2aead9d7-79f8-443a-bbf4-aa5949e601c9
created_at: 2026-04-15T05:05:07.367331Z
updated_at: 2026-04-15T06:41:05.101422Z
---

# Automations and apps overview

## human — 2026-04-15 05:05:08

Automations, apps and more

## assistant — 2026-04-15 05:05:15


```
This block is not supported on your current device yet.
```

Good context from recent sessions. You've been building out this system steadily. Looking at your project files, the latest automation YAML (14/04/26) and the three ESPHome configs (bedroom, landing, lounge) are all current. What specifically do you want help with today — picking up from the voice node build, or something in the automations/apps area you mentioned?

## human — 2026-04-15 05:06:04

I have updates the yamls and automation files, what can I do better. My automations are to complicated and they are interfering with eachother

## assistant — 2026-04-15 05:06:44

 Let me read all your current files properly before giving you any advice.
```
This block is not supported on your current device yet.
```

Now I have the full picture. Here's a clear, honest breakdown of every problem and how to fix each one — one at a time.

---

## The Core Problems

### 1. You have duplicate/conflicting lounge entry automations

Your latest file has `lounge_enters_night` with **no time condition** — it fires any time presence turns on, at any hour. But you still reference daytime/evening versions in the guest mode automations (`automation.lounge_someone_enters_daytime`, `automation.lounge_someone_enters_evening`). Those automations don't exist in this file anymore. So guest mode currently tries to disable automations that don't exist.

**Fix:** Either bring back all three time-based entry automations (day/evening/night), or consolidate into one smart automation using `choose`.

---

### 2. `lounge_enters_night` has no time condition at all

```yaml
- id: lounge_enters_night
  conditions: []   # ← fires ANY time of day
```

This means at 2pm when you walk into the lounge, the lights turn on at 20% amber and the TV remote fires. That's wrong.

**Fix:** Add a time condition `after: '22:00:00'` back, or merge all three entry automations into one.

---

### 3. Camera motion automation fires with no conditions

`Lounge - Camera Motion (Lights and TV On)` (id `1775599496932`) has `conditions: []` — it turns the TV and lights on full blast at 100% white whenever the camera detects motion. No time check, no presence check. During the day, any movement will blast the lights on.

**Fix:** Add a time condition (night only) and a presence check (only if radar says empty).

---

### 4. `Lounge on` (id `1776035749973`) is a duplicate camera motion trigger

You have both `1775599496932` (camera triggers TV + lights) AND `1776035749973` (`Lounge on` — also camera triggers TV + lights + scene). These will both fire simultaneously on camera motion. They'll conflict with each other and double-trigger.

**Fix:** Delete one. Keep `1776035749973` as it's the more complete one, but add proper conditions to it.

---

### 5. `Home` automation (id `1776188148491`) turns all lights OFF then turns TV ON

When you arrive home, it turns every light off and then turns the TV on. That's backwards. It also requires `binary_sensor.lounge_presence_lounge_presence` to already be `on` as a condition — but you just arrived home, so presence might not have triggered yet.

**Fix:** This automation needs a complete rethink. It should turn lights ON when you arrive, not off.

---

### 6. Bedroom has two separate occupancy triggers

You have `bedroom_enter_daytime` / `bedroom_enter_night` using `binary_sensor.bedroom_presence`, AND automation `1775985258811` using a device trigger on a different entity (`aee431d507a12ce150360cbf74aeefae`). Both turn on `light.bedroom_light` (old) vs `light.bedroom_light_2` (new). They'll conflict.

**Fix:** Delete `1775985258811` — it's an old leftover from before the new YAML.

---

## The Right Architecture Going Forward

Instead of 4–5 separate entry automations per room, use **one automation per room with `choose`** based on time. Add `input_boolean.away_mode` as a guard on all presence automations so nothing fires when you're away.

Here's the consolidated lounge entry automation that replaces your three separate ones:

```yaml
- id: lounge_enters
  alias: Lounge - Someone Enters
  triggers:
  - entity_id: binary_sensor.lounge_presence
    to: 'on'
    trigger: state
  conditions:
  - condition: state
    entity_id: input_boolean.away_mode
    state: 'off'
  - condition: state
    entity_id: input_boolean.guest_mode
    state: 'off'
  actions:
  - choose:
    - conditions:
      - condition: time
        after: '07:00:00'
        before: '18:00:00'
      sequence:
      - action: media_player.turn_on
        target:
          entity_id: media_player.tv_jelly_beans_tv_2
      - delay: 00:00:05
      - action: media_player.select_source
        target:
          entity_id: media_player.tv_jelly_beans_tv_2
        data:
          source: Spotify - Music and Podcasts
    - conditions:
      - condition: time
        after: '18:00:00'
        before: '22:00:00'
      sequence:
      - action: media_player.turn_on
        target:
          entity_id: media_player.tv_jelly_beans_tv_2
      - delay: 00:00:05
      - action: media_player.select_source
        target:
          entity_id: media_player.tv_jelly_beans_tv_2
        data:
          source: Spotify - Music and Podcasts
      - action: light.turn_on
        target:
          entity_id:
          - light.right_smart_bulb
          - light.left_smart_bulb
          - light.living_room_light
          - light.stairs_smart_bulb
          - light.rgbic_tv_backlight
        data:
          brightness_pct: 60
          rgb_color: [255, 180, 107]
    - conditions:
      - condition: time
        after: '22:00:00'
      sequence:
      - action: light.turn_on
        target:
          entity_id:
          - light.right_smart_bulb
          - light.left_smart_bulb
          - light.living_room_light
          - light.rgbic_tv_backlight
        data:
          brightness_pct: 20
          rgb_color: [255, 147, 41]
      - action: light.turn_off
        target:
          entity_id: light.stairs_smart_bulb
  mode: single
```

This also solves the guest mode problem — you check the flag directly in the condition, so you don't need to dynamically disable/re-enable automations at all. The `system_guest_mode_no_auto_tv` and `system_guest_mode_off_restore` automations can be deleted entirely.

---

## Priority Fix Order

Do these one at a time, verify each before moving on:

**Step 1 — Fix the lounge enters automation.** Delete the three separate daytime/evening/night entry automations and replace with the single `choose`-based one above. Test by walking in at different times of day.

**Step 2 — Fix the camera motion conflict.** Delete `1775599496932`. Edit `1776035749973` to add `condition: state, binary_sensor.lounge_presence, off` and a time condition `after: 22:00:00 / before: 07:00:00`.

**Step 3 — Delete `1775985258811`.** The old bedroom device trigger. Verify bedroom presence still works through the `bedroom_enter_daytime/night` automations.

**Step 4 — Fix or delete the `Home` automation.** Decide what you actually want to happen when you arrive home, then rebuild it cleanly.

**Step 5 — Delete `system_guest_mode_no_auto_tv` and `system_guest_mode_off_restore`** once the new lounge enters automation is working — they're no longer needed.

---

Which step do you want to tackle first? Start with Step 1 and I'll give you the exact YAML to paste in.

## human — 2026-04-15 05:44:49

I want this app to be able to control my TV source or apps as an example

## assistant — 2026-04-15 05:44:55

 What do you mean by "control" — are you thinking a dashboard-style remote in the browser, or something more like a voice/automation trigger?

And what's the TV entity in HA — is it `media_player.tv_jelly_beans_tv_2` (the Android TV)?
```
This block is not supported on your current device yet.
```



## human — 2026-04-15 05:45:35
_files:_ 109412.jpg

_(empty)_

## assistant — 2026-04-15 05:45:41

 Good — you've got **SamsungTV Smart** integration (v0.14.5) with SmartThings connected. That's the best possible setup because it gives HA access to the full app/source list, not just basic inputs.

Before I build the app, I need to know what sources/apps your TV actually exposes. Can you do this quickly:

1. Go to **Developer Tools → States** in HA
2. Search for `media_player.tv_jelly_beans`
3. Click on the entity and scroll down to **attributes**
4. Screenshot what you see — specifically looking for `source_list`

That list is exactly what I'll put as buttons in the app. Once I can see what's available, I'll build the full visual remote as a React artifact.

## human — 2026-04-15 05:46:58
_files:_ 109414.jpg

_(empty)_

## assistant — 2026-04-15 05:47:01

 I can see two entities — tap on **`media_player.tv_jelly_beans_tv_2`** (the one showing "on") and then scroll down in the attributes panel to find `source_list`. Screenshot that for me so I can see every app/source name exactly as HA sees them.

## human — 2026-04-15 05:47:44

Attributes

## assistant — 2026-04-15 05:47:47

 I can see you're on the attributes screen but the screenshot didn't come through. Can you send the screenshot showing the attributes for `media_player.tv_jelly_beans_tv_2`?

## human — 2026-04-15 05:48:32

source_list:
  - TV
  - HDMI
  - BBC iPlayer
  - Internet
  - Netflix
  - Prime Video
  - SmartThings
  - Spotify - Music and Podcasts
  - YouTube
  - e-Manual
volume_level: 0
is_volume_muted: false
device_class: tv
friendly_name: DLNA Jelly Bean's tv
supported_features: 24509

## assistant — 2026-04-15 05:49:37

 Perfect. Now I have everything I need. Building the app now.
```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

Here's your TV remote app. To use it:

**Step 1 — Get your HA token**
Go to HA → your profile (bottom left) → scroll to the bottom → **Long-lived access tokens** → Create token → copy it.

**Step 2 — Enter your HA URL and token**
Use `http://192.168.0.X:8123` (your HA local IP) — not `homeassistant.local` as that can cause CORS issues from a browser artifact.

**What it does:**
- **Apps & Sources tab** — one tap switches the TV to Netflix, BBC iPlayer, Spotify, YouTube etc. Active source highlights in its brand colour
- **Remote tab** — D-pad navigation, volume, mute, play/pause, and function keys (Home, Back, Menu, Exit)
- **Power button** in the header toggles on/off
- **Status dot** shows green when TV is on, grey when off
- Auto-refreshes TV state every 5 seconds

If any source buttons don't switch correctly, let me know — Samsung TVs sometimes need the exact source string HA uses internally.

## human — 2026-04-15 05:56:24
_files:_ 109416.jpg

_(empty)_

## assistant — 2026-04-15 05:56:29

 I can see two issues:

1. **The HA URL is wrong** — you've pasted the full Nabu Casa URL path. It should just be the base URL, nothing after the port.

2. **You're using your Nabu Casa URL** — that's fine, but the format needs to be exact.

Change the HA URL to just:
```
https://uuxgyehjmsoit9uo770ko6cltmrrzmtb.ui.nabu.casa
```

Nothing after that — no `/jelly-bean-s-house/` or anything else. Then paste your token and hit Connect.

## human — 2026-04-15 05:57:52
_files:_ Screenshot_20260415_065739_Claude.jpg

_(empty)_

## assistant — 2026-04-15 05:57:59

 The problem is a **CORS block** — the Claude artifact runs on claude.ai, and browsers block cross-origin API calls to Nabu Casa from a different domain. This is a browser security restriction, not a HA or token issue.

You have two options:

**Option A — Use your local IP instead (easiest)**
Only works when you're on your home WiFi. Try:
```
http://192.168.0.1:8123
```
Replace with your actual HA IP — check your router or HA Settings → System → Network to find it.

**Option B — Add claude.ai to HA's CORS allowed origins**
In your HA `configuration.yaml` add:
```yaml
http:
  cors_allowed_origins:
    - https://claude.ai
```
Then restart HA. This permanently allows the artifact to talk to your Nabu Casa URL.

**Try Option A first** — what's your HA local IP address? You can find it at HA → Settings → System → Network, it'll show something like `192.168.0.X`.

## human — 2026-04-15 05:59:40
_files:_ Screenshot_20260415_065923_Claude.jpg

_(empty)_

## assistant — 2026-04-15 05:59:47

 Still CORS — even with the local IP, the browser blocks it because the artifact runs on `claude.ai` (HTTPS) and your HA is on `http://` (HTTP). Mixed content is blocked automatically.

The fix is **Option B — add CORS to HA**. Do this now:

**Step 1** — Open HA File Editor → `/config/configuration.yaml`

**Step 2** — Add this block (at the top level, not indented under anything):
```yaml
http:
  cors_allowed_origins:
    - https://claude.ai
```

**Step 3** — Save, then go to **Developer Tools → YAML → Restart HA** (or Check Config first if you want to be safe)

**Step 4** — Once HA restarts, try connecting again with `http://192.168.0.50:8123`

That's the only change needed. Do you already have an `http:` block in your configuration.yaml? If so, just add the `cors_allowed_origins` line under it rather than creating a new one.

## human — 2026-04-15 06:12:59
_files:_ Screenshot_20260415_071251_Claude.jpg

_(empty)_

## assistant — 2026-04-15 06:13:03

 Still failing. Before anything else — did you add the CORS config and restart HA yet? That's the required step.

Also, confirm what your `configuration.yaml` looks like now. Go to **File Editor → `/config/configuration.yaml`** and screenshot the `http:` section so I can see exactly what was added.

If you haven't done it yet, here's the exact block to add:

```yaml
http:
  cors_allowed_origins:
    - https://claude.ai
```

Do that first, restart HA, then try again. The app itself is fine — this is purely a HA config issue.

## human — 2026-04-15 06:13:34

http:
  cors_allowed_origins:
    - https://claude.ai
# Loads default set of integrations. Do not remove.
default_config:

# Load frontend themes from the themes folder
frontend:
  themes: !include_dir_merge_named themes
  extra_module_url:
    - /hacsfiles/lovelace-card-mod/card-mod.js?hacstag=1909275244

automation: !include automations.yaml
script: !include scripts.yaml
scene: !include scenes.yaml

google_assistant:
  project_id: new-home-assist-0c5b7
  service_account: !include SERVICE_ACCOUNT.json
  report_state: true
  expose_by_default: true

climate:
  - platform: ephember
    username: ehorton@selectlifestyles.co.uk
    password: Nicholas1

sql_request:
  db_url: /config/home-assistant_v2.db  # Optional: path to your SQL database
  
template:
  - sensor:
      - name: "Motion Sensor TV Samsung Temperature Corrected"
        unit_of_measurement: "°C"
        state: "{{ (states('sensor.motion_sensor_tv_samsung_temperature') | float / 100) | round(1) }}"
      - name: "Multipurpose Sensor TV Samsung Temperature Corrected"
        unit_of_measurement: "°C"
        state: "{{ (states('sensor.multipurpose_sensor_tv_samsung_temperature') | float / 100) | round(1) }}"
  - binary_sensor:
      - name: "TV Presence Fixed"
        state: >
          {{ is_state('binary_sensor.motion_sensor_tv_samsung_motion', 'on')
             or is_state('binary_sensor.living_room_occupancy_status', 'on') }}
ble_monitor:
  devices:
    # sensors
    - mac: 'A4:C1:38:2F:86:6C'
      name: 'Livingroom'
      encryption_key: '217C568CF5D22808DA20181502D84C1B'
      temperature_unit: C
      use_median: false
      restore_state: default
    - mac: 'C4:3C:4D:6B:4F:F3'
      reset_timer: 35
    # device trackers
    - mac: 'D4:3C:2D:4A:3C:D5'
      track_device: true
      tracker_scan_interval: 20
      consider_home: 180
    # ibeacon
    - uuid: 'e2c56db5-dffb-48d2-b060-d0f5a71096e0'
      track_device: true
      tracker_scan_interval: 20
      consider_home: 180
  bt_interface:
    - '04:B1:38:2C:84:2B'
    - '34:DE:36:4F:23:2C'

recorder:
  purge_keep_days: 7
  commit_interval: 30
sensor:
  - platform: rest
    name: Lounge Camera Motion
    resource: http://192.168.0.190:8080/motion.json
    value_template: "{{ value_json.motion_active }}"
    scan_interval: 5
    
shell_command:
  query_notebooklm: /config/scripts/ask_notebooklm.sh "What automations run at night?"
  test_python: which python3 || which python || ls /usr/bin/py*
  query_notebooklm_dynamic: /bin/bash /config/scripts/ask_notebooklm.sh "{{ states('input_text.notebooklm_question') }}"
  rebuild_notebook_kb: /bin/bash /config/scripts/rebuild_notebook_kb.sh
command_line:
  - sensor:
      name: "NotebookLM Response"
      unique_id: notebooklm_response
      command: "cat /config/.notebooklm/last_response.txt 2>/dev/null || echo 'No response yet'"
      scan_interval: 10
      command_timeout: 5
      value_template: "{{ value[:255] }}"
      
camera:
  - platform: mjpeg
    name: Lounge Phone Camera
    mjpeg_url: http://192.168.0.190:8080/video
    still_image_url: http://192.168.0.190:8080/shot.jpg
  - platform: mjpeg
    name: Samsung Lounge Camera
    mjpeg_url: http://192.168.0.215:8080/video
    still_image_url: http://192.168.0.215:8080/shot.jpg
    
intent_script:
  AskNotebookLM:
    speech:
      text: "Asking NotebookLM, give me about 90 seconds..."
    action:
      - action: input_text.set_value
        target:
          entity_id: input_text.notebooklm_question
        data:
          value: "{{ question }}"
      - action: shell_command.query_notebooklm_dynamic
      - delay: 00:01:30
      - action: notify.mobile_app_jelly_bean_s_phone
        data:
          title: "🧠 NotebookLM"
          message: "{{ states('sensor.notebooklm_response') }}"
      - action: tts.speak
        target:
          entity_id: tts.home_assistant_cloud
        data:
          media_player_entity_id: media_player.jelly_bean_s_phone
          message: "{{ states('sensor.notebooklm_response') }}"

## assistant — 2026-04-15 06:13:42

 The CORS config is there and correct. The issue is it's still `http://` (unencrypted) but claude.ai is `https://` — browsers block mixed content requests regardless of CORS headers.

You need to add one more line to the `http:` block:

```yaml
http:
  cors_allowed_origins:
    - https://claude.ai
  use_x_forwarded_for: true
  trusted_proxies:
    - 127.0.0.1
```

But more importantly — **have you restarted HA after adding the CORS line?** The config looks right, so if you've restarted and it's still failing, the real problem is the `http://` vs `https://` mismatch.

The permanent fix for that is to enable HTTPS on HA. Since you have Nabu Casa, the easiest way is to just **use your Nabu Casa URL** — but we need CORS to include that too.

Update the `http:` block to:

```yaml
http:
  cors_allowed_origins:
    - https://claude.ai
    - https://uuxgyehjmsoit9uo770ko6cltmrrzmtb.ui.nabu.casa
```

Restart HA, then in the app use your Nabu Casa URL:
```
https://uuxgyehjmsoit9uo770ko6cltmrrzmtb.ui.nabu.casa
```

That's HTTPS end-to-end so the browser won't block it. Try that after restarting.

## human — 2026-04-15 06:21:20
_files:_ 109424.jpg

How do we config this

## assistant — 2026-04-15 06:21:24

 That's the SamsungTV Smart integration settings — this isn't the fix for the CORS issue. 

Go back and do the HA config steps first. Have you:

1. Updated `configuration.yaml` with both CORS origins (claude.ai + your Nabu Casa URL)?
2. **Restarted HA** after saving?

Once HA has restarted, come back to the app and use your Nabu Casa URL. The SamsungTV Smart options screen isn't relevant to the connection problem.

## human — 2026-04-15 06:34:39

No good

## assistant — 2026-04-15 06:34:43

 Let's test if HA is actually reachable. Open a new browser tab on your phone and go to:

```
https://uuxgyehjmsoit9uo770ko6cltmrrzmtb.ui.nabu.casa/api/states/media_player.tv_jelly_beans_tv_2
```

It will ask you to log in or show JSON. Screenshot what you see — that tells us if the API is reachable at all before we debug the app.

## human — 2026-04-15 06:35:17
_files:_ Screenshot_20260415_073510_Chrome.jpg

_(empty)_

## assistant — 2026-04-15 06:35:23

 **401 Unauthorized** — the API is reachable. That's actually good news. It means the URL works, HTTPS works, and HA is responding. The app just needs a valid token to authenticate.

The token you're pasting is either expired, incorrect, or getting cut off. Let's create a fresh one right now.

**Step 1** — In HA, tap your profile picture (bottom left corner)

**Step 2** — Scroll all the way to the bottom

**Step 3** — Under **Long-lived access tokens** tap **Create token**

**Step 4** — Name it `TV Remote` and tap OK

**Step 5** — Copy the full token immediately (it only shows once)

**Step 6** — Go back to the app, enter the Nabu Casa URL and paste the new token

The token is very long — make sure you copy the entire thing. Does it copy correctly when you paste it into the token field?

## human — 2026-04-15 06:37:15

https://uuxgyehjmsoit9uo770ko6cltmrrzmtb.ui.nabu.casa

http://192.168.0.50:8123


eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkMmVhNWQ1MWZlMzA0MmE4OTVlN2FmNjQwYTEwNTUyMiIsImlhdCI6MTc3NjIzMjI5OCwiZXhwIjoyMDkxNTkyMjk4fQ.5TVKc1uVfHVoW23wySD_Qs67qIBqINcFyTy5ceQI3Dg

## assistant — 2026-04-15 06:37:21

 Good — I can see the full token. Now use the **Nabu Casa URL** (HTTPS) since the local one has the mixed content issue.

In the app enter exactly:

**URL:** `https://uuxgyehjmsoit9uo770ko6cltmrrzmtb.ui.nabu.casa`

**Token:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkMmVhNWQ1MWZlMzA0MmE4OTVlN2FmNjQwYTEwNTUyMiIsImlhdCI6MTc3NjIzMjI5OCwiZXhwIjoyMDkxNTkyMjk4fQ.5TVKc1uVfHVoW23wySD_Qs67qIBqINcFyTy5ceQI3Dg`

One thing to be aware of — you've just shared that token publicly in this chat. Once you've tested and confirmed it works, go back to HA and **delete this token and create a new one**. Anyone with that token has full access to your HA.

Try connecting now and tell me what happens.

## human — 2026-04-15 06:39:18
_files:_ Screenshot_20260415_073806_Home Assistant.jpg

Give me the app again

## assistant — 2026-04-15 06:41:05

 Good - I can see your HA network config. IP is `192.168.0.50` and Nabu Casa URL is confirmed. Let me rebuild the app with your credentials pre-filled so you just hit Connect.
```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

Your URL and token are now pre-filled — just tap **Connect to HA**. No typing needed.

Before you do — confirm HA has been restarted after adding the CORS line. If you haven't restarted yet, go to **Settings → System → Restart** first, then come back and hit Connect.
