// test/analyst.test.mjs — SPEC §4.9: the orchestrator's wiring, read models and event shapes, driven by a
// hand-controlled feed and a fake clock. The strategy itself is covered by czt/liquidity/… tests and e2e.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Analyst } from '../lib/engine/analyst.mjs';
import { FeedAdapter } from '../lib/feeds/base.mjs';
import { loadConfig } from '../lib/config.mjs';
import { createLogger } from '../lib/log.mjs';
import { createJournal } from '../lib/journal.mjs';
import { TF_MS } from '../lib/engine/candles.mjs';
import { loadFixture, fakeClock, mkCandles } from './helpers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const { cfg: CFG, symbolsCfg: SYMS } = loadConfig({ env: { ANALYST_SYMBOLS: 'BTCUSD', ANALYST_FEED: 'replay' } });

/** A feed the test drives by hand. */
class ManualFeed extends FeedAdapter {
  constructor(symbol) { super(symbol); this.kind = 'live'; }
  async connect() { this.setStatus('live'); }
  async close() { this.setStatus('closed'); }
  history(candles) { this.emit('history', { symbol: this.symbol.id, candles }); }
  candle(candle) { this.emit('candle', { symbol: this.symbol.id, candle }); }
  trade(trade) { this.emit('trade', { symbol: this.symbol.id, trade }); }
}

function build({ journal = null, cfg = CFG, symbolsCfg = SYMS, startMs } = {}) {
  const clock = fakeClock(startMs ?? Date.UTC(2026, 9, 4, 20, 0));
  const log = createLogger({ now: clock.now, stream: null });
  const feeds = {};
  const analyst = new Analyst({ cfg, symbolsCfg, log, journal, now: clock.now, timers: clock, feedFactory: (s) => (feeds[s.id] = new ManualFeed(s)) });
  const events = {};
  for (const ev of ['event', 'candle', 'setup', 'status', 'levels']) { events[ev] = []; analyst.on(ev, (m) => events[ev].push(m)); }
  return { clock, log, feeds, analyst, events };
}

