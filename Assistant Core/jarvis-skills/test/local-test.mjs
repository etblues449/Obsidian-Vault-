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
  // Idempotency: today's brief now exists (written above), so a second attempt
  // — the paired BST/GMT cron — must no-op instead of regenerating.
  const r = run('morning-brief', { fakeNow: '2026-07-08T10:00:00Z' });
  (r.code === 0 && /already exists|already-done/.test(r.out))
    ? ok("second attempt the same day no-ops (today's brief already exists)")
    : bad('should no-op when the period output exists', r.out);
}
{
  // THE 2026-08-02 REGRESSION TEST. Under the old exact-hour guard this run —
  // a cron delayed by ~3h, exactly what GitHub does on free runners — skipped
  // silently and reported success. It must now produce the brief.
  const r = run('morning-brief', { fakeNow: '2026-07-10T09:11:00Z' }); // 10:11 BST, brief missing
  (r.code === 0 && exists('Claude Memory/briefings/2026-07-10.md'))
    ? ok('DELAYED cron still writes the brief (was the silent-failure bug)')
    : bad('a delayed run must still produce the period output', r.out);
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
  const r = run('connection-finder', { fakeNow: '2026-07-05T16:00:00Z' }); // same Sunday, later
  (r.code === 0 && /already exists|already-done/.test(r.out))
    ? ok("second attempt the same Sunday no-ops")
    : bad('should no-op when the period output exists', r.out);
}

// 4. Weekly Synthesis — Friday 18:00 London, ISO week
console.log('Skill 4 — Weekly Synthesis (Friday 18:00 London):');
{
  const r = run('weekly-synthesis', { fakeNow: '2026-07-03T17:00:00Z' }); // Fri 18:00 BST
  (r.code === 0 && exists('Claude Memory/synthesis/2026-W27.md'))
    ? ok('fires Friday 18:00 London, writes 2026-W27.md (ISO week matches vault)')
    : bad('should fire Friday and compute W27', r.out + '\n dir: ' + (exists('Claude Memory/synthesis') ? fs.readdirSync(path.join(FIX,'Claude Memory/synthesis')).join(',') : 'none'));
}
{
  // Week-keyed, not date-keyed: a run that slips past midnight into Saturday is
  // still the same ISO week, so it must no-op rather than write a second file.
  const r = run('weekly-synthesis', { fakeNow: '2026-07-04T01:00:00Z' }); // Sat, still W27
  const files = exists('Claude Memory/synthesis') ? fs.readdirSync(path.join(FIX, 'Claude Memory/synthesis')) : [];
  (r.code === 0 && /already exists|already-done/.test(r.out) && files.length === 1)
    ? ok('slipping into Saturday no-ops (keyed on ISO week, not date)')
    : bad('week-keying should prevent a duplicate file', r.out + ' files=' + files.join(','));
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
  body.includes('<!-- week:2026-W28 -->')
    ? ok('stamps an ISO-week marker for the idempotency check')
    : bad('missing week marker', body.slice(0, 260));
  // A rolling file has no per-period path, so the marker is the only guard.
  const r2 = run('pattern-detector', { fakeNow: '2026-07-07T07:00:00Z' }); // Tue, same week
  const sections = (fs.readFileSync(pf, 'utf8').match(/<!-- week:2026-W28 -->/g) || []).length;
  (r2.code === 0 && /already exists|already-done/.test(r2.out) && sections === 1)
    ? ok('same-week re-run no-ops (rolling file gets exactly one section)')
    : bad('week marker should prevent a duplicate section', r2.out + ' sections=' + sections);
}

