#!/usr/bin/env bash
# Install (symlink) this skill into ~/.claude/skills/jarvis so Claude Code picks it up.
# Run once per device. Idempotent.

set -euo pipefail

SKILL_SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/.claude/skills/jarvis"

mkdir -p "$HOME/.claude/skills"

if [[ -L "$DEST" || -d "$DEST" ]]; then
  echo "Removing existing $DEST"
  rm -rf "$DEST"
fi

ln -s "$SKILL_SRC" "$DEST"
echo "Linked $DEST -> $SKILL_SRC"
echo "Restart Claude Code for it to pick up the skill."
