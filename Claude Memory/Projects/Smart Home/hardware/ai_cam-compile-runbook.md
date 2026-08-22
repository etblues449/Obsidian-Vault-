# ai_cam Option B runbook — compile off-box on the PC, get "Hey Jarvis" back

**Why:** the full config ([[ai_cam]]) OOMs the HA Green's compiler during the TFLite
wake-word build. Your Windows PC compiles it in minutes. **No USB cable needed** — the
PC is on the same LAN, so upload goes OTA to 192.168.0.199.

**Good news discovered 2026-08-02:** the config uses ESPHome's **native** `es7210`
audio_adc component (it resolves with no external source in the current validated
config), so nothing extra is required for an off-box build. The vault's custom
component at `esphome/components/es7210/` is on master as a fallback if a future
ESPHome release regresses.

## Steps (Windows PC, ~15 min first time, ~5 min after)

1. **Install ESPHome** (once). In PowerShell:
   ```powershell
   python -m venv esphome-venv
   .\esphome-venv\Scripts\activate
   pip install esphome
   ```
   (Needs Python 3.10+. Docker works too if you prefer: `docker run esphome/esphome`.)

2. **Get the config.** Pull the vault, then:
   ```powershell
   mkdir ai_cam_build ; cd ai_cam_build
   copy "..\Obsidian-Vault-\Claude Memory\Projects\Smart Home\hardware\ai_cam.yaml" .
   ```

3. **Create `secrets.yaml`** next to it, with the SAME values the Green uses
   (ESPHome Builder → the three-dot menu → Secrets):
   ```yaml
   wifi_ssid: "JB's Smart 2.4G"
   wifi_password: "<from Builder secrets>"
   api_encryption_key: "<from Builder secrets>"
   ota_password: "<from Builder secrets>"
   ```
   > Same values matter: a different `api_encryption_key` breaks the HA connection and a
   > different `ota_password` breaks future OTA from the Builder. Never commit this file.

4. **Compile + flash OTA** (board stays where it is, powered):
   ```powershell
   esphome run ai_cam.yaml
   ```
   Pick **OTA (192.168.0.199)** when asked. Compile is the slow part (3–5 min);
   upload takes ~1 min.

5. **Verify:**
   - Device page: **Wake word select becomes available** (was `unavailable`) and shows
     `hey_jarvis`.
   - Say **"Hey Jarvis"** → satellite goes Listening → answer through the speaker.
   - `logger baud_rate: 0` is expected — logs stream via the API, not USB serial.
   - SD card: press **Save Snapshot to SD**, check the log line `Wrote snapX.jpg`.
   - Camera still streams at `http://192.168.0.199:8080` (boot-race settle delay is in
     this config — if `ESP_ERR_NOT_SUPPORTED` ever appears at boot, note it; 10 clean
     reboots = the race fix is verified, tick it in the index).

6. **Afterwards:** re-run ha-doctor (LAN this time) and commit the report — wake-word
   entities should flip to available, and the LAN node probes fill the gap the remote
   run skipped.

## If OTA is refused
Wrong `ota_password` in secrets — fix step 3. Last resort is USB: hold BOOT, tap RST,
release BOOT, then `esphome run ai_cam.yaml` and pick the COM port (or flash the
factory bin via https://web.esphome.io).

## Same recipe for the fleet
This exact flow revives `landing_ai_cam_2` (2nd CAM board — new IP + its own API key in a
copied config) and any future node the Green can't compile. Structural fix stays the
**N100** on the [[../MASTER_PLAN]] buy list.


## ⚠️ Addendum (2026-08-04) — REQUIRED patch for the PC compile: the PyPI channel gap

Verified today on a clean install: **`pip install esphome` gives you at most 2026.6.5 —
PyPI trails the HA add-on channel, and 2026.6.5 does NOT ship `waveshare_io_ch32v003`**
(the Green's 2026.7.1 add-on does). Step 4 (`esphome run ai_cam.yaml`) therefore fails
off-box with `Unable to import component waveshare_io_ch32v003` unless you add this to
`ai_cam.yaml`'s `external_components:` before compiling:

```yaml
  - source:
      type: git
      url: https://github.com/esphome/esphome
      ref: 2026.7.1
      path: esphome/components
    components: [waveshare_io_ch32v003]
```

This pins the official component at the hub's exact release. Remove it once your PC
ESPHome ships the component natively. `hardware/landing_ai_cam_2.yaml` already includes
it. (Everything else in this runbook stands: es7210 is native, hey_jarvis/vad models
download automatically on a normal network — a 403 on those in a restricted environment
is the proxy, not the config.)

