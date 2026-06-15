# JARVIS Phone-Native — Setup Guide

Android 15 native Termux, Claude Code v2.1.112. Phone-native capture, classification, vault storage, and HA control.

## Quick Start

### 1. Prerequisites
- **Termux** (F-Droid or GitHub releases, NOT Google Play)
- **GitHub PAT** (fine-grained, configured in Windows Credential Manager on PC)
- **Anthropic API key** (sk-...)
- **Home Assistant** hub running on LAN (192.168.0.200:8123)
- **HA token** (long-lived access token)

### 2. One-Time Setup

On phone, in Termux:
```bash
bash ~/jarvis/Claude\ Memory/Skills/jarvis/phone/install.sh
```

This will:
- Check/install deps (git, curl, termux-api, cronie)
- Clone vault if needed
- Create ~/.jarvis/.env (template)
- Set up cron (daily digest at 9 AM)
- Create Termux:Widget shortcuts

### 3. Configure Secrets

```bash
nano ~/.jarvis/.env
```

Paste your secrets:
```
ANTHROPIC_API_KEY=sk-...
HA_URL=http://192.168.0.200:8123
HA_TOKEN=eyJhbGc...
```

Save: `Ctrl+O`, `Enter`, `Ctrl+X`

### 4. Test
```bash
# Test capture
bash ~/jarvis/Claude\ Memory/Skills/jarvis/phone/jarvis.sh "test note"
# Should create an Inbox file and notify

# Test HA control
bash ~/jarvis/Claude\ Memory/Skills/jarvis/phone/ha-call.sh turn_on light.lounge_main
# Should turn on your lounge lights (or return error if entity doesn't exist)
```

---

## Daily Usage

### Text Capture (One-Tap Widget)

1. Install **Termux:Widget** from Play Store
2. Add home-screen widget → select "jarvis", "sync", "digest"
3. Tap **JARVIS** button → type text → Enter

Flow:
```
Input: "call mom tomorrow"
  ↓
Claude Haiku classifies → action=task, value="Call mom"
  ↓
Write to Inbox/task_YYYYMMDD-HHMMSS.md
  ↓
git commit + push
  ↓
Notification: "✓ Task: Call mom"
```

### Voice Input (Manual v1, Auto v2)

**v1 (now):**
```bash
termux-speech-to-text | bash ~/jarvis/phone/jarvis.sh
```

**v2 (future, roadmap):**
- Wake word "hey jarvis" via local espeak
- Auto-route to jarvis.sh
- No cloud STT (privacy-first)

### Manual Sync

```bash
bash ~/jarvis/Claude\ Memory/Skills/jarvis/phone/sync.sh
```

Or tap **SYNC** button. Pulls latest vault, commits all local changes, pushes.

### Daily Digest

**Automatic:** Runs at 9 AM (cron)
**Manual:** 
```bash
bash ~/jarvis/Claude\ Memory/Skills/jarvis/phone/digest.sh
```

Output:
```
Journal/2026-06-16.md
  # Journal — 2026-06-16
  ## Summary
  - Called mom (done)
  - Researched loft insulation (ongoing)
  - Ordered 18650 cells (pending)
```

Notification: "✓ JARVIS Digest"

---

## Files Overview

| File | Purpose |
|------|---------|
| `jarvis.sh` | Main entry: classify input → route to vault/HA |
| `ha-call.sh` | Home Assistant REST wrapper (entity-safe) |
| `sync.sh` | git pull + add + commit + push + wake-lock |
| `digest.sh` | Summarize yesterday's Inbox → Journal (cron) |
| `install.sh` | One-time idempotent setup |
| `.env.example` | Secrets template (never commit real .env) |
| `SPEC.md` | Full architecture & decisions |

---

## Home Assistant Control

### Supported Actions (v1 = LAN only)

```bash
# Lights
ha-call.sh turn_on light.lounge_main
ha-call.sh turn_on light.lounge_main brightness 200
ha-call.sh turn_off light.bedroom_main

# Climate
ha-call.sh set_temperature climate.living_room 20

# Generic service
ha-call.sh [domain/]action entity_id [attr value ...]
```

### Tailscale Remote Access (v2)

If you want HA control from outside your home network:

```bash
# On phone:
pkg install tailscale
tailscale up

# Then point Claude to HA via Tailscale IP
# Edit ~/.jarvis/.env:
HA_URL=http://100.x.y.z:8123  # Tailscale IP
```

Known broken entities are skipped safely (see ha-call.sh).

---

## Cron & Scheduling

### Daily Digest at 9 AM

```bash
# View cron jobs
crontab -l

# Edit
crontab -e

# Stop/start cronie
termux-service cronie stop
termux-service cronie start
```

