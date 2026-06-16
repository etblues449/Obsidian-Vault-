#!/data/data/com.termux/files/usr/bin/env bash
# network-check.sh — Probe connectivity. Exit 0 if online, 1 if offline.
# Usage: network-check.sh [--ha]
#   (no flag)  → check general internet via api.anthropic.com (HEAD, 3s timeout)
#   --ha       → also probe HA_URL from ~/.jarvis/.env
#
# Designed for: sync.sh / jarvis.sh gating ("skip if offline") and
# the daily digest deciding whether to call Claude or write a placeholder.

set -euo pipefail

CHECK_HA=0
if [[ "${1-}" == "--ha" ]]; then
    CHECK_HA=1
fi

probe() {
    # curl -s -o /dev/null -I --max-time 3 returns non-zero on timeout/DNS/conn fail
    curl -s -o /dev/null -I --max-time 3 "$1"
}

# 1. Internet
if ! probe https://api.anthropic.com; then
    exit 1
fi

# 2. Optional HA reachability
if [[ "$CHECK_HA" -eq 1 ]]; then
    if [[ -f "$HOME/.jarvis/.env" ]]; then
        # shellcheck disable=SC1091
        source "$HOME/.jarvis/.env"
        if [[ -n "${HA_URL-}" ]] && ! probe "$HA_URL"; then
            exit 1
        fi
    fi
fi

exit 0
