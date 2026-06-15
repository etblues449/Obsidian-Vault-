#!/bin/bash
set -euo pipefail

VAULT_DIR="${CLAUDE_PROJECT_DIR}"

cat << 'EOF'
========================================
LOADING OBSIDIAN VAULT CONTEXT (JARVIS)
========================================
EOF

# Main context
if [ -f "$VAULT_DIR/CLAUDE.md" ]; then
  echo ""
  echo "📚 CLAUDE.md:"
  echo "---"
  cat "$VAULT_DIR/CLAUDE.md"
  echo ""
fi

# Mandatory session-start reading list — surface the 7 files and their existence
echo ""
echo "📌 MANDATORY SESSION-START FILES (read these before any task):"
FILES=(
  "Claude Memory/MEMORY.md"
  "Claude Memory/Profile/user_profile.md"
  "Claude Memory/Projects/Smart Home/_index.md"
  "Claude Memory/Projects/Faceless Finance/_index.md"
  "Claude Memory/Projects/Doc to Learning/_index.md"
  "Claude Memory/Projects/Other Workspaces/_index.md"
  "Claude Memory/capture_queue.md"
)
for f in "${FILES[@]}"; do
  if [ -f "$VAULT_DIR/$f" ]; then
    echo "  ✅ $f"
  else
    echo "  ⚠️  MISSING: $f"
  fi
done

# Project indexes discovered
if [ -d "$VAULT_DIR/Claude Memory/Projects" ]; then
  echo ""
  echo "📁 Project indexes found:"
  find "$VAULT_DIR/Claude Memory/Projects" -maxdepth 2 -name "_index.md" | while read -r file; do
    dir_name=$(dirname "$file" | sed 's|.*Claude Memory/Projects/||')
    echo "  - $dir_name"
  done
fi

echo ""
echo "========================================"
echo "✅ Vault context loaded."
echo "▶️  Now READ the 7 mandatory files above and CONFIRM before proceeding."
echo "========================================"