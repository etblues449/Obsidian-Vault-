#!/data/data/com.termux/files/usr/bin/env bash
# install.sh — Idempotent JARVIS phone setup
# Run once: bash ~/jarvis/Claude\ Memory/Skills/jarvis/phone/install.sh

set -euo pipefail

echo "==========================================="
echo "JARVIS Phone Setup — One-Time Install"
echo "==========================================="
echo ""

# ============================================================================
# STEP 1: Check & install dependencies
# ============================================================================

echo "[1/8] Checking dependencies..."

# git (pre-installed on Termux)
if ! command -v git &> /dev/null; then
    echo "Installing git..."
    pkg install -y git
fi
echo "✓ git $(git --version | cut -d' ' -f3)"

# curl (pre-installed on Termux)
if ! command -v curl &> /dev/null; then
    echo "Installing curl..."
    pkg install -y curl
fi
echo "✓ curl"

# termux-api (needed for wake-lock, notifications)
if ! command -v termux-notification &> /dev/null; then
    echo "Installing termux-api..."
    pkg install -y termux-api
fi
echo "✓ termux-api"

# cronie (cron daemon for Termux)
if ! command -v cronie &> /dev/null; then
    echo "Installing cronie..."
    pkg install -y cronie
fi
echo "✓ cronie"

# ============================================================================
# STEP 2: Check vault clone
# ============================================================================

echo ""
echo "[2/8] Checking vault clone..."

# Derive vault dir from this script's location: $VAULT/Claude Memory/Skills/jarvis/phone/install.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

if [[ ! -d "$VAULT_DIR/.git" ]]; then
    echo "Vault not found at $VAULT_DIR. Cloning from GitHub..."
    git clone https://github.com/etblues449/Obsidian-Vault- "$VAULT_DIR" 2>&1 | grep -E "^Cloning|done"
    echo "✓ Vault cloned to $VAULT_DIR"
else
    echo "✓ Vault already present at $VAULT_DIR"
fi

# ============================================================================
# STEP 3: FUSE safety check (OneDrive breaks git)
# ============================================================================

echo ""
echo "[3/8] FUSE safety check..."

