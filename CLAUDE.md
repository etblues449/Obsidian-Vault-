# Claude Session Context — JARVIS / Obsidian Vault

**Last Updated:** 2026-09-04

This vault is the persistent memory and working directory for all Claude sessions across devices (PC, Fold 7 / Termux, Claudian-in-Obsidian). All code, notes, decisions and artifacts live here.

## Who / What
Jelly Bean (Elliot Horton) — UK supported-living professional (Select Lifestyles). Active projects:
- **Smart Home / JARVIS** — HA Green + ESP32 + on-device agentic layer on the Fold 7
- **Faceless Finance** — CA-credentialed faceless YouTube channel (Wed/Fri/Sun, Wed 4PM priority)
- **Doc to Learning** — single-file HTML doc→learning app on the Anthropic API
- **Work Financial Forecasting** — Select Lifestyles income forecast (.xlsm); Claude acts as financial director
- **Trading Signals** — has its own `_index.md`; not read by the skill engine

## SESSION START (mandatory — do before any task)
Read these, then confirm they are read before proceeding:
1. `Claude Memory/MEMORY.md`
2. `Claude Memory/Profile/user_profile.md`
3. `Claude Memory/Projects/Smart Home/_index.md`
4. `Claude Memory/Projects/Faceless Finance/_index.md`
5. `Claude Memory/Projects/Doc to Learning/_index.md`
6. `Claude Memory/Projects/Work Financial Forecasting/_index.md`
7. `Claude Memory/Projects/Other Workspaces/_index.md`
8. `Claude Memory/Account/capture_queue.md`

> **Reconciled 2026-07-27.** This list is identical to the project set that
> `Assistant Core/jarvis-skills/runner.mjs` reads and that `test/local-test.mjs`
> asserts on — those two are authoritative. If the runner's project list changes,
> change this list and `.claude/hooks/session-start.sh` with it.

<important if="a mandatory session-start file is missing or unreadable">
Report it as MISSING. Never synthesise plausible contents to fill the gap. An invented
memory file is indistinguishable from a real one on the next read, and from that point
the system is confidently wrong with no way to detect it.
</important>

## SESSION END (on "done" / "wrap up" / "end session")
1. Update the relevant `Claude Memory/Projects/[Project]/_index.md` — status, decisions, next actions.
2. Create `Claude Memory/Projects/[Project]/sessions/YYYY-MM-DD.md` — bullet summary.
3. Tick completed items in `Claude Memory/Account/capture_queue.md`.
4. Present all changed files for review/commit.

## DELIVERY STANDARD

<important if="about to report work as done, or tempted to defer part of a task">
Never report a status you have not observed. "Documented", "merged" and "running" are
three different states — say which one you actually verified. Never present a workaround
when the real fix is reachable, and never make a check pass by weakening the check.
</important>

The marginal cost of completeness is near zero. Do the whole thing — with tests and docs. Ship the finished solution, not a plan. Rewrite full files for easy copy/paste. Never present a workaround when the real fix exists. One step at a time, each finished before the next.

<important if="a project document says a component is broken, missing, or unfinished">
Verify against the code or the live system before acting on it. A stale doc claiming
something is BROKEN costs exactly as much as one claiming it works — on 2026-09-04 a
July handoff described a working tool as a stub and half a session went into rebuilding
it. Read the repo before writing code for it.
</important>

## SENSITIVE DATA

<important if="generating a briefing, digest, summary, export, or any output that aggregates vault content">
This vault holds real legal and financial records — credit-card statements, solicitor
correspondence, tenancy agreements, income forecasts. Never surface, export, summarise or
copy notes tagged `sensitive` / `private` / `confidential` / `legal` / `financial` into
any generated output. Verifying such a file EXISTS is fine; reading its contents to do so
is not. Never write a secret or token into a note — reference it by name only.
</important>

