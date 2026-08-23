#!/data/data/com.termux/files/usr/bin/sh
# Phase 2 - persona-drift fix.
# Installs lib/persona.mjs (single source of truth for JARVIS's personality) and
# rewires all four entry points to use it.
#
# Files are fetched as PLAIN SOURCE, not base64: a hand-transcribed base64 blob was
# corrupted once and the SHA gate caught it. Plain text round-trips exactly.
# Each file is SHA-256 verified before use. Any failure rolls everything back.
set -e
CORE="$HOME/jarvis-core"
B="https://raw.githubusercontent.com/etblues449/Obsidian-Vault-/master/Assistant%20Core/packages/persona"

SHA_PERSONA="0c82b8e14634880715b1942e300a106cb9cd221b797aea3878032e3c0f5ff961"
SHA_PATCH="27486f7ddf6d140696bdad216c60e6bece4b44ca0a9e7ff89dcdcb7d38c0315f"

echo "== Phase 2: persona (single source of truth) =="
[ -d "$CORE/lib" ] || { echo "x $CORE/lib not found"; exit 1; }
cd "$CORE"

# --- fetch + verify each file ------------------------------------------------
fetch() {
  curl -fsSL -A jarvis -o "$2" "$B/$1"
  ACT=$(sha256sum "$2" | cut -d' ' -f1)
  if [ "$ACT" != "$3" ]; then
    echo "x SHA mismatch on $1"
    echo "   expected $3"
    echo "   got      $ACT"
    rm -f "$2"
    exit 1
  fi
  echo "OK verified $1"
}

fetch persona.mjs .persona.new "$SHA_PERSONA"
fetch patch-persona.mjs .patch-persona.new "$SHA_PATCH"

# --- back up every file we are about to touch --------------------------------
STAMP=$(date +%Y%m%d-%H%M%S)
BK=".persona-rollback-$STAMP"
mkdir -p "$BK"
for f in jarvis.mjs jarvis-app.mjs jarvis-voice.mjs heartbeat.mjs; do
  [ -f "$f" ] && cp "$f" "$BK/$f"
done
[ -f lib/persona.mjs ] && cp lib/persona.mjs "$BK/persona.mjs"
echo "OK backups in $CORE/$BK"

rollback() {
  echo "x FAILED - rolling back"
  for f in jarvis.mjs jarvis-app.mjs jarvis-voice.mjs heartbeat.mjs; do
    [ -f "$BK/$f" ] && cp "$BK/$f" "$f"
  done
  if [ -f "$BK/persona.mjs" ]; then cp "$BK/persona.mjs" lib/persona.mjs; else rm -f lib/persona.mjs; fi
  rm -f .persona.new .patch-persona.new patch-persona.mjs
  echo "OK restored. Nothing changed."
  exit 1
}

mv .persona.new lib/persona.mjs
mv .patch-persona.new patch-persona.mjs
node --check lib/persona.mjs || rollback
echo "OK installed lib/persona.mjs"

# --- gate: rewire the four entry points --------------------------------------
echo "-- rewiring entry points --"
node patch-persona.mjs "$CORE" || rollback

# --- gate: every patched file must still parse -------------------------------
for f in jarvis.mjs jarvis-app.mjs jarvis-voice.mjs heartbeat.mjs; do
  node --check "$f" || rollback
done
echo "OK all four parse clean"

# --- gate: one shared persona, no inline prompts left ------------------------
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
console.log('OK all four share one persona, no inline prompts remain')
PROOF

# --- gate: prove the rendered prompts are right ------------------------------
node - <<'RENDER' || rollback
import { buildSystemPrompt, SURFACES } from './lib/persona.mjs'
const P = Object.fromEntries(SURFACES.map(s => [s, buildSystemPrompt({
  surface: s, name: 'JARVIS', toolNames: 'database, vault_read', facts: 'Facts:\n- test',
})]))
let bad = 0
const need = (c, m) => { if (!c) { console.log('x ' + m); bad++ } }
need(SURFACES.every(s => P[s].includes('warm, plain-spoken and conversational')), 'shared personality missing')
need(SURFACES.every(s => P[s].includes('NEVER claim an action happened')), 'shared honesty missing')
need(SURFACES.every(s => !P[s].includes('no proactive behaviour')), 'stale Tier-5 denial still present')
need(SURFACES.every(s => !P[s].includes('${')), 'unrendered placeholder')
need(P.voice.includes('spoken aloud'), 'voice lost its speech rule')
need(P.heartbeat.includes('UNATTENDED'), 'heartbeat lost unattended rule')
need(!P.heartbeat.includes('use remember'), 'heartbeat wrongly told to write memory')
const core = p => p.split('Honesty rules')[1].split('\n\nFacts')[0]
need(new Set(SURFACES.map(s => core(P[s]).slice(0, 300))).size === 1, 'honesty block NOT identical across surfaces')
if (bad) process.exit(1)
console.log('OK rendered prompts correct on all four surfaces')
RENDER

# --- retire the stale capital-letter self-knowledge file ---------------------
if [ -f "$CORE/SELF_KNOWLEDGE.json" ]; then
  mv "$CORE/SELF_KNOWLEDGE.json" "$BK/SELF_KNOWLEDGE.json"
  echo "OK retired stale SELF_KNOWLEDGE.json (generator writes self-knowledge.json)"
fi

rm -f patch-persona.mjs
echo
echo "OK Phase 2 installed."
echo "   Restart:  pkill -f jarvis-app.mjs; nohup node jarvis-app.mjs > logs/app.log 2>&1 &"
echo "   Rollback: cp $CORE/$BK/*.mjs $CORE/ && cp $CORE/$BK/persona.mjs $CORE/lib/"
