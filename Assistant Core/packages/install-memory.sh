#!/data/data/com.termux/files/usr/bin/sh
# Phase 3 - durable memory.
# Replaces lib/memory.mjs with an atomic, self-verifying version:
#   atomic temp-file + rename  |  .bak of the previous file  |  read-back verification
# Proven: an interrupted in-place write under the OLD code destroyed ALL facts.
#
# Safety: the test suite runs against a THROWAWAY vault in $TMPDIR - your real
# jarvis_memory.md is never written by the tests. Your real fact count is checked
# before and after, and any mismatch rolls back.
set -e
CORE="$HOME/jarvis-core"
B="https://raw.githubusercontent.com/etblues449/Obsidian-Vault-/master/Assistant%20Core/packages/memory"
SHA_MEMORY="ece12371749ef28417b0ef94d448ba5403a6c84ab6f3f35e7a76de6f5f4bba19"

echo "== Phase 3: durable memory =="
[ -d "$CORE/lib" ] || { echo "x $CORE/lib not found"; exit 1; }
cd "$CORE"

# --- record the truth BEFORE we touch anything -------------------------------
BEFORE=$(node -e "
import('./lib/env.mjs').then(async ({loadEnv}) => {
  loadEnv(process.cwd())
  const m = await import('./lib/memory.mjs')
  console.log(m.loadFacts().length)
}).catch(() => console.log('ERR'))
" 2>/dev/null | tail -1)
echo "facts before: $BEFORE"
[ "$BEFORE" = "ERR" ] && { echo "x could not read current memory - aborting"; exit 1; }

# --- fetch + verify (cache-busted; SHA alone proves integrity, not freshness) -
CB=$(date +%s)$$
curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' -A jarvis -o .memory.new "$B/memory.mjs?cb=$CB"
ACT=$(sha256sum .memory.new | cut -d' ' -f1)
if [ "$ACT" != "$SHA_MEMORY" ]; then
  echo "x SHA mismatch"; echo "   expected $SHA_MEMORY"; echo "   got      $ACT"
  rm -f .memory.new; exit 1
fi
grep -q "PHASE 3 - DURABILITY\|PHASE 3 — DURABILITY" .memory.new || {
  echo "x fetched file is not the Phase 3 version (stale cache) - aborting"; rm -f .memory.new; exit 1
}
echo "OK verified memory.mjs"

# --- back up + install --------------------------------------------------------
STAMP=$(date +%Y%m%d-%H%M%S)
BK=".memory-rollback-$STAMP"
mkdir -p "$BK"
cp lib/memory.mjs "$BK/memory.mjs"
echo "OK backup in $CORE/$BK"

rollback() {
  echo "x FAILED - rolling back"
  cp "$BK/memory.mjs" lib/memory.mjs
  rm -f .memory.new
  echo "OK restored. Nothing changed."
  exit 1
}

mv .memory.new lib/memory.mjs
node --check lib/memory.mjs || rollback
echo "OK installed lib/memory.mjs"

# --- gate 1: full behaviour suite, against a THROWAWAY vault -----------------
echo "-- durability tests (throwaway vault, your memory untouched) --"
node - <<'TESTS' || rollback
import { mkdtempSync, readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const root = mkdtempSync(join(tmpdir(), 'jmem-'))
process.env.VAULT_PATH = root
delete process.env.JARVIS_MEMORY_FILE
const m = await import('./lib/memory.mjs')
const P = m.memoryPath()
let bad = 0
const ok = (c, l) => { if (!c) { console.log('  x ' + l); bad++ } }

ok(m.loadFacts().length === 0, 'starts empty')
const a = m.addFact('tea over coffee')
ok(a.verified && a.id, 'addFact verified + id')
ok(m.loadFacts().length === 1, 'one fact')
const b = m.addFact('hub at 192.168.0.200')
const c = m.addFact('Fold 7')
ok(m.loadFacts().length === 3, 'three facts')
let threw = false; try { m.addFact('  ') } catch { threw = true }
ok(threw && m.loadFacts().length === 3, 'empty rejected, file unchanged')
const u = m.updateFact(b.id, 'hub at 192.168.0.201')
ok(u.ok && u.verified && m.loadFacts().length === 3, 'update verified, count stable')
ok(m.updateFact('no-such-fact', 'x').ok === false, 'update missing -> ok:false')
const r = m.removeFact(b.id)
ok(r.ok && m.loadFacts().length === 2, 'remove verified')
ok(m.removeFact('no-such-fact').ok === false, 'remove missing -> ok:false')
ok(existsSync(P + '.bak'), 'backup created')
ok(readdirSync(join(root, 'Claude Memory', 'Account')).filter(f => f.includes('.tmp-')).length === 0, 'no stale temp files')
ok(readFileSync(P, 'utf8').startsWith('# JARVIS Memory'), 'header intact')
writeFileSync(P, readFileSync(P, 'utf8') + '- hand written\n', 'utf8')
ok(m.loadFacts().some(f => f.text === 'hand written' && f.id === null), 'hand-written facts load')
ok(m.formatForPrompt().includes('tea over coffee'), 'formatForPrompt works')
ok(m.memoryHealth().ok === true, 'memoryHealth ok')
if (bad) process.exit(1)
console.log('OK 15/15 durability checks')
TESTS

# --- gate 2: crash safety - kill mid-write, file must stay valid -------------
echo "-- crash safety (killed mid-write) --"
node - <<'CRASH' || rollback
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
const root = mkdtempSync(join(tmpdir(), 'jcrash-'))
process.env.VAULT_PATH = root
const lib = join(process.cwd(), 'lib/memory.mjs')
const m = await import(lib)
const P = m.memoryPath()
for (let i = 0; i < 5; i++) m.addFact('seed ' + i)
const s = join(root, 'w.mjs')
writeFileSync(s, `process.env.VAULT_PATH=${JSON.stringify(root)}\nconst m=await import(${JSON.stringify(lib)})\nfor(let i=0;i<500;i++)m.addFact('churn '+i)\n`, 'utf8')
let corrupted = 0
for (let i = 0; i < 5; i++) {
  try { execFileSync('node', [s], { timeout: 40 + i * 25, stdio: 'ignore' }) } catch {}
  const t = readFileSync(P, 'utf8')
  let parses = true; try { m.loadFacts() } catch { parses = false }
  if (!t.startsWith('# JARVIS Memory') || !parses) corrupted++
}
if (corrupted) { console.log('x file corrupted ' + corrupted + '/5'); process.exit(1) }
console.log('OK killed mid-write 5x, file valid 5/5')
CRASH

# --- gate 3: YOUR real memory must be intact and unchanged in count ----------
AFTER=$(node -e "
import('./lib/env.mjs').then(async ({loadEnv}) => {
  loadEnv(process.cwd())
  const m = await import('./lib/memory.mjs')
  console.log(m.loadFacts().length)
}).catch(() => console.log('ERR'))
" 2>/dev/null | tail -1)
echo "facts after:  $AFTER"
[ "$AFTER" = "$BEFORE" ] || { echo "x real fact count changed ($BEFORE -> $AFTER)"; rollback; }
echo "OK your real memory intact ($AFTER fact(s), unchanged)"

echo
echo "OK Phase 3 installed."
echo "   Restart:  pkill -f jarvis-app.mjs; nohup node jarvis-app.mjs > logs/app.log 2>&1 &"
echo "   Rollback: cp $CORE/$BK/memory.mjs $CORE/lib/"
