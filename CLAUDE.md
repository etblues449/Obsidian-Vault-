# Claude Session Context — JARVIS / Obsidian Vault

**Last Updated:** 2026-07-27

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

> **Reconciled 2026-07-27.** This list is now identical to the project set that
> `Assistant Core/jarvis-skills/runner.mjs` reads and that `test/local-test.mjs`
> asserts on — those two are authoritative. Previously this list omitted
> **Work Financial Forecasting** and pointed at `Claude Memory/capture_queue.md`
> instead of `Account/`. If the runner's project list changes, change this list and
> `.claude/hooks/session-start.sh` with it.

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

## SENSITIVE DATA

<important if="generating a briefing, digest, summary, export, or any output that aggregates vault content">
This vault holds real legal and financial records — credit-card statements, solicitor
correspondence, tenancy agreements, income forecasts. Never surface, export, summarise or
copy notes tagged `sensitive` / `private` / `confidential` / `legal` / `financial` into
any generated output. Verifying such a file EXISTS is fine; reading its contents to do so
is not. Never write a secret or token into a note — reference it by name only.
</important>

## Device Sync
Reliable remote is the GitHub repo via the Obsidian Git plugin (`https://github.com/etblues449/Obsidian-Vault-.git`). Note: `remotely-save` has been failing — prefer Obsidian Git.

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
scheduled skill engine, and the voice/Home-Assistant layer.

**Trigger:** For work spanning two or more of those layers — building or fixing a
subsystem end-to-end, a full health check, a session start/end, a release, or a
cross-layer follow-up — use the `jarvis-orchestrator` skill. Work confined to one layer
goes to that layer's own skill. Simple lookups need no skill.

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
| 2026-07-27 | Created 7 dangling link targets | `Smart Home/sessions/`, `fixes/`, `smart_home.md` | Index linked to notes that were never committed; stubs carry only index-sourced content |
| 2026-07-27 | Frontmatter upgrade + hardening | `.claude/agents`, `.claude/skills`, `.claude/settings.json` | Adopted `skills:` preloading, `when_to_use`, `user-invocable`, `color`, `maxTurns`, `disallowedTools`; added Gotchas sections; `permissions.deny` now blocks force-push deterministically; PreToolUse hook measures real skill usage. Fixed 6 files whose frontmatter was invalid YAML (unquoted `: ` scalars) and therefore silently never loaded. |
| 2026-07-27 | Kept `webapp-reviewer` unmerged | `.claude/agents/webapp-reviewer.md` | Narrow read-only reviewer frozen to Carousel baseline `d8e5532`; ~15% overlap with `jarvis-integration-qa`. Uses `model: sonnet` vs the harness `opus` standard — left as-is pending a call. |
| 2026-08-03 | Global Claude layer | `Assistant Core/claude-global/` | Issue #77 / PR #78: the harness only applied when cwd was the vault. Installer provisions `~/.claude/` from the vault (symlink by default, marked block in `CLAUDE.md`, exact-manifest uninstall) so the standards, 2 skills and 4 `/jarvis:` commands load in every session on every device. 63 offline tests. PR #78's bundle was **not merged** — its skill file was fence-wrapped with no frontmatter (would never load) and its naming/import/test/commit claims did not match the tree; corrections carried inline in `obsidian-vault-patterns`. |
