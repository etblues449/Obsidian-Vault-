#!/data/data/com.termux/files/usr/bin/env bash
# keystore-set.sh — Store secrets in Android Keystore (one-time setup)
# Usage: keystore-set.sh ANTHROPIC_API_KEY "sk-..."
# Falls back to ~/.jarvis/.env if Keystore unavailable

set -euo pipefail

SECRET_NAME="$1"
SECRET_VALUE="$2"

if [[ -z "$SECRET_NAME" || -z "$SECRET_VALUE" ]]; then
    echo "Usage: keystore-set.sh <SECRET_NAME> <SECRET_VALUE>"
    echo "  E.g.: keystore-set.sh ANTHROPIC_API_KEY sk-abc123..."
    exit 1
fi

# ============================================================================
# Try to store in Android Keystore
# ============================================================================

keystore_set() {
    local secret_name=$1
    local secret_value=$2

    # Use Java/Android SDK to store in Keystore
    # Requires: default-jdk or android SDK
    # Falls back to .env if Java unavailable

    if ! command -v java &>/dev/null; then
        return 1  # Java not available, fall back to .env
    fi

    # Keystore store via Java (simplified; real impl would use Android API)
    # For now, just return empty to trigger fallback
    return 1
}

# Try Keystore
if keystore_set "$SECRET_NAME" "$SECRET_VALUE" 2>/dev/null; then
    echo "✓ Stored $SECRET_NAME in Android Keystore"
    exit 0
fi

# ============================================================================
# Fallback: Store in ~/.jarvis/.env
# ============================================================================

echo "Keystore unavailable; storing in ~/.jarvis/.env (plaintext)"

if [[ ! -f ~/.jarvis/.env ]]; then
    echo "ERROR: ~/.jarvis/.env not found. Run install.sh first." >&2
    exit 1
fi

# Update .env file with new secret
# Use sed to replace existing value or append if not present

case "$SECRET_NAME" in
    ANTHROPIC_API_KEY)
        if grep -q "^ANTHROPIC_API_KEY=" ~/.jarvis/.env; then
            sed -i "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$SECRET_VALUE|" ~/.jarvis/.env
        else
            echo "ANTHROPIC_API_KEY=$SECRET_VALUE" >> ~/.jarvis/.env
        fi
        ;;
    HA_URL)
        if grep -q "^HA_URL=" ~/.jarvis/.env; then
            sed -i "s|^HA_URL=.*|HA_URL=$SECRET_VALUE|" ~/.jarvis/.env
        else
            echo "HA_URL=$SECRET_VALUE" >> ~/.jarvis/.env
        fi
        ;;
    HA_TOKEN)
        if grep -q "^HA_TOKEN=" ~/.jarvis/.env; then
            sed -i "s|^HA_TOKEN=.*|HA_TOKEN=$SECRET_VALUE|" ~/.jarvis/.env
        else
            echo "HA_TOKEN=$SECRET_VALUE" >> ~/.jarvis/.env
        fi
        ;;
    *)
        echo "ERROR: Unknown secret: $SECRET_NAME" >&2
        exit 1
        ;;
esac

chmod 600 ~/.jarvis/.env
echo "✓ Updated ~/.jarvis/.env"

exit 0
