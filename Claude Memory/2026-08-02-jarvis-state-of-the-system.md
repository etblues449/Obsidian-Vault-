# JARVIS — State of the System (2026-08-02)

> **What this is.** A verified, point-in-time understanding of the whole JARVIS project
> across all five layers. Every claim below was checked against the live system — the
> repos, the GitHub Actions run history, the job logs, the filesystem — not against what
> other vault notes assert.
>
> **What this is not.** A source of truth. `CLAUDE.md`, each `_index.md`, `AGENT.md` and
> `JARVIS/HANDOFF.md` remain authoritative for their own layers. This is a snapshot of
> where they agree with reality and where they don't, taken on 2026-08-02.
>
> **Method.** Read the 8 mandatory session-start files, then verified against:
> `drift-check.sh`, `verify-refs.py`, the GitHub Actions API (30 runs), one full job log,
> `git log` provenance for every skill output file, and both repos on disk.

---

## 1. The honest one-paragraph

JARVIS is **four working systems and one broken one**. The Obsidian vault (state store),
the `jarvis-core` on-device agent (voice, tools, wake word), the Home Assistant layer
(hub, nodes, cameras) and the QA harness (agents, skills, checkers) are all real and
functioning. The **scheduled "Active Vault" skill engine is not** — it has never once
produced output from a schedule. Every briefing, connection report, synthesis and pattern
report attributed to GitHub Actions was produced by a human clicking *Run workflow*. The
runs go green, GitHub reports success, and nothing is written. This is the exact failure
mode `MEMORY.md` warns about — *"silent failures outrank loud ones"* — and it has been
running undetected for roughly three weeks.

---

## 2. Layer-by-layer state

| Layer | Real state | Confidence |
|---|---|---|
| **Vault / state store** | Healthy. 0 S1, 0 S2, 1 cosmetic dangling link. All 8 session-start files present. | Verified |
| **Skill engine (scheduled)** | **BROKEN — silent.** 0 of ~25 scheduled runs ever wrote output. | Verified (job log) |
| **Skill engine (manual)** | Works. Produces grounded output when dispatched by hand. | Verified |
| **Capture path** | Idle ~24 days. Last capture 2026-07-09. Known Inbox split confirmed. | Verified |
| **`jarvis-core` (on-device)** | Far ahead of its own spec. Working, but `AGENT.md` is stale and 1 test is red. | Verified |
| **Voice / Home Assistant** | Recovering. Live diagnosis exists; newest state sits in unmerged PR #73. | Verified |
| **QA harness** | Working — it is what caught most of this. One stale definition. | Verified |

---

## 3. Finding 1 — the skill engine has never run on schedule (S1, silent)

**This is the headline. Everything else is smaller.**

### The evidence

Every Morning Brief cron fires at `0 6 * * *` UTC (= 07:00 London, BST). GitHub Actions
cron is best-effort and on free runners routinely starts 30 minutes to 3 hours late. The
in-runner guard requires an **exact** London-hour match:

```js
// Assistant Core/jarvis-skills/runner.mjs:340
if (guard.hour != null && london.hour !== guard.hour) return false;
```

`londonNow()` reads actual wall-clock time at execution, not the scheduled time. So any
delayed run fails the guard, exits 0, and the workflow reports **success**.

Job log from run `30693257169` (scheduled, 2026-08-01) — the smoking gun:

```
[jarvis] London now: Saturday, 1 August 2026 10:11 (dow=6)
[jarvis] Not the scheduled London time for Morning Brief — nothing to do. (want hour=7)
[jarvis] no write. reason=time-guard
A time-guard skip is expected: each skill fires two crons (BST + GMT)
and exactly one passes the London-hour guard.
```

Job steps: `Run skill` = success · **`Commit and push` = skipped** · run conclusion = **success**.

### Why nobody caught it

The workflow's own skip message says *"A time-guard skip is expected."* It is designed to
reassure a human reading the log. It cannot distinguish the **intended** skip (the wrong
one of the BST/GMT pair) from the **failure** skip (both delayed past the hour). Every
scheduled run therefore looks normal.

### Every scheduled run, checked

All 11 scheduled runs in the API history started too late to pass the guard:

| Started (UTC) | London hour | Guard wants | Result |
|---|---|---|---|
| 2026-08-01 09:11 | 10 | 7 | skip |
| 2026-08-01 08:02 | 09 | 7 | skip |
| 2026-07-14 08:02 | 09 | 7 | skip |
| 2026-07-13 09:24 | 10 | 7 | skip |
| 2026-07-12 08:14 | 09 | 7 | skip |
| 2026-07-11 07:53 | 08 | 7 | skip |
| 2026-07-10 09:32 | 10 | 7 | skip |
| 2026-07-09 09:37 | 10 | 7 | skip |

