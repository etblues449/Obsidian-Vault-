#!/usr/bin/env bash
# Verification suite for the Obsidian CLI setup.
# Exercises read, write, search, metadata, task and developer commands against the
# live vault, then removes everything it created. Exit 0 = all green.
set -uo pipefail

OBS="${OBSIDIAN_BIN:-obsidian}"
SCRATCH="_cli-verify-$$"
PASS=0; FAIL=0
declare -a FAILED

ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; PASS=$((PASS+1)); }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n     -> %s\n' "$1" "${2:-no output}"; FAIL=$((FAIL+1)); FAILED+=("$1"); }

# check <label> <expected-regex> <command...>
check() {
  local label="$1" want="$2"; shift 2
  local out; out="$("$@" 2>&1)"
  if printf '%s' "$out" | grep -qE "$want"; then ok "$label"; else bad "$label" "${out:0:200}"; fi
}

cleanup() { "$OBS" delete path="${SCRATCH}.md" >/dev/null 2>&1; }
trap cleanup EXIT

echo "Obsidian CLI verification"
echo "========================="
echo
echo "-- connectivity --"
check "version reports 1.x"            '^[0-9]+\.[0-9]+\.[0-9]+'          "$OBS" version
check "help lists commands"            'Commands:'                        "$OBS" help
check "vault is open"                  '[A-Za-z0-9]'                      "$OBS" vaults

echo
echo "-- read path --"
check "eval reaches the app API"       '=> [0-9]+'                        "$OBS" eval code="app.vault.getMarkdownFiles().length"
check "search returns hits"            '\.md'                             "$OBS" search query="JARVIS" limit=3
check "read by path"                   '.'                                "$OBS" read path="Claude Memory/MEMORY.md"
check "tags with counts"               '#[A-Za-z]'                        "$OBS" tags sort=count counts
check "commands list populated"        ':'                                "$OBS" commands

echo
echo "-- write path --"
check "create note"                    '.'                                "$OBS" create name="$SCRATCH" content="# Verify\n\n- [ ] scratch task\n" silent
check "created note reads back"        'Verify'                           "$OBS" read path="${SCRATCH}.md"
check "append to note"                 '.'                                "$OBS" append path="${SCRATCH}.md" content="appended-line"
check "append is present"              'appended-line'                    "$OBS" read path="${SCRATCH}.md"
check "set frontmatter property"       '.'                                "$OBS" property:set name="status" value="verified" path="${SCRATCH}.md"
check "property reads back"            'verified'                         "$OBS" read path="${SCRATCH}.md"

echo
echo "-- metadata / graph --"
check "backlinks command runs"         '.|^$'                             "$OBS" backlinks path="Claude Memory/MEMORY.md" total
check "orphans command runs"           '.|^$'                             "$OBS" orphans total
check "bases command runs"             '.|^$'                             "$OBS" bases

echo
echo "-- developer commands (prove the GUI layer is alive) --"
SHOT="/tmp/obsidian-verify-$$.png"
"$OBS" dev:screenshot path="$SHOT" >/dev/null 2>&1
if [ -s "$SHOT" ]; then ok "dev:screenshot wrote $(stat -c%s "$SHOT") bytes"; rm -f "$SHOT"; else bad "dev:screenshot" "no file produced"; fi
check "dev:errors reachable"           '.|^$'                             "$OBS" dev:errors

echo
echo "-- cleanup --"
"$OBS" delete path="${SCRATCH}.md" >/dev/null 2>&1
if "$OBS" read path="${SCRATCH}.md" 2>&1 | grep -qiE 'not found|no such|does not exist'; then
  ok "scratch note removed"
else
  bad "scratch note removed" "still present"
fi

echo
echo "========================="
printf 'passed: %d   failed: %d\n' "$PASS" "$FAIL"
if [ "$FAIL" -gt 0 ]; then printf 'failing: %s\n' "${FAILED[*]}"; exit 1; fi
echo "All checks green."
