# Fix — .171 IP collision (bedroom + upstairs)

**Date:** 2026-06-14
**Status:** Plan ready; YAML edit + OTA flash must be driven from HA UI

## Findings

From `~/jarvis` on Fold 7:

| Host | Ping result |
|---|---|
| 192.168.0.200 (HA Green) | ✅ HTTP responds |
| 192.168.0.171 | ❌ Destination unreachable |
| 192.168.0.205 (landing) | ❌ Destination unreachable |
| 192.168.0.172 | ❌ free |
| 192.168.0.207 | ❌ free |

Both bedroom and upstairs hardcode `static_ip: 192.168.0.171` in their YAML. Whichever boots first wins the lease; the other goes offline. Right now neither is on the wire — likely a separate power/connectivity issue stacked on top of the collision.

## Decision

- **Bedroom keeps 192.168.0.171** — canonical (`bedroom-2.yaml`), operational when alone, already wired into automations.
- **Upstairs moves to 192.168.0.207** — flagged as "next available" in the 2026-04-21 handover; .172 also free if .207 ends up taken.

## YAML change — upstairs node only

Path on HA Green: `/config/esphome/<upstairs-yaml-filename>.yaml`

Replace the WiFi block's `manual_ip.static_ip`:

```yaml
wifi:
  ssid: !secret wifi_ssid
  password: !secret wifi_password
  manual_ip:
    static_ip: 192.168.0.207   # was 192.168.0.171
    gateway: 192.168.0.1
    subnet: 255.255.255.0
```

Leave bedroom-2.yaml untouched.

## Click-path to apply

1. Browser → http://192.168.0.200:8123
2. Settings → Add-ons → **ESPHome** → Open Web UI
3. Open the upstairs YAML → edit the `wifi:` block as above → Save
4. **Install** → choose **Wirelessly** (OTA). If upstairs node is offline, USB flash instead.
5. Wait for "Successful" banner. Reboot bedroom node from ESPHome dashboard so it grabs .171 cleanly.

## Verification (run from Termux on Fold 7)

```bash
ping -c 3 192.168.0.171   # bedroom — should respond
ping -c 3 192.168.0.207   # upstairs — should respond
```

Both green = collision fixed. If only one responds, the other has a separate fault (power, WiFi, OTA failure) — investigate that node individually.

## Follow-ups (still open after this fix)

- Upstairs BLE-proxy + LD2410C radar `Max command length exceeded` contention — separate ticket, see `smart_home.md`.
- Landing (.205) and rvagent (.208:3000) still offline — likely unrelated to the collision; check power + WiFi.

## Update memory

- `_index.md` next-actions: tick "Clarify IP conflict" once verified.
- `project_smart_home_state.md` (auto-memory): bedroom .171, upstairs .207, IP collision resolved.