…and the same pattern for Connection Finder, Weekly Synthesis and Pattern Detector.

### Provenance of every output file confirms it

| File | Committed | Actually produced by |
|---|---|---|
| `briefings/2026-07-07.md` | 07-07 07:00 | **n8n** (msg: "Morning brief … (automated)") |
| `briefings/2026-07-08.md` | 07-08 07:00 | **n8n** |
| `briefings/2026-07-09.md` | 07-09 00:43 | manual `workflow_dispatch` |
| `briefings/2026-08-01.md` | 08-01 01:22 | manual `workflow_dispatch` |
| `connections/2026-07-09.md` | 07-09 00:44 | manual `workflow_dispatch` |
| `connections/2026-08-01.md` | 08-01 01:32 | manual `workflow_dispatch` |
| `synthesis/2026-W28.md` | 07-09 00:45 | manual `workflow_dispatch` |
| `synthesis/2026-W31.md` | 08-01 01:33 | manual `workflow_dispatch` |
| `patterns.md` | 08-01 01:33 | manual `workflow_dispatch` |

**Four briefings exist for a daily skill that has been "live" since 2026-07-08.** There
should be ~26. Two of the four came from n8n, before the migration.

### The capture_queue tick is wrong

`Account/capture_queue.md` currently reads:

> `[x] S1 — Run each of the 4 skills once … (2026-08-01: better — scheduled runs for
> skills 1/3/4/6 all committed to master today: e43e6f6, 8a89e92, e22ea99, 1c18bc1)`

Those four commits came from `workflow_dispatch` runs at 01:09–01:33, not scheduled runs.
The item is correctly ticked (the skills *were* verified to work) but the **reason given
is wrong**, and that wrong reason is what makes the schedule look proven.

### Recommended fix (not applied — architectural, your call)

Replace the exact-hour equality guard with **output idempotency**:

> Fire the cron. Ask "does this skill's output for today / this week already exist on
> master?" If yes, exit 0. If no, generate and commit.

This is strictly better than an hour match: it is DST-safe *and* delay-safe, it
self-heals a missed day, and duplicate crons collapse naturally. A tolerance window
(`hour >= 7 && hour <= 11`) is a cheaper patch but still loses any run delayed past the
window. Either way, the "skip is expected" log line must stop claiming skips are normal.

---

## 4. Finding 2 — capture has been idle for 24 days

- Newest capture anywhere: **2026-07-09** (`note_20260709-081907-…`).
- Newest capture the engine can see (`JARVIS/Inbox/`): **2026-07-07**.
- Nothing has arrived since.

The known Inbox split is **confirmed real**: `Inbox/` (27 md files) and `JARVIS/Inbox/`
(22) are two separate directories, not a symlink. Five files exist **only** in root
`Inbox/` and are therefore invisible to the runner, which reads `JARVIS/Inbox/` only
(`runner.mjs:112`):

```
note_20260709-081907-shell-command-to-launch-claude-in-jarvis.md
question_20260629-015353-check-if-jarvis-is-working.md
quick-capture.md
task_20260620-205637-set-alarm-for-8am-tomorrow.md
task_20260624-155912-set-alarm-to-leave-house-at-8-15-for-sch.md
```

Consequence: even when the skill engine is fixed, Morning Brief and Connection Finder
will be reading a corpus whose newest entry is four weeks old. **Fixing the schedule
without fixing capture produces confident, stale briefings** — a worse failure than
producing nothing.

n8n also stopped producing after 2026-07-08. I verified that *no n8n-format commit exists
after that date*; I did **not** check the n8n.cloud account itself, so whether the
workflows are deactivated, expired or simply failing is unknown.

---

## 5. Finding 3 — `jarvis-core` is well ahead of its own spec

`etblues449/jarvis-core`, branch `main`, single commit `05778ba`, zero npm dependencies.

`AGENT.md` declares itself "single source of truth" and shows:

- [x] Tier 0–2 · [ ] Tier 3 Ears & mouth · [ ] Tier 4 Memory · [ ] Tier 5 Heartbeat · [ ] Tier 6 Rails

**All four "unbuilt" tiers have shipped code**, and `JARVIS/HANDOFF.md` (2026-07-23)
documents them as working:

