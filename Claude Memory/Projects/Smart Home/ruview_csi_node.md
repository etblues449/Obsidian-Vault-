---
name: RuView CSI Node (Node 3 / Upstairs board)
description: ESP32-S3 WiFi-CSI human-sensing node — RuView / wifi-densepose
type: hardware-node
status: LIVE end-to-end (node → phone bridge → HTTP API); rvagent MCP wired, Desktop restart-verify pending
created: 2026-06-07
updated: 2026-06-07
---

# RuView CSI Node — Node 3

WiFi Channel-State-Information (CSI) human-sensing node from the RuView /
wifi-densepose monorepo. **Separate system from the LD2410 radar nodes** —
this senses presence/motion/vitals from WiFi signal disturbance, no radar, no camera.

## Identity
- **Board:** ESP32-S3, 4 MB flash, 2 MB PSRAM (SuperMini/Zero-class), USB-Serial/JTAG
- **MAC:** `e0:72:a1:e7:03:60`
- **Node ID:** 3
- **DHCP IP (observed):** `192.168.0.227`  ← pin a DHCP reservation on Hub 5
- **CSI target (receiver):** `192.168.0.181:5005` (the Windows PC)
- **Serial port:** COM12
- **Firmware:** `esp32-csi-node` v0.6.5, prebuilt `s3-adr110` variant, edge_tier=2

## What was wrong & the fix (2026-06-07)
**Symptom:** boot loop — `E flash_parts: partition 4 invalid - offset 0x220000 size 0x200000 exceeds flash chip size 0x400000`.
**Cause:** prebuilt `s3-adr110` bins shipped with the **8 MB** partition table; this board is **4 MB**. The oversized `ota_1` slot ran past the end of flash → bootloader rejected the table → reboot loop.
**Fix:** regenerated a valid 4 MB partition table from the repo's `partitions_4mb.csv`, reflashed.
- Bootloader `0x0`, **4 MB partition table `0x8000`**, app `0x20000`.
- App offset (0x20000 = ota_0) is identical in both tables, so only the table needed replacing.
- Generator script: `gen_partition_4mb.py` (in this folder) — byte-verified, MD5 OK, fits 4 MB (top = 0x3C0000).

## Reflash recipe (4 MB board)
```powershell
cd C:\Users\ElliotHorton\Documents\RuView\firmware\esp32-csi-node\release_bins\s3-adr110
python -m esptool --chip esp32s3 --port COM12 --baud 460800 --before default-reset --after hard-reset erase-flash
python -m esptool --chip esp32s3 --port COM12 --baud 460800 --before default-reset --after hard-reset write-flash --flash-mode dio --flash-size 4MB --flash-freq 80m 0x0 bootloader.bin 0x8000 partition-table-4mb.bin 0x20000 esp32-csi-node.bin
```
Then re-provision (erase wipes NVS):
```powershell
cd C:\Users\ElliotHorton\Documents\RuView
python firmware/esp32-csi-node/provision.py --port COM12 --ssid "JB's Smart 2.4G" --password "VeseyRD2026!" --target-ip 192.168.0.181 --target-port 5005 --node-id 3
```

## Architecture (confirmed from source)
- S3 node = WiFi STA → streams CSI over **UDP** to `target_ip:target_port` (`stream_sender.c` → `sendto`).
- `c6_espnow` chatter = **time-sync between nodes only** (ADR-110), NOT the data path. No C6 gateway needed for a single node.
- Adaptive controller (ADR-081) throttles `yield` → ~0 pps when idle, ramps on motion. So "no packets when nobody's moving" is by design.
- OTA HTTP server on `:8032`; WASM Tier-3 modules hot-loadable (WASM3 disabled in this build).
- mmWave UART probe (TX17/RX18) — none attached → CSI-only mode.
- AMOLED display task runs (no panel attached → harmless).

