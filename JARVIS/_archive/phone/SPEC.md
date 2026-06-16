# JARVIS Phone-Native — Implementation Spec

**Target:** Android 15, aarch64 Termux, Claude Code v2.1.112
**Delivery:** Vault (Claude Memory/Skills/jarvis/phone/) → git pull on phone → run install.sh once

## Overview

Phone-native JARVIS: voice/text input → Claude classifier (Haiku) → routes to vault (notes/tasks/ideas/journal) or HA REST (lights/climate). Scheduled digest summarizes yesterday's captures into Journal. Sync is cron + git.

## Component Architecture

### 1. `.env.example` → `~/.jarvis/.env`
Secrets template (gitignored on the vault, but .example is committed for reference).

**Content:**
```
ANTHROPIC_API_KEY=sk-...
HA_URL=http://192.168.0.200:8123
HA_TOKEN=eyJhbGciOi...
```

**On phone:** `cp phone/.env.example ~/.jarvis/.env && chmod 600 ~/.jarvis/.env` (done by install.sh).

---

### 2. `jarvis.sh`
Main entry point. Orchestrates all routing.

**Usage:**
```bash
jarvis.sh "turn on the lounge lights"  # text arg
jarvis.sh                               # stdin (from termux-speech-to-text pipe)
```

**Flow:**
1. Consume text from arg or stdin
2. Load ~/.jarvis/.env
3. Call `claude -p <classifier>` with text + resources/classification.md
4. Parse Claude's response: `{action, category, entity, value}`
5. Route:
   - `action=note|task|idea|journal` → call write-to-vault function → git add + commit
   - `action=ha_action` → call ha-call.sh
   - `action=decline` → confirm & exit
6. Confirmation: `termux-notification` with 1-line summary
7. `sync.sh` (git pull + add + commit + push)

**Key details:**
- Uses Claude Haiku (cheap, fast)
- Reuses resources/classification.md routing table
- Error handling: if classify fails, prompt user to retry or skip
- Secrets sourced from ~/.jarvis/.env (never echoed)

---

### 3. `ha-call.sh`
HA REST wrapper. Safe entity mapping (knows broken HA entities).

**Usage:**
```bash
ha-call.sh "turn_on" "light.lounge_main" "brightness" "200"
```

**What it does:**
1. Load HA_URL and HA_TOKEN from ~/.jarvis/.env
2. Build curl command:
   ```
   curl -X POST http://$HA_URL:8123/api/services/light/turn_on \
     -H "Authorization: Bearer $HA_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"entity_id": "light.lounge_main", "brightness": 200}'
   ```
3. Handle entity safety:
   - Skip broken entities (maintain a known-bad list in ha-call.sh)
   - Return HTTP status + curl error (if network fails)
4. Timeout: 5s curl timeout (phone might be on cellular)
5. Optional Tailscale routing (v2; v1 = LAN only)

---

### 4. `sync.sh`
Git pull + add + commit + push with wake-lock. Runs from cron.

**Usage:**
```bash
sync.sh                    # one-shot
```

**Flow:**
1. Acquire wake-lock (`termux-wake-lock`)
2. `cd ~/jarvis` (vault clone location)
3. `git pull origin master --quiet`
4. `git add -A`
5. `git commit -m "JARVIS: phone sync $(date +%s)"` (quiet if nothing to commit)
6. `git push origin master --quiet`
7. Release wake-lock (`termux-wake-unlock`)
8. Log to `.sync-log` (for debugging)

**Error handling:** if push fails (network), next sync will retry. No user prompt needed (idempotent).

---

### 5. `digest.sh`
Cron job: summarize yesterday's Inbox into Journal + notification.

**Usage:**
```bash
digest.sh                 # runs from cron daily at 9 AM
```

**Flow:**
1. Load ~/.jarvis/.env
2. Find all `.md` files in `Inbox/` created in last 24h
3. Read each file
4. Call `claude -p <digest-prompt>` with Sonnet (slower but better):
   - Input: all yesterday's captures
   - Output: bullet-point summary
