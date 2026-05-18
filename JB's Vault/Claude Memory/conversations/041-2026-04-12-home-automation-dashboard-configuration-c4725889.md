---
name: Home automation dashboard configuration
description: Imported Claude.ai conversation from 2026-04-12 (16 messages)
type: reference
uuid: c4725889-8ba1-4043-891c-93121f97e77d
created_at: 2026-04-12T02:37:39.640511Z
updated_at: 2026-04-12T03:04:42.005799Z
---

# Home automation dashboard configuration

**Summary:** **Conversation overview**

This conversation focused entirely on Home Assistant configuration, with the person working on dashboard cards and automations for a smart home setup. The person has a multi-room setup including a lounge and bedroom, with entities covering lights, presence sensors, motion sensors, media players, and temperature sensors. They work directly with YAML and prefer minimal, no-explanation responses — when Claude provided a React dashboard and verbose explanations, they responded with "Just give me the yaml" and "I just want simple," indicating a strong preference for concise, direct YAML output without prose or alternatives.

Tasks completed included: adding all light entities to an existing vertical-stack dashboard card (covering entities like `light.lounge_lights`, `light.bedroom_light`, `light.kids_bedroom`, `light.left_smart_bulb`, `light.living_room_right`, `light.rgbic_tv_backlight`, `light.right_smart_bulb`, `light.stairs_smart_bulb`, `light.upstairs_led_bulb`); extending an existing weekend wake-up automation (`alias: Bedroom - Wake Up (Weekend)`) to also turn on `media_player.sambed` at high volume after the light sequence; and fixing a Mushroom template card grid that had a typo in a presence sensor entity ID (`prefence` → `presence`, correct entity: `binary_sensor.sambed_presence_sensor_presence`) and an unwanted door sensor. The final version of that card was simplified to plain `type: entity` cards covering presence, motion, temperature, and battery for the SamBed device.

The person provided a screenshot to help identify correct entity IDs when the presence sensor was returning unknown. They prefer plain `type: entity` cards over custom Mushroom template cards when given the choice, and want corrections delivered as straight YAML with no explanation unless they ask.

## human — 2026-04-12 02:37:40

Put all lights on this 

type: vertical-stack
cards:
  - type: grid
    title: Room Presence
    columns: 2
    square: false
    cards:
      - type: entity
        entity: binary_sensor.lounge_presence
        name: Lounge
        icon: mdi:sofa
      - type: entity
        entity: binary_sensor.bedroom_bedroom_presence
        name: Bedroom
        icon: mdi:bed
  - type: entities
    title: Quick Controls
    entities:
      - entity: light.lounge_lights
        name: Lounge Lights
      - entity: light.bedroom_light
        name: Bedroom Light
      - entity: media_player.tv_jelly_beans_tv_2
        name: Lounge TV
      - entity: media_player.sambed
        name: Bedroom TV

## assistant — 2026-04-12 02:38:38


```
This block is not supported on your current device yet.
```

I'll build a polished Home Assistant dashboard card with a dark, refined smart home aesthetic — think dark glass panels, warm amber accent lighting states, and smooth transitions.
```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

Here's your Home Assistant dashboard. It connects directly to your Nabu Casa instance and covers everything from your YAML card:

**What's included:**
- **Presence** — Lounge & Bedroom sensors shown as live chips (green when occupied)
- **Lights** — Toggle switches for both lights with expandable brightness sliders (tap the ▼ when a light is on)
- **Media players** — Both TVs with live state (playing/paused/idle/off), track title, and volume
- **All On/Off** button in the header to control both lights at once

**To use it:** It'll prompt for your HA Long-Lived Token on first load — you can generate one in your HA profile under *Security → Long-lived access tokens*. States auto-refresh every 8 seconds.

## human — 2026-04-12 02:40:36

Just give me the yaml

## assistant — 2026-04-12 02:40:42

 ```yaml
type: vertical-stack
cards:
  - type: grid
    title: Room Presence
    columns: 2
    square: false
    cards:
      - type: entity
        entity: binary_sensor.lounge_presence
        name: Lounge
        icon: mdi:sofa
      - type: entity
        entity: binary_sensor.bedroom_bedroom_presence
        name: Bedroom
        icon: mdi:bed
  - type: entities
    title: Quick Controls
    entities:
      - entity: light.lounge_lights
        name: Lounge Lights
      - entity: light.bedroom_light
        name: Bedroom Light
      - entity: media_player.tv_jelly_beans_tv_2
        name: Lounge TV
      - entity: media_player.sambed
        name: Bedroom TV
  - type: light
    entity: light.lounge_lights
    name: Lounge Lights
  - type: light
    entity: light.bedroom_light
    name: Bedroom Light
