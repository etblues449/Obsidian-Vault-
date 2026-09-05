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

# Mandatory session-start reading list.
#
# This list is kept identical to the project set that
# Assistant Core/jarvis-skills/runner.mjs actually reads (and that
# test/local-test.mjs asserts on). Those two are authoritative; this hook and
# CLAUDE.md previously disagreed with them by omitting Work Financial Forecasting
# and by pointing at Claude Memory/capture_queue.md instead of Account/.
# Reconciled 2026-07-27. If the runner's project list changes, change this too.
echo ""
echo "📌 MANDATORY SESSION-START FILES (read these before any task):"
FILES=(
  "Claude Memory/MEMORY.md"
  "Claude Memory/Profile/user_profile.md"
  "Claude Memory/Projects/Smart Home/_index.md"
  "Claude Memory/Projects/Faceless Finance/_index.md"
  "Claude Memory/Projects/Doc to Learning/_index.md"
  "Claude Memory/Projects/Work Financial Forecasting/_index.md"
  "Claude Memory/Projects/Other Workspaces/_index.md"
  "Claude Memory/Account/capture_queue.md"
)
MISSING=0
for f in "${FILES[@]}"; do
  if [ -f "$VAULT_DIR/$f" ]; then
    echo "  ✅ $f"
  else
    echo "  ⚠️  MISSING: $f"
    MISSING=$((MISSING + 1))
  fi
done

if [ "$MISSING" -gt 0 ]; then
  echo ""
  echo "  ⚠️  $MISSING mandatory file(s) missing. Report them as MISSING —"
  echo "     do NOT synthesise plausible contents. An invented memory file is"
  echo "     indistinguishable from a real one on the next read."
  echo "     Run: bash .claude/skills/vault-integrity-audit/scripts/drift-check.sh ."
fi

# Project indexes discovered (may include projects the runner does not read)
if [ -d "$VAULT_DIR/Claude Memory/Projects" ]; then
  echo ""
  echo "📁 Project indexes found on disk:"
  find "$VAULT_DIR/Claude Memory/Projects" -maxdepth 2 -name "_index.md" | while read -r file; do
    dir_name=$(dirname "$file" | sed 's|.*Claude Memory/Projects/||')
    echo "  - $dir_name"
  done
fi

# Harness
if [ -d "$VAULT_DIR/.claude/skills" ]; then
  echo ""
  echo "🔧 Harness installed. Multi-layer JARVIS work → jarvis-orchestrator skill."
  echo "   Checkers (read-only, safe any time):"
  echo "     bash .claude/skills/vault-integrity-audit/scripts/drift-check.sh ."
  echo "     python3 .claude/skills/qa-boundary-check/scripts/verify-refs.py ."
fi

echo ""
echo "========================================"
echo "✅ Vault context loaded."
echo "▶️  Now READ the mandatory files above and CONFIRM before proceeding."
echo "========================================"
