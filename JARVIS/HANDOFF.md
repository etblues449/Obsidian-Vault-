# JARVIS — HANDOFF

**Last updated:** 2026-07-23 (early hours)
**Purpose:** Start a fresh chat with zero context loss. Read this top-to-bottom first.

---

## 0. Read this first

1. **Claude can now read AND write the vault directly.** A Vault MCP connector is live (`https://vault-mcp-six.vercel.app/mcp`, connected in Claude as "Vault"). Tools: `vault_list`, `vault_read`, `vault_search`, `vault_append`, `vault_write`. **Start every session by reading the vault yourself — don't ask the user to paste context.** Writes are real commits to `master`, which obsidian-git syncs to the phone.
2. **`~/jarvis-core` is now a git repo** → private GitHub `etblues449/jarvis-core`, branch `main`. `git push` from the phone, `git pull` anywhere. The old cloud⇄phone drift problem is solved — **stop hand-shipping tar.gz for code**.
3. **After ANY code change, restart the server** — `bash ~/.jarvis/restart.sh`. The wake listener only starts the server *if it's down*; it never restarts a running one. A stale process silently serving old code caused a full debugging detour (the "frozen clock" bug). This is the #1 footgun.

---

## 1. What JARVIS is

A fully autonomous, voice-first personal assistant running **entirely on a Samsung Galaxy Z Fold 7** via Termux. Hard constraints:
- **£0/month** ongoing cost
- **Phone-only** (no PC in the loop) — locked, do not relitigate
- **Single write path** — obsidian-git on `master`; competing write paths corrupted the vault before
- **Permanent solves, not workarounds** — the standard is "holy shit, that's done"
- **One step at a time** — deliver one step, confirm, then move. Hard preference.
- **Honest** — never claims an action it didn't take

---

## 2. Current state — ALL WORKING

| Area | State |
|---|---|
| Core agent loop (`runTurn`) | ✅ Shared by all interfaces |
| Voice terminal (`jarvis-voice.mjs`) | ✅ Streaming TTS, latency readout |
| Web app (`jarvis-app.mjs` + `web/index.html`) | ✅ Neon command center at `localhost:8737` |
| 13 tools (HA, PC, alarms, timers, memory, vault, database) | ✅ Load at boot |
| Supabase `database` tool | ✅ **LIVE** via PostgREST (stub retired) |
| Hands-free auto-reply (web) | ✅ Mic re-arms until sign-off |
| One-tap launcher | ✅ Home-screen widget |
| **Always-on wake word** | ✅ **"JARVIS <command>" → wakes, executes, speaks** |
| Vault MCP (Claude ⇄ vault) | ✅ Live, read+write |
| `jarvis-core` → GitHub | ✅ Private repo, `main` |
| Tests for `database` tool | ❌ None — open item |
| Boot persistence | ❌ Needs Termux:Boot |

---

## 3. Key commands

```bash
# Wake word (always-on voice)
bash ~/.jarvis/wake-start.sh      # start listening in background
bash ~/.jarvis/wake-status.sh     # is it alive? + last 5 things heard
bash ~/.jarvis/wake-stop.sh       # stop

# Server
bash ~/.jarvis/restart.sh         # ALWAYS use after code changes
bash ~/.shortcuts/JARVIS          # launcher (starts server + opens app)

# Sync
cd ~/jarvis-core && git push

# Logs
tail -20 ~/.jarvis/wake.log       # everything heard + wake triggers + replies
tail -20 ~/jarvis-core/server.log
```

---

## 4. Architecture

```
lib/agent.mjs      runTurn() — one full turn. Confirmation gate lives HERE.
lib/brain.mjs      Provider seam (Groq ⇄ Anthropic = .env change)
lib/tools.mjs      Tool registry — drop a file in tools/, it auto-loads
lib/signoff.mjs    Zero-token goodbye detector
lib/say-stream.mjs Sentence-level streaming TTS
lib/memory.mjs     Vault fact management
lib/rails.mjs      Safe mode, audit log, cost tally, injection scan
jarvis-app.mjs     Web server (localhost:8737) — systemPrompt() line ~56
web/index.html     Neon command center UI (single file)
tools/*.mjs        One file per capability

~/.jarvis/         wake-listen.sh, wake-start/stop/status.sh, restart.sh, wake.log
~/.shortcuts/JARVIS  one-tap launcher (Termux:Widget)
~/vault-mcp/       the Vault MCP server (deployed to Vercel)
```

**Backend endpoints (all preserved):** `/chat` (SSE: token/tool/silent/confirm/error), `/speak`, `/reset`, `/confirm`, `/api/memory[/add|/forget]`, `/api/rails[/safe]`, `/api/tools`, `/api/vault/note`

---

## 5. Hard-won learnings (don't rediscover these)

