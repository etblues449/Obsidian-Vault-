---
name: vault-conventions
description: >-
  The rules of the JARVIS Obsidian vault — canonical paths, file naming, the session start/end
  protocol, the single git write path, and the sensitive-data policy. Load this before reading
  or writing ANY file under Claude Memory/, before committing to etblues449/Obsidian-Vault-,
  before creating a session note or project index, and whenever a task says "commit to the
  vault", "update the index", "log this session", "wrap up", "end session" or "done". Also load
  when re-running or correcting earlier vault work. This is a shared reference for every JARVIS
  agent — it defines where things go, not what to write in them.
when_to_use: >-
  Preloaded background knowledge for every JARVIS agent. Load before touching any file under
  Claude Memory/, before any commit to etblues449/Obsidian-Vault-, and before creating a
  session note or project index. Not a task skill — it defines where things go and how the
  write path works, not what to write.
user-invocable: false
---

# Vault conventions

The vault is JARVIS's state store, not its documentation. Anything written here is read
back later by the skill runner, by other agents, and by future sessions with no memory
of this one. Sloppiness here surfaces weeks later as a confident, wrong answer.

## Repository

```
repo    etblues449/Obsidian-Vault-
branch  master          ← the only branch that matters
remote  https://github.com/etblues449/Obsidian-Vault-.git
```

## Canonical paths

```
Claude Memory/
├── MEMORY.md                          long-term memory; read by Morning Brief + Connection Finder
├── decisions.md                       decision log (#decision captures land here)
├── beliefs.md                         belief log (#belief captures land here)
├── patterns.md                        Pattern Detector output — rolls, newest on top
├── Profile/user_profile.md            who Jelly Bean is
├── Account/capture_queue.md           open items to tick off at session end
├── Projects/<Project>/_index.md       per-project status, decisions, next actions
├── Projects/<Project>/sessions/       YYYY-MM-DD.md session notes
├── briefings/YYYY-MM-DD.md            Morning Brief output
├── connections/YYYY-MM-DD.md          Connection Finder output
├── synthesis/YYYY-Www.md              Weekly Synthesis output
└── conversations/                     archived chat exports

JARVIS/Inbox/                          raw captures land here before classification
Assistant Core/jarvis-skills/          the £0 skill engine
.github/workflows/                     the schedules that trigger it
```

## Naming

- Dated files under `Claude Memory/` use **ISO**: `YYYY-MM-DD.md`. Weekly synthesis uses
  `YYYY-Www.md` (e.g. `2026-W28.md`).
- The vault root contains legacy `DD-MM-YYYY.md` daily notes. Do **not** propagate that
  format into `Claude Memory/` — the runner sorts filenames lexically, and `DD-MM` sorts
  wrong, which silently feeds the wrong "12 newest captures" to Morning Brief.
- Project folder names are human-readable with spaces (`Smart Home`, `Trading Signals`)
  and must be URL-encoded (`%20`) when fetched through the GitHub API.

## Session protocol

**Start.** Read, then explicitly confirm you have read:

1. `Claude Memory/MEMORY.md`
2. `Claude Memory/Profile/user_profile.md`
3. `Claude Memory/Projects/Smart Home/_index.md`
4. `Claude Memory/Projects/Faceless Finance/_index.md`
5. `Claude Memory/Projects/Doc to Learning/_index.md`
6. `Claude Memory/Projects/Other Workspaces/_index.md`
7. `Claude Memory/Account/capture_queue.md`

Report any that are missing **as missing**. Do not synthesise plausible contents to fill
a gap — an invented memory file is indistinguishable from a real one on the next read,
and from then on the system is confidently wrong.

**End** (on "done", "wrap up", "end session"):

1. Update the relevant `Projects/<Project>/_index.md` — status, decisions, next actions.
2. Create `Projects/<Project>/sessions/YYYY-MM-DD.md` — bullet summary.
3. Tick completed items in `Account/capture_queue.md`.
4. Present every changed file before committing.

## The single write path

All vault writes go to `master` through one serialized git path. This is not a style
preference: running a second automated writer (an n8n cloud GitHub-commit node) alongside
`obsidian-git` on `master` is what corrupted this vault previously. Recovery cost a full
session.

So:

- Never introduce a second automated committer.
- Always `git pull --rebase` before committing — the Fold 7 (Termux), the PC, and GitHub
  Actions all write here.
- On a rejected push: pull, rebase, retry **once**. Never force-push; another writer may
  have just landed.
- On a merge conflict inside `Claude Memory/`: preserve both sides with a
  `<!-- conflict: A / B -->` marker, commit nothing, escalate.

## Wikilinks are load-bearing

`[[sessions/2026-07-23-ai-cam-handoff]]` in an index is a real dependency. Before
committing any index, resolve every link target. A dangling link is a defect — do not
delete the link to make it go away, because the link records intent that the missing file
was supposed to satisfy.

## Superseding information

Vault notes accumulate corrections. When a note contains a section headed
**CORRECTION**, **RESOLVED**, or **SUPERSEDES**, that section wins over anything earlier
in the same vault, **including the project index**. The AI Cam audio pin map is the
worked example: the index and an earlier hardware note both carried a pin map that was
wrong; the correction section carries the right one.

Read for corrections before acting on any hardware or config fact.

## Sensitive data

This vault holds real solicitor correspondence, credit-card statements, tenancy
agreements, and income forecasts.

- Never surface, export, summarise, or copy notes tagged `sensitive`, `private`,
  `confidential`, `legal`, or `financial` into briefings, digests, agent messages, or
  any generated output.
- Verifying that such a file *exists* is fine. Reading its contents to do so is not.
- Never write a token, key, or password into a note. Secrets live in a password manager
  or a repository secret, and are referenced by name only.

## GitHub access from constrained environments

Unauthenticated GitHub API calls rate-limit hard (403) from shared-IP environments.
Reliable fallbacks, in order:

1. `git clone --depth 1 -b master <repo>` — no API involved, no rate limit. Best for
   reading more than two files.
2. `raw.githubusercontent.com/<owner>/<repo>/master/<path>` with a `User-Agent` header —
   a separate rate-limit bucket from the API.
3. The Contents API — only for single files, and expect intermittent 403.

Remember to URL-encode spaces in paths (`Claude%20Memory/...`) for options 2 and 3.

## Gotchas

- **A GitHub API 403 reads exactly like a missing file.** Rate-limiting from a shared IP
  returns a body, not an error you'd notice. Recording it as MISSING is the worst false
  positive available here. Clone with `--depth 1` for anything beyond two files.
- **`DD-MM-YYYY.md` sorts wrong.** The runner picks "the 12 newest captures" by lexical
  filename order. Legacy root dailies use `DD-MM-YYYY`; if that format reaches
  `Claude Memory/`, the wrong files silently become "newest".
- **A file can be missing at *both* documented paths.** `capture_queue.md` was absent
  from `Claude Memory/` and `Claude Memory/Account/` simultaneously, while three
  documents each confidently named one of them.
- **Wikilink resolution is asymmetric.** A link containing a slash
  (`[[sessions/2026-06-19]]`) must resolve as a *path*. Only a bare name may fall back
  to a vault-wide basename match. Reversing this makes `[[sessions/2026-06-19]]` silently
  "resolve" to an unrelated `Inbox/Journal/2026-06-19.md`.
- **Project folders contain spaces.** URL-encode as `%20` for API and raw fetches, or the
  request 404s and looks like a deleted file.
