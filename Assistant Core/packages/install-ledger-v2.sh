#!/data/data/com.termux/files/usr/bin/sh
# Phase 4 - the execution gap.
# Installs lib/ledger.mjs (durable append-only action ledger) and wires it into
# lib/agent.mjs, the ONE shared core - so text, app, voice and heartbeat all get it.
#
# The gap: jarvis-app.mjs held pending approvals in `const pending = new Map()`.
# If the process died between JARVIS proposing a gated action and you approving it,
# that Map vanished, your approval hit nothing, and it failed SILENTLY.
#
# SAFETY: orphaned approvals are never auto-replayed on restart - they are surfaced
# for re-approval. Firing an action you approved hours ago, after a reboot, would be
# exactly the unrequested action this project forbids.
#
# NOTE: ledger source is fetched from ledger-v2.mjs. A raw.githubusercontent edge
# kept serving a superseded ledger.mjs from cache; a fresh path cannot be stale.
set -e
CORE="$HOME/jarvis-core"
B="https://raw.githubusercontent.com/etblues449/Obsidian-Vault-/master/Assistant%20Core/packages/ledger"

SHA_LEDGER="a9c6e2701cdf235f6d9af6eaaeccf8bcf77cef1988b051b07061dbaae7c304df"
SHA_PATCH="264c5f355c24193255a2278903d11ed6d9071a17c3d081f00c6455f8cceb26f9"
SHA_CLI="4395fbe507cded7a9c0b750b8eda96a0c427a0406fd774142503d0d9f7d1a42e"

echo "== Phase 4: durable action ledger =="
[ -d "$CORE/lib" ] || { echo "x $CORE/lib not found"; exit 1; }
cd "$CORE"

# --- fetch + verify (cache-busted: SHA proves integrity, not freshness) -------
CB=$(date +%s)$$
fetch() {
  curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' -A jarvis -o "$2" "$B/$1?cb=$CB"
  ACT=$(sha256sum "$2" | cut -d' ' -f1)
  if [ "$ACT" != "$3" ]; then
    echo "x SHA mismatch on $1"; echo "   expected $3"; echo "   got      $ACT"
    rm -f "$2"; exit 1
  fi
  echo "OK verified $1"
}
fetch ledger-v2.mjs .ledger.new "$SHA_LEDGER"
fetch patch-ledger.mjs .patch-ledger.new "$SHA_PATCH"
fetch jarvis-ledger.mjs .cli-ledger.new "$SHA_CLI"

grep -q 'Heal a torn tail' .ledger.new || { echo "x fetched ledger is not v2 (stale cache)"; rm -f .ledger.new .patch-ledger.new .cli-ledger.new; exit 1; }

# --- pre-flight: every anchor must exist exactly once BEFORE we touch anything -
echo "-- checking anchors in lib/agent.mjs --"
MISS=0
check() {
  N=$(grep -cF "$1" lib/agent.mjs || true)
  [ "$N" = "1" ] || { echo "  x anchor x$N: $1"; MISS=1; }
}
check "const gated = Boolean(tool.requiresConfirmation)"
check "decision: 'blocked-hardline'"
check "decision: 'blocked-safe-mode'"
check "const allowed = confirm ? await confirm(what) : false"
check "const out = String((await tool.run(check.value)) ?? 'done')"
check "const scan = scanForInjection(out)"
check "decision: 'error', detail: e.message"
[ "$MISS" = "0" ] || { echo "x agent.mjs does not match the expected shape - aborting, nothing changed"; rm -f .ledger.new .patch-ledger.new .cli-ledger.new; exit 1; }
echo "OK all 7 anchors present exactly once"

# --- back up ------------------------------------------------------------------
STAMP=$(date +%Y%m%d-%H%M%S)
BK=".ledger-rollback-$STAMP"
mkdir -p "$BK"
cp lib/agent.mjs "$BK/agent.mjs"
[ -f lib/ledger.mjs ] && cp lib/ledger.mjs "$BK/ledger.mjs"
echo "OK backup in $CORE/$BK"