if [[ "$VAULT_DIR" == /storage/emulated/* ]]; then
    echo "❌ ERROR: Vault is on /storage/emulated/0 (Cloud sync = broken git)."
    echo "   Move to Termux native: mv /storage/emulated/.../jarvis $HOME/jarvis"
    echo "   Then re-run this script."
    exit 1
fi
echo "✓ Vault is safe (Termux native filesystem)"

# ============================================================================
# STEP 4: Setup ~/.jarvis/ and .env
# ============================================================================

echo ""
echo "[4/8] Setting up ~/.jarvis/ directory..."

mkdir -p ~/.jarvis

# Copy .env.example if not already present
if [[ ! -f ~/.jarvis/.env ]]; then
    cp "$VAULT_DIR/Claude Memory/Skills/jarvis/phone/.env.example" ~/.jarvis/.env
    chmod 600 ~/.jarvis/.env
    echo "✓ Created ~/.jarvis/.env (template)"
    echo ""
    echo "   ⚠️  NEXT: Edit ~/.jarvis/.env and paste your secrets:"
    echo "      - ANTHROPIC_API_KEY=sk-..."
    echo "      - HA_URL=http://192.168.0.200:8123"
    echo "      - HA_TOKEN=eyJ..."
    echo ""
else
    echo "✓ ~/.jarvis/.env already exists (skipping)"
fi

# ============================================================================
# STEP 5: Create Termux:Widget shortcuts
# ============================================================================

echo "[5/8] Setting up Termux:Widget shortcuts..."

SHORTCUTS_DIR="$HOME/.shortcuts"
mkdir -p "$SHORTCUTS_DIR"

# Shortcut 1: JARVIS (capture)
cat > "$SHORTCUTS_DIR/jarvis.sh" <<SHORTCUT
#!/data/data/com.termux/files/usr/bin/env bash
# Quick capture via one-tap widget
read -p "JARVIS: " -t 5 INPUT || INPUT="\$@"
[[ -z "\$INPUT" ]] && exit 0
bash "$VAULT_DIR/Claude Memory/Skills/jarvis/phone/jarvis.sh" "\$INPUT"
SHORTCUT
chmod +x "$SHORTCUTS_DIR/jarvis.sh"

# Shortcut 2: SYNC (manual sync)
cat > "$SHORTCUTS_DIR/sync.sh" <<SHORTCUT
#!/data/data/com.termux/files/usr/bin/env bash
# Manual sync: git pull + commit + push
bash "$VAULT_DIR/Claude Memory/Skills/jarvis/phone/sync.sh"
echo "✓ Sync complete"
SHORTCUT
chmod +x "$SHORTCUTS_DIR/sync.sh"

# Shortcut 3: DIGEST (run digest now)
cat > "$SHORTCUTS_DIR/digest.sh" <<SHORTCUT
#!/data/data/com.termux/files/usr/bin/env bash
# Manual digest: summarize Inbox into Journal
bash "$VAULT_DIR/Claude Memory/Skills/jarvis/phone/digest.sh"
echo "✓ Digest complete"
SHORTCUT
chmod +x "$SHORTCUTS_DIR/digest.sh"

echo "✓ Created ~/.shortcuts/ (3 buttons: jarvis / sync / digest)"
echo "   Install Termux:Widget from Play Store, add shortcuts to home screen"

# ============================================================================
# STEP 6: Start & enable cronie
# ============================================================================

echo ""
echo "[6/8] Setting up cron (daily digest at 9 AM)..."

# Start cronie service
if ! pgrep -f crond &> /dev/null; then
    termux-service cronie start 2>/dev/null || true
fi
echo "✓ cronie started"

# Add cron entry for daily digest
CRON_ENTRY="0 9 * * * /data/data/com.termux/files/usr/bin/bash $VAULT_DIR/Claude\\ Memory/Skills/jarvis/phone/digest.sh"

# Check if already present
if crontab -l 2>/dev/null | grep -q "digest.sh"; then
    echo "✓ Cron entry for digest already present"
else
    # Add new entry
    (crontab -l 2>/dev/null || true; echo "0 9 * * * /data/data/com.termux/files/usr/bin/bash $VAULT_DIR/Claude\\ Memory/Skills/jarvis/phone/digest.sh") | crontab -
    echo "✓ Added cron entry: 9 AM daily"
fi

# Add cron entry for backup (v2: 2 AM daily)
if crontab -l 2>/dev/null | grep -q "backup.sh"; then
    echo "✓ Cron entry for backup already present"
else
    (crontab -l 2>/dev/null || true; echo "0 2 * * * /data/data/com.termux/files/usr/bin/bash $VAULT_DIR/Claude\\ Memory/Skills/jarvis/phone/backup.sh") | crontab -
    echo "✓ Added cron entry: 2 AM daily backup"
fi

# ============================================================================
# STEP 7: Verify native git
# ============================================================================

echo ""
echo "[7/8] Verifying native git..."

cd "$VAULT_DIR"
GIT_VERSION=$(git --version | cut -d' ' -f3)
echo "✓ git $GIT_VERSION (native on Termux)"

# Test credential helper
if git config --global credential.helper &> /dev/null; then
    echo "✓ Git credential helper configured"
else
    echo "⚠️  Git credential.helper not set. You may need to enter GitHub PAT on next git push."
fi

# ============================================================================
# STEP 8: Final checklist
# ============================================================================

echo ""
echo "==========================================="
echo "✅ SETUP COMPLETE"
echo "==========================================="
echo ""
echo "NEXT STEPS (user actions):"
echo ""
echo "1. [ ] Edit ~/.jarvis/.env with your secrets:"
echo "       nano ~/.jarvis/.env"
echo ""
echo "2. [ ] Test JARVIS:"
echo "       bash \"$VAULT_DIR/Claude Memory/Skills/jarvis/phone/jarvis.sh\" \"test note\""
echo ""
echo "3. [ ] Test HA control:"
echo "       bash \"$VAULT_DIR/Claude Memory/Skills/jarvis/phone/ha-call.sh\" turn_on light.lounge_main"
echo ""
echo "4. [ ] Install Termux:Widget from Play Store"
echo "       Add 'jarvis', 'sync', 'digest' buttons to home screen"
echo ""
echo "5. [ ] Tomorrow at 9 AM, check if digest cron ran:"
echo "       tail ~/jarvis/.sync-log"
echo ""
echo "OPTIONAL (v2 features):"
echo "   - Offline mode: bash \"$VAULT_DIR/Claude Memory/Skills/jarvis/phone/ollama-setup.sh\""
echo "   - Secrets hardening: Keystore support (requires Java SDK)"
echo "   - Backup: Edit $HOME/.jarvis/backup-config.yaml (Nextcloud or rsync)"
echo "   - Wake word: bash \"$VAULT_DIR/Claude Memory/Skills/jarvis/phone/wakeword.sh\" (background daemon)"
echo "   - Tailscale: pkg install tailscale; tailscale up"
echo ""

exit 0
