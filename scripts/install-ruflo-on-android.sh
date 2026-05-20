#!/usr/bin/env bash
# Install ruflo (https://github.com/ruvnet/ruflo == npm "ruflo" / "claude-flow")
# globally inside the proot-Ubuntu Claude Code on your phone.
#
# ruflo is ruvnet's claude-flow v3 (alpha): an AI agent orchestration CLI
# (98 agents, 60+ commands, MCP server, swarm/hive-mind, vector memory).
# A *global* install only adds the `ruflo` CLI binary -- it does NOT modify
# ~/.claude or fire hooks. The invasive part is running `ruflo init` inside
# a project, which writes .claude/, .claude-flow/, CLAUDE.md to that workspace.
#
# Run from Termux (not from inside Ubuntu).
#
# Usage (inside Termux):
#   bash scripts/install-ruflo-on-android.sh
#
# Prereqs:
#   - install-claude-code-android.sh has run (Path B / proot-Ubuntu).
#   - claude works inside ubuntu (proot-distro login ubuntu -- claude --version).

set -euo pipefail

NODE_MIN_MAJOR=20
RUFLO_PKG="ruflo@latest"

c_info()  { printf '\033[0;36m[info]\033[0m  %s\n' "$1"; }
c_ok()    { printf '\033[0;32m[ok]\033[0m    %s\n' "$1"; }
c_warn()  { printf '\033[0;33m[warn]\033[0m  %s\n' "$1"; }
c_fail()  { printf '\033[0;31m[fail]\033[0m  %s\n' "$1"; exit 1; }

# --- Preflight -------------------------------------------------------------

if [ -z "${PREFIX:-}" ] || [ ! -d "${PREFIX:-}/tmp" ]; then
    c_fail "Run this from inside Termux (F-Droid build). PREFIX not set."
fi

if ! command -v proot-distro >/dev/null 2>&1; then
    c_fail "proot-distro not installed. Run install-claude-code-android.sh first."
fi

if [ ! -d "$PREFIX/var/lib/proot-distro/installed-rootfs/ubuntu" ]; then
    c_fail "proot-distro ubuntu not installed. Run install-claude-code-android.sh first."
fi

c_ok "Prereqs OK"

# --- Run the install inside proot-Ubuntu ----------------------------------

export NODE_MIN_MAJOR RUFLO_PKG

c_info "Entering proot-Ubuntu..."
proot-distro login ubuntu -- bash -lc "
    set -euo pipefail
    NODE_MIN_MAJOR='${NODE_MIN_MAJOR}'
    RUFLO_PKG='${RUFLO_PKG}'

    info()  { printf '\033[0;36m[info]\033[0m  %s\n' \"\$1\"; }
    ok()    { printf '\033[0;32m[ok]\033[0m    %s\n' \"\$1\"; }
    warn()  { printf '\033[0;33m[warn]\033[0m  %s\n' \"\$1\"; }
    fail()  { printf '\033[0;31m[fail]\033[0m  %s\n' \"\$1\"; exit 1; }

    export DEBIAN_FRONTEND=noninteractive

    # 1. Note the claude-code install so we can confirm it survives a Node bump.
    CLAUDE_BEFORE=''
    if command -v claude >/dev/null; then
        CLAUDE_BEFORE=\$(claude --version 2>/dev/null | head -1 || true)
        ok \"claude present: \${CLAUDE_BEFORE:-unknown}\"
    else
        warn 'claude not found in proot-Ubuntu (ruflo will still install; claude integration just wont be wired).'
    fi

    # 2. Ensure Node >= \$NODE_MIN_MAJOR (ruflo engines: node >= 20).
    NEED_NODE_UPGRADE=true
    if command -v node >/dev/null; then
        NODE_MAJOR=\$(node -p 'process.versions.node.split(\".\")[0]')
        info \"node \$(node --version) detected\"
        if [ \"\$NODE_MAJOR\" -ge \"\$NODE_MIN_MAJOR\" ]; then
            NEED_NODE_UPGRADE=false
            ok \"Node >= \$NODE_MIN_MAJOR already satisfied.\"
        else
            warn \"Node \$NODE_MAJOR < \$NODE_MIN_MAJOR. ruflo requires >= \$NODE_MIN_MAJOR.\"
        fi
    else
        warn 'node not found.'
    fi

    if [ \"\$NEED_NODE_UPGRADE\" = true ]; then
        info \"Installing Node \${NODE_MIN_MAJOR}.x via NodeSource (arm64-supported)...\"
        apt update
        apt install -y curl ca-certificates gnupg
        curl -fsSL \"https://deb.nodesource.com/setup_\${NODE_MIN_MAJOR}.x\" | bash -
        apt install -y nodejs
        ok \"node now \$(node --version)\"
    fi

    # 3. Global install of ruflo from the npm registry.
    info \"npm install -g \$RUFLO_PKG (this pulls ~10 MB + deps; be patient)...\"
    npm install -g \"\$RUFLO_PKG\"

    # 4. Verify the ruflo binary runs.
    if command -v ruflo >/dev/null; then
        ok \"ruflo installed: \$(ruflo --version 2>/dev/null | head -1 || echo '(version check returned nonzero)')\"
    else
        fail 'ruflo binary not on PATH after install. Check npm global prefix: npm prefix -g'
    fi

    # 5. Confirm claude-code still works (the Node bump shares the /usr prefix,
    #    so global packages should survive -- but verify).
    if [ -n \"\$CLAUDE_BEFORE\" ]; then
        if command -v claude >/dev/null && claude --version >/dev/null 2>&1; then
            ok \"claude still works: \$(claude --version 2>/dev/null | head -1)\"
        else
            warn 'claude no longer runs after the Node change. Reinstall it:'
            warn '  npm install -g @anthropic-ai/claude-code'
        fi
    fi

    ok 'ruflo global install complete.'
    info 'Optional: wire ruflo MCP server into claude with:'
    info '  claude mcp add ruflo -- npx ruflo@latest mcp start'
    info 'To use ruflo in a project (writes .claude/, CLAUDE.md to the workspace):'
    info '  cd <project> && ruflo init'
"

c_ok "Done."
c_info "Try it inside proot-Ubuntu: proot-distro login ubuntu -- ruflo --help"
c_info "Uninstall: proot-distro login ubuntu -- npm uninstall -g ruflo"