| Tier | AGENT.md | Actually on disk |
|---|---|---|
| 3 — Ears & mouth | ☐ | `lib/ears.mjs`, `lib/deepgram.mjs`, `lib/elevenlabs.mjs`, `lib/say-stream.mjs`, `jarvis-voice.mjs` (9.9 KB) |
| 4 — Memory | ☐ | `lib/memory.mjs`, `tools/remember.mjs`, `forget.mjs`, `update-memory.mjs` |
| 5 — Heartbeat | ☐ | `lib/heartbeat.mjs`, `heartbeat.mjs`, `heartbeat.json`, `heartbeat-tick.sh` |
| 6 — Rails | ☐ | `lib/rails.mjs`, `jarvis-rails.mjs`, `test/tier6-test.mjs` (23 tests, green) |

Plus a web app (`jarvis-app.mjs` + `web/index.html`, the neon command centre), a Supabase
`database` tool, and always-on wake word — none of which appear in `AGENT.md` at all.

`AGENT.md` is the file every fresh session is told to read first, and it understates the
system by four tiers. **It should be reconciled with `HANDOFF.md` or explicitly demoted.**

### One red test

`node test/tier1-test.mjs` → **6 passed, 1 failed**:

```
✗ chat() does NOT retry a 401 (bad key = fix it, not hammer it)
  TypeError: Cannot read properties of undefined (reading 'get')
```

Cause: `lib/brain.mjs:226` calls `res.headers.get('retry-after')` unconditionally for any
non-OK response, but the test's fetch mock (`test/tier1-test.mjs:172`) returns an object
with no `headers` key. **Production is unaffected** — a real `fetch` Response always has
`headers` — so this is a test-fixture gap, not a live bug. It still means `main` ships a
red suite while `README.md` presents the offline tests as the verification gate. Fix is
one line in the mock; optionally also skip the retry-after lookup for non-retryable
statuses.

Tier 2 (16/16) and Tier 6 (23/23) are green.

---

## 6. Finding 4 — voice / Home Assistant: newest truth is unmerged

- **PR #73 is open, draft, `mergeable_state: clean`** — 5 commits, 8 files, +7,802 lines.
  It contains the *second* HA diagnosis (unavailable entities **156 → 130**), both cameras
  verified streaming, and the `ai_cam_outside` (.201) provisioning record.
- Key lesson captured there and worth promoting: **OTA cannot change the partition
  layout** — the 16 MB table needed one USB flash.
- Main `ai_cam` (.199) hit the **EXIO3 boot race for the third time**. The proposed
  `on_boot` settle-delay fix is still *not flashed*.
- microWakeWord is still off on `ai_cam` — the full config OOMs the HA Green's compiler.
  Option B (compile on the PC, ~15 min, OTA) is the open path; N100 (~£140) is the
  structural fix.
- 3 of 4 voice satellites were offline at the first diagnosis; PR #73 reports 2 recovered.

**Until #73 merges, `master` — and therefore every future session's session-start read —
is a day behind the real house.**

Three other PRs sit open and stale: **#70** (canonical `ai_cam.esphome.yaml`), **#68**
(minimise HA automations), **#67** (NotebookLM client).

---

## 7. Finding 5 — the harness disagrees with itself about session start

The 2026-07-27 reconciliation aligned `CLAUDE.md`, `.claude/hooks/session-start.sh` and
`runner.mjs` on an 8-file list including **Work Financial Forecasting**. It missed one
place:

`.claude/skills/vault-conventions/SKILL.md` still lists **7 files, omitting Work
Financial Forecasting**. That skill is marked *"Preloaded background knowledge for every
JARVIS agent"* — so every agent loads the superseded list. Fixed in this change (§10).

---

## 8. Vault health — actually good

```
drift-check.sh   21 checks   S1: 0   S2: 0   S3: 0
verify-refs.py   69 checks   66 PASS  0 S1  0 S2  1 S3  |  2 REVIEW
```

The only defect is one dangling wikilink, `[[hardware/ai_cam]]`, in the Smart Home index —
the file on disk is `hardware/ai_cam.yaml`, so the link needs the extension or a rename.
Six of the seven dangling links recorded in `capture_queue.md` have since been resolved;
that queue section is stale in the user's favour.

The 2 REVIEW items are `LIVE`/`DEPLOYED` status claims in the Smart Home index flagged for
a human eye. **Finding 1 shows why that flag matters** — "Seven-Skill Active Vault: LIVE
(2026-07-04)" is, on the scheduled path, not true.

