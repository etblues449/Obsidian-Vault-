#!/bin/bash
# Mimic Global Setup & Integration Script
# Makes mimic available across all JARVIS projects

set -e

VAULT_DIR="/home/user/Obsidian-Vault-"
MIMIC_DIR="$VAULT_DIR/mimic"
CLIENTS_DIR="$VAULT_DIR/scripts/generated_clients"
MIMIC_BIN=$(which mimic || echo "$HOME/.local/bin/mimic")

echo "🔍 Mimic Global Setup"
echo "===================="
echo ""

# Verify installation
if ! command -v mimic &> /dev/null; then
    echo "❌ mimic not found in PATH"
    echo "Installing via uv..."
    cd "$MIMIC_DIR"
    sh install.sh
else
    echo "✅ mimic installed: $(mimic --version 2>/dev/null || echo 'v0.1.0')"
fi

# Check setup
echo ""
echo "Running health check..."
mimic doctor || true

# Create generated clients directory
if [ ! -d "$CLIENTS_DIR" ]; then
    echo ""
    echo "📁 Creating generated_clients directory..."
    mkdir -p "$CLIENTS_DIR"
    echo "✅ $CLIENTS_DIR"
fi

# Create .env.example for API keys
if [ ! -f "$VAULT_DIR/.env.example" ]; then
    cat > "$VAULT_DIR/.env.example" << 'EOF'
# Mimic Configuration
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...  # Optional: for mitmproxy-ui features
EOF
    echo "✅ Created .env.example (add your API keys here)"
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add API keys to .env file (copy from .env.example)"
echo "2. Start capture: mimic record"
echo "3. Configure iPhone proxy (see instructions in terminal)"
echo "4. Use the app normally to capture traffic"
echo "5. Generate client: mimic gen prod-api.example.com"
echo ""
echo "Generated clients will be saved to: $CLIENTS_DIR"
