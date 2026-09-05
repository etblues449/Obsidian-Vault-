#!/usr/bin/env node
// jarvis-ledger.mjs — inspect JARVIS's durable action ledger.
//
//   node jarvis-ledger.mjs            unfinished actions (the execution gap)
//   node jarvis-ledger.mjs recent 20  last N records
//   node jarvis-ledger.mjs expire 60  mark open items older than N minutes expired
//   node jarvis-ledger.mjs compact    trim the log, keep the last 2000 records
//
// Nothing here executes a JARVIS action. Orphaned approvals are reported for
// re-approval, never replayed.
import { drainReport, readLedger, expireOlderThan, compact, ledgerPath } from './lib/ledger.mjs'

const [cmd = 'open', arg] = process.argv.slice(2)

if (cmd === 'open') {
  const r = drainReport()
  console.log(r.summary)
  for (const i of r.items) {
    console.log(`  ${i.state.padEnd(9)} ${i.tool || '?'}  ${i.what || ''}  (since ${i.since})`)
  }
  if (r.open) console.log('\nThese were NOT run. Ask JARVIS again if you still want them.')
} else if (cmd === 'recent') {
  for (const e of readLedger(Number(arg) || 20)) {
    console.log(`${e.ts}  ${String(e.state).padEnd(9)} ${e.tool || ''} ${e.what || e.reason || e.detail || ''}`)
  }
} else if (cmd === 'expire') {
  const n = expireOlderThan(Number(arg) || 60)
  console.log(`expired ${n.length} open item(s) older than ${Number(arg) || 60}m`)
} else if (cmd === 'compact') {
  console.log(JSON.stringify(compact(Number(arg) || 2000)))
} else if (cmd === 'path') {
  console.log(ledgerPath())
} else {
  console.log('usage: node jarvis-ledger.mjs [open|recent N|expire N|compact|path]')
  process.exit(1)
}
