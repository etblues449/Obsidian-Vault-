import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBridge, toAlert, gradeAtLeast, bridgeConfig, displayUrl } from '../lib/executor-bridge.mjs';
import { createLogger } from '../lib/log.mjs';
import { fakeFetch } from './helpers.mjs';

const strategy = JSON.parse(readFileSync(new URL('../config/strategy.json', import.meta.url), 'utf8'));
const SECRET = 'hunter2-never-in-a-log';
const URL_ = 'http://127.0.0.1:8787/webhook';

const setup = (over = {}) => ({
  id: 'XAUUSD-20260105-0805', symbol: 'XAUUSD', t: Date.UTC(2026, 0, 5, 8, 5, 0, 999), tf: '5m', side: 'long',
  entry: 4146.5, stop: 4140.2, targets: [{ price: 4160, label: 'PDH', rr: 2.14 }], rr: 2.14, score: 9.5, grade: 'A',
  ...over,
});
/** Enabled bridge config + fetch + logger, with every knob overridable. */
function harness({ cfg, env = { ANALYST_EXECUTOR_SECRET: SECRET }, routes = { [URL_]: { status: 200, json: { ok: true } } }, fetch, timeoutMs } = {}) {
  const c = structuredClone(strategy);
  c.executorBridge.enabled = true;
  if (cfg) Object.assign(c.executorBridge, cfg);
  const f = fetch ?? fakeFetch(routes);
  const log = createLogger({ stream: null, now: () => 1 });
  const bridge = createBridge({ cfg: c, fetch: f, log, now: () => 777, env, timeoutMs });
  return { bridge, fetch: f, log, cfg: c };
}
const everything = (log) => JSON.stringify(log.recent(100));

describe('pure helpers', () => {
  test('gradeAtLeast orders A > B > C and rejects unknowns', () => {
    assert.ok(gradeAtLeast('A', 'A') && gradeAtLeast('A', 'B') && gradeAtLeast('B', 'C') && gradeAtLeast('C', 'C'));
    assert.ok(!gradeAtLeast('B', 'A') && !gradeAtLeast('C', 'B') && !gradeAtLeast(undefined, 'C') && !gradeAtLeast('A', 'Z') && !gradeAtLeast('S', 'A'));
  });
  test('toAlert builds the executor body: secret, alert_id, unix seconds, BUY/SELL, entry, sl, tp', () => {
    assert.deepEqual(toAlert(setup(), 's'), { secret: 's', alert_id: 'XAUUSD-20260105-0805', time: 1767600300, side: 'BUY', entry: 4146.5, sl: 4140.2, tp: 4160 });
    assert.equal(toAlert(setup({ side: 'short' }), 's').side, 'SELL');
    assert.throws(() => toAlert(setup({ id: '' }), 's'), TypeError);
    assert.throws(() => toAlert(setup({ side: 'buy' }), 's'), TypeError);
    assert.throws(() => toAlert(setup({ targets: [] }), 's'), TypeError);
    assert.throws(() => toAlert(setup({ entry: NaN }), 's'), TypeError);
  });
  test('bridgeConfig accepts executorBridge, bridge, a bare block, and nothing', () => {
    assert.equal(bridgeConfig({ executorBridge: { enabled: true, url: 'a' } }).url, 'a');
    assert.equal(bridgeConfig({ bridge: { enabled: true, url: 'b' } }).url, 'b');
    assert.equal(bridgeConfig({ enabled: false, url: 'c' }).url, 'c');
    assert.deepEqual(bridgeConfig(null), {}); assert.deepEqual(bridgeConfig({}), {});
  });
});