describe('Analyst construction', () => {
  test('refuses to run without an injected clock and never reads the wall clock itself', () => {
    assert.throws(() => new Analyst({ cfg: CFG, symbolsCfg: SYMS }), /injected clock/);
    const src = readFileSync(resolve(HERE, '../lib/engine/analyst.mjs'), 'utf8').split('\n').filter((l) => !l.trimStart().startsWith('//')).join('\n');
    assert.ok(!/Date\.now\s*\(/.test(src), 'no Date.now() in analyst.mjs');
  });
  test('snapshot before start is empty but well-formed', () => {
    const { analyst } = build();
    const s = analyst.snapshot();
    assert.equal(s.uptimeMs, 0);
    assert.equal(s.symbols.length, 1);
    const b = s.symbols[0];
    assert.equal(b.id, 'BTCUSD'); assert.equal(b.feed.state, 'connecting'); assert.equal(b.price, null);
    assert.deepEqual(b.czt.condition, { hits: [], score: 0 }); assert.equal(b.czt.grade, null);
    assert.deepEqual(s.limits, { setupsToday: { BTCUSD: 0 }, openCount: 0 });
  });
});

describe('history + read models', () => {
  test('history populates the store, session, bias, levels, czt and both read models in the contract shape', async () => {
    const fixture = loadFixture();
    const last = fixture[fixture.length - 1];
    const { analyst, feeds, events, clock } = build({ startMs: last.t + 60e3 });
    await analyst.start();
    feeds.BTCUSD.history(fixture);
    const s = analyst.snapshot().symbols[0];
    assert.equal(s.feed.state, 'live'); assert.equal(s.feed.kind, 'live');
    assert.equal(s.price, last.c); assert.equal(s.lastCandleT, last.t); assert.equal(s.deltaSource, 'trades');
    assert.ok(typeof s.change.pct === 'number' && typeof s.change.windowLabel === 'string');
    assert.equal(s.session.id, 'late'); assert.equal(typeof s.session.killzone, 'boolean');
    assert.ok(['bullish', 'bearish', 'neutral'].includes(s.bias.dir));
    for (const layer of ['condition', 'zone', 'trigger']) { assert.ok(Array.isArray(s.czt[layer].hits)); assert.equal(typeof s.czt[layer].score, 'number'); }
    assert.equal(typeof s.czt.score, 'number'); assert.ok(Array.isArray(s.czt.rejections));
    assert.ok(s.atr > 0);
    assert.equal(events.setup.length, 0, 'history never emits setups');
    assert.equal(events.levels.length, 1, 'one levels event after history');
    assert.ok(events.levels[0].levels.some((l) => l.kind === 'pdh') && events.levels[0].levels.some((l) => l.kind === 'pdl'));
    const lv = events.levels[0].levels;
    assert.ok(lv.some((l) => l.kind === 'prevCandleLow' && l.tf === '4h') && lv.some((l) => l.kind === 'prevCandleHigh'), 'previous 4h candle levels (source 01)');
    const sym = analyst.symbols.get('BTCUSD');
    assert.equal(lv.find((l) => l.kind === 'prevCandleLow').price, sym.store.lastClosed('4h').l);
    const pdp = sym.prevDayProfile;
    for (const l of lv.filter((x) => x.kind === 'lvn')) { assert.ok(l.price < pdp.val || l.price > pdp.vah, 'LVN zones sit outside the prior-day value area'); assert.ok(['buy-side', 'sell-side'].includes(l.side)); assert.equal(l.swept, null); }
    assert.ok(events.candle.some((m) => m.tf === '5m'), 'history flush emits a candle per TF');

    const d = analyst.chartData('BTCUSD', '5m', 120);
    assert.equal(d.symbol, 'BTCUSD'); assert.equal(d.tf, '5m'); assert.equal(d.dp, 2);
    assert.equal(d.candles.length, 120);
    for (const k of ['t', 'o', 'h', 'l', 'c', 'v', 'delta']) assert.equal(typeof d.candles[0][k], 'number', k);
    assert.ok(d.ema9.length === 120 && d.ema21.length === 120 && d.ema50.length === 120, 'warm indicators cover the window');
    assert.ok(d.ema9.every((p) => typeof p.t === 'number' && typeof p.v === 'number'));
    assert.equal(d.vwap.length, 120); assert.equal(d.cvd.length, 120);
    assert.ok(Array.isArray(d.levels) && Array.isArray(d.zones) && Array.isArray(d.markers) && Array.isArray(d.setups));
    assert.ok(d.markers.some((m) => m.kind === 'session' && (m.text === 'LDN' || m.text === 'NY')), 'session markers');
    assert.ok(d.markers.every((m) => m.t >= d.candles[0].t), 'markers limited to the window');
    assert.ok(d.profile && typeof d.profile.poc === 'number');
    assert.equal(d.session.id, 'late');
    assert.throws(() => analyst.chartData('NOPE', '5m'), RangeError);
    assert.throws(() => analyst.chartData('BTCUSD', '2h'), RangeError);
    void clock;
    await analyst.stop();
  });
});

describe('candle flow', () => {
  test('forming prints are coalesced to ≤ 2/s per symbol; closed prints flush at once', async () => {
    const hist = mkCandles({ n: 400, start: Date.UTC(2026, 0, 13, 0, 0) });
    const t0 = hist[hist.length - 1].t + 60e3;
    const { analyst, feeds, events, clock } = build({ startMs: t0 + 10 });
    await analyst.start();
    feeds.BTCUSD.history(hist);
    clock.tick(500); // the history flush opened a throttle window; step past it
    events.candle.length = 0;
    const base = { t: t0, o: 100, h: 100.5, l: 99.5, c: 100.1, v: 1, closed: false };
    for (let i = 0; i < 6; i++) feeds.BTCUSD.candle({ ...base, c: 100 + i / 100 });
    const oneM = () => events.candle.filter((m) => m.tf === '1m');
    assert.equal(oneM().length, 1, 'first forming print emits immediately, the next five are coalesced');
    assert.equal(clock.pending(), 1, 'one flush timer pending');
    clock.tick(499);
    assert.equal(oneM().length, 1);
    clock.tick(1);
    assert.equal(oneM().length, 2, 'the coalesced burst flushes after 500 ms');
    assert.equal(oneM()[1].candle.c, 100.05, 'the flush carries the newest print');
    assert.equal(oneM()[1].candle.closed, false);
    feeds.BTCUSD.candle({ ...base, c: 100.2, closed: true });
    assert.equal(oneM().length, 3, 'a closed print flushes immediately');
    assert.equal(oneM()[2].candle.closed, true);
    assert.equal(events.candle.filter((m) => m.tf === '5m').length >= 1, true, 'higher TFs ride along');
    await analyst.stop();
  });

  test('closed 1m → journal.resolveOpen with structure swings + ATR; closed analysis-TF → levels event; same candle analysed once', async () => {
    const hist = mkCandles({ n: 600, start: Date.UTC(2026, 0, 13, 0, 0) });
    const calls = [];
    const journal = { load: () => ({ setups: 0, open: 0, resolved: 0, malformed: 0 }), on() {}, off() {}, open: () => [], list: () => [], flush() {}, record: (s) => s, resolveOpen: (symbol, c, opts) => { calls.push({ symbol, t: c.t, opts }); return []; } };
    const t0 = hist[hist.length - 1].t + 60e3;
    const { analyst, feeds, events } = build({ journal, startMs: t0 });
    await analyst.start();
    feeds.BTCUSD.history(hist);
    assert.equal(calls.length, 0, 'history does not resolve setups');
    events.levels.length = 0;
    // t0 is on a 5m boundary? mkCandles starts at 00:00 → candle 600 is at 10:00 → next 4 closes complete the bucket at 10:04
    for (let i = 0; i < 5; i++) feeds.BTCUSD.candle({ t: t0 + i * 60e3, o: 100, h: 100.3, l: 99.8, c: 100.1, v: 1, closed: true });
    assert.equal(calls.length, 5, 'one resolveOpen per closed 1m');
    assert.equal(calls[0].symbol, 'BTCUSD');
    assert.ok(Array.isArray(calls[0].opts.swings) && calls[0].opts.swings.length > 0, 'structure-TF swings passed');
    assert.ok(calls[0].opts.atr > 0, 'ATR passed for the trail buffer');
    // source 05 §7 step 4 inputs (review finding journal.mjs:156): levels, profile HVNs, divergence, analysis-TF swings
    assert.ok(Array.isArray(calls[0].opts.levels) && calls[0].opts.levels.length > 0, 'levels passed');
    assert.ok(Array.isArray(calls[0].opts.hvn), 'HVNs passed');
    assert.ok('divergence' in calls[0].opts);
    assert.ok(Array.isArray(calls[0].opts.analysisSwings) && calls[0].opts.analysisSwings.length > 0, 'analysis-TF swings passed');
    assert.equal(events.levels.length, 1, 'levels recomputed once, on the 5m close');
    assert.equal(events.levels[0].symbol, 'BTCUSD');
    const analysedBefore = analyst.symbols.get('BTCUSD').analysedT;
    feeds.BTCUSD.candle({ t: t0 + 4 * 60e3, o: 100, h: 100.3, l: 99.8, c: 100.1, v: 1, closed: true }); // duplicate closed print
    assert.equal(analyst.symbols.get('BTCUSD').analysedT, analysedBefore);
    assert.equal(events.levels.length, 1, 'a replayed closed child does not re-run the pipeline');
    await analyst.stop();
  });

  test('trades fill buyV/sellV for a candle that lacks them; status events pass through with the feed kind', async () => {
    const hist = mkCandles({ n: 50, start: Date.UTC(2026, 0, 13, 0, 0) });
    const t0 = hist[hist.length - 1].t + 60e3;
    const { analyst, feeds, events } = build({ startMs: t0 });
    await analyst.start();
    feeds.BTCUSD.history(hist);
    feeds.BTCUSD.trade({ t: t0 + 1000, p: 100, q: 2, side: 'buy' });
    feeds.BTCUSD.trade({ t: t0 + 2000, p: 100, q: 0.5, side: 'sell' });
    feeds.BTCUSD.candle({ t: t0, o: 100, h: 100.2, l: 99.9, c: 100.1, v: 2.5, closed: false });
    const stored = analyst.symbols.get('BTCUSD').store.last('1m');
    assert.equal(stored.buyV, 2); assert.equal(stored.sellV, 0.5);
    assert.equal(analyst.snapshot().symbols[0].deltaSource, 'trades');
    feeds.BTCUSD.setStatus('reconnecting', 'closed (1006)');
    const st = events.status[events.status.length - 1];
    assert.deepEqual(st, { symbol: 'BTCUSD', state: 'reconnecting', kind: 'live', detail: 'closed (1006)' });
    assert.equal(analyst.snapshot().symbols[0].feed.state, 'reconnecting');
    assert.ok(events.event.some((e) => e.level === 'warn' && /reconnecting/.test(e.msg)), 'status change logged as an event');
    await analyst.stop();
  });

  test('journal resolution is forwarded as a setup event and clears the open setup', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'analyst-j-'));
    try {
      const hist = mkCandles({ n: 50, start: Date.UTC(2026, 0, 13, 0, 0), price: 100 });
      const t0 = hist[hist.length - 1].t + 60e3;
      const clock = fakeClock(t0);
      const journal = createJournal({ cfg: CFG, dir, now: clock.now });
      const { analyst, feeds, events } = build({ journal, startMs: t0 });
      await analyst.start();
      feeds.BTCUSD.history(hist);
      const setup = { id: 'BTCUSD-manual-long', symbol: 'BTCUSD', t: t0 - 5 * 60e3, tf: '5m', side: 'long', entry: 100, stop: 99, targets: [{ price: 102, label: 'x', rr: 2 }], rr: 2, score: 8, grade: 'B', condition: { hits: [] }, zone: { hits: [] }, trigger: { kind: 'sweepReclaim', hits: [] }, reasons: [], invalidation: 'x', size: { units: 1, riskUsd: 1, riskPct: 1 }, status: 'open' };
      journal.record(setup);
      analyst.symbols.get('BTCUSD').openSetup = journal.get(setup.id);
      feeds.BTCUSD.candle({ t: t0, o: 100, h: 102.5, l: 99.9, c: 102.2, v: 1, closed: true });
      const won = events.setup.find((s) => s.id === setup.id && s.status === 'won');
      assert.ok(won, 'resolved setup re-emitted');
      assert.equal(won.resultR, 2); assert.equal(won.exit, 'target');
      const snap = analyst.snapshot().symbols[0];
      assert.equal(snap.openSetup, null); assert.equal(snap.lastSetup.status, 'won');
      assert.equal(analyst.snapshot().limits.openCount, 0);
      await analyst.stop();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('session anchors (review finding analyst.mjs:468)', () => {
  test('no LDN marker on the first candle when London opened before it; a 4h anchor sits on the bar CONTAINING the open', async () => {
    // history starts 07:30 UTC (London opened 07:00): nothing marks candles[0]
    const late = mkCandles({ n: 200, start: Date.UTC(2026, 0, 13, 7, 30) });
    const a = build({ startMs: late.at(-1).t + 60e3 });
    await a.analyst.start(); a.feeds.BTCUSD.history(late);
    const d1 = a.analyst.chartData('BTCUSD', '1m', 500);
    assert.ok(!d1.markers.some((m) => m.kind === 'session' && m.t === d1.candles[0].t), 'the first candle is not a session open');
    assert.ok(!d1.markers.some((m) => m.kind === 'session' && m.text === 'LDN'), 'London opened before the data starts');
    await a.analyst.stop();
    // history 00:00 → 11:39: on 1m the LDN marker is at 07:00 exactly; on 4h it is the 04:00 bar (which contains 07:00), not 08:00
    const day = mkCandles({ n: 700, start: Date.UTC(2026, 0, 13, 0, 0) });
    const b = build({ startMs: day.at(-1).t + 60e3 });
    await b.analyst.start(); b.feeds.BTCUSD.history(day);
    const m1 = b.analyst.chartData('BTCUSD', '1m', 1000).markers.filter((m) => m.kind === 'session');
    assert.deepEqual(m1.map((m) => [m.text, new Date(m.t).toISOString().slice(11, 16)]), [['LDN', '07:00']]);
    const m4 = b.analyst.chartData('BTCUSD', '4h', 10).markers.filter((m) => m.kind === 'session');
    assert.deepEqual(m4.map((m) => [m.text, new Date(m.t).toISOString().slice(11, 16)]), [['LDN', '04:00']]);
    // VWAP anchors: on 4h the session reset lands on the 04:00 bar (index 1), so the VWAP there equals that bar's own typical price
    const d4 = b.analyst.chartData('BTCUSD', '4h', 10);
    const bar04 = d4.candles[1];
    assert.equal(bar04.t, Date.UTC(2026, 0, 13, 4, 0));
    assert.ok(Math.abs(d4.vwap[1].v - (bar04.h + bar04.l + bar04.c) / 3) < 1e-9, 'anchored VWAP restarts on the bar containing the London open');
    await b.analyst.stop();
  });
});

describe('errors', () => {
  test('a feed that throws becomes an error status, not a crash; an engine error on a candle is logged', async () => {
    const { analyst, feeds, events } = build();
    await analyst.start();
    feeds.BTCUSD.candle({ t: 'garbage' }); // normalizeCandle throws
    assert.ok(events.event.some((e) => e.level === 'error' && /Engine error/.test(e.msg)));
    const boom = new Analyst({ cfg: CFG, symbolsCfg: SYMS, now: () => 0, feedFactory: () => { throw new Error('no adapter'); } });
    const statuses = []; boom.on('status', (s) => statuses.push(s));
    await boom.start();
    assert.equal(statuses[0].state, 'error');
    assert.match(boom.snapshot().symbols[0].feed.detail, /no adapter/);
    await analyst.stop(); await boom.stop();
    assert.equal(TF_MS['5m'], 3e5);
  });
});
