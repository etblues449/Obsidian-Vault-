#!/data/data/com.termux/files/usr/bin/env bash
# ha-call.sh — Home Assistant REST API wrapper
# Usage: ha-call.sh "turn_on" "light.lounge_main" [attr=value ...]
# E.g.:  ha-call.sh "turn_on" "light.lounge_main" "brightness" "200"

set -euo pipefail

# Load secrets (v2: from Keystore with fallback to .env)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ ! -f "$SCRIPT_DIR/keystore-get.sh" ]]; then
    echo "ERROR: keystore-get.sh not found." >&2
    exit 1
fi

HA_URL=$(bash "$SCRIPT_DIR/keystore-get.sh" HA_URL 2>/dev/null || echo "")
HA_TOKEN=$(bash "$SCRIPT_DIR/keystore-get.sh" HA_TOKEN 2>/dev/null || echo "")

if [[ -z "$HA_URL" || -z "$HA_TOKEN" ]]; then
    echo "ERROR: Failed to load HA secrets. Check ~/.jarvis/.env or Keystore." >&2
    exit 1
fi

# Args
ACTION="$1"
ENTITY_ID="$2"
shift 2 || true

# Build JSON payload from remaining key=value pairs (or attr value attr value pairs)
# If args are even (attr value attr value), pair them
# If odd, error
PAYLOAD='{'
PAYLOAD+='"entity_id": "'$ENTITY_ID'"'

# Convert positional args (attr val attr val ...) to JSON
while [[ $# -gt 0 ]]; do
    if [[ $# -eq 1 ]]; then
        echo "ERROR: Odd number of extra args. Expected attr value pairs."
        exit 1
    fi
    ATTR="$1"
    VAL="$2"
    shift 2
    # Quote val if it's not a number
    if [[ "$VAL" =~ ^[0-9]+$ ]]; then
        PAYLOAD+=", \"$ATTR\": $VAL"
    else
        PAYLOAD+=", \"$ATTR\": \"$VAL\""
    fi
done
PAYLOAD+='}'

# Map action to HA service domain
case "$ACTION" in
    turn_on|turn_off)
        DOMAIN="light"
        ;;
    set_temperature)
        DOMAIN="climate"
        ;;
    *)
        DOMAIN="$ACTION"
        ;;
esac

# Known broken entities (skip with warning)
BROKEN_ENTITIES=(
    "sensor.broken_entity"
)
for broken in "${BROKEN_ENTITIES[@]}"; do
    if [[ "$ENTITY_ID" == "$broken" ]]; then
        echo "WARNING: $ENTITY_ID is known broken. Skipping."
        exit 0
    fi
done

# Curl call with 5s timeout
RESPONSE=$(curl \
    -s \
    --max-time 5 \
    -X POST \
    "$HA_URL/api/services/$DOMAIN/$ACTION" \
    -H "Authorization: Bearer $HA_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    2>&1) || {
        echo "ERROR: HA call failed (timeout or network). Domain=$DOMAIN Action=$ACTION Entity=$ENTITY_ID"
        exit 1
    }

# Check for HA errors (HA returns 200 with error in JSON)
if echo "$RESPONSE" | grep -q '"error"'; then
    echo "ERROR: HA returned error: $RESPONSE"
    exit 1
fi

echo "✓ $ENTITY_ID ($ACTION)"
exit 0
