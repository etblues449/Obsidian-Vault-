#!/usr/bin/env bash
# Install Claude Code on Android (Termux) with this Obsidian vault wired in.
#
# Wraps upstream https://github.com/ferrumclaudepilgrim/claude-code-android
# and adds vault-specific setup:
#   - Records the vault path in ~/.bashrc as $OBSIDIAN_VAULT
#   - Adds `cdv` and `claude-vault` aliases
#   - Configures git inside the vault if not already set
#   - Verifies the vault CLAUDE.md is in place
#   - For Path B, bind-mounts Termux home into proot-Ubuntu so the vault
#     stays reachable from inside the rootfs
#
# Usage (inside Termux on your Android phone):
#   curl -fsSL <raw-url-of-this-file> -o install-claude-code-android.sh
#   bash install-claude-code-android.sh [path-b|path-a]
#
# Default path is "path-b" (proot-Ubuntu, fuller Linux environment). Both
# paths pin claude-code to 2.1.112 -- empirically, 2.1.113+ probes the host
# kernel (not the rootfs) and reports "android arm64" even inside
# proot-Ubuntu, so the platform-native binary download fails. 2.1.112 was
# the last version that shipped pure JS and runs anywhere Node runs.
# Tracking upstream: https://github.com/anthropics/claude-code/issues/50270

set -euo pipefail

MODE="${1:-path-b}"
VAULT_DEFAULT="$HOME/storage/shared/Documents/Obsidian-Vault-"
CC_PIN="2.1.112"

c_info()  { printf '\033[0;36m[info]\033[0m  %s\n' "$1"; }
c_ok()    { printf '\033[0;32m[ok]\033[0m    %s\n' "$1"; }
c_warn()  { printf '\033[0;33m[warn]\033[0m  %s\n' "$1"; }
c_fail()  { printf '\033[0;31m[fail]\033[0m  %s\n' "$1"; exit 1; }

# --- Preflight -------------------------------------------------------------

if [ -z "${PREFIX:-}" ] || [ ! -d "${PREFIX:-}/tmp" ]; then
    c_fail "Run this from inside Termux (F-Droid build). PREFIX not set."
fi

ARCH=$(uname -m)
[ "$ARCH" = "aarch64" ] || c_fail "aarch64 required. uname -m: $ARCH"

c_ok "Termux + aarch64 confirmed"

# Termux storage access for the vault on shared storage
if [ ! -d "$HOME/storage" ]; then
    c_info "Granting Termux access to shared storage (accept the Android prompt)..."
    termux-setup-storage || c_warn "termux-setup-storage failed; you can re-run it later."
fi

# --- Install Claude Code ---------------------------------------------------

