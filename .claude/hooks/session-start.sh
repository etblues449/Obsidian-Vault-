#!/bin/bash
set -euo pipefail

# Register the official + extra MCP servers at user scope (available to all
# repos). Only do this in Claude Code on the web sessions; local installs
# persist on their own, so there is nothing to re-create there.
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

# Same, but for servers that need a credential. The secret is NEVER stored in
# this repo; it is read from an environment variable at session start. Set the
# variable in your environment to activate the server.
add_server_env() {
  local name="$1"; shift
  local env_args=()
  while [ "$1" != "--" ]; do env_args+=(-e "$1"); shift; done
  shift # drop the --
  claude mcp remove "$name" -s user >/dev/null 2>&1 || true
  claude mcp add "$name" -s user "${env_args[@]}" -- "$@"
}

# --- no credentials required ---
add_server filesystem          npx -y @modelcontextprotocol/server-filesystem "$PROJECT_DIR"
add_server memory              npx -y @modelcontextprotocol/server-memory
add_server sequential-thinking npx -y @modelcontextprotocol/server-sequential-thinking
add_server git                 uvx mcp-server-git --repository "$PROJECT_DIR"
add_server fetch               uvx mcp-server-fetch
add_server time                uvx mcp-server-time
add_server playwright          npx -y @playwright/mcp@latest
add_server duckduckgo          uvx duckduckgo-mcp-server
add_server context7            npx -y @upstash/context7-mcp

# --- require a credential (set the env var to activate) ---
add_server_env brave-search "BRAVE_API_KEY=${BRAVE_API_KEY:-}" -- \
  npx -y @modelcontextprotocol/server-brave-search
add_server_env obsidian \
  "OBSIDIAN_API_KEY=${OBSIDIAN_API_KEY:-}" \
  "OBSIDIAN_HOST=${OBSIDIAN_HOST:-https://127.0.0.1:27124}" -- \
  uvx mcp-obsidian
