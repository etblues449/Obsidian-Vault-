# ha-config/ — Home Assistant configuration held in the vault

Config that belongs to the HA Green hub (`192.168.0.200`) but is version-controlled here,
so it survives a hub rebuild and can be reviewed before it goes live.

```
ha-config/
└── packages/
    └── jarvis_assist_person.yaml   Task 3 — Assist satellite automations on Frigate person
                                    detection (MQTT), 2026-08-04
```

## This is not yet the hub backup

The Smart Home index carries an open action: *"Back up hub-side config into the vault
(`automations.yaml`, `bedroom-2.yaml`, `frigate.yaml`, scenes/scripts)"*. This directory is
where that lands when it happens — but **nothing here was pulled off the hub**. The one
file present was authored in the vault and has not been installed. The ~19 lounge
automations still exist nowhere but the hub.

## Installing a package

Packages need to be enabled once. In `configuration.yaml`:

```yaml
homeassistant:
  packages: !include_dir_named packages
```

Then copy the file to `<ha-config>/packages/`, run **Developer Tools → YAML → Check
configuration**, and restart. Package keys (`mqtt:`, `automation:`, `script:`,
`input_boolean:`) merge with any you already have — they do not replace them. A package
whose top-level key duplicates an existing *non-list* key will fail the config check; the
keys used here are all list- or dict-merge-safe.

## Why a package instead of the automation editor

The Frigate HA integration is **not installed** on this hub, so Frigate's detections only
exist as MQTT topics — and MQTT entities cannot be created from the automation UI. Keeping
the MQTT entities, helpers, script and automations in one file means the whole feature can
be installed, reviewed, or removed as a unit, and the UI editor still shows and traces the
automations normally once loaded.

## Verification

Neither script writes anything, so both are safe to run at any time.

```bash
# Offline — structure, entity references and the recorded gotchas. No hub needed.
python3 "Assistant Core/ha-diagnostics/test/validate-assist-package.py" .

# Live — the other side of the interface, against the running hub.
HA_TOKEN=<long-lived-token> node "Assistant Core/ha-diagnostics/assist-preflight.mjs"
HA_TOKEN=<long-lived-token> node "Assistant Core/ha-diagnostics/assist-preflight.mjs" --post
```

`HA_TOKEN` comes from HA → profile → Security → Long-lived access tokens. It is read from
the environment and is never printed or written to the vault. Never commit a token here.

Full runbook, design decisions and the end-to-end test protocol:
`Claude Memory/Projects/Smart Home/automations/2026-08-04-assist-person-automations.md`
