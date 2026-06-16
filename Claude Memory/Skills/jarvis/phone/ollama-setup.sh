#!/data/data/com.termux/files/usr/bin/env bash
# ollama-setup.sh — Install Ollama + download Haiku model (one-time)
# Usage: bash ollama-setup.sh
# NOTE: This is resource-intensive (~8 GB); ensure sufficient storage

set -euo pipefail

echo "==========================================="
echo "JARVIS Offline Setup — Ollama + Haiku"
echo "==========================================="
echo ""

# ============================================================================
# STEP 1: Check storage
# ============================================================================

echo "[1/4] Checking available storage..."

AVAILABLE_GB=$(df /data/data/com.termux/files/usr | awk 'NR==2 {print int($4/1024/1024)}')
REQUIRED_GB=10  # Haiku model ~7GB, plus overhead

if [[ $AVAILABLE_GB -lt $REQUIRED_GB ]]; then
    echo "❌ ERROR: Only ${AVAILABLE_GB}GB available; need ${REQUIRED_GB}GB for Haiku model."
    echo "   Clear cache or uninstall unused apps, then retry."
    exit 1
fi

echo "✓ ${AVAILABLE_GB}GB available (${REQUIRED_GB}GB required)"

# ============================================================================
# STEP 2: Install Ollama
# ============================================================================

echo ""
echo "[2/4] Checking Ollama..."

if command -v ollama &>/dev/null; then
    echo "✓ Ollama already installed"
else
    echo "Installing Ollama from official source..."

    # Download Ollama for Android (if available) or Termux equivalent
    # For now, use official binary or pkg manager

    if pkg list-installed 2>/dev/null | grep -q "^ollama/"; then
        pkg install -y ollama 2>&1 | tail -5
        echo "✓ Ollama installed via pkg"
    else
        echo "⚠️  Ollama not in pkg repo. Manual install required:"
        echo "   See: https://github.com/ollama/ollama"
        echo "   For Termux: Download build and extract to $PREFIX/bin"
        exit 1
    fi
fi

OLLAMA_VERSION=$(ollama --version 2>/dev/null || echo "unknown")
echo "✓ Ollama $OLLAMA_VERSION"

# ============================================================================
# STEP 3: Start Ollama daemon
# ============================================================================

echo ""
echo "[3/4] Starting Ollama daemon..."

if pgrep -f "ollama serve" &>/dev/null; then
    echo "✓ Ollama daemon already running"
else
    echo "Starting ollama serve in background..."
    nohup ollama serve &>/dev/null &
    sleep 3

    if pgrep -f "ollama serve" &>/dev/null; then
        echo "✓ Ollama daemon started"
    else
        echo "❌ ERROR: Failed to start Ollama daemon."
        exit 1
    fi
fi

# ============================================================================
# STEP 4: Download Haiku model
# ============================================================================

echo ""
echo "[4/4] Downloading Haiku model (~7 GB)..."
echo "   This will take 5-15 minutes depending on connection."
echo ""

if ollama list 2>/dev/null | grep -q "haiku"; then
    echo "✓ Haiku model already downloaded"
else
    echo "Downloading mistral/haiku..."

    if ollama pull mistral/haiku 2>&1 | tail -20; then
        echo "✓ Haiku model downloaded"
    else
        echo "❌ ERROR: Failed to download Haiku model."
        echo "   Check internet connection and retry."
        exit 1
    fi
fi

# ============================================================================
# Final
# ============================================================================

echo ""
echo "==========================================="
echo "✅ OFFLINE SETUP COMPLETE"
echo "==========================================="
echo ""
echo "Next steps:"
echo "1. Verify Ollama is running: pgrep -f 'ollama serve'"
echo "2. Test classifier: bash ollama-classifier.sh \"test note\""
echo "3. jarvis.sh will auto-detect offline and use Ollama"
echo ""
echo "To disable offline mode, stop Ollama:"
echo "  pkill -f 'ollama serve'"
echo ""

exit 0
