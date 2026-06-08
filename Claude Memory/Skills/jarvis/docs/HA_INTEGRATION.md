# Home Assistant Integration

HA Green at `http://192.168.0.50:8123`. Long-lived token in `config.yaml`.

## Action direction: voice → HA

Pattern: voice captured → n8n classifies as `ha_action` → n8n (or this skill via `scripts/ha-call.sh`) calls HA REST.

```bash
# Turn on lounge lights
bash scripts/ha-call.sh light.turn_on light.living_room_light

# Movie mode (whichever method: scene, script, or direct light call)
bash scripts/ha-call.sh scene.turn_on scene.movie_mode

# Spotify on lounge TV — IMPORTANT: use select_source, NOT spotcast.start (broken)
bash scripts/ha-call.sh media_player.select_source media_player.tv_jelly_beans_tv_2 '{"source":"Spotify - Music and Podcasts"}'

# Dim bedroom to 30%
bash scripts/ha-call.sh light.turn_on light.bedroom_light '{"brightness_pct":30}'
```

## Entity catalog — canonical (from project_smart_home.md)

**Lounge:**
- TV: `media_player.tv_jelly_beans_tv_2` ✓ (NOT `media_player.jelly_beans_tv` — broken)
- Lights: `light.right_smart_bulb`, `light.left_smart_bulb`, `light.living_room_light`, `light.rgbic_tv_backlight`, `light.stairs_smart_bulb`
- TV backlight DreamView: `switch.rgbic_tv_backlight_dreamview`
- Spotify: source `Spotify - Music and Podcasts` via `media_player.select_source`
- Sensors: `binary_sensor.sound_sensor_labs_sound`, `sensor.sound_sensor_labs_volume`, `sensor.light_sensor_labs_brightness_intensity`
- Camera MJPEG: `http://192.168.0.215:8080`

**Bedroom node** — `bedroom-2.yaml` ✓ (NOT `bedroom.yaml` — broken). ESPHome at `192.168.0.171`.

**Upstairs node** — BLE + radar contention issue, see project file. Don't trust state until fixed.

**Movie mode settings:** `brightness_pct: 100`, `rgb_color: [255, 255, 255]`, `color_temp_kelvin: 6500`

## Action direction: HA → vault (event logging)

Pattern: HA fires automation → POST to n8n `/webhook/jarvis-event` → n8n appends to `Claude Memory/Projects/Smart Home/event_log.md`.

HA automation YAML example:

```yaml
alias: Log presence change to Jarvis
trigger:
  - platform: state
    entity_id: binary_sensor.lounge_presence
action:
  - service: rest_command.jarvis_event
    data:
      event: presence_change
      entity: "{{ trigger.entity_id }}"
      from: "{{ trigger.from_state.state }}"
      to: "{{ trigger.to_state.state }}"
```

`rest_command.jarvis_event` in `configuration.yaml`:

```yaml
rest_command:
  jarvis_event:
    url: "http://192.168.0.X:5678/webhook/jarvis-event"
    method: POST
    headers:
      Content-Type: application/json
    payload: '{"event":"{{event}}","entity":"{{entity}}","from":"{{from}}","to":"{{to}}","ts":"{{now().isoformat()}}"}'
```

## Existing webhooks

- Lounge motion (Tasker → HA): `http://192.168.0.50:8123/api/webhook/lounge_motion` — already wired

## Token rotation

- HA tokens last forever unless revoked
- Rotate annually: HA Profile → Security → Delete old + create new → update `config.yaml`
- `config.yaml` is gitignored — never commit
