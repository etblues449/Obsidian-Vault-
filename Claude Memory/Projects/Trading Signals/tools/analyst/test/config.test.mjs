import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig, validateStrategy, validateSymbols, applyEnv, ConfigError, CONFIG_DIR, KNOWN_FEEDS, WEIGHT_KEYS, envKeyForSymbol } from '../lib/config.mjs';
import { createLogger, Logger, RingBuffer, redact, LEVELS } from '../lib/log.mjs';
import { fakeClock, fakeWebSocket, fakeFetch, loadFixture } from './helpers.mjs';

const base = () => loadConfig({ env: {} });
const withStrategy = (mut) => { const { cfg } = base(); mut(cfg); return validateStrategy(cfg); };
const withSymbols = (mut) => { const { symbolsCfg } = base(); mut(symbolsCfg); return validateSymbols(symbolsCfg); };

describe('loadConfig', () => {
  test('the shipped configs load clean with no env', () => {
    const out = base();
    assert.deepEqual(validateStrategy(out.cfg), []);
    assert.deepEqual(validateSymbols(out.symbolsCfg), []);
    assert.deepEqual(out.server, { host: '127.0.0.1', port: 8080 });
    assert.deepEqual(out.applied, []);
    assert.deepEqual(out.warnings, []);
    assert.equal(out.paths.strategy, join(CONFIG_DIR, 'strategy.json'));
    assert.deepEqual(out.symbolsCfg.symbols.map((s) => s.id), ['BTCUSD', 'NQ1!', 'XAUUSD', 'OIL']);
    assert.equal(out.cfg.sessions.timezone, 'Europe/London');
    assert.equal(out.cfg.timeframes.analysis, '5m');
    assert.ok(WEIGHT_KEYS.every((k) => typeof out.cfg.czt.weights[k] === 'number'));
  });
  test('objects can be passed instead of files; env is isolated from process.env', () => {
    const { cfg, symbolsCfg } = base();
    const out = loadConfig({ strategy: cfg, symbols: symbolsCfg, env: { ANALYST_PORT: '9090' } });
    assert.equal(out.server.port, 9090);
    assert.notEqual(out.cfg, cfg, 'returns a clone, never the caller\'s object');
  });
  test('missing or malformed files produce a ConfigError naming the path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'analyst-cfg-'));
    try {
      assert.throws(() => loadConfig({ dir, env: {} }), (e) => e instanceof ConfigError && /cannot read .*strategy\.json/.test(e.message));
      writeFileSync(join(dir, 'strategy.json'), '{ not json');
      assert.throws(() => loadConfig({ dir, env: {} }), (e) => e instanceof ConfigError && /not valid JSON/.test(e.message));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  test('every problem is reported at once, prefixed by file', () => {
    const { cfg, symbolsCfg } = base();
    cfg.czt.minScore = -1;
    cfg.timeframes.analysis = '2h';
    symbolsCfg.symbols[0].feed = 'bloomberg';
    let err;
    try { loadConfig({ strategy: cfg, symbols: symbolsCfg, env: {} }); } catch (e) { err = e; }
    assert.ok(err instanceof ConfigError);
    assert.equal(err.name, 'ConfigError');
    assert.ok(err.issues.length >= 3, err.message);
    assert.ok(err.issues.some((s) => s.startsWith('strategy.json czt.minScore')));
    assert.ok(err.issues.some((s) => s.startsWith('strategy.json timeframes.analysis')));
    assert.ok(err.issues.some((s) => s.startsWith('symbols.json symbols[0].feed')));
    assert.match(err.message, /3 problems|[4-9] problems/);
  });
});

describe('validateStrategy', () => {
  test('timeframes: unknown TF, base must be 1m, roles must coarsen', () => {
    assert.ok(withStrategy((c) => { c.timeframes.available.push('2h'); }).some((s) => s.includes('available[5]')));
    assert.ok(withStrategy((c) => { c.timeframes.base = '5m'; }).some((s) => s.includes('timeframes.base')));
    assert.ok(withStrategy((c) => { c.timeframes.htf = '15m'; }).some((s) => s.includes('timeframes.htf') && s.includes('finer')));
    assert.ok(withStrategy((c) => { c.timeframes.bias = '4h'; c.timeframes.htf = '1h'; }).some((s) => s.includes('timeframes.htf')));
    assert.deepEqual(withStrategy((c) => { c.timeframes.structure = '5m'; }), [], 'equal TFs are allowed');
  });
  test('sessions: timezone, HH:MM syntax, day coverage, killzone inside session', () => {
    assert.ok(withStrategy((c) => { c.sessions.timezone = 'Mars/Olympus'; }).some((s) => s.includes('sessions.timezone')));
    assert.ok(withStrategy((c) => { c.sessions.list[1].start = '7am'; }).some((s) => s.includes('sessions.list[1].start')));
    assert.ok(withStrategy((c) => { c.sessions.list[1].end = '11:00'; }).some((s) => s.includes('gap between 11:00 and 12:00')));
    assert.ok(withStrategy((c) => { c.sessions.list[1].end = '13:00'; }).some((s) => s.includes('overlaps')));
    assert.ok(withStrategy((c) => { c.sessions.list[3].end = '23:00'; }).some((s) => s.includes('day not covered after 23:00')));
    assert.ok(withStrategy((c) => { c.sessions.list[1].killzone.end = '12:30'; }).some((s) => s.includes('killzone') && s.includes('inside')));
    assert.ok(withStrategy((c) => { c.sessions.list[1].killzone = { start: '09:00', end: '08:00' }; }).some((s) => s.includes('killzone')));
    assert.ok(withStrategy((c) => { c.sessions.list[2].id = 'asia'; }).some((s) => s.includes('duplicate id')));
    assert.ok(withStrategy((c) => { c.sessions.list[0].role = 'party'; }).some((s) => s.includes('role')));
    assert.ok(withStrategy((c) => { c.sessions.list[0].end = '00:00'; }).some((s) => s.includes('must be after start')));
    assert.ok(withStrategy((c) => { c.sessions.list = []; }).some((s) => s.includes('sessions.list')));
    assert.deepEqual(withStrategy((c) => { delete c.sessions.list[0].killzone; }), []);
  });
  test('numeric guards and cross-field relations', () => {
    assert.ok(withStrategy((c) => { c.history.maxCandlesPerTf = 100; }).some((s) => s.includes('history.maxCandlesPerTf')));
    assert.ok(withStrategy((c) => { c.history.backfillMinutes = 1.5; }).some((s) => s.includes('backfillMinutes')));
    assert.ok(withStrategy((c) => { c.indicators.emaFast = 50; }).some((s) => s === 'indicators: expected emaFast < emaSlow < emaBias'));
    assert.ok(withStrategy((c) => { c.liquidity.sweepMinDepthAtr = 3; }).some((s) => s.includes('sweepMaxDepthAtr')));
    assert.ok(withStrategy((c) => { c.czt.gradeB = 10; }).some((s) => s.includes('minScore ≤ gradeB ≤ gradeA')));
    assert.ok(withStrategy((c) => { c.czt.maxStopAtr = 0.05; }).some((s) => s.includes('czt.maxStopAtr')));
    assert.ok(withStrategy((c) => { c.czt.targetsFrom.push('moon'); }).some((s) => s.includes('targetsFrom[5]')));
    assert.ok(withStrategy((c) => { c.czt.targetsFrom = []; }).some((s) => s.includes('targetsFrom')));
    assert.ok(withStrategy((c) => { c.czt.weights['trigger.sweepReclaim'] = -1; }).some((s) => s.includes('trigger.sweepReclaim')));
    assert.ok(withStrategy((c) => { delete c.czt.weights['zone.fvg']; }).some((s) => s.includes('zone.fvg')));
    assert.ok(withStrategy((c) => { c.czt.weights['trigger.magic'] = 1; }).some((s) => s.includes('trigger.magic') && s.includes('unknown')));
    assert.ok(withStrategy((c) => { c.orderflow.valueAreaPct = 70; }).some((s) => s.includes('valueAreaPct')));
    assert.ok(withStrategy((c) => { c.risk.riskPct = 10; c.risk.dailyLossPct = 5; }).some((s) => s.includes('dailyLossPct')));
    assert.ok(withStrategy((c) => { c.risk.balance = 0; }).some((s) => s.includes('risk.balance')));
    assert.ok(withStrategy((c) => { c.journal.resolveTimeoutHours = '48'; }).some((s) => s.includes('resolveTimeoutHours')));
    assert.ok(withStrategy((c) => { c.executorBridge.enabled = true; c.executorBridge.url = 'ftp://x'; }).some((s) => s.includes('executorBridge.url')));
    assert.ok(withStrategy((c) => { c.executorBridge.minGrade = 'S'; }).some((s) => s.includes('minGrade')));
    assert.ok(withStrategy((c) => { c.czt.oneOpenPerSymbol = 'yes'; }).some((s) => s.includes('oneOpenPerSymbol')));
    assert.ok(withStrategy((c) => { delete c.risk; }).some((s) => s.startsWith('risk:')));
    assert.deepEqual(validateStrategy(null), ['strategy: expected a JSON object']);
  });
});

describe('validateSymbols', () => {
  test('ids, feeds, binance stream, yahoo mapping, numeric fields', () => {
    assert.ok(withSymbols((s) => { s.symbols[1].id = 'BTCUSD'; }).some((x) => x.includes('duplicate id')));
    assert.ok(withSymbols((s) => { s.symbols[0].feed = 'ibkr'; }).some((x) => x.includes('not a known adapter')));
    assert.deepEqual(validateSymbols({ ...base().symbolsCfg, symbols: [{ ...base().symbolsCfg.symbols[0], feed: 'ibkr' }] }, { knownFeeds: [...KNOWN_FEEDS, 'ibkr'] }), []);
    assert.ok(withSymbols((s) => { s.symbols[0].feedParams.stream = 'BTCUSDT'; }).some((x) => x.includes('feedParams.stream')));
    assert.ok(withSymbols((s) => { s.symbols[1].feed = 'yahoo'; delete s.feedDefaults.yahoo.symbols['NQ1!']; }).some((x) => x.includes('feedDefaults.yahoo.symbols["NQ1!"]')));
    assert.deepEqual(withSymbols((s) => { s.symbols[1].feed = 'yahoo'; }), []);
    assert.ok(withSymbols((s) => { s.symbols[2].tick = 0; }).some((x) => x.includes('symbols[2].tick')));
    assert.ok(withSymbols((s) => { s.symbols[2].dp = 2.5; }).some((x) => x.includes('symbols[2].dp')));
    assert.ok(withSymbols((s) => { s.symbols[3].contract.unitsPerLot = -1; }).some((x) => x.includes('contract.unitsPerLot')));
    assert.ok(withSymbols((s) => { s.symbols = []; }).some((x) => x.includes('symbols')));
    assert.ok(withSymbols((s) => { s.feedDefaults.yahoo.pollSeconds = 1; }).some((x) => x.includes('pollSeconds')));
    assert.deepEqual(validateSymbols([]), ['symbols: expected a JSON object']);
  });
});

describe('applyEnv', () => {
  test('server, data dir, timezone, executor flags, dotted ANALYST_SET; inputs are not mutated', () => {
    const { cfg, symbolsCfg } = base();
    const before = JSON.stringify(cfg);
    const env = { ANALYST_HOST: '0.0.0.0', ANALYST_PORT: '8181', ANALYST_DATA_DIR: '/tmp/j', ANALYST_TZ: 'America/New_York', ANALYST_EXECUTOR_ENABLED: 'true', ANALYST_EXECUTOR_URL: 'http://127.0.0.1:1/w', ANALYST_SET: 'czt.minScore=5; risk.balance=2500,sessions.list.0.label="Tokyo"' };
    const out = applyEnv(cfg, symbolsCfg, env);
    assert.deepEqual(out.server, { host: '0.0.0.0', port: 8181 });
    assert.equal(out.cfg.journal.dir, '/tmp/j');
    assert.equal(out.cfg.sessions.timezone, 'America/New_York');
    assert.equal(out.cfg.executorBridge.enabled, true);
    assert.equal(out.cfg.executorBridge.url, 'http://127.0.0.1:1/w');
    assert.equal(out.cfg.czt.minScore, 5);
    assert.equal(out.cfg.risk.balance, 2500);
    assert.equal(out.cfg.sessions.list[0].label, 'Tokyo');
    assert.deepEqual(out.applied, ['journal.dir', 'sessions.timezone', 'executorBridge.url', 'executorBridge.enabled', 'czt.minScore', 'risk.balance', 'sessions.list.0.label']);
    assert.ok(out.warnings.some((w) => w.includes('ANALYST_EXECUTOR_SECRET is not set')));
    assert.equal(JSON.stringify(cfg), before);
    assert.deepEqual(validateStrategy(out.cfg), []);
  });
  test('symbol filter and feed forcing (global + per-symbol), with warnings for nonsense', () => {
    const { cfg, symbolsCfg } = base();
    const out = applyEnv(cfg, symbolsCfg, { ANALYST_SYMBOLS: 'XAUUSD, BTCUSD,NOPE', ANALYST_FEED: 'simulated', [envKeyForSymbol('XAUUSD')]: 'replay' });
    assert.deepEqual(out.symbolsCfg.symbols.map((s) => [s.id, s.feed, s.feedOriginal]), [['BTCUSD', 'simulated', 'binance'], ['XAUUSD', 'replay', 'binance']]);
    assert.ok(out.warnings.some((w) => w.includes('"NOPE"')));
    assert.equal(envKeyForSymbol('NQ1!'), 'ANALYST_FEED_NQ1_');
    const bad = applyEnv(cfg, symbolsCfg, { ANALYST_PORT: 'eighty', ANALYST_EXECUTOR_ENABLED: 'maybe', ANALYST_SET: 'garbage;executorBridge.secret=x' });
    assert.equal(bad.server.port, 8080);
    assert.equal(bad.warnings.length, 4);
    assert.ok(bad.warnings.some((w) => w.includes('secrets never go in config')));
    assert.equal(JSON.stringify(bad.cfg).includes('"secret"'), false);
    assert.deepEqual(bad.applied, []);
  });
  test('an env override that breaks validation is rejected by loadConfig and the error names the override', () => {
    assert.throws(() => loadConfig({ env: { ANALYST_SET: 'czt.minRr=0' } }), (e) => e instanceof ConfigError && /after env overrides: czt\.minRr/.test(e.message) && e.issues.some((s) => s.includes('czt.minRr')));
    assert.throws(() => loadConfig({ env: { ANALYST_FEED: 'ibkr' } }), /not a known adapter/);
    assert.throws(() => loadConfig({ env: { ANALYST_TZ: 'Nowhere/Land' } }), /sessions\.timezone/);
    assert.equal(loadConfig({ env: { ANALYST_SYMBOLS: 'OIL', ANALYST_FEED: 'yahoo' } }).symbolsCfg.symbols[0].feed, 'yahoo');
    assert.throws(() => loadConfig({ env: { ANALYST_SYMBOLS: 'GHOST' } }), /symbols: expected an array of ≥ 1/);
  });
});

describe('log', () => {
  test('events are plain objects in the ring buffer, newest first, filterable; stream gets text or JSON', () => {
    const clock = fakeClock(1_000_000);
    const lines = [];
    const log = createLogger({ capacity: 3, now: clock.now, stream: { write: (s) => lines.push(s) }, level: 'info' });
    const seen = [];
    log.on('event', (ev) => seen.push(ev));
    log.info('BTCUSD', 'hello', { a: 1 });
    clock.tick(1000);
    log.signal('XAUUSD', 'setup', { side: 'long' });
    log.debug('BTCUSD', 'noise');
    log.warn('BTCUSD', 'careful');
    log.error('XAUUSD', 'boom', new Error('x'));
    assert.equal(log.buffer.size, 3, 'capacity bounds the feed');
    const recent = log.recent();
    assert.deepEqual(recent.map((e) => e.msg), ['boom', 'careful', 'setup']);
    assert.deepEqual(recent[2], { t: 1_001_000, level: 'signal', symbol: 'XAUUSD', msg: 'setup', data: { side: 'long' } });
    assert.deepEqual(recent[0].data, { name: 'Error', message: 'x' });
    assert.deepEqual(log.recent(10, { symbol: 'BTCUSD' }).map((e) => e.msg), ['careful']);
    assert.deepEqual(log.recent(10, { minLevel: 'error' }).map((e) => e.msg), ['boom']);
    assert.deepEqual(log.recent(10, { level: 'signal' }).map((e) => e.msg), ['setup']);
    assert.deepEqual(log.recent(1).map((e) => e.msg), ['boom']);
    assert.deepEqual(log.recent(10, { since: 1_000_000 }).map((e) => e.msg), ['boom', 'careful', 'setup']);
    assert.equal(seen.length, 5, 'every level including debug is emitted');
    assert.equal(lines.length, 4, 'debug is below the stream threshold');
    assert.match(lines[0], /^00:16:40 INFO   \[BTCUSD\] hello \{"a":1\}\n$/);
    const j = createLogger({ now: clock.now, stream: { write: (s) => lines.push(s) }, json: true });
    j.ok('msg only');
    assert.deepEqual(JSON.parse(lines.at(-1)), { t: 1_001_000, level: 'ok', symbol: '*', msg: 'msg only' });
    assert.deepEqual(j.guard('data only', { x: 1 }).data, { x: 1 });
    assert.deepEqual(j.recent(10, { symbol: 'OIL' }).map((e) => e.msg), ['data only', 'msg only'], 'global (*) lines show under every symbol filter');
  });
  test('child loggers share the buffer and the parent event stream; secrets never reach a line', () => {
    const lines = [];
    const root = new Logger({ stream: { write: (s) => lines.push(s) }, now: () => 5 });
    const events = [];
    root.on('event', (e) => events.push(e));
    const btc = root.child('BTCUSD');
    btc.info('connected', { token: 'abc', nested: { apiKey: 'k', fine: 1 }, Authorization: 'Bearer x' });
    assert.equal(events.length, 1);
    assert.equal(events[0].symbol, 'BTCUSD');
    assert.deepEqual(events[0].data, { token: '[redacted]', nested: { apiKey: '[redacted]', fine: 1 }, Authorization: '[redacted]' });
    assert.ok(!lines[0].includes('abc') && !lines[0].includes('Bearer'));
    assert.equal(root.recent()[0], events[0]);
    assert.equal(btc.child('OIL').child('XAUUSD').info('deep').symbol, 'XAUUSD');
    assert.equal(events.length, 2);
    const circ = { a: 1 }; circ.self = circ;
    assert.deepEqual(redact(circ), { a: 1, self: '[circular]' });
    assert.equal(redact('s'), 's');
    assert.deepEqual(redact([{ secret: 1 }]), [{ secret: '[redacted]' }]);
  });
  test('a dead stream and a null stream are both survivable; bad level rejected', () => {
    const l = createLogger({ stream: { write: () => { throw new Error('EPIPE'); } }, now: () => 1 });
    assert.doesNotThrow(() => l.error('x'));
    const q = createLogger({ stream: null, now: () => 1 });
    assert.equal(q.info('quiet').level, 'info');
    assert.equal(q.log('bogus', 'm').level, 'info');
    assert.throws(() => createLogger({ level: 'loud' }), RangeError);
    assert.deepEqual(LEVELS, ['debug', 'info', 'ok', 'signal', 'guard', 'warn', 'error']);
  });
  test('RingBuffer', () => {
    const r = new RingBuffer(3);
    assert.throws(() => new RingBuffer(0), RangeError);
    assert.equal(r.last(), undefined);
    r.push(1).push(2).push(3).push(4);
    assert.deepEqual(r.toArray(), [2, 3, 4]);
    assert.deepEqual(r.recent(), [4, 3, 2]);
    assert.deepEqual(r.recent(5, (x) => x % 2 === 0), [4, 2]);
    assert.equal(r.last(), 4);
    r.clear();
    assert.equal(r.size, 0);
    assert.deepEqual(r.toArray(), []);
  });
});

describe('test fakes (used by the feed and server suites)', () => {
  test('fakeClock: timers fire in time order, intervals repeat, handles unref, cancel works', () => {
    const clock = fakeClock(1000);
    const fired = [];
    const a = clock.setTimeout((x) => fired.push(['a', clock.now(), x]), 500, 'arg');
    const b = clock.setTimeout(() => fired.push(['b', clock.now()]), 100);
    const i = clock.setInterval(() => fired.push(['i', clock.now()]), 300);
    clock.setTimeout(() => fired.push(['never']), 200).unref();
    const dead = clock.setTimeout(() => fired.push(['dead']), 150);
    clock.clearTimeout(dead);
    assert.equal(typeof a.unref, 'function');
    assert.equal(+b, 2);
    clock.tick(50);
    assert.deepEqual(fired, []);
    assert.equal(clock.run(1000 + 650), 1650);
    assert.deepEqual(fired, [['b', 1100], ['never'], ['i', 1300], ['a', 1500, 'arg'], ['i', 1600]]);
    clock.clearInterval(i);
    clock.tick(10_000);
    assert.equal(fired.length, 5);
    // timers scheduled while running fire in the same run if due
    fired.length = 0;
    clock.setTimeout(() => { fired.push('outer'); clock.setTimeout(() => fired.push('inner'), 10); }, 10);
    clock.tick(100);
    assert.deepEqual(fired, ['outer', 'inner']);
    assert.equal(clock.pending(), 0);
    assert.equal(fakeClock().now(), Date.UTC(2026, 0, 5));
  });
  test('fakeWebSocket: native-shaped lifecycle, both listener styles, sent[] parses JSON', () => {
    const WS = fakeWebSocket();
    const ws = new WS('wss://x/stream?streams=a');
    assert.equal(WS.last(), ws);
    assert.equal(WS.instances.length, 1);
    assert.equal(ws.readyState, WS.CONNECTING);
    const got = [];
    ws.onopen = () => got.push('open');
    ws.addEventListener('message', (ev) => got.push(JSON.parse(ev.data).stream));
    ws.addEventListener('close', (ev) => got.push(`close:${ev.code}:${ev.wasClean}`));
    ws.onerror = (ev) => got.push(`error:${ev.message}`);
    assert.throws(() => ws.send('x'), /InvalidStateError/);
    ws.open();
    assert.equal(ws.readyState, WS.OPEN);
    ws.send(JSON.stringify({ method: 'SUBSCRIBE' }));
    ws.send('raw');
    ws.message({ stream: 'btcusdt@kline_1m', data: {} });
    ws.message('{"stream":"s2"}');
    ws.error(new Error('boom'));
    ws.close(1006);
    ws.close(1000); // idempotent
    assert.deepEqual(got, ['open', 'btcusdt@kline_1m', 's2', 'error:boom', 'close:1006:false']);
    assert.deepEqual(ws.sent, [{ method: 'SUBSCRIBE' }, 'raw']);
    assert.deepEqual(ws.closedWith, { code: 1006, reason: '' });
    const ws2 = new WS('wss://y');
    ws2.open().terminate();
    assert.equal(ws2.closedWith.code, 1006);
    assert.equal(WS.instances.length, 2);
  });
  test('fakeFetch: substring/regex routes, functions, errors, 404 default, call log', async () => {
    const fetch = fakeFetch({
      '/api/v3/klines': { json: [[1, '2']] },
      'retry': { status: 429, headers: { 'Retry-After': '7' }, text: 'slow down' },
      [/finance\/chart\/(NQ|CL)=F/]: (url, opts, call) => ({ json: { url, i: call.i, method: opts.method ?? 'GET' } }),
      'dead': new Error('ECONNRESET'),
    });
    const k = await fetch('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT');
    assert.equal(k.ok, true); assert.equal(k.status, 200);
    assert.deepEqual(await k.json(), [[1, '2']]);
    assert.equal(await k.text(), '[[1,"2"]]');
    const r = await fetch('https://x/retry');
    assert.equal(r.ok, false); assert.equal(r.status, 429); assert.equal(r.headers.get('retry-after'), '7'); assert.equal(await r.text(), 'slow down');
    const y = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/NQ=F?interval=1m', { method: 'POST' });
    assert.deepEqual(await y.json(), { url: 'https://query1.finance.yahoo.com/v8/finance/chart/NQ=F?interval=1m', i: 2, method: 'POST' });
    await assert.rejects(fetch('https://x/dead'), /ECONNRESET/);
    const nf = await fetch('https://x/nothing');
    assert.equal(nf.status, 404); assert.equal(nf.ok, false);
    await assert.rejects(nf.json());
    assert.equal(fetch.calls.length, 5);
    assert.equal(fetch.calls[0].url, 'https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT');
    const arr = fakeFetch([['a', { text: 'A' }]]);
    assert.equal(await (await arr('http://a')).text(), 'A');
  });
  test('loadFixture: 2000 contiguous closed BTC 1m candles with flow, fresh copy each call', () => {
    const fx = loadFixture();
    assert.equal(fx.length, 2000);
    for (let i = 1; i < fx.length; i++) assert.equal(fx[i].t - fx[i - 1].t, 60000);
    assert.ok(fx.every((c) => c.closed && c.buyV >= 0 && c.sellV >= 0 && Math.abs(c.buyV + c.sellV - c.v) < 1e-6 && c.n > 0));
    fx[0].c = -1;
    assert.notEqual(loadFixture()[0].c, -1);
  });
});
