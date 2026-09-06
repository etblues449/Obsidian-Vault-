#!/usr/bin/env node
/*
 * Offline test for journal-storm.sh, against synthetic journal files.
 *
 * The thing this script is for is ATTRIBUTION — naming the service that is
 * writing 3 GB/day into the journal. Every failure mode that matters is a
 * failure of attribution that still LOOKS like a clean run:
 *
 *   * `grep -c` on a binary journal returns 1 (no newlines), which reads as
 *     "nothing is readable" on a file packed with fields. Tested below.
 *   * dividing before multiplying turns a real storm into "0 MB/hour".
 *   * sh has no locals, so a helper can clobber a caller's variable and print
 *     the same number twice while looking fine.
 *
 * All three shipped as bugs during development and all three are pinned here.
 *
 * Run:  node "Assistant Core/ha-diagnostics/test/journal-storm-test.mjs"
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'journal-storm.sh');

let pass = 0, fail = 0;
const ok  = (n) => { pass++; console.log(`  ✓ ${n}`); };
const bad = (n, d) => { fail++; console.log(`  ✗ ${n}\n      ${String(d).slice(0, 400)}`); };
const has = (out, re, n) => (re.test(out) ? ok(n) : bad(n, out));
const not = (out, re, n) => (!re.test(out) ? ok(n) : bad(n, `unexpected ${re} in:\n${out}`));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'jstorm-'));
const mkdir = (p) => { fs.mkdirSync(p, { recursive: true }); return p; };

// A journal file is binary, contains almost NO newlines, and stores each
// distinct field value once as `NAME=value\0`. Reproduce that shape exactly —
// a fixture full of newlines would hide the grep -c bug this test exists for.
function journalBytes({ noisy = 400, quiet = 20, readable = true } = {}) {
  const parts = [Buffer.from('\xde\xad\xbe\xef'.repeat(64), 'binary')];
  if (!readable) {
    // Stand-in for an LZ4-compressed journal: no plaintext field names at all.
    parts.push(Buffer.alloc(60_000, 0x7f));
    return Buffer.concat(parts);
  }
  const f = (s) => parts.push(Buffer.from(s + '\0', 'binary'));
  f('CONTAINER_NAME=addon_core_matter_server');
  f('CONTAINER_NAME=addon_a0d7b954_ssh');
  f('SYSLOG_IDENTIFIER=matter-server');
  f('SYSLOG_IDENTIFIER=kernel');
  f('_SYSTEMD_UNIT=hassio-supervisor.service');
  for (let i = 0; i < noisy; i++) {
    f(`MESSAGE=matter node 1234 subscription resync attempt ${i} failed deadbeefcafe1234`);
    parts.push(Buffer.alloc(16, 0x11));
  }
  for (let i = 0; i < quiet; i++) {
    f(`MESSAGE=ssh: accepted publickey for root from 192.168.0.${i % 250} port ${40000 + i}`);
  }
  return Buffer.concat(parts);
}

// A storm-shaped fixture: three rotated files 11 minutes apart, one active
// file, and one corrupt-marked file that must be reported separately.
function stormDir(name) {
  const d = mkdir(path.join(TMP, name, '51f5e2d181c64d64b33e13b3a0c93847'));
  const now = Math.floor(Date.now() / 1000);
  [['system@0001.journal', 400, 2400], ['system@0002.journal', 600, 1740], ['system@0003.journal', 800, 1080]]
    .forEach(([f, n, ago]) => {
      const p = path.join(d, f);
      fs.writeFileSync(p, journalBytes({ noisy: n }));
      fs.utimesSync(p, now - ago, now - ago);
    });
  fs.writeFileSync(path.join(d, 'system.journal'), journalBytes({ noisy: 50 }));
  fs.writeFileSync(path.join(d, 'system@bad.journal~'), Buffer.alloc(1024));
  return d;
}

const sh = (env, expectFail = false) =>
  run('sh', [SCRIPT], { env: { ...process.env, SAMPLE_SECS: '0', TOP: '8', ...env }, maxBuffer: 1 << 24 })
    .then((r) => (expectFail ? { stdout: r.stdout, stderr: '', failed: false } : r))
    .catch((e) => (expectFail ? { stdout: e.stdout || '', stderr: e.stderr || '', failed: true } : Promise.reject(e)));

const fingerprint = (d) => fs.readdirSync(d).sort()
  .map((f) => `${f}:${fs.statSync(path.join(d, f)).size}:${fs.readFileSync(path.join(d, f)).length}`).join('|');

// ── refusals ────────────────────────────────────────────────────────────────
console.log('\n[1] it refuses rather than reporting a healthy-looking nothing');

let r = await sh({ JOURNAL_DIR: path.join(TMP, 'does-not-exist') }, true);
r.failed && /ABORT/.test(r.stderr) ? ok('missing directory -> ABORT, non-zero exit') : bad('missing dir', r.stderr);

const empty = mkdir(path.join(TMP, 'empty-dir'));
r = await sh({ JOURNAL_DIR: empty }, true);
r.failed && /no journal files/.test(r.stderr)
  ? ok('directory with no journal files -> ABORT, not "0 files, looks fine"') : bad('empty dir', r.stderr);

// ── inventory and cadence ───────────────────────────────────────────────────
console.log('\n[2] inventory and cadence');
const D = stormDir('storm');
const out = (await sh({ JOURNAL_DIR: D })).stdout;

has(out, /files: *5\b/, 'counts every journal file including the corrupt one');
has(out, /largest file: *\d+ KB *\(system@0003\.journal\)/, 'names the largest file');
has(out, /corrupt\/unclean: *1 file\(s\)/, 'reports the "~" file as a SEPARATE fault, not as the storm');
has(out, /rotation every: *~11 min/, 'derives the ~11 minute rotation cadence from mtimes');
has(out, /retention span: *0h 22m/, 'reports the retention span');

// Regression: `bytes/span*3600` truncates to 0 bytes/sec on a small sample and
// reports a live storm as "0 MB/hour". Multiply first.
has(out, /write rate: *~[1-9]\d* KB\/min/, 'write rate is non-zero (multiply before dividing)');
has(out, /MB\/day/, 'extrapolates to a per-day figure, which is the readable one');

// ── the grep -c trap ────────────────────────────────────────────────────────
console.log('\n[3] field counts are OCCURRENCES, not lines');

has(out, /occurrences of MESSAGE= *: *8\d\d/, 'counts 800+ MESSAGE fields in a file with no newlines');
not(out, /NEARLY NOTHING IS READABLE/, 'does NOT cry "unreadable" on a perfectly readable file');

const compressed = mkdir(path.join(TMP, 'lz4', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'));
fs.writeFileSync(path.join(compressed, 'system@0001.journal'), journalBytes({ readable: false }));
fs.writeFileSync(path.join(compressed, 'system.journal'), journalBytes({ readable: false }));
const cOut = (await sh({ JOURNAL_DIR: compressed })).stdout;
has(cOut, /NEARLY NOTHING IS READABLE/, 'DOES warn when the fields really are compressed');
has(cOut, /journalctl --file/, 'and names the host-shell fallback instead of shrugging');
has(cOut, /Do not read an empty ranking as 'nothing is logging'/, 'says an empty ranking is blindness, not absence');

// ── attribution ─────────────────────────────────────────────────────────────
console.log('\n[4] attribution — the whole point');

has(out, /addon_core_matter_server/, 'lists the containers present in the file');
has(out, /matter-server/, 'lists the syslog identifiers present');
has(out, /hassio-supervisor\.service/, 'lists the systemd units present');

const shapes = out.split('top 8 message shapes by BYTES')[1] || '';
const rows = shapes.split('\n').filter((l) => /^\s*\d+\s+\d+\s+\S/.test(l));
rows.length >= 2 ? ok('ranks at least two message shapes') : bad('shape rows', shapes);
/matter node N subscription resync attempt N failed <HEX>/.test(rows[0] || '')
  ? ok('the noisiest shape ranks FIRST, with digits->N and hex-><HEX>') : bad('top shape', rows[0]);
(() => {
  const b = rows.map((l) => Number(l.trim().split(/\s+/)[0]));
  b.every((v, i) => i === 0 || b[i - 1] >= v) ? ok('rows are ordered by bytes descending') : bad('ordering', b.join(','));
})();
has(out, /accounted for \d+ of \d+ bytes \(\d+%\)/, 'states how much of the file it actually accounted for');
has(out, /de-duplicates|stores each DISTINCT field value once/,
  'warns that occurrence counts are distinct values, not entry counts');

// ── the rotate-mid-sample branch ────────────────────────────────────────────
console.log('\n[5] live sampling handles rotation mid-sample');

const R = mkdir(path.join(TMP, 'rotate', '51f5e2d181c64d64b33e13b3a0c93847'));
fs.writeFileSync(path.join(R, 'system@0001.journal'), journalBytes({ noisy: 100 }));
fs.writeFileSync(path.join(R, 'system.journal'), Buffer.alloc(3 * 1048576, 0x22));
const proc = sh({ JOURNAL_DIR: R, SAMPLE_SECS: '3' });
await new Promise((res) => setTimeout(res, 1200));
fs.writeFileSync(path.join(R, 'system.journal'), Buffer.alloc(1 * 1048576, 0x22));  // rotated: file shrank
const rOut = (await proc).stdout;
has(rOut, /ROTATED mid-sample/, 'detects that the active file shrank');
// Regression: sh has no locals — a size helper that clobbers the caller's
// variable prints the same figure on both sides of "from X to Y".
has(rOut, /shrank from 3 MB to 1 MB/, 'reports BOTH sizes, not the same one twice');

// ── read-only ───────────────────────────────────────────────────────────────
console.log('\n[6] read-only');

const before = fingerprint(D);
await sh({ JOURNAL_DIR: D });
fingerprint(D) === before ? ok('changes no file in the journal directory') : bad('mutation', fingerprint(D));
// Word-boundaried on purpose: a bare /rm / matches inside "storm and".
not(out, /\brm\s+-|\btruncate\b|\bjournalctl\s+--rotate\b/,
  'issues no destructive command of its own');
has(out, /DO NOT VACUUM FIRST/, 'tells the operator not to destroy the evidence');
has(out, /read-only: nothing in the journal directory was written/, 'says so explicitly at the end');

// ── 8b: the truncated shape is not enough on its own ────────────────────────
console.log('\n[7] section 8b re-reads the top shapes untruncated');
has(out, /8b\. top 3 shapes, untruncated samples/, 'has an untruncated-sample section');
// Regression: the signature is derived from a NORMALISED shape. Greping the raw
// bytes for a literal still containing "N" or "<HEX>" matches nothing, and the
// section silently prints headers with no samples under them.
has(out, /matching on: "subscription resync attempt"/,
  'builds the search literal by splitting on the N/<HEX> placeholders');
has(out, /matter node 1234 subscription resync attempt \d+ failed deadbeefcafe1234/,
  'and actually finds raw samples with their real digits and hex intact');

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
