// lib/memory.mjs — JARVIS's long-term memory (Tier 4).
//
// Durable facts live in ONE markdown file inside the Obsidian vault, so they
// survive restarts AND stay human-editable in Obsidian. One fact per line:
//
//     - Jelly Bean prefers tea over coffee. ^k3f9a
//
// The trailing "^id" is an Obsidian block reference — a stable handle JARVIS
// uses to update or forget that exact fact. Hand-written facts without an id
// still load fine (matched by their text).
//
// Location: JARVIS_MEMORY_FILE in .env (absolute, or relative to the vault).
// Defaults to "Claude Memory/Account/jarvis_memory.md" inside VAULT_PATH.
//
// PHASE 3 — DURABILITY. Every mutation is:
//   1. ATOMIC   — written to a temp file in the same directory, then renamed.
//                 A crash or battery-kill mid-write can no longer truncate the
//                 whole file (the old writeFileSync rewrote all facts in place,
//                 so an interrupted "remember" could destroy every memory).
//   2. BACKED UP — the previous good file is kept as <file>.bak before rename.
//   3. VERIFIED — after writing, the file is re-read from disk and the intended
//                 change confirmed. If it cannot be confirmed, the backup is
//                 restored and the call FAILS LOUDLY.
// The point: JARVIS may only say "I've remembered that" when the fact is
// provably on disk. Silent memory loss is the failure mode this closes.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  renameSync,
  copyFileSync,
  unlinkSync,
  openSync,
  fsyncSync,
  closeSync,
} from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'

const DEFAULT_REL = 'Claude Memory/Account/jarvis_memory.md'

const HEADER = `# JARVIS Memory

Durable facts JARVIS remembers about Jelly Bean, kept across restarts.
You can edit this file by hand in Obsidian — one fact per line, each starting
with "- ". The "^id" at the end of a line is a stable handle JARVIS uses to
update or forget that specific fact (Obsidian shows it as a block reference).
Leave the ids alone; the text is yours to change.

`

export function memoryPath() {
  const override = process.env.JARVIS_MEMORY_FILE
  if (override && isAbsolute(override)) return override

  const root = process.env.VAULT_PATH
  if (!root) {
    if (override) return resolve(override)
    throw new Error(
      'No memory location: set VAULT_PATH (or JARVIS_MEMORY_FILE) in .env',
    )
  }
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(
      `VAULT_PATH "${root}" doesn't exist or isn't a folder. If Termux storage isn't set up, run: termux-setup-storage`,
    )
  }
  return resolve(root, override || DEFAULT_REL)
}

export function ensureFile() {
  const path = memoryPath()
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, HEADER, 'utf8')
  }
  return path
}

const FACT_RE = /^-\s+(.*?)(?:\s+\^([A-Za-z0-9]+))?\s*$/

function parseLine(line) {
  const m = line.match(FACT_RE)
  if (!m) return null
  const text = (m[1] || '').trim()
  if (!text) return null
  return { text, id: m[2] || null }
}

function readLines() {
  const path = ensureFile()
  return readFileSync(path, 'utf8').split('\n')
}

function newId() {
  return Math.random().toString(36).slice(2, 7)
}

function clean(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+\^[A-Za-z0-9]+\s*$/, '')
    .trim()
}

export function loadFacts() {
  return readLines().map(parseLine).filter(Boolean)
}

// ------------------------------------------------------------- durable write

const BACKUP_SUFFIX = '.bak'

/**
 * Atomically replace the memory file.
 * Writes a sibling temp file, fsyncs it, keeps the old file as .bak, renames.
 * rename() within one filesystem is atomic: readers see old or new, never half.
 */
function atomicWrite(path, data) {
  const tmp = `${path}.tmp-${process.pid}`
  try {
    const fd = openSync(tmp, 'w')
    try {
      writeFileSync(fd, data, 'utf8')
      fsyncSync(fd) // force to storage before we swap it in
    } finally {
      closeSync(fd)
    }
    if (existsSync(path)) copyFileSync(path, path + BACKUP_SUFFIX)
    renameSync(tmp, path)
  } catch (e) {
    try {
      if (existsSync(tmp)) unlinkSync(tmp)
    } catch {}
    throw e
  }
}

function restoreBackup(path) {
  const bak = path + BACKUP_SUFFIX
  if (existsSync(bak)) {
    copyFileSync(bak, path)
    return true
  }
  return false
}

/**
 * Write lines, then PROVE the change landed by re-reading from disk.
 * `confirm(facts)` returns true if the intended change is present.
 * On failure the previous file is restored and an Error is thrown — callers
 * must never report success they haven't verified.
 */
