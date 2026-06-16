#!/data/data/com.termux/files/usr/bin/env bash
# sync.sh — Git pull + add + commit + push with wake-lock
# Run manually or from cron

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
SYNC_LOG="$VAULT_DIR/.sync-log"

# Guard: vault must exist
if [[ ! -d "$VAULT_DIR/.git" ]]; then
    echo "[$(date)] ERROR: $VAULT_DIR not a git repo" >> "$SYNC_LOG"
    exit 1
fi

# Acquire wake-lock (prevent phone sleep during sync)
termux-wake-lock 2>/dev/null || true

# Log entry
{
    echo "[$(date)] Syncing..."

    cd "$VAULT_DIR" || exit 1

    # Get current branch
    BRANCH=$(git rev-parse --abbrev-ref HEAD)

    # Pull current branch
    if ! git pull origin "$BRANCH" --quiet 2>&1; then
        echo "[$(date)] WARNING: git pull failed (network?). Will retry next sync."
    fi

    # Stage all changes
    git add -A

    # Commit (quiet if nothing changed)
    if ! git commit -m "JARVIS: phone sync $(date +%s)" --quiet 2>/dev/null; then
        echo "[$(date)] No changes to commit."
    else
        echo "[$(date)] Committed."
    fi

    # Push current branch (quiet, don't fail if network is down — retry next sync)
    if ! git push origin "$BRANCH" --quiet 2>&1; then
        echo "[$(date)] WARNING: git push failed (network?). Will retry next sync."
    else
        echo "[$(date)] Pushed to $BRANCH."
    fi

    echo "[$(date)] Sync complete."
} >> "$SYNC_LOG" 2>&1

# Release wake-lock
termux-wake-unlock 2>/dev/null || true

exit 0