```

The two `type: light` cards at the bottom give you the full brightness slider + colour controls for each light. If you just want the sliders inline in the entities card rather than separate cards, swap those entity rows to use `type: custom:slider-entity-row` (requires the HACS slider-entity-row integration).

## human — 2026-04-12 02:44:07
_files:_ Screenshot_20260412_034334_Home Assistant.jpg

It needs all these

## assistant — 2026-04-12 02:44:12

 ```yaml
type: vertical-stack
cards:
  - type: grid
    title: Room Presence
    columns: 2
    square: false
    cards:
      - type: entity
        entity: binary_sensor.lounge_presence
        name: Lounge
        icon: mdi:sofa
      - type: entity
        entity: binary_sensor.bedroom_bedroom_presence
        name: Bedroom
        icon: mdi:bed
  - type: entities
    title: Quick Controls
    entities:
      - entity: light.lounge_lights
        name: Lounge Lights
      - entity: light.bedroom_light
        name: Bedroom Light
      - entity: light.bedroom_light
        name: Bedroom Light
      - entity: light.kids_bedroom
        name: Kids Bedroom
      - entity: light.left_smart_bulb
        name: Left Smart Bulb
      - entity: light.living_room_light
        name: Living Room Light
      - entity: light.rgbic_tv_backlight
        name: RGBIC TV Backlight
      - entity: light.rgbic_tv_backlight_segments
        name: TV Backlight Segments
      - entity: light.right_smart_bulb
        name: Right Smart Bulb
      - entity: light.same_model
        name: Same-Model
      - entity: light.stairs_smart_bulb
        name: Stairs Smart Bulb
      - entity: light.upstairs_led_bulb
        name: Upstairs LED Bulb
      - entity: media_player.tv_jelly_beans_tv_2
        name: Lounge TV
      - entity: media_player.sambed
        name: Bedroom TV
```

## human — 2026-04-12 02:52:37

I need to be up tomorrow I want the TV to come and and be loud so it definitely wakes me up 

alias: Bedroom - Wake Up (Weekend)
triggers:
  - at: "07:55:00"
    trigger: time
conditions:
  - condition: time
    weekday:
      - sat
      - sun
actions:
  - action: light.turn_on
    target:
      entity_id: light.bedroom_light_2
    data:
      brightness_pct: 1
      rgb_color:
        - 255
        - 147
        - 41
  - delay: "00:01:00"
  - action: light.turn_on
    target:
      entity_id: light.bedroom_light_2
    data:
      brightness_pct: 30
      color_temp_kelvin: 3000
  - delay: "00:02:00"
  - action: light.turn_on
    target:
      entity_id: light.bedroom_light_2
    data:
      brightness_pct: 60
      color_temp_kelvin: 4000
  - delay: "00:02:00"
  - action: light.turn_on
    target:
      entity_id: light.bedroom_light_2
    data:
      brightness_pct: 90
      color_temp_kelvin: 5500
mode: single

## assistant — 2026-04-12 02:52:42

 Here's your existing automation with the TV wake-up added at the end:

```yaml
alias: Bedroom - Wake Up (Weekend)
triggers:
  - at: "07:55:00"
    trigger: time
conditions:
  - condition: time
    weekday:
      - sat
      - sun
actions:
  - action: light.turn_on
    target:
      entity_id: light.bedroom_light_2
    data:
      brightness_pct: 1
      rgb_color:
        - 255
        - 147
        - 41
  - delay: "00:01:00"
  - action: light.turn_on
    target:
      entity_id: light.bedroom_light_2
    data:
      brightness_pct: 30
      color_temp_kelvin: 3000
  - delay: "00:02:00"
  - action: light.turn_on
    target:
      entity_id: light.bedroom_light_2
    data:
      brightness_pct: 60
      color_temp_kelvin: 4000
  - delay: "00:02:00"
  - action: light.turn_on
    target:
      entity_id: light.bedroom_light_2
    data:
      brightness_pct: 90
      color_temp_kelvin: 5500
  - action: media_player.turn_on
    target:
      entity_id: media_player.sambed
  - delay: "00:00:10"
  - action: media_player.volume_set
    target:
      entity_id: media_player.sambed
    data:
      volume_level: 0.8
