# Session Handoff — 2026-08-02 (engine repair)

> **Purpose:** start a new session with zero context loss. Read this top to bottom.
> Its companion is [[2026-08-02-jarvis-state-of-the-system]], which carries the full
> evidence for every claim here. This file is the narrative: what was asked, what was
> found, what was built, what was tried and rejected, and what is still open.
>
> **Everything below was observed, not assumed.** Where something was not verified it
> says so explicitly (§7). If you find a claim here you cannot reproduce, treat this
> file as wrong and fix it — that is the whole point of the session it describes.

---

## 1. What was asked

> *"make a up to date understanding for Jarvis project"*

Then, after the findings landed:

> *"fix capture first, then the guard with the idempotency check"* → §4
> *"I want it to be able to click the web app and it works"* → §5
> *"yes / reconcile / merge"* → §6

---

## 2. The headline finding

**The scheduled skill engine had never produced output. Not once.**

GitHub Actions cron is best-effort; on free runners it starts jobs 30 min – 3 h late.
`guardPasses` in `runner.mjs` required an **exact** London-hour match against wall-clock
time at execution. Any delayed run therefore failed the guard, exited 0, skipped the
commit step — and the workflow reported **success**.

Proof, job `30693257169` (scheduled, 2026-08-01):

```
[jarvis] London now: Saturday, 1 August 2026 10:11 (dow=6)
[jarvis] Not the scheduled London time for Morning Brief — nothing to do. (want hour=7)
[jarvis] no write. reason=time-guard
```

Job steps: `Run skill` success · **`Commit and push` skipped** · run conclusion **success**.

All 11 scheduled runs in the API history failed the same way. Provenance of every output
file confirms it — each came from **n8n** (2026-07-07, 07-08) or a **manual
`workflow_dispatch`**:

| File | Committed | Actually produced by |
|---|---|---|
| `briefings/2026-07-07.md`, `07-08` | 07:00 | n8n |
| `briefings/2026-07-09`, `2026-08-01` | 00:43 / 01:22 | manual dispatch |
| `connections/`, `synthesis/`, `patterns.md` | 00:44–01:33 | manual dispatch |

Four briefings existed for a daily skill documented "live" since 2026-07-08. There
should have been ~26.

**Why it hid for three weeks:** the workflow's own skip message said *"A time-guard skip
is expected."* It could not distinguish the intended BST/GMT skip from a delay-induced
one, so every broken run read as normal.

---

## 3. Second finding — `master` lost 8 files mid-session

At 03:47 and 03:50 UTC, two `Sync from Obsidian (Jarvis )` commits (`c9f3d2f`,
`93ed5cb`) deleted 8 files and reverted a ninth, **adding nothing**:

- all five `.github/workflows/*.yml` — the engine's entire schedule
- `repos-manifest.json`, `Work/setup-repos.sh`
- `JARVIS-Carousel/.gitignore` — which ignores `.env`, `.env.local`, `*.pem`
- `Smart Home/_index.md` reverted to a pre-PR-#71/#72 copy, restoring the superseded TV
  entity `tv_jelly_beans_tv_2` that no longer exists in the live registry

**Second occurrence.** `CLAUDE.md`'s change history records the same on 2026-07-27.

All 8 are restored on `master` (verified after merge). **The cause is not fixed** — see
§7 and §8.

---

## 4. What was built — capture first, then the guard

Order was deliberate and Elliot's call: a working schedule over a four-week-stale corpus
manufactures confident, wrong briefings.

### Capture (Skill 2 — the Capture Router)

`Assistant Core/jarvis-skills/runner.mjs` + `.github/workflows/jarvis-2-capture-router.yml`

- `on: push` to `JARVIS/Inbox/**` **and** `Inbox/**`. No loop: the workflow commits with
  `GITHUB_TOKEN`, which by design does not re-trigger workflows; a phone push does.
- **No Groq call.** The rules turned out fully deterministic (tag match + emptiness), so
  they are a written table in code, not a prompt. Cheaper, no quota, no nondeterminism.
