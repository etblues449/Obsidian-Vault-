---
name: obsidian-vault-patterns
description: >-
  Code and commit conventions for the etblues449/Obsidian-Vault- repository — module style,
  file naming, the zero-dependency rule, how tests are written and run, commit message shape,
  and the recurring engineering workflows (skill-engine change, HA diagnostics, sync-delete
  recovery, system audit). Load before writing or reviewing code, tests, workflow YAML or
  commits in this repository, from any working directory. Corrected and re-verified against
  the working tree — supersedes the auto-generated ECC bundle in PR #78, whose naming, import,
  export and test-pattern claims did not match the repo.
when_to_use: >-
  Load when the task touches code, tests, workflow YAML or commits in the JARVIS vault repo.
  For vault paths, the session protocol and the git write path, load jarvis-vault-access
  instead — this skill is about how the code is written, not where the notes go.
user-invocable: true
---

# Obsidian-Vault- code and workflow patterns

Derived from ECC Tools' analysis of issue #77, then **re-verified line by line against the
working tree**. Several of the generated claims were wrong; the corrections are marked below so
the mistake is not silently re-introduced by a future regeneration.

## Module conventions

The engine code is **ESM, zero-dependency, Node built-ins only**. There is no `package.json` for
`Assistant Core/` — that is deliberate, not an oversight. It is what lets a GitHub Actions job
run the engine with no install step, which is part of the £0 constraint (C1).

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
```

- Always use the **`node:` prefix** for built-ins. Every import in `runner.mjs`, `ha-doctor.mjs`
  and `local-test.mjs` does.
- Adding an npm dependency to the engine is an architectural change, not a convenience — it
  breaks the no-install property. Say so before doing it.
- `.mjs` for engine code (`runner.mjs`, `ha-doctor.mjs`, `local-test.mjs`); `.js` for the
  Obsidian-side scripts under `Scripts/` and `JARVIS/scripts/`, which run inside Obsidian.

> **Corrected:** the generated bundle claimed "relative imports" and "mixed named/default
> exports". Neither holds. `runner.mjs` and `ha-doctor.mjs` are CLI entry points that export
> **nothing** and import **only** `node:` built-ins. `local-test.mjs` reaches the runner by
> spawning it through `execFileSync`, not by importing it.

## File naming

- Engine and script files: **kebab-case** (`ha-doctor.mjs`, `local-test.mjs`, `unified-backend.js`)
  or **snake_case** for the older Obsidian scripts (`jarvis_ask.js`, `jarvis_digest.js`).
- Workflow YAML: `jarvis-<n>-<name>.yml`, numbered by skill, plus the leading-underscore
  reusable job `_jarvis-run-skill.yml`.
- Vault notes: see `jarvis-vault-access`.

> **Corrected:** the generated bundle claimed camelCase file naming and cited `localTest.mjs`.
> No camelCase filename exists in the repo and `localTest.mjs` does not exist — the file is
> `Assistant Core/jarvis-skills/test/local-test.mjs`.

## Tests

One offline harness: `Assistant Core/jarvis-skills/test/local-test.mjs`.

```bash
node "Assistant Core/jarvis-skills/test/local-test.mjs"
```

It runs with **no network and no Groq key**, driving `runner.mjs --dry-run` against a throwaway
fixture vault built from the real one. There is no test framework, no watcher and no
`*.test.*` convention — a test is a plain Node script that exits non-zero on failure.

When you change the engine, extend this harness in the same commit. The strongest form is a
**regression test that provably fails on the old behaviour and passes on the new** — that is how
the exact-hour schedule guard fix was validated on 2026-08-02.

Read-only checkers, safe to run at any time:

```bash
bash .claude/skills/vault-integrity-audit/scripts/drift-check.sh .
python3 .claude/skills/qa-boundary-check/scripts/verify-refs.py .
```

> **Corrected:** the generated bundle claimed tests follow `*.test.*`. Nothing in the repo
> matches that glob. It also listed `**/*.test.*` and `**/api/**` as the "common files" for
> feature work; the first matches nothing, and `api/` exists only in `JARVIS-Carousel/app/api/`
> and the Android module tree, neither of which is where feature work usually lands.

## Commits

Freeform, sentence-case, imperative, **no conventional-commit prefixes** (`feat:`/`chore:` do
not appear). A colon-scoped prefix naming the subsystem is common:

```
Fix capture, then the schedule guard: idempotency replaces exact-hour equality
ha-doctor: remote mode (Nabu Casa) — skip LAN probes honestly instead of reporting false downs
Smart Home index: AI Cam COMPLETE — mics + wake word + ES7210 component
```

Subject lines run long by design — they state the outcome, not the file touched. Measured over
the 69 commits available in a shallow clone, the mean subject is **~78 characters**, and ~79 for
human-authored commits once the automated `Sync from Obsidian` and `JARVIS Skill N:` commits are
excluded.

> **Corrected:** the generated bundle recommended "moderate-length commit messages (~57
> characters)". That average is dragged down by machine-generated sync commits and does not
> describe the human convention. Do not truncate a subject line to hit it.

Two commit families are machine-written — never imitate or hand-edit them:
`Sync from Obsidian (Jarvis ): <ts> — N+ N~ N-` (obsidian-git) and
`JARVIS Skill N: <output> (automated · GitHub Actions + Groq)` (the skill engine).

## Recurring workflows

Each has a matching global slash command, installed alongside this skill.

| Workflow | Command | What it touches |
|---|---|---|
| Add or change a scheduled skill | `/jarvis:skill-update` | `.github/workflows/jarvis-*.yml`, `runner.mjs`, `local-test.mjs`, `README.md`/`MIGRATION.md` |
| Run HA diagnostics and propagate the findings | `/jarvis:ha-diagnostics` | `ha-doctor.mjs`, `Smart Home/diagnostics/`, dashboard YAML, `_index.md` |
| Recover files a stale Obsidian sync deleted | `/jarvis:sync-recovery` | `.github/workflows/`, manifests, setup scripts |
| Reconcile documents against reality | `/jarvis:audit` | state-of-the-system notes, `capture_queue.md`, `_index.md`, `CLAUDE.md` |

Two further patterns ECC detected are real but need no command of their own: **post-merge
propagation** (a PR landing a Smart Home or skill-engine change is normally followed by a commit
pushing the canonical decision out into the indexes, dashboard and runbooks — budget for it in
the same session) and **Android client work**, which is already covered by the repo's own
`android-development` skill.

## Gotchas

- **Paths contain spaces.** `Assistant Core/`, `Claude Memory/`, `Mini Notes/`. Quote every path
  in shell and in YAML `run:` blocks.
- **Two copies of the Obsidian scripts exist** — `Scripts/` and `JARVIS/scripts/`. A fix applied
  to one and not the other is a live bug class here: the `|| "Inbox"` capture fallback had to be
  fixed in both. Grep for the symbol before assuming one copy.
- **A green Actions run is not proof of output.** The engine exits 0 when it decides not to run.
  Confirm the commit, not the check mark.
- **The engine is idempotent by period, not by clock time.** It asks "has this period's output
  already been written?" — do not reintroduce an exact-hour equality guard; that bug silently
  produced eleven green runs that wrote nothing.
