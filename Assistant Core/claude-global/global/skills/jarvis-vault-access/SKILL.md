---
name: jarvis-vault-access
description: >-
  Locate and safely work with the JARVIS Obsidian vault (etblues449/Obsidian-Vault-) from ANY
  directory on any device — PC, Fold 7 / Termux, or a remote container. Load when a task
  mentions the vault, JARVIS memory, Claude Memory/, a capture, a session note, a project
  index, MEMORY.md, capture_queue, briefings, or asks to "remember", "log this session",
  "wrap up" or "end session" — and the current working directory is NOT the vault. Covers
  canonical paths, the session start/end protocol, the single serialized git write path, and
  the sensitive-data policy. It tells you where things go and how to write them safely, not
  what to write in them.
when_to_use: >-
  Load whenever vault content is in scope but the session did not start inside the vault. If
  the working directory IS the vault, use the vault's own .claude/skills/vault-conventions
  instead — it is the authoritative copy and this skill defers to it.
user-invocable: true
---

# JARVIS vault access

The vault is not documentation *about* JARVIS — the vault **is** JARVIS's memory. Its contents
are read back later by the skill runner, by other agents, and by future sessions with no
recollection of this one. Sloppiness here surfaces weeks later as a confident, wrong answer.

## Finding the vault

The install-time path is recorded in the `jarvis-global` block of your global `CLAUDE.md`
(`~/.claude/CLAUDE.md`). Read it there rather than guessing. If that block is absent, or the
path no longer exists, the vault has moved or was never installed on this device — say so and
stop. Do **not** clone a second copy to work around it; a second working copy is how the
duplicate-writer corruption happens.

Remote: `https://github.com/etblues449/Obsidian-Vault-`, branch `master`. There is no `main`.

## Canonical paths

| Path | What it is |
|---|---|
| `Claude Memory/MEMORY.md` | Long-term memory. Read by Morning Brief (skill 1) and Connection Finder (skill 3), capped at 6000 chars — highest-signal content goes at the top, the tail is what gets truncated. |
| `Claude Memory/Profile/user_profile.md` | Identity, working preferences, devices. |
| `Claude Memory/Projects/<Project>/_index.md` | Per-project status, decisions, next actions. |
| `Claude Memory/Projects/<Project>/sessions/YYYY-MM-DD.md` | Session notes. |
| `Claude Memory/Account/capture_queue.md` | Open items. **`Account/` is canonical** — an older `Claude Memory/capture_queue.md` path appears in stale docs and is wrong. |
| `Claude Memory/briefings/`, `connections/`, `synthesis/`, `patterns.md` | Skill-engine output. Generated — do not hand-edit. |
| `JARVIS/Inbox/` | The capture inbox the engine reads. A legacy root `Inbox/` also exists; the capture router sweeps it forward. |
| `Assistant Core/jarvis-skills/runner.mjs` | The scheduled skill engine. |
| `.github/workflows/jarvis-*.yml` | One workflow per skill, plus the `_jarvis-run-skill.yml` reusable job. |

The project set the engine reads is **seven**: Smart Home, Faceless Finance, Doc to Learning,
Work Financial Forecasting, Other Workspaces (plus `MEMORY.md` and `user_profile.md`).
`runner.mjs` and `Assistant Core/jarvis-skills/test/local-test.mjs` are authoritative for that
list; the vault `CLAUDE.md` and `.claude/hooks/session-start.sh` must agree with them. Trading
Signals has an index but is deliberately **not** read by the engine.

## Session protocol

**Start** (when working inside the vault): read `MEMORY.md`, `Profile/user_profile.md`, the five
project `_index.md` files, and `Account/capture_queue.md`, then confirm they are read before
doing anything else. If one is missing or unreadable, report it as **MISSING** — never
reconstruct it from plausible-sounding content.

**End** (on "done", "wrap up", "end session"): update the relevant project `_index.md` (status,
decisions, next actions), create `Claude Memory/Projects/<Project>/sessions/YYYY-MM-DD.md` as a
bullet summary, tick completed items in `Account/capture_queue.md`, then present every changed
file for review before committing.

## The write path

One branch, `master`, one serialized writer. A second automated committer (the n8n GitHub-commit
node running alongside obsidian-git) corrupted this vault once and recovery cost a full session.

- Always `git pull --rebase` before writing. The PC, the Fold 7 and GitHub Actions all push here.
- **Never force-push.** The vault's `.claude/settings.json` denies it deterministically; do not
  route around that.
- Never add a second automated committer.
- Obsidian Git is the reliable sync path. `remotely-save` has been failing — do not rely on it.

An Obsidian sync from a stale working copy has silently deleted committed files before
(`9fd5e00`, 2026-07-14, removed five `.github/workflows/*.yml`). After any "Sync from Obsidian"
commit, check `git show --diff-filter=D --name-only` before building on top of it.

## Sensitive data

Notes tagged `sensitive`, `private`, `confidential`, `legal` or `financial` hold real solicitor
correspondence, credit-card statements, tenancy agreements and income forecasts. Never surface,
export, summarise or copy them into a briefing, digest, export or any other generated output.
Verifying such a file **exists** is fine; reading its contents to do so is not. Never write a
secret or token into a note — reference it by name only.

## Gotchas

- **Documented ≠ merged ≠ running.** A README describing five workflows proves nothing about
  `.github/workflows/`. Check the branch, then check the run.
- **Silent failures outrank loud ones.** A crash gets fixed; a briefing built on a missing source
  gets believed. Treat an unexplained "skipped" as a failure until proven otherwise.
- **A 403 is not a missing file.** The GitHub API rate-limits from shared IPs. Use
  `git clone --depth 1` for bulk reads, or `raw.githubusercontent.com` with a `User-Agent`.
- **Paths contain spaces** (`Assistant Core/`, `Claude Memory/`). Quote every path in shell.
- **Case collision.** `claude.md` and `CLAUDE.md` are the same file on Windows and Android. Never
  create both.
