// test/server.test.mjs — SPEC §6 / §8: listen on port 0, GET every route, open /events and receive ≥ 1
// event, traversal guard, JSON errors, SSE fan-out of logger/analyst events, clean close.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer, PUBLIC_DIR } from '../server.mjs';
import { createLogger } from '../lib/log.mjs';
import { createJournal } from '../lib/journal.mjs';
import { loadConfig } from '../lib/config.mjs';
import { fakeClock } from './helpers.mjs';

const { cfg } = loadConfig({ env: {} });

/** Minimal analyst stand-in exposing the two read models and the event surface the server uses. */
function stubAnalyst() {
  const a = new EventEmitter();
  a.snapshot = () => ({ t: 1, uptimeMs: 5, symbols: [{ id: 'BTCUSD', name: 'Bitcoin', dp: 2, feed: { state: 'live', kind: 'live', sourceNote: 'x' }, price: 100, change: { abs: 1, pct: 1, windowLabel: 'today' }, session: { id: 'london', killzone: true }, bias: { dir: 'bullish', strength: 0.5, reasons: [] }, czt: { condition: { hits: [], score: 0 }, zone: { hits: [], score: 0 }, trigger: { hits: [], score: 0 }, score: 0, grade: null, side: null }, lastSetup: null, openSetup: null, lastCandleT: 60e3, atr: 1, deltaSource: 'trades' }], limits: { setupsToday: { BTCUSD: 0 }, openCount: 0 } });
  a.chartData = (symbol, tf = '5m', limit = 500) => { if (symbol !== 'BTCUSD') throw new RangeError('unknown symbol'); return { symbol, tf, dp: 2, limit, candles: [{ t: 0, o: 1, h: 2, l: 0.5, c: 1.5, v: 1, delta: 0.1 }], ema9: [], ema21: [], ema50: [], vwap: [], cvd: [], levels: [], zones: [], markers: [], profile: null, session: { id: 'london' }, setups: [] }; };
  return a;
}

const get = (base, path, { method = 'GET' } = {}) => new Promise((resolve, reject) => {
  const req = http.request(base + path, { method }, (res) => { let body = ''; res.on('data', (d) => { body += d; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body })); });
  req.on('error', reject); req.end();
});
const sseRead = (base, path, { until, timeoutMs = 2000 } = {}) => new Promise((resolve, reject) => {
  const req = http.get(base + path, (res) => {
    let buf = '';
    const done = () => { clearTimeout(timer); req.destroy(); resolve({ status: res.statusCode, headers: res.headers, text: buf }); };
    const timer = setTimeout(done, timeoutMs);
    res.on('data', (d) => { buf += d; if (until(buf)) done(); });
    res.on('error', () => done());
    sseRead.onOpen?.(res);
  });
  req.on('error', reject);
});

