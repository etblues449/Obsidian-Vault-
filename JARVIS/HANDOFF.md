# JARVIS — HANDOFF

**Last updated:** 2026-08-02 (after PR #74 merged as `1fd9631`)
**Purpose:** Start a fresh chat with zero context loss. Read this top-to-bottom first.

> Companion documents:
> - `Claude Memory/2026-08-02-jarvis-state-of-the-system.md` — the evidence behind every status claim here
> - `Claude Memory/2026-08-02-session-handoff.md` — the narrative of the repair session, incl. dead ends
> - `AGENT.md` in `etblues449/jarvis-core` — the agent spec (tiers, tools, gate)
> - `CLAUDE.md` §A–D in the vault root — layers, commands, escalation
>
> **Every state claim below was observed.** Where something was not verified it says so.
> If you cannot reproduce a claim here, this file is wrong — fix it.

---

## 0. Read this first — the four footguns

1. **After ANY code change, restart the server** — `bash ~/.jarvis/restart.sh`. The wake
   listener only starts the server *if it's down*; it never restarts a running one. A
   stale process silently serving old code caused a full debugging detour (the "frozen
   clock" bug). Still the #1 footgun.
2. **A green GitHub Actions run does not mean anything was written.** Until 2026-08-02 the
   skill engine had *never* produced output on a schedule while reporting success on every
   run. The guard is fixed, but the habit stands: check for the artefact, not the tick.
   `reason=already-done` is normal; anything else is not.
3. **Something is deleting files from `master`.** On 2026-08-02 an obsidian-git client
   removed 8 files — including all five workflow files — and reverted a ninth. It was
   *current* with the remote; its working folder is a partial mirror. **It has not been
   identified.** See §3 and §7. If files vanish, find the clone that authored the commit;
   do not just restore.
4. **`jarvis-core`'s `main` is a single snapshot from 2026-07-22.** The launcher and the
   reconciled `AGENT.md` live only on the open PR #1 branch. Cloning or pulling `main`
   gets you neither — this is why `install-launcher.sh` "didn't exist" on the phone.

---

## 1. What JARVIS is

A voice-first personal assistant running on a **Samsung Galaxy Z Fold 7** via Termux,
grounded in the Obsidian vault. Hard constraints:

- **£0/month** ongoing cost (C1)
- **Phone-only runtime** — locked, do not relitigate. (Diagnostics may use the PC; that is
  not a change to the architecture.)
- **Single write path** — `master`, one serialized writer. Competing writers corrupted
  this vault before.
- **Permanent solves, not workarounds**
- **One step at a time** — deliver one step, confirm, then move
- **Honest** — never claims an action it didn't take

---

## 2. Current state

### Verified working

| Area | Evidence |
|---|---|
| Core agent loop (`runTurn`) | Shared by every interface |
| Voice terminal (`jarvis-voice.mjs`) | Streaming TTS, latency readout |
| Web app (`jarvis-app.mjs` + `web/index.html`) | Observed live on the Fold: `STATUS ONLINE`, six tabs (JARVIS/Chat/Memory/Activity/Tools/Settings) |
| **13 tools** register | `TOOLS 10` in the UI is **correct** — `/api/tools` (`jarvis-app.mjs:281`) hides the 3 `vault*` tools; they're reachable from chat |
| Supabase `database` tool | Live via PostgREST |
| Skill engine | Repaired 2026-08-02; 6 workflows on `master`; 26/26 offline tests |
| Capture Router (Skill 2) | Built, idempotent across repeated runs, junk quarantined |
| Vault integrity | `drift-check` 21/21 (S1 0, S2 0); `verify-refs` 68 PASS, 0 S1, 0 S2 |
| Vault MCP (Claude ⇄ vault) | Live, read+write, via the git path |

### Verified broken or absent

| Area | Detail |
|---|---|
| **Capture is idle** | Newest capture anywhere is **2026-07-09** — ~24 days. Do **not** trust a briefing built from this corpus until something new arrives. |
| **Memory has never stored a fact** | Tier 4 is wired end-to-end. `Claude Memory/Account/jarvis_memory.md` **does not exist**. The web app shows `MEMORY 0`. Built ≠ used. |
| **`jarvis-core` unbacked since 2026-07-22** | One commit on `main`. Any device work since exists only on the Fold. |
| **`tier1-test.mjs` is 6/7** | The 401 mock (`test/tier1-test.mjs:172`) omits `headers`, which `lib/brain.mjs:226` reads unconditionally. Production unaffected — a real `fetch` Response always sets it. One-line fixture fix, not yet done. |
| Tests for the `database` tool | None. Open item. |
| Phone capture leg | Still posts to the **paid n8n webhook**; the Tasker variable bug is unfixed. |

### Genuinely unknown — do not assume

- **Is the always-on wake listener still running?** No evidence either way this session.
  Check `bash ~/.jarvis/wake-status.sh` on the device.
- **Is the heartbeat running?** The committed `.heartbeat-state.json` is from the
  2026-07-22 snapshot and cannot answer it. Read the live copy on the Fold.
- **Which client deleted the 8 files** (§3).
- Whether anything on the Fold is unpushed since `05778ba`.
- n8n.cloud account state — only that no n8n-format commit exists after 2026-07-08.

---

## 3. What changed on 2026-08-02

**PR #74 merged as `1fd9631`.** Three things:

1. **The skill engine had never run on schedule.** GitHub cron starts free-runner jobs
   30 min–3 h late; the guard required an *exact* London-hour match, so every delayed run
   exited 0 with the commit step skipped — and reported success. Proof: job
   `30693257169` (`London now: … 10:11` / `want hour=7`). All 11 scheduled runs failed
   this way; every artefact on `master` came from n8n (07-07, 07-08) or a manual dispatch.
   **Fixed** — the guard is now per-skill period idempotency (`shouldRun` + `done(ctx)`):
   *"has this period's output already been written?"* DST-safe, delay-safe, self-healing.
2. **Capture Router (Skill 2) built** — `on: push` to both inbox paths, deterministic rule
   table (no Groq call), junk quarantined to `JARVIS/Inbox/_rejected/`, `#belief` /
   `#decision` routing, SHA-1-keyed idempotency. Also fixed the `|| "Inbox"` fallback in
   both copies of `jarvis.js` that had been hiding captures from the engine since
   2026-06-19.
3. **8 files recovered.** Two `Sync from Obsidian (Jarvis )` commits (`c9f3d2f`,
   `93ed5cb`) deleted all five workflows, `repos-manifest.json`, `Work/setup-repos.sh`,
   and `JARVIS-Carousel/.gitignore` (which ignores `.env`, `*.pem`), and reverted
   `Smart Home/_index.md` to a pre-PR-#71/#72 copy. **Second occurrence** — the first is
   in `CLAUDE.md`'s change history for 2026-07-27. Restored; **cause unfixed**.

**`jarvis-core` PR #1 — still open**: the one-tap launcher (§4) and a reconciled
`AGENT.md` (tiers 3–6 ticked, tool table 7 → 13, web app recorded, a corrupted duplicated
block repaired).

---

## 4. Key commands

```bash
# Web app — one tap (after PR #1 merges)
sh ~/jarvis-core/scripts/install-launcher.sh   # run once
sh ~/jarvis-core/scripts/jarvis-launch.sh      # start if down, then open
# Port is 8737. Plain http://localhost is port 80 and will always refuse.

# Wake word (always-on voice)
bash ~/.jarvis/wake-start.sh      # start listening in background
bash ~/.jarvis/wake-status.sh     # is it alive? + last 5 things heard
bash ~/.jarvis/wake-stop.sh       # stop

# Server
bash ~/.jarvis/restart.sh         # ALWAYS use after code changes

# Terminals
cd ~/jarvis-core && node jarvis-voice.mjs      # voice
cd ~/jarvis-core && node jarvis.mjs            # text
node jarvis-rails.mjs status | audit | usage | safe on|off

# Vault health (read-only, safe any time)
bash .claude/skills/vault-integrity-audit/scripts/drift-check.sh .
python3 .claude/skills/qa-boundary-check/scripts/verify-refs.py .

# Skill engine
node "Assistant Core/jarvis-skills/test/local-test.mjs"                 # 26 offline
node "Assistant Core/jarvis-skills/runner.mjs" --skill=capture-router

# Sync
cd ~/jarvis-core && git push

# Logs
tail -20 ~/.jarvis/wake.log
tail -20 ~/jarvis-core/server.log
```

---

## 5. Architecture

```
lib/agent.mjs      runTurn() — one full turn. Confirmation gate lives HERE.
lib/brain.mjs      Provider seam (Groq ⇄ Anthropic = .env change)
lib/tools.mjs      Tool registry — drop a file in tools/, it auto-loads
lib/signoff.mjs    Zero-token goodbye detector
lib/say-stream.mjs Sentence-level streaming TTS
lib/memory.mjs     Vault fact management → Claude Memory/Account/jarvis_memory.md
lib/rails.mjs      Safe mode, audit log, cost tally, injection scan
lib/heartbeat.mjs  Tier 5 scheduled checks (config in heartbeat.json)
jarvis-app.mjs     Web server (:8737) — systemPrompt() ~line 56; /api/tools ~line 279
web/index.html     Neon command centre UI (single file)
tools/*.mjs        One file per capability (13 registered)
scripts/*.sh       jarvis-serve / jarvis-launch / install-launcher   [PR #1]

~/.jarvis/           wake-listen.sh, wake-start/stop/status.sh, restart.sh, wake.log
~/.shortcuts/JARVIS  one-tap launcher (Termux:Widget)
~/vault-mcp/         the Vault MCP server (deployed to Vercel)
```

**Backend endpoints:** `/chat` (SSE: token/tool/silent/confirm/error), `/speak`, `/reset`,
`/confirm`, `/api/memory[/add|/forget]`, `/api/rails[/safe]`, `/api/tools`,
`/api/vault/note`

**The five layers** (shorthand used across the vault) are documented in `CLAUDE.md` §A.

---

## 6. Hard-won learnings — don't rediscover these

**Device / voice**
- **`termux-speech-to-text` returns EMPTY through command substitution** `$(...)` — exits 0
  instantly without listening. **Capture to a file**, then read it. Cost hours.
- **Never open `getUserMedia`/AudioContext while `SpeechRecognition` is active on Samsung**
  — steals audio focus, Android returns a "call ended" state, voice input dies. Only touch
  Web Audio during TTS playback.
- **`onnxruntime` / Vosk have NO installable wheel** for Termux aarch64 + Python 3.14.
  openWakeWord and Porcupine are off the table. Don't retry.
- **No `/tmp` on Termux** — use `$HOME`.
- **Stale server process = phantom bugs.** Kill and restart after every change.
- **`nohup … &` alone doesn't survive the session** — needs `</dev/null` or the child
  inherits the terminal and dies with it.

**Git / CI**
- **GitHub Actions cron is best-effort** — 30 min–3 h late on free runners. Never gate on
  an exact clock match. Gate on "does the output for this period exist".
- **`git cat-file -e <sha>` cannot identify which clone *authored* a commit** — it's true
  for any clone that merely fetched it. Use `git reflog | grep "<commit subject>"`.
- **A tracked state file proves nothing about "now"** if the snapshot commit is from the
  same period. (`.heartbeat-state.json` caught me out.)
- **Fine-grained GitHub PATs default Contents to Read-only** → writes 403 with "Resource
  not accessible by personal access token". Editing the token's permissions keeps the same
  token string.
- **Large pastes / heredocs corrupt in Termux.** Use git for code.

**Windows**
- **`Get-ChildItem -Recurse` skips hidden folders** without `-Force`, and won't traverse
  OneDrive Files-On-Demand placeholders. To find Obsidian vaults, read
  `%APPDATA%\obsidian\obsidian.json` — Obsidian's own authoritative list.

**Services**
- **PostgREST anon role can't `count()`** → 400. Fetch rows, count in JS.
- **Vercel `buildCommand: "npm install"` causes 404**; Deployment Protection causes 302.
- **The Claude web "Add custom connector" dialog does NOT expose request headers** (OAuth
  fields only) — the Vault MCP runs without bearer auth. Re-add when supported.
- **"Free tier" usually means trial credits.** Vapi, Retell, LiveKit Cloud, Deepgram and
  ElevenLabs are credits. Groq's free tier and the browser Web Speech API are genuinely
  free.

---

## 7. Open / next actions — in priority order

1. **Find the client deleting files from `master`.** It was current with the remote and
   still committed absences as deletions, so it will do it again. Ruled out: the Termux
   clone, and all three git-backed vaults on the Fold. **The PC has not been checked:**
   ```powershell
   $j = "$env:APPDATA\obsidian\obsidian.json"
   if (Test-Path $j) { (Get-Content $j -Raw | ConvertFrom-Json).vaults.PSObject.Properties | ForEach-Object { $_.Value.path } } else { "No obsidian.json — Obsidian has never run here." }
   ```
   Then per vault: `.git` present, `.github` absent, and does its reflog contain
   `Sync from Obsidian`? Disable obsidian-git in every vault but the one intended writer.
   Note: a live git repo sits in `Obsidian Vault/.trash/JB's Vault 2` (201 dirty files),
   and `JB's Obs Sync Vault Laptop` is on `master`, three weeks stale, 302 dirty. Neither
   caused this, but both are set up to.
2. **Fix the Tasker variable at source.** The junk filter is a second line of defence only.
   Log the variable to a Flash *immediately before* the HTTP Request action — scope at that
   moment is the usual cause, not the network.
3. **Merge `jarvis-core` PR #1**, then on the Fold:
   `git checkout main && git pull && sh ~/jarvis-core/scripts/install-launcher.sh`.
   Then install **Termux:Widget**, install **Termux:Boot _and open it once_**, and set
   **Settings → Apps → Termux → Battery → Unrestricted**.
4. **Push `jarvis-core` from the Fold** so 11 days of device work stops being a single
   point of failure.
5. **Prove the memory path** — one deliberate `remember` on the Fold, confirm it reaches
   `master`.
6. **Finish Phase 2** — retarget Tasker from the n8n webhook to the GitHub Contents API
   (`Assistant Core/jarvis-skills/MIGRATION.md` → Phase 2, step 1). Until then the paid
   dependency is live and C1 is unmet.
7. **Watch the first real scheduled run.** Expect a written brief, or
   `reason=already-done`. Anything else is a regression.
8. `phone_control` tool — expose what Termux:API genuinely does: calls, SMS, contacts,
   launch any app, torch/wifi/volume/brightness, notifications, clipboard, battery,
   vibrate. **Previously agreed as the next build.**
9. Tests for the `database` tool — GET-only guard, empty result, malformed query,
   connection failure.
10. Wake-word tuning — it currently picks up background chatter.
11. Fix `tier1-test.mjs` (one-line mock fix, §2).

---

## 8. ⚠️ ROOTING — read before acting

The user has said they intend to **root the Fold 7** for "full access to all apps." **This
was flagged as a bad trade and left undecided.** Do not help execute a root without
revisiting it properly.

**What rooting a Samsung costs (permanent):**
- Knox e-fuse blows — a *physical* fuse, never resettable, even by Samsung
- Samsung Pay / Google Wallet dead forever on that handset
- Secure Folder destroyed, unrecoverable
- Banking apps stop working (user has HSBC)
- Warranty void on an ~£1,800 folding device
- Real brick risk on Fold-series bootloaders

**Critically: root does NOT deliver the actual goal.** Root = system shell access. Driving
*other apps' UIs* still requires an Accessibility service or brittle `input tap`
coordinates — which must be built either way.

**The better path: Tasker + AutoInput** (Accessibility plugin). Reads the screen, taps
buttons, types into fields, drives any app — on a stock unrooted phone, with Wallet and
banking intact. JARVIS already has an HTTP route to Tasker. **Recommend this instead.**

---

## 9. Reference data

```
GitHub vault    : etblues449/Obsidian-Vault-  (branch master)
GitHub code     : etblues449/jarvis-core      (branch main, PRIVATE)
Vault MCP       : https://vault-mcp-six.vercel.app/mcp
                  Vercel project jelly-bean-s-projects/vault-mcp, source ~/vault-mcp
Supabase        : https://dfaveoprjahbnydljich.supabase.co  (eu-west-3)
                  tables: projects, agents, agent_runs
                  publishable key: in ~/jarvis-core/.env — NOT recorded here
Voice agent     : https://jarvis-voice-lovat.vercel.app
n8n webhook     : https://jellybean1875.app.n8n.cloud/webhook/jarvis-capture  (PAID — retiring)
Home Assistant  : 192.168.0.200  (canonical — confirmed by ha-doctor 2026-08-02)
Web app port    : 8737
Device paths    : ~/jarvis-core · ~/.jarvis · ~/.shortcuts · ~/vault-mcp
Git identity    : ehorton@selectlifestyles.co.uk (real email — fake ones break Vercel)
```

**Secrets live in `~/jarvis-core/.env` — gitignored, never commit.** The Supabase
publishable key was previously written into this file in plaintext; it was removed on
2026-08-02 per the vault's own rule — *never write a secret or token into a note,
reference it by name only*. If it needs rotating, do that on the assumption it was
exposed.

**Unresolved contradiction:** this file previously recorded
`JARVIS_PROVIDER=anthropic (Groq unreliable at tool-calling)`, while `AGENT.md` documents
Groq as the default under C1. Both may be true (device `.env` overriding the documented
default) — but check `~/jarvis-core/.env` on the Fold and make the two agree.

---

## 10. Session protocol

**Start:** read `CLAUDE.md`'s eight mandatory files, then the newest
`JARVIS/sessions/` note and this handoff, before responding. Report any missing file **as
missing** — never synthesise plausible contents.

**End:** write the session note to `JARVIS/sessions/YYYY-MM-DD.md`, update the relevant
project `_index.md`, tick `Claude Memory/Account/capture_queue.md`, and update this
handoff if state changed.

**Style:** terse replies ("a", "b", "rec it" = just do it). Screenshots show state. One
step at a time — give one command, wait for output, then the next. Never jump ahead.
Architecture decisions are locked once made.

**Before repeating any status claim in this vault, name the observation behind it** — a
job log, a file on `master`, a test you ran. Documented, merged and running are three
different states, and "built" is not "used".
