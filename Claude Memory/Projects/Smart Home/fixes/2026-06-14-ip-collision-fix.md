# Fix — .171 IP collision (upstairs node)

> **Reconstructed stub, 2026-07-27.** The original note was never committed — the
> Smart Home `_index.md` linked to it but no file existed. Everything below is
> sourced *from the index entry itself*; nothing has been invented to fill it out.
> Detail beyond what the index recorded is marked `<!-- TO FILL -->`.

## The problem

An IP collision on `192.168.0.171` involving the upstairs ESP32 node.

## The plan the index records

- **Move upstairs to `.207`** via ESPHome OTA.
- **Delete the ghost "Upstairs" (.207) config** in ESPHome Builder — that board now
  runs CSI firmware, so the old entry is stale and will confuse future flashes.
- **Add a DHCP reservation** for the RuView node: MAC `e0:72:a1:e7:03:60` → `.227`.

## Status

**Not yet applied** — still listed as an open next-action on the Smart Home index.

## Before touching this

Per `voice-satellite-ops`: a node unreachable at its address is a DHCP reservation or
collision problem far more often than a firmware problem. Check the lease table before
reflashing, and never retry an OTA blindly on a device you cannot physically reach.

## Detail not recovered

<!-- TO FILL — collision evidence, the other device on .171, lease table state -->