describe('server', () => {
  let dir, journal, log, analyst, app, base, clock;
  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'analyst-srv-'));
    clock = fakeClock(Date.UTC(2026, 0, 13, 8, 0));
    log = createLogger({ now: clock.now, stream: null });
    journal = createJournal({ cfg, dir, now: clock.now });
    journal.record({ id: 'BTCUSD-1-long', symbol: 'BTCUSD', t: 0, tf: '5m', side: 'long', entry: 100, stop: 99, targets: [{ price: 102, label: 't', rr: 2 }], rr: 2, score: 8, grade: 'B', condition: { hits: [], session: { id: 'london' } }, zone: { hits: [] }, trigger: { kind: 'sweepReclaim', hits: [] }, reasons: [], invalidation: 'x', size: { units: 1, riskUsd: 1, riskPct: 1 }, status: 'open' });
    journal.resolveOpen('BTCUSD', { t: 10 * 60e3, o: 100, h: 102.5, l: 99.9, c: 102, v: 1, closed: true });
    analyst = stubAnalyst();
    app = createServer({ analyst, log, journal, now: clock.now, timers: clock });
    await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${app.server.address().port}`;
  });
  after(async () => { await app.close(); rmSync(dir, { recursive: true, force: true }); });

  test('GET / serves the dashboard with no-cache; vendor script and css are served with correct MIME', async () => {
    const r = await get(base, '/');
    assert.equal(r.status, 200); assert.match(r.headers['content-type'], /text\/html/); assert.equal(r.headers['cache-control'], 'no-cache');
    assert.match(r.body, /TradeGuard/);
    const js = await get(base, '/app.js'); assert.equal(js.status, 200); assert.match(js.headers['content-type'], /javascript/);
    const css = await get(base, '/app.css'); assert.equal(css.status, 200); assert.match(css.headers['content-type'], /text\/css/);
    const vendor = await get(base, '/vendor/lightweight-charts.standalone.production.js'); assert.equal(vendor.status, 200);
    const head = await get(base, '/', { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(head.body, '');
  });
  test('path traversal is refused and unknown files are 404 JSON', async () => {
    for (const p of ['/../package.json', '/%2e%2e/package.json', '/vendor/../../SPEC.md', '/..%2fpackage.json']) {
      const r = await get(base, p);
      assert.equal(r.status, 404, p); assert.deepEqual(JSON.parse(r.body), { error: 'not found' });
    }
    assert.ok(PUBLIC_DIR.endsWith('public'));
    const r = await get(base, '/nope.html'); assert.equal(r.status, 404);
  });
  test('/health, /api/state, /api/chart, /api/setups, /api/scorecard, /api/feed return valid JSON in the contract shapes', async () => {
    const h = JSON.parse((await get(base, '/health')).body);
    assert.equal(h.ok, true); assert.equal(typeof h.uptime, 'number'); assert.deepEqual(h.symbols.BTCUSD, { state: 'live', kind: 'live', lastCandleT: 60e3 });
    const s = JSON.parse((await get(base, '/api/state')).body);
    assert.equal(s.symbols[0].id, 'BTCUSD'); assert.ok(s.limits);
    const c = JSON.parse((await get(base, '/api/chart/BTCUSD?tf=15m&limit=50')).body);
    assert.equal(c.tf, '15m'); assert.equal(c.limit, 50); assert.ok(Array.isArray(c.candles));
    const bad = await get(base, '/api/chart/BTCUSD?tf=2h'); assert.equal(bad.status, 400); assert.match(JSON.parse(bad.body).error, /unknown tf/);
    const unk = await get(base, '/api/chart/XXX'); assert.equal(unk.status, 404);
    const setups = JSON.parse((await get(base, '/api/setups?symbol=BTCUSD&limit=10')).body);
    assert.equal(setups.length, 1); assert.equal(setups[0].status, 'won');
    const sc = JSON.parse((await get(base, '/api/scorecard?by=trigger')).body);
    assert.equal(sc[0].key, 'sweepReclaim'); assert.equal(sc[0].n, 1); assert.equal(sc[0].wins, 1);
    const scBad = await get(base, '/api/scorecard?by=bogus'); assert.equal(scBad.status, 400);
    log.info('BTCUSD', 'hello feed');
    const feed = JSON.parse((await get(base, '/api/feed?limit=5')).body);
    assert.ok(feed.length >= 1); assert.equal(feed[0].msg, 'hello feed'); assert.equal(feed[0].level, 'info');
    const nope = await get(base, '/api/nope'); assert.equal(nope.status, 404); assert.match(JSON.parse(nope.body).error, /no route/);
    const post = await get(base, '/api/state', { method: 'POST' }); assert.equal(post.status, 405);
  });
  test('/events streams retry + an initial status per symbol, then logger and analyst events', async () => {
    const r = await sseRead(base, '/events', { until: (b) => /event: status/.test(b) });
    assert.equal(r.status, 200); assert.match(r.headers['content-type'], /text\/event-stream/);
    assert.match(r.text, /^retry: 3000\n/);
    assert.match(r.text, /event: status\ndata: \{"symbol":"BTCUSD","state":"live","kind":"live"/);
    // fan-out: fire events once the client is subscribed, expect all three kinds to arrive
    const p = sseRead(base, '/events', { until: (b) => /event: candle/.test(b) && /event: event/.test(b) && /event: setup/.test(b) && /event: levels/.test(b) && /"state":"reconnecting"/.test(b) });
    await new Promise((r2) => setTimeout(r2, 50));
    log.signal('BTCUSD', 'a signal line');
    analyst.emit('candle', { symbol: 'BTCUSD', tf: '1m', candle: { t: 1, o: 1, h: 1, l: 1, c: 1, v: 1 } });
    analyst.emit('setup', { id: 'x', symbol: 'BTCUSD', status: 'open' });
    analyst.emit('levels', { symbol: 'BTCUSD', levels: [], zones: [], profile: null });
    analyst.emit('status', { symbol: 'BTCUSD', state: 'reconnecting', kind: 'live', detail: null });
    const r2 = await p;
    assert.match(r2.text, /event: event\ndata: \{"t":\d+,"level":"signal","symbol":"BTCUSD","msg":"a signal line"\}/);
    assert.match(r2.text, /event: candle\ndata: \{"symbol":"BTCUSD","tf":"1m"/);
    assert.match(r2.text, /event: setup\ndata: \{"id":"x"/);
    assert.match(r2.text, /event: levels\n/);
    assert.match(r2.text, /event: status\ndata: \{"symbol":"BTCUSD","state":"reconnecting"/);
    await new Promise((r3) => setTimeout(r3, 20));
    assert.equal(app.clients.size, 0, 'closed clients are dropped');
  });
  test('heartbeat comment every 15 s on the injected timer', async () => {
    const p = sseRead(base, '/events', { until: (b) => /: hb/.test(b), timeoutMs: 1000 });
    await new Promise((r2) => setTimeout(r2, 50));
    clock.tick(15_000);
    const r = await p;
    assert.match(r.text, /: hb\n\n/);
  });
});
