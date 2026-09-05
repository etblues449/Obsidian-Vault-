#!/usr/bin/env node
// ha-export.mjs — back up Home Assistant's UI-managed config into the vault.
//
// WHY: automations, scenes and scripts live ONLY on the HA Green. One eMMC
// failure erases them. This has been the top resilience risk since 2026-08-01.
//
// WHAT IT DOES: pulls every UI-managed automation/scene/script through HA's
// config REST API and writes them into the vault as YAML (restorable) plus a
// JSON snapshot (exact, machine-readable). Re-runnable: run it any time and
// commit the diff.
//
// WHAT IT CANNOT DO: YAML-managed files (bedroom-2.yaml, frigate.yaml, the
// flashed ai_cam.yaml, ui-lovelace-minimal.yaml) are not exposed by any API.
// Those still need Studio Code Server / Samba. This script says so explicitly
// rather than implying the backup is complete.
//
//   node ha-export.mjs            write into the vault
//   node ha-export.mjs --dry      show what it would write, touch nothing

import { existsSync, mkdirSync, writeFileSync, readFileSync, renameSync, openSync, fsyncSync, closeSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const DRY = process.argv.includes('--dry')
const URL_ = (process.env.HA_URL || '').replace(/\/$/, '')
const TOK = process.env.HA_TOKEN || ''
const VAULT = process.env.VAULT_PATH || ''
const OUT_REL = 'Claude Memory/Projects/Smart Home/ha-config'

if (!URL_ || !TOK) { console.error('x HA_URL / HA_TOKEN not set'); process.exit(1) }
if (!VAULT) { console.error('x VAULT_PATH not set'); process.exit(1) }

const H = { Authorization: 'Bearer ' + TOK, 'Content-Type': 'application/json' }
const get = async (p) => {
  const r = await fetch(URL_ + p, { headers: H })
  if (r.status !== 200) return null
  return r.json()
}

// --- minimal YAML emitter (HA config is plain JSON-ish: maps, lists, scalars) --
// Verified to round-trip through PyYAML, including the classic traps:
//   "Porch: person detected"  must be quoted (": " would split the key)
//   to: 'on'                  must stay a STRING, not become boolean true
//   offset: '-00:15:00'       must stay a string, not a sexagesimal number
function yaml(v, indent = 0) {
  const pad = '  '.repeat(indent)
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'boolean' || typeof v === 'number') return String(v)
  if (typeof v === 'string') {
    if (v === '') return "''"
    if (/^[\s]|[\s]$|^[-?:,\[\]{}#&*!|>'"%@`]|: |#|\n|^(true|false|null|yes|no|on|off|~)$/i.test(v) || /^[\d.+-]+$/.test(v)) {
      return "'" + v.replace(/'/g, "''") + "'"
    }
    return v
  }
  if (Array.isArray(v)) {
    if (!v.length) return '[]'
    return '\n' + v.map((x) => {
      const s = yaml(x, indent + 1)
      return s.startsWith('\n')
        ? pad + '-' + s.replace(/\n/g, '\n')
        : pad + '- ' + s
    }).join('\n')
  }
  const keys = Object.keys(v)
  if (!keys.length) return '{}'
  return '\n' + keys.map((k) => {
    const s = yaml(v[k], indent + 1)
    return pad + k + ':' + (s.startsWith('\n') ? s : ' ' + s)
  }).join('\n')
}

function toYamlList(items) {
  return items.map((it) => {
    const body = yaml(it, 1)
    return '-' + (body.startsWith('\n') ? body.replace(/^\n {2}/, ' ').replace(/\n {2}/g, '\n  ') : ' ' + body)
  }).join('\n') + '\n'
}

/** Atomic write + read-back verification (same discipline as memory/capture). */
function writeVerified(path, body) {
  const tmp = `${path}.tmp-${process.pid}`
  try {
    const fd = openSync(tmp, 'w')
    try { writeFileSync(fd, body, 'utf8'); fsyncSync(fd) } finally { closeSync(fd) }
    renameSync(tmp, path)
  } catch (e) {
    try { if (existsSync(tmp)) unlinkSync(tmp) } catch {}
    throw e
  }
  if (readFileSync(path, 'utf8') !== body) throw new Error('write could not be verified: ' + path)
}

const main = async () => {
  const states = await get('/api/states')
  if (!states) { console.error('x cannot reach HA (is it up?)'); process.exit(1) }

  const pick = (p) => states.filter((s) => s.entity_id.startsWith(p))
  const groups = [
    { name: 'automations', prefix: 'automation.', api: 'automation' },
    { name: 'scenes', prefix: 'scene.', api: 'scene' },
    { name: 'scripts', prefix: 'script.', api: 'script' },
  ]

  const dir = join(VAULT, OUT_REL)
  if (!DRY && !existsSync(dir)) mkdirSync(dir, { recursive: true })

  const summary = []
  const snapshot = { exported: new Date().toISOString(), source: URL_, groups: {} }

  for (const g of groups) {
    const ents = pick(g.prefix)
    const configs = []
    const skipped = []
    for (const e of ents) {
      const key = g.api === 'script' ? e.entity_id.split('.')[1] : e.attributes.id
      if (!key) { skipped.push(e.entity_id); continue }
      const c = await get(`/api/config/${g.api}/config/${key}`)
      if (!c) { skipped.push(e.entity_id); continue }
      configs.push(g.api === 'script' ? { [key]: c } : { id: String(key), ...c })
    }
    snapshot.groups[g.name] = { total: ents.length, exported: configs.length, skipped }
    summary.push(`${g.name}: ${configs.length}/${ents.length} exported${skipped.length ? ` (${skipped.length} not UI-managed)` : ''}`)

    if (configs.length && !DRY) {
      const header =
        `# ${g.name}.yaml — exported from Home Assistant ${new Date().toISOString()}\n` +
        `# Source: ${URL_}  |  regenerate: node ha-export.mjs\n` +
        `# UI-managed ${g.name} only. YAML-managed packages are NOT captured here.\n`
      writeVerified(join(dir, `${g.name}.yaml`), header + toYamlList(configs))
    }
  }

  if (!DRY) {
    writeVerified(join(dir, 'snapshot.json'), JSON.stringify(snapshot, null, 2) + '\n')
    const readme =
      `# HA config backup\n\n` +
      `Exported ${new Date().toISOString()} from ${URL_} by \`ha-export.mjs\`.\n\n` +
      summary.map((s) => `- ${s}`).join('\n') + '\n\n' +
      `## What is NOT here (still hub-only)\n\n` +
      `The config REST API only exposes UI-managed items. These remain unbacked and must be\n` +
      `copied manually via Studio Code Server or Samba:\n\n` +
      `- \`bedroom-2.yaml\` (canonical bedroom config)\n` +
      `- \`frigate.yaml\`\n` +
      `- \`configuration.yaml\` and any YAML packages\n` +
      `- the flashed \`ai_cam.yaml\` from ESPHome Builder\n` +
      `- \`ui-lovelace-minimal.yaml\` / dashboard YAML\n\n` +
      `## Restore\n\n` +
      `These files mirror HA's own \`automations.yaml\` / \`scenes.yaml\` format. Copy the relevant\n` +
      `file back into \`/config/\` on the Green and restart HA. Verify against \`snapshot.json\`,\n` +
      `which records exactly what was captured and what was skipped.\n`
    writeVerified(join(dir, 'README.md'), readme)
  }

  console.log((DRY ? '[dry] ' : '') + summary.join('\n' + (DRY ? '[dry] ' : '')))
  if (!DRY) console.log(`\nwrote -> ${OUT_REL}/`)
}

main().catch((e) => { console.error('x', e.message); process.exit(1) })
