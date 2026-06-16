#!/data/data/com.termux/files/usr/bin/env bash
# ollama-setup.sh — Install Ollama via proot-distro (Ubuntu container)
# Usage: bash ollama-setup.sh
# NOTE: This is resource-intensive (~5 GB for Ubuntu + Ollama); ensure sufficient storage

set -euo pipefail

echo "==========================================="
echo "JARVIS Offline Setup — Ollama via proot-distro"
echo "==========================================="
echo ""

# ============================================================================
# STEP 1: Install proot-distro (if needed)
# ============================================================================

echo "[1/5] Checking proot-distro..."

if ! command -v proot-distro &>/dev/null; then
    echo "Installing proot-distro..."
    pkg install -y proot-distro 2>&1 | tail -5
fi

echo "✓ proot-distro ready"

# ============================================================================
# STEP 2: Install Ubuntu distro (if needed)
# ============================================================================

echo ""
echo "[2/5] Checking Ubuntu distro..."

if proot-distro list 2>/dev/null | grep -q "ubuntu"; then
    echo "✓ Ubuntu already installed"
else
    echo "Installing Ubuntu distro (~1.5 GB)..."
    proot-distro install ubuntu 2>&1 | tail -10
    echo "✓ Ubuntu installed"
fi

# ============================================================================
# STEP 3: Install Ollama inside Ubuntu
# ============================================================================

echo ""
echo "[3/5] Installing Ollama in Ubuntu..."

proot-distro login ubuntu -- bash -c "
    apt update -qq
    apt install -y curl 2>&1 | tail -3

    # Download Ollama installer
    curl -fsSL https://ollama.ai/install.sh | sh 2>&1 | tail -5
    echo '✓ Ollama installed in Ubuntu'
"

# ============================================================================
# STEP 4: Start Ollama daemon (in background)
# ============================================================================

echo ""
echo "[4/5] Starting Ollama daemon..."

# Run Ollama inside Ubuntu container (background)
nohup proot-distro login ubuntu -- ollama serve &>/dev/null &
sleep 5

echo "✓ Ollama daemon started (port 11434)"

# ============================================================================
# STEP 5: Download model
# ============================================================================

echo ""
echo "[5/5] Downloading Llama 3.2 model (~3.5 GB)..."
echo "   This will take 10-30 minutes depending on connection."
echo ""

# Pull model from inside Ubuntu
proot-distro login ubuntu -- bash -c "ollama pull llama2 2>&1 | tail -20"

echo "✓ Model downloaded"

# ============================================================================
# Final
# ============================================================================

echo ""
echo "==========================================="
echo "✅ OFFLINE SETUP COMPLETE"
echo "==========================================="
echo ""
echo "Next steps:"
echo "1. Verify Ollama is running: curl http://localhost:11434/api/tags"
echo "2. Test classifier: bash ollama-classifier.sh \"test note\""
echo "3. jarvis.sh will auto-detect offline and use Ollama"
echo ""
echo "To restart Ollama daemon:"
echo "  nohup proot-distro login ubuntu -- ollama serve &>/dev/null &"
echo ""
echo "To manage Ubuntu distro:"
echo "  proot-distro list"
echo "  proot-distro login ubuntu"
echo ""

exit 0
