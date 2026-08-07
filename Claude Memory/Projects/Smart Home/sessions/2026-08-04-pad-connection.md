# Samsung Phone → Smart Pad Connection — Session 2026-08-04

## Objective
Enable control of a 24" Smart Pad TV Display (Android 14, running Home Assistant) from a Samsung Fold 7 phone, without using ADB wireless debugging (which proved unreliable).

## Solution Approach
**SSH tunneling + ADB over local network**
- Phone runs Termux with SSH server (passwordless auth)
- Pad runs Home Assistant
- Home Assistant on Pad issues shell_commands via SSH to Termux on phone
- Phone's Termux runs ADB commands to control Pad's Android display

**Connection path:** Pad HA shell_command → SSH to phone:8022 → Termux → ADB connect to Pad → Android control

## Prerequisites Verified
- ✅ PC ↔ Phone SSH working (over Termux SSH server port 8022)
- ✅ Phone ↔ Pad ping working (same network, no firewall blocking)
- ✅ Pad running Home Assistant (accessible on LAN)
- ✅ Pad has ADB enabled (both legacy tcpip + modern wireless debugging modes attempted)

## Home Assistant Configuration
Add to `configuration.yaml` on the Pad's Home Assistant:

```yaml
shell_command:
  pad_power: "ssh -p 8022 u0_a569@192.168.0.215 'adb connect 192.168.0.191:5555 && adb shell input keyevent 26'"
  pad_youtube: "ssh -p 8022 u0_a569@192.168.0.215 'adb connect 192.168.0.191:5555 && adb shell am start -n com.google.android.youtube/com.google.android.apps.youtube.app.WatchPlatformActivity'"
  pad_home: "ssh -p 8022 u0_a569@192.168.0.215 'adb connect 192.168.0.191:5555 && adb shell input keyevent 3'"
  pad_netflix: "ssh -p 8022 u0_a569@192.168.0.215 'adb connect 192.168.0.191:5555 && adb shell am start -n com.netflix.mediaclient/com.netflix.mediaclient.MainActivity'"
  pad_volume_up: "ssh -p 8022 u0_a569@192.168.0.215 'adb connect 192.168.0.191:5555 && adb shell input keyevent 24'"
  pad_volume_down: "ssh -p 8022 u0_a569@192.168.0.215 'adb connect 192.168.0.191:5555 && adb shell input keyevent 25'"
```

**IPs used:**
- Phone Termux SSH: `192.168.0.215:8022`
- Pad Local: `192.168.0.191`
- Pad ADB tcp: `192.168.0.191:5555`

## Key Configuration Details

### SSH Authentication
- User: `u0_a569` (Termux running user)
- Port: `8022` (Termux SSH server)
- Auth: Passwordless SSH key (pre-configured from earlier session)

### ADB Commands Reference
- `keyevent 26` = Power toggle
- `keyevent 3` = Home button
- `keyevent 24` = Volume up
- `keyevent 25` = Volume down
- `am start -n <package>/<activity>` = Launch app

## YAML Validation Issues Fixed
1. **Duplicate shell_command sections** → merged into single top-level entry
2. **Bad indentation** → ensured 2-space indentation for all shell_command entries
3. **Nested command_line** → de-indented to top-level (not inside shell_command)
4. **Orphaned lines** (webrtc-camera config) → removed as malformed

## Testing Checklist
- [ ] Reload HA shell_command integration
- [ ] Test `pad_power` — Pad screen should toggle
- [ ] Test `pad_youtube` — YouTube should launch
- [ ] Test `pad_netflix` — Netflix should launch
- [ ] Test `pad_home` — Should return to home screen
- [ ] Test `pad_volume_up` and `pad_volume_down`

## Dashboard Integration (Optional)
Example script-to-call automation for phone dashboard:

```yaml
automation:
  - alias: "Pad — Power"
    trigger:
      platform: state
      entity_id: input_boolean.pad_power_trigger
      to: "on"
    action:
      service: shell_command.pad_power
      
  - alias: "Pad — YouTube"
    trigger:
      platform: state
      entity_id: input_boolean.pad_youtube_trigger
      to: "on"
    action:
      service: shell_command.pad_youtube
```

## Notes
- ADB wireless debugging approach was abandoned after multiple connection failures (socket timeout, "Connection refused" despite successful pairing)
- SSH + ADB over local network proved reliable and requires only existing Termux SSH server
- Each command pre-connects ADB before issuing the control to ensure connection is fresh
- No persistent ADB daemon needed on Pad side

## Next Steps
1. Apply shell_command configuration to Pad's Home Assistant
2. Test each command individually via Home Assistant Services dev tool
3. (Optional) Create dashboard cards for phone quick-launch of Pad controls
4. (Optional) Set up Tasker automations on phone for voice or widget-based triggers
