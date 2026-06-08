#!/usr/bin/env bash
# Jarvis setup — state-aware walkthrough of the 5-day rollout.
# Reads/writes Inbox/.jarvis-state.yaml. Idempotent.

set -euo pipefail

VAULT="${JARVIS_VAULT:-/home/user/Obsidian-Vault-}"
STATE="$VAULT/Inbox/.jarvis-state.yaml"

mkdir -p "$VAULT/Inbox"

if [[ ! -f "$STATE" ]]; then
  cat > "$STATE" <<EOF
# Jarvis rollout state. Edit to mark days done.
day1_phone_capture: false
day2_n8n_webhook: false
day3_classification: false
day4_ha_integration: false
day5_git_sync: false
started: $(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
  echo "Initialised state at $STATE"
fi

current_day() {
  for d in day1_phone_capture day2_n8n_webhook day3_classification day4_ha_integration day5_git_sync; do
    if grep -q "^${d}: false" "$STATE"; then
      echo "$d"; return
    fi
  done
  echo "DONE"
}

next="$(current_day)"

case "$next" in
  day1_phone_capture)
    echo "▶ DAY 1 — Phone capture (30 min). Walk through resources/roadmap.md §Day 1."
    echo "When done, run: $0 mark day1_phone_capture true" ;;
  day2_n8n_webhook)
    echo "▶ DAY 2 — n8n + webhook (1 hr). Walk through resources/roadmap.md §Day 2."
    echo "When done, run: $0 mark day2_n8n_webhook true" ;;
  day3_classification)
    echo "▶ DAY 3 — Claude classification (2 hrs). Walk through resources/roadmap.md §Day 3."
    echo "When done, run: $0 mark day3_classification true" ;;
  day4_ha_integration)
    echo "▶ DAY 4 — HA webhook + event log (2 hrs). Walk through resources/roadmap.md §Day 4."
    echo "When done, run: $0 mark day4_ha_integration true" ;;
  day5_git_sync)
    echo "▶ DAY 5 — Git auto-sync (1 hr). Walk through resources/roadmap.md §Day 5."
    echo "When done, run: $0 mark day5_git_sync true" ;;
  DONE)
    echo "✓ All 5 days done. Jarvis is live. Use RUN mode from now on."
    echo "  - Process inbox:  bash scripts/process-inbox.sh"
    echo "  - Status:         bash scripts/status.sh" ;;
esac

if [[ "${1:-}" == "mark" && -n "${2:-}" && -n "${3:-}" ]]; then
  sed -i "s/^${2}: .*/${2}: ${3}/" "$STATE"
  echo "Marked $2 = $3"
fi
