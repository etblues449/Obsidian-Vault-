# Smart Home — Project Index

## Goal
Deeply automated, presence-aware home across lounge, bedroom, upstairs using HA Green + ESP32.

## Status
- Lounge: complete (~19 automations)
- Bedroom: operational (bedroom-2.yaml)
- Upstairs: BLE/radar contention unresolved

## Key Decisions
- bedroom-2.yaml canonical (bedroom.yaml broken)
- media_player.tv_jelly_beans_tv_2 canonical TV entity
- Frigate ruled out (too heavy for HA Green)
- BLE + mmWave on same ESP32 = contention; split nodes

## Next Actions
- [ ] Fix upstairs BLE/radar contention
- [ ] Clarify IP conflict (upstairs vs bedroom both 192.168.0.171)
- [ ] Order: 18650 cells, ESP32-S3-CAM, 5V servo rail

## Reference
Full detail: [[smart_home]]
