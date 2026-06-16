# JARVIS Quick Start (Fold 7)

**Status:** ✅ Live and working

---

## Setup (One-Time)

```bash
cd ~/jarvis/vault
bash ./Claude\ Memory/Skills/jarvis/phone/install.sh
nano ~/.jarvis/.env  # Add API keys
```

Done. Cron, git, and Termux:Widget shortcuts auto-configured.

---

## Daily Use

### Text Capture (One-Tap)
1. Tap **JARVIS** home-screen button
2. Type: `remind me to call mom`
3. Press Enter

**Result:**
- ✅ Claude classifies: task, note, idea, or HA action
- ✅ Inbox file created: `Inbox/task_20260616-143022.md`
- ✅ Git auto-commits and pushes
- ✅ Notification: "✓ Task: Call mom"

### Manual Sync
Tap **SYNC** button to manually pull, commit, push vault.

### Daily Digest
Tap **DIGEST** button, or auto-runs at 9 AM.
Creates: `Journal/2026-06-16.md` with yesterday's summary.

---

## Test It

```bash
# Capture
bash ~/jarvis/vault/Claude\ Memory/Skills/jarvis/phone/jarvis.sh "test note"

# HA control
bash ~/jarvis/vault/Claude\ Memory/Skills/jarvis/phone/ha-call.sh turn_on light.lounge_main
```

Both should work instantly with notification feedback.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Widget not showing | Reinstall Termux:Widget; check `~/.shortcuts/jarvis` exists |
| Capture fails | Check `~/.jarvis/.env` has ANTHROPIC_API_KEY |
| HA control fails | Verify HA_URL (192.168.0.200:8123) and HA_TOKEN |
| Sync error | Run `cd ~/jarvis/vault && git pull` manually |

---

## Files

- `jarvis.sh` — Text classifier & router
- `ha-call.sh` — Home Assistant control
- `sync.sh` — Git orchestration
- `digest.sh` — Daily summary
- `README.md` — Full setup guide
- `SPEC.md` — Architecture
- `V2_TESTING_GUIDE.md` — Advanced (wake word, backup, offline)

---

## Advanced (v2, Optional)

**Wake Word Daemon:**
```bash
nohup bash ~/jarvis/vault/Claude\ Memory/Skills/jarvis/phone/wakeword.sh &
```

**Vault Backup (Nextcloud/rsync):**
Edit `~/.jarvis/backup-config.yaml`, then run:
```bash
bash ~/jarvis/vault/Claude\ Memory/Skills/jarvis/phone/backup.sh
```

See `V2_TESTING_GUIDE.md` for full steps.

---

**That's it. Start capturing.**
