#!/usr/bin/env node
/*
 * Offline test harness for ha-supervisor-fix.mjs.
 *
 * No hub, no network beyond loopback, no tokens. Two layers:
 *   1. Pure logic — stale-key detection, option cleaning, and the verdict that
 *      tells "gatewayd is down" apart from "the journal is too big to scan".
 *   2. End-to-end against a mock Supervisor API on loopback, which is what
 *      actually proves the repair: dry-run must not write, --fix must POST the
 *      cleaned options with the stale keys gone and every other value intact.
 *
 * Run:  node "Assistant Core/ha-diagnostics/test/supervisor-fix-test.mjs"
 */

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  staleOptionKeys, cleanOptions, classifyLogSubsystem,
  remedySteps, authCandidates,
} from '../ha-supervisor-fix.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '..', 'ha-supervisor-fix.mjs');

let pass = 0, fail = 0;
const ok = (name) => { pass++; console.log(`  ✓ ${name}`); };
const bad = (name, detail) => { fail++; console.log(`  ✗ ${name}\n      ${detail}`); };
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  g === w ? ok(name) : bad(name, `got ${g}\n      want ${w}`);
};

// ── 1. Stale option keys ─────────────────────────────────────────────────────
console.log('\n[1] stale option keys');

// The real case from the 2026-08-30 supervisor log.
const ESPHOME_OPTIONS = {
  ssl: false,
  certfile: 'fullchain.pem',
  keyfile: 'privkey.pem',
  use_new_device_builder: true,   // dropped when Device Builder became the default
  status_use_ping: true,          // no longer in this add-on's schema
};
const ESPHOME_SCHEMA = { ssl: 'bool', certfile: 'str', keyfile: 'str', leds: { power: 'bool?' } };

eq('finds exactly the two keys supervisor warned about',
  staleOptionKeys(ESPHOME_OPTIONS, ESPHOME_SCHEMA).sort(),
  ['status_use_ping', 'use_new_device_builder']);

eq('clean schema yields nothing stale',
  staleOptionKeys({ ssl: true }, { ssl: 'bool' }), []);

eq('schema:false means the add-on accepts anything — nothing is stale',
  staleOptionKeys({ anything: 1, at: 'all' }, false), []);

eq('missing schema is treated as unknown, not as stale',
  staleOptionKeys({ a: 1 }, null), []);

eq('empty options are safe', staleOptionKeys({}, ESPHOME_SCHEMA), []);
eq('null options are safe', staleOptionKeys(null, ESPHOME_SCHEMA), []);

eq('a nested schema block still counts as a declared key',
  staleOptionKeys({ leds: { power: true } }, ESPHOME_SCHEMA), []);

// ── 2. Cleaning ──────────────────────────────────────────────────────────────
console.log('\n[2] option cleaning');

const { cleaned, removed } = cleanOptions(ESPHOME_OPTIONS, ESPHOME_SCHEMA);
eq('removes only the stale keys', removed.sort(), ['status_use_ping', 'use_new_device_builder']);
eq('keeps every surviving key and its exact value',
  cleaned, { ssl: false, certfile: 'fullchain.pem', keyfile: 'privkey.pem' });
(() => {
  // `false` is falsy: a naive filter would silently drop it and change behaviour.
  const r = cleanOptions({ ssl: false, gone: 1 }, { ssl: 'bool' });
  r.cleaned.ssl === false && !('gone' in r.cleaned)
    ? ok('a false value survives cleaning (no truthiness filtering)')
    : bad('a false value survives cleaning', JSON.stringify(r));
})();
(() => {
  cleanOptions(ESPHOME_OPTIONS, ESPHOME_SCHEMA);
  'use_new_device_builder' in ESPHOME_OPTIONS
    ? ok('the caller’s options object is not mutated')
    : bad('the caller’s options object is not mutated', 'input was modified in place');
})();

// ── 3. Verdict ───────────────────────────────────────────────────────────────
console.log('\n[3] host-log verdict');

eq('tail fast + boots fast -> healthy',
  classifyLogSubsystem({ ok: true, ms: 300 }, { ok: true, ms: 900 }).code, 'healthy');