Entry format:
```
0 9 * * * /data/data/com.termux/files/usr/bin/bash $HOME/jarvis/Claude\ Memory/Skills/jarvis/phone/digest.sh
```

### Sync Log

```bash
tail -f ~/jarvis/.sync-log
```

Shows all pull/commit/push events + errors.

---

## Troubleshooting

### "ERROR: ~/.jarvis/.env not found"
```bash
Run install.sh again:
bash ~/jarvis/Claude\ Memory/Skills/jarvis/phone/install.sh
```

### HA call returns HTTP error
- Check HA_URL (should be http://192.168.0.200:8123)
- Check HA_TOKEN (Settings → Developer Tools → Authentication in HA)
- Check entity exists: `ha-call.sh turn_on light.nonexistent` should warn
- Check LAN connectivity: `ping 192.168.0.200`

### Notification missing
```bash
termux-notification --title "Test" --content "This should show"
```

If it doesn't, reinstall termux-api.

### FUSE warning on install
Vault MUST be in Termux native filesystem (~/$HOME), not OneDrive/cloud sync. If you cloned to /storage/emulated/0:

```bash
mv /storage/emulated/0/Obsidian-Vault- $HOME/jarvis
# Then re-run install.sh
```

### Git pull fails repeatedly
```bash
# Check credential helper
git config --global credential.helper

# If empty, configure:
git config --global credential.helper manager

# Or manually test:
cd ~/jarvis && git pull origin master
# (Enter GitHub PAT if prompted)
```

### Cron digest never runs
```bash
# Verify cronie is running
pgrep -f crond

# If not:
termux-service cronie start

# Check cron log
cat /data/data/com.termux/files/usr/var/log/crond.log

# Test manually:
bash ~/jarvis/Claude\ Memory/Skills/jarvis/phone/digest.sh
```

---

## Future Roadmap (v2+)

### Voice Loop (Near-term)
- Local wake word detection (no cloud STT)
- Continuous listen without wake word = impractical (battery/privacy)
- Plan: espeak for wake-word, then trigger jarvis.sh
- Revisit in ~3 months (Q3 2026)

### Secrets Hardening
- Android Keystore (biometric unlock)
- Encrypted ~/.jarvis/.env
- Currently: plaintext (v1 pragmatism, accepted risk)

### Offline Fallback
- Local Ollama Haiku on-device (if API costs spike)
- Model-agnostic routing (swap Haiku → Sonnet → local)
- Tested but not bundled yet

### Backup Beyond GitHub
- Nextcloud sync
- rsync to NAS
- Currently: GitHub only (acceptable for v1)

### HA Assist Integration
- HA's native voice assistant improving
- May replace phone-side routing
- Keep both for redundancy

---

## Architecture

```
User Input (text/voice)
  ↓
jarvis.sh (classifier)
  ↓
  ├─→ [note|task|idea|journal] → write to Inbox/ → sync.sh → git push
  ├─→ [ha_action] → ha-call.sh → HA REST API → physical action
  └─→ [decline] → notify user, exit
  ↓
Cron (9 AM daily)
  ↓
digest.sh
  ↓
Summarize Inbox → Journal/YYYY-MM-DD.md → git push → notify
```

---

## Security Notes

### Secrets Storage (v1)
- **~/.jarvis/.env** in plaintext (chmod 600)
- Never commit to vault (gitignored)
- **Risk:** phone theft = exposed keys
- **Mitigation:** Revisit Android Keystore in v2

### HA Token Scope
- Use fine-grained HA tokens (Settings → Developer Tools)
- Limit to `admin` or specific service permissions
- Rotate if exposed

### Network
- v1 = LAN only (192.168.0.200)
- v2 = Tailscale optional (no port forwarding needed)
- Never expose HA port directly to internet

---

## Performance Notes

- **Classifier latency:** ~1–2s (Haiku on phone's Claude Code)
- **Sync latency:** ~3–5s (git push over LAN)
- **Digest latency:** ~30–60s (Sonnet summarization, runs once daily)
- **Battery impact:** ~1–2% per jarvis.sh call, cron is negligible
- **Data:** ~100 KB/day (Inbox files), ~10 MB/month vault growth

---

## Support

If stuck, check:
1. `tail ~/jarvis/.sync-log` (git state)
2. `crontab -l` (cron schedule)
3. `pgrep -f crond` (cronie running?)
4. `grep -r "ERROR" ~/.jarvis/` (error logs, if any)
5. Manual test: `bash ~/jarvis/Claude\ Memory/Skills/jarvis/phone/jarvis.sh "hello"`

Or refer to `SPEC.md` for full architecture details.

---

**Happy capturing!**

— JARVIS v1, 2026-06-15
