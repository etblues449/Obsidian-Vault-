#!/usr/bin/env bash
# Call Home Assistant REST API.
# Usage: ha-call.sh <domain.service> <entity_id> [json-data]
# Example: ha-call.sh light.turn_on light.living_room_light '{"brightness_pct":50}'
#
# Reads HA URL + token from config.yaml.

set -euo pipefail

CONFIG="${JARVIS_CONFIG:-/home/user/Obsidian-Vault-/Claude Memory/Skills/jarvis/config.yaml}"

if [[ ! -f "$CONFIG" ]]; then
  echo "ERROR: config not found at $CONFIG — copy resources/config.example.yaml" >&2
  exit 1
fi

HA_URL=$(awk '/^home_assistant:/,/^[a-z]/' "$CONFIG" | grep -E '^\s+url:' | head -1 | awk -F'"' '{print $2}')
HA_TOKEN=$(awk '/^home_assistant:/,/^[a-z]/' "$CONFIG" | grep -E '^\s+long_lived_token:' | head -1 | awk -F'"' '{print $2}')

if [[ -z "$HA_URL" || -z "$HA_TOKEN" || "$HA_TOKEN" == "REPLACE_ME" ]]; then
  echo "ERROR: HA url/token not set in $CONFIG" >&2
  exit 1
fi

SERVICE="${1:?service required, e.g. light.turn_on}"
ENTITY="${2:?entity_id required}"
DATA="${3:-{}}"

DOMAIN="${SERVICE%%.*}"
ACTION="${SERVICE##*.}"

PAYLOAD=$(printf '{"entity_id":"%s"' "$ENTITY")
if [[ "$DATA" != "{}" ]]; then
  PAYLOAD="${PAYLOAD},$(echo "$DATA" | sed 's/^{//;s/}$//')"
fi
PAYLOAD="${PAYLOAD}}"

curl -fsS -X POST \
  -H "Authorization: Bearer $HA_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  "$HA_URL/api/services/$DOMAIN/$ACTION"
