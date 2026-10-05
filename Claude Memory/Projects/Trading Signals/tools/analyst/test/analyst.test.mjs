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
import { loadFixture, fakeClock, mkCandles, fakeFetch } from './helpers.mjs';

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
  depth(snapshot) { this.emit('depth', { symbol: this.symbol.id, snapshot, source: 'stream' }); }
}

function build({ journal = null, cfg = CFG, symbolsCfg = SYMS, startMs } = {}) {
  const clock = fakeClock(startMs ?? Date.UTC(2026, 9, 4, 20, 0));
  const log = createLogger({ now: clock.now, stream: null });
  const feeds = {};
  const analyst = new Analyst({ cfg, symbolsCfg, log, journal, now: clock.now, timers: clock, feedFactory: (s) => (feeds[s.id] = new ManualFeed(s)) });
  const events = {};
  for (const ev of ['event', 'candle', 'setup', 'status', 'levels', 'footprint', 'book']) { events[ev] = []; analyst.on(ev, (m) => events[ev].push(m)); }
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

describe('memory leaks (review findings)', () => {
  test('feed event handlers are detached on stop to prevent memory leaks on restart', async () => {
    const { analyst, feeds } = build();
    await analyst.start();
    const sym = analyst.symbols.get('BTCUSD');
    const feed = sym.feed;
    // Store initial listener count for each event
    const initialCount = {};
    for (const ev of ['history', 'candle', 'trade', 'depth', 'status', 'done']) {
      initialCount[ev] = feed.eventNames().filter(e => e === ev).length === 0 ? 0 : feed.listeners(ev).length;
    }
    // Stop and verify handlers are detached
    await analyst.stop();
    for (const ev of ['history', 'candle', 'trade', 'depth', 'status', 'done']) {
      const finalCount = feed.eventNames().filter(e => e === ev).length === 0 ? 0 : feed.listeners(ev).length;
      assert.equal(finalCount, 0, `all ${ev} listeners detached on stop (initial: ${initialCount[ev]})`);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// SPEC-PRO §P6 — footprints, order book, trade backfill and the notifier through the orchestrator
// ---------------------------------------------------------------------------------------------------------------
describe('Pro wiring (SPEC-PRO §P6)', () => {
  const flushAll = async (clock, n = 8) => { for (let i = 0; i < n; i++) await clock.flush(); };

  test('every trade feeds the footprint; the analysis-TF close emits a SERIALISED footprint (∞ → null) and czt sees it; read models in the §P6 shapes', async () => {
    const hist = mkCandles({ n: 600, start: Date.UTC(2026, 0, 13, 0, 0) });
    const t0 = hist.at(-1).t + 60e3; // 10:00 — a 5m boundary
    const { analyst, feeds, events } = build({ startMs: t0 });
    await analyst.start();
    feeds.BTCUSD.history(hist);
    const fd0 = analyst.footprintData('BTCUSD');
    assert.equal(fd0.symbol, 'BTCUSD'); assert.equal(fd0.tf, '5m'); assert.equal(fd0.tick, 0.01);
    const b = fd0.bucket;
    assert.ok(Number.isFinite(b) && b >= 0.01 && Math.abs(b / 0.01 - Math.round(b / 0.01)) < 1e-9, `bucket ${b} follows the ATR and sits on the tick grid`);
    assert.equal(fd0.footprints.length, 1, 'history closed one footprint (empty: the tape starts live) for the last closed 5m candle');
    assert.equal(fd0.footprints[0].nTrades, 0); assert.equal(fd0.footprints[0].t, t0 - 5 * 60e3); assert.equal(fd0.current, null);
    assert.equal(fd0.partial, false); assert.equal(fd0.backfill, null, 'a replay symbol never calls Binance for a tape');
    const base = +(Math.floor(100 / b) * b).toFixed(2), px = (k) => +(base + k * b).toFixed(2);
    // one sell at the bottom, then four aggressive buys one level apart: a buy imbalance on every level above the first (source 05 §3)
    feeds.BTCUSD.trade({ t: t0 + 1000, p: px(0), q: 1, side: 'sell' });
    for (let k = 1; k <= 4; k++) feeds.BTCUSD.trade({ t: t0 + 1000 + k * 1000, p: px(k), q: 5, side: 'buy' });
    assert.equal(analyst.footprintData('BTCUSD').current.nTrades, 5, 'the forming candle is readable before it closes');
    for (let i = 0; i < 5; i++) feeds.BTCUSD.candle({ t: t0 + i * 60e3, o: 100, h: 100.3, l: 99.8, c: 100.1, v: 1, buyV: 0.6, sellV: 0.4, closed: true });
    const ev = events.footprint.find((m) => m.footprint.t === t0);
    assert.ok(ev, 'a footprint event on the 5m close');
    assert.equal(ev.symbol, 'BTCUSD'); assert.equal(ev.tf, '5m'); assert.ok('trapped' in ev);
    const f = ev.footprint;
    assert.equal(f.nTrades, 5); assert.equal(f.totalAsk, 20); assert.equal(f.totalBid, 1); assert.equal(f.delta, 19); assert.equal(f.bucket, b);
    assert.equal(f.levels.length, 5); assert.equal(f.levels[0].price, px(0)); assert.equal(f.levels[4].price, px(4));
    assert.deepEqual(f.stacked, [{ side: 'buy', from: px(1), to: px(4), count: 4 }]);
    assert.equal(f.imbalances.length, 4); assert.equal(f.imbalances[0].ratio, 5);
    assert.ok(f.imbalances.slice(1).every((i) => i.ratio === null && i.infinite === true), 'Infinity never reaches JSON');
    assert.equal(JSON.parse(JSON.stringify(ev)).footprint.imbalances[1].ratio, null);
    assert.equal(f.unfinishedHigh, false, 'only buys printed at the top'); assert.equal(f.unfinishedLow, false);
    const fd = analyst.footprintData('BTCUSD', 3);
    assert.equal(fd.footprints.length, 2); assert.equal(fd.footprints.at(-1).t, t0); assert.equal(fd.footprints.at(-1).nTrades, 5); assert.equal(fd.current, null);
    assert.equal(analyst.footprintData('BTCUSD', 1).footprints.length, 1);
    // czt saw this candle's footprint as ctx.footprint (the hit itself needs a zone — asserted in test/czt + the Pro e2e)
    const sym = analyst.symbols.get('BTCUSD');
    assert.ok(sym.czt && sym.czt.sides, 'czt ran on the close');
    const pro = analyst.proData('BTCUSD');
    assert.equal(pro.symbol, 'BTCUSD'); assert.equal(pro.tf, '5m'); assert.equal(pro.bucket, b); assert.equal(pro.partial, false);
    assert.equal(pro.footprints.at(-1).nTrades, 5); assert.equal(pro.trapped, null);
    assert.equal(pro.book.summary, null); assert.deepEqual(pro.book.history, []); assert.match(pro.book.reason, /^No depth snapshot yet/);
    assert.deepEqual(Object.keys(pro.hits).sort(), ['bookAbsorption', 'bookImbalance', 'footprintImbalance', 'trappedTraders', 'unfinishedAuction']);
    assert.ok(Object.values(pro.hits).every((v) => typeof v === 'boolean'));
    const snap = analyst.snapshot().symbols[0];
    assert.deepEqual({ ...snap.pro, hits: undefined }, { footprints: 2, bucket: b, partial: false, book: false, depthFrames: 0, hits: undefined });
    for (const m of ['footprintData', 'bookData', 'proData']) assert.throws(() => analyst[m]('NOPE'), RangeError, m);
    await analyst.stop();
  });

  test('depth snapshots create the book lazily and emit `book` ≤ 1/s; trades at a wall are executed volume (absorption after the wall is SEEN to hold); feeds without depth report a reason', async () => {
    const hist = mkCandles({ n: 600, start: Date.UTC(2026, 0, 13, 0, 0) }); // enough 5m candles for a warm ATR so czt evaluates on the close
    const t0 = hist.at(-1).t + 60e3;
    const { analyst, feeds, events, clock } = build({ startMs: t0 });
    await analyst.start();
    feeds.BTCUSD.history(hist);
    assert.deepEqual(analyst.bookData('BTCUSD'), { symbol: 'BTCUSD', summary: null, history: [], reason: 'No depth snapshot yet — waiting for the first order-book frame' });
    const snap = (bidQty = {}, id = 1) => ({
      t: clock.now(), lastUpdateId: id,
      bids: Array.from({ length: 20 }, (_, i) => { const price = +(99.99 - i * 0.01).toFixed(2); return { price, qty: bidQty[price] ?? 1 }; }),
      asks: Array.from({ length: 20 }, (_, i) => ({ price: +(100 + i * 0.01).toFixed(2), qty: 1 })),
    });
    feeds.BTCUSD.depth(snap({ 99.9: 50 }));                 // a 50-lot bid wall among 1-lots (median 1 → mult 50)
    assert.equal(events.book.length, 1);
    const s1 = events.book[0].summary;
    assert.equal(events.book[0].symbol, 'BTCUSD'); assert.equal(s1.levels.bids.length, 20); assert.equal(s1.levels.asks.length, 20);
    assert.equal(s1.bestBid, 99.99); assert.equal(s1.bestAsk, 100); assert.equal(s1.spread, 0.01);
    assert.equal(s1.walls.length, 1); assert.equal(s1.walls[0].side, 'bid'); assert.equal(s1.walls[0].price, 99.9); assert.equal(s1.walls[0].qty, 50);
    assert.ok(s1.imbalance > 0.5, 'bid-heavy');
    feeds.BTCUSD.depth(snap({ 99.9: 50 }, 2));              // same second → coalesced into a trailing flush
    assert.equal(events.book.length, 1); assert.equal(clock.pending(), 1, 'one book flush timer pending');
    clock.tick(1000);
    assert.equal(events.book.length, 2, 'the trailing frame flushes after 1 s');
    assert.ok(events.book.every((m) => typeof m.summary.t === 'number' && Array.isArray(m.summary.absorbed)));
    // source 05 §4: 30 lots hit the 50-lot bid — absorption is claimed only once the NEXT snapshot shows the wall still standing
    feeds.BTCUSD.trade({ t: clock.now(), p: 99.9, q: 30, side: 'sell' });
    assert.equal(analyst.symbols.get('BTCUSD').book.trades, 1, 'noteTrade wired');
    assert.deepEqual(analyst.bookData('BTCUSD').summary.absorbed, [], 'not before the confirming snapshot');
    clock.tick(1000);
    feeds.BTCUSD.depth(snap({ 99.9: 50 }, 3));
    const bd = analyst.bookData('BTCUSD');
    assert.equal(bd.summary.absorbed.length, 1);
    assert.equal(bd.summary.absorbed[0].side, 'bid'); assert.equal(bd.summary.absorbed[0].price, 99.9); assert.equal(bd.summary.absorbed[0].tradedQty, 30);
    assert.equal(bd.history.length, 2, 'one summary per second (two frames in the same second collapse)');
    assert.equal(bd.frames, 3);
    assert.equal(analyst.snapshot().symbols[0].pro.book, true); assert.equal(analyst.snapshot().symbols[0].pro.depthFrames, 3);
    assert.equal(analyst.proData('BTCUSD').book.summary.absorbed.length, 1);
    assert.equal(analyst.bookData('BTCUSD', 1).history.length, 1);
    // garbage frames neither crash nor count
    feeds.BTCUSD.depth({ nope: 1 }); feeds.BTCUSD.depth(null); feeds.BTCUSD.depth({ bids: 'x', asks: [] });
    assert.equal(analyst.bookData('BTCUSD').frames, 3);
    // the czt ctx carried the book (condition.bookImbalance is bid-heavy here) — visible through the Pro hits once a 5m candle closes
    for (let i = 0; i < 5; i++) feeds.BTCUSD.candle({ t: t0 + i * 60e3, o: 100, h: 100.2, l: 99.9, c: 100.1, v: 1, buyV: 0.6, sellV: 0.4, closed: true });
    const hits = analyst.proData('BTCUSD').hits;
    const r = analyst.symbols.get('BTCUSD').czt;
    assert.equal(hits.bookImbalance, r.condition.hits.includes('bookImbalance'));
    assert.ok(r.sides.long.condition.hits.includes('bookImbalance'), `a 50-lot bid wall makes the visible book bid-heavy: ${r.sides.long.condition.hits.join(',')}`);
    await analyst.stop();
    // a feed that is not live (sim / replay / delayed) never gets a book and says why
    class SimFeed extends ManualFeed { constructor(s) { super(s); this.kind = 'sim'; } async connect() { this.setStatus('sim'); } }
    const sim = new Analyst({ cfg: CFG, symbolsCfg: SYMS, now: () => t0, feedFactory: (s) => new SimFeed(s) });
    await sim.start();
    assert.deepEqual(sim.bookData('BTCUSD'), { symbol: 'BTCUSD', summary: null, history: [], reason: 'No order book for this feed (sim) — the visible top of book exists only on Binance live symbols' });
    assert.match(sim.proData('BTCUSD').book.reason, /No order book for this feed \(sim\)/);
    await sim.stop();
  });

  test('a Binance symbol backfills its aggTrade tape at start (backward, bounded by footprint.backfillMaxRequests) and REBUILDS footprints from tape + live trades; a truncated tape flags older candles partial', async () => {
    const hist = mkCandles({ n: 600, start: Date.UTC(2026, 0, 13, 0, 0) });
    const t0 = hist.at(-1).t + 60e3, prev5 = t0 - 5 * 60e3;
    const { cfg, symbolsCfg } = loadConfig({ env: { ANALYST_SYMBOLS: 'BTCUSD' } }); // feed stays `binance`
    const clock = fakeClock(t0 + 5000);
    const urls = [];
    const row = (id, t, p, q, m) => ({ a: id, p: String(p), q: String(q), f: id, l: id, T: t, m, M: true });
    // a FULL page (1000) inside the previous closed 5m candle → with backfillMaxRequests 1 the walk stops short → partial
    const rows = Array.from({ length: 1000 }, (_, i) => row(5000 + i, prev5 + 60e3 + i * 200, (100 + (i % 5) * 0.01).toFixed(2), 0.5, i % 3 === 0));
    const fetch = fakeFetch({ aggTrades: (url) => { urls.push(url); return { json: rows }; } });
    const c2 = structuredClone(cfg); c2.footprint.backfillMaxRequests = 1;
    const log = createLogger({ now: clock.now, stream: null });
    const feeds = {};
    const mk = (cfg2, fetch2) => new Analyst({ cfg: cfg2, symbolsCfg, log, now: clock.now, timers: clock, feedDeps: { fetch: fetch2 }, feedFactory: (s) => (feeds[s.id] = new ManualFeed(s)) });
    const analyst = mk(c2, fetch);
    const fpEvents = []; analyst.on('footprint', (m) => fpEvents.push(m));
    await analyst.start();
    feeds.BTCUSD.history(hist);
    assert.equal(analyst.footprintData('BTCUSD').backfill.state, 'running');
    // a live trade arrives while the tape is in flight — it must survive the rebuild
    feeds.BTCUSD.trade({ t: t0 + 1000, p: 100.02, q: 2, side: 'buy' });
    await flushAll(clock);
    const fd = analyst.footprintData('BTCUSD');
    assert.equal(fd.backfill.state, 'done', JSON.stringify(fd.backfill));
    assert.equal(fd.backfill.requests, 1); assert.equal(fd.backfill.partial, true); assert.equal(fd.backfill.trades, 1000); assert.equal(fd.backfill.pair, 'BTCUSDT');
    assert.deepEqual(urls, ['https://data-api.binance.vision/api/v3/aggTrades?symbol=BTCUSDT&limit=1000'], 'backward: the NEWEST page first, no startTime');
    const last = fd.footprints.at(-1);
    assert.equal(last.t, prev5); assert.equal(last.nTrades, 1000);
    assert.equal(last.partial, true, 'the candle holding the tape\'s oldest trade is flagged partial — history before it is missing');
    assert.equal(fd.partial, true);
    assert.equal(fd.current.t, t0); assert.equal(fd.current.nTrades, 1, 'the live trade that arrived during the backfill survived the rebuild');
    assert.ok(fpEvents.some((m) => m.rebuilt === true && m.footprint.t === prev5 && m.footprint.nTrades === 1000), 'the rebuilt newest footprint is pushed to the UI');
    assert.ok(log.recent(50).some((e) => /^Footprint tape: 1000 trade\(s\) in 1 request\(s\)/.test(e.msg) && /PARTIAL/.test(e.msg)), log.recent(20).map((e) => e.msg).join(' | '));
    assert.equal(analyst.snapshot().symbols[0].pro.partial, true);
    await analyst.stop();
    // backfillMaxRequests 0 → no request; tradeBackfill:false → no request
    const c3 = structuredClone(cfg); c3.footprint.backfillMaxRequests = 0;
    const a3 = mk(c3, fetch); await a3.start(); feeds.BTCUSD.history(hist); await flushAll(clock, 3);
    assert.equal(urls.length, 1); assert.equal(a3.footprintData('BTCUSD').backfill, null); await a3.stop();
    const a3b = new Analyst({ cfg: c2, symbolsCfg, now: clock.now, timers: clock, feedDeps: { fetch }, tradeBackfill: false, feedFactory: (s) => (feeds[s.id] = new ManualFeed(s)) });
    await a3b.start(); feeds.BTCUSD.history(hist); await flushAll(clock, 3);
    assert.equal(urls.length, 1); assert.equal(a3b.footprintData('BTCUSD').backfill, null); await a3b.stop();
    // a failing tape is a warn line; footprints keep building from the live stream
    const a4 = mk(c2, fakeFetch({ aggTrades: () => ({ status: 500 }) }));
    await a4.start(); feeds.BTCUSD.history(hist); await flushAll(clock);
    assert.equal(a4.footprintData('BTCUSD').backfill.state, 'error'); assert.match(a4.footprintData('BTCUSD').backfill.error, /HTTP 500/);
    assert.ok(log.recent(20).some((e) => e.level === 'warn' && /^Footprint tape backfill failed: Binance aggTrades HTTP 500/.test(e.msg)));
    feeds.BTCUSD.trade({ t: clock.now(), p: 100, q: 1, side: 'buy' });
    assert.equal(a4.footprintData('BTCUSD').current.nTrades, 1);
    await a4.stop();
  });

  test('notifier: journal setup / resolved → setup() / resolved(); reconnecting / error → feedProblem(); the digest once per London day at notify.digestAt', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'analyst-notify-'));
    try {
      const hist = mkCandles({ n: 50, start: Date.UTC(2026, 0, 13, 16, 0) }); // 16:00–16:49 GMT (London == UTC in January); digestAt 17:05
      const t0 = hist.at(-1).t + 60e3;                                         // 16:50
      const clock = fakeClock(t0);
      const journal = createJournal({ cfg: CFG, dir, now: clock.now });
      const calls = [];
      const dueFrom = Date.UTC(2026, 0, 13, 17, 5);
      let sentDay = null;
      const notifier = {
        enabled: true,
        setup: async (s) => { calls.push(['setup', s.id]); return { sent: true }; },
        resolved: async (s) => { calls.push(['resolved', s.id, s.status]); return { sent: true }; },
        feedProblem: async (sym, msg) => { calls.push(['feedProblem', sym, msg]); return { sent: true }; },
        digestDue: (t) => ({ due: t >= dueFrom && sentDay !== '2026-01-13', dayKey: '2026-01-13', localTime: '17:05' }),
        digest: async (rows, o) => { calls.push(['digest', o.dayKey, o.setupsToday, rows.length]); sentDay = o.dayKey; return { sent: true }; },
      };
      const log = createLogger({ now: clock.now, stream: null });
      const feeds = {};
      const analyst = new Analyst({ cfg: CFG, symbolsCfg: SYMS, log, journal, notifier, now: clock.now, timers: clock, feedFactory: (s) => (feeds[s.id] = new ManualFeed(s)) });
      await analyst.start();
      const setup = { id: 'BTCUSD-manual-long', symbol: 'BTCUSD', t: t0 - 5 * 60e3, tf: '5m', side: 'long', entry: 100, stop: 99, targets: [{ price: 102, label: 'x', rr: 2 }], rr: 2, score: 8, grade: 'B', condition: { hits: [] }, zone: { hits: [] }, trigger: { kind: 'sweepReclaim', hits: [] }, reasons: [], invalidation: 'x', size: { units: 1, riskUsd: 1, riskPct: 1 }, status: 'open' };
      journal.record(setup);
      await clock.flush();
      assert.deepEqual(calls, [['setup', 'BTCUSD-manual-long']], 'journal setup → notifier.setup');
      feeds.BTCUSD.history(hist);
      analyst.symbols.get('BTCUSD').openSetup = journal.get(setup.id);
      feeds.BTCUSD.candle({ t: t0, o: 100, h: 102.5, l: 99.9, c: 102.2, v: 1, closed: true }); // 16:50 → won; closes 16:51 < 17:05 → no digest
      await clock.flush();
      assert.deepEqual(calls[1], ['resolved', 'BTCUSD-manual-long', 'won']); assert.equal(calls.length, 2);
      for (let i = 1; i <= 14; i++) feeds.BTCUSD.candle({ t: t0 + i * 60e3, o: 100, h: 100.2, l: 99.9, c: 100.1, v: 1, closed: true }); // … 17:04 closes at 17:05
      await clock.flush();
      const digests = calls.filter((c) => c[0] === 'digest');
      assert.deepEqual(digests, [['digest', '2026-01-13', 1, 1]], 'once, with the London dayKey, today\'s setup count and the by-trigger rows');
      assert.ok(log.recent(20).some((e) => /^Telegram digest sent for 2026-01-13/.test(e.msg)));
      for (let i = 15; i <= 17; i++) feeds.BTCUSD.candle({ t: t0 + i * 60e3, o: 100, h: 100.2, l: 99.9, c: 100.1, v: 1, closed: true });
      await clock.flush();
      assert.equal(calls.filter((c) => c[0] === 'digest').length, 1, 'the day is remembered — later closes never resend');
      feeds.BTCUSD.setStatus('reconnecting', 'closed (1006)');
      assert.deepEqual(calls.at(-1), ['feedProblem', 'BTCUSD', 'feed reconnecting — closed (1006)']);
      feeds.BTCUSD.setStatus('error', '10 consecutive failures');
      assert.deepEqual(calls.at(-1), ['feedProblem', 'BTCUSD', 'feed error — 10 consecutive failures']);
      const n = calls.length;
      feeds.BTCUSD.setStatus('live');
      assert.equal(calls.length, n, 'live is not a problem');
      assert.deepEqual(analyst.snapshot().notifier, { enabled: true });
      await analyst.stop();
      journal.record({ ...setup, id: 'BTCUSD-manual-2' });
      await clock.flush();
      assert.ok(!calls.some((c) => c[1] === 'BTCUSD-manual-2'), 'stop() detaches the notifier from the journal');
      // without a notifier nothing is reported and nothing breaks
      const plain = build({ startMs: t0 });
      assert.equal(plain.analyst.snapshot().notifier, null);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
