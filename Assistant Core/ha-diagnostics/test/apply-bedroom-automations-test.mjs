#!/usr/bin/env node
/*
 * Offline test for apply-bedroom-automations.sh, against a mock hub on loopback.
 *
 * The behaviour that matters most here is the REFUSALS. The script exists
 * because four automations were found enabled on the real hub pointing at
 * entities that do not exist; writing another one is the failure being
 * engineered against, so the abort paths are tested first and hardest.
 *
 * Run:  node "Assistant Core/ha-diagnostics/test/apply-bedroom-automations-test.mjs"
 */
import http from 'node:http';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'apply-bedroom-automations.sh');

let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log(`  ✓ ${n}`); };
const bad = (n, d) => { fail++; console.log(`  ✗ ${n}\n      ${d}`); };

// Live entities the real hub actually has (verified 2026-08-31), plus a real
// bedroom light and presence sensor that the real hub does NOT have.
const STATES = {
  'binary_sensor.ai_cam_2_user_button': 'off',
  'button.ai_cam_2_play_chime': 'unknown',
  'assist_satellite.landing_ai_cam_2_assist_satellite': 'idle',
  'light.real_bedroom_lamp': 'on',
  'binary_sensor.real_bedroom_presence': 'off',
  'light.dead_bulb': 'unavailable',
};
const written = [];
let reloaded = 0;

const srv = http.createServer((q, r) => {
  if (q.headers.authorization !== 'Bearer tok') { r.writeHead(401); return r.end('unauthorized'); }
  const url = new URL(q.url, 'http://x');
  const p = url.pathname;
  const json = (o, c = 200) => { r.writeHead(c, { 'Content-Type': 'application/json' }); r.end(JSON.stringify(o)); };

  if (p === '/api/' || p === '/api') return json({ message: 'API running.' });

  if (p.startsWith('/api/states/')) {
    const e = decodeURIComponent(p.slice('/api/states/'.length));
    if (e in STATES) return json({ entity_id: e, state: STATES[e], attributes: {} });
    return json({ message: 'Entity not found.' }, 404);
  }
  if (q.method === 'POST' && p.startsWith('/api/config/automation/config/')) {
    const id = p.split('/').pop();
    let body = ''; q.on('data', (c) => { body += c; });
    return q.on('end', () => {
      written.push({ id, body: JSON.parse(body) });
      STATES[`automation.${id}`] = 'on';   // it now exists, as on the real hub
      json({ result: 'ok' });
    });
  }
  if (q.method === 'POST' && p === '/api/services/automation/reload') { reloaded++; return json([]); }
  r.writeHead(404); r.end('nope');
});

await new Promise((res) => srv.listen(0, '127.0.0.1', res));
const HA_URL = `http://127.0.0.1:${srv.address().port}`;
const base = { ...process.env, HA_URL, HA_TOKEN: 'tok' };
const sh = (env) => run('sh', [SCRIPT], { env });
const reset = () => { written.length = 0; reloaded = 0;
  delete STATES['automation.bedroom_ai_cam_2_button'];
  delete STATES['automation.bedroom_enter']; delete STATES['automation.bedroom_empty']; };

// ── refusals ────────────────────────────────────────────────────────────────
console.log('\n[1] it refuses rather than writing a dead automation');

const expectAbort = async (name, env, needle) => {
  reset();
  try { await sh(env); bad(name, 'script SUCCEEDED — it should have aborted'); }
  catch (e) {
    if (!/ABORT/.test(e.stderr || '')) return bad(name, `no ABORT: ${e.stderr}`);
    if (needle && !(e.stderr || '').includes(needle)) return bad(name, `missing "${needle}" in: ${e.stderr}`);
    if (written.length) return bad(name, `it aborted but still wrote ${written.length}`);
    ok(name);
  }
};

await expectAbort('no BEDROOM_LIGHT -> abort, and say how to find it',
  { ...base }, 'NO bedroom light entity');
