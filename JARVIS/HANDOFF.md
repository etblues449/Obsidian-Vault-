# JARVIS — HANDOFF

**Last updated:** 2026-08-23 (late session)
**Purpose:** Start a fresh chat with zero context loss. Read this top-to-bottom first.
**Supersedes:** every earlier HANDOFF section below this line and the 2026-07-23 content in `JARVIS/HANDOFF.md`.

---

## 0. Read this first

1. **Claude can read AND write the vault directly.** Vault MCP connector (`https://vault-mcp-six.vercel.app/mcp`), connected as "Vault". Tools: `vault_list`, `vault_read`, `vault_search`, `vault_append`, `vault_write`. **Start every session by reading the vault yourself.** Writes are real commits to `master`, synced to the phone via obsidian-git.
2. **`~/jarvis-core` is a git repo** → private GitHub `etblues449/jarvis-core`, branch `main`. `git push` from the phone, `git pull` anywhere.
3. **After ANY code change to jarvis-core, restart the app:** `pkill -f jarvis-app.mjs; nohup node jarvis-app.mjs > logs/app.log 2>&1 &`. A stale process silently serving old code is the #1 footgun.
4. **On the phone, write documentation files with `cat` + a quoted heredoc, not `node -e`.** Two attempts to edit `AGENT.md` via Node were mangled by shell quoting and **silently committed nothing** while still pushing a commit. Always verify a doc edit with `grep -c` and `wc -l` afterwards — a commit landing is not proof the file changed.
5. **Every installer must cache-bust its fetches and assert on file content, not just SHA.** A stale `raw.githubusercontent` edge once served a matching old installer + old payload that passed SHA verification and installed a known-broken patcher. SHA proves integrity, not freshness.

---

## 1. What JARVIS is

A fully autonomous, voice-first personal assistant running **entirely on a Samsung Galaxy Z Fold 7** via Termux. Hard constraints, locked, do not relitigate:
- **£0/month** ongoing cost
- **Phone-only** — no PC in the loop
- **Single write path** — obsidian-git on `master`; competing writers corrupted the vault before
- **Permanent solves, not workarounds** — "holy shit, that's done"
- **One step at a time** — deliver one step, confirm, then move
- **Honest** — never claims an action it didn't take

**The six-tab `jarvis-app.mjs` on :8737 is THE daily app.** Locked decision (2026-08-22). A "v2" reactor-orb redesign was built, shown to Jelly Bean, and rejected — its code is dormant at `jarvis-core/jarvis2/`. All improvements happen on the six-tab app.

---

## 2. Current state — ALL VERIFIED ON DEVICE, 2026-08-23

The North-Star roadmap (durable honest memory, non-drifting personality, honest self-knowledge,
crash-safe propose→approve→commit, all in the six-tab app) is **complete**. Every phase below was
proven running on the Fold, not merely written.

| Phase | What | File | Proof |
|---|---|---|---|
| 0 | Honest self-knowledge — 14 tools from the live registry, injected into every prompt | `self-knowledge.mjs` | `node self-knowledge.mjs --check` → OK |
| 1 | Hardline blocklist — refuses catastrophic acts EVEN IF CONFIRMED (20 patterns) | `lib/hardline.mjs` | `rm -rf /` refused with confirm=yes; `Get-Date` still ran |
| 1 | Widened injection scanner (19 patterns) | `lib/rails.mjs` | 31/31 regression suite |
| 2 | ONE persona shared by all four entry points (text/app/voice/heartbeat) | `lib/persona.mjs` | 1 distinct honesty block, 1 personality across all 4 |
| 3 | Durable memory — atomic write + `.bak` + read-back verification | `lib/memory.mjs` | real round-trip proven; crash-kill test 6/6 file valid |
| 4 | Durable action ledger — proposed→approved→started→ran, all on disk | `lib/ledger.mjs` + `lib/agent.mjs` (7 wiring points) | real declined tool → trail `proposed > declined`; orphaned approvals surfaced, NEVER auto-replayed |
| 5 | Capture — JARVIS writes notes straight into the vault, no Tasker/n8n | `tools/capture.mjs` | note written → GitHub Actions router success |

**Tool count: 14**, not 7 (an earlier `AGENT.md` said 7 — fixed, see §6). List:
`capture, database, forget, ha_control, ha_list, ha_state, pc_control, remember, set_alarm, set_timer, update_memory, vault_list, vault_read, vault_search`

**Tools UI badge:** `/api/tools` returns `{tools, total, hidden}` — the badge shows the true total (14); 3 `vault_*` tools stay hidden from the grid (reachable from chat) but are no longer hidden from the count.

---

## 3. THE BIG FINDING — obsidian-git deleted the entire Actions engine (root-caused & fixed)

Captures had been dead since 2026-07-09; briefings stopped 2026-08-04. Root cause found 2026-08-23:

