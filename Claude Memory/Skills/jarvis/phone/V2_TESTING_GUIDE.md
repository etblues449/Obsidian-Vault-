# JARVIS v2 Phase 2 Testing Guide
**Wakeword + Backup Complete Testing**

---

## Quick Start

Run these tests in order on your Fold 7 (Termux):

### 1. Wakeword Testing (5 min)

```bash
# Start daemon in background
nohup bash ~/jarvis/Claude\ Memory/Skills/jarvis/phone/wakeword.sh > /tmp/wakeword.log 2>&1 &
WAKE_PID=$!

# Simulate wake word trigger (v1 testing mode uses stdin)
# In another terminal, send test input:
echo "hey jarvis, remind me to call mom" | tee -a /proc/$WAKE_PID/fd/0 2>/dev/null || true

# Wait 2-3 seconds, check if Inbox file was created:
ls -lah ~/jarvis/Inbox/task_*.md 2>/dev/null | tail -1

# Check wake word log:
tail -10 ~/.jarvis/wakeword.log

# Stop daemon:
kill $WAKE_PID
```

**Expected outcome:**
- ✅ Log shows: `[timestamp] Wake word detected: ...`
- ✅ New Inbox file created with action=task, value="Call mom"
- ✅ Notification sent (if termux-notification working)

---

### 2. Backup Testing (10 min)

**Option A: Local Test (recommended, no credentials needed)**

```bash
# 1. Edit backup-config.yaml to use local rsync:
nano ~/.jarvis/backup-config.yaml

# Set these values (uncomment/modify):
backup_method: "rsync"
rsync:
  remote_path: "/tmp/jarvis-backup-test"  # Local test directory
  ssh_key: ""  # Not needed for local
  port: 22

# 2. Create test destination
mkdir -p /tmp/jarvis-backup-test

# 3. Run backup manually
bash ~/jarvis/Claude\ Memory/Skills/jarvis/phone/backup.sh

# 4. Verify backup was created
ls -lah /tmp/jarvis-backup-test/

# 5. Check backup log
tail -20 ~/.jarvis/backup.log
```

**Expected outcome:**
- ✅ Backup log shows: `[timestamp] ✓ rsync backup complete`
- ✅ Vault contents copied to /tmp/jarvis-backup-test/
- ✅ No errors in log

**Option B: Nextcloud Test (requires credentials)**

```bash
# 1. Edit backup-config.yaml:
nano ~/.jarvis/backup-config.yaml

# Fill in Nextcloud details:
backup_method: "nextcloud"
nextcloud:
  url: "https://your-nextcloud-instance.com"
  username: "your-username"
  app_password: "your-app-password"  # Generate in Nextcloud: Settings → Security
  remote_folder: "/JARVIS-Backup"

# 2. Run backup
bash ~/jarvis/Claude\ Memory/Skills/jarvis/phone/backup.sh

# 3. Verify in Nextcloud UI:
# - Log in to Nextcloud
# - Check /JARVIS-Backup/ folder for jarvis-backup-YYYYMMDD-HHMMSS.tar.gz

# 4. Check log
tail -20 ~/.jarvis/backup.log
```

**Expected outcome:**
- ✅ Backup log shows: `[timestamp] ✓ Backed up to Nextcloud: jarvis-backup-...tar.gz`
- ✅ File visible in Nextcloud /JARVIS-Backup/ folder
- ✅ No authentication errors

---

### 3. Cron Backup Scheduling (optional, verify scheduling works)

```bash
# View current cron entry
crontab -l | grep backup.sh

# Verify entry format (should be: 0 2 * * * /path/to/backup.sh)
# This runs daily at 2 AM

# To test cron timing manually:
# Set a test entry for 2 minutes from now, then check if it runs

# Current time (note it)
date

# Edit cron (add test entry for 2 min from now)
crontab -e

# Add line like: 35 15 * * * echo "cron test" >> ~/.jarvis/cron-test.log

# Wait 2 minutes and check:
tail ~/.jarvis/cron-test.log

# Verify cronie is running:
pgrep -f crond

# View cronie log (if available):
tail /data/data/com.termux/files/usr/var/log/crond.log
```

---

## Full Test Checklist

- [ ] **Wakeword daemon starts** (nohup wakeword.sh &)
- [ ] **Wake word detected** ("hey jarvis" → captured)
- [ ] **Inbox file created** (task action logged)
- [ ] **Notification sent** (if termux-api working)
- [ ] **Backup config edited** (rsync local or Nextcloud)
- [ ] **Backup runs successfully** (backup.sh completes)
- [ ] **Backup destination verified** (files present)
- [ ] **Cron entry present** (crontab -l shows backup.sh at 2 AM)
- [ ] **Log files working** (~/.jarvis/wakeword.log, ~/.jarvis/backup.log)

---

## Troubleshooting

### Wakeword daemon won't start
```bash
# Check permissions
bash -x ~/jarvis/Claude\ Memory/Skills/jarvis/phone/wakeword.sh 2>&1 | head -20

# Check PID file
cat ~/.jarvis/wakeword.pid

# Kill stale daemon
kill $(cat ~/.jarvis/wakeword.pid) || true
rm ~/.jarvis/wakeword.pid
```

### Backup fails with "config not found"
```bash
# Ensure config exists and is readable
ls -l ~/.jarvis/backup-config.yaml
chmod 600 ~/.jarvis/backup-config.yaml

# Verify YAML syntax (no tabs, proper indentation)
cat ~/.jarvis/backup-config.yaml | head -10
```

### Nextcloud backup fails
```bash
# Test curl connectivity first
curl -u "username:password" https://your-nextcloud-instance.com -I

# Check credentials are correct (no spaces)
grep "url:\|username:\|app_password:" ~/.jarvis/backup-config.yaml

# Verify app password (not regular password) from Nextcloud Settings → Security
```

### Backup log shows "rsync failed"
```bash
# Check SSH key exists
ls -l ~/.ssh/id_rsa

# Test rsync connectivity manually
rsync -avz -e "ssh -i ~/.ssh/id_rsa -p 22" /tmp/test user@host:/backup/test

# If key not configured, leave ssh_key empty in config
```

---

## Next Steps (v2.1+)

1. **Wakeword v2** — Real audio detection via espeak/Pocketsphinx (currently stdin-based for testing)
2. **Backup encryption** — GPG encrypt before upload (future)
3. **Backup retention** — Auto-delete old backups based on retention_days setting
4. **Offline classifier** — Full Ollama testing when aarch64 build available

---

## Reference

- Config files: `~/.jarvis/backup-config.yaml`, `~/.jarvis/wakeword-config.yaml`
- Logs: `~/.jarvis/backup.log`, `~/.jarvis/wakeword.log`
- Scripts: `backup.sh`, `wakeword.sh`
- Related: [[2026-06-16-FULL.md]] (session summary)
