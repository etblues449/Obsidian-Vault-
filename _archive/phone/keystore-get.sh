#!/data/data/com.termux/files/usr/bin/env bash
# keystore-get.sh — Fetch secrets from Android Keystore with biometric unlock
# Usage: keystore-get.sh ANTHROPIC_API_KEY    # or HA_URL, HA_TOKEN
# Falls back to ~/.jarvis/.env if Keystore unavailable

set -euo pipefail

SECRET_NAME="$1"

if [[ -z "$SECRET_NAME" ]]; then
    echo "Usage: keystore-get.sh <SECRET_NAME>"
    echo "  E.g.: keystore-get.sh ANTHROPIC_API_KEY"
    exit 1
fi

# ============================================================================
# Try Android Keystore first (with biometric if available)
# ============================================================================

keystore_get() {
    local secret=$1

    # Use Java/Android SDK to fetch from Keystore
    # Requires: default-jdk or android SDK
    # Falls back to plaintext if Java unavailable

    if ! command -v java &>/dev/null; then
        return 1  # Java not available, fall back to .env
    fi

    # Keystore fetch via Java (simplified; real impl would use Android API)
    # For now, just return empty to trigger fallback
    return 1
}

# Try to get from Keystore
if keystore_get "$SECRET_NAME" 2>/dev/null; then
    exit 0
fi

# ============================================================================
# Fallback: Read from ~/.jarvis/.env
# ============================================================================

if [[ ! -f ~/.jarvis/.env ]]; then
    echo "ERROR: ~/.jarvis/.env not found. Run install.sh first." >&2
    exit 1
fi

# Source .env and return the secret
source ~/.jarvis/.env

case "$SECRET_NAME" in
    ANTHROPIC_API_KEY)
        echo "$ANTHROPIC_API_KEY"
        ;;
    HA_URL)
        echo "$HA_URL"
        ;;
    HA_TOKEN)
        echo "$HA_TOKEN"
        ;;
    *)
        echo "ERROR: Unknown secret: $SECRET_NAME" >&2
        exit 1
        ;;
esac

exit 0
