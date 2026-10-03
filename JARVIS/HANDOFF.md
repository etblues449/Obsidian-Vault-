# JARVIS — HANDOFF

**Last updated:** 2026-10-03
**Purpose:** Start a fresh chat with zero context loss. Read this top-to-bottom first.
**Supersedes:** all prior HANDOFF content and every §11/§12-style superseding block — those are consolidated here. Full narrative history remains in git and in the dated session notes under `Claude Memory/Projects/Smart Home/sessions/`.

---

## 0. Read this first (the footguns that cost whole sessions)

1. **Host device changed.** JARVIS no longer runs on the Fold 7 — **that device is lost** (2026-09-04). The replacement, now the primary host, is a **Samsung Galaxy Z Fold 8 Ultra** (2026-10-01), **bring-up in progress**. Read every "Fold 7" in old notes as "Fold 8 Ultra".
2. **Three write paths, do not cross them.** Vault = `etblues449/Obsidian-Vault-` branch **`master`** (trailing hyphen is real), synced by obsidian-git. Phone app = `etblues449/jarvis-core` branch **`main`** (private). A commit to the wrong branch is how work gets lost. **Single serialized writer to master; never add a second automated committer; never force-push** (`permissions.deny` blocks it). Always `git pull --rebase` first.
3. **obsidian-git silently deletes `.github/` (4× so far).** Obsidian doesn't index dotfolders, so its `git add -A` stages `.github/workflows/*` as deletions and wipes the Actions engine. **Mitigation: a local untracked `.git/hooks/pre-commit` that refuses any commit staging a `.github/` deletion.** It does NOT travel with a clone — **re-install it on every new checkout** (incl. the Fold 8 Ultra). If obsidian-git ever "fails to commit", that's the hook working — read the message before `--no-verify`.
4. **A green Actions run is NOT proof a file was written.** The engine can exit 0 and write nothing (old DST-guard bug) or fail inside the model call. Always confirm the output *file landed* in the vault. ("Documented ≠ Merged ≠ Running" — state which you verified.)
5. **On the phone, edit docs with `cat` + a quoted heredoc, never `node -e`** (shell quoting mangles it and commits nothing while still pushing). Verify every doc edit with `grep -c`/`wc -l`. **Installers must cache-bust fetches AND assert on content** — SHA proves integrity, not freshness.

---

## 1. What JARVIS is

A fully autonomous, voice-first personal assistant running **entirely on the phone** (Fold 8 Ultra, Termux). Hard constraints — locked, do not relitigate:
- **£0/month** ongoing cost (constraint C1)
- **Phone-only** — no PC in the loop
- **Single write path** — obsidian-git on `master`
- **Permanent solves, not workarounds**
- **One step at a time** — deliver one, confirm, then move
- **Honest** — never claims an action it didn't take; never surfaces `sensitive`/`private`/`confidential`/`legal`/`financial` note *contents* into any generated output

**THE daily app is the six-tab `jarvis-app.mjs` on `:8737`.** Locked (2026-08-22). A "v2" reactor-orb redesign was built, shown, and **rejected** — dormant at `jarvis-core/jarvis2/`. All improvements happen on the six-tab app.

---

## 2. Device reality — Fold 8 Ultra bring-up (READ BEFORE TRUSTING ANY "COMPLETE" MARKER)

- **Fold 7: lost/offline** since 2026-09-04. **Fold 8 Ultra: in hand, now the host**, bring-up not yet fully verified.
- **The phone app survived the device loss because it was pushed to `origin/main`** (2026-08-23, `bb97f5d..2834aad`). Treat pushing as the thing that makes the phone disposable.
- **Verification honesty:** the P0–P5 phone-app proofs in §3 were made **on the Fold 7**. Until Fold 8 Ultra bring-up passes, their honest status is **"proven on the previous device; code safe on `origin/main`; NOT re-verified on Fold 8 Ultra."**
- **Bring-up checklist:** `Claude Memory/Projects/Smart Home/sessions/2026-10-01.md` (10 ordered steps). Two easiest to miss, neither of which travels with a clone:
  1. **Restore `~/jarvis-core/.env` by hand** (gitignored; holds every secret).
  2. **Re-install the vault `.git/hooks/pre-commit` `.github/` guard** (see §0.3).