---

## 9. What needs a decision from you

1. **Skill-engine guard** — idempotency check (recommended) vs tolerance window vs leave
   manual. Architectural; not changed unilaterally.
2. **Capture first or schedule first?** My read: **capture first.** A fixed schedule over a
   4-week-stale corpus manufactures confident, wrong briefings.
3. **`AGENT.md`** — reconcile to reality, or demote it and make `HANDOFF.md` the entry point?
4. **Merge PR #73**, and triage the three stale PRs (#70, #68, #67).
5. **n8n.cloud** — confirm the account state and formally retire it (C1).
6. **Open from the last session, unanswered:** the device you were running Termux checks on
   — **pad or Fold 7?** The pad wasn't due until 5–8 Aug. `ro.build.characteristics=device`
   only tells us it isn't a TV build. Everything recorded about Termux battery/wakelock
   behaviour in this vault is Fold-7 specific, so this determines whether those notes apply.

---

## 10. Changed in this session

- **Added** this document.
- **Fixed** `.claude/skills/vault-conventions/SKILL.md` — session-start list 7 → 8 files,
  adding `Work Financial Forecasting` (§7). One-line consistency fix; no behaviour change.
- **Corrected** the wrong evidence note on the ticked S1 item in
  `Account/capture_queue.md`, and added the new findings as open items.
- **Updated** the Smart Home `_index.md` status line for the skill engine, which claimed a
  working schedule.

Nothing else was modified. The skill-engine guard, the capture router, `AGENT.md`, the red
test and the open PRs were **left alone by design** — they need your decisions above.

## 10b. Second pass — `jarvis-core` + web app audited directly (2026-08-02, later)

Elliot ran the web app on the Fold and asked for both repos to be audited against
this document and against two externally-produced files (§10c). New findings:

### The web app is live and further along than any doc says

Observed on-device: `STATUS ONLINE · TOOLS 10 · MEMORY 0`, six tabs — JARVIS, Chat,
**Memory, Activity, Tools**, Settings, plus a Capture Queue control.

- **`TOOLS 10` is correct, not a defect.** 13 tools register; `/api/tools`
  (`jarvis-app.mjs:281`) deliberately hides the three `vault*` tools because they are
  reachable from chat. 13 − 3 = 10.
- **`AGENT.md` documents 7 tools. 13 are registered**: the 7 listed plus `database`,
  `ha_list`, `pc_control`, `remember`, `forget`, `update_memory`. AGENT.md understates
  the tool surface as well as the tier state.
- **Memory, Activity and Tools pages are all implemented** in `web/index.html`.

### `MEMORY 0` — memory is built but has never been used

`lib/memory.mjs` persists to `Claude Memory/Account/jarvis_memory.md` inside the vault
(`memoryPath()`, `DEFAULT_REL`). **That file does not exist** — not on disk, not on
`master`. So Tier 4 is wired end-to-end but has never stored a single fact.

Built ≠ used. The tier can be correct and the feature still be delivering nothing.
Worth one deliberate `remember` on the Fold to prove the whole path — tool → vault file
→ obsidian-git → `master` — before it is called done.

### `jarvis-core` on GitHub is a single 11-day-old snapshot

One commit, `05778ba`, dated **2026-07-22 23:57**. Nothing pushed since.

The uploaded runbook states the rule correctly — *"Phone is source of truth… the only
reliable method is push to GitHub master, then pull on-device"* — and that rule has not
been followed for 11 days. Any on-device work since 22 July exists **only on the Fold**,
unbacked. Given the vault's own history of losing files, this is the least-protected
part of the system.

### Heartbeat — status genuinely unknown, do not assume

`.heartbeat-state.json` records last runs `2026-07-22T06:40` (Morning Brief) and
`20:40` (Evening Wind-down). It is a **tracked** file, and the snapshot commit is from
that same evening — so it captured that day's state and proves nothing about what has
happened since. The phone's live copy will have moved on.

I initially read this as "the heartbeat stopped on 22 July." That was wrong and is
corrected here. Checking it requires reading `.heartbeat-state.json` **on the Fold**.

---

## 10c. The two externally-produced documents (`claude.md`, `JARVIS_HEALTH_CHECK`)

Two files were produced by a different session on 2026-08-02 and given to me to
reconcile. **Neither should be committed as-is.** Both open by warning that
"Documented ≠ merged ≠ running", then assert the opposite of what is observable.

