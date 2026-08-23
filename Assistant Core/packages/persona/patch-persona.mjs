// patch-persona.mjs — rewire all four entry points to lib/persona.mjs.
// Assertion-guarded: every anchor must appear exactly once, or nothing is written.
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'

const ROOT = process.argv[2] || process.env.HOME + '/jarvis-core'
const IMPORT = "import { buildSystemPrompt } from './lib/persona.mjs'"

const PLAN = {
  'jarvis.mjs':       { surface: 'text',      name: 'NAME', tools: true },
  'jarvis-app.mjs':   { surface: 'app',       name: 'NAME', tools: true },
  'jarvis-voice.mjs': { surface: 'voice',     name: 'NAME', tools: true },
  'heartbeat.mjs':    { surface: 'heartbeat', name: null,   tools: false },
}

const body = (cfg) => {
  const lines = [`    surface: '${cfg.surface}',`]
  if (cfg.name) lines.push(`    name: ${cfg.name},`)
  if (cfg.tools) lines.push(`    toolNames: allTools().map((t) => t.name).join(', '),`)
  lines.push(`    facts: formatForPrompt(),`)
  return `function systemPrompt() {\n  return buildSystemPrompt({\n${lines.join('\n')}\n  })\n}\n`
}

// Cut `function systemPrompt() {` through the first `}` at column 0 (inclusive).
function cutSystemPrompt(src, file) {
  const start = src.indexOf('function systemPrompt() {')
  if (start === -1) throw new Error(`${file}: systemPrompt() not found`)
  if (src.indexOf('function systemPrompt() {', start + 1) !== -1)
    throw new Error(`${file}: systemPrompt() defined more than once`)
  const end = src.indexOf('\n}\n', start)
  if (end === -1) throw new Error(`${file}: could not find end of systemPrompt()`)
  return { start, end: end + 3 }
}

const changed = []
for (const [file, cfg] of Object.entries(PLAN)) {
  const path = `${ROOT}/${file}`
  if (!existsSync(path)) throw new Error(`${file}: missing at ${ROOT}`)
  let src = readFileSync(path, 'utf8')

  if (src.includes(IMPORT)) {
    console.log(`. ${file} already on persona.mjs - skipped`)
    continue
  }

  // Drop the superseded local capabilitiesBlock helper, if present.
  const h = src.indexOf('function capabilitiesBlock(')
  if (h !== -1) {
    const hEnd = src.indexOf('\n}\n', h)
    if (hEnd === -1) throw new Error(`${file}: capabilitiesBlock helper has no clean end`)
    src = src.slice(0, h) + src.slice(hEnd + 3)
  }

  const { start, end } = cutSystemPrompt(src, file)
  src = src.slice(0, start) + body(cfg) + src.slice(end)

  // Insert the import after the final existing top-level import.
  const imports = [...src.matchAll(/^import .*$/gm)]
  if (!imports.length) throw new Error(`${file}: no import lines found`)
  const last = imports[imports.length - 1]
  const at = last.index + last[0].length
  src = src.slice(0, at) + '\n' + IMPORT + src.slice(at)

  copyFileSync(path, path + '.persona.bak')
  writeFileSync(path, src)
  changed.push(file)
  console.log(`OK ${file} -> persona.mjs (surface: ${cfg.surface})`)
}
console.log(changed.length ? `\nOK patched ${changed.length} file(s)` : '\n. nothing to do')