- **Termux gotchas on a fresh Samsung** (found on the S22 stand-in, apply to the Fold 8 Ultra):
  - Broken node (`OSSL_PROVIDER_add_conf_parameter`) → `pkg reinstall openssl nodejs` (answer **N** to the `openssl.cnf` prompt).
  - No pager → `git config --global core.pager cat`.
  - Fresh clone has no git identity → set it, and **run `git commit` alone** and read its output (a chained error scrolls away as a silent no-op). Now set globally to `Elliot Horton` / `etblues449@users.noreply.github.com`.
- **HA side:** re-pair the companion app as the new device; check automations/notify targets still pointing at the Fold 7's `mobile_app_*` entity.

---

## 3. Current state by layer (honest Documented / Merged / Running)

### Phone app — `jarvis-core` (North-Star complete, code on `origin/main`)
14 tools register (`capture, database, forget, ha_control, ha_list, ha_state, pc_control, remember, set_alarm, set_timer, update_memory, vault_list, vault_read, vault_search`). `/api/tools` returns the true total (14); 3 `vault_*` are chat-only, hidden from the grid not the count.

| Phase | What | File | Status |
|---|---|---|---|
| 0 | Honest self-knowledge (live registry → every prompt) | `self-knowledge.mjs` | Proven on Fold 7; on `main` |
| 1 | Hardline blocklist (refuses catastrophic acts even if confirmed) + injection scanner | `lib/hardline.mjs`, `lib/rails.mjs` | Proven on Fold 7; on `main` |
| 2 | One persona across text/app/voice/heartbeat | `lib/persona.mjs` | Proven on Fold 7; on `main` |
| 3 | Durable memory (atomic write + `.bak` + read-back) | `lib/memory.mjs` | Proven on Fold 7; on `main` |
| 4 | Durable action ledger (proposed→approved→started→ran) | `lib/ledger.mjs`, `lib/agent.mjs` | Proven on Fold 7; on `main` |
| 5 | Capture straight to vault (no Tasker/n8n) | `tools/capture.mjs` | Proven on Fold 7; on `main` |

- **`tools/database.mjs` hardened** (`e51cacf`, `origin/main`): exact-count via PostgREST `Content-Range` (no more fabricated "1000"); write-guard; 8s timeout; `run`/`running` routing bug fixed. 30 offline assertions (`test/database-test.mjs`); live acceptance separate (`test/database-live.mjs`).
- **`lib/supabase-ai-agent-creator.mjs` is a STUB** (returns "connected in Step 6"; hand-parses `.env` and mangles `=` values). Flagged, **not fixed**. Not the same file as `tools/database.mjs` — easily confused.

