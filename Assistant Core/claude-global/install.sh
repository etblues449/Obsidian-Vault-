#!/usr/bin/env bash
#
# Install the JARVIS global Claude layer into ~/.claude.
#
# Makes the vault's operating context, skills, commands and (optionally) agents available in
# EVERY Claude Code session on this device, in every directory — not just inside the vault.
#
# The vault stays the single source of truth. By default each item is symlinked back here, so
# a `git pull` updates the global layer with no reinstall. Use --copy where symlinks are
# awkward (Windows without Developer Mode, some Android storage backends).
#
# Everything installed is recorded in $DEST/.jarvis-global-manifest, and --uninstall removes
# exactly that and nothing else.
#
#   ./install.sh                     standard profile, symlink where possible
#   ./install.sh --profile=full      also install the 5 jarvis-* agents + the vault harness skills
#   ./install.sh --dry-run           print what would happen, touch nothing
#   ./install.sh --uninstall         remove everything this script installed
#
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR/global"
VAULT_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"

DEST="${CLAUDE_HOME:-$HOME/.claude}"
PROFILE="standard"
MODE="auto"          # auto | link | copy
DRY_RUN=0
FORCE=0
ACTION="install"

BEGIN_MARK="<!-- BEGIN jarvis-global -->"
END_MARK="<!-- END jarvis-global -->"
MANIFEST_NAME=".jarvis-global-manifest"
STAMP="$(date -u '+%Y-%m-%d %H:%M UTC')"
BAK_SUFFIX="$(date -u '+%Y%m%d-%H%M%S')"

# The five vault agents promoted by the full profile. Listed explicitly, not globbed:
# webapp-reviewer is deliberately excluded — it is frozen to one Carousel baseline commit and
# has no meaning outside that review.
FULL_AGENTS=(
  jarvis-vault-keeper
  jarvis-capture-engineer
  jarvis-skill-engine
  jarvis-voice-ha
  jarvis-integration-qa
)

usage() {
  cat <<'EOF'
install.sh — install the JARVIS global Claude layer into ~/.claude

Makes the vault's operating context, skills, commands and (optionally) agents available in
every Claude Code session on this device, in every directory — not just inside the vault.

Usage:
  ./install.sh [options]

Options:
  --profile=minimal|standard|full  What to install (default: standard)
                                     minimal   the CLAUDE.md context block only
                                     standard  + global skills and /jarvis: commands
                                     full      + the 5 jarvis-* agents and the vault harness skills
  --copy                           Copy files instead of symlinking (no live updates on git pull)
  --link                           Require symlinks; fail rather than fall back to copying
  --dest=PATH                      Install target (default: $CLAUDE_HOME, else ~/.claude)
  --dry-run                        Print the plan, change nothing
  --force                          Back up and replace conflicting files not installed by us
  --uninstall                      Remove everything recorded in the manifest
  -h, --help                       This text
EOF
}

die()  { printf 'error: %s\n' "$*" >&2; exit 1; }
info() { printf '%s\n' "$*"; }
act()  { if (( DRY_RUN )); then printf '  [dry-run] %s\n' "$*"; else printf '  %s\n' "$*"; fi; }

for arg in "$@"; do
  case "$arg" in
    --profile=*)  PROFILE="${arg#*=}" ;;
    --dest=*)     DEST="${arg#*=}" ;;
    --copy)       MODE="copy" ;;
    --link)       MODE="link" ;;
    --dry-run)    DRY_RUN=1 ;;
    --force)      FORCE=1 ;;
    --uninstall)  ACTION="uninstall" ;;
    -h|--help)    usage; exit 0 ;;
    *)            die "unknown option: $arg (try --help)" ;;
  esac
done

case "$PROFILE" in
  minimal|standard|full) ;;
  *) die "unknown profile: $PROFILE (expected minimal, standard or full)" ;;
esac

[ -d "$SRC_DIR" ] || die "payload directory missing: $SRC_DIR"

MANIFEST="$DEST/$MANIFEST_NAME"
CLAUDE_MD="$DEST/CLAUDE.md"
OLD_MANIFEST=""          # snapshot of the previous run, set by do_install

cleanup() { [ -n "$OLD_MANIFEST" ] && rm -f -- "$OLD_MANIFEST"; return 0; }
trap cleanup EXIT

