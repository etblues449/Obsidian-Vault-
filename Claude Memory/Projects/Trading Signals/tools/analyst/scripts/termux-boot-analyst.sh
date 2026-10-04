#!/data/data/com.termux/files/usr/bin/sh
# TradeGuard Analyst — Termux:Boot launcher.
# Installed to ~/.termux/boot/tradeguard-analyst by scripts/install-termux.sh.
# Runs at every phone boot (after Termux:Boot has been opened once and Termux's
# battery setting is Unrestricted). Idempotent: a second run does nothing if the
# server is already up.
#
# Logs: ~/tradeguard-analyst.log   Dashboard: http://localhost:8080
# Stop:  pkill -f "analyst/server.mjs"

termux-wake-lock

ANALYST_DIR="$HOME/tradeguard/analyst"   # ~/tradeguard -> the vault's Trading Signals/tools (symlink, see install-termux.sh)
LOG="$HOME/tradeguard-analyst.log"

if pgrep -f "analyst/server.mjs" > /dev/null 2>&1; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') already running" >> "$LOG"
  exit 0
fi

if [ ! -f "$ANALYST_DIR/server.mjs" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') server.mjs not found at $ANALYST_DIR — run scripts/install-termux.sh" >> "$LOG"
  exit 1
fi

cd "$ANALYST_DIR" || exit 1
# Keep the log bounded: roll at ~5 MB so a month of candle lines cannot fill /data.
if [ -f "$LOG" ] && [ "$(wc -c < "$LOG")" -gt 5000000 ]; then mv "$LOG" "$LOG.1"; fi

echo "$(date '+%Y-%m-%d %H:%M:%S') starting node $(node --version)" >> "$LOG"
ANALYST_HOST="${ANALYST_HOST:-127.0.0.1}" ANALYST_PORT="${ANALYST_PORT:-8080}" \
  nohup node server.mjs >> "$LOG" 2>&1 &