rollback() {
  echo "x FAILED - rolling back"
  cp "$BK/agent.mjs" lib/agent.mjs
  if [ -f "$BK/ledger.mjs" ]; then cp "$BK/ledger.mjs" lib/ledger.mjs; else rm -f lib/ledger.mjs; fi
  rm -f .ledger.new .patch-ledger.new .cli-ledger.new patch-ledger.mjs
  echo "OK restored. Nothing changed."
  exit 1
}

mv .ledger.new lib/ledger.mjs
mv .cli-ledger.new jarvis-ledger.mjs
mv .patch-ledger.new patch-ledger.mjs
node --check lib/ledger.mjs || rollback
node --check jarvis-ledger.mjs || rollback
echo "OK installed lib/ledger.mjs + jarvis-ledger.mjs"

# --- gate 1: ledger behaviour, throwaway file --------------------------------
echo "-- ledger tests (throwaway log) --"
node - <<'TESTS' || rollback
import { mkdtempSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
process.env.JARVIS_LEDGER_FILE = join(mkdtempSync(join(tmpdir(), 'jl-')), 'l.jsonl')
const L = await import('./lib/ledger.mjs')
let bad = 0
const ok = (c, m) => { if (!c) { console.log('  x ' + m); bad++ } }
const a = L.propose({ tool: 't', args: {}, what: 'do a thing' })
ok(L.openItems().length === 1, 'proposed is open')
L.decide(a, true); ok(L.openItems()[0].state === 'approved', 'approved still open')
L.markStarted(a); L.markRan(a); ok(L.openItems().length === 0, 'ran closes it')
const b = L.propose({ tool: 't', args: {}, what: 'declined thing' }); L.decide(b, false)
ok(L.openItems().length === 0, 'declined terminal')
const c = L.propose({ tool: 't', args: {}, what: 'orphan' }); L.decide(c, true)
const r = L.drainReport()
ok(r.open === 1 && r.items[0].state === 'approved', 'orphaned approval surfaced')
ok(/NOT run/.test(r.summary), 'summary says NOT run')
const n1 = L.readLedger().length; L.drainReport()
ok(L.readLedger().length === n1, 'drainReport is READ-ONLY (never replays)')
ok(L.openItems().length === 1, 'orphan not auto-resolved')
appendFileSync(process.env.JARVIS_LEDGER_FILE, '{"id":"torn","sta')
let threw = false; try { L.readLedger() } catch { threw = true }
ok(!threw, 'torn tail survivable')
ok(L.expireOlderThan(0).length === 1 && L.openItems().length === 0, 'expiry works')
if (bad) process.exit(1)
console.log('OK 11/11 ledger checks')
TESTS

# --- gate 2: wire it into the shared core ------------------------------------
echo "-- wiring lib/agent.mjs --"
node patch-ledger.mjs "$CORE" || rollback
node --check lib/agent.mjs || rollback
echo "OK agent.mjs parses"

# --- gate 3: the wiring must actually be present -----------------------------
node - <<'PROOF' || rollback
import { readFileSync } from 'node:fs'
const s = readFileSync('lib/agent.mjs', 'utf8')
let bad = 0
const need = (c, m) => { if (!c) { console.log('x ' + m); bad++ } }
need(s.includes("from './ledger.mjs'"), 'import missing')
need(s.includes('const __led = propose('), 'propose missing')
need(s.includes('decide(__led, allowed)'), 'decide missing')
need(s.includes('markStarted(__led)'), 'markStarted missing')
need(s.includes('markRan(__led)'), 'markRan missing')
need(s.includes('markFailed(__led'), 'markFailed missing')
need((s.match(/markBlocked\(__led/g) || []).length === 2, 'both blocked paths missing')
if (bad) process.exit(1)
console.log('OK all 7 wiring points present')
PROOF

# --- gate 4: the app must still parse ----------------------------------------
node --check jarvis-app.mjs || rollback

rm -f patch-ledger.mjs
echo
echo "OK Phase 4 installed."
echo "   Restart:  pkill -f jarvis-app.mjs; nohup node jarvis-app.mjs > logs/app.log 2>&1 &"
echo "   Inspect:  node jarvis-ledger.mjs        (unfinished actions)"
echo "             node jarvis-ledger.mjs recent 20"
echo "   Rollback: cp $CORE/$BK/agent.mjs $CORE/lib/ && rm -f $CORE/lib/ledger.mjs"
