# WebRTC card — "Custom element not found: webrtc-camera"

**Date:** 2026-08-04 · **Task:** handoff Task 1 · **Status:** diagnosis + corrected card
committed. **Not yet verified on the live instance** — this session had no LAN or Nabu
Casa access to `192.168.0.200`, so nothing below was observed on the hub.

## What was actually verified

Everything in this note was read from **AlexxIT/WebRTC source at tag `v3.6.1`** and from
**home-assistant/core `camera/__init__.py`**, on 2026-08-04. No claim here is inferred
from documentation or memory.

### The installed version is pinned, exactly

The served card imports `video-rtc.js?v=1.9.9` and `digital-ptz.js?v=3.3.0`. Checked
against every recent tag:

| Tag | `video-rtc` import |
|---|---|
| master | 1.9.12 |
| **v3.6.1** | **1.9.9** ✅ |
| v3.6.0 | 1.9.4 |
| v3.5.2 → v3.5.0 | 1.8.0 |

So the instance runs **v3.6.1**, the current release. `__init__.py` is **byte-identical**
between v3.6.1 and master; `utils.py` differs by one line (`BINARY_VERSION` 1.9.9 →
1.9.12, the bundled go2rtc binary). The source read therefore applies exactly.

This matters because it **rules out** the "old integration predates the HA 2024.x
`hass.data["lovelace"]` dataclass change" theory. v3.6.1's `init_resource` already
handles both forms:

```python
lovelace = hass.data["lovelace"]
resources = lovelace.resources if hasattr(lovelace, "resources") else lovelace["resources"]
```

## Root cause mechanism

`async_setup()` (`__init__.py`) performs these as **separate sequential steps**:

```python
async def async_setup(hass, config):
    # 1. Serve lovelace card   <-- makes /webrtc/webrtc-camera.js fetchable
    for name in ("video-rtc.js", "webrtc-camera.js", "digital-ptz.js"):
        await utils.register_static_path(hass, "/webrtc/" + name, ...)

    # 2. Add card to resources <-- makes the FRONTEND load it
    version = getattr(hass.data["integrations"][DOMAIN], "version", 0)
    await utils.init_resource(hass, "/webrtc/webrtc-camera.js", str(version))
    ...
    # 6. Register webrtc.create_link and webrtc.dash_cast
```

**Step 1 and step 2 are independent.** Fetching the JS successfully proves *only* that
step 1 ran. It says nothing about whether the Lovelace resource exists. That is the whole
explanation for "module is served but the frontend hasn't loaded it" — and it means the
decisive diagnostic is **the resource list**, not the integration's presence.

### Two corrections to the handoff's next steps

The handoff's step 3 says: *"Check for a WebRTC config entry. If absent, add it — it's
required for the `webrtc.dash_cast` and `webrtc.create_link` services."* Both halves are
wrong:

1. **Those services are registered in `async_setup` step 6, not `async_setup_entry`.** A
   config entry is not what gates them.
2. **A config entry almost certainly already exists.** `manifest.json` sets
   `"config_flow": true`, so the component is only ever set up *because* a config entry
   was added. If no entry existed, `async_setup` would never run and
   `/webrtc/webrtc-camera.js` would return **404**, not the card source. The JS serving is
   itself evidence the entry is there.

What the config entry *does* control is `hass.data["webrtc"]` (the go2rtc URL), set only
in `async_setup_entry`. `ws_connect` reads it **only as a fallback** when the card omits
`server:`. The card below sets `server:` explicitly, so it doesn't depend on it.

## The decisive check

Settings → Dashboards → ⋮ → **Resources**. Look for:

```
/webrtc/webrtc-camera.js?v=v3.6.1
```

The `?v=` suffix is how you tell the integration registered it — `init_resource` appends
`"?v=" + str(version)`, and the manifest version string is literally `v3.6.1`, so the
doubled `v` is correct, not a typo.

- **Resource present** → registration worked. The problem is the browser: the resource
  list is delivered at page load, so any tab open since before install will show
  "Custom element not found" indefinitely. Hard refresh (Ctrl+Shift+R); if that fails,
  clear site data for the HA origin.