## Device Sync
Reliable remote is the GitHub repo via the Obsidian Git plugin (`https://github.com/etblues449/Obsidian-Vault-.git`). SSH remote: `git@github.com:etblues449/Obsidian-Vault-.git` — use SSH from Termux (key at `~/.ssh/id_ed25519`). HTTPS PAT cannot push `.github/workflows/` without workflow scope; SSH sidesteps this entirely.

The phone app is a **separate repo**: `etblues449/jarvis-core`, branch **`main`** (the vault is `master`). Mixing the two branches up is how a push lands in the wrong place.

<important if="adding any automated process that writes to the vault or pushes to master">
There is exactly ONE write path: `master`, one serialized writer. Running a second
automated committer (the n8n GitHub-commit node alongside obsidian-git) corrupted this
vault once and recovery cost a full session. Never add another writer. Never force-push —
`permissions.deny` in `.claude/settings.json` blocks it deterministically. Always
`git pull --rebase` first; the Fold 7, the PC and GitHub Actions all write here.
</important>

---

## Harness: JARVIS

**Goal:** Keep JARVIS truthful and working end-to-end — vault state, capture path,
scheduled skill engine, the phone codebase, and the voice/Home-Assistant layer.

**Trigger:** For work spanning two or more of those layers — building or fixing a
subsystem end-to-end, a full health check, a session start/end, a release, or a
cross-layer follow-up — use the `jarvis-orchestrator` skill. Work confined to one layer
goes to that layer's own skill: `capture-pipeline`, `skill-engine-ops`, `jarvis-core-dev`
(the phone app at `~/jarvis-core`), `vault-integrity-audit`, `voice-satellite-ops`.
Simple lookups need no skill.

**Health check (read-only, safe any time):**

```bash
bash .claude/skills/vault-integrity-audit/scripts/drift-check.sh .
python3 .claude/skills/qa-boundary-check/scripts/verify-refs.py .
```

**Change history:**