- Rule table, first match wins: `1` empty → reject · `2` placeholder → reject ·
  `3` `#belief` → `beliefs.md` · `4` `#decision` → `decisions.md` · `5` **keep**.
- **Rule 5 is load-bearing** — an unclassifiable capture is never dropped.
- Junk is **quarantined** to `JARVIS/Inbox/_rejected/`, never deleted, and reported
  loudly in the job summary.
- **Idempotent** on SHA-1 of capture content, logged in
  `Claude Memory/Account/capture-router-log.md`, plus a `<!-- capture:<id> -->` marker in
  each appended entry so a duplicate cannot occur even if the log is lost. `on: push`
  fires on every commit, so this is not optional.

**The split it fixed:** both copies of `jarvis.js` (`Scripts/`, `JARVIS/scripts/`) fell
back to root `"Inbox"` for any unknown capture kind — a folder the runner never reads.
That stranded 4 captures between 2026-06-19 and now. Fallback is now `JARVIS/Inbox`, the
4 captures are swept in, and the router keeps sweeping legacy arrivals forward
(copy-if-missing, never deletes) so the fix does not depend on a device CI cannot reach.

### The guard

Exact-hour equality → **per-skill period idempotency** (`shouldRun` + `done(ctx)`):
*"has this period's output already been written?"*

| Skill | Period key |
|---|---|
| Morning Brief | `briefings/<london date>.md` exists |
| Connection Finder | `connections/<london date>.md` exists |
| Weekly Synthesis | `synthesis/<ISO week>.md` exists |
| Pattern Detector | `patterns.md` contains `<!-- week:YYYY-Www -->` |

DST-safe (no hour arithmetic), delay-safe (a brief written at 10:00 is still today's
brief), self-healing. The paired BST/GMT crons are now two *attempts* at the same period.
Weekly Synthesis keys on the ISO week and Pattern Detector on a new week marker, so a run
slipping past midnight fills the right slot instead of losing the period.

The misleading log line is gone too: `_jarvis-run-skill.yml` now branches on the reason,
emits `::error::` on failure and `::warning::` on anything unrecognised, and writes a job
summary on every run.

---

## 5. The web app — one tap

Symptom: tapping the home-screen icon gave `ERR_CONNECTION_REFUSED`. Two causes:

1. **The URL had no port.** Chrome prints `localhost:8737 refused to connect` when a port
   is present; the error read just `localhost refused to connect` → port 80.
2. **The icon cannot start anything.** It is a Chrome "Add to Home screen" shortcut.
   `node jarvis-app.mjs` lives only as long as the Termux session that launched it.

Shipped in `jarvis-core` (`scripts/`): `jarvis-serve.sh` (start only if the port is dead,
detached, wake lock), `jarvis-launch.sh` (serve then open; **refuses to open the browser
if the server did not start**, so the real error is visible), `install-launcher.sh`
(writes `~/.shortcuts/JARVIS` + `~/.termux/boot/50-jarvis` as thin wrappers, so `git
pull` updates behaviour with no reinstall).

Three things the installer cannot do and prints instead: install **Termux:Widget**;
install **Termux:Boot** *and open it once*; set **Termux → Battery → Unrestricted**.

---

## 6. What is on `master` now

Merged as `1fd9631` (PR #74). Verified after merge: **6 workflow files present**, and
`repos-manifest.json`, `Work/setup-repos.sh`, `JARVIS-Carousel/.gitignore` all restored.

| Commit | What |
|---|---|
| `29067e7` | The verified audit → `2026-08-02-jarvis-state-of-the-system.md` |
| `a38848c` | Capture router + idempotency guard + 26 tests |
| `e26260d` | Merge master; recover the 8 deleted files |
| `76b89d8` | Second pass — `jarvis-core` + web app audited, two external docs reconciled |
| `c9eec41` | Absorb the external runbook into `CLAUDE.md` (§A–D there) |
| `1fd9631` | **Merge PR #74** |

`jarvis-core` — **PR #1 still OPEN**: `b5ccb47` (launcher), `185de54` (AGENT.md
reconciled: tiers 3–6 ticked, tool table 7 → 13, web app + `database` recorded, a
duplicated/corrupted block repaired). Merging it makes the launcher install on the phone
a plain `git checkout main && git pull`.

