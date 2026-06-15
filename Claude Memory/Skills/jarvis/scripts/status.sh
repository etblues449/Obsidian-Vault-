#!/usr/bin/env bash
# Jarvis status — show what's built, what's pending, and how full the inbox is.

set -euo pipefail

VAULT="${JARVIS_VAULT:-/home/user/Obsidian-Vault-}"
STATE="$VAULT/Inbox/.jarvis-state.yaml"
INBOX="$VAULT/Inbox"

echo "Vault: $VAULT"
echo

if [[ -f "$STATE" ]]; then
  echo "Rollout state:"
  grep -E "^day[1-5]_" "$STATE" | sed 's/^/  /'
else
  echo "Rollout state: NOT INITIALISED — run scripts/setup.sh"
fi
echo

if [[ -d "$INBOX" ]]; then
  total=$(find "$INBOX" -maxdepth 1 -type f -name "*.md" 2>/dev/null | wc -l)
  pending=$(grep -l "processed: false" "$INBOX"/*.md 2>/dev/null | wc -l || echo 0)
  echo "Inbox: $total files, $pending pending"
else
  echo "Inbox: missing"
fi
echo

CONFIG="$VAULT/Claude Memory/Skills/jarvis/config.yaml"
if [[ -f "$CONFIG" ]]; then
  echo "Config: present"
else
  echo "Config: missing — copy resources/config.example.yaml to config.yaml and fill in"
fi