function writeLinesVerified(lines, confirm, what) {
  const path = memoryPath()
  const before = existsSync(path) ? readFileSync(path, 'utf8') : null

  atomicWrite(path, lines.join('\n'))

  let facts
  try {
    facts = loadFacts()
  } catch (e) {
    restoreBackup(path)
    throw new Error(`memory write could not be verified (${what}): ${e.message}`)
  }

  if (!confirm(facts)) {
    const restored = restoreBackup(path)
    throw new Error(
      `memory write FAILED verification (${what}). ` +
        (restored
          ? 'The previous memory file has been restored.'
          : 'No backup was available — check the file by hand.'),
    )
  }

  // Guard against silent mass-loss: a single edit must never drop other facts.
  if (before !== null) {
    const beforeCount = before.split('\n').map(parseLine).filter(Boolean).length
    if (facts.length < beforeCount - 1) {
      restoreBackup(path)
      throw new Error(
        `memory write aborted (${what}): fact count fell from ${beforeCount} to ${facts.length}. Previous file restored.`,
      )
    }
  }
  return facts
}

// ------------------------------------------------------------------ mutations

export function addFact(text) {
  const clean_ = clean(text)
  if (!clean_) throw new Error('nothing to remember — the fact was empty')
  const id = newId()
  const lines = readLines()
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()
  lines.push(`- ${clean_} ^${id}`)
  lines.push('')
  writeLinesVerified(
    lines,
    (facts) => facts.some((f) => f.id === id && f.text === clean_),
    `remember "${clean_.slice(0, 40)}"`,
  )
  return { id, text: clean_, verified: true }
}

function findIndex(lines, handle) {
  const h = String(handle || '').trim()
  const hLow = h.toLowerCase()
  let exactText = -1
  let substr = -1
  for (let i = 0; i < lines.length; i++) {
    const f = parseLine(lines[i])
    if (!f) continue
    if (f.id && f.id === h) return i
    const t = f.text.toLowerCase()
    if (t === hLow && exactText === -1) exactText = i
    if (substr === -1 && (t.includes(hLow) || hLow.includes(t))) substr = i
  }
  return exactText !== -1 ? exactText : substr
}

export function updateFact(handle, newText) {
  const clean_ = clean(newText)
  if (!clean_) return { ok: false, reason: 'the new text was empty' }
  const lines = readLines()
  const i = findIndex(lines, handle)
  if (i === -1) return { ok: false, reason: `no remembered fact matches "${handle}"` }
  const before = parseLine(lines[i])
  const id = before.id || newId()
  lines[i] = `- ${clean_} ^${id}`
  try {
    writeLinesVerified(
      lines,
      (facts) => facts.some((f) => f.id === id && f.text === clean_),
      `update "${String(handle).slice(0, 30)}"`,
    )
  } catch (e) {
    return { ok: false, reason: e.message }
  }
  return { ok: true, before: before.text, after: clean_, verified: true }
}

export function removeFact(handle) {
  const lines = readLines()
  const i = findIndex(lines, handle)
  if (i === -1) return { ok: false, reason: `no remembered fact matches "${handle}"` }
  const parsed = parseLine(lines[i])
  const removed = parsed.text
  const removedId = parsed.id
  lines.splice(i, 1)
  try {
    writeLinesVerified(
      lines,
      (facts) =>
        removedId
          ? !facts.some((f) => f.id === removedId)
          : !facts.some((f) => f.text === removed),
      `forget "${removed.slice(0, 40)}"`,
    )
  } catch (e) {
    return { ok: false, reason: e.message }
  }
  return { ok: true, removed, verified: true }
}

// ------------------------------------------------------------------ read side

export function formatForPrompt() {
  let facts = []
  try {
    facts = loadFacts()
  } catch (e) {
    return 'Long-term memory: (unavailable — vault not reachable right now)'
  }
  if (!facts.length) {
    return 'Long-term memory: (empty so far — use remember to store durable facts)'
  }
  const lines = facts.map((f) => `- ${f.text}`).join('\n')
  return `Long-term memory — durable facts you know about Jelly Bean:\n${lines}`
}

/** Health check: is memory readable, and is a stale temp file lying around? */
export function memoryHealth() {
  const out = { ok: false, path: null, facts: 0, backup: false, staleTemp: [] }
  try {
    out.path = memoryPath()
    out.facts = loadFacts().length
    out.backup = existsSync(out.path + BACKUP_SUFFIX)
    out.ok = true
  } catch (e) {
    out.error = e.message
  }
  return out
}
