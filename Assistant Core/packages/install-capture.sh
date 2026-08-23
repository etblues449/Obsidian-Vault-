#!/data/data/com.termux/files/usr/bin/sh
# Phase 5 - capture tool.
# Adds tools/capture.mjs so JARVIS can write notes straight into the Obsidian vault.
#
# Retires the last paid dependency: capture used to go Tasker -> n8n.cloud webhook,
# which broke on 2026-07-09 (Tasker sent the literal string "your note here") and
# stayed broken for six weeks. Now JARVIS writes the file itself, obsidian-git syncs
# it, and the restored GitHub Actions capture router files it. No webhook, no n8n, £0.
#
# Write path is deliberate: the tool writes to the vault WORKING TREE only.
# obsidian-git stays the single committer - competing writers corrupted this vault before.
set -e
CORE="$HOME/jarvis-core"
B="https://raw.githubusercontent.com/etblues449/Obsidian-Vault-/master/Assistant%20Core/packages/capture"
SHA_CAPTURE="ae96f6cbf88442ab5d8536b8873254edc31e9f720e35079fd71253f2f0e8c22e"

echo "== Phase 5: capture tool =="
[ -d "$CORE/tools" ] || { echo "x $CORE/tools not found"; exit 1; }
cd "$CORE"

BEFORE=$(ls tools/*.mjs | wc -l)
echo "tools before: $BEFORE files"

# --- fetch + verify -----------------------------------------------------------
CB=$(date +%s)$$
curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' -A jarvis -o .capture.new "$B/capture-v1.mjs?cb=$CB"
ACT=$(sha256sum .capture.new | cut -d' ' -f1)
if [ "$ACT" != "$SHA_CAPTURE" ]; then
  echo "x SHA mismatch"; echo "   expected $SHA_CAPTURE"; echo "   got      $ACT"
  rm -f .capture.new; exit 1
fi
grep -q 'refused to capture placeholder text' .capture.new || { echo "x fetched file is not the expected version"; rm -f .capture.new; exit 1; }
echo "OK verified capture-v1.mjs"

# --- VAULT_PATH must be set, or the tool cannot work -------------------------
node -e "
import('./lib/env.mjs').then(({loadEnv}) => {
  loadEnv(process.cwd())
  if (!process.env.VAULT_PATH) { console.log('x VAULT_PATH is not set in .env'); process.exit(1) }
  console.log('OK VAULT_PATH =', process.env.VAULT_PATH)
})" || { echo "x cannot install: capture needs VAULT_PATH"; rm -f .capture.new; exit 1; }

# --- back up ------------------------------------------------------------------
STAMP=$(date +%Y%m%d-%H%M%S)
BK=".capture-rollback-$STAMP"
mkdir -p "$BK"
[ -f tools/capture.mjs ] && cp tools/capture.mjs "$BK/capture.mjs"
[ -f self-knowledge.json ] && cp self-knowledge.json "$BK/self-knowledge.json"
echo "OK backup in $CORE/$BK"

rollback() {
  echo "x FAILED - rolling back"
  if [ -f "$BK/capture.mjs" ]; then cp "$BK/capture.mjs" tools/capture.mjs; else rm -f tools/capture.mjs; fi
  [ -f "$BK/self-knowledge.json" ] && cp "$BK/self-knowledge.json" self-knowledge.json
  rm -f .capture.new
  echo "OK restored. Nothing changed."
  exit 1
}

mv .capture.new tools/capture.mjs
node --check tools/capture.mjs || rollback
echo "OK installed tools/capture.mjs"

# --- gate 1: behaviour, against a THROWAWAY vault (your real vault untouched) --
echo "-- capture tests (throwaway vault) --"
node - <<'TESTS' || rollback
import { mkdtempSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const root = mkdtempSync(join(tmpdir(), 'jcap-'))
mkdirSync(join(root, 'JARVIS', 'Inbox'), { recursive: true })
process.env.VAULT_PATH = root
const T = (await import('./tools/capture.mjs')).default
const INBOX = join(root, 'JARVIS', 'Inbox')
const files = () => readdirSync(INBOX).filter(f => f.endsWith('.md'))
let bad = 0
const ok = (c, m) => { if (!c) { console.log('  x ' + m); bad++ } }

await T.run({ text: 'Order 18650 cells for the servo rail' })
ok(files().length === 1, 'file created')
const c = readFileSync(join(INBOX, files()[0]), 'utf8')
ok(/^---\ntype: note\nproject: General\ntags: \[.*\]\ncreated: .+\nsource: jarvis\n---\n\n# /.test(c),
   'frontmatter matches existing vault captures')
ok(/# Order 18650 cells/.test(c), 'title heading')
await T.run({ text: 'Set alarm for 8am', kind: 'task', project: 'Smart Home', tags: 'alarm, school' })
const t = readFileSync(join(INBOX, files().find(f => f.startsWith('task_'))), 'utf8')
ok(/project: Smart Home/.test(t) && /tags: \[alarm, school\]/.test(t), 'kind/project/tags honoured')
for (const junk of ['your note here', 'undefined', '   ']) {
  let threw = false
  try { await T.run({ text: junk }) } catch { threw = true }
  ok(threw, `junk refused: "${junk.trim() || '(empty)'}"`)
}
const n = files().length
try { await T.run({ text: 'your note here' }) } catch {}
ok(files().length === n, 'refused capture writes no file')
ok(readdirSync(INBOX).filter(f => f.includes('.tmp-')).length === 0, 'no stale temp files')
if (bad) process.exit(1)
console.log('OK 9/9 capture checks')
TESTS

# --- gate 2: the real tool registry must load it ------------------------------
echo "-- registry load --"
node - <<'REG' || rollback
const { loadToolsFrom, allTools, getTool } = await import('./lib/tools.mjs')
await loadToolsFrom('tools')
const names = allTools().map(t => t.name).sort()
if (!names.includes('capture')) { console.log('x capture did not register'); process.exit(1) }
const t = getTool('capture')
if (typeof t.run !== 'function') { console.log('x capture has no run()'); process.exit(1) }
console.log('OK registry loads ' + names.length + ' tools: ' + names.join(', '))
REG

# --- gate 3: Phase 0 honesty - regenerate self-knowledge or the prompt lies ----
echo "-- regenerating self-knowledge (Phase 0 drift gate) --"
node self-knowledge.mjs || rollback
node self-knowledge.mjs --check || rollback

# --- gate 4: entry points still parse ----------------------------------------
for f in jarvis-app.mjs jarvis-voice.mjs jarvis.mjs heartbeat.mjs; do
  node --check "$f" || rollback
done
echo "OK all entry points parse"

AFTER=$(ls tools/*.mjs | wc -l)
echo
echo "OK Phase 5 installed. tools: $BEFORE -> $AFTER files"
echo "   Restart:  pkill -f jarvis-app.mjs; nohup node jarvis-app.mjs > logs/app.log 2>&1 &"
echo "   Try it:   say or type  \"capture: order 18650 cells\""
echo "   Rollback: rm $CORE/tools/capture.mjs && node $CORE/self-knowledge.mjs"
