# Global Claude integration

Makes the vault's operating context, skills and commands available in **every Claude Code
session on a device, in every directory** — not only when the working directory happens to be
the vault.

Origin: issue #77 ran ECC Tools over the repo, which opened PR #78 with a repo-local bundle.
This directory is the global, corrected version of that. What changed and why is in
[What happened to PR #78](#what-happened-to-pr-78).

## Install

```bash
bash "Assistant Core/claude-global/install.sh"                 # standard
bash "Assistant Core/claude-global/install.sh" --dry-run       # see the plan first
bash "Assistant Core/claude-global/install.sh" --profile=full  # + agents and vault skills
```

Start a new Claude Code session afterwards — the global layer is read at session start.

| Profile | Installs |
|---|---|
| `minimal` | the `jarvis-global` block in `~/.claude/CLAUDE.md` |
| `standard` *(default)* | + `jarvis-vault-access` and `obsidian-vault-patterns` skills, and the four `/jarvis:` commands |
| `full` | + the five `jarvis-*` agents and the vault's `.claude/skills/` harness |

Other flags: `--copy` (no symlinks), `--link` (fail rather than fall back to copying),
`--dest=PATH`, `--force` (back up and replace a conflicting file), `--uninstall`, `--help`.

## What lands where

```
~/.claude/
├── CLAUDE.md                          managed block only — your own content is preserved
├── skills/
│   ├── jarvis-vault-access/           find and safely use the vault from any directory
│   └── obsidian-vault-patterns/       this repo's code, test and commit conventions
├── commands/jarvis/                   /jarvis:skill-update, :ha-diagnostics, :sync-recovery, :audit
├── agents/jarvis-*.md                 full profile only
└── .jarvis-global-manifest            exactly what was installed, for a clean uninstall
```

Commands are namespaced under `jarvis/` so they appear as `/jarvis:audit` rather than colliding
with a project's own `/audit` in some unrelated repo.

## How it behaves

**Symlinks by default.** Each item points back into the vault, so `git pull` updates the global
layer with no reinstall. Where symlinks are unavailable — Windows without Developer Mode, some
Android storage backends — the installer falls back to copying automatically, and `--copy`
forces it. Copies do **not** live-update; re-run the installer after a pull.

**Your `~/.claude/CLAUDE.md` is not overwritten.** The vault's content goes in a marked block:

```
<!-- BEGIN jarvis-global -->
...
<!-- END jarvis-global -->
```

Anything outside the markers is left exactly as it was. Re-running replaces the block in place
rather than appending a second copy, and `--uninstall` removes the block and leaves the rest.

**Nothing is clobbered silently.** If a target exists and this installer did not create it, the
run aborts and names the file. `--force` backs it up to `<name>.bak-<timestamp>` first.

**Reinstall is idempotent, and downgrades clean up.** Every run reads the previous manifest,
removes what it installed, then installs fresh. Going `full` → `standard` actually removes the
agents rather than leaving orphans behind.

**`~/.claude/settings.json` is deliberately untouched.** It holds device-local permissions and
hooks. Blind-merging JSON into it is how you break a device, and the vault's own
`.claude/settings.json` — including the force-push denial — already applies whenever you work
inside the vault. If you want a global permission, edit that file yourself.

## Editing

Edit the source in this directory and re-run the installer (or nothing at all, if you are on
symlinks — the change is live). Never edit `~/.claude/skills/jarvis-vault-access/` directly: on
symlink installs you are editing the vault through a link and will get an uncommitted change in
`git status`; on copy installs your edit is lost at the next install.

## Tests

```bash
bash "Assistant Core/claude-global/test/install-test.sh"
```

63 assertions, fully offline, against throwaway `--dest` directories. Never reads or writes the
real `~/.claude`. Covers dry-run, the installed tree, symlink resolution, idempotency,
CLAUDE.md block insert/refresh/remove with user content preserved, foreign-file refusal and
`--force` backup, `--copy`, all three profiles, profile downgrade cleanup, and argument
validation.

It also validates every shipped skill and command for loadable YAML frontmatter, with a
**negative control** that asserts the validator rejects the fenced, frontmatter-less shape PR
#78 shipped. Without that control a green suite would prove nothing about the check itself.

## What happened to PR #78

The ECC bundle was generated from git history, and several of its claims did not survive a check
against the working tree. It is left open and unmerged; the corrections are carried here and are
recorded inline in `global/skills/obsidian-vault-patterns/SKILL.md` so a future regeneration does
not quietly reintroduce them.

| ECC claim | Reality |
|---|---|
| `.claude/skills/Obsidian-Vault-/SKILL.md` is a skill | The whole file is wrapped in a ` ```markdown ` fence with **no YAML frontmatter**. It would never load, and would fail silently — the same failure that hit six harness files on 2026-07-27. Both copies are affected. |
| camelCase file naming; cites `localTest.mjs` | No camelCase filename exists in the repo. The file is `local-test.mjs`; naming is kebab-case or snake_case. |
| Relative imports, mixed named/default exports | `runner.mjs` and `ha-doctor.mjs` export nothing and import only `node:` built-ins. `local-test.mjs` spawns the runner via `execFileSync`. |
| Tests follow `*.test.*` | Nothing in the repo matches that glob. There is one harness, `local-test.mjs`, and no test framework. |
| Feature work touches `**/*.test.*` and `**/api/**` | The first matches nothing; `api/` exists only under `JARVIS-Carousel/app/api/` and the Android module tree. |
| Commit messages ~57 characters | ~78 across the 69 commits available in a shallow clone, ~79 excluding machine-generated sync and skill commits. The 57 average is dragged down by automated commits. |
| Documents `/add-skill`, `/run-diagnostics`, `/merge-pr`, `/scaffold-android-client`, `/recover-sync-deletes`, `/audit-system` | None of the six existed. Three command files shipped, under different names. |

Deliberately **not** carried over:

- `.codex/*` — Codex configuration, not Claude, and its MCP baseline would add six `npx`-fetched
  servers plus a remote endpoint to every session. That is a tooling decision to make on its own
  merits, not a side effect of this.
- `.claude/identity.json`, `.claude/team/`, `.claude/research/` — ECC-ecosystem files with no
  meaning to Claude Code itself. `identity.json` also described a single-domain JavaScript
  repository, which is not what this vault is.
- `.claude/homunculus/instincts/` — 604 lines requiring the `continuous-learning-v2` skill, and
  seeded with the same camelCase and commit-length claims corrected above.

Two ECC findings were worth keeping and are reflected in the commands: the **sync-delete
recovery** workflow, which is real (commit `9fd5e00`, 2026-07-14, removed five workflow files),
and the **post-merge propagation** pattern, where a landed Smart Home or skill-engine PR is
normally followed by a commit pushing the canonical decision out into the indexes and runbooks.

## Devices

The installer resolves the vault path from its own location, so it works unchanged on the PC,
the Fold 7 under Termux, and any fresh clone. Run it once per device, after cloning. Remote
containers are ephemeral — `~/.claude` there does not survive the session, which is exactly why
the source of truth lives in the vault and the installer is idempotent.