- **`termux-speech-to-text` returns EMPTY through command substitution** `$(...)` — exits 0 instantly without listening. **Always capture to a file**, then read the file. Cost hours.
- **Never open `getUserMedia`/AudioContext while `SpeechRecognition` is active on Samsung** — steals audio focus, Android returns a "call ended" state, voice input dies. Only touch Web Audio during TTS playback.
- **Stale server process = phantom bugs.** Kill and restart after every change.
- **PostgREST anon role can't `count()`** → 400. Fetch rows, count in JS.
- **Fine-grained GitHub PATs default Contents to Read-only** → writes 403 with "Resource not accessible by personal access token". Editing the token's permissions keeps the same token string.
- **`onnxruntime` / Vosk have NO installable wheel** for Termux aarch64 + Python 3.14. openWakeWord and Porcupine are therefore off the table. Don't retry this.
- **No `/tmp` on Termux** — use `$HOME`.
- **Large pastes / heredocs corrupt in Termux.** For files, use SHA-256-verified tar.gz. (Now largely moot for code — use git.)
- **Vercel `buildCommand: "npm install"` causes 404**; Deployment Protection causes 302.
- **The Claude web "Add custom connector" dialog does NOT expose request headers** (only OAuth fields) — so the Vault MCP runs without bearer auth. Re-add when the dialog supports it.

---

## 6. Open / next actions

**Immediate candidates:**
1. **`phone_control` tool** — expose what Termux:API can genuinely do: calls, SMS, contacts, launch any app, torch/wifi/volume/brightness, notifications, clipboard, battery, vibrate. **This was agreed as the next build.**
2. **Tasker + AutoInput for in-app automation** — the real route to "use any app" (read screen, tap buttons, type) on a stock unrooted phone. User already owns Tasker. This is the answer to "anything I can do, JARVIS can do."
3. **Boot persistence** — Termux:Boot so the wake listener + server auto-start on reboot.
4. **Tests for the `database` tool** — GET-only guard, empty result, malformed query, connection failure.
5. **Wake-word tuning** — reduce false captures (it currently picks up background chatter).
6. Update `Claude Memory/decisions.md` Decision #3 to record Claude-via-MCP as an approved writer through the git path.
7. Optional: MCP bearer auth when supported; PWA polish; safe orb mic-reactivity (via SpeechRecognition volume, NOT a parallel stream).

---

## 7. ⚠️ ROOTING — read before acting

The user said they intend to **root the Fold 7** to get "full access to all apps." **This was flagged as a bad trade and left undecided at 2:30am.** Do not help execute a root without revisiting this properly.

**What rooting a Samsung costs (permanent):**
- Knox e-fuse blows — a *physical* fuse, never resettable, even by Samsung
- Samsung Pay / Google Wallet dead forever on that handset
- Secure Folder destroyed, unrecoverable
- Banking apps stop working (user has HSBC)
- Warranty void on an ~£1,800 folding device
- Real brick risk on Fold-series bootloaders

**Critically: root does NOT deliver the actual goal.** Root = system shell access. Driving *other apps' UIs* still requires an Accessibility service or brittle `input tap` coordinates — which must be built either way.

**The better path: Tasker + AutoInput** (Accessibility plugin). Reads the screen, taps buttons, types into fields, drives any app — on a stock unrooted phone, with Wallet and banking intact. JARVIS already has an HTTP route to Tasker. **Recommend this instead.**

---

## 8. Reference data

```
GitHub vault    : etblues449/Obsidian-Vault-  (branch master)
GitHub code     : etblues449/jarvis-core      (branch main, PRIVATE)
Vault MCP       : https://vault-mcp-six.vercel.app/mcp
                  Vercel project jelly-bean-s-projects/vault-mcp, source ~/vault-mcp
Supabase        : https://dfaveoprjahbnydljich.supabase.co  (eu-west-3)
                  publishable key sb_publishable_Y5yDgHnS8RzDPQ67ewgFkw_CaWZRuX-
                  tables: projects, agents, agent_runs
Voice agent     : https://jarvis-voice-lovat.vercel.app
n8n webhook     : https://jellybean1875.app.n8n.cloud/webhook/jarvis-capture
Home Assistant  : 192.168.0.200 (also seen as 192.168.0.50:8123 — CONFIRM canonical)
Device paths    : ~/jarvis-core · ~/.jarvis · ~/.shortcuts · ~/vault-mcp
Provider        : JARVIS_PROVIDER=anthropic (Groq unreliable at tool-calling)
Git identity    : ehorton@selectlifestyles.co.uk (real email — fake ones break Vercel)
```

**Secrets live in `~/jarvis-core/.env` — gitignored, never commit.**

---

## 9. Session protocol

**Start:** read the vault via the MCP (`JARVIS/sessions/` newest file + this handoff) before responding.
**End:** write the session note to `JARVIS/sessions/YYYY-MM-DD.md` yourself via `vault_write`, and update this handoff if state changed.

**Style:** terse replies ("a", "b", "rec it" = just do it). Screenshots to show state. One step at a time — give one command, wait for output, then the next. Never jump ahead. Architecture decisions are locked once made.



---

# ⚠️ SUPERSEDING UPDATE — 2026-08-23