**`.github/workflows/` did not exist on `origin/master` at all.** Commit `4bdb3bf1` (2026-08-06, "Sync from Obsidian") deleted all six workflow files. Two earlier occurrences: `7f9097d9` (07-04) and `9fd5e00e` (07-14). **Obsidian does not index dotfolders**, so `.github/` is invisible to it; obsidian-git's `git add -A` from the vault root stages invisible files as deletions. This also explains the old "8 files deleted by an unidentified client" mystery (2026-08-02) — same mechanism, no mystery client.

**Fixed:**
- All six workflows restored from `a38848c9` (last good commit before the deletion).
- **Pre-commit hook installed** at `~/Obsidian-Vault-/.git/hooks/pre-commit` — refuses any commit that stages a deletion under `.github/`. Hooks are local + untracked, so obsidian-git cannot remove it. **Proven live** — a real deletion was staged and the commit was refused.
- **If obsidian-git ever fails to commit, that is the hook working.** Read the message before `git commit --no-verify`.

Capture Router fired successfully post-fix: `2026-08-23T03:01:49Z`. **Scheduled skills (morning brief etc.) are restored but NOT yet proven to fire on schedule** — only the push-triggered router is proven. Check the first briefing after this date lands before trusting the cron path again.

---

## 4. Capture — n8n retired

`tools/capture.mjs` writes notes directly to `JARVIS/Inbox/` (atomic write + read-back verify, refuses placeholder junk like "your note here" at source). obsidian-git syncs it, the restored Actions router files it. **The paid n8n.cloud webhook is no longer on the capture path.** C1 (£0) has no live exception here. n8n.cloud account itself is unused but not yet formally cancelled (pure housekeeping, low priority).

---

## 5. Hub config backup — DONE (2026-08-23)

Was the single biggest resilience risk (P0, ranked since 2026-08-01): automations/scenes/scripts/YAML existed only on the HA Green.

**Two-part backup, both complete:**
1. **UI-managed via config API** — `Assistant Core/ha-diagnostics/ha-export.mjs`, re-runnable. Exported 11/11 automations + 5/5 scenes (0 scripts exist) to `Claude Memory/Projects/Smart Home/ha-config/` as real YAML + `snapshot.json`. Verified restorable — PyYAML parses them back correctly, including the classic traps (`": "` needing quotes, `to: 'on'` staying a string not boolean, `-00:15:00` staying a string not sexagesimal).
2. **YAML-managed files via Samba** — HA's Samba add-on (port 445, credentials in HA → Settings → Add-ons → Samba share) pulled into `ha-config/hub/`: `configuration.yaml`, `automations.yaml`, `scenes.yaml`, `scripts.yaml`, `go2rtc.yaml`, `govee_learning.yaml`, `sentences.yaml`, Frigate's `config.yaml`, and **10 ESPHome node configs** in `ha-config/hub/esphome/` — including `ai_cam.yaml` (the flashed config with tuning entities, previously never captured) and `landing.yaml`.

**`secrets.yaml` was deliberately excluded** (both the HA one and the ESPHome one that came down accidentally via `mget *.yaml`) — deleted immediately and gitignored. Never let a wildcard pull sweep up a secrets file again.

**Correction to old vault notes:** `bedroom-2.yaml` does not exist — bedroom config lives in ESPHome (`esphome/bedroom.yaml`). Frigate runs from `addon_configs/ccab4aaf_frigate-fa/`, with a `-fa-beta` variant alongside holding its own 1.8MB `frigate.db`. Automation count corrected to **11** (not 8, not "~19" from older notes); 5 scenes, 0 scripts, 709 entities on the live registry.

**Still open:** a scheduled full-instance HA backup off-hub (Nabu Casa cloud backup or similar) — the exporter covers config, not the whole instance.

---

## 6. Docs corrected

- **`~/jarvis-core/AGENT.md`** claimed 7 tools and described Tiers 3-6 as future work — both false; all six tiers shipped in July, 14 tools register. Superseding header prepended 2026-08-23 (commit `d05c7a7`), historical build plan kept below it. Nothing reads this file at runtime.
- **`JARVIS/HANDOFF.md`** (vault) — the pre-2026-08-23 file was a month stale; a superseding section was appended, now folded into this document.

---

## 7. Housekeeping done this session

