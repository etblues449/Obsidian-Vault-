// patch-ledger.mjs — wire the durable ledger into the ONE shared core (lib/agent.mjs).
// Anchors are REGEX and whitespace-insensitive: exact-indent string anchors broke once
// (6 spaces assumed, 4 in the real file), so never match on leading whitespace again.
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'

const ROOT = process.argv[2] || process.env.HOME + '/jarvis-core'
const F = `${ROOT}/lib/agent.mjs`
const IMPORT =
  "import { propose, decide, markStarted, markRan, markFailed, markBlocked } from './ledger.mjs'"

if (!existsSync(F)) throw new Error('lib/agent.mjs not found at ' + ROOT)
let s = readFileSync(F, 'utf8')

if (s.includes("from './ledger.mjs'")) {
  console.log('. agent.mjs already ledgered - skipped')
  process.exit(0)
}

/** Replace the single match of `re`, appending `add` on a new line after it. */
function after(re, add, label) {
  const m = s.match(re)
  if (!m) throw new Error(`${label}: anchor not found`)
  const all = s.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))
  if (all.length !== 1) throw new Error(`${label}: found ${all.length} times, expected 1`)
  const indent = (m[0].match(/^\s*/m) || [''])[0]
  s = s.replace(re, m[0] + '\n' + add.map((l) => indent + l).join('\n'))
}

// 1. import — before the first import (multi-line imports make "after last" unsafe)
const first = s.match(/^import /m)
if (!first) throw new Error('no import lines in agent.mjs')
s = s.slice(0, first.index) + IMPORT + '\n' + s.slice(first.index)

// 2. open the entry as soon as tool + args are known, before any gate
after(
  /^[ \t]*const gated = Boolean\(tool\.requiresConfirmation\)$/m,
  [
    'const __what = gated && tool.confirmText ? tool.confirmText(check.value) : `run ${tool.name}`',
    'const __led = propose({ tool: tool.name, args: check.value, what: __what, gated })',
  ],
  'gated anchor',
)

// 3. hardline -> terminal
after(
  /^[ \t]*audit\(\{ tool: tool\.name, decision: 'blocked-hardline'.*\}\)$/m,
  ['markBlocked(__led, hard.reason)'],
  'hardline anchor',
)

// 4. safe mode -> terminal
after(
  /^[ \t]*audit\(\{ tool: tool\.name, decision: 'blocked-safe-mode'.*\}\)$/m,
  ["markBlocked(__led, 'safe mode')"],
  'safe-mode anchor',
)

// 5. the decision — this is the exact crash window the phase exists for
after(
  /^[ \t]*const allowed = confirm \? await confirm\(what\) : false$/m,
  ['decide(__led, allowed)'],
  'confirm anchor',
)

// 6. mark start immediately before the tool actually runs
after(
  /^[ \t]*const out = String\(\(await tool\.run\(check\.value\)\) \?\? 'done'\)$/m,
  [],
  'run anchor (probe)',
)
s = s.replace(
  /^([ \t]*)const out = String\(\(await tool\.run\(check\.value\)\) \?\? 'done'\)$/m,
  '$1markStarted(__led)\n$1const out = String((await tool.run(check.value)) ?? \'done\')',
)

// 7. terminals: success + failure
after(
  /^[ \t]*const scan = scanForInjection\(out\)$/m,
  ['markRan(__led)'],
  'ran anchor',
)
after(
  /^[ \t]*audit\(\{ tool: tool\.name, decision: 'error', detail: e\.message \}\)$/m,
  ['markFailed(__led, e.message)'],
  'error anchor',
)

copyFileSync(F, F + '.ledger.bak')
writeFileSync(F, s)
console.log('OK lib/agent.mjs wired to the ledger')