**Everything above dates from 2026-07-23 and is a month stale. Where it conflicts with this
section, THIS SECTION WINS.** In particular §2 ("13 tools") and §6 (open actions) are out of date.

Every item below was **verified running on the Fold 7**, not merely written — that distinction is
the failure mode this project has repeatedly hit ("documented ≠ merged ≠ running").

## Current state — verified on device 2026-08-23

| Area | State | Proof |
|---|---|---|
| Tools | **14** (capture added) | registry load + drift gate |
| Honest self-knowledge | ✅ `self-knowledge.mjs` → `self-knowledge.json`, injected into every prompt | `[drift] OK — matches live registry (14 tools)` |
| Hardline blocklist | ✅ `lib/hardline.mjs`, 20 patterns | `rm -rf /` refused **with confirm=yes**; `Get-Date` still ran |
| Injection scanner | ✅ widened 10 → 19 patterns in `lib/rails.mjs` | 31/31 regression suite |
| Persona | ✅ `lib/persona.mjs` — ONE source of truth for all four surfaces | 1 distinct honesty block, 1 personality |
| Memory | ✅ atomic + `.bak` + read-back verification | live round-trip; crash-kill 6/6 file valid |
| Action ledger | ✅ `lib/ledger.mjs` wired into `lib/agent.mjs` (7 points) | real declined tool → trail `proposed > declined` |
| Capture | ✅ `tools/capture.mjs` writes straight to `JARVIS/Inbox/` | note written → router **success** 03:01:49Z |
| GitHub Actions engine | ✅ **RESTORED** (was deleted) + pre-commit guard | Capture Router success; guard proven to block |

## The big finding of 2026-08-23 — read this before diagnosing any pipeline problem

**obsidian-git had deleted `.github/workflows/` entirely — three times** (2026-07-04, 07-14, and
08-06, commit `4bdb3bf1`). Obsidian does not index dotfolders, so `.github/` is invisible to it;
obsidian-git runs `git add -A` from the vault root and stages the invisible files as **deletions**.

Consequences that looked like unrelated bugs: captures dead since 2026-07-09, briefings stopped at
2026-08-04, and the old "8 files deleted by an unidentified client" mystery. One cause, three
symptoms. **Not Tasker, not the webhook, not the runner.**

Fixed: all six workflows restored from `a38848c9`; a **pre-commit hook** at `.git/hooks/pre-commit`
now refuses any commit that stages a deletion under `.github/` (hooks are local + untracked, so
obsidian-git cannot remove it). Proven by staging a real deletion — the commit was refused.

**If obsidian-git ever fails to commit, that is the hook working. Read the message before
`--no-verify`.**

## Capture — the n8n leg is retired

Capture no longer goes Tasker → paid n8n webhook. JARVIS writes the note itself via the `capture`
tool (kinds: note, task, idea, question, belief, decision), obsidian-git syncs it, the Actions
router files it. The tool refuses placeholder junk (`your note here`, `undefined`, empty) at source —
the exact bug that poisoned the inbox. C1 (£0) now has no live exception on this path.

## Standing delivery rules (learned the hard way — apply to EVERY installer)

1. **Ship source as plain `.mjs` in the vault**, never hand-transcribed base64 (a corrupted blob was
   caught by a SHA gate).
2. **Cache-bust every fetch AND assert on file content.** SHA proves integrity, **not freshness** —
   a stale CDN edge once served a matching old installer + old payload that verified clean and
   installed a known-broken patcher.
3. **When a corrected file must ship immediately, change the filename.** Cache-busting alone did not
   defeat a sticky edge; a fresh path cannot be stale.
4. **Patcher anchors must be regex and whitespace-insensitive**, and the installer must verify every
   anchor exists exactly once *before* modifying anything.
5. **Test against a throwaway copy**, never the user's real vault/memory; record real counts before
   and after and roll back on mismatch.

## Open (as of 2026-08-23)

- **Hub config backup — the single biggest remaining risk.** `automations.yaml`, `bedroom-2.yaml`,
  `frigate.yaml`, scenes/scripts, the flashed `ai_cam.yaml` and `ui-lovelace-minimal.yaml` exist
  **only on the HA Green**. One eMMC failure erases them. *(Attempted 2026-08-23; HA was restarting —
  ping answered, 8123 refused. Retry when it's up. UI-managed automations/scenes/scripts can be
  exported via the config REST API; YAML-only files need Studio Code Server or Samba.)*
- Scheduled skills restored but **not yet proven to fire on schedule** — the capture router is
  push-triggered and is proven; the four cron skills are not. First briefing since 2026-08-04 is the
  test. Check Actions rather than assuming.
- `AGENT.md` on the phone still documents 7 tools and understates tiers 3–6. Reconcile or demote.
- 546M `~/jarvis` sprawl → one canonical vault.
- n8n.cloud account cancellation (nothing depends on it now — housekeeping).
- Carousel `JARVIS_API_TOKEN`: rotation attempted, **not completed**; the exposed token still
  returns 200. **User decision 2026-08-23: leave it. Do not re-raise.**

