#!/data/data/com.termux/files/usr/bin/env bash
# network-check.sh — Detect online/offline state
# Usage: network-check.sh
# Exit code: 0 = online, 1 = offline

set -euo pipefail

# Quick DNS check (fallback to ping if DNS fails)
if timeout 2 nslookup google.com &>/dev/null; then
    exit 0  # Online
fi

# Fallback: try ping to a public IP
if timeout 2 ping -c 1 8.8.8.8 &>/dev/null; then
    exit 0  # Online
fi

# Offline
exit 1
