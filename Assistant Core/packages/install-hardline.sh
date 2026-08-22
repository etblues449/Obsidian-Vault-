#!/data/data/com.termux/files/usr/bin/sh
# JARVIS Phase 1 — hardline floor installer.
# Fetches the package from the vault, SHA-256 gates it, installs, tests, patches,
# and proves the block/allow behaviour on device. Safe to re-run (idempotent).
set -e

EXPECTED_SHA="90ce63698a2f0abcfac194aad876ce96bb755ec267c191a6af1ee70d88d35d2c"
CORE="${JARVIS_CORE:-$HOME/jarvis-core}"
URL="https://raw.githubusercontent.com/etblues449/Obsidian-Vault-/master/Assistant%20Core/packages/hardline.tar.gz.b64"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "JARVIS Phase 1 — hardline floor"
echo "  target: $CORE"

[ -d "$CORE/lib" ] || { echo "✗ $CORE/lib not found. Set JARVIS_CORE=/path/to/jarvis-core"; exit 1; }
[ -f "$CORE/lib/agent.mjs" ] || { echo "✗ $CORE/lib/agent.mjs not found."; exit 1; }

echo "→ fetching…"
curl -fsSL "$URL" -o "$TMP/pkg.b64" || { echo "✗ fetch failed (offline?)"; exit 1; }

echo "→ decoding…"
tr -d '\r' < "$TMP/pkg.b64" | base64 -di > "$TMP/pkg.tar.gz"

ACTUAL="$(sha256sum "$TMP/pkg.tar.gz" | cut -d' ' -f1)"
if [ "$ACTUAL" != "$EXPECTED_SHA" ]; then
  echo "✗ SHA MISMATCH — refusing to install."
  echo "  expected: $EXPECTED_SHA"
  echo "  actual  : $ACTUAL"
  exit 1
fi
echo "✓ SHA verified: $ACTUAL"

mkdir -p "$TMP/x" && tar -xzf "$TMP/pkg.tar.gz" -C "$TMP/x"

echo "→ installing files…"
mkdir -p "$CORE/lib" "$CORE/test"
cp "$TMP/x/lib/hardline.mjs"        "$CORE/lib/hardline.mjs"
cp "$TMP/x/test/hardline-test.mjs"  "$CORE/test/hardline-test.mjs"
cp "$TMP/x/patch-agent.mjs"         "$CORE/patch-agent.mjs"
cp "$TMP/x/HARDLINE.md"             "$CORE/HARDLINE.md"

echo "→ running the test suite…"
( cd "$CORE" && node test/hardline-test.mjs ) || { echo "✗ tests failed — NOT patching agent.mjs"; exit 1; }

echo "→ wiring into lib/agent.mjs…"
( cd "$CORE" && node patch-agent.mjs "$CORE" ) || { echo "✗ patch aborted — agent.mjs untouched"; exit 1; }

echo "→ on-device proof…"
cd "$CORE" && node -e '
import("./lib/hardline.mjs").then(h => {
  const bad  = h.checkHardline("pc_control", { command: "Remove-Item C:\\ -Force -Recurse" });
  const good = h.checkHardline("pc_control", { command: "Get-Date" });
  const note = h.checkHardline("remember",   { fact: "rm -rf is dangerous" });
  console.log("  catastrophic  :", bad.blocked  ? "BLOCKED ✓ (" + bad.reason + ")" : "NOT BLOCKED ✗");
  console.log("  normal cmd    :", good.blocked ? "BLOCKED ✗" : "allowed ✓");
  console.log("  remember text :", note.blocked ? "BLOCKED ✗" : "allowed ✓");
  console.log("  patterns      :", h.HARDLINE_PATTERN_COUNT);
  if (bad.blocked && !good.blocked && !note.blocked) console.log("\n✓ PHASE 1 INSTALLED AND PROVEN ON DEVICE");
  else { console.log("\n✗ UNEXPECTED RESULT — report this output"); process.exit(1); }
});'

echo ""
echo "Docs   : $CORE/HARDLINE.md      (includes the .jarvis-safe panic button)"
echo "Backup : $CORE/lib/agent.mjs.bak"
echo "Revert : cp $CORE/lib/agent.mjs.bak $CORE/lib/agent.mjs && rm $CORE/lib/hardline.mjs"
echo ""
echo "NEXT — restart the app so the new agent.mjs is loaded, then in JARVIS say:"
echo "  \"run Remove-Item C: -Force -Recurse on the PC\"   → must be REFUSED even if you say yes"
echo "  \"run Get-Date on the PC\"                          → must still work"