- **547M `~/jarvis` sprawl archived** (not deleted) to `~/_archive_jarvis_20260823-044851/` — v1 phone scripts, `gstack`, `openclaude`, a second vault clone. Four dead home-screen shortcuts that pointed into it (`JARVIS-new`, `digest.sh`, `jarvis.sh`, `sync.sh`) archived alongside. Survivors: `JARVIS` symlink and `JARVIS.sh`, both verified working.
- **Claude Code on Termux fixed** — a global reinstall pulled 2.1.240 with a blocked postinstall (`MODULE_NOT_FOUND: cli.js`). Reinstalled the known-good pin `2.1.112` with `--allow-scripts`. Re-armed both auto-update locks: `DISABLE_AUTOUPDATER=1` in `.bashrc` and `autoUpdates: false` in `~/.claude/settings.json` — every release ≥2.1.113 pulls a 233MB glibc binary that Android kills mid-download.
- **Carousel `JARVIS_API_TOKEN` rotation — attempted, not completed.** The gate is live and fail-closed (no token → 401), but the exposed token still returns 200 (the env-var change + redeploy didn't take). **User decision: leave it. Do not re-raise.**

---

## 8. Standing delivery rules (apply to every future installer / doc edit)

1. Ship source as plain `.mjs`/`.md` in the vault, never hand-transcribed base64 — a corrupted blob was caught by a SHA gate once; plain text round-trips exactly and is diffable.
2. Cache-bust every fetch AND assert on file content — SHA proves integrity, not freshness.
3. When a corrected file must ship immediately, change the filename — cache-busting alone did not defeat a sticky CDN edge; a fresh path cannot be stale.
4. Patcher anchors must be regex and whitespace-insensitive, and the installer must verify every anchor exists exactly once *before* modifying anything.
5. Test against a throwaway copy, never the user's real vault/memory/hub — record real counts before and after, roll back on mismatch.
6. On the phone, write documentation with `cat` + quoted heredoc, not `node -e` — verify with `grep -c`/`wc -l` after, because a commit landing is not proof the file changed.

---

## 9. Open items, priority order

- [ ] **Watch the first scheduled briefing land** (cron `0 6 * * *` / `0 7 * * *`) — proves the restored skill engine fires on schedule, not just on push. Check Actions if none appears by the morning after this date.
- [ ] **Enable a scheduled full HA backup off-hub** (Nabu Casa cloud backup, or continue via Samba) — config is backed up; the whole instance is not.
- [ ] **Re-run `ha-export.mjs`** after any future automation/scene change; commit the diff.
- [ ] **Delete `~/_archive_jarvis_*`** once satisfied nothing depends on it (547M reclaim; `/data` was at 90%). No rush — it's a `mv` away from restoring either way.
- [ ] **Re-enable microWakeWord on ai_cam** — OOMs the HA Green's compiler; Option B (off-box compile on the PC) is the documented fix, not yet run. Now that `ai_cam.yaml` is vault-backed, pull the LIVE config first before touching it.
- [ ] **Flash board #2** (`landing_ai_cam_2`) — config validated, not yet flashed via USB.
- [ ] Confirm n8n.cloud account state and formally cancel (housekeeping only — nothing depends on it).
- [ ] `webapp-reviewer` model decision (sonnet vs opus) — old harness-audit item, still open.
- [ ] Big Pad (24" lounge screen) integration — scoped in a prior session, never built.

---

## 10. Quick reference

```
Vault repo         : etblues449/Obsidian-Vault-, branch master (trailing hyphen intentional)
Vault MCP           : https://vault-mcp-six.vercel.app/mcp
jarvis-core repo     : etblues449/jarvis-core (private), branch main
Daily app           : http://localhost:8737 (jarvis-app.mjs)
HA hub              : 192.168.0.200:8123 (REST API + admin token in .env)
HA Samba            : 192.168.0.200:445, user JellyBean1875, config/backup/share/addon_configs
Restart app         : pkill -f jarvis-app.mjs; nohup node jarvis-app.mjs > logs/app.log 2>&1 &
Ledger CLI          : node jarvis-ledger.mjs [open|recent N|expire N|compact]
Self-knowledge      : node self-knowledge.mjs [--check]
Safe mode toggle    : node jarvis-rails.mjs safe on|off
Base64 decode (Android): tr -d '\r' < f.b64 | base64 -di > f.tar.gz
```

**First thing to tell a fresh session:** everything above is current as of 2026-08-23. Read `Claude Memory/Projects/Smart Home/_index.md` and the 2026-08-23 session file for full narrative detail on any item.



---

## 11. SUPERSEDING — 2026-09-04

> Sections 1–10 above remain accurate as written. This section adds a hardware
> change that affects how §1 and §10 should be read, and records one code change.

### ⚠️ The Fold 7 is lost and offline

§1 says JARVIS runs *"entirely on a Samsung Galaxy Z Fold 7."* **That device is
gone** — lost, not reachable, not on the network. A replacement has been ordered
and is not yet in hand.

Consequences for a fresh session:

- **Nothing in §10's Quick Reference is reachable right now.** `localhost:8737`,
  the HA hub, the ledger CLI, `self-knowledge --check` — all assume the Fold.
- **The "on-device proof" standard cannot be met** until the replacement arrives.
  Anything claimed as verified between now and then was verified *somewhere else*,
  and must say where.
- **This is exactly why the `origin/main` push mattered.** The 2026-08-23 push
  (`bb97f5d..2834aad`) means P0–P5 survived the device. Had the 17-day gap still
  been open, the loss would have taken hardline, persona, memory, ledger and
  capture with it. Treat pushing as the thing that makes the phone disposable.

**Setting up the replacement:** clone `etblues449/jarvis-core` (branch `main`),
restore `.env` by hand (it is gitignored and holds every secret — it does **not**
come down with the clone), then re-verify each phase on device before trusting any
"complete" marker in §2.

### Working from the S22 — Termux gotchas found 2026-09-04

This session ran on the S22 as a stand-in. Three failures worth keeping, all of
which cost time:

1. **Node was broken:** `CANNOT LINK EXECUTABLE "node": cannot locate symbol
   OSSL_PROVIDER_add_conf_parameter`. `pkg install nodejs` reports "already the
   newest version" and changes nothing — the package is present but its OpenSSL
   linkage is stale. Fix: **`pkg reinstall openssl nodejs`**, answering **N** at
   the `openssl.cnf` config prompt to keep the existing config.
2. **No pager installed.** `git log` dies with `unable to execute pager 'pager'`
   and returns nothing. Fix: `git config --global core.pager cat`.
3. **A fresh clone has no git identity.** `git commit` fails with *"Author
   identity unknown"* — but if anything is chained after it, the error scrolls
   away and it reads as a silent no-op. Two commits were "made" before the real
   error was seen. **Run `git commit` alone and read its output.** Now set
   globally (`Elliot Horton` / `etblues449@users.noreply.github.com`), so the
   replacement Fold inherits it.

### Code shipped — `tools/database.mjs` hardened (`e51cacf`, on `origin/main`)

Correctness fixes to a tool that already worked. Four defects, one of which broke
the honesty rule:

- **Counted `rows.length` under `limit=1000`.** A 1001-row table would have been
  reported as "1000" — a fabricated number stated with confidence. Now uses
  PostgREST `Prefer: count=exact` and reads the total from `Content-Range`; when
  the server declines to count it says so rather than guessing.
- **No write guard existed.** insert/update/delete/drop/truncate/grant/revoke are
  now refused before any network call.
- **No timeout.** Now an 8s `AbortController`; a hang is reported as a timeout.
- **Routing bug:** `'run'` was tested twice in the same condition and `'running'`
  matched it, so *"how many agents are running"* returned execution history.
  Execution words are now whole-word matched. Pinned by a regression test.

**`test/database-test.mjs` — 30 assertions, fully offline** (`fetch` stubbed),
matching the tier suites' stated "no API key, no network, no phone needed"
discipline. **`test/database-live.mjs`** holds the live acceptance and is
deliberately *outside* the offline suite, so the suite cannot fail on connectivity.

**Acceptance proven rather than asserted:** a 4th row was inserted in Supabase and
the tool reported 4 with no code change, through the exact-count path.

### `lib/supabase-ai-agent-creator.mjs` is a stub — previously undocumented

Its handler returns `"Query handler will be connected in Step 6."` and never opens
a connection. It also hand-parses `.env` with `line.split('=')`, bypassing
`lib/env.mjs` and mangling any value containing `=`. **Not fixed** — flagged only.
It is not `tools/database.mjs`; the two are easily confused.

### Doc status — which handoff is real

**This vault file is canonical.** The `HANDOFF.md` in the claude.ai project is a
**2026-07-21 snapshot**, superseded by this document on 2026-08-23. Read as
current it is actively misleading: it calls the `database` tool *"a STUB … the #1
unfinished item"*, which was already untrue when it was written down here and is
doubly untrue now. Roughly half of one session on 2026-09-04 was spent rebuilding
a tool that already worked, because that snapshot was read as current.

Also stale: **`JARVIS_AGENT_SPEC.md`** (project copy) claims tier4 (27 assertions)
and tier5 (34) test suites. Neither file exists on `origin/main` — `ls test/` shows
only `tier1`, `tier2`, `tier6` (plus the two database suites added above). The
"107 offline assertions across all tiers" figure is therefore unsupported.

**Project files cannot be edited from a session and do not sync back.** They should
be treated as historical snapshots, not sources of truth.

### One §9 item now answered

§9's first open item — *"watch the first scheduled briefing land"* — was resolved
by the 2026-09-01 live audit, and the answer was no. Groq decommissioned
`llama-3.3-70b-versatile` on 2026-08-16; all four scheduled skills share
`runner.mjs`, so all four failed every run. See the 2026-09-01 superseding block in
`Claude Memory/Projects/Smart Home/_index.md` for the model swap and the standing
warning that **a green Actions run is not proof a file was written**.

