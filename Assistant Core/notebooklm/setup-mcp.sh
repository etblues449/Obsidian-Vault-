#!/bin/bash
# Setup NotebookLM MCP Bridge integration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🔧 Setting up NotebookLM MCP Bridge..."
echo "   Vault root: $VAULT_ROOT"
echo "   Script dir: $SCRIPT_DIR"
echo ""

# Install MCP package
echo "📦 Installing MCP package..."
pip install mcp --quiet

# Verify bridge script
if [ -f "$SCRIPT_DIR/mcp_bridge.py" ]; then
    echo "✓ MCP bridge script found"
else
    echo "✗ MCP bridge script not found at $SCRIPT_DIR/mcp_bridge.py"
    exit 1
fi

# Check .mcp.json
if [ -f "$VAULT_ROOT/.mcp.json" ]; then
    echo "✓ .mcp.json configuration found"
else
    echo "⚠ .mcp.json not found, creating..."
    cat > "$VAULT_ROOT/.mcp.json" << 'EOF'
{
  "mcpServers": {
    "notebooklm-bridge": {
      "command": "python3",
      "args": [
        "Assistant Core/notebooklm/mcp_bridge.py"
      ],
      "disabled": false
    }
  }
}
EOF
fi

# Test bridge
echo ""
echo "🧪 Testing MCP bridge..."
python3 "$SCRIPT_DIR/mcp_bridge.py" &
sleep 2
if ps aux | grep -q "[p]ython3 $SCRIPT_DIR/mcp_bridge.py"; then
    echo "✓ Bridge process started"
    pkill -f "mcp_bridge.py"
else
    echo "✗ Bridge failed to start"
    exit 1
fi

echo ""
echo "✅ MCP Bridge setup complete!"
echo ""
echo "Next steps:"
echo "  1. Restart Claude Code IDE to reload MCP servers"
echo "  2. Tag notes with #notebook to enable auto-sync"
echo "  3. Claude can now:"
echo "     - Search vault by tags: vault_search_by_tag"
echo "     - Create notebooks: notebooklm_create"
echo "     - List notebooks: notebooklm_list"
echo "     - Generate podcasts: notebooklm_podcast"
echo "     - Annotate notes: vault_annotate"
