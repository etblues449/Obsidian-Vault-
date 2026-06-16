# JARVIS Phone-Native v2 — Complete Feature Build

**Goal:** Ship v1→v2 with all 5 features: wake word, secrets hardening, offline fallback, vault backup, HA Assist integration.

**Timeline:** Incremental build; each feature is independent after design phase.

---

## Feature 1: Wake Word Detection (espeak + local)

### Design
- No cloud STT; privacy-first
- Local audio loop: listen for "hey jarvis" → trigger jarvis.sh
- espeak for wake-word (lightweight)
- Battery-safe: only processes when mic detects sound above threshold
- v1 fallback: manual text input (no voice loop timeout)

### Deliverables
- `phone/wakeword.sh` — detector daemon (PID tracking, auto-restart)
- `phone/wakeword-config.yaml` — sensitivity, timeout, audio thresholds
- Integration: auto-start on boot via Termux:Boot or systemd-user equivalent
- Test: manual trigger "hey jarvis" → jarvis.sh runs
- Docs: `README.md` section "Voice Loop Setup"

### Files to Create/Modify
- [ ] `phone/wakeword.sh` — core detector
- [ ] `phone/wakeword-config.yaml` — tuning
- [ ] `phone/install.sh` — add wakeword daemon install + cron setup
- [ ] `README.md` — voice section

### Dependencies
- espeak (pkg install espeak)
- termux-microphone-recording (termux-api extended, or fallback to termux-speech-to-text)

---

## Feature 2: Secrets Hardening (Android Keystore)

### Design
- Replace plaintext ~/.jarvis/.env with Android Keystore
- Biometric unlock (fingerprint) for sensitive ops
- Fallback to plaintext if Keystore unavailable (graceful degradation)
- Wrapper script: `keystore-get.sh` fetches secrets with biometric prompt
- jarvis.sh + digest.sh + ha-call.sh source from keystore instead of .env

### Deliverables
- `phone/keystore-get.sh` — fetch secrets from Keystore with biometric
- `phone/keystore-set.sh` — store secrets in Keystore (one-time setup)
- `phone/keystore-fallback.sh` — fallback to ~/.jarvis/.env if Keystore unavailable
- Integration: jarvis.sh/digest.sh/ha-call.sh updated to use keystore-get.sh
- Docs: "Secrets Management" section in README.md
- Test: manual keystore-set.sh, then verify keystore-get.sh with biometric

### Files to Create/Modify
- [ ] `phone/keystore-get.sh` — fetch with biometric
- [ ] `phone/keystore-set.sh` — store (one-time)
- [ ] `phone/keystore-fallback.sh` — graceful fallback
- [ ] `phone/jarvis.sh` — use keystore-get for secrets
- [ ] `phone/digest.sh` — use keystore-get for secrets
- [ ] `phone/ha-call.sh` — use keystore-get for secrets
- [ ] `phone/install.sh` — add Keystore setup prompt
- [ ] `README.md` — secrets management docs

### Dependencies
- Java/Android SDK (apt-get install default-jdk or termux equivalent)
- Android Keystore API (native, no extra install needed)

---

## Feature 3: Offline Fallback (Local Ollama Haiku)

### Design
- Run Ollama on device for offline classification
- Haiku model (lightweight, ~8GB)
- jarvis.sh detects network state; uses local Ollama if offline
- Fallback to cloud Claude if Ollama unavailable or online
- Config: `OLLAMA_ENDPOINT=http://localhost:11434` (default)

### Deliverables
- `phone/ollama-setup.sh` — install Ollama + pull haiku model (one-time, ~30 min)
- `phone/ollama-classifier.sh` — local classifier wrapper (compatible with claude -p --model haiku)
- `phone/network-check.sh` — detect online/offline state
- Integration: jarvis.sh updated to detect network + use ollama-classifier.sh if offline
- Docs: "Offline Mode" section in README.md
- Test: run offline, classify note → should use local Ollama

### Files to Create/Modify
- [ ] `phone/ollama-setup.sh` — install + model download
- [ ] `phone/ollama-classifier.sh` — local classifier
- [ ] `phone/network-check.sh` — online/offline detection
- [ ] `phone/jarvis.sh` — conditional offline routing
- [ ] `phone/README.md` — offline docs

### Dependencies
- Ollama (download + install for Termux/Android)
- ~8GB free storage for Haiku model

---

## Feature 4: Vault Backup Beyond GitHub

### Design
- GitHub as primary (fast, reliable)
- Secondary backup: Nextcloud OR rsync to NAS
- Encrypted backup (optional GPG)
- Cron job: daily backup at 2 AM (off-peak)
- Fallback: if Nextcloud unavailable, rsync continues

