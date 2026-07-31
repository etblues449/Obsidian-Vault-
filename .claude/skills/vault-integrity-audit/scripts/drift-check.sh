#!/usr/bin/env bash
# drift-check.sh — JARVIS vault drift detector
#
# Usage:  scripts/drift-check.sh [vault-root]        (default: cwd)
#         scripts/drift-check.sh /path/to/vault
#
# Exit codes: 0 = no S1 findings   1 = at least one S1 (silent-failure) finding
#
# Checks the recurring drift classes in this vault. Each check compares BOTH
# sides of an interface — a claim and the filesystem — because confirming only
# one side proves nothing.

set -uo pipefail
ROOT="${1:-.}"
cd "$ROOT" || { echo "cannot cd to $ROOT"; exit 2; }

S1=0; S2=0; S3=0; N=0
say() { printf '%-4s %-60s %s\n' "$1" "$2" "$3"; }
chk() { # sev  label  path
  N=$((N+1))
  if [ -e "$3" ]; then say "OK" "$2" "present"
  else
    say "$1" "$2" "MISSING: $3"
    case "$1" in S1) S1=$((S1+1));; S2) S2=$((S2+1));; *) S3=$((S3+1));; esac
  fi
}

echo "=============================================="
echo " JARVIS vault drift check"
echo " root : $(pwd)"
echo " sha  : $(git rev-parse --short HEAD 2>/dev/null || echo 'not a git repo')"
echo "=============================================="

echo; echo "--- 1. session-start files (S2: loud, session reports them) ---"
chk S2 "MEMORY.md"                 "Claude Memory/MEMORY.md"
chk S2 "user_profile.md"           "Claude Memory/Profile/user_profile.md"
chk S2 "capture_queue.md"          "Claude Memory/Account/capture_queue.md"
for p in "Smart Home" "Faceless Finance" "Doc to Learning" "Other Workspaces"; do
  chk S2 "Projects/$p/_index.md"   "Claude Memory/Projects/$p/_index.md"
done

echo; echo "--- 2. skill-runner inputs (S1: runner produces output from nothing) ---"
chk S1 "runner input MEMORY.md"    "Claude Memory/MEMORY.md"
chk S1 "runner input decisions"    "Claude Memory/decisions.md"
chk S1 "runner input beliefs"      "Claude Memory/beliefs.md"
chk S1 "runner input patterns"     "Claude Memory/patterns.md"
chk S1 "capture inbox"             "JARVIS/Inbox"

echo; echo "--- 3. schedules: documented vs merged (S1: nothing is triggered) ---"
chk S1 "workflows dir"             ".github/workflows"
for w in _jarvis-run-skill jarvis-1-morning-brief jarvis-3-connection-finder \
         jarvis-4-weekly-synthesis jarvis-6-pattern-detector; do
  chk S1 "workflow $w.yml"         ".github/workflows/$w.yml"
done

echo; echo "--- 4. engine files ---"
chk S2 "runner.mjs"                "Assistant Core/jarvis-skills/runner.mjs"
chk S2 "offline test"              "Assistant Core/jarvis-skills/test/local-test.mjs"

echo; echo "--- 5. dangling wikilinks in project indexes (S3) ---"
DANGLING=0
while IFS= read -r idx; do
  dir=$(dirname "$idx")
  grep -o '\[\[[^]|]*' "$idx" 2>/dev/null | sed 's/^\[\[//' | while IFS= read -r link; do
    [ -z "$link" ] && continue
    if [ ! -e "$dir/$link.md" ] && [ ! -e "$dir/$link" ] \
       && ! find . -name "$(basename "$link").md" -not -path './.git/*' | grep -q .; then
      echo "  DANGLING  $idx  ->  [[$link]]"
    fi
  done
done < <(find "Claude Memory/Projects" -name "_index.md" 2>/dev/null)
DANGLING=$(find "Claude Memory/Projects" -name "_index.md" 2>/dev/null | wc -l)
echo "  (scanned $DANGLING project index files)"

echo; echo "--- 6. date-format violations under Claude Memory/ (S1: breaks lexical sort) ---"
BAD=$(find "Claude Memory" -name "[0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9].md" 2>/dev/null | wc -l)
if [ "$BAD" -gt 0 ]; then
  say S1 "DD-MM-YYYY filenames under Claude Memory/" "$BAD found — runner sorts these wrong"
  find "Claude Memory" -name "[0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9].md" 2>/dev/null | sed 's/^/    /'
  S1=$((S1+1))
else
  say OK "date format under Claude Memory/" "all ISO"
fi
N=$((N+1))

echo; echo "--- 7. unresolved status claims (test each manually) ---"
grep -rl --include="_index.md" -E 'LIVE|DEPLOYED|✅' "Claude Memory/Projects" 2>/dev/null \
  | sed 's/^/  claims to verify: /' || echo "  none"

echo
echo "=============================================="
printf " checks: %s   S1: %s   S2: %s   S3: %s\n" "$N" "$S1" "$S2" "$S3"
echo " S1 = silent failure (runs, produces plausible output from missing input)"
echo " S2 = loud failure    S3 = cosmetic"
echo "=============================================="
[ "$S1" -gt 0 ] && exit 1 || exit 0
