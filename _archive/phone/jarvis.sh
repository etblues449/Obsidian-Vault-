#!/data/data/com.termux/files/usr/bin/env bash
# jarvis.sh — Main JARVIS entry point
# Usage: jarvis.sh "text input"     (from arg)
#        jarvis.sh                  (from stdin or pipe)
#        termux-speech-to-text | jarvis.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
RESOURCES_DIR="$VAULT_DIR/Claude Memory/Skills/jarvis/resources"
CLASSIFICATION_MD="$RESOURCES_DIR/classification.md"
INBOX_DIR="$VAULT_DIR/Inbox"

# Load secrets (v2: from Keystore with fallback to .env)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ ! -f "$SCRIPT_DIR/keystore-get.sh" ]]; then
    echo "ERROR: keystore-get.sh not found." >&2
    exit 1
fi

ANTHROPIC_API_KEY=$(bash "$SCRIPT_DIR/keystore-get.sh" ANTHROPIC_API_KEY 2>/dev/null || echo "")
HA_URL=$(bash "$SCRIPT_DIR/keystore-get.sh" HA_URL 2>/dev/null || echo "")
HA_TOKEN=$(bash "$SCRIPT_DIR/keystore-get.sh" HA_TOKEN 2>/dev/null || echo "")

if [[ -z "$ANTHROPIC_API_KEY" || -z "$HA_URL" || -z "$HA_TOKEN" ]]; then
    echo "ERROR: Failed to load secrets. Check ~/.jarvis/.env or Keystore." >&2
    exit 1
fi

