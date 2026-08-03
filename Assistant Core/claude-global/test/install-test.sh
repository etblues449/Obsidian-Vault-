#!/usr/bin/env bash
#
# Offline test harness for the JARVIS global Claude layer.
#
# Runs install.sh against throwaway --dest directories. Touches nothing outside its own temp
# dirs, needs no network, and never reads or writes the real ~/.claude.
#
#   bash "Assistant Core/claude-global/test/install-test.sh"
#
set -uo pipefail

TEST_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd -- "$TEST_DIR/.." && pwd)"
INSTALL="$ROOT/install.sh"
SRC_DIR="$ROOT/global"
VAULT_ROOT="$(cd -- "$ROOT/../.." && pwd)"

PASS=0
FAIL=0
WORKDIRS=()

cleanup() { local d; for d in "${WORKDIRS[@]:-}"; do [ -n "$d" ] && rm -rf -- "$d"; done; }
trap cleanup EXIT

ok()   { PASS=$((PASS + 1)); printf '  \033[32mPASS\033[0m %s\n' "$1"; }
bad()  { FAIL=$((FAIL + 1)); printf '  \033[31mFAIL\033[0m %s\n' "$1"; [ $# -gt 1 ] && printf '        %s\n' "$2"; }
group(){ printf '\n\033[1m%s\033[0m\n' "$1"; }

check()      { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "expected [$3], got [$2]"; fi; }
check_true() { if "${@:2}"; then ok "$1"; else bad "$1" "predicate failed: ${*:2}"; fi; }
check_false(){ if "${@:2}"; then bad "$1" "predicate unexpectedly true: ${*:2}"; else ok "$1"; fi; }

newdest() { local d; d="$(mktemp -d)"; WORKDIRS+=("$d"); printf '%s' "$d/.claude"; }

# install <dest> [args...] -> captures output, returns exit code
install_to() { local dest="$1"; shift; bash "$INSTALL" --dest="$dest" "$@" >/dev/null 2>&1; }

printf '\033[1mJARVIS global Claude layer — install tests\033[0m\n'
printf 'vault: %s\n' "$VAULT_ROOT"

# ---------------------------------------------------------------------------------------------
group '1. Shipped payload is loadable by Claude Code'
# This is the defect the auto-generated ECC bundle shipped: a SKILL.md wrapped in a ```markdown
# fence with no YAML frontmatter never loads, and fails silently. Guard it permanently.

# Returns 0 only if the file opens with YAML frontmatter declaring a non-empty name and
# description — i.e. only if Claude Code will actually load it.
has_valid_frontmatter() {   # has_valid_frontmatter <file>
  local f="$1" fm
  [ -f "$f" ] || return 1
  [ "$(head -1 "$f")" = "---" ] || return 1
  fm="$(awk 'NR==1 && $0=="---" {inblk=1; next} inblk && $0=="---" {exit} inblk {print}' "$f")"
  printf '%s\n' "$fm" | grep -Eq '^name:[[:space:]]*[^[:space:]]'        || return 1
  printf '%s\n' "$fm" | grep -Eq '^description:[[:space:]]*[^[:space:]]' || return 1
  return 0
}

# Negative control: the validator must reject the exact shape PR #78 shipped — a whole SKILL.md
# wrapped in a ```markdown fence with no frontmatter at all. Without this, a green suite would
# prove nothing about the check itself.
FENCED="$(mktemp)"
WORKDIRS+=("$FENCED")
printf '```markdown\n# Obsidian-Vault- Development Patterns\n\n> Auto-generated skill\n```\n' > "$FENCED"
check_false "validator rejects a fenced, frontmatter-less SKILL.md (the PR #78 defect)" \
  has_valid_frontmatter "$FENCED"

shopt -s nullglob
payload=("$SRC_DIR"/skills/*/SKILL.md "$SRC_DIR"/commands/*/*.md)
shopt -u nullglob

check_true "payload is non-empty" test "${#payload[@]}" -gt 0

for f in "${payload[@]}"; do
  rel="${f#"$ROOT"/}"
  check_true "$rel would load (frontmatter, name, description)" has_valid_frontmatter "$f"
  if head -1 "$f" | grep -q '```'; then bad "$rel is not wrapped in a code fence"
  else ok "$rel is not wrapped in a code fence"; fi
done

# Skill directory name must match its declared name, or Claude Code will not resolve it.
for d in "$SRC_DIR"/skills/*/; do
  [ -d "$d" ] || continue
  dname="$(basename -- "$d")"
  declared="$(awk -F': *' '/^name:/ {print $2; exit}' "$d/SKILL.md" | tr -d '\r')"
  check "skill dir $dname matches declared name" "$declared" "$dname"
done

# ---------------------------------------------------------------------------------------------
group '2. --dry-run writes nothing'

DEST="$(newdest)"
install_to "$DEST" --dry-run
check_false "no dest directory created" test -d "$DEST"

# ---------------------------------------------------------------------------------------------
group '3. standard install lands the expected tree'

DEST="$(newdest)"
install_to "$DEST"
check_true  "CLAUDE.md created"                 test -f "$DEST/CLAUDE.md"
check_true  "manifest created"                  test -f "$DEST/.jarvis-global-manifest"
check_true  "jarvis-vault-access skill present" test -e "$DEST/skills/jarvis-vault-access/SKILL.md"
check_true  "obsidian-vault-patterns present"   test -e "$DEST/skills/obsidian-vault-patterns/SKILL.md"
check_true  "commands/jarvis present"           test -e "$DEST/commands/jarvis/audit.md"
check_false "standard does NOT install agents"  test -e "$DEST/agents/jarvis-vault-keeper.md"

check_true "block start marker present" grep -Fxq '<!-- BEGIN jarvis-global -->' "$DEST/CLAUDE.md"
check_true "block end marker present"   grep -Fxq '<!-- END jarvis-global -->'   "$DEST/CLAUDE.md"

if grep -q '{{' "$DEST/CLAUDE.md"; then bad "template placeholders were substituted"
else ok "template placeholders were substituted"; fi
check_true "resolved vault path written into the block" grep -Fq "$VAULT_ROOT" "$DEST/CLAUDE.md"

# Symlinks by default, and they resolve back into the vault.
check_true "skill installed as a symlink" test -L "$DEST/skills/jarvis-vault-access"
check_true "symlink resolves to the vault payload" \
  test "$(cd -- "$DEST/skills/jarvis-vault-access" && pwd -P)" = "$(cd -- "$SRC_DIR/skills/jarvis-vault-access" && pwd -P)"

# ---------------------------------------------------------------------------------------------
group '4. reinstall is idempotent'

before="$(cat -- "$DEST/.jarvis-global-manifest")"
md_before="$(cat -- "$DEST/CLAUDE.md")"
install_to "$DEST"
check "manifest unchanged on reinstall" "$(cat -- "$DEST/.jarvis-global-manifest")" "$before"
check "CLAUDE.md unchanged on reinstall" "$(cat -- "$DEST/CLAUDE.md")" "$md_before"
check "exactly one block start marker" "$(grep -Fxc '<!-- BEGIN jarvis-global -->' "$DEST/CLAUDE.md")" "1"

# ---------------------------------------------------------------------------------------------
group '5. an existing CLAUDE.md is preserved, not clobbered'

DEST="$(newdest)"
mkdir -p -- "$DEST"
printf '# My own global notes\n\nKeep this line.\n' > "$DEST/CLAUDE.md"
install_to "$DEST"
check_true "user heading survived"  grep -Fxq '# My own global notes' "$DEST/CLAUDE.md"
check_true "user body survived"     grep -Fxq 'Keep this line.'       "$DEST/CLAUDE.md"
check_true "block appended"         grep -Fxq '<!-- BEGIN jarvis-global -->' "$DEST/CLAUDE.md"

install_to "$DEST"
check "still exactly one block after reinstall" "$(grep -Fxc '<!-- BEGIN jarvis-global -->' "$DEST/CLAUDE.md")" "1"
check "user content still present once"         "$(grep -Fxc 'Keep this line.' "$DEST/CLAUDE.md")" "1"

# A changed block is refreshed in place without disturbing the user's text.
install_to "$DEST"
check_true "user content survives a refresh" grep -Fxq 'Keep this line.' "$DEST/CLAUDE.md"

# ---------------------------------------------------------------------------------------------
group '6. uninstall removes exactly what was installed'

install_to "$DEST" --uninstall
check_false "manifest removed"        test -f "$DEST/.jarvis-global-manifest"
check_false "skills removed"          test -e "$DEST/skills/jarvis-vault-access"
check_false "commands removed"        test -e "$DEST/commands/jarvis"
check_false "block removed"           grep -Fq 'BEGIN jarvis-global' "$DEST/CLAUDE.md"
check_true  "user CLAUDE.md content left behind" grep -Fxq 'Keep this line.' "$DEST/CLAUDE.md"

# ---------------------------------------------------------------------------------------------
group '7. a foreign file is not silently replaced'

DEST="$(newdest)"
mkdir -p -- "$DEST/skills/jarvis-vault-access"
printf 'not ours\n' > "$DEST/skills/jarvis-vault-access/SKILL.md"
if install_to "$DEST"; then bad "install refuses to clobber a foreign file"
else ok "install refuses to clobber a foreign file"; fi
check_true "foreign file untouched" grep -Fxq 'not ours' "$DEST/skills/jarvis-vault-access/SKILL.md"

install_to "$DEST" --force
check_true "--force backed the foreign file up" \
  bash -c 'ls "$1"/skills/jarvis-vault-access.bak-* >/dev/null 2>&1' _ "$DEST"
check_true "--force then installed ours" test -e "$DEST/skills/jarvis-vault-access/SKILL.md"
check_true "installed copy is the real skill" grep -Fq 'name: jarvis-vault-access' "$DEST/skills/jarvis-vault-access/SKILL.md"

# ---------------------------------------------------------------------------------------------
group '8. --copy produces real files, not links'

DEST="$(newdest)"
install_to "$DEST" --copy
check_false "not a symlink"        test -L "$DEST/skills/jarvis-vault-access"
check_true  "is a real directory"  test -d "$DEST/skills/jarvis-vault-access"
check_true  "content copied"       test -s "$DEST/skills/jarvis-vault-access/SKILL.md"
check_true  "manifest records copy" grep -q '^copy	' "$DEST/.jarvis-global-manifest"

# ---------------------------------------------------------------------------------------------
group '9. profiles'

DEST="$(newdest)"
install_to "$DEST" --profile=minimal
check_true  "minimal installs the block" grep -Fq 'BEGIN jarvis-global' "$DEST/CLAUDE.md"
check_false "minimal installs no skills" test -e "$DEST/skills/jarvis-vault-access"

DEST="$(newdest)"
install_to "$DEST" --profile=full
check_true "full installs agents"        test -e "$DEST/agents/jarvis-vault-keeper.md"
check_true "full installs global skills" test -e "$DEST/skills/jarvis-vault-access/SKILL.md"
check_true "full installs vault skills"  test -e "$DEST/skills/vault-conventions/SKILL.md"
check_false "full excludes webapp-reviewer" test -e "$DEST/agents/webapp-reviewer.md"

# Downgrading must remove what it no longer installs.
install_to "$DEST" --profile=standard
check_false "downgrade removed agents"       test -e "$DEST/agents/jarvis-vault-keeper.md"
check_false "downgrade removed vault skills" test -e "$DEST/skills/vault-conventions"
check_true  "downgrade kept global skills"   test -e "$DEST/skills/jarvis-vault-access/SKILL.md"

# ---------------------------------------------------------------------------------------------
group '10. bad input is rejected'

DEST="$(newdest)"
if install_to "$DEST" --profile=nonsense; then bad "unknown profile rejected"
else ok "unknown profile rejected"; fi
if install_to "$DEST" --wat; then bad "unknown option rejected"
else ok "unknown option rejected"; fi

# ---------------------------------------------------------------------------------------------
printf '\n\033[1m%d passed, %d failed\033[0m\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
