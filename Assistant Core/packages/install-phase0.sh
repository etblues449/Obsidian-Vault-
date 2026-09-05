#!/data/data/com.termux/files/usr/bin/sh
set -e
SHA_EXPECTED="c49c93b51fe3f76612c8c4ca831b265ffe2957e712648137477dd9cb89ed4172"
CORE="$HOME/jarvis-core"
echo "== Phase 0: self-knowledge generator =="
[ -d "$CORE/lib" ] || { echo "x $CORE/lib not found — run from a phone with jarvis-core"; exit 1; }
B="https://raw.githubusercontent.com/etblues449/Obsidian-Vault-/master/Assistant%20Core/packages"
cd "$HOME"
curl -fsSL -A jarvis -o phase0.b64 "$B/phase0.tar.gz.b64"
tr -d '\r' < phase0.b64 | base64 -di > phase0.tar.gz && rm phase0.b64
ACT=$(sha256sum phase0.tar.gz | cut -d' ' -f1)
[ "$ACT" = "$SHA_EXPECTED" ] || { echo "x SHA mismatch — aborting (got $ACT)"; exit 1; }
echo "✓ SHA verified"
tar -xzf phase0.tar.gz -C "$CORE" && rm phase0.tar.gz
echo "✓ installed $CORE/self-knowledge.mjs"
cd "$CORE"
echo "-- running it against your REAL 14 tools --"
node self-knowledge.mjs
echo "-- drift check (should say OK) --"
node self-knowledge.mjs --check
echo
echo "✓ Phase 0 done. Read it:  cat ~/jarvis-core/SELF_KNOWLEDGE.md"
echo "  Nothing in your app was changed — this only ADDED a script + two docs."
