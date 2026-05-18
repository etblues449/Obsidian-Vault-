# VexJoy Agent — install on phone

[VexJoy Agent](https://github.com/notque/vexjoy-agent) is a heavy toolkit
for Claude Code: 44 domain agents, 106 workflow skills, 71 hooks, 93
scripts, plus an anti-rationalisation pipeline that blocks Claude from
skipping verification steps. It adds a `/do` slash command that routes
tasks through ROUTE → PLAN → EXECUTE → VERIFY → DELIVER → LEARN with
gates that require evidence (exit codes) rather than assertions.

## Why install it

- **Anti-rationalisation gates** — Claude can't "looks correct, skip
  tests" because a hook blocks completion without test output.
- **Domain agents** — Go, Python, debugging, etc. — auto-routed by the
  `/do` command.
- **Skills** — encoded methodologies (systematic debugging, refactoring
  protocols, etc.) that fire as part of the pipeline.

## When NOT to install it

- If you mostly chat / draft notes rather than write code, the overhead
  isn't worth it. Hooks fire on every tool call.
- If your workflows are quick single-file edits — VexJoy targets full
  pipelines, not snippets.
- If you don't want Claude's behaviour modified globally (it installs
  into `~/.claude/` and applies everywhere).

## Install on the phone

Prerequisite: you've already run `scripts/install-claude-code-android.sh`
and `claude` works inside proot-Ubuntu.

In **Termux** (not inside Ubuntu):

```bash
cd "$OBSIDIAN_VAULT"          # or: cd ~/storage/shared/Documents/Obsidian-Vault-
git pull origin claude/github-claude-code-integration-g8mhE
bash scripts/install-vexjoy-on-android.sh
```

What the script does:

1. Verifies prereqs (Termux, proot-distro ubuntu, claude inside ubuntu).
2. Enters proot-Ubuntu.
3. Installs Python 3 + pip (if missing — VexJoy needs 3.10+).
4. **Backs up `/root/.claude` to `/root/.claude.pre-vexjoy.bak`** before
   anything is touched. (VexJoy's installer defaults to `--force` and
   modifies `settings.json`.)
5. Clones `notque/vexjoy-agent` to `/root/vexjoy-agent` (or `git pull`s
   if already there).
6. Runs `./install.sh --symlink` — symlinks `agents/`, `skills/`,
   `hooks/`, `commands/`, `scripts/` from the clone into `/root/.claude/`.
   Live updates via `git pull` in the clone.
7. Smoke-checks that `/root/.claude/commands/` exists.

## Verify it's working

```bash
claude-vault
```

Inside Claude, type:

```
/do
```

You should see the VexJoy routing kick in. (If `/` shows a long list of
commands, look for `/do` and other VexJoy-added commands among them.)

## Uninstall / rollback

Two options:

```bash
# Clean uninstall via VexJoy's own installer:
proot-distro login ubuntu -- bash -lc 'cd /root/vexjoy-agent && bash install.sh --uninstall'

# Full revert from the backup the install script made:
proot-distro login ubuntu -- bash -lc '
    rm -rf /root/.claude
    mv /root/.claude.pre-vexjoy.bak /root/.claude
'
```

## Updating

Symlink mode means `git pull` updates everything live:

```bash
proot-distro login ubuntu -- bash -lc 'cd /root/vexjoy-agent && git pull'
```

Next `claude` session picks up the new agents/skills/hooks immediately.

## Why this is not committed inside the vault

VexJoy is ~hundreds of code files (Python, shell, JSON, MD). Cloning it
into the vault would:

- Inflate the git repo by ~50 MB
- Cause Obsidian to index every README/CHANGELOG as a note
- Pin the vault to a specific VexJoy commit (sync would create merge
  conflicts when VexJoy updates upstream)

Instead: the **install script and this doc** live in the vault. The
**actual code** lives at `~/vexjoy-agent/` inside proot-Ubuntu on each
device.

## Caveats

- **Hooks fire on every tool call.** If Claude feels noticeably slower or
  more chatty after install, this is why. Uninstall to compare.
- VexJoy modifies `~/.claude/settings.json` to wire in its hooks. The
  install script's backup preserves your original.
- The upstream installer also mirrors into `~/.codex/`, `~/.gemini/`,
  `~/.factory/`. You don't have those CLIs, so those mirrors are
  harmless side effects.