- **Resource absent** → `async_setup` aborted between step 1 and step 2. Check
  Settings → System → Logs for a `webrtc` setup traceback; that traceback is the real
  bug, and it will name the failing call directly.

**Adding the resource manually is safe** and is the right move either way. `init_resource`
matches existing items with `item["url"].startswith("/webrtc/webrtc-camera.js")` — so a
hand-added bare `/webrtc/webrtc-camera.js` gets **updated** to the versioned URL on next
restart rather than duplicated.

## Two real bugs found in the proposed card config

Both were caught by a harness that replicates the card's own logic
(`dashboard/webrtc-camera-card.yaml` is the corrected result).

### 1. `poster` would always 403

Proposed: `poster: /api/camera_proxy/camera.living_room_ai_cam_ai_cam`

The card auto-derives (`webrtc-camera.js` L68):

```js
poster_remote: config.poster && (config.poster.indexOf('://') > 0 || config.poster.charAt(0) === '/')
```

A leading `/` sets `poster_remote = true`, which assigns the URL **straight to
`<video poster>`** (L271). That browser fetch carries no `Authorization` header and no
`?token=`. HA core's `CameraView.get()`:

```python
authenticated = request[KEY_AUTHENTICATED] or request.query.get("token") in camera.access_tokens
if not authenticated:
    if hdrs.AUTHORIZATION in request.headers:
        raise web.HTTPUnauthorized
    raise web.HTTPForbidden          # <-- this branch
```

→ **403 Forbidden**, no poster, every time.

**Fix:** use the bare entity id. `poster: camera.living_room_ai_cam_ai_cam` keeps
`poster_remote = false`, so the card routes it through its own **signed** `/api/webrtc/ws`
path (L154-155), where `ws_poster()` special-cases `poster.startswith("camera.")` and
serves the image authenticated via `async_get_image`.

### 2. One missing entity silently deletes every shortcut

`renderTemplate` (L654-673) does `JSON.stringify` → `eval` as a JS template literal with
`states` in scope → `JSON.parse`, all inside:

```js
try { this.config[name] = JSON.parse(eval('`' + template + '`')); renderHTML(); }
catch (e) { console.debug(e); }
```

`console.debug` — not `warn`, not `error`. So if
`states['light.living_room_ai_cam_status_led']` is undefined, `.state` throws a
`TypeError`, the catch swallows it, and **the entire shortcuts row disappears** with no
visible error and nothing in the default console view.

**Fix:** optional chaining — `states['...']?.state === 'on'`.

Also: quoting the whole template value in YAML removes the `": "` trap outright, so the
fragile no-space `?'mdi:led-on':'mdi:led-off'` form is no longer needed.

## Verification harness

`scripts/verify-webrtc-card.mjs` replicates v3.6.1's `setConfig`, `poster_remote`
derivation, `ws_connect` URL construction, the template pipeline (against four entity
states) and shortcut dispatch.

Run: `node "Claude Memory/Projects/Smart Home/scripts/verify-webrtc-card.mjs" \
  "Claude Memory/Projects/Smart Home/dashboard/webrtc-camera-card.yaml"`

- Corrected card → **all 12 checks pass**.
- Original handoff card → **2 failures** (the poster 403 and the template `TypeError`),
  exit 1. Confirmed the harness actually detects both, rather than passing vacuously.

## Confirmed accurate in the handoff

Checked against source, no change needed: `intersection` defaults to **0.75** and
`intersection: 0` is special-cased (L15-16); `poster_remote` is undocumented and
auto-derived; `shortcuts` accepts `more_info: <entity>` as an alternative to `service`
(L616-624); templates work in exactly `shortcuts`, `style`, `ptz`; `server:` is a real
card option passed as `&server=` (L169-171); the trailing slash on `server:` is right
given `urljoin("ws" + server[4:], "api/ws")`.

## Still to do on the live instance

1. Check Resources for `/webrtc/webrtc-camera.js?v=v3.6.1` and take the branch above.
2. Add the card via **Add card → Manual** (not the View configuration dialog).
3. Confirm the mode label top-right reads **RTC** (MSE acceptable fallback).