| Claim | Reality (verified) |
|---|---|
| "All 4 scheduled skills producing automated commits daily"; "Error rate: 0"; "99.7% uptime" | No scheduled run has ever written output (§3). The cited 08-01 commits were manual dispatches. |
| "Weekly Synthesis last run 2026-07-28" | No such run exists in the Actions history. |
| "176 assertions, all green" | `tier1-test.mjs` is **6/7 red**. Tiers 3/4/5 tests (76 of those assertions) **have no files** — `test/` holds only tier1, tier2, tier6. Real total ≈ 72, one failing. |
| "CI/CD ✅ 4 workflows all in `.github/workflows/`" | `master` has **0** workflow files (§10d). |
| "Vault … file inventory ✅ complete" | 8 files deleted from `master` at 03:47/03:50. |
| "Automations ✅ 19 lounge" | ha-doctor: **8**, three stale >30d. |
| "Hub up-to-date, stable" | Core **2026.8.0b2 beta**, 4 pending updates. |
| "AI Cam ✅ microWakeWord" | Regressed 2026-08-02 — the config OOMs the HA Green's compiler. |
| `claude.md` §12: "Skill engine doesn't run → `GROQ_API_KEY` not set" | Wrong cause. The key worked; the time guard ate every run. |
| §3 ElevenLabs live vs §6 "decision pending" | Internally contradictory. |
| "Activity page next" (not built) | It **is** built and live. |

**The most serious category is invented precision.** Section 8 gives p50/p95/p99
latencies and uptime to one decimal (99.7%, 99.8%, 99.5%). No telemetry in this system
can produce those numbers. A gap prompts a check; a fabricated number does not.

**Practical hazard:** the vault root already holds `CLAUDE.md`. A second file named
`claude.md` collides on Windows and Android — both case-insensitive, and obsidian-git
syncs across exactly those.

**Worth keeping from them:** the Layer A–E model, the glossary, the Termux/PowerShell
command reference and the escalation list. The vault has no equivalent and they are
largely accurate. Folding those into the existing `CLAUDE.md` is proposed, not done —
it changes the project's instruction file and needs Elliot's call.

---

## 10d. Recurrence: `master` lost 8 files to a stale obsidian-git sync

At 03:47 and 03:50 UTC two "Sync from Obsidian (Jarvis )" commits (`c9f3d2f`,
`93ed5cb`) deleted 8 files and reverted a ninth, adding nothing:

- all five `.github/workflows/*.yml` — **the engine's entire schedule**
- `repos-manifest.json`, `Work/setup-repos.sh`
- `JARVIS-Carousel/.gitignore` — which ignores `.env`, `.env.local`, `*.pem`
- `Smart Home/_index.md` reverted to a pre-PR-#71/#72 copy, restoring the superseded
  TV entity `tv_jelly_beans_tv_2` that no longer exists in the live registry

This is the **second occurrence** — CLAUDE.md's change history records the same on
2026-07-27. All 8 are restored in the branch behind this document.

**The cause is unfixed.** The writing client was at `efdb8fa` (current), so it is not
behind — its *working folder* is a partial mirror that lacks those paths. It is not the
Termux clone (that fast-forwarded cleanly with no local commits) and not any of the
three git-backed vaults found on the Fold (none has the commits). Eight `.obsidian`
folders exist on the device, one of them a live git repo inside `.trash`. The writer
has not yet been identified; the PC has not been checked.

---

## 11. What I did NOT verify

Stated plainly so this document can't be mistaken for wider coverage than it has:

- The **n8n.cloud account state** (only that no n8n-format commit exists after 2026-07-08).
- **Live HA hardware** — no LAN access from this session. All HA facts here are read from
  the committed ha-doctor reports and PR #73, not observed.
- Whether the **`GROQ_API_KEY` secret** is still valid — the last successful Groq call was
  the manual dispatch on 2026-08-01.
- **Runtime behaviour of `jarvis-core` on the Fold 7** — only the offline suites were run,
  here in the container, not on the device.
- Any file tagged `sensitive` / `private` / `confidential` / `legal` / `financial` — not
  opened, per the vault's sensitive-data policy.
- **Whether the heartbeat is still running** — the committed state file is from the
  snapshot date and cannot answer it. Read `.heartbeat-state.json` on the Fold.
- **Which client deleted the 8 files** (§10d). Not the Termux clone, not the three
  git-backed vaults on the Fold. The PC has not been checked.
- **Whether anything on the Fold is unpushed** since `05778ba` (2026-07-22).

---

*Verified 2026-08-02 against both repos, the GitHub Actions API, and one full job log.*
