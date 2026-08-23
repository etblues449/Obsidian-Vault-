#!/data/data/com.termux/files/usr/bin/sh
# Phase 2 — persona-drift fix. Installs lib/persona.mjs (single source of truth for
# JARVIS's personality) and rewires all four entry points to use it.
# SHA-gated, test-gated, and rolls back automatically if anything fails.
set -e
SHA_EXPECTED="aa55c0c50c6b63be78dd4b0318025a63ff380888e7f798e563f2e12f5a291c63"
CORE="$HOME/jarvis-core"
B="https://raw.githubusercontent.com/etblues449/Obsidian-Vault-/master/Assistant%20Core/packages"

echo "== Phase 2: persona (single source of truth) =="
[ -d "$CORE/lib" ] || { echo "x $CORE/lib not found"; exit 1; }

# --- fetch + verify -----------------------------------------------------------
cd "$HOME"
curl -fsSL -A jarvis -o persona.b64 "$B/persona.tar.gz.b64"
tr -d '\r' < persona.b64 | base64 -di > persona.tar.gz && rm persona.b64
ACT=$(sha256sum persona.tar.gz | cut -d' ' -f1)
[ "$ACT" = "$SHA_EXPECTED" ] || { echo "x SHA mismatch — aborting (got $ACT)"; rm -f persona.tar.gz; exit 1; }
echo "✓ SHA verified"

# --- back up every file we are about to touch ---------------------------------
cd "$CORE"
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p ".persona-rollback-$STAMP"
for f in jarvis.mjs jarvis-app.mjs jarvis-voice.mjs heartbeat.mjs; do
  [ -f "$f" ] && cp "$f" ".persona-rollback-$STAMP/$f"
done
echo "✓ backups in $CORE/.persona-rollback-$STAMP"

rollback() {
  echo "x FAILED — rolling back"
  for f in jarvis.mjs jarvis-app.mjs jarvis-voice.mjs heartbeat.mjs; do
    [ -f ".persona-rollback-$STAMP/$f" ] && cp ".persona-rollback-$STAMP/$f" "$f"
  done
  echo "✓ restored. Nothing changed."
  exit 1
}

# --- install ------------------------------------------------------------------
tar -xzf "$HOME/persona.tar.gz" -C "$CORE" && rm "$HOME/persona.tar.gz"
echo "✓ installed lib/persona.mjs"

# --- gate 1: module tests BEFORE touching entry files -------------------------
echo "-- persona module tests --"
node test-persona.mjs || rollback

# --- gate 2: patch the four entry points --------------------------------------
echo "-- rewiring entry points --"
node patch-persona.mjs "$CORE" || rollback

# --- gate 3: every patched file must still parse ------------------------------
for f in jarvis.mjs jarvis-app.mjs jarvis-voice.mjs heartbeat.mjs; do
  node --check "$f" || rollback
done
echo "✓ all four parse clean"

# --- gate 4: the actual point — one shared persona ----------------------------
node - <<'PROOF' || rollback
import { readFileSync } from 'node:fs'
const files = ['jarvis.mjs','jarvis-app.mjs','jarvis-voice.mjs','heartbeat.mjs']
let bad = 0
for (const f of files) {
  const s = readFileSync(f, 'utf8')
  if (!s.includes("from './lib/persona.mjs'")) { console.log(`x ${f} not wired`); bad++ }
  if (/function systemPrompt\(\)[\s\S]{0,400}?You are /.test(s)) { console.log(`x ${f} still has an inline prompt`); bad++ }
}
if (bad) process.exit(1)
console.log('✓ all four share one persona, no inline prompts remain')
PROOF

# --- retire the stale capital-letter self-knowledge file ----------------------
if [ -f "$CORE/SELF_KNOWLEDGE.json" ]; then
  mv "$CORE/SELF_KNOWLEDGE.json" ".persona-rollback-$STAMP/SELF_KNOWLEDGE.json"
  echo "✓ retired stale SELF_KNOWLEDGE.json (the generator writes self-knowledge.json)"
fi

rm -f test-persona.mjs patch-persona.mjs
echo
echo "✓ Phase 2 installed."
echo "  Restart the app:  pkill -f jarvis-app.mjs; nohup node jarvis-app.mjs > logs/app.log 2>&1 &"
echo "  Roll back:        cp $CORE/.persona-rollback-$STAMP/*.mjs $CORE/"
