#!/bin/bash
set -euo pipefail

VAULT_DIR="${CLAUDE_PROJECT_DIR}"

# Output context information that Claude will see at session start
cat << 'EOF'
========================================
LOADING OBSIDIAN VAULT CONTEXT
========================================
EOF

# Read and display CLAUDE.md
if [ -f "$VAULT_DIR/CLAUDE.md" ]; then
  echo ""
  echo "📚 Main Context (CLAUDE.md):"
  echo "---"
  cat "$VAULT_DIR/CLAUDE.md"
  echo ""
fi

# Check for active project memory
if [ -d "$VAULT_DIR/Claude Memory/Projects" ]; then
  echo ""
  echo "📁 Available Project Contexts:"
  find "$VAULT_DIR/Claude Memory/Projects" -maxdepth 2 -name "_index.md" -o -name "*.md" | head -10 | while read file; do
    if [ -f "$file" ]; then
      dir_name=$(dirname "$file" | sed 's|.*Claude Memory/Projects/||')
      echo "  - $dir_name/$(basename "$file")"
    fi
  done
  echo ""
fi

# Check Work directory
if [ -d "$VAULT_DIR/Work" ]; then
  echo ""
  echo "💼 Work Directory:"
  find "$VAULT_DIR/Work" -maxdepth 1 -type d ! -name "Work" | sort | while read dir; do
    echo "  - $(basename "$dir")"
  done
  echo ""
fi

echo "========================================="
echo "✅ Vault context loaded!"
echo "❓ To load a specific project, ask me to read from the vault."
echo "========================================="
