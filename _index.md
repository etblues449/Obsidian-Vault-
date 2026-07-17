# JARVIS — Home Assistant Smart Home & Automation

Main directory for JARVIS — the on-device agentic smart home layer running on Home Assistant Green + ESP32 nodes + Fold 7 Termux agent.

## Structure

- **ARCHITECTURE.md** — System design, device topology, integration overview
- **Chat.md** — Session notes and conversation history
- **Assistant Core/** — Core agent implementation and logic
- **attachments/** — Referenced files and media
- **Work/** — Work-related smart home context
- **_archive/** — Previous versions and backups

## Key Contexts

**Hardware:**
- Home Assistant Green (OS) — central hub
- ESP32 / LD2410C mmWave radar — distributed presence detection
- Govee lights, Samsung TV, SmartThings integration
- Fold 7 Termux — mobile agent and backup sensor node

**Automation Domains:**
- Lounge (19 automations) — presence, movie mode, lighting, security
- Bedroom — presence-based light control, night mode
- Upstairs — presence detection with radar

**Learnings:** Never use `spotcast.start` (broken), use `media_player.select_source` instead. OTA flashing unreliable — use USB flashing via web.esphome.io. BLE proxy + radar on same ESP32 = contention — keep separate.

## See Also

- `Claude Memory/Projects/Smart Home/_index.md` — Project memory and status
- `esphome-devices/_index.md` — ESPHome device configs