### Tests

```
Assistant Core/jarvis-skills/test/local-test.mjs   26 pass, 0 fail   (offline, no key)
jarvis-core  test/tier1-test.mjs                    6 pass, 1 FAIL
jarvis-core  test/tier2-test.mjs                   16 pass, 0 fail
jarvis-core  test/tier6-test.mjs                   23 pass, 0 fail
```

The tier-1 failure is real and known: the 401 mock (`test/tier1-test.mjs:172`) omits
`headers`, which `lib/brain.mjs:226` reads unconditionally. **Production is unaffected** —
a real `fetch` Response always sets it. One-line fixture fix, not yet done.

The guard regression test was **verified to fail against the old guard**, not merely
asserted: temporarily restoring the exact-hour check turns 26/0 into 22/4.

---

## 7. Tried, and what came of it

Recorded so nobody repeats them.

| Tried | Outcome |
|---|---|
| `cat-file -e 93ed5cb` across every clone to find the deleting client | **Inconclusive by construction.** True for any clone that *has* the object, including one that merely fetched it. The Termux clone matched only because it had just pulled. Use `git reflog \| grep "Sync from Obsidian"` instead — only an authoring clone carries it. |
| Reading `.heartbeat-state.json` in the repo as proof the heartbeat stopped | **Wrong.** The file is tracked and the snapshot commit is from the same evening as its last entries. It proves nothing. Read the live copy on the Fold. |
| `Get-ChildItem -Recurse -Filter ".obsidian"` on the PC | Returned nothing — misleading. Needs `-Force` (hidden folders), and OneDrive placeholders are not traversed. Use `%APPDATA%\obsidian\obsidian.json` instead: it is Obsidian's own authoritative vault list. |
| Searching `~` and `/storage/emulated/0` on the Fold for the deleting clone | Found 8 `.obsidian` folders, 3 of them git repos — **none** authored the deletions. Misses the proot-Ubuntu rootfs, which lives under `$PREFIX/var/lib/proot-distro/`, not `~`. |
| Groq classification for the capture router (the original Phase-2 design) | **Rejected.** The rules are deterministic; a prompt would add cost, quota and nondeterminism for nothing. |
| Committing the externally-produced `claude.md` as a second runbook | **Rejected.** Collides with `CLAUDE.md` on Windows/Android. Useful parts folded into `CLAUDE.md` §A–D; the rest was contradicted by observation. |
| Deleting the 21 duplicate captures in root `Inbox/` | **Not done deliberately.** Provably identical, but automated deletion in this vault needs a human yes. The router copies forward and never deletes. |

---

## 8. Current state — verified vs unknown

### Verified working
- Vault integrity: `drift-check` 21/21 clean (S1 0, S2 0); `verify-refs` 68 PASS, 0 S1, 0 S2, 1 S3 (a dangling `[[hardware/ai_cam]]` — the file on disk is `ai_cam.yaml`).
- Skill engine: repaired, 26/26 tests, all 6 workflows on `master`.
- Capture router: runs clean, idempotent across repeated runs, junk quarantined.
- Web app: `STATUS ONLINE`, `TOOLS 10`, six tabs. **`TOOLS 10` is correct** — `/api/tools` (`jarvis-app.mjs:281`) hides the 3 `vault*` tools; 13 − 3 = 10.

### Verified broken or absent
- **Capture is idle.** Newest capture anywhere is 2026-07-09. Nothing has arrived in ~24 days. Do **not** trust a briefing generated from this corpus until something new lands.
- **Tier 4 memory has never stored a fact.** `Claude Memory/Account/jarvis_memory.md` does not exist. The web app shows `MEMORY 0`. Built ≠ used.
- **`jarvis-core` has one commit, dated 2026-07-22.** Nothing pushed in 11 days; on-device work since then exists only on the Fold, unbacked.
- The one red tier-1 test (§6).

