#!/bin/bash
set -euo pipefail

# Register the official MCP servers at user scope (available to all repos).
# Only do this in Claude Code on the web sessions; local installs persist on
# their own, so there is nothing to re-create there.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

command -v claude >/dev/null 2>&1 || exit 0

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"

# Idempotent: drop any existing definition before (re)adding.
add_server() {
  local name="$1"; shift
  claude mcp remove "$name" -s user >/dev/null 2>&1 || true
  claude mcp add "$name" -s user -- "$@"
}

add_server filesystem          npx -y @modelcontextprotocol/server-filesystem "$PROJECT_DIR"
add_server memory              npx -y @modelcontextprotocol/server-memory
add_server sequential-thinking npx -y @modelcontextprotocol/server-sequential-thinking
add_server git                 uvx mcp-server-git --repository "$PROJECT_DIR"
add_server fetch               uvx mcp-server-fetch
add_server time                uvx mcp-server-time
