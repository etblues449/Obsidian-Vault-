# Mimic API Client

**Status:** Active Setup  
**Branch:** `claude/mimic-repo-setup-lupt7y`  
**Last Updated:** 2026-07-17

## What is Mimic?

Mimic intercepts API traffic from any app (iOS, web, etc.) and auto-generates Python client libraries from it using Claude. This lets you:
- Capture session/auth data once
- Generate typed Python clients automatically
- Use closed APIs programmatically in JARVIS

## Architecture

```
App Traffic (mitmproxy)
    ↓
Session Extraction (mimic.Session)
    ↓
Claude Codegen → Python Client Library
    ↓
JARVIS Integration (scripts/generated_clients/)
```

## Installation

✅ **Installed** via `uv tool install mimic-client`  
✅ **Location:** `/home/user/Obsidian-Vault-/mimic/`  
✅ **CLI:** `mimic` (available globally)

## Usage Pattern

### 1. Capture App Traffic
```bash
mimic record                    # starts mitmproxy proxy + prints iPhone setup
```

### 2. Extract Session & Learn Endpoints
```bash
mimic hosts                     # list captured API hosts
mimic learn prod-api.example.com    # see endpoints
```

### 3. Generate Client
```bash
mimic gen prod-api.example.com  # outputs client.py
```

### 4. Use in JARVIS
```python
from generated_clients.my_app import MyApp
app = MyApp()
data = app.get_recommendations()
```

## Capture Backends

- **mitmproxy** (iOS apps) — default, proxy-based
- **cURL paste** (web apps) — copy-as-cURL from devtools
- **HAR file** (web/browser) — Chrome/Firefox Network tab export

## Limitations & Known Issues

- **Certificate Pinning** (Instagram, banking) — requires `mimic unpin` + Frida
- **DPoP / Sender-Constrained Tokens** — not compatible; no workaround

## Integration with JARVIS

### Target Apps for Mimic Integration
- [ ] Hinge dating app (recommendations, messaging)
- [ ] YouTube Music (streaming, playlists)
- [ ] Custom home automation APIs
- [ ] TBD based on use cases

### Generated Clients Location
`/home/user/Obsidian-Vault-/scripts/generated_clients/`

## Configuration

Mimic auto-detects Claude API key from environment. Ensure `ANTHROPIC_API_KEY` is set.

## CLI Commands

| Command | Purpose |
|---------|---------|
| `mimic doctor` | Verify setup (Claude API, mitmproxy, LAN IP) |
| `mimic record` | Start proxy, capture traffic |
| `mimic hosts` | List captured API hosts |
| `mimic learn {host}` | View endpoints for a host |
| `mimic gen {host}` | Generate Python client |
| `mimic unpin {ipa\|bundle-id}` | Bypass cert pinning (requires Frida) |

## Ethics & Legal

- Use on your own accounts and data only
- Generated clients replay your sessions — not for unauthorized access
- Respect app terms of service

## Next Steps

1. [ ] Test mimic with a real app capture
2. [ ] Set up first generated client for JARVIS integration
3. [ ] Create wrapper scripts for common operations
4. [ ] Document integration patterns

## Useful Links

- [mimic GitHub](https://github.com/littledivy/mimic)
- [Pinning Bypass Docs](docs/pinning.md)
- [DPoP Discussion](docs/dpop.md)
