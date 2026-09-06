#!/usr/bin/env node
/*
 * Offline test for io-pressure.sh against a synthetic /proc.
 *
 * The script exists to answer one binary question — is the disk the bottleneck
 * — so the tests are built around the ways it could answer that question WRONG
 * while looking fine:
 *
 *   * reading `full` where it means `some`, or avg10 where it means avg60;
 *   * dividing sectors as bytes (a 512x error, which turns a busy disk quiet);
 *   * reporting a stalled box as healthy because PSI is missing rather than low;
 *   * burying the one real device under idle loop devices.
 *
 * Run:  node "Assistant Core/ha-diagnostics/test/io-pressure-test.mjs"
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'io-pressure.sh');

let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log(`  ✓ ${n}`); };
const bad = (n, d) => { fail++; console.log(`  ✗ ${n}\n      ${String(d).slice(0, 500)}`); };
const has = (out, re, n) => (re.test(out) ? ok(n) : bad(n, out));
const not = (out, re, n) => (!re.test(out) ? ok(n) : bad(n, `unexpected ${re} in:\n${out}`));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'iopsi-'));

// A /proc/diskstats line. Field 3 name, 6 sectors read, 10 sectors written,
// 13 ms doing IO. Sectors are always 512 bytes.
const stat = (name, rd, wr, ms) =>
  `   8       0 ${name} 100 0 ${rd} 50 200 0 ${wr} 80 0 ${ms} 90 0 0 0 0 0`;

function mkproc(dir, { io = 'some avg10=0.00 avg60=0.00 avg300=0.00 total=0\nfull avg10=0.00 avg60=0.00 avg300=0.00 total=0',
                       disks = [] } = {}) {
  fs.mkdirSync(path.join(dir, 'pressure'), { recursive: true });
  if (io !== null) {
    fs.writeFileSync(path.join(dir, 'pressure', 'io'), io + '\n');
    fs.writeFileSync(path.join(dir, 'pressure', 'cpu'), 'some avg10=1.00 avg60=1.10 avg300=1.20 total=99\n');
    fs.writeFileSync(path.join(dir, 'pressure', 'memory'), 'some avg10=0.00 avg60=0.00 avg300=0.00 total=0\nfull avg10=0.00 avg60=0.00 avg300=0.00 total=0\n');
  }
  fs.writeFileSync(path.join(dir, 'diskstats'), disks.join('\n') + '\n');
  return dir;
}

const sh = (env) => run('sh', [SCRIPT], { env: { ...process.env, SAMPLE_SECS: '1', ...env }, maxBuffer: 1 << 22 });

// Section 3 legitimately contains the sentence "If PSI says IO is NOT the
// bottleneck, stop looking at the disk" as guidance. Assertions about which
// VERDICT was printed have to look at section 1 alone, or they match prose.
const verdictSection = (out) => out.split('=== 2.')[0];

// ── PSI verdicts ────────────────────────────────────────────────────────────
console.log('\n[1] it reads the right PSI number and says what it means');

// avg60 = 42 on `some`. Note the decoys: `full` and avg10 both read low, so a
// script reading the wrong line or the wrong field reports "not the bottleneck".
const busy = mkproc(path.join(TMP, 'busy'), {
  io: 'some avg10=3.00 avg60=42.50 avg300=30.00 total=12345\nfull avg10=0.10 avg60=0.20 avg300=0.30 total=99',
  disks: [stat('mmcblk0', 2048, 8192, 900)],
});
let out = (await sh({ PROC: busy })).stdout;
has(out, /io some avg60 = 42\.50%/, 'reads `some` avg60, not `full` and not avg10');
has(out, /TASKS ARE STALLED ON IO/, 'calls a 42% stall the bottleneck');
not(verdictSection(out), /IO is NOT the bottleneck/, 'does not also print the all-clear');

const quiet = mkproc(path.join(TMP, 'quiet'), { disks: [stat('mmcblk0', 4, 8, 2)] });
out = (await sh({ PROC: quiet })).stdout;
has(out, /io some avg60 = 0\.00%/, 'reads a zeroed PSI correctly');
has(out, /IO is NOT the bottleneck right now/, 'says so plainly rather than hedging');
has(out, /is NOT a disk\s*\n?\s*problem/, 'and warns not to keep blaming the disk anyway');

const mid = mkproc(path.join(TMP, 'mid'), {
  io: 'some avg10=9.00 avg60=11.00 avg300=8.00 total=500\nfull avg10=0 avg60=0 avg300=0 total=0',
  disks: [stat('mmcblk0', 100, 200, 300)],
});
out = (await sh({ PROC: mid })).stdout;
has(out, /Elevated/, '5-20% is reported as elevated, not as a verdict either way');

// ── missing PSI is not "healthy" ────────────────────────────────────────────
console.log('\n[2] absent PSI is reported as absent, never as low');

const nopsi = path.join(TMP, 'nopsi');
fs.mkdirSync(nopsi, { recursive: true });
fs.writeFileSync(path.join(nopsi, 'diskstats'), stat('sda', 200, 400, 500) + '\n');
out = (await sh({ PROC: nopsi })).stdout;
has(out, /PSI is not available on this kernel/, 'says PSI is missing');
not(verdictSection(out), /IO is NOT the bottleneck/, 'does NOT report an all-clear it cannot support');
has(out, /Section 2 still works/, 'and says what still works');

// ── device maths ────────────────────────────────────────────────────────────
console.log('\n[3] device throughput and utilisation');

// 4096 sectors written in 1s = 4096*512/1024 = 2048 KB/s. A script treating
// sectors as bytes reports 4 KB/s and calls a hammered disk idle.
const D = path.join(TMP, 'devmath');
mkproc(D, { disks: [stat('mmcblk0', 2048, 4096, 750), stat('loop0', 0, 0, 0)] });
const proc = sh({ PROC: D, SAMPLE_SECS: '1' });
await new Promise((r) => setTimeout(r, 300));
fs.writeFileSync(path.join(D, 'diskstats'),
  [stat('mmcblk0', 2048 + 2048, 4096 + 4096, 750 + 750), stat('loop0', 0, 0, 0)].join('\n') + '\n');
out = (await proc).stdout;
has(out, /mmcblk0\s+read\s+1024\.0 KB\/s\s+write\s+2048\.0 KB\/s/,
  'converts sectors to KB/s (512 bytes per sector, not 1)');
has(out, /util\s+75\.0%/, 'computes %util from io_ticks over the wall interval');
not(out, /loop0/, 'omits idle pseudo-devices instead of burying the real one');
has(out, /util is time the device had a request in flight, not bandwidth/,
  'explains that high util at low throughput means SLOW, not busy');

// ── honesty about what it cannot do ─────────────────────────────────────────
console.log('\n[4] it states its own limits');

out = (await sh({ PROC: busy })).stdout;
has(out, /cannot\s*\n?say which process is responsible/, 'admits it cannot attribute to a process');
has(out, /22222/, 'points at the host shell for per-process attribution');
has(out, /2 GB\/day is 24 KB\/s/, 'carries the arithmetic that killed the write-storm theory');
has(out, /read-only: nothing was written/, 'states it wrote nothing');

// idle box: no device activity at all must say so, not print an empty table
const idle = mkproc(path.join(TMP, 'idle'), { disks: [stat('mmcblk0', 10, 10, 10)] });
out = (await sh({ PROC: idle })).stdout;
has(out, /no device did any IO during the sample/, 'an idle sample says so explicitly');

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