5. Write to `Journal/YYYY-MM-DD.md` (today's date)
6. `termux-notification` with digest summary
7. Optionally delete yesterday's Inbox files (or archive to Archive/)

**Cron entry (install.sh sets this up):**
```
0 9 * * * /data/data/com.termux/files/usr/bin/bash ~/jarvis/phone/digest.sh
```

---

### 6. `install.sh`
Idempotent one-time setup.

**Run once on phone:** `bash ~/jarvis/phone/install.sh`

**What it does:**
1. Check deps:
   - `git` ✓ (pre-installed on Termux)
   - `curl` ✓ (pre-installed)
   - `termux-api` (install if missing): `pkg install termux-api`
   - `cronie` (cron daemon): `pkg install cronie`
2. Clone vault (if not already cloned):
   - `git clone https://github.com/etblues449/Obsidian-Vault- ~/jarvis`
3. Vault FUSE safety check:
   - Confirm vault is **not** in `/storage/emulated/0` (OneDrive/cloud sync breaks git)
   - If cloned there, error & suggest moving to `~/jarvis` (Termux native FS)
4. Create ~/.jarvis/ and copy .env.example:
   - `mkdir -p ~/.jarvis && cp phone/.env.example ~/.jarvis/.env && chmod 600 ~/.jarvis/.env`
   - User must edit and paste secrets
5. Create Termux:Widget shortcuts:
   - Symlink `phone/shortcuts/` → `~/.shortcuts/`
   - Shortcut buttons: "Jarvis", "Sync", "Digest"
6. Start & enable cronie:
   - `termux-service cronie start`
   - Create cron entry for digest.sh (9 AM daily)
7. Verify native git (run `git --version`)
8. Print final checklist (user must edit .env, start voice app)

**Idempotent:** safe to run multiple times (skips already-done steps).

---

### 7. `README.md`
Setup instructions + one-tap widget usage + Tailscale add-on + v2 voice roadmap.

**Sections:**
- **Quick Start:** install.sh → edit .env → restart Termux
- **Widgets & One-Tap:** Termux:Widget button setup (Jarvis / Sync / Digest)
- **Voice (v1):** Manual text input; v2 roadmap (wake word)
- **HA Control:** LAN-only v1; Tailscale routing (documented, not bundled)
- **Cron & Digest:** Scheduled summary, how to adjust timing
- **Troubleshooting:** git pull fails, curl timeout, notification missing, FUSE warning
- **Future:** voice loop, secrets in Android Keystore, local Ollama fallback

---

## Decisions Locked In

| Decision | Rationale |
|----------|-----------|
| Classifier: Haiku 4.5 | Cheap + fast for categorization; OK 2–3% misclassification |
| Conversation: Sonnet/Opus | Digest needs better quality; user opt-in for complex HA queries |
| Secrets in ~/.jarvis/.env | v1 pragmatism; revisit Android Keystore in v2 |
| Vault in Termux FS only | FUSE (OneDrive) corrupts git; must stay in native /data/data tree |
| Voice loop + wake word = v2 | Battery/privacy risk; text + widget is solid v1 |
| HA v1 = LAN REST only | Simpler, more reliable; Tailscale documented but not bundled |
| Cron (cronie) not systemd-user | Termux doesn't have systemd; cronie is the Android-friendly scheduler |

---

## Deployment Checklist

- [ ] User approves spec
- [ ] Write all 7 files to `Claude Memory/Skills/jarvis/phone/`
- [ ] Commit & push from PC
- [ ] User: `git pull` on phone (or wait for auto-sync if enabled)
- [ ] User: `bash ~/jarvis/phone/install.sh` (one-time)
- [ ] User: Edit `~/.jarvis/.env` with actual secrets
- [ ] User: Test `jarvis.sh "test note"` (should create a note in Inbox)
- [ ] User: Test HA call `ha-call.sh "turn_on" "light.lounge_main"`
- [ ] User: Set up Termux:Widget launcher icon
- [ ] Digest cron verifies at 9 AM tomorrow

---

## v2 Roadmap (Post-Launch)

- **Wake word:** espeak + local voice detection (no cloud) + trigger jarvis.sh
- **Secrets:** Android Keystore + biometric unlock
- **Backup:** Nextcloud or rsync to offsite NAS
- **Offline fallback:** Ollama Haiku running locally for classify (if API costs spike)
- **HA Assist:** Evaluate HA's own voice assistant; possibly replace phone routing

---

## Files to Write

1. `.env.example`
2. `jarvis.sh`
3. `ha-call.sh`
4. `sync.sh`
5. `digest.sh`
6. `install.sh`
7. `README.md`

All go into `Claude Memory/Skills/jarvis/phone/`.