# --------------------------------------------------------------------------- manifest helpers

manifest_add() {   # manifest_add <type> <relative-path>
  if (( DRY_RUN )); then return 0; fi
  printf '%s\t%s\n' "$1" "$2" >> "$MANIFEST"
}

# True when the previous run installed this relative path — i.e. it is ours to replace.
was_ours() {   # was_ours <relative-path>
  [ -n "$OLD_MANIFEST" ] || return 1
  [ -f "$OLD_MANIFEST" ] || return 1
  cut -f2- < "$OLD_MANIFEST" | grep -Fxq -- "$1"
}

# --------------------------------------------------------------------------- install one item

install_item() {   # install_item <absolute-source> <relative-dest>
  local src="$1"
  local rel="$2"
  local target="$DEST/$rel"
  local parent
  parent="$(dirname -- "$target")"

  [ -e "$src" ] || die "source missing: $src"

  if [ -e "$target" ] || [ -L "$target" ]; then
    if was_ours "$rel"; then
      act "replace $rel"
      if ! (( DRY_RUN )); then rm -rf -- "$target"; fi
    elif (( FORCE )); then
      act "back up existing $rel -> $rel.bak-$BAK_SUFFIX, then install"
      if ! (( DRY_RUN )); then mv -- "$target" "$target.bak-$BAK_SUFFIX"; fi
    else
      die "$target already exists and was not installed by this script.
       Re-run with --force to back it up as $rel.bak-$BAK_SUFFIX and replace it,
       or move it aside yourself."
    fi
  else
    act "install $rel"
  fi

  if (( DRY_RUN )); then manifest_add "$MODE" "$rel"; return 0; fi

  mkdir -p -- "$parent"

  if [ "$MODE" != "copy" ] && ln -s -- "$src" "$target" 2>/dev/null && [ -L "$target" ]; then
    manifest_add link "$rel"
  else
    if [ "$MODE" = "link" ]; then die "could not create a symlink at $target (re-run with --copy)"; fi
    rm -rf -- "$target"
    cp -R -- "$src" "$target"
    manifest_add copy "$rel"
  fi
}

# ------------------------------------------------------------------- CLAUDE.md managed block

render_block() {   # render_block <output-file>
  local out="$1" line
  {
    printf '%s\n' "$BEGIN_MARK"
    while IFS= read -r line || [ -n "$line" ]; do
      line="${line//\{\{VAULT_ROOT\}\}/$VAULT_ROOT}"
      line="${line//\{\{INSTALLED_AT\}\}/$STAMP}"
      printf '%s\n' "$line"
    done < "$SRC_DIR/CLAUDE.md"
    printf '%s\n' "$END_MARK"
  } > "$out"
}

install_block() {
  if [ ! -f "$CLAUDE_MD" ]; then
    act "create CLAUDE.md with the jarvis-global block"
  elif grep -Fxq -- "$BEGIN_MARK" "$CLAUDE_MD"; then
    act "refresh the jarvis-global block in CLAUDE.md (surrounding content preserved)"
  else
    act "append the jarvis-global block to CLAUDE.md (existing content preserved)"
  fi
  if (( DRY_RUN )); then return 0; fi

  mkdir -p -- "$DEST"
  local block tmp
  block="$(mktemp)"
  tmp="$(mktemp)"
  render_block "$block"

  if [ ! -f "$CLAUDE_MD" ]; then
    cat -- "$block" > "$CLAUDE_MD"
  elif grep -Fxq -- "$BEGIN_MARK" "$CLAUDE_MD"; then
    awk -v b="$BEGIN_MARK" -v e="$END_MARK" -v f="$block" '
      $0 == b { inblk = 1; while ((getline l < f) > 0) print l; close(f); next }
      $0 == e { inblk = 0; next }
      !inblk  { print }
    ' "$CLAUDE_MD" > "$tmp"
    cat -- "$tmp" > "$CLAUDE_MD"
  else
    printf '\n' >> "$CLAUDE_MD"
    cat -- "$block" >> "$CLAUDE_MD"
  fi

  rm -f -- "$block" "$tmp"
}

