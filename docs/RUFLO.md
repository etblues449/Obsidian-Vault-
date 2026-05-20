# ruflo (claude-flow v3) — global install on phone

[ruflo](https://github.com/ruvnet/ruflo) is ruvnet's **claude-flow v3**
(currently `3.7.0-alpha.71`). On npm it's published under both names —
`ruflo` and `claude-flow` — same code. It's an AI agent orchestration CLI
for Claude Code: 98 agents, 60+ commands, an MCP server, swarm / hive-mind
coordination, vector memory (AgentDB), and self-learning hooks.

## What "global install" actually does

`npm install -g ruflo@latest` installs **only the `ruflo` CLI binary**
(~10 MB + deps) into the proot-Ubuntu global prefix. It does **not** touch
`~/.claude`, does **not** add hooks, and does **not** change how Claude
behaves. That makes it much less invasive than VexJoy.

The invasive part comes later, *if* you run:

```bash
cd <project> && ruflo init
```

`ruflo init` writes `.claude/`, `.claude-flow/`, `CLAUDE.md`, settings, and
helpers **into that project's workspace** — not globally. So the global CLI
is safe to install; you opt into the heavy stuff per-project.

## Requirements

- **Node ≥ 20.** The Android installer pulls Node from apt (18.x on Ubuntu
  24.04), which is too old. The install script bumps Node to 20.x via
  NodeSource if needed, then re-verifies that claude-code still runs.

## Install on the phone

Prerequisite: `scripts/install-claude-code-android.sh` has run and `claude`
works inside proot-Ubuntu.

In **Termux** (not inside Ubuntu):

```bash
cd "$OBSIDIAN_VAULT"
git pull origin claude/github-claude-code-integration-g8mhE
bash scripts/install-ruflo-on-android.sh
```

What the script does:

1. Preflight: requires Termux + proot-distro ubuntu.
2. Enters proot-Ubuntu, records the current `claude --version`.
3. Checks Node. If < 20, installs Node 20.x via NodeSource (arm64).
4. `npm install -g ruflo@latest`.
5. Verifies `ruflo --version` runs.
6. Re-verifies `claude --version` still works after the Node change
   (warns + prints the reinstall command if not).

## Verify

```bash
proot-distro login ubuntu -- ruflo --help
proot-distro login ubuntu -- ruflo --version
```

## Use it

```bash
# Per-project init (writes .claude/, CLAUDE.md to the workspace):
proot-distro login ubuntu -- bash -lc 'cd ~/some-project && ruflo init'

# Wire ruflo's MCP server into Claude Code:
proot-distro login ubuntu -- claude mcp add ruflo -- npx ruflo@latest mcp start
```

## Update

```bash
proot-distro login ubuntu -- npm install -g ruflo@latest
```

## Uninstall

```bash
proot-distro login ubuntu -- npm uninstall -g ruflo
```

## ruflo vs VexJoy — both installed, do they fight?

| | VexJoy | ruflo (global) |
|---|---|---|
| Install footprint | Symlinks into `~/.claude/` (agents, skills, hooks, commands) | Just the `ruflo` CLI binary |
| Touches `~/.claude`? | Yes — globally, on install | No (only `ruflo init` does, per-project) |
| Hooks fire globally? | Yes | No |
| Conflict risk | — | Low while it's only the global CLI. If you `ruflo init` a project, its `.claude/` + hooks can overlap VexJoy's global hooks — watch for double-firing there. |

Bottom line: the global `ruflo` CLI coexists fine with VexJoy. Be deliberate
about `ruflo init` in projects where VexJoy's global hooks are also active.

## Why not a git-source install?

You asked for a "git install" — but the raw `ruvnet/ruflo` repo doesn't
ship the compiled `dist/` (only TypeScript `src/`) and has no
`prepare`/`postinstall` build hook. `npm install -g github:ruvnet/ruflo`
would install but **crash on first run**. A from-source install needs
clone → `npm install` → `npm run build` (multi-workspace TS + WASM, slow,
fragile) → `npm link`. The npm registry package ships prebuilt `dist/` and
is the supported path — same code, just working. That's what this script uses.
