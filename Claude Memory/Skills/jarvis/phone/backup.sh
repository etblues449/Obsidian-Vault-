#!/data/data/com.termux/files/usr/bin/env bash
# backup.sh — Vault backup to Nextcloud or rsync
# Usage: bash backup.sh [config-file]
# Run manually or via cron

set -euo pipefail

CONFIG_FILE="${1:-$HOME/.jarvis/backup-config.yaml}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
LOG_FILE="${LOG_FILE:-$VAULT_DIR/.backup-log}"

# ============================================================================
# Load config (simplified YAML parsing)
# ============================================================================

load_config() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        echo "[$(date)] ERROR: Config not found: $CONFIG_FILE" >> "$LOG_FILE"
        exit 1
    fi

    # Parse method (nextcloud or rsync)
    BACKUP_METHOD=$(grep "^backup_method:" "$CONFIG_FILE" | cut -d'"' -f2 || echo "nextcloud")
}

# ============================================================================
# Nextcloud backup via curl
# ============================================================================

backup_nextcloud() {
    echo "[$(date)] Backing up to Nextcloud..." >> "$LOG_FILE"

    # Extract Nextcloud config (handle indented YAML)
    NC_URL=$(grep "^  url:" "$CONFIG_FILE" | cut -d'"' -f2)
    NC_USER=$(grep "^  username:" "$CONFIG_FILE" | cut -d'"' -f2)
    NC_PASS=$(grep "^  app_password:" "$CONFIG_FILE" | cut -d'"' -f2)
    NC_FOLDER=$(grep "^  remote_folder:" "$CONFIG_FILE" | cut -d'"' -f2)

    if [[ -z "$NC_URL" || -z "$NC_USER" || -z "$NC_PASS" ]]; then
        echo "[$(date)] ERROR: Nextcloud config incomplete" >> "$LOG_FILE"
        return 1
    fi

    # Create tar.gz of vault
    BACKUP_FILE="/tmp/jarvis-backup-$(date +%Y%m%d-%H%M%S).tar.gz"

    if ! tar -czf "$BACKUP_FILE" -C "$(dirname "$VAULT_DIR")" "$(basename "$VAULT_DIR")" 2>/dev/null; then
        echo "[$(date)] ERROR: Failed to create tar.gz" >> "$LOG_FILE"
        return 1
    fi

    # Upload via WebDAV
    UPLOAD_URL="${NC_URL}/remote.php/dav/files/${NC_USER}${NC_FOLDER}/$(basename "$BACKUP_FILE")"

    if timeout 120 curl -s \
        -u "$NC_USER:$NC_PASS" \
        --upload-file "$BACKUP_FILE" \
        "$UPLOAD_URL" \
        -o /dev/null 2>&1; then

        echo "[$(date)] ✓ Backed up to Nextcloud: $(basename "$BACKUP_FILE")" >> "$LOG_FILE"
        rm -f "$BACKUP_FILE"
        return 0
    else
        echo "[$(date)] ERROR: Nextcloud upload failed" >> "$LOG_FILE"
        rm -f "$BACKUP_FILE"
        return 1
    fi
}

# ============================================================================
# rsync backup
# ============================================================================

backup_rsync() {
    echo "[$(date)] Backing up via rsync..." >> "$LOG_FILE"

    # Extract rsync config (handle indented YAML)
    RSYNC_REMOTE=$(grep "^  remote_path:" "$CONFIG_FILE" | cut -d'"' -f2)
    RSYNC_KEY=$(grep "^  ssh_key:" "$CONFIG_FILE" | cut -d'"' -f2)
    RSYNC_PORT=$(grep "^  port:" "$CONFIG_FILE" | sed 's/.*: *//' | head -1 || echo "22")

    if [[ -z "$RSYNC_REMOTE" ]]; then
        echo "[$(date)] ERROR: rsync config incomplete" >> "$LOG_FILE"
        return 1
    fi

    # Expand ~ in path
    RSYNC_KEY="${RSYNC_KEY/#\~/$HOME}"

    # Check if SSH key exists
    if [[ ! -f "$RSYNC_KEY" ]]; then
        echo "[$(date)] WARNING: SSH key not found: $RSYNC_KEY. Attempting without key..." >> "$LOG_FILE"
        RSYNC_KEY=""
    fi

    # rsync vault to remote
    RSYNC_OPTS="-avz --delete"
    [[ -n "$RSYNC_KEY" ]] && RSYNC_OPTS="$RSYNC_OPTS -e 'ssh -i $RSYNC_KEY -p $RSYNC_PORT'"

    if timeout 300 rsync $RSYNC_OPTS "$VAULT_DIR/" "$RSYNC_REMOTE/" 2>&1 | tail -5 >> "$LOG_FILE"; then
        echo "[$(date)] ✓ rsync backup complete" >> "$LOG_FILE"
        return 0
    else
        echo "[$(date)] ERROR: rsync failed" >> "$LOG_FILE"
        return 1
    fi
}

# ============================================================================
# Main
# ============================================================================

main() {
    mkdir -p "$HOME/.jarvis"
    load_config

    case "$BACKUP_METHOD" in
        nextcloud)
            backup_nextcloud || exit 1
            ;;
        rsync)
            backup_rsync || exit 1
            ;;
        *)
            echo "[$(date)] ERROR: Unknown backup method: $BACKUP_METHOD" >> "$LOG_FILE"
            exit 1
            ;;
    esac

    echo "[$(date)] Backup complete" >> "$LOG_FILE"
    exit 0
}

main