### Deliverables
- `phone/backup-config.yaml` — target (Nextcloud URL or NAS IP), auth
- `phone/backup.sh` — sync vault to secondary, with error handling
- Integration: cron entry in install.sh (daily 2 AM)
- Docs: "Backup Setup" section in README.md
- Test: manual backup.sh → verify files on Nextcloud/NAS

### Files to Create/Modify
- [ ] `phone/backup-config.yaml` — user-editable config
- [ ] `phone/backup.sh` — core backup script
- [ ] `phone/install.sh` — cron + config setup
- [ ] `README.md` — backup docs

### Dependencies
- Nextcloud instance (user-provided) OR NAS with rsync
- curl (already installed)
- rsync (pkg install rsync)

---

## Feature 5: HA Assist Evaluation

### Design
- Research HA's native voice assistant (Home Assistant voice)
- Document integration path: HA voice → intent recognition → jarvis.sh routing
- Design decision: keep phone JARVIS as independent; offer HA Assist as optional parallel
- Fallback: if HA Assist unavailable, use phone JARVIS
- Future: merge if HA Assist matures

### Deliverables
- `docs/HA_ASSIST_V2.md` — research + integration options
- `phone/ha-assist-integration.sh` — optional bridge (receives intents from HA, routes to jarvis.sh)
- Test: verify HA Assist can trigger actions (manual test only; HA Assist not bundled)
- Docs: "HA Assist as Complement" section in README.md

### Files to Create/Modify
- [ ] `docs/HA_ASSIST_V2.md` — research document
- [ ] `phone/ha-assist-integration.sh` — optional bridge
- [ ] `README.md` — HA Assist section

### Dependencies
- None (HA Assist is user's choice to deploy on their HA hub)

---

## Implementation Order

### Phase 1: Foundation (Secrets + Offline)
1. **Secrets Hardening** (Feature 2)
   - Reason: Blocks jarvis.sh, digest.sh, ha-call.sh updates
   - Effort: Medium (Keystore API learning curve)
   - Risk: Graceful fallback to plaintext if Keystore fails

2. **Offline Fallback** (Feature 3)
   - Reason: Needs network detection in jarvis.sh
   - Effort: High (Ollama download + setup, resource-intensive)
   - Risk: Device performance (8GB model)

### Phase 2: Convenience (Wake Word + Backup)
3. **Wake Word Detection** (Feature 1)
   - Reason: User-facing; independent of secrets/offline
   - Effort: Medium (espeak + audio loop tuning)
   - Risk: Battery drain (mitigated by sound threshold)

4. **Vault Backup** (Feature 4)
   - Reason: Infrastructure; independent of other features
   - Effort: Low (rsync/curl wrapper)
   - Risk: Network timeouts (graceful retry)

### Phase 3: Future (HA Integration)
5. **HA Assist Evaluation** (Feature 5)
   - Reason: Research-phase; no code block yet
   - Effort: Low (research + optional bridge)
   - Risk: External dependency (HA roadmap)

---

## Deployment Checklist

- [ ] Phase 1: Secrets + Offline
  - [ ] keystore-get.sh, keystore-set.sh, fallback working
  - [ ] ollama-setup.sh runs; haiku model downloads
  - [ ] network-check.sh detects online/offline
  - [ ] jarvis.sh routes to ollama-classifier.sh when offline
  
- [ ] Phase 2: Wake Word + Backup
  - [ ] wakeword.sh daemon starts; "hey jarvis" triggers capture
  - [ ] backup.sh syncs vault to Nextcloud/NAS
  - [ ] Cron entries added (wakeword daemon + backup)
  
- [ ] Phase 3: HA Assist
  - [ ] Research doc written
  - [ ] ha-assist-integration.sh documented
  - [ ] User can optionally deploy on HA hub

---

## Testing Strategy

Each feature has a manual test (user-verifiable):
1. **Secrets:** `keystore-set.sh` → biometric unlock → secret retrieved
2. **Offline:** Disable WiFi → `jarvis.sh "test note"` → uses Ollama classifier
3. **Wake Word:** `wakeword.sh` running → say "hey jarvis" → captures triggered
4. **Backup:** `backup.sh` → files appear on Nextcloud/NAS
5. **HA Assist:** (Research only; no test until HA Assist matures)

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Keystore unavailable | Secrets exposed as plaintext | Fallback script; graceful degrade |
| Ollama model too large | Device runs out of storage | Clear cache, warn user upfront |
| Wake word false positives | Battery drain | Configurable sensitivity + sound threshold |
| Backup network timeout | Vault not synced | Retry with exponential backoff; log errors |
| HA Assist breaking change | Integration outdated | Keep as optional; document fallback |

---

## Deliverable Summary

**Total files to create:** 12
**Total files to modify:** 8
**Total docs to write:** 4
**Estimated effort:** 20–30 hours
**Target:** Merge all v2 to `master` by 2026-07-15

---

## Next Action

Approve this plan, then I'll begin Phase 1 (Secrets + Offline).
