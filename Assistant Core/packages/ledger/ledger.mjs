// lib/ledger.mjs — JARVIS's durable action ledger (Phase 4: the execution gap).
//
// THE GAP THIS CLOSES
// The confirmation gate held pending approvals in `const pending = new Map()`
// inside jarvis-app.mjs — process memory. If the app died between JARVIS
// proposing a gated action and Jelly Bean approving it (Doze, battery kill,
// crash, restart), that Map vanished: the approval arrived, `pending.get(id)`
// was undefined, and NOTHING happened, silently. An action could also die
// mid-run with no record that it had ever started.
//
// Now every action is written to an append-only JSONL ledger BEFORE the gate
// opens, and its outcome is recorded after. Nothing is inferred; each state is
// a fact on disk.
//
//   proposed -> approved|declined -> started -> ran|failed
//
// SAFETY RULE — WE NEVER AUTO-REPLAY.
// An approval that never executed is NOT resumed on the next boot. Jelly Bean
// approved an action *at a moment*; silently firing it hours later (after a
// reboot, in a different context) would be exactly the kind of unrequested
// action this project forbids. Orphans are SURFACED for re-approval instead.
//
// Appends are used deliberately: an interrupted append can lose at most the
// last line, never the history (unlike a whole-file rewrite).

import {
  existsSync,
  mkdirSync,
  readFileSync,
  appendFileSync,
  writeFileSync,
  openSync,
  fsyncSync,
  closeSync,
  renameSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_PATH = join(HERE, '..', 'logs', 'ledger.jsonl')

export function ledgerPath() {
  return process.env.JARVIS_LEDGER_FILE || DEFAULT_PATH
}

function ensure() {
  const p = ledgerPath()
  const d = dirname(p)
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  if (!existsSync(p)) writeFileSync(p, '', 'utf8')
  return p
}

function newId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
}

/** Append one durable record. fsync so a crash can't lose an acknowledged write. */
function append(entry) {
  const p = ensure()
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n'
  const fd = openSync(p, 'a')
  try {
    appendFileSync(fd, line, 'utf8')
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  return entry
}

/** Read every well-formed record. A torn final line is skipped, not fatal. */
export function readLedger(limit = 0) {
  const p = ensure()
  const out = []
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t) continue
    try {
      out.push(JSON.parse(t))
    } catch {
      /* torn tail from an interrupted append — ignore */
    }
  }
  return limit > 0 ? out.slice(-limit) : out
}

// ------------------------------------------------------------------ recording

export function propose({ tool, args, what, gated = true }) {
  const id = newId()
  append({ id, state: 'proposed', tool, what, gated, args: summarise(args) })
  return id
}

export function decide(id, approved, reason) {
  append({ id, state: approved ? 'approved' : 'declined', ...(reason ? { reason } : {}) })
  return id
}

export function markStarted(id) {
  append({ id, state: 'started' })
  return id
}

export function markRan(id, detail) {
  append({ id, state: 'ran', ...(detail ? { detail: String(detail).slice(0, 200) } : {}) })
  return id
}

export function markFailed(id, detail) {
  append({ id, state: 'failed', ...(detail ? { detail: String(detail).slice(0, 300) } : {}) })
  return id
}

export function markBlocked(id, reason) {
  append({ id, state: 'blocked', ...(reason ? { reason } : {}) })
  return id
}

function summarise(args) {
  try {
    const s = JSON.stringify(args ?? {})
    return s.length > 300 ? s.slice(0, 300) + '…' : s
  } catch {
    return '(unserialisable)'
  }
}

// -------------------------------------------------------------------- replay

const TERMINAL = new Set(['ran', 'failed', 'declined', 'blocked', 'expired'])

/** Fold the append-only log into the current state of each action. */
export function states() {
  const byId = new Map()
  for (const e of readLedger()) {
    if (!e.id) continue
    const cur = byId.get(e.id) || { id: e.id, history: [] }
    if (e.tool) cur.tool = e.tool
    if (e.what) cur.what = e.what
    if (e.args) cur.args = e.args
    if (e.gated !== undefined) cur.gated = e.gated
    if (!cur.firstTs) cur.firstTs = e.ts
    cur.lastTs = e.ts
    cur.state = e.state
    cur.history.push(e.state)
    byId.set(e.id, cur)
  }
  return [...byId.values()]
}

/**
 * Actions that never reached a terminal state — the execution gap made visible.
 *   proposed  : JARVIS asked, no answer was ever recorded
 *   approved  : Jelly Bean said yes, but it never started
 *   started   : it began and never reported an outcome (died mid-run)
 */
export function openItems() {
  return states().filter((s) => !TERMINAL.has(s.state))
}

/** Mark stale open items expired so they stop being reported forever. */
export function expireOlderThan(minutes = 60) {
  const cutoff = Date.now() - minutes * 60000
  const expired = []
  for (const s of openItems()) {
    if (new Date(s.lastTs).getTime() <= cutoff) {
      append({ id: s.id, state: 'expired', reason: `no outcome within ${minutes}m` })
      expired.push(s)
    }
  }
  return expired
}

/**
 * Startup report. NEVER executes anything — it only tells the truth about what
 * was left dangling, so JARVIS can say so instead of pretending it completed.
 */
export function drainReport({ expireMinutes = 0 } = {}) {
  if (expireMinutes > 0) expireOlderThan(expireMinutes)
  const open = openItems()
  return {
    open: open.length,
    items: open.map((s) => ({
      id: s.id,
      tool: s.tool,
      what: s.what,
      state: s.state,
      since: s.lastTs,
    })),
    summary: open.length
      ? `${open.length} action(s) were left unfinished when JARVIS last stopped. They were NOT run. ` +
        open.map((s) => `"${s.what || s.tool}" (${s.state})`).join('; ')
      : 'No unfinished actions.',
  }
}

/** Compact the ledger: keep the last `keep` records. Atomic. */
export function compact(keep = 2000) {
  const all = readLedger()
  if (all.length <= keep) return { compacted: false, kept: all.length }
  const p = ledgerPath()
  const tmp = p + '.tmp-' + process.pid
  writeFileSync(tmp, all.slice(-keep).map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8')
  renameSync(tmp, p)
  return { compacted: true, kept: keep, dropped: all.length - keep }
}
