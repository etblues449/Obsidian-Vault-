# CLAUDE.md — Obsidian Vault

Guidance for Claude Code when working inside this Obsidian vault.
Owner: Jelly Bean (paralegal/support for Elliot).

## What this repo is

This is an Obsidian vault that is also a git repo. Notes are Markdown with
Obsidian extensions:

- `[[wikilinks]]` for cross-note references — prefer these over relative paths
  in note bodies.
- YAML frontmatter at the top of notes for metadata.
- `.canvas` files are JSON-backed Obsidian canvases — do not hand-edit unless
  asked.
- Daily notes use `YYYY-MM-DD.md` at the vault root.

## Layout

- `Claude Memory/` — the authoritative index of accounts, projects, profile,
  and instructions captured from Claude.ai. Start here for context about the
  user and active projects. `MEMORY.md` is the entry point.
- `Work/` — work-related notes.
- `scripts/` — small utility scripts (Python, shell). `forecast_tool.py` is
  the Excel forecast helper; `install-claude-code-android.sh` provisions
  Claude Code on a Termux Android device with this vault wired in.
- `.claudian/` — Claudian app settings. Do not commit secrets here; the
  `environmentVariables` field has historically held API keys.
- `.obsidian/` — Obsidian client config. Per-device files
  (`workspace`, `workspace.json`, `workspace-mobile.json`, `cache`,
  `hotkeys-mobile.json`) are gitignored.

## Conventions

- Preserve existing wikilinks when moving or renaming files. If you must
  rename, fix every inbound link (`rg -l "\[\[old-name"`).
- New notes go in the most specific existing folder. Do not invent new
  top-level folders without asking.
- Keep frontmatter keys consistent with neighbouring files in the same
  folder.
- Trailing newline on every Markdown file.

## Secrets

Never commit API keys, tokens, or passwords. If you find one in the working
tree (including in `.mcp.json` or `.claudian/claudian-settings.json`), stop
and surface it — do not stage the file.

## Mobile (Termux) workflow

When running on Android via Termux, the install script puts the vault path
in `$OBSIDIAN_VAULT` and exposes a `claude-vault` shell alias that `cd`s in
and launches `claude`. See `docs/CLAUDE-ON-ANDROID.md` for setup.