# Get input text
if [[ $# -gt 0 ]]; then
    INPUT_TEXT="$@"
else
    # Read from stdin
    INPUT_TEXT=$(cat)
fi

# Guard: text can't be empty
if [[ -z "$INPUT_TEXT" ]]; then
    echo "ERROR: No input text."
    exit 1
fi

# Guard: classification.md must exist
if [[ ! -f "$CLASSIFICATION_MD" ]]; then
    echo "ERROR: $CLASSIFICATION_MD not found."
    exit 1
fi

# Ensure Inbox dir exists
mkdir -p "$INBOX_DIR"

# ============================================================================
# CLASSIFY: Call Claude Haiku with classifier
# ============================================================================

# Build classifier prompt
CLASSIFIER_PROMPT=$(cat <<'EOF'
You are JARVIS, a phone-native home automation and capture system.

Classify this user input into ONE of these actions:

$(cat $CLASSIFICATION_MD)

OUTPUT JSON (one line, no markdown):
{"action": "note|task|idea|journal|ha_action|decline", "category": "...", "entity": "...", "value": "..."}

User input:
EOF
)

# Read classification.md into the prompt (bash substitution)
CLASSIFIER_PROMPT="${CLASSIFIER_PROMPT//\$\(cat \$CLASSIFICATION_MD\)/$(cat "$CLASSIFICATION_MD")}"

# Check network state (v2: offline fallback to local Ollama)
if bash "$SCRIPT_DIR/network-check.sh" 2>/dev/null; then
    # Online: use cloud Claude
    CLASSIFY_RESPONSE=$(claude -p --model haiku "$CLASSIFIER_PROMPT

$INPUT_TEXT" 2>/dev/null || echo '{"action":"decline","error":"claude_call_failed"}')
else
    # Offline: use local Ollama if available
    CLASSIFY_RESPONSE=$(bash "$SCRIPT_DIR/ollama-classifier.sh" "$CLASSIFIER_PROMPT

$INPUT_TEXT" 2>/dev/null || echo '{"action":"decline","error":"ollama_unavailable"}')
fi

# Parse JSON response (extract action, category, entity, value)
ACTION=$(echo "$CLASSIFY_RESPONSE" | grep -o '"action"[^,}]*' | cut -d'"' -f4 || echo "decline")
CATEGORY=$(echo "$CLASSIFY_RESPONSE" | grep -o '"category"[^,}]*' | cut -d'"' -f4 || echo "unknown")
ENTITY=$(echo "$CLASSIFY_RESPONSE" | grep -o '"entity"[^,}]*' | cut -d'"' -f4 || echo "")
VALUE=$(echo "$CLASSIFY_RESPONSE" | grep -o '"value"[^,}]*' | cut -d'"' -f4 || echo "")

# ============================================================================
# ROUTE: Execute action based on classification
# ============================================================================

case "$ACTION" in
    note|task|idea|journal)
        # Write to Inbox (sync.sh + digest.sh will organize later)
        TIMESTAMP=$(date +%Y%m%d-%H%M%S)
        INBOX_FILE="$INBOX_DIR/${ACTION}_${TIMESTAMP}.md"

        # Template based on action type
        case "$ACTION" in
            task)
                {
                    echo "# Task: $VALUE"
                    echo ""
                    echo "- [ ] $INPUT_TEXT"
                    echo ""
                    echo "**Category:** $CATEGORY"
                } > "$INBOX_FILE"
                CONFIRM_TEXT="✓ Task: $VALUE"
                ;;
            idea)
                {
                    echo "# Idea: $VALUE"
                    echo ""
                    echo "$INPUT_TEXT"
                    echo ""
                    echo "**Category:** $CATEGORY"
                } > "$INBOX_FILE"
                CONFIRM_TEXT="✓ Idea captured"
                ;;
            journal)
                {
                    echo "# Journal: $CATEGORY"
                    echo ""
                    echo "$INPUT_TEXT"
                } > "$INBOX_FILE"
                CONFIRM_TEXT="✓ Journal entry"
                ;;
            *)  # note (default)
                {
                    echo "# Note: $VALUE"
                    echo ""
                    echo "$INPUT_TEXT"
                    echo ""
                    echo "**Category:** $CATEGORY"
                } > "$INBOX_FILE"
                CONFIRM_TEXT="✓ Note: $VALUE"
                ;;
        esac

        # Sync to vault (git add + commit + push)
        cd "$VAULT_DIR"
        git add "$INBOX_FILE"
        git commit -m "JARVIS: $ACTION — $VALUE" --quiet 2>/dev/null || true

        # Notify
        termux-notification --title "JARVIS" --content "$CONFIRM_TEXT" 2>/dev/null || true
        echo "$CONFIRM_TEXT"
        ;;

    ha_action)
        # Home Assistant action
        # Entity should be "domain.entity" (e.g., "light.lounge_main")
        # Value is the action (e.g., "turn_on")
        if [[ -z "$ENTITY" ]]; then
            echo "ERROR: ha_action requires entity. Input: $INPUT_TEXT"
            termux-notification --title "JARVIS ERROR" --content "HA action missing entity" 2>/dev/null || true
            exit 1
        fi

        # Call ha-call.sh
        if bash "$VAULT_DIR/Claude Memory/Skills/jarvis/phone/ha-call.sh" "$VALUE" "$ENTITY" 2>/dev/null; then
            CONFIRM_TEXT="✓ $VALUE $ENTITY"
            termux-notification --title "JARVIS" --content "$CONFIRM_TEXT" 2>/dev/null || true
            echo "$CONFIRM_TEXT"
        else
            echo "ERROR: HA call failed"
            termux-notification --title "JARVIS ERROR" --content "HA call failed" 2>/dev/null || true
            exit 1
        fi
        ;;

    decline)
        echo "JARVIS: Not understood. Try again."
        termux-notification --title "JARVIS" --content "Not understood" 2>/dev/null || true
        exit 0
        ;;

    *)
        echo "ERROR: Unknown action '$ACTION'. Response was: $CLASSIFY_RESPONSE"
        exit 1
        ;;
esac

# ============================================================================
# SYNC: Pull, commit, push (async, don't block)
# ============================================================================

# Optional: run sync in background to not block the user
# bash "$VAULT_DIR/Claude Memory/Skills/jarvis/phone/sync.sh" &

exit 0