| Date | Change | Target | Reason |
|------|--------|--------|--------|
| 2026-07-27 | Initial harness | 5 agents, 7 skills, orchestrator | No skills existed; `.claude/agents/` held only `webapp-reviewer` |
| 2026-07-27 | Drift repair | `Claude Memory/` seeds, `.github/workflows/` | Audit found 26 S1 boundary failures — runner inputs and all 5 workflows absent from `master` |
| 2026-07-27 | Reconciled session-start list | this file, `.claude/hooks/session-start.sh` | Both disagreed with `runner.mjs` + `local-test.mjs`: omitted Work Financial Forecasting, wrong `capture_queue.md` path |
| 2026-07-27 | Created 7 dangling link targets | `Smart Home/sessions/`, `fixes/`, `smart_home.md` | Index linked to notes that were never committed |
| 2026-07-27 | Frontmatter upgrade + hardening | `.claude/agents`, `.claude/skills`, `.claude/settings.json` | `skills:` preloading, `when_to_use`, `color`, `maxTurns`, `disallowedTools`; Gotchas sections; force-push blocked in `permissions.deny`; skill-usage.py PreToolUse hook; fixed 6 invalid YAML frontmatter files |
| 2026-07-27 | Kept `webapp-reviewer` unmerged | `.claude/agents/webapp-reviewer.md` | Read-only reviewer frozen to Carousel baseline `d8e5532`; `model: sonnet` vs harness `opus` standard — left pending a decision |
| 2026-08-02 | DST guard bug fixed | `runner.mjs`, `_jarvis-run-skill.yml` | Exact-hour London guard caused all 11 scheduled runs to exit 0 silently with nothing written. Replaced with period idempotency (`shouldRun`/`done(ctx)`). 26/26 tests green. |
| 2026-08-02 | Capture router built | `.github/workflows/jarvis-2-capture-router.yml` | Phase-2 capture router: `on: push`, junk quarantine, SHA-1 idempotency, `#belief`/`#decision` routing, legacy Inbox sweep |
| 2026-08-02 | Capture split fixed | `JARVIS/Inbox/`, `Scripts/jarvis.js` | 4 captures were invisible to the engine (landed in root `Inbox/` not `JARVIS/Inbox/`). Swept in; fallback path fixed in both copies of `jarvis.js` |
| 2026-08-04 | MASTER_PLAN v2 + full-home diagnosis | `Smart Home/MASTER_PLAN.md`, `diagnostics/2026-08-04-full-home-diagnosis.md` | Estate re-baselined; ranked P0–P3 repair queue; camera transcript root-caused |
| 2026-08-06 | `jarvis-core` pushed to GitHub | `etblues449/jarvis-core` branch `main` | 15 days of on-device work was unbacked (last push 2026-07-22) |
| 2026-08-06 | `jarvis-android` scaffolded | `jarvis-android/` in vault | Kotlin/Compose multi-module skeleton; scaffold only, no implementation |
| 2026-08-06 | `VAULT_PATH` fixed | `~/jarvis-core/.env` | Pointed at non-existent laptop sync path; `remember` tool wrote nothing. Now `/data/data/com.termux/files/home/Obsidian-Vault-`. `jarvis_memory.md` written for first time. |
| 2026-08-06 | 3 agents updated | `jarvis-voice-ha`, `jarvis-skill-engine`, `jarvis-capture-engineer` | Ground truth 10 days stale: AI Cam complete, mWW regressed, TV entity changed, DST guard was a bug, capture router built |
| 2026-08-06 | SSH auth on vault + jarvis-core | `~/.ssh/id_ed25519` on Fold | HTTPS PAT blocked pushing `.github/workflows/`; SSH sidesteps workflow scope entirely |
| 2026-08-22 | JARVIS v2 UI + auto-start built | `jarvis2/` package (for `~/jarvis-core` on the Fold), `~/.termux/boot/jarvis-boot` | Two product failures: app required typing into Termux to start; six-tab UI was "busy". Rebuilt to the 2026 voice-UI convergence (single screen, live transcript, reactor control, one sheet); zero-dep launcher on :1875 proxies + auto-spawns jarvis-app.mjs; Termux:Boot + PWA install. 32/32 offline assertions; on-device smoke test is the open gate. Harness Phase-0 audit this session: agents/skills/orchestrator consistent; `webapp-reviewer` decision still pending. |
| 2026-09-04 | `jarvis-core-dev` skill added | `.claude/skills/jarvis-core-dev/` | The phone codebase (`~/jarvis-core` — `lib/`, `tools/`, `jarvis-app.mjs`, `test/`) had **no owner** in the harness. A full session's work on it ran unharnessed. Added as a skill rather than a sixth agent, respecting the orchestrator's own five-agent cap; `jarvis-skill-engine` carries the "who". |
| 2026-09-04 | Orchestrator: retired entity + routing | `.claude/skills/jarvis-orchestrator/SKILL.md` | Its error-flow worked example cited `media_player.tv_jelly_beans_tv_2`, confirmed non-existent 2026-09-01 — a harness teaching a dead ID propagates it. Now uses canonical `jelly_beans_tv_3` and names the retired one as a trap. Description/`when_to_use` also route phone-app work to `jarvis-core-dev`. |
| 2026-09-04 | `skill-engine-ops` de-staled | `.claude/skills/skill-engine-ops/SKILL.md` | Two false claims: it named `llama-3.3-70b-versatile` as the live model (Groq retired it 2026-08-16; 25/25 runs failed for 27 days) and stated `.github/workflows/` does not exist on `master` (restored 2026-08-23). Added the obsidian-git dotfolder root cause, the untracked pre-commit hook, and model retirement as a first-class failure mode. |
| 2026-09-04 | `android-development` — no change | `.claude/skills/android-development/` | Audited as suspected orphan; **finding withdrawn.** Its README documents it as a deliberate placeholder keeping the path tracked, because it was previously a gitlink with no `.gitmodules` and broke the Vercel clone. Removing it would risk reintroducing that. |
