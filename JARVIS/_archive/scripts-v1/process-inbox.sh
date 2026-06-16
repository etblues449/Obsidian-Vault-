#!/usr/bin/env bash
# Drain /Inbox/ items. This script lists pending items and prints their content
# so Claude (in RUN mode) can classify and route them per resources/classification.md.
# Actual routing is done by Claude editing files — this script is a discovery helper.

set -euo pipefail

VAULT="${JARVIS_VAULT:-/home/user/Obsidian-Vault-}"
INBOX="$VAULT/Inbox"

if [[ ! -d "$INBOX" ]]; then
  echo "No inbox at $INBOX"; exit 0
fi

echo "=== Pending inbox items ==="
found=0
for f in "$INBOX"/*.md; do
  [[ -e "$f" ]] || continue
  if grep -q "^processed: false" "$f" 2>/dev/null || ! grep -q "^processed:" "$f" 2>/dev/null; then
    echo
    echo "--- $(basename "$f") ---"
    cat "$f"
    found=$((found + 1))
  fi
done

if [[ $found -eq 0 ]]; then
  echo "Inbox is clean."
else
  echo
  echo "=== $found item(s) to route ==="
  echo "After routing each, set 'processed: true' and 'routed_to: <path>' in its frontmatter."
fi