await expectAbort('BEDROOM_LIGHT that does not exist -> abort naming the 2026-08-31 defect',
  { ...base, BEDROOM_LIGHT: 'light.bedroom_light' }, 'DOES NOT EXIST');
await expectAbort('BEDROOM_LIGHT that is unavailable -> abort',
  { ...base, BEDROOM_LIGHT: 'light.dead_bulb' }, 'UNAVAILABLE');
await expectAbort('a bad presence sensor -> abort, and write NOTHING at all',
  { ...base, BEDROOM_LIGHT: 'light.real_bedroom_lamp', BEDROOM_PRESENCE: 'binary_sensor.nope' }, 'DOES NOT EXIST');
await expectAbort('no HA_TOKEN -> abort',
  { ...base, HA_TOKEN: '', BEDROOM_LIGHT: 'light.real_bedroom_lamp' }, 'HA_TOKEN');

// ── button only ─────────────────────────────────────────────────────────────
console.log('\n[2] button automation only (no presence sensor available)');
reset();
let out = (await sh({ ...base, BEDROOM_LIGHT: 'light.real_bedroom_lamp' })).stdout;
written.length === 1 && written[0].id === 'bedroom_ai_cam_2_button'
  ? ok('writes exactly one automation') : bad('writes exactly one', JSON.stringify(written.map(w => w.id)));
/skipping bedroom_enter/.test(out) ? ok('says which ones it skipped and why') : bad('skip notice', out);
(() => {
  const a = written[0].body;
  a.triggers[0].entity_id === 'binary_sensor.ai_cam_2_user_button' && a.triggers[0].to === 'on'
    ? ok('triggers on the verified user button') : bad('trigger', JSON.stringify(a.triggers));
  a.actions[0].target.entity_id === 'light.real_bedroom_lamp' && a.actions[0].action === 'light.toggle'
    ? ok('toggles the supplied bedroom light') : bad('toggle action', JSON.stringify(a.actions));
  a.actions[1].target.entity_id === 'button.ai_cam_2_play_chime'
    ? ok('presses the chime for feedback') : bad('chime action', JSON.stringify(a.actions));
})();
reloaded === 1 ? ok('reloads automations once') : bad('reload', String(reloaded));
/automation\.bedroom_ai_cam_2_button {2}= {2}on/.test(out)
  ? ok('reads the automation back off the hub to prove the write took') : bad('verify read-back', out);

// ── full set ────────────────────────────────────────────────────────────────
console.log('\n[3] full set (presence sensor supplied)');
reset();
out = (await sh({ ...base, BEDROOM_LIGHT: 'light.real_bedroom_lamp', BEDROOM_PRESENCE: 'binary_sensor.real_bedroom_presence' })).stdout;
JSON.stringify(written.map(w => w.id)) === JSON.stringify(['bedroom_ai_cam_2_button', 'bedroom_enter', 'bedroom_empty'])
  ? ok('writes all three, in order') : bad('three automations', JSON.stringify(written.map(w => w.id)));
(() => {
  const enter = written.find(w => w.id === 'bedroom_enter').body;
  enter.actions[0].data.brightness_pct === 70 && enter.actions[0].data.color_temp_kelvin === 4000
    ? ok('bedroom_enter keeps the original 70% / 4000K') : bad('enter data', JSON.stringify(enter.actions));
  const empty = written.find(w => w.id === 'bedroom_empty').body;
  empty.triggers[0].for.minutes === 2 ? ok('bedroom_empty keeps the 2-minute delay') : bad('for', JSON.stringify(empty.triggers));
  const c = empty.conditions[0];
  c.condition === 'not' && c.conditions[0].entity_id === 'assist_satellite.landing_ai_cam_2_assist_satellite'
    && JSON.stringify(c.conditions[0].state) === JSON.stringify(['listening', 'processing', 'responding'])
    ? ok('bedroom_empty will not kill the lights while Assist is talking') : bad('assist condition', JSON.stringify(c));
})();
/automation\.bedroom_empty {2}= {2}on/.test(out) ? ok('all three verified back') : bad('verify all', out);

srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
