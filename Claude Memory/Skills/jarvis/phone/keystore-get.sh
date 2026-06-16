#!/data/data/com.termux/files/usr/bin/env bash
# keystore-get.sh — Look up a secret by name from the JARVIS keystore.
# Usage: keystore-get.sh KEY_NAME
# Prints the value to stdout, nothing else (so callers can: VAR=$(keystore-get.sh KEY))
#
# v1: reads from ~/.jarvis/.env (plaintext).
# v2 (future): reads from ~/.jarvis/secrets.gpg via gpg-agent / Android Keystore.

set -euo pipefail

if [[ $# -ne 1 ]]; then
    echo "Usage: $(basename "$0") KEY_NAME" >&2
    exit 2
fi

KEY="$1"
ENV_FILE="$HOME/.jarvis/.env"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "ERROR: $ENV_FILE not found. Run install.sh first." >&2
    exit 1
fi

# Source in a subshell to avoid polluting caller env, then print the requested var.
VALUE=$(set -a; source "$ENV_FILE"; set +a; printf '%s' "${!KEY-}")

if [[ -z "$VALUE" ]]; then
    echo "ERROR: $KEY not set in $ENV_FILE" >&2
    exit 1
fi

printf '%s\n' "$VALUE"
