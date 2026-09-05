#!/data/data/com.termux/files/usr/bin/sh
# install-hardline.sh — JARVIS Phase 1: catastrophic-action floor.
# Additive + reversible. Backs up lib/agent.mjs to lib/agent.mjs.bak.
# Aborts cleanly if the SHA doesn't match or agent.mjs doesn't look as expected.
set -e

CORE="$HOME/jarvis-core"
B64URL="https://raw.githubusercontent.com/etblues449/Obsidian-Vault-/master/Assistant%20Core/packages/hardline.tar.gz.b64"
WANT="f355231de3807aa610bdb55678126480819b0d166cc93f9e261c79c4615e5670"
TMP="$HOME/.hardline-install.$$"

echo "=== JARVIS Phase 1 — hardline floor ==="
[ -d "$CORE" ] || { echo "ABORT: $CORE not found"; exit 1; }
[ -f "$CORE/lib/agent.mjs" ] || { echo "ABORT: $CORE/lib/agent.mjs not found"; exit 1; }

mkdir -p "$TMP"
cd "$TMP"

echo "-- fetching package"
curl -fsSL "$B64URL" -o p.b64
tr -d '\r' < p.b64 | base64 -di > hardline.tar.gz

echo "-- verifying SHA-256"
GOT=$(sha256sum hardline.tar.gz 2>/dev/null | cut -d' ' -f1 || openssl dgst -sha256 hardline.tar.gz | awk '{print $NF}')
echo "   want: $WANT"
echo "   got : $GOT"
[ "$GOT" = "$WANT" ] || { echo "ABORT: SHA MISMATCH — nothing installed"; cd "$HOME"; rm -rf "$TMP"; exit 1; }
echo "   SHA OK"

tar -xzf hardline.tar.gz

echo "-- self-test (sandbox copy, before touching jarvis-core)"
node test.mjs || { echo "ABORT: self-test failed — nothing installed"; cd "$HOME"; rm -rf "$TMP"; exit 1; }

echo "-- installing lib/hardline.mjs"
cp hardline.mjs "$CORE/lib/hardline.mjs"

echo "-- patching lib/agent.mjs"
node patch-agent.mjs "$CORE"

echo "-- syntax check"
node --check "$CORE/lib/agent.mjs" && echo "   node --check OK"

echo "-- verifying wiring order in the live file"
grep -n "checkHardline" "$CORE/lib/agent.mjs" || { echo "ABORT: guard not present"; exit 1; }

cd "$HOME"
rm -rf "$TMP"
echo ""
echo "=== DONE. Backup at $CORE/lib/agent.mjs.bak ==="
echo "Rollback:  cp $CORE/lib/agent.mjs.bak $CORE/lib/agent.mjs && rm $CORE/lib/hardline.mjs"