### Genuinely unknown — do not assume
- **Whether the heartbeat is still running.** Read `.heartbeat-state.json` **on the Fold**.
- **Which client deleted the 8 files.** Ruled out: the Termux clone, and all three git-backed vaults on the Fold. **The PC has not been checked.**
- Whether anything on the Fold is unpushed since `05778ba`.
- The n8n.cloud account state — only that no n8n-format commit exists after 2026-07-08.
- Live HA hardware — no LAN access; all HA facts come from committed ha-doctor reports.

---

## 9. Next actions, in order

1. **Find the deleting client — highest value.** It was *current* with the remote and still committed absences as deletions, so it will do it again on its next sync and the recovery would have to be redone. On the PC:
   ```powershell
   $j = "$env:APPDATA\obsidian\obsidian.json"
   if (Test-Path $j) { (Get-Content $j -Raw | ConvertFrom-Json).vaults.PSObject.Properties | ForEach-Object { $_.Value.path } } else { "No obsidian.json — Obsidian has never run here." }
   ```
   Then per vault: `.git` present? `.github` absent? Does its reflog contain `Sync from Obsidian`? Disable obsidian-git in every vault except the one intended writer. A live git repo is sitting in `Obsidian Vault/.trash/JB's Vault 2` — 201 dirty files, and `JB's Obs Sync Vault Laptop` is on `master`, three weeks stale, 302 dirty. Neither caused this, but both are set up to.
2. **Fix the Tasker variable at source.** The junk filter is a second line of defence only. Log the variable to a Flash *immediately before* the HTTP Request action — scope at that moment is the usual cause, not the network.
3. **Merge `jarvis-core` PR #1**, then on the Fold: `git checkout main && git pull && sh ~/jarvis-core/scripts/install-launcher.sh`.
4. **Push `jarvis-core` from the Fold** so 11 days of device work stops being a single point of failure.
5. **Prove the memory path** — one deliberate `remember` on the Fold, confirm it reaches `master`.
6. **Finish Phase 2** — retarget Tasker from the n8n webhook to the GitHub Contents API (`MIGRATION.md` → Phase 2, step 1). Until then the paid dependency is live and C1 is unmet.
7. Watch the first real scheduled run. Expect a written brief, or `reason=already-done` — anything else is a regression.

---

## 10. Where to look

| Thing | Path |
|---|---|
| Full evidence for every finding | `Claude Memory/2026-08-02-jarvis-state-of-the-system.md` |
| Open items, ticked and untick | `Claude Memory/Account/capture_queue.md` |
| Layers, commands, escalation, how to read a status claim | `CLAUDE.md` §A–D |
| Skill engine + router | `Assistant Core/jarvis-skills/runner.mjs`, `README.md`, `MIGRATION.md` |
| On-device agent spec | `AGENT.md` in `etblues449/jarvis-core` |
| Operational companion | `JARVIS/HANDOFF.md` |
| Smart home state | `Claude Memory/Projects/Smart Home/_index.md` |

**Health check, read-only, safe any time:**

```bash
bash .claude/skills/vault-integrity-audit/scripts/drift-check.sh .
python3 .claude/skills/qa-boundary-check/scripts/verify-refs.py .
node "Assistant Core/jarvis-skills/test/local-test.mjs"
```

---

## 11. The one habit worth carrying forward

Three states get conflated constantly: **documented**, **merged**, **running**. On
2026-08-02 the skill engine was documented as live, merged, and producing daily output —
and had never once produced output on a schedule.

"Built" is also not "used": Tier 4 memory is wired end-to-end and has never stored a fact.

And numbers deserve the same suspicion as words. Uptime percentages and latency
percentiles have appeared in JARVIS documents for a system with no telemetry that could
produce them. A gap prompts a check; a fabricated number does not.

Before repeating any status claim, name the observation behind it — a job log, a file on
`master`, a test you ran.

---

*Written 2026-08-02, after PR #74 merged as `1fd9631`.*
