#!/data/data/com.termux/files/usr/bin/env bash
# ha-assist-integration.sh — Optional bridge for HA Assist + Phone JARVIS (v2.1+)
# Status: Placeholder for Option A (parallel systems)
# Usage: bash ha-assist-integration.sh "intent_name" "entity" "action"

set -euo pipefail

INTENT_NAME="$1"
ENTITY="${2:-}"
ACTION="${3:-}"

if [[ -z "$INTENT_NAME" ]]; then
    echo "Usage: ha-assist-integration.sh <intent_name> [entity] [action]"
    echo "  E.g.: ha-assist-integration.sh turn_on light.lounge_main"
    exit 1
fi

# ============================================================================
# Bridge logic: Route HA Assist intent to JARVIS handlers
# ============================================================================

# This script is called when HA Assist detects an intent and wants to
# delegate to Phone JARVIS for execution (Option A: parallel systems)

# For now, this is a placeholder. Real implementation (v2.1) would:
# 1. Receive intent from HA automation via HTTP/MQTT
# 2. Translate to JARVIS format
# 3. Call appropriate handler (ha-call.sh for lights, jarvis.sh for capture)

case "$INTENT_NAME" in
    # Light control intents
    turn_on|turn_off)
        # Delegate to ha-call.sh
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        bash "$SCRIPT_DIR/ha-call.sh" "$INTENT_NAME" "$ENTITY"
        ;;

    # Capture intents (notes, tasks, ideas)
    note|task|idea|journal)
        # Delegate to jarvis.sh
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        bash "$SCRIPT_DIR/jarvis.sh" "$INTENT_NAME: $ACTION"
        ;;

    *)
        echo "WARNING: Unknown intent: $INTENT_NAME" >&2
        exit 1
        ;;
esac

exit 0
