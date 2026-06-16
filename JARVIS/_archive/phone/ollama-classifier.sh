#!/data/data/com.termux/files/usr/bin/env bash
# ollama-classifier.sh — Local Ollama classifier (compatible with claude -p --model haiku)
# Usage: ollama-classifier.sh "classification prompt"
# Returns: JSON response (same format as Claude Haiku)

set -euo pipefail

PROMPT="$1"

if [[ -z "$PROMPT" ]]; then
    echo '{"action":"decline","error":"no_prompt"}'
    exit 1
fi

# ============================================================================
# Check Ollama availability
# ============================================================================

OLLAMA_ENDPOINT="${OLLAMA_ENDPOINT:-http://localhost:11434}"

if ! timeout 2 curl -s "$OLLAMA_ENDPOINT/api/tags" &>/dev/null; then
    echo '{"action":"decline","error":"ollama_unavailable"}' >&2
    exit 1
fi

# ============================================================================
# Call local Ollama Haiku
# ============================================================================

RESPONSE=$(curl -s -X POST "$OLLAMA_ENDPOINT/api/generate" \
    -H "Content-Type: application/json" \
    -d '{
        "model": "mistral/haiku",
        "prompt": "'"$(echo "$PROMPT" | sed 's/"/\\"/g')"'",
        "stream": false,
        "temperature": 0.3
    }' 2>/dev/null || echo '{"response":"{\"action\":\"decline\",\"error\":\"curl_failed\"}"}')

# Extract response field and output
echo "$RESPONSE" | grep -o '"response":"[^"]*"' | cut -d'"' -f4 || echo '{"action":"decline","error":"parse_failed"}'

exit 0
