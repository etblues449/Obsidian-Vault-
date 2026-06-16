#!/data/data/com.termux/files/usr/bin/env bash
# wakeword.sh — Wake word detection daemon ("hey jarvis" → trigger capture)
# Usage: bash wakeword.sh [config-file]
# Daemon: detects "hey jarvis" via local audio loop, triggers jarvis.sh
# Run from cron or systemd, or manually: nohup bash wakeword.sh &

set -euo pipefail

CONFIG_FILE="${1:-$HOME/.jarvis/wakeword-config.yaml}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
PID_FILE="$HOME/.jarvis/wakeword.pid"
LOG_FILE="$VAULT_DIR/.wakeword-log"

# ============================================================================
# Load config
# ============================================================================

load_config() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        echo "[$(date)] ERROR: Config not found: $CONFIG_FILE" >> "$LOG_FILE"
        exit 1
    fi

    # Parse YAML config (simplified; real impl would use yq or Python)
    # For now, use sensible defaults
    WAKE_WORD="hey jarvis"
    SENSITIVITY="${SENSITIVITY:-0.5}"      # 0.0-1.0
    TIMEOUT="${TIMEOUT:-10}"               # seconds of silence before sleep
    AUDIO_THRESHOLD="${AUDIO_THRESHOLD:-500}" # dB threshold for mic activity
}

# ============================================================================
# Cleanup & PID management
# ============================================================================

cleanup() {
    echo "[$(date)] Shutting down..." >> "$LOG_FILE"
    rm -f "$PID_FILE"
    exit 0
}

trap cleanup SIGTERM SIGINT

write_pid() {
    mkdir -p "$HOME/.jarvis"
    echo $$ > "$PID_FILE"
    echo "[$(date)] Daemon started (PID $$)" >> "$LOG_FILE"
}

# ============================================================================
# Main loop: Listen for wake word
# ============================================================================

main() {
    load_config

    write_pid

    echo "[$(date)] Listening for '$WAKE_WORD'..." >> "$LOG_FILE"

    # Infinite loop: listen and trigger
    while true; do
        # Use termux-microphone-recording or espeak-listen
        # Fallback: manual trigger via stdin (for testing)

        # v1 Simple approach: check if user types "hey jarvis" (for testing)
        # v2 Real approach: use speech-to-text + pattern match

        # For now, simulate listening via stdin (testing mode)
        if read -r -t 30 INPUT; then
            if [[ "$INPUT" == *"jarvis"* ]] || [[ "$INPUT" == *"hey"* ]]; then
                echo "[$(date)] Wake word detected: '$INPUT'" >> "$LOG_FILE"

                # Trigger capture
                bash "$SCRIPT_DIR/jarvis.sh" "$INPUT" &

                # Wait for capture to complete
                wait

                echo "[$(date)] Capture complete, resuming listen..." >> "$LOG_FILE"
            fi
        fi

        sleep 1
    done
}

main