describe('gates', () => {
  test('OFF by default (strategy.json): nothing is sent, nothing is fetched', async () => {
    const fetch = fakeFetch();
    const bridge = createBridge({ cfg: strategy, fetch, env: { ANALYST_EXECUTOR_SECRET: SECRET } });
    assert.deepEqual(await bridge.maybeSend(setup()), { sent: false, skipped: 'disabled' });
    assert.equal(fetch.calls.length, 0);
    assert.equal(bridge.stats().enabled, false);
  });
  test('symbol not in executorBridge.symbols → skipped with a guard line', async () => {
    const { bridge, fetch, log } = harness();
    assert.deepEqual(await bridge.maybeSend(setup({ symbol: 'BTCUSD' })), { sent: false, skipped: 'symbol' });
    assert.equal(fetch.calls.length, 0);
    assert.equal(log.recent(1)[0].level, 'guard'); assert.match(log.recent(1)[0].msg, /BTCUSD is not in executorBridge.symbols/);
  });
  test('grade below minGrade → skipped; minGrade B lets B through', async () => {
    const a = harness();
    assert.deepEqual(await a.bridge.maybeSend(setup({ grade: 'B' })), { sent: false, skipped: 'grade' });
    assert.equal(a.fetch.calls.length, 0);
    const b = harness({ cfg: { minGrade: 'B' } });
    assert.equal((await b.bridge.maybeSend(setup({ grade: 'B' }))).sent, true);
    assert.deepEqual(await b.bridge.maybeSend(setup({ id: 'c1', grade: 'C' })), { sent: false, skipped: 'grade' });
  });
  test('malformed setup → skipped invalid, with a warning', async () => {
    const { bridge, fetch, log } = harness();
    assert.deepEqual(await bridge.maybeSend(setup({ targets: [] })), { sent: false, skipped: 'invalid' });
    assert.equal(fetch.calls.length, 0);
    assert.match(log.recent(1)[0].msg, /setup rejected/);
  });
  test('no ANALYST_EXECUTOR_SECRET → skipped, warned ONCE, never fetched; the secret is read from env, never cfg', async () => {
    const { bridge, fetch, log } = harness({ env: {} });
    assert.deepEqual(await bridge.maybeSend(setup()), { sent: false, skipped: 'no-secret' });
    assert.deepEqual(await bridge.maybeSend(setup({ id: 'two' })), { sent: false, skipped: 'no-secret' });
    assert.equal(fetch.calls.length, 0);
    assert.equal(log.recent(100).filter((e) => /ANALYST_EXECUTOR_SECRET/.test(e.msg)).length, 1);
    const { bridge: b2 } = harness({ env: { ANALYST_EXECUTOR_SECRET: '' }, cfg: { secret: 'from-config-must-be-ignored' } });
    assert.equal((await b2.maybeSend(setup())).skipped, 'no-secret');
  });
  test('bad url → skipped no-url', async () => {
    const { bridge, fetch } = harness({ cfg: { url: 'ftp://nope' } });
    assert.deepEqual(await bridge.maybeSend(setup()), { sent: false, skipped: 'no-url' });
    assert.equal(fetch.calls.length, 0);
  });
});

