#!/data/data/com.termux/files/usr/bin/sh
# install-scanwiden.sh — JARVIS Phase 1: widen scanForInjection().
# Additive: appends patterns to the existing INJECTION_PATTERNS array.
# Backs up lib/rails.mjs to lib/rails.mjs.bak. Aborts clean on any mismatch.
# Auto-rolls-back if the regression suite fails against the live file.
set -e

CORE="$HOME/jarvis-core"
B64URL="https://raw.githubusercontent.com/etblues449/Obsidian-Vault-/master/Assistant%20Core/packages/scanwiden.tar.gz.b64"
WANT="87eb67cbec9db2041941b70bdca0588b8254758beae646b818e256b195d48a02"
TMP="$HOME/.scanwiden-install.$$"

echo "=== JARVIS Phase 1 — injection scanner widening ==="
[ -f "$CORE/lib/rails.mjs" ] || { echo "ABORT: $CORE/lib/rails.mjs not found"; exit 1; }

mkdir -p "$TMP"
cd "$TMP"

echo "-- fetching package"
curl -fsSL "$B64URL" -o p.b64
tr -d '\r' < p.b64 | base64 -di > scanwiden.tar.gz

echo "-- verifying SHA-256"
GOT=$(sha256sum scanwiden.tar.gz 2>/dev/null | cut -d' ' -f1 || openssl dgst -sha256 scanwiden.tar.gz | awk '{print $NF}')
echo "   want: $WANT"
echo "   got : $GOT"
[ "$GOT" = "$WANT" ] || { echo "ABORT: SHA MISMATCH — nothing installed"; cd "$HOME"; rm -rf "$TMP"; exit 1; }
echo "   SHA OK"

tar -xzf scanwiden.tar.gz

echo "-- patching lib/rails.mjs"
node patch-rails.mjs "$CORE"

echo "-- syntax check"
node --check "$CORE/lib/rails.mjs" && echo "   node --check OK"

echo "-- regression suite against the LIVE rails.mjs"
cp test-rails.mjs "$CORE/test-rails.mjs"
cd "$CORE"
if node test-rails.mjs; then
  rm -f "$CORE/test-rails.mjs"
  cd "$HOME"; rm -rf "$TMP"
  echo ""
  echo "=== DONE. Backup at $CORE/lib/rails.mjs.bak ==="
  echo "Rollback:  cp $CORE/lib/rails.mjs.bak $CORE/lib/rails.mjs"
else
  echo ""
  echo "!! TESTS FAILED — ROLLING BACK AUTOMATICALLY"
  cp "$CORE/lib/rails.mjs.bak" "$CORE/lib/rails.mjs"
  rm -f "$CORE/test-rails.mjs"
  cd "$HOME"; rm -rf "$TMP"
  echo "rails.mjs restored from backup. Nothing changed."
  exit 1
fi
