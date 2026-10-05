#!/data/data/com.termux/files/usr/bin/sh
# TradeGuard Analyst — one-shot phone install (Fold 8 Ultra, Termux).
#   cd ~/Obsidian-Vault-/"Claude Memory/Projects/Trading Signals/tools/analyst" && sh scripts/install-termux.sh
# What it does: ~/tradeguard symlink (no spaces, same as the executor runbook) → Node ≥ 22 check →
# Termux:Boot script → preflight (scripts/check.mjs) → starts the server → prints the one-time steps.
set -e

VAULT="$HOME/Obsidian-Vault-"
TOOLS="$VAULT/Claude Memory/Projects/Trading Signals/tools"
LINK="$HOME/tradeguard"

echo "== TradeGuard Analyst install =="
[ -d "$TOOLS/analyst" ] || { echo "✗ $TOOLS/analyst not found — clone the vault to ~/Obsidian-Vault- first (git clone git@github.com:etblues449/Obsidian-Vault-.git)"; exit 1; }

if [ ! -e "$LINK" ]; then ln -s "$TOOLS" "$LINK"; echo "✓ symlink $LINK -> $TOOLS"; else echo "✓ $LINK exists"; fi

if ! command -v node > /dev/null 2>&1; then
  echo "✗ node not installed — run: pkg install nodejs"; exit 1
fi
MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$MAJOR" -ge 22 ] || { echo "✗ node $(node --version) is too old — need 22+ (pkg upgrade nodejs). If pkg says 'already newest' but node will not run, pkg reinstall nodejs."; exit 1; }
echo "✓ node $(node --version)"

mkdir -p "$HOME/.termux/boot"
cp "$LINK/analyst/scripts/termux-boot-analyst.sh" "$HOME/.termux/boot/tradeguard-analyst"
chmod +x "$HOME/.termux/boot/tradeguard-analyst"
echo "✓ Termux:Boot script installed at ~/.termux/boot/tradeguard-analyst"

cd "$LINK/analyst"
node scripts/check.mjs || { echo "✗ preflight failed — fix the FAIL lines above and re-run"; exit 1; }

sh "$HOME/.termux/boot/tradeguard-analyst"
sleep 3
if pgrep -f "analyst/server.mjs" > /dev/null 2>&1; then
  echo "✓ TradeGuard Analyst is RUNNING on http://localhost:8080"
else
  echo "✗ server did not start — read ~/tradeguard-analyst.log"; exit 1
fi

cat <<'EOF'

== One-time steps (once, ~3 minutes) ==
 1. Install 'Termux:Boot' from F-Droid and open it ONCE (that registers it).
 2. Android Settings → Apps → Termux → Battery → Unrestricted. Same for Termux:Boot.
 3. Chrome → http://localhost:8080 → menu ⋮ → 'Add to Home screen' → Install.
From now on the phone boots → the analyst is already running → tap the icon.

Logs: ~/tradeguard-analyst.log · stop: pkill -f "analyst/server.mjs" · update: cd ~/Obsidian-Vault- && git pull
EOF