eq('tail fast + boots FAILED -> journal too large (the logged failure)',
  classifyLogSubsystem({ ok: true, ms: 300 }, { ok: false, ms: 45000 }).code, 'journal-too-large');

eq('tail FAILED -> gatewayd down, whatever boots did',
  classifyLogSubsystem({ ok: false, ms: 25000 }, { ok: false, ms: 45000 }).code, 'gatewayd-down');

eq('boots succeeds but over supervisor’s own 20s budget -> marginal, not healthy',
  classifyLogSubsystem({ ok: true, ms: 300 }, { ok: true, ms: 26000 }).code, 'boots-marginal');

eq('a marginal result still routes to the journal remedy',
  classifyLogSubsystem({ ok: true, ms: 300 }, { ok: true, ms: 26000 }).remedy, 'journal');

remedySteps('journal').join('\n').includes('journalctl --rotate')
  ? ok('journal remedy rotates before vacuuming (vacuum only touches archived files)')
  : bad('journal remedy rotates before vacuuming', 'missing journalctl --rotate');
remedySteps('gatewayd').join('\n').includes('systemd-journal-gatewayd')
  ? ok('gatewayd remedy restarts the gateway')
  : bad('gatewayd remedy restarts the gateway', 'missing unit name');
eq('a healthy system gets no remedy steps', remedySteps(null), []);

// ── 4. Auth path selection ───────────────────────────────────────────────────
console.log('\n[4] auth paths');

eq('in-cluster token is preferred when both are present',
  authCandidates({ SUPERVISOR_TOKEN: 'x', HA_TOKEN: 'y', HA_URL: 'http://h:8123' }).map(c => c.base),
  ['http://supervisor', 'http://h:8123/api/hassio']);
eq('LAN-only falls back to the Core proxy',
  authCandidates({ HA_TOKEN: 'y', HA_URL: 'http://h:8123/' }).map(c => c.base),
  ['http://h:8123/api/hassio']);
eq('no credentials -> no candidates', authCandidates({}), []);

// ── 5. End to end against a mock Supervisor ──────────────────────────────────
console.log('\n[5] end-to-end against a mock Supervisor API');

const posted = [];
let bootsMode = 'fail'; // 'fail' | 'ok'

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname.replace(/^\/api\/hassio/, '');
  const json = (obj, code = 200) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ result: code === 200 ? 'ok' : 'error', data: obj, ...(code !== 200 ? { message: obj } : {}) }));
  };

  if (req.headers.authorization !== 'Bearer test-token') { res.writeHead(401); return res.end('unauthorized'); }

  if (p === '/supervisor/info') return json({ version: '2026.08.1' });
  if (p === '/host/info') return json({ operating_system: 'Home Assistant OS 16.2', kernel: '6.12.8', disk_total: 29, disk_used: 27, disk_free: 1 });
  if (p === '/host/logs') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('a log line\n'); }
  if (p === '/host/logs/boots') {
    if (bootsMode === 'ok') return json({ boots: { '0': 'aaaa', '-1': 'bbbb' } });
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ result: 'error', message: 'Could not get a list of boot IDs from systemd-journal-gatewayd' }));
  }
  if (p === '/addons') {
    return json({ addons: [
      { slug: '5c53de3b_esphome-beta', name: 'ESPHome Device Builder (beta)' },
      { slug: 'core_mosquitto', name: 'Mosquitto broker' },
      { slug: 'a0d7b954_ssh', name: 'Advanced SSH & Web Terminal' },
    ] });
  }
  if (p === '/addons/5c53de3b_esphome-beta/info') return json({ name: 'ESPHome Device Builder (beta)', options: ESPHOME_OPTIONS, schema: ESPHOME_SCHEMA });
  if (p === '/addons/core_mosquitto/info') return json({ name: 'Mosquitto broker', options: { logins: [], require_certificate: false }, schema: { logins: ['str'], require_certificate: 'bool' } });
  // Declares no schema at all: arbitrary options are legal and must not be touched.
  if (p === '/addons/a0d7b954_ssh/info') return json({ name: 'Advanced SSH & Web Terminal', options: { packages: ['nmap'], custom_flag: true }, schema: false });

  if (req.method === 'POST' && p.endsWith('/options')) {
    let body = '';
    req.on('data', (c) => { body += c; });
    return req.on('end', () => { posted.push({ slug: p.split('/')[2], body: JSON.parse(body) }); json({}); });
  }
  res.writeHead(404); res.end('nope');
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const ENV = { ...process.env, HA_URL: `http://127.0.0.1:${PORT}`, HA_TOKEN: 'test-token', SUPERVISOR_TOKEN: '' };
delete ENV.SUPERVISOR_TOKEN;

