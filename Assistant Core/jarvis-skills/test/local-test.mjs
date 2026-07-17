#!/usr/bin/env node
/*
 * Local test harness for the JARVIS £0 skill runner.
 *
 * Runs entirely offline (no Groq key, no network) using --dry-run, against a
 * throwaway fixture vault built from the real vault's files. Verifies:
 *   1. Each skill's time-guard fires at the correct London instant (DST-aware)
 *      and skips at the wrong instant.
 *   2. ISO week numbering matches the real vault (2026-07-04 -> 2026-W27).
 *   3. Each skill produces its output file at the expected path with a title.
 *   4. Pattern Detector prepends (keeps prior history below the new section).
 *
 * Run:  node "Assistant Core/jarvis-skills/test/local-test.mjs"
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNNER = path.resolve(__dirname, '..', 'runner.mjs');
const REAL_VAULT = path.resolve(__dirname, '..', '..', '..');

let pass = 0, fail = 0;
const ok = (name) => { pass++; console.log(`  ✓ ${name}`); };
const bad = (name, detail) => { fail++; console.log(`  ✗ ${name}\n      ${detail}`); };

// ---- build a fixture vault ----
const FIX = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-fix-'));
function copyInto(rel) {
  const src = path.join(REAL_VAULT, rel);
  const dst = path.join(FIX, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  try { fs.copyFileSync(src, dst); } catch { /* optional */ }
}
// captures
const inboxSrc = path.join(REAL_VAULT, 'JARVIS', 'Inbox');
for (const f of fs.readdirSync(inboxSrc)) {
  if (f.toLowerCase().endsWith('.md')) copyInto(path.join('JARVIS', 'Inbox', f));
}
// context files
[
  'Claude Memory/MEMORY.md',
  'Claude Memory/patterns.md',
  'Claude Memory/decisions.md',
  'Claude Memory/beliefs.md',
  'Claude Memory/Projects/Smart Home/_index.md',
  'Claude Memory/Projects/Faceless Finance/_index.md',
  'Claude Memory/Projects/Doc to Learning/_index.md',
  'Claude Memory/Projects/Work Financial Forecasting/_index.md',
  'Claude Memory/Projects/Other Workspaces/_index.md',
].forEach(copyInto);

function run(skill, { fakeNow, force = false } = {}) {
  const a = [RUNNER, `--skill=${skill}`, '--dry-run'];
  if (force) a.push('--force');
  const env = { ...process.env, VAULT_ROOT: FIX, GROQ_API_KEY: '' };
  if (fakeNow) env.JARVIS_FAKE_NOW = fakeNow;
  try {
    const out = execFileSync('node', a, { env, encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') };
  }
}
const exists = (rel) => fs.existsSync(path.join(FIX, rel));
const read = (rel) => fs.readFileSync(path.join(FIX, rel), 'utf8');

console.log('JARVIS £0 runner — local tests\n');

// London times chosen to exercise BST (summer, UTC+1). July 2026 is BST.
// Guard hours are LOCAL London hours regardless of DST.

// 1. Morning Brief — fires daily 07:00 London
console.log('Skill 1 — Morning Brief (daily 07:00 London):');
{
  const r = run('morning-brief', { fakeNow: '2026-07-08T06:00:00Z' }); // 07:00 BST
  (r.code === 0 && exists('Claude Memory/briefings/2026-07-08.md'))
    ? ok('fires at 07:00 London, writes briefings/2026-07-08.md')
    : bad('should fire at 07:00 London', r.out);
  const body = exists('Claude Memory/briefings/2026-07-08.md') ? read('Claude Memory/briefings/2026-07-08.md') : '';
  body.includes('# Morning Brief — 2026-07-08') ? ok('has correct title') : bad('missing title', body.slice(0, 120));
}
{
  const r = run('morning-brief', { fakeNow: '2026-07-08T10:00:00Z' }); // 11:00 BST — wrong hour
  (r.code === 0 && /time-guard|Not the scheduled/.test(r.out))
    ? ok('skips at 11:00 London (guard holds)')
    : bad('should skip at wrong hour', r.out);
}

// 3. Connection Finder — Sunday 14:00 London
console.log('Skill 3 — Connection Finder (Sunday 14:00 London):');
{
  const r = run('connection-finder', { fakeNow: '2026-07-05T13:00:00Z' }); // Sun 14:00 BST
  (r.code === 0 && exists('Claude Memory/connections/2026-07-05.md'))
    ? ok('fires Sunday 14:00 London')
    : bad('should fire Sunday 14:00', r.out);
}
{
  const r = run('connection-finder', { fakeNow: '2026-07-06T13:00:00Z' }); // Mon — wrong day
  (r.code === 0 && /time-guard|Not the scheduled/.test(r.out))
    ? ok('skips on Monday (wrong weekday)')
    : bad('should skip on wrong weekday', r.out);
}

// 4. Weekly Synthesis — Friday 18:00 London, ISO week
console.log('Skill 4 — Weekly Synthesis (Friday 18:00 London):');
{
  const r = run('weekly-synthesis', { fakeNow: '2026-07-03T17:00:00Z' }); // Fri 18:00 BST
  (r.code === 0 && exists('Claude Memory/synthesis/2026-W27.md'))
    ? ok('fires Friday 18:00 London, writes 2026-W27.md (ISO week matches vault)')
    : bad('should fire Friday and compute W27', r.out + '\n dir: ' + (exists('Claude Memory/synthesis') ? fs.readdirSync(path.join(FIX,'Claude Memory/synthesis')).join(',') : 'none'));
}

// 6. Pattern Detector — Monday 08:00 London, prepend behaviour
console.log('Skill 6 — Pattern Detector (Monday 08:00 London, rolling file):');
{
  // seed a prior patterns.md with a marker we can look for after prepend
  const pf = path.join(FIX, 'Claude Memory/patterns.md');
  fs.writeFileSync(pf, '# Patterns Detected\n\n## Week ending 2026-06-30\n\nOLD-MARKER-XYZ\n');
  const r = run('pattern-detector', { fakeNow: '2026-07-06T07:00:00Z' }); // Mon 08:00 BST
  const body = fs.readFileSync(pf, 'utf8');
  (r.code === 0 && body.includes('Week ending 2026-07-06') && body.includes('OLD-MARKER-XYZ'))
    ? ok('prepends new section AND keeps prior history')
    : bad('should prepend and retain history', r.out + '\n---\n' + body.slice(0, 200));
  body.indexOf('Week ending 2026-07-06') < body.indexOf('OLD-MARKER-XYZ')
    ? ok('new section is ABOVE old history')
    : bad('ordering wrong', body.slice(0, 200));
}

// force bypasses the guard entirely
console.log('Guard bypass:');
{
  const r = run('morning-brief', { fakeNow: '2026-07-08T10:00:00Z', force: true });
  (r.code === 0 && /generating/.test(r.out)) ? ok('--force runs regardless of time') : bad('--force should run', r.out);
}

// cleanup
fs.rmSync(FIX, { recursive: true, force: true });

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
