#!/usr/bin/env bash
# Install VexJoy Agent (https://github.com/notque/vexjoy-agent) into the
# proot-Ubuntu Claude Code on your phone.
#
# Run from Termux (not from inside Ubuntu). Wraps the upstream installer
# with the path setup proot-Ubuntu needs and backs up your existing
# ~/.claude config before touching anything.
#
# Usage (inside Termux):
#   bash scripts/install-vexjoy-on-android.sh
#
# Prereqs:
#   - install-claude-code-android.sh has been run (Path B / proot-Ubuntu).
#   - claude --version works inside ubuntu (test: proot-distro login ubuntu -- claude --version).

set -euo pipefail

VEXJOY_REPO_URL="https://github.com/notque/vexjoy-agent.git"
VEXJOY_CLONE_PATH_IN_UBUNTU="/root/vexjoy-agent"

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

# Pass the repo URL + clone path through to the inside-ubuntu script.
export VEXJOY_REPO_URL VEXJOY_CLONE_PATH_IN_UBUNTU

c_info "Entering proot-Ubuntu..."
proot-distro login ubuntu -- bash -lc "
    set -euo pipefail
    REPO='${VEXJOY_REPO_URL}'
    CLONE='${VEXJOY_CLONE_PATH_IN_UBUNTU}'

    info()  { printf '\033[0;36m[info]\033[0m  %s\n' \"\$1\"; }
    ok()    { printf '\033[0;32m[ok]\033[0m    %s\n' \"\$1\"; }
    warn()  { printf '\033[0;33m[warn]\033[0m  %s\n' \"\$1\"; }
    fail()  { printf '\033[0;31m[fail]\033[0m  %s\n' \"\$1\"; exit 1; }

    # 1. Verify claude is installed
    command -v claude >/dev/null || fail 'claude not found in proot-Ubuntu. Run install-claude-code-android.sh first.'
    ok \"claude found: \$(claude --version 2>/dev/null | head -1)\"

    # 2. Python 3.10+ (VexJoy requires it)
    export DEBIAN_FRONTEND=noninteractive
    if ! command -v python3 >/dev/null; then
        info 'Installing python3 + pip...'
        apt update && apt install -y python3 python3-pip python3-venv
    else
        PYV=\$(python3 -c 'import sys; print(\"%d.%d\" % sys.version_info[:2])')
        ok \"python3 \$PYV present\"
    fi

    # 3. Backup ~/.claude before VexJoy touches it
    if [ -d /root/.claude ] && [ ! -d /root/.claude.pre-vexjoy.bak ]; then
        info 'Backing up /root/.claude -> /root/.claude.pre-vexjoy.bak'
        cp -a /root/.claude /root/.claude.pre-vexjoy.bak
        ok 'Backup made. Restore later with: rm -rf /root/.claude && mv /root/.claude.pre-vexjoy.bak /root/.claude'
    else
        info 'Backup already exists or no ~/.claude yet. Skipping.'
    fi

    # 4. Clone or update the vexjoy-agent repo
    if [ -d \"\$CLONE/.git\" ]; then
        info \"Updating existing clone at \$CLONE...\"
        git -C \"\$CLONE\" pull --ff-only
    else
        info \"Cloning \$REPO -> \$CLONE...\"
        git clone \"\$REPO\" \"\$CLONE\"
    fi

    # 5. Run the upstream installer in symlink mode (live updates via git pull)
    info 'Running VexJoy installer (./install.sh --symlink)...'
    cd \"\$CLONE\"
    bash install.sh --symlink

    # 6. Smoke test: does /do show up as a slash command? (Not directly
    #    testable from non-interactive shell; we verify the command file
    #    exists in ~/.claude/commands/ which is where claude reads them.)
    if [ -d /root/.claude/commands ]; then
        ok 'VexJoy commands directory wired up at /root/.claude/commands'
        ls /root/.claude/commands 2>/dev/null | head -5 | sed 's/^/        - /'
    else
        warn 'No /root/.claude/commands found after install -- check the upstream installer output above.'
    fi

    ok 'VexJoy install complete.'
"

c_ok "Done. Next session inside claude-vault should have /do available."
c_info "If anything breaks, restore the backup:"
c_info "  proot-distro login ubuntu -- bash -lc 'rm -rf /root/.claude && mv /root/.claude.pre-vexjoy.bak /root/.claude'"
c_info "Or uninstall VexJoy cleanly:"
c_info "  proot-distro login ubuntu -- bash -lc 'cd ${VEXJOY_CLONE_PATH_IN_UBUNTU} && bash install.sh --uninstall'"