### Scheduled skill engine — ✅ RUNNING (verified 2026-10-03, first output in ~2 months)
`Assistant Core/jarvis-skills/runner.mjs` → GitHub Actions + Groq, commits to master via rebase-retry.
- **Was dark 2026-08-16 → 2026-10-03.** Groq decommissioned `llama-3.3-70b-versatile` (2026-08-16); the 09-04 fix only reached the phone app's `brain.mjs`, leaving the *engine* on the dead model → 25/25 runs failed silently.
- **Fixed (PR #87, merged 2026-10-03):** default is now **`openai/gpt-oss-120b`**, with a **`DEAD_MODELS` guard** (fast-fail instead of silent no-op), no-retry on 4xx, and reasoning-model handling. **33/33 offline tests** (`test/local-test.mjs`), `node --check` clean.
- **Verified Running:** a manual Morning Brief run on the fixed code **succeeded** and wrote `Claude Memory/briefings/2026-10-03.md` (commit `6ed030f`), grounded in real captures, on gpt-oss-120b.
- **Caveat:** only **Morning Brief** is proven end-to-end. Connection Finder (Sun 2pm), Weekly Synthesis (Fri 6pm), Pattern Detector (Mon 8am) share the same runner+fix — they'll prove themselves on their next cadence (or trigger them to confirm now).

### Capture — n8n retired
`tools/capture.mjs` writes atomically to `JARVIS/Inbox/` (refuses placeholder junk at source); the `on: push` Actions router files it. **No paid n8n on the capture path** — C1 clean. (n8n.cloud account unused, not yet formally cancelled — housekeeping.)

### HA / voice layer (per vault records; not re-verified this session)
- **Hub config backup DONE (2026-08-23):** `Assistant Core/ha-diagnostics/ha-export.mjs` (config-API, re-runnable) + Samba pull into `Claude Memory/Projects/Smart Home/ha-config/` — 11 automations, 5 scenes, 0 scripts, 709 entities; 10 ESPHome node configs incl. the flashed `ai_cam.yaml`. `secrets.yaml` deliberately excluded. **Still open:** off-hub full-instance backup.
- **AI Cam** (Waveshare ESP32-S3-CAM-OV3660, `192.168.0.199`): camera + speaker + ES7210 mics + Frigate complete; **microWakeWord regressed** (OOMs the HA Green compiler) — Option B off-box compile is the fix, not yet run. **Board #2 (`landing_ai_cam_2`)** config validated, not yet flashed (USB first-flash).
- Canonical TV entity = `media_player.jelly_beans_tv_3`. Hub = `192.168.0.200:8123`.

### Vault integrity — CLEAN (audited 2026-10-03)
`drift-check.sh`: **0 S1, 0 S2** (all session-start files, runner inputs, workflows, engine files present). `verify-refs.py`: the lone S1 was the **deliberate `android-development/README.md` placeholder** — the checker was scoped to `SKILL.md` on 2026-10-03 (CLAUDE.md change log), so that false-positive is retired. The two `[[hardware/ai_cam]]`/`[[hardware/landing_ai_cam_2]]` wikilinks (targets exist as `.yaml`) were fixed.

---

## 4. This session (2026-10-03) — what was done

1. **Full vault-integrity audit** at `4cb9411`→ verified clean on critical axes; the one live S1 was the engine model.
2. **Verified the skill-engine fix end-to-end** (not just merged): confirmed the dead-model root cause from logs, confirmed `GROQ_API_KEY` is set (the 404 was model-not-found, not auth), triggered a run on the fixed code, and **confirmed `briefings/2026-10-03.md` actually landed** → engine flipped Merged → **Running**.
3. **Phone-UI-control research saved** at `JARVIS/research/2026-07-23-phone-ui-control.md` (survived to master): how to give JARVIS **full UI control of the phone via Shizuku/ADB (no root, no PC)** — `uiautomator dump` + `input` vs a minimal AccessibilityService; `rish` in Termux; Tasker/AutoInput; the confused-deputy/prompt-injection threat model; **plus** a best-in-class survey (DroidRun, AutoDroid, AppAgent v2, MobileGPT, Mobile-Agent-v2) with a "steal-these-first" list (a11y-tree-first perception → semantic selectors → verify-after-action → cached recipes → confirm-gates). **Research only — not built.** Directly applicable to the Fold 8 Ultra agentic layer.

---

## 5. Hard-won learnings (don't rediscover these)

- **obsidian-git wipes `.github/` dotfolders** → pre-commit hook guard, re-installed per clone (§0.3).
- **Green Actions run ≠ file written** (§0.4). Confirm the output file.
- **Groq retires models with little notice** — `llama-3.3-70b-versatile` (2026-08-16), `llama-3.1-8b-instant` same day. Keep a `DEAD_MODELS` guard; current free-tier model is `openai/gpt-oss-120b`. A checker that hardcodes "the current model" goes stale as fast as a doc (the `jarvis-doctor` trap).
- **On-device doc edits:** `cat` + quoted heredoc, verify with `grep -c`/`wc -l`; never `node -e`.
- **Installers:** cache-bust + assert on content; change the *filename* when a corrected file must ship past a sticky CDN; test against a throwaway copy, record counts before/after.
- **Termux on new Samsung:** `pkg reinstall openssl nodejs`; `core.pager cat`; set git identity and run `git commit` alone.
- **PostgREST anon role can't `count()`** → use `Prefer: count=exact` + `Content-Range`, never `rows.length` under a limit.
- **Project-file snapshots on claude.ai are NOT sources of truth** — they don't sync back and have caused half-session rebuilds of working tools (`database` "stub", phantom tier4/5 suites). The **vault is canonical**.

---

## 6. Open items — priority order

- [ ] **Fold 8 Ultra bring-up** — run `sessions/2026-10-01.md` 10 steps; restore `.env`; re-install the `.github/` pre-commit hook; re-verify P0–P5 on device.
- [ ] **Prove the other 3 scheduled skills** (Connection Finder / Weekly Synthesis / Pattern Detector) land files — or trigger them once to confirm now that the model is fixed.
- [ ] **Off-hub full-instance HA backup** (Nabu Casa cloud backup) — config is backed up; the whole instance is not.
- [ ] **Re-enable microWakeWord on ai_cam** — pull the LIVE `ai_cam.yaml` first, then off-box compile (OOMs the HA Green).
- [ ] **Flash board #2** (`landing_ai_cam_2`) via USB — config validated, not flashed.
- [ ] **(Decision) Build the phone-UI-control layer** on the Fold 8 Ultra from the §4 research (Shizuku + `ui_control` tool) — research done, not started.
- [ ] **Verify Vault MCP auth** (`vault-mcp-six.vercel.app/mcp`) — flagged earlier as possibly unauthenticated (read+write to a vault holding legal/financial notes). Confirm the bearer-token gate is actually enforced; lock down if not.
- [ ] Fix `lib/supabase-ai-agent-creator.mjs` stub (or delete if unused).
- [ ] Formally cancel the unused n8n.cloud account (housekeeping).
- [ ] `webapp-reviewer` model decision (sonnet vs opus) — long-standing harness item.

---

## 7. Quick reference

```
Vault repo     : etblues449/Obsidian-Vault-  branch master  (trailing hyphen intentional)
Phone app repo : etblues449/jarvis-core      branch main    (PRIVATE)
Vault MCP      : https://vault-mcp-six.vercel.app/mcp  (connected in Claude as "Vault")
Daily app      : http://localhost:8737  (jarvis-app.mjs, six-tab)   [host: Fold 8 Ultra]
Skill engine   : Assistant Core/jarvis-skills/runner.mjs  — Groq openai/gpt-oss-120b (free tier)
HA hub         : 192.168.0.200:8123 (REST + admin token in jarvis-core/.env)
HA Samba       : 192.168.0.200:445  (config/backup/share/addon_configs)
TV entity      : media_player.jelly_beans_tv_3  (canonical)
Restart app    : pkill -f jarvis-app.mjs; nohup node jarvis-app.mjs > logs/app.log 2>&1 &
Health check   : bash .claude/skills/vault-integrity-audit/scripts/drift-check.sh .
                 python3 .claude/skills/qa-boundary-check/scripts/verify-refs.py .
Secrets        : jarvis-core/.env — gitignored, restore by hand on a new device. Reference secrets by name, never write them into a note.
```

---

## 8. Session protocol

- **Start:** read the mandatory session-start files (`Claude Memory/MEMORY.md`, `Profile/user_profile.md`, the 5 project `_index.md`, `Account/capture_queue.md`) — report any as MISSING, never synthesise. Read the vault yourself; don't ask the user to paste context.
- **One layer → that layer's skill** (`capture-pipeline`, `skill-engine-ops`, `jarvis-core-dev`, `vault-integrity-audit`, `voice-satellite-ops`). **Two+ layers → `jarvis-orchestrator`.** Verify boundaries with `qa-boundary-check` before any commit.
- **End (on "done"/"wrap up"):** update the project `_index.md`; write `sessions/YYYY-MM-DD.md`; tick `capture_queue.md`; present all changed files for review/commit.
- **Style:** terse; one step at a time; screenshots to show state; never claim an action you didn't take; say which of Documented/Merged/Running you actually observed.
