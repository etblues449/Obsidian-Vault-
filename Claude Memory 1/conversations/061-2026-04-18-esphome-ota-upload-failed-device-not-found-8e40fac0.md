---
name: ESPHome OTA upload failed device not found
description: Imported Claude.ai conversation from 2026-04-18 (2 messages)
type: reference
uuid: 8e40fac0-6de6-437b-87f9-1083181af15f
created_at: 2026-04-18T22:42:37.475421Z
updated_at: 2026-04-18T22:42:51.045455Z
---

# ESPHome OTA upload failed device not found

## human — 2026-04-18 22:42:38
_attachments:_ 
_files:_ 

_(empty)_

## assistant — 2026-04-18 22:42:47

 It looks like your ESPHome firmware compiled successfully, but the OTA upload failed because the device couldn't be found on the network.

The error is:

> `Error resolving IP address of ['cctv-.local']. Is it connected to WiFi?`

Here are the steps to resolve this, in order:

**Step 1 — Confirm the device is powered on and connected to WiFi**

Check that your ESP32 is physically powered and that it has successfully joined your WiFi network. If it's a fresh flash or the WiFi credentials changed, it won't be reachable via OTA at all.

**Step 2 — Check if mDNS is working**

The hostname `cctv-.local` is resolved via mDNS. Try pinging it from your computer:

```bash
ping cctv-.local
```

If that fails, mDNS isn't resolving. This is common on Windows or on networks where mDNS traffic is blocked.

**Step 3 — Find the device's IP address**

Check your router's DHCP client list for a device named `cctv-` (or similar). Note the IP address it was assigned.

**Step 4 — Set a static IP in your ESPHome config**

Once you have the IP, update your device's YAML to use it directly, which bypasses mDNS entirely:

```yaml
wifi:
  ssid: "YourSSID"
  password: "YourPassword"
  manual_ip:
    static_ip: 192.168.1.XXX   # the IP you found in step 3
    gateway: 192.168.1.1
    subnet: 255.255.255.0
```

After adding this and doing an initial flash via USB (since you can't OTA yet), future OTA uploads will use the static IP reliably.

**Step 5 — If you can't do OTA at all right now**

Flash the already-built `firmware.factory.bin` directly via USB using esptool or the ESPHome web flasher, then OTA will work for subsequent updates once it's on the network.

Let me know which step you're stuck on and I can help further.
