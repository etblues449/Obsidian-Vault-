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

    # 3. Global install of ruflo from the npm registry. npm's content-addressable
    #    cache (cacache) does an atomic rename that ENOENTs on proot's filesystem,
    #    so retry with a cache clean, then fall back to an isolated cache dir.
    ruflo_install() { npm install -g \"\$RUFLO_PKG\" --no-fund --no-audit; }
    info \"npm install -g \$RUFLO_PKG (pulls ~10 MB + deps; be patient)...\"
    if ruflo_install; then
        ok 'Install succeeded on first attempt.'
    else
        warn 'First attempt failed. Cleaning npm cache and retrying...'
        npm cache clean --force || true
        if ruflo_install; then
            ok 'Install succeeded after cache clean.'
        else
            warn 'Retry failed. Trying an isolated cache dir (proot rename workaround)...'
            rm -rf /tmp/ruflo-npm-cache
            if npm install -g \"\$RUFLO_PKG\" --no-fund --no-audit --cache /tmp/ruflo-npm-cache; then
                ok 'Install succeeded with an isolated cache.'
            else
                fail 'ruflo install failed after 3 attempts. Check disk (df -h /) and the npm error log above.'
            fi
        fi
    fi

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

    info 'Optional: wire ruflo MCP server into claude using the GLOBAL binary'
    info '(faster + offline-safe vs npx; --scope user so it loads in EVERY'
    info 'project, including claude-vault -- the default local scope would'
    info 'tie it to one directory only):'
    info '  claude mcp add --scope user ruflo -- ruflo mcp start'
    info 'If you already added a local/npx ruflo MCP server, replace it:'
    info '  claude mcp remove ruflo && claude mcp add --scope user ruflo -- ruflo mcp start'
    info 'To use ruflo in a project (writes .claude/, CLAUDE.md to the workspace):'
    info '  cd <project> && ruflo init'
" || true

# Authoritative verification -- independent of proot-distro exit-code
# propagation (it does not always forward the inner failure).
if proot-distro login ubuntu -- bash -lc 'command -v ruflo >/dev/null 2>&1 && ruflo --version >/dev/null 2>&1'; then
    RUFLO_VER=$(proot-distro login ubuntu -- bash -lc 'ruflo --version 2>/dev/null | head -1' || true)
    c_ok "Verified: ruflo runs -> ${RUFLO_VER:-installed}"
    c_info "Try it: proot-distro login ubuntu -- ruflo --help"
    c_info "Uninstall: proot-distro login ubuntu -- npm uninstall -g ruflo"
else
    c_fail "ruflo still not runnable. Manual retry with an isolated cache:
  proot-distro login ubuntu -- bash -lc 'npm cache clean --force && npm install -g ruflo@latest --no-fund --no-audit --cache /tmp/ruflo-npm-cache && ruflo --version'"
fi