case "$MODE" in
    path-a)
        c_info "Path A: native Termux, pinned to ${CC_PIN}."
        pkg install nodejs git curl proot ripgrep termux-api jq -y
        export TMPDIR="$PREFIX/tmp"
        grep -q 'TMPDIR=$PREFIX/tmp' "$HOME/.bashrc" 2>/dev/null \
            || echo 'export TMPDIR=$PREFIX/tmp' >> "$HOME/.bashrc"
        curl -fsSL https://raw.githubusercontent.com/ferrumclaudepilgrim/claude-code-android/main/install.sh -o /tmp/cca-install.sh
        bash /tmp/cca-install.sh
        ;;
    path-b)
        c_info "Path B: proot-Ubuntu, pinned to claude-code ${CC_PIN}."
        pkg install proot-distro git curl -y
        if ! proot-distro list --installed 2>/dev/null | grep -q ubuntu; then
            proot-distro install ubuntu
        fi
        c_info "Provisioning Claude Code inside the Ubuntu rootfs (via npm)..."
        # Why npm + pin 2.1.112 (not https://claude.ai/install.sh + latest):
        #   * claude.ai/install.sh fetches a native binary keyed by
        #     process.platform. Inside proot-Ubuntu the postinstall sees
        #     "android arm64" because Node probes the host kernel; no such
        #     binary is published, so claude installs broken.
        #   * 2.1.112 shipped pure JS and works regardless of platform
        #     reporting.
        # If 2.1.113+ ever publishes android-arm64, bump CC_PIN here.
        proot-distro login ubuntu -- bash -lc "
            set -euo pipefail
            export DEBIAN_FRONTEND=noninteractive
            apt update && apt upgrade -y
            apt install -y curl git ca-certificates nodejs npm
            DISABLE_AUTOUPDATER=1 npm install -g '@anthropic-ai/claude-code@${CC_PIN}'
            # Auto-updater lockout (three layers, all needed per upstream
            # README: env in ~/.bashrc, env in ~/.claude/settings.json, and
            # chmod the install dir read-only).
            grep -q 'DISABLE_AUTOUPDATER=1' /root/.bashrc 2>/dev/null \
                || echo 'export DISABLE_AUTOUPDATER=1' >> /root/.bashrc
            mkdir -p /root/.claude
            if [ ! -f /root/.claude/settings.json ]; then
                printf '%s\n' '{ \"env\": { \"DISABLE_AUTOUPDATER\": \"1\" } }' \
                    > /root/.claude/settings.json
            fi
            chmod -R a-w /usr/local/lib/node_modules/@anthropic-ai/claude-code
            claude --version
        "
        ;;
    *)
        c_fail "Unknown mode: $MODE (use path-a or path-b)"
        ;;
esac

c_ok "Claude Code installed."

# --- Wire up the Obsidian vault -------------------------------------------

read -r -p "Path to your Obsidian vault [$VAULT_DEFAULT]: " VAULT
VAULT="${VAULT:-$VAULT_DEFAULT}"

if [ ! -d "$VAULT" ]; then
    c_warn "Vault dir does not exist: $VAULT"
    c_warn "Clone it now? (you will need a GitHub token if it is private)"
    read -r -p "Clone etblues449/Obsidian-Vault- into $VAULT? [y/N]: " ANS
    if [ "$ANS" = "y" ] || [ "$ANS" = "Y" ]; then
        mkdir -p "$(dirname "$VAULT")"
        git clone https://github.com/etblues449/Obsidian-Vault-.git "$VAULT"
    else
        c_warn "Skipping clone. Re-run after the vault is in place."
    fi
fi

# Persist the vault path + shell helpers. For Path B, claude-vault enters
# proot-Ubuntu with Termux home bind-mounted so the vault path resolves
# inside the rootfs.
BLOCK_TAG="# --- Obsidian vault (added by install-claude-code-android.sh) ---"
if ! grep -qF "$BLOCK_TAG" "$HOME/.bashrc" 2>/dev/null; then
    {
        echo ""
        echo "$BLOCK_TAG"
        echo "export OBSIDIAN_VAULT=\"$VAULT\""
        echo "alias cdv='cd \"\$OBSIDIAN_VAULT\"'"
        if [ "$MODE" = "path-b" ]; then
            echo "alias claude-vault='proot-distro login ubuntu --bind \"\$HOME/storage:/root/storage\" -- bash -lc \"cd \\\"\$OBSIDIAN_VAULT\\\" && claude\"'"
        else
            echo "alias claude-vault='cd \"\$OBSIDIAN_VAULT\" && claude'"
        fi
    } >> "$HOME/.bashrc"
fi

if [ -d "$VAULT/.git" ]; then
    if ! git -C "$VAULT" config user.email >/dev/null 2>&1; then
        c_info "Configuring git inside the vault."
        read -r -p "git user.name for vault commits: " GIT_NAME
        read -r -p "git user.email for vault commits: " GIT_EMAIL
        git -C "$VAULT" config user.name "$GIT_NAME"
        git -C "$VAULT" config user.email "$GIT_EMAIL"
    fi
fi

if [ -f "$VAULT/CLAUDE.md" ]; then
    c_ok "Vault CLAUDE.md present."
else
    c_warn "No CLAUDE.md in vault root. Claude Code will run without project guidance."
fi

c_ok "Done. Open a new Termux shell, then run: claude-vault"