const execFileAsync = promisify(execFile);
const runRaw = async (extra = []) =>
  (await execFileAsync(process.execPath, [SCRIPT, ...extra], { env: ENV, encoding: 'utf8' })).stdout;
const run = async (extra = []) => JSON.parse(await runRaw(['--json', ...extra]));

// 5a. dry run
const dry = await run();
eq('dry-run reports the logged failure mode', dry.sections.host_logs.code, 'journal-too-large');
eq('dry-run flags exactly the ESPHome add-on',
  dry.sections.addon_stale_options.findings.map(f => f.slug), ['5c53de3b_esphome-beta']);
eq('dry-run names both stale keys',
  dry.sections.addon_stale_options.findings[0].stale_keys.sort(),
  ['status_use_ping', 'use_new_device_builder']);
eq('dry-run applied nothing', dry.sections.addon_stale_options.findings[0].applied, false);
eq('dry-run wrote nothing to the Supervisor', posted.length, 0);
dry.sections.host_logs.remedy_steps.join('\n').includes('--vacuum-size')
  ? ok('dry-run report carries the host repair steps')
  : bad('dry-run report carries the host repair steps', 'missing');
eq('the schema-less add-on is left alone',
  dry.sections.addon_stale_options.findings.some(f => f.slug === 'a0d7b954_ssh'), false);

// 5a-ii. the Markdown path (what actually lands in the vault)
const md = await runRaw();
[
  ['# HA Supervisor Fix', 'titled report'],
  ['## Summary', 'summary section'],
  ['## Action items (ranked)', 'ranked action items'],
  ['## Host log repair', 'host repair section appears when there is a remedy'],
  ['journalctl --vacuum-size', 'the concrete vacuum command'],
  ["stale option key(s) 'use_new_device_builder'", 'the ESPHome action item names the key'],
  ['dry-run (read-only)', 'mode is stated in the report'],
].forEach(([needle, label]) => md.includes(needle) ? ok(label) : bad(label, `not in Markdown output: ${needle}`));

const OUTFILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hasupfix-')), 'report.md');
await runRaw(['--out', OUTFILE]);
fs.existsSync(OUTFILE) && fs.readFileSync(OUTFILE, 'utf8').includes('## Summary')
  ? ok('--out writes the report to disk')
  : bad('--out writes the report to disk', 'file missing or empty');

// 5b. --fix
const fixed = await run(['--fix']);
eq('--fix POSTs exactly once', posted.length, 1);
eq('--fix POSTs to the right add-on', posted[0].slug, '5c53de3b_esphome-beta');
eq('--fix sends options with the stale keys gone and the rest untouched',
  posted[0].body, { options: { ssl: false, certfile: 'fullchain.pem', keyfile: 'privkey.pem' } });
eq('--fix records the repair as applied', fixed.sections.addon_stale_options.findings[0].applied, true);
eq('--fix keeps a verbatim before-image for reversal',
  fixed.sections.addon_stale_options.findings[0].options_before, ESPHOME_OPTIONS);

// 5c. healthy host logs
bootsMode = 'ok';
const healthy = await run();
eq('a working gatewayd reads as healthy', healthy.sections.host_logs.code, 'healthy');
eq('and produces no host-log remedy', healthy.sections.host_logs.remedy_steps, []);
eq('boot count is reported when the listing works', healthy.sections.host_logs.boots_probe.count, 2);

// 5d. --slug scoping
posted.length = 0;
const scoped = await run(['--slug', 'core_mosquitto']);
eq('--slug restricts the audit', scoped.sections.addon_stale_options.findings, []);

server.close();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
