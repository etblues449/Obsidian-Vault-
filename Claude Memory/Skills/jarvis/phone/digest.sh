#!/data/data/com.termux/files/usr/bin/env bash
# digest.sh — Summarize yesterday's Inbox into daily Journal entry
# Runs from cron daily (default: 9 AM)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
INBOX_DIR="$VAULT_DIR/Inbox"
JOURNAL_DIR="$VAULT_DIR/Journal"

# Load secrets (v2: from Keystore with fallback to .env)
if [[ ! -f "$SCRIPT_DIR/keystore-get.sh" ]]; then
    echo "ERROR: keystore-get.sh not found." >&2
    exit 1
fi

ANTHROPIC_API_KEY=$(bash "$SCRIPT_DIR/keystore-get.sh" ANTHROPIC_API_KEY 2>/dev/null || echo "")

if [[ -z "$ANTHROPIC_API_KEY" ]]; then
    echo "ERROR: Failed to load ANTHROPIC_API_KEY. Check ~/.jarvis/.env or Keystore." >&2
    exit 1
fi

# Dates (yesterday for inbox, today for journal)
YESTERDAY=$(date -d "yesterday" +%Y-%m-%d)
TODAY=$(date +%Y-%m-%d)
JOURNAL_FILE="$JOURNAL_DIR/$TODAY.md"

# Guard: inbox must exist
if [[ ! -d "$INBOX_DIR" ]]; then
    echo "WARNING: Inbox dir not found. Creating."
    mkdir -p "$INBOX_DIR"
fi

# Guard: journal must exist
mkdir -p "$JOURNAL_DIR"

# Collect all .md files from Inbox created in last 24h
INBOX_FILES=$(find "$INBOX_DIR" -name "*.md" -mtime -1 2>/dev/null | sort || true)

# If no files, skip
if [[ -z "$INBOX_FILES" ]]; then
    echo "[$(date)] No Inbox items since yesterday. Skipping digest."
    exit 0
fi

# Read all content
INBOX_CONTENT=""
while IFS= read -r FILE; do
    INBOX_CONTENT+="## $(basename "$FILE")"$'\n'
    INBOX_CONTENT+="$(cat "$FILE")"$'\n\n'
done <<< "$INBOX_FILES"

# Call Claude Sonnet for summarization (better quality than Haiku)
DIGEST_PROMPT="Summarize this Inbox (yesterday's captures) into 3-5 bullet points for a daily Journal entry. Be concise, actionable, group by theme.

INBOX:
$INBOX_CONTENT

OUTPUT (bullet points only, no intro):"

DIGEST_OUTPUT=$(claude -p --model sonnet "$DIGEST_PROMPT" 2>/dev/null || echo "ERROR: Claude call failed.")

# Write to today's Journal
{
    echo "# Journal — $TODAY"
    echo ""
    echo "## Summary"
    echo "$DIGEST_OUTPUT"
    echo ""
    echo "---"
    echo "Generated: $(date)"
} > "$JOURNAL_FILE"

# Notify user
SUMMARY_LINE=$(echo "$DIGEST_OUTPUT" | head -1)
termux-notification \
    --title "JARVIS Digest" \
    --content "$SUMMARY_LINE" \
    --action "open-journal" \
    2>/dev/null || true

# Optionally archive yesterday's Inbox items (keep for 7 days, then delete)
# For now, just log that digest ran
echo "[$(date)] Digest complete: $JOURNAL_FILE"

exit 0