describe('sending', () => {
  test('grade-A XAUUSD: POSTs the exact body with a 5 s abort signal, logs ok with status, returns {sent:true,status}', async () => {
    const { bridge, fetch, log } = harness();
    assert.deepEqual(await bridge.maybeSend(setup()), { sent: true, status: 200 });
    assert.equal(fetch.calls.length, 1);
    const { url, opts } = fetch.calls[0];
    assert.equal(url, URL_); assert.equal(opts.method, 'POST'); assert.equal(opts.headers['content-type'], 'application/json');
    assert.ok(opts.signal instanceof AbortSignal && !opts.signal.aborted);
    assert.deepEqual(JSON.parse(opts.body), { secret: SECRET, alert_id: 'XAUUSD-20260105-0805', time: 1767600300, side: 'BUY', entry: 4146.5, sl: 4140.2, tp: 4160 });
    const line = log.recent(1)[0];
    assert.equal(line.level, 'ok'); assert.match(line.msg, /forwarded BUY XAUUSD @ 4146.5 .*executor replied 200/);
    assert.equal(line.data.status, 200); assert.equal(line.data.alert_id, 'XAUUSD-20260105-0805');
    assert.ok(!everything(log).includes(SECRET), 'secret leaked into the log');
    assert.deepEqual(bridge.stats(), { attempted: 1, sent: 1, failed: 0, skipped: 0, lastStatus: 200, lastAt: 777, enabled: true, symbols: ['XAUUSD'], minGrade: 'A', seen: 1 });
  });
  test('short → SELL', async () => {
    const { bridge, fetch } = harness();
    await bridge.maybeSend(setup({ side: 'short', stop: 4150, targets: [{ price: 4130 }] }));
    assert.equal(JSON.parse(fetch.calls[0].opts.body).side, 'SELL');
  });
  test('dedupes by alert_id in memory — the same setup is never forwarded twice', async () => {
    const { bridge, fetch } = harness();
    await bridge.maybeSend(setup());
    assert.deepEqual(await bridge.maybeSend(setup({ entry: 9999 })), { sent: false, skipped: 'duplicate' });
    assert.equal((await bridge.maybeSend(setup({ id: 'other' }))).sent, true);
    assert.equal(fetch.calls.length, 2);
  });
  test('executor refuses (non-2xx) → sent:false with status, warn without the secret, and NO retry on that alert_id', async () => {
    const { bridge, fetch, log } = harness({ routes: { [URL_]: { status: 403, text: 'bad secret' } } });
    assert.deepEqual(await bridge.maybeSend(setup()), { sent: false, status: 403, error: 'HTTP 403' });
    const line = log.recent(1)[0];
    assert.equal(line.level, 'warn'); assert.match(line.msg, /HTTP 403 \(response body not logged\)/);
    assert.ok(!everything(log).includes('bad secret'), 'the response body never reaches the feed');
    assert.ok(!everything(log).includes(SECRET));
    assert.deepEqual(await bridge.maybeSend(setup()), { sent: false, skipped: 'duplicate' });     // a timeout may have landed: never double-fire
    assert.equal(fetch.calls.length, 1);
    assert.equal(bridge.stats().failed, 1);
  });
  test('an ECHOING 4xx endpoint cannot leak ANALYST_EXECUTOR_SECRET into any event msg/data (review finding executor-bridge.mjs:96)', async () => {
    const echo = async (_url, opts) => ({ ok: false, status: 400, text: async () => `rejected: ${opts.body}`, json: async () => JSON.parse(opts.body) });
    const { bridge, log } = harness({ fetch: echo });
    assert.deepEqual(await bridge.maybeSend(setup()), { sent: false, status: 400, error: 'HTTP 400' });
    const all = log.recent(100);
    assert.ok(all.length >= 1);
    for (const ev of all) assert.ok(!JSON.stringify(ev).includes(SECRET), `secret leaked: ${JSON.stringify(ev)}`);
    assert.ok(!everything(log).includes('rejected:'), 'body text is not logged at all');
    // a fetch error that embeds the request body is scrubbed before it is logged or returned
    const leaky = async (_url, opts) => { throw new Error(`socket hang up while sending ${opts.body}`); };
    const h2 = harness({ fetch: leaky });
    const r = await h2.bridge.maybeSend(setup());
    assert.equal(r.sent, false);
    assert.ok(!r.error.includes(SECRET) && r.error.includes('[redacted]'), r.error);
    assert.ok(!everything(h2.log).includes(SECRET));
  });

  test('the URL is logged without userinfo, and a URL carrying user:password@ is refused (review finding executor-bridge.mjs:84)', async () => {
    assert.equal(displayUrl('http://user:pw@127.0.0.1:8787/webhook'), 'http://127.0.0.1:8787/webhook');
    assert.equal(displayUrl('http://127.0.0.1:8787/webhook?x=1'), 'http://127.0.0.1:8787/webhook?x=1');
    assert.equal(displayUrl('not a url'), 'not a url');
    const { bridge, fetch, log } = harness({ cfg: { url: 'http://alice:s3cret@127.0.0.1:8787/webhook' } });
    assert.deepEqual(await bridge.maybeSend(setup()), { sent: false, skipped: 'no-url' });
    assert.equal(fetch.calls.length, 0);
    assert.ok(!everything(log).includes('s3cret'), 'the password never reaches the feed');
    assert.match(log.recent(1)[0].msg, /credentials — refused/);
    const ok = harness();
    await ok.bridge.maybeSend(setup());
    assert.equal(ok.log.recent(1)[0].data.url, URL_);
  });

  test('network failure → sent:false with the error message; never throws', async () => {
    const { bridge, log } = harness({ routes: { [URL_]: new Error('ECONNREFUSED 127.0.0.1:8787') } });
    assert.deepEqual(await bridge.maybeSend(setup()), { sent: false, error: 'ECONNREFUSED 127.0.0.1:8787' });
    assert.match(log.recent(1)[0].msg, /could not reach the executor .* ECONNREFUSED/);
    assert.ok(!everything(log).includes(SECRET));
  });
  test('a hung executor is abandoned by the AbortController after timeoutMs', async () => {
    const hung = async (_url, opts) => new Promise((_, reject) => opts.signal.addEventListener('abort', () => reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }))));
    const { bridge, log } = harness({ fetch: hung, timeoutMs: 20 });
    const t0 = Date.now();
    assert.deepEqual(await bridge.maybeSend(setup()), { sent: false, error: 'timeout after 20 ms' });
    assert.ok(Date.now() - t0 < 2000);
    assert.match(log.recent(1)[0].msg, /timeout after 20 ms/);
    assert.equal(bridge.stats().lastStatus, null);
  });
  test('a fetch that resolves with no usable body/status is handled', async () => {
    const weird = async () => ({ ok: false, status: 502 });
    const { bridge } = harness({ fetch: weird });
    assert.deepEqual(await bridge.maybeSend(setup()), { sent: false, status: 502, error: 'HTTP 502' });
  });
  test('works without a logger and with the `bridge` config alias', async () => {
    const fetch = fakeFetch({ [URL_]: { status: 201 } });
    const bridge = createBridge({ cfg: { bridge: { enabled: true, url: URL_, symbols: ['XAUUSD'], minGrade: 'A' } }, fetch, env: { ANALYST_EXECUTOR_SECRET: SECRET } });
    assert.deepEqual(await bridge.maybeSend(setup()), { sent: true, status: 201 });
    assert.deepEqual(await bridge.maybeSend(setup({ symbol: 'OIL' })), { sent: false, skipped: 'symbol' });
  });
  test('maybeSend never throws on garbage input', async () => {
    const { bridge } = harness();
    assert.deepEqual(await bridge.maybeSend(null), { sent: false, skipped: 'symbol' });
    assert.deepEqual(await bridge.maybeSend({ symbol: 'XAUUSD' }), { sent: false, skipped: 'grade' });
    assert.deepEqual(await bridge.maybeSend({ symbol: 'XAUUSD', grade: 'A' }), { sent: false, skipped: 'invalid' });
  });
});
