#!/data/data/com.termux/files/usr/bin/sh
# TradeGuard Analyst — Termux:Boot launcher.
# Installed to ~/.termux/boot/tradeguard-analyst by scripts/install-termux.sh.
# Runs at every phone boot (after Termux:Boot has been opened once and Termux's
# battery setting is Unrestricted). Idempotent: a second run does nothing if the
# server is already up.
#
# Logs: ~/tradeguard-analyst.log   Dashboard: http://localhost:8080
# Stop:  pkill -f "analyst/server.mjs"
# Env:   ~/.config/tradeguard/analyst.env (optional) — ANALYST_PORT, ANALYST_TELEGRAM_BOT_TOKEN,
#        ANALYST_TELEGRAM_CHAT_ID, ANALYST_EXECUTOR_SECRET … sourced here so alerts work from boot.

termux-wake-lock

ANALYST_DIR="$HOME/tradeguard/analyst"   # ~/tradeguard -> the vault's Trading Signals/tools (symlink, see install-termux.sh)
LOG="$HOME/tradeguard-analyst.log"
ENV_FILE="$HOME/.config/tradeguard/analyst.env"   # optional: ANALYST_* overrides + Telegram alert vars (chmod 600; never in the vault)

# Secrets and overrides live OUTSIDE the vault, same pattern as the executor's executor.env.
# Lines are plain `export NAME=value` (or NAME=value — everything set here is exported below).
if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

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
# Launched by its FULL path on purpose: the pgrep/pkill guards above and in the runbook match
# "analyst/server.mjs" against the command line, and a bare `node server.mjs` would never match.
ANALYST_HOST="${ANALYST_HOST:-127.0.0.1}" ANALYST_PORT="${ANALYST_PORT:-8080}" \
  nohup node "$ANALYST_DIR/server.mjs" >> "$LOG" 2>&1 &