remove_block() {
  [ -f "$CLAUDE_MD" ] || return 0
  grep -Fxq -- "$BEGIN_MARK" "$CLAUDE_MD" || return 0
  act "remove the jarvis-global block from CLAUDE.md"
  if (( DRY_RUN )); then return 0; fi
  local tmp
  tmp="$(mktemp)"
  awk -v b="$BEGIN_MARK" -v e="$END_MARK" '
    $0 == b { inblk = 1; next }
    $0 == e { inblk = 0; next }
    !inblk  { print }
  ' "$CLAUDE_MD" > "$tmp"
  cat -- "$tmp" > "$CLAUDE_MD"
  rm -f -- "$tmp"
}

# Remove every target recorded in a manifest file. Only ever called with a manifest this
# script wrote, so every path in it is ours to delete.
prune_manifest() {   # prune_manifest <manifest-file>
  local mf="$1" type rel target
  [ -f "$mf" ] || return 0
  while IFS=$'\t' read -r type rel; do
    [ -n "${rel:-}" ] || continue
    target="$DEST/$rel"
    if [ -e "$target" ] || [ -L "$target" ]; then
      if ! (( DRY_RUN )); then rm -rf -- "$target"; fi
    fi
  done < "$mf"
}

# -------------------------------------------------------------------------------- uninstall

do_uninstall() {
  info "Uninstalling the JARVIS global layer from $DEST"
  if [ -f "$MANIFEST" ]; then
    local type rel target
    while IFS=$'\t' read -r type rel; do
      [ -n "${rel:-}" ] || continue
      target="$DEST/$rel"
      if [ ! -e "$target" ] && [ ! -L "$target" ]; then
        act "already gone: $rel"
        continue
      fi
      act "remove $type $rel"
      if ! (( DRY_RUN )); then rm -rf -- "$target"; fi
    done < "$MANIFEST"
    act "remove $MANIFEST_NAME"
    if ! (( DRY_RUN )); then rm -f -- "$MANIFEST"; fi
  else
    info "  no manifest at $MANIFEST — nothing recorded as installed"
  fi
  remove_block
  info "Done. Files not listed in the manifest were left untouched."
}

# ---------------------------------------------------------------------------------- install

do_install() {
  info "Installing the JARVIS global Claude layer"
  info "  vault:   $VAULT_ROOT"
  info "  target:  $DEST"
  info "  profile: $PROFILE"
  info "  mode:    $MODE"
  info ""

  # Snapshot the previous run, then clear its files. This keeps reinstalls idempotent and
  # makes a profile downgrade (full -> standard) actually remove what it no longer installs.
  if [ -f "$MANIFEST" ]; then
    OLD_MANIFEST="$(mktemp)"
    cat -- "$MANIFEST" > "$OLD_MANIFEST"
    prune_manifest "$OLD_MANIFEST"
  fi
  if ! (( DRY_RUN )); then
    mkdir -p -- "$DEST"
    : > "$MANIFEST"
  fi

  install_block

  if [ "$PROFILE" != "minimal" ]; then
    local d name
    for d in "$SRC_DIR"/skills/*/; do
      [ -d "$d" ] || continue
      name="$(basename -- "$d")"
      install_item "${d%/}" "skills/$name"
    done
    install_item "$SRC_DIR/commands/jarvis" "commands/jarvis"
  fi

  if [ "$PROFILE" = "full" ]; then
    local a asrc sd sname
    for a in "${FULL_AGENTS[@]}"; do
      asrc="$VAULT_ROOT/.claude/agents/$a.md"
      if [ -f "$asrc" ]; then
        install_item "$asrc" "agents/$a.md"
      else
        printf '  warning: agent not found, skipped: %s\n' "$asrc" >&2
      fi
    done
    for sd in "$VAULT_ROOT"/.claude/skills/*/; do
      [ -d "$sd" ] || continue
      sname="$(basename -- "$sd")"
      # Never shadow one of the purpose-built global skills.
      if [ -d "$SRC_DIR/skills/$sname" ]; then continue; fi
      install_item "${sd%/}" "skills/$sname"
    done
  fi

  info ""
  if (( DRY_RUN )); then
    info "Dry run — nothing was written."
  else
    info "Installed $(wc -l < "$MANIFEST" | tr -d ' ') item(s); manifest at $MANIFEST"
    info "Start a new Claude Code session to pick them up."
  fi
}

case "$ACTION" in
  install)   do_install ;;
  uninstall) do_uninstall ;;
esac