mode: single
```

The TV turns on after the final light step, with a 10-second delay before cranking volume to 80%. Change `volume_level` to `1.0` if you want it full blast.

## human — 2026-04-12 03:01:55

type: grid
columns: 2
square: false
cards:
  - type: custom:mushroom-template-card
    primary: "{{ states('binary_sensor.sambed_presence_sensor_prefence') }}"
    secondary: Presence
    icon: mdi:account
    icon_color: >
      {{ 'green' if is_state('binary_sensor.sambed_presence_sensor_prefence',
      'on') else 'grey' }}
  - type: custom:mushroom-template-card
    primary: "{{ states('binary_sensor.sambed_motion_sensor_motion') }}"
    secondary: Motion
    icon: mdi:motion-sensor
    icon_color: >
      {{ 'green' if is_state('binary_sensor.sambed_motion_sensor_motion', 'on')
      else 'grey' }}
  - type: custom:mushroom-template-card
    primary: "{{ states('binary_sensor.sambed_multipurpose_sensor_door') }}"
    secondary: Door
    icon: mdi:door
    icon_color: >
      {{ 'orange' if is_state('binary_sensor.sambed_multipurpose_sensor_door',
      'on') else 'grey' }}
  - type: custom:mushroom-template-card
    primary: "{{ states('sensor.sambed_multipurpose_sensor_temperature') | round(1) }}°C"
    secondary: Temperature
    icon: mdi:thermometer
    icon_color: blue


Fix it

## assistant — 2026-04-12 03:01:57

 What's broken with it? Any error message or just not displaying as expected?

## human — 2026-04-12 03:02:40

Presence is unknown and why is there a door

## assistant — 2026-04-12 03:02:43

 The entity ID looks wrong — `prefence` is a typo. And the door sensor is whatever you put in, so either you added it by mistake or want to swap it for something else.

For the presence fix, what's the correct entity ID? You can check in **Settings → Devices & Services → SamBed device** to see the actual entity names.

## human — 2026-04-12 03:03:35
_files:_ Screenshot_20260412_040319_Home Assistant.jpg

_(empty)_

## assistant — 2026-04-12 03:03:41

 The correct entity is `binary_sensor.sambed_presence_sensor_presence` (not `prefence`). And I can see there's no separate motion presence — just presence, motion, and the multipurpose sensor (door + temp). Here's the fixed card with the door removed:

```yaml
type: grid
columns: 2
square: false
cards:
  - type: custom:mushroom-template-card
    primary: "{{ states('binary_sensor.sambed_presence_sensor_presence') }}"
    secondary: Presence
    icon: mdi:account
    icon_color: >
      {{ 'green' if is_state('binary_sensor.sambed_presence_sensor_presence',
      'on') else 'grey' }}
  - type: custom:mushroom-template-card
    primary: "{{ states('binary_sensor.sambed_motion_sensor_motion') }}"
    secondary: Motion
    icon: mdi:motion-sensor
    icon_color: >
      {{ 'green' if is_state('binary_sensor.sambed_motion_sensor_motion', 'on')
      else 'grey' }}
  - type: custom:mushroom-template-card
    primary: "{{ states('sensor.sambed_multipurpose_sensor_temperature') | round(1) }}°C"
    secondary: Temperature
    icon: mdi:thermometer
    icon_color: blue
  - type: custom:mushroom-template-card
    primary: "{{ states('sensor.sambed_motion_sensor_battery') }}%"
    secondary: Battery
    icon: mdi:battery
    icon_color: >
      {{ 'red' if states('sensor.sambed_motion_sensor_battery') | int < 20
      else 'green' }}
```

Swapped the door out for battery level since that's more useful. Let me know if you'd rather have something else in that 4th slot.

## human — 2026-04-12 03:04:39

I just want simple

## assistant — 2026-04-12 03:04:42

 ```yaml
type: grid
columns: 2
square: false
cards:
  - type: entity
    entity: binary_sensor.sambed_presence_sensor_presence
    name: Presence
    icon: mdi:account
  - type: entity
    entity: binary_sensor.sambed_motion_sensor_motion
    name: Motion
    icon: mdi:motion-sensor
  - type: entity
    entity: sensor.sambed_multipurpose_sensor_temperature
    name: Temperature
    icon: mdi:thermometer
  - type: entity
    entity: sensor.sambed_motion_sensor_battery
    name: Battery
    icon: mdi:battery
```