// 2. Capture Router — event-driven, deterministic, idempotent
// These fail on the pre-2026-08-02 behaviour: there was no router at all, root
// Inbox/ captures were invisible to the engine, and placeholder captures reached
// the corpus.
console.log('Skill 2 — Capture Router (event-driven, deterministic):');
{
  const R = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-router-'));
  const w = (rel, s) => {
    const f = path.join(R, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, s, 'utf8');
  };
  const rd = (rel) => { try { return fs.readFileSync(path.join(R, rel), 'utf8'); } catch { return ''; } };
  const has = (rel) => fs.existsSync(path.join(R, rel));

  w('JARVIS/Inbox/real.md', '---\ntype: note\n---\n\n# Boiler\n\nThe boiler needs servicing before winter.\n');
  w('JARVIS/Inbox/junk.md', '---\ntype: note\n---\n\n# Placeholder\n\nyour note here\n');
  w('JARVIS/Inbox/empty.md', '---\ntype: note\n---\n\n# Nothing\n\n   \n');
  w('JARVIS/Inbox/bel.md', '---\ntype: note\n---\n\n# Belief\n\n#belief Groq free tier is genuinely free.\n');
  w('JARVIS/Inbox/dec.md', '---\ntype: note\n---\n\n# Decision\n\n#decision Idempotency beats hour-equality.\n');
  w('Inbox/legacy.md', '---\ntype: task\n---\n\n# Legacy\n\nSet an alarm for 8am tomorrow.\n');
  w('Inbox/quick-capture.md', '---\ntype: inbox\n---\n\n# Quick Capture\n\nwidget target, not a capture\n');
  w('Claude Memory/beliefs.md', '# Beliefs\n');
  w('Claude Memory/decisions.md', '# Decisions\n');

  const runR = () => {
    const env = { ...process.env, VAULT_ROOT: R, GROQ_API_KEY: '', JARVIS_FAKE_NOW: '2026-08-02T09:00:00Z' };
    try { return { code: 0, out: execFileSync('node', [RUNNER, '--skill=capture-router'], { env, encoding: 'utf8' }) }; }
    catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') }; }
  };

  const r1 = runR();
  r1.code === 0 ? ok('router runs clean') : bad('router should exit 0', r1.out);

  // Rule 5 — never drop an unclassifiable capture
  has('JARVIS/Inbox/real.md')
    ? ok('rule 5: ordinary capture is KEPT in the inbox (never dropped)')
    : bad('ordinary capture must never be dropped', r1.out);

  // Rules 1-2 — junk quarantined, NOT deleted
  (!has('JARVIS/Inbox/junk.md') && has('JARVIS/Inbox/_rejected/junk.md'))
    ? ok('rule 2: "your note here" quarantined to _rejected/ (moved, not deleted)')
    : bad('placeholder capture should be quarantined, not deleted', r1.out);
  (!has('JARVIS/Inbox/empty.md') && has('JARVIS/Inbox/_rejected/empty.md'))
    ? ok('rule 1: empty capture quarantined to _rejected/')
    : bad('empty capture should be quarantined', r1.out);
  /REJECTED 2 placeholder/.test(r1.out)
    ? ok('rejection is LOUD in the log (not a silent drop)')
    : bad('rejection must be reported loudly', r1.out);

  // Rules 3-4 — tag routing
  /Groq free tier is genuinely free/.test(rd('Claude Memory/beliefs.md'))
    ? ok('rule 3: #belief appended to beliefs.md')
    : bad('#belief should append to beliefs.md', rd('Claude Memory/beliefs.md'));
  /Idempotency beats hour-equality/.test(rd('Claude Memory/decisions.md'))
    ? ok('rule 4: #decision appended to decisions.md')
    : bad('#decision should append to decisions.md', rd('Claude Memory/decisions.md'));

  // The split fix — legacy root Inbox/ swept into the engine's view, original kept
  (has('JARVIS/Inbox/legacy.md') && has('Inbox/legacy.md'))
    ? ok('legacy root Inbox/ capture swept into JARVIS/Inbox/ (copy, original kept)')
    : bad('legacy capture should be swept, non-destructively', r1.out);
  !has('JARVIS/Inbox/quick-capture.md')
    ? ok('widget target quick-capture.md is not swept as a capture')
    : bad('quick-capture.md is a template, not a capture', r1.out);

  // Idempotence — the whole point. on:push fires on every commit.
  const r2 = runR();
  const r3 = runR();
  const beliefCount = (rd('Claude Memory/beliefs.md').match(/<!-- capture:/g) || []).length;
  const decisionCount = (rd('Claude Memory/decisions.md').match(/<!-- capture:/g) || []).length;
  (beliefCount === 1 && decisionCount === 1)
    ? ok('idempotent: 3 runs produce exactly 1 belief + 1 decision entry')
    : bad('re-running must not duplicate entries', `beliefs=${beliefCount} decisions=${decisionCount}`);
  (/nothing new to route/.test(r2.out) && /nothing new to route/.test(r3.out))
    ? ok('re-runs report nothing-to-do (wrote=false, no empty commit)')
    : bad('re-run should be a no-op', r2.out + r3.out);

  // A genuinely new capture still routes after the no-ops
  w('JARVIS/Inbox/later.md', '---\ntype: note\n---\n\n# Later\n\n#belief Silent failures outrank loud ones.\n');
  const r4 = runR();
  ((rd('Claude Memory/beliefs.md').match(/<!-- capture:/g) || []).length === 2 && r4.code === 0)
    ? ok('a new capture arriving later still routes (log is not a freeze)')
    : bad('new captures must still route after a no-op run', r4.out);

  // The router never calls Groq — no key present anywhere in these runs
  !/GROQ_API_KEY is not set/.test(r1.out + r4.out)
    ? ok('router makes no Groq call (deterministic rules, £0, no quota)')
    : bad('router should not need Groq', r1.out);

  fs.rmSync(R, { recursive: true, force: true });
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