## Verified working (2026-06-07 ~02:55)
- Clean boot, WiFi connect, `Got IP: 192.168.0.227`.
- `UDP sender initialized: 192.168.0.181:5005`.
- CSI frames captured; on movement `presence 0 → 18.26`, `motion=1.00`, `yield` up to 5 pps, `sendto fail=0`.

## Receiver pipeline — SOLVED via phone bridge (2026-06-07 ~03:50)
The Windows PC's firewall silently dropped inbound UDP 5005 (no admin to open it).
**Pivoted the receiver onto the Android phone**, which has no inbound firewall.

Confirmed-live topology:
```
ESP32-S3 node (.227) ──UDP 5005──▶ phone bridge (.208) ──HTTP 3000──▶ PC (outbound = allowed) ──▶ Claude
```
- **Bridge:** `ruview-phone-bridge.py` (this folder) — single stdlib file merging the UDP
  watcher + sensing-server HTTP API in one process (shared in-memory state, no `/tmp` file).
  Runs in Termux: `termux-wake-lock; python ~/bridge.py` (UDP :5005 + HTTP :3000).
- **Phone:** `192.168.0.208` (static — but had broken DNS `194.168.x`; must be `192.168.0.1`).
- **Proven end-to-end:** `curl http://192.168.0.208:3000/api/v1/sensing/latest` →
  `{"presence":true,"n_persons":1,"motion":1.0,"breathing_rate_bpm":~14,"heartrate_bpm":~46,"privacy_class":2}`
  — live human presence + vitals from WiFi CSI alone (repeated cleanly across reboots).

## rvagent MCP (ruvnet hook) — wired, restart-verify pending
- Server: `@ruvnet/rvagent@latest` (npm, stdio MCP). 11 tools (presence_now, vitals_get_breathing,
  vitals_get_heart_rate, csi_latest, registry_list, bfld_last_scan, …).
- **Override env var (from source):** `RUVIEW_SENSING_SERVER_URL` (default `http://localhost:3000`).
- Added to `claude_desktop_config.json` pointed at `http://192.168.0.208:3000`.
  PS round-trip corrupted the file once; rebuilt cleanly with `fix_claude_config.py` from `.bak`
  → all 4 servers present (filesystem, github, playwright, rvagent), parses clean.

## Outstanding
- [ ] **Verify in Claude Desktop:** fully Quit from tray → reopen → "List your MCP tools" →
      "Use rvagent — is anyone home?" (first launch may take 10–20 s to fetch rvagent via npx).
- [ ] **Keep bridge alive:** phone on `.208`, Termux foreground + wake-lock, screen on
      (Samsung doze drops the UDP socket). Move bridge to an always-on host later.
- [ ] **Fix phone DNS** → `192.168.0.1`, clear the bad `194.168.x` (it kept dropping WiFi).
- [ ] **DHCP reservations** on Hub 5: node MAC `e0:72:a1:e7:03:60` → `.227`; phone → `.208`
      (note ESPHome "LR Presence (Battery C3)" is also assigned `.208` — keep it offline to avoid a clash).
- [ ] (Mesh) power the C6 node for multi-node time-sync + 3D pose; single node = line-of-sight only.
- [ ] 🔴 **SECURITY:** GitHub PAT was pasted in plaintext during this session (public share link) —
      rotate it and unshare the link. See [[Account/capture_queue]] §4.

## Helper scripts (this folder)
- `gen_partition_4mb.py` — regenerate the 4 MB partition table bin (byte-verified)
- `ruview-phone-bridge.py` — merged UDP-ingest + HTTP API bridge (runs on the phone in Termux)
- `c6-presence-watcher-COPY.py` — original UDP ingest / BFLD presence watcher (PC-side reference)
- `ruview-sensing-server-COPY.py` — original HTTP API shim for rvagent (PC-side reference)
- `csi_udp_listener.py` — bare UDP listener on :5005 to confirm reception (needs firewall open)
- `serial_log.py` — resilient COM12 logger (survives USB-JTAG re-enum on reset)
- `fix_claude_config.py` — rebuild claude_desktop_config.json cleanly (adds rvagent, no BOM)
