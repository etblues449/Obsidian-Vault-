// tools/capture.mjs — capture a thought straight into the Obsidian vault.
//
// WHY THIS EXISTS
// jarvis-core shipped 13 tools and none of them could capture. The only route
// into the vault was Tasker -> a PAID n8n webhook, which broke on 2026-07-09
// (Tasker sent the literal placeholder "your note here") and stayed broken for
// six weeks. This tool removes that leg entirely: JARVIS writes the note itself.
//
// WRITE PATH (deliberate)
// The file is written into the vault WORKING TREE only. obsidian-git remains the
// single committer/pusher - the constraint that exists because competing writers
// corrupted this vault before. Once obsidian-git syncs, the GitHub Actions
// capture router (on: push -> master) classifies and files it.
//
// Durability mirrors lib/memory.mjs: write a temp file, fsync, rename, then read
// it back and confirm before reporting success. JARVIS may only say "captured"
// when the note is provably on disk.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  renameSync,
  unlinkSync,
  openSync,
  fsyncSync,
  closeSync,
} from 'node:fs'
import { join } from 'node:path'

const KINDS = ['note', 'task', 'idea', 'question', 'belief', 'decision']
const INBOX_REL = 'JARVIS/Inbox'

// Junk the router would quarantine anyway - refuse it at source instead.
const PLACEHOLDERS = [
  'your note here',
  'your text here',
  'placeholder',
  '%tasker',
  'null',
  'undefined',
]

function vaultRoot() {
  const root = process.env.VAULT_PATH
  if (!root) throw new Error('VAULT_PATH is not set in .env — cannot find the vault')
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`VAULT_PATH "${root}" doesn't exist or isn't a folder`)
  }
  return root
}

function slug(text, max = 45) {
  return (
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, max)
      .replace(/-+$/, '') || 'note'
  )
}

function titleOf(text) {
  const first = String(text).split(/[.\n!?]/)[0].trim()
  const t = (first || String(text)).slice(0, 80).trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function stamp(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
}

/** Atomic write + read-back verification. Never reports success it can't prove. */
function writeVerified(path, body) {
  const tmp = `${path}.tmp-${process.pid}`
  try {
    const fd = openSync(tmp, 'w')
    try {
      writeFileSync(fd, body, 'utf8')
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
    renameSync(tmp, path)
  } catch (e) {
    try {
      if (existsSync(tmp)) unlinkSync(tmp)
    } catch {}
    throw e
  }
  const back = readFileSync(path, 'utf8')
  if (back !== body) throw new Error('capture could not be verified on disk after writing')
  return path
}

export default {
  name: 'capture',
  description:
    'Save a thought, task, idea, question, belief or decision into the Obsidian vault inbox. Use whenever Jelly Bean says to note/capture/remember-for-later something that belongs in the vault rather than in long-term memory about them. Returns the file it created.',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The full content of the capture, in their words.' },
      kind: {
        type: 'string',
        description: `One of: ${KINDS.join(', ')}. Defaults to note.`,
      },
      project: {
        type: 'string',
        description: 'Optional project, e.g. "Smart Home". Defaults to General.',
      },
      tags: {
        type: 'string',
        description: 'Optional comma-separated tags, e.g. "alarm, school".',
      },
    },
    required: ['text'],
  },

  async run({ text, kind, project, tags }) {
    const body = String(text || '').trim()
    if (!body) throw new Error('nothing to capture — the text was empty')
    if (PLACEHOLDERS.some((p) => body.toLowerCase() === p || body.toLowerCase().startsWith(p))) {
      throw new Error(
        `refused to capture placeholder text ("${body.slice(0, 30)}") — this is the bug that filled the inbox with junk`,
      )
    }

    const k = KINDS.includes(String(kind || '').toLowerCase())
      ? String(kind).toLowerCase()
      : 'note'
    const proj = String(project || 'General').trim() || 'General'
    const tagList = String(tags || '')
      .split(',')
      .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''))
      .filter(Boolean)

    const now = new Date()
    const dir = join(vaultRoot(), INBOX_REL)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    const title = titleOf(body)
    let path = join(dir, `${k}_${stamp(now)}-${slug(title)}.md`)
    let n = 2
    while (existsSync(path)) {
      path = join(dir, `${k}_${stamp(now)}-${slug(title)}-${n++}.md`)
    }

    const file =
      `---\n` +
      `type: ${k}\n` +
      `project: ${proj}\n` +
      `tags: [${tagList.join(', ')}]\n` +
      `created: ${now.toISOString()}\n` +
      `source: jarvis\n` +
      `---\n\n` +
      `# ${title}\n\n` +
      `${body}\n`

    writeVerified(path, file)
    const rel = path.slice(vaultRoot().length + 1)
    return `Captured as ${k} -> ${rel}. It will sync with the vault and be filed by the capture router.`
  },
}

export { KINDS, slug, titleOf, stamp }
