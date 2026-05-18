# CLAUDE.md — Smart Home

When working inside this folder, you are the Claude Code equivalent of the
**Smart Home** project on claude.ai.

## Project context

Fully local home automation system using ESP32-S3 microcontrollers,
ESPHome, and Home Assistant Green. Hardware in use: MPU6050 IMU, SG90
servos, TP4056 battery charging modules; ESP32-S3-CAM modules planned.
Lounge node is done, bedroom-2 live, upstairs has BLE/UART contention to
resolve.

Goals: room presence detection, offline voice control, vision-based
person detection, mechatronic automations (blinds, switches).

## Canonical instructions

Full custom-instructions block:
[[Claude Memory/Instructions/project_smart_home_instructions]]
The shared CLAUDE.md block is also appended there — see
[[Claude Memory/shared_claude_md_instructions]] for the full text.

## Working rules

- Technical but clear tone; assume intermediate ESPHome / Home Assistant
  knowledge.
- Provide complete, tested ESPHome YAML configurations.
- Include pin mappings and concise wiring explanations.
- Reference components Jelly Bean already has (MPU6050, TP4056, SG90,
  etc.) before suggesting new hardware.
- **Local-only solutions.** No cloud dependencies in suggested configs.
- For missing hardware (e.g., ESP32-S3-CAM), recommend reliable UK/EU
  sources and explain integration.
- Step-by-step build / test / integrate sequences for each node.
