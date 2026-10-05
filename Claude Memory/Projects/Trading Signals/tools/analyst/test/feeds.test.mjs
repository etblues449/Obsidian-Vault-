// test/feeds.test.mjs — SPEC §3 / §8: the four adapters behind one contract, offline and deterministic.
// Binance parsing uses the captured samples from SPEC §8 verbatim; sockets, fetch and the clock are fakes.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { FEEDS, createFeed } from '../lib/feeds/registry.mjs';
import { ReplayFeed } from '../lib/feeds/replay.mjs';
import { SimulatedFeed } from '../lib/feeds/simulated.mjs';
import { BinanceFeed, parseKlineRow, parseKline, parseAggTrade, parseStreamMessage, REST_BASE } from '../lib/feeds/binance.mjs';
import { YahooFeed, parseYahooChart } from '../lib/feeds/yahoo.mjs';
import { backoffMs } from '../lib/feeds/base.mjs';
import { loadConfig } from '../lib/config.mjs';
import { mkCandles, fakeClock, fakeWebSocket, fakeFetch } from './helpers.mjs';

const KLINE = JSON.parse('{"stream":"btcusdt@kline_1m","data":{"e":"kline","E":1791142274032,"s":"BTCUSDT","k":{"t":1791142260000,"T":1791142319999,"s":"BTCUSDT","i":"1m","f":6734731469,"L":6734731522,"o":"85462.50000000","c":"85462.50000000","h":"85462.50000000","l":"85462.49000000","v":"0.29537000","n":54,"x":false,"q":"25243.05602030","V":"0.03490000","Q":"2982.64125000","B":"0"}}}');
const AGG = JSON.parse('{"stream":"paxgusdt@aggTrade","data":{"e":"aggTrade","E":1791142265500,"s":"PAXGUSDT","a":37416157,"p":"4146.00000000","q":"0.01890000","f":51562765,"l":51562765,"T":1791142265492,"m":false,"M":true}}');
const ROW = JSON.parse('[1791142140000,"85466.00000000","85466.01000000","85462.49000000","85462.50000000","0.81900000",1791142199999,"69996.12071080",236,"0.23085000","19729.73114640","0"]');
const collect = (feed) => { const ev = { history: [], candle: [], trade: [], status: [], done: [] }; for (const k of Object.keys(ev)) feed.on(k, (m) => ev[k].push(m)); return ev; };
const { cfg, symbolsCfg } = loadConfig({ env: {} });

describe('registry', () => {
  test('every configured adapter exists; createFeed builds the right class; unknown names throw', () => {
    assert.deepEqual(Object.keys(FEEDS).sort(), ['binance', 'replay', 'simulated', 'yahoo']);
    for (const s of symbolsCfg.symbols) assert.ok(createFeed(s, { cfg, symbolsCfg }) instanceof FEEDS[s.feed]);
    const y = createFeed({ id: 'OIL', feed: 'yahoo' }, { cfg, symbolsCfg });
    assert.equal(y.ticker, 'CL=F'); assert.equal(y.pollMs, 60_000);
    assert.throws(() => createFeed({ id: 'X', feed: 'bloomberg' }), /unknown feed adapter/);
    assert.equal(backoffMs(3), 8000); assert.equal(backoffMs(20), 60000);
  });
});

describe('replay', () => {
  test('emits history (all but the last N), then the rest as closed candles synchronously, then done', async () => {
    const candles = mkCandles({ n: 30 });
    const feed = new ReplayFeed({ id: 'BTCUSD' }, { candles, playLast: 5 });
    const ev = collect(feed);
    assert.equal(feed.kind, 'replay');
    await feed.connect();
    assert.equal(ev.history.length, 1); assert.equal(ev.history[0].candles.length, 25);
    assert.deepEqual(ev.candle.map((m) => m.candle.t), candles.slice(25).map((c) => c.t));
    assert.ok(ev.candle.every((m) => m.candle.closed === true));
    assert.deepEqual(ev.status.map((s) => s.state), ['connecting', 'live']);
    assert.equal(ev.done.length, 1); assert.equal(feed.done, true);
    await feed.close();
    assert.equal(ev.status[ev.status.length - 1].state, 'closed');
  });
  test('forming option emits a forming print before each close; speed paces on the injected timers; trades ride along', async () => {
    const candles = mkCandles({ n: 6 });
    const clock = fakeClock(0);
    const trades = [{ t: candles[4].t + 1000, p: 1, q: 1, side: 'buy' }, { t: candles[5].t + 1000, p: 1, q: 1, side: 'sell' }];
    const feed = new ReplayFeed({ id: 'BTCUSD' }, { candles, trades, playLast: 2, forming: true, speed: 100 }, clock);
    const ev = collect(feed);
    await feed.connect();
    assert.equal(ev.candle.length, 0, 'nothing yet: paced');
    clock.tick(100);
    assert.deepEqual(ev.candle.map((m) => m.candle.closed), [false, true]);
    assert.equal(ev.trade.length, 1);
    clock.tick(100);
    assert.equal(ev.candle.length, 4); assert.equal(ev.trade.length, 2); assert.equal(ev.done.length, 1);
  });
});

describe('simulated', () => {
  test('status sim at once; deterministic seeded history; closes candles on minute boundaries from 1 s ticks', async () => {
    const mk = () => { const clock = fakeClock(Date.UTC(2026, 0, 13, 8, 0, 30)); return { clock, feed: new SimulatedFeed({ id: 'OIL', feedParams: { seed: 70, volatility: 0.0008, tickSize: 0.01 } }, { backfillMinutes: 120 }, clock) }; };
    const a = mk(), b = mk();
    const ea = collect(a.feed), eb = collect(b.feed);
    await a.feed.connect(); await b.feed.connect();
    assert.equal(ea.status[0].state, 'sim'); assert.equal(a.feed.kind, 'sim');
    assert.equal(ea.history[0].candles.length, 120);
    assert.deepEqual(ea.history[0].candles, eb.history[0].candles, 'same seed, same tape');
    const h = ea.history[0].candles;
    assert.equal(h[h.length - 1].t, Date.UTC(2026, 0, 13, 7, 59), 'history ends the minute before now');
    assert.ok(h.every((c) => c.closed && c.h >= Math.max(c.o, c.c) && c.l <= Math.min(c.o, c.c) && c.buyV + c.sellV === c.v));
    assert.ok(h.every((c) => Math.abs(c.c / 0.01 - Math.round(c.c / 0.01)) < 1e-6), 'tick-rounded');
    a.clock.tick(29_000);
    assert.equal(ea.trade.length, 29); assert.equal(ea.candle.length, 29);
    assert.ok(ea.candle.every((m) => m.candle.closed === false && m.candle.t === Date.UTC(2026, 0, 13, 8, 0)));
    a.clock.tick(1000); // crosses 08:01
    const closed = ea.candle.filter((m) => m.candle.closed);
    assert.equal(closed.length, 1); assert.equal(closed[0].candle.t, Date.UTC(2026, 0, 13, 8, 0)); assert.equal(closed[0].candle.n, 29);
    assert.equal(ea.candle[ea.candle.length - 1].candle.t, Date.UTC(2026, 0, 13, 8, 1));
    await a.feed.close(); await b.feed.close();
    const n = ea.candle.length; a.clock.tick(5000);
    assert.equal(ea.candle.length, n, 'closed feed stops ticking');
  });
});

describe('binance parsing (SPEC §8 samples)', () => {
  test('kline → candle with taker-buy delta; aggTrade m=false → buy; REST row → closed candle', () => {
    const c = parseKline(KLINE.data);
    assert.deepEqual(c, { t: 1791142260000, o: 85462.5, h: 85462.5, l: 85462.49, c: 85462.5, v: 0.29537, n: 54, closed: false, buyV: 0.0349, sellV: 0.29537 - 0.0349 });
    assert.deepEqual(parseAggTrade(AGG.data), { t: 1791142265492, p: 4146, q: 0.0189, side: 'buy' });
    assert.equal(parseAggTrade({ ...AGG.data, m: true }).side, 'sell', 'buyer is maker ⇒ seller aggressed');
    const r = parseKlineRow(ROW, 1791142300000);
    assert.deepEqual(r, { t: 1791142140000, o: 85466, h: 85466.01, l: 85462.49, c: 85462.5, v: 0.819, n: 236, closed: true, buyV: 0.23085, sellV: 0.819 - 0.23085 });
    assert.equal(parseKlineRow(ROW, 1791142150000).closed, false, 'close time still ahead of now ⇒ forming');
    assert.deepEqual(parseStreamMessage(JSON.stringify(KLINE)).candle, c);
    assert.ok(parseStreamMessage(JSON.stringify(AGG)).trade);
    assert.equal(parseStreamMessage('{"result":null,"id":1}'), null); assert.equal(parseStreamMessage('not json'), null);
  });
});

describe('binance adapter', () => {
  const page = (fromT, n, nowMs) => Array.from({ length: n }, (_, i) => { const t = fromT + i * 60e3; return [t, '100', '101', '99', '100.5', '2', t + 59999, '0', 10, '1.2', '0', '0']; });
  function harness({ backfillMinutes = 1500, nowMs = Date.UTC(2026, 0, 13, 8, 0, 0) } = {}) {
    const clock = fakeClock(nowMs);
    const WS = fakeWebSocket();
    const rows = [];
    const fetch = fakeFetch({
      [`${REST_BASE}/klines`]: (url) => {
        const u = new URL(url); rows.push(u.search);
        if (u.searchParams.get('startTime')) { const st = Number(u.searchParams.get('startTime')); return { json: page(st, Math.min(1000, Math.max(0, (clock.now() - st) / 60e3)), clock.now()) }; }
        const end = Number(u.searchParams.get('endTime')); const start = Math.floor(end / 60e3) * 60e3 - 999 * 60e3;
        return { json: page(start, 1000, clock.now()) };
      },
    });
    const feed = new BinanceFeed({ id: 'BTCUSD', feedParams: { stream: 'btcusdt' } }, { backfillMinutes }, { fetch, WebSocket: WS, now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, random: () => 0.5 });
    return { clock, WS, fetch, feed, rows, ev: collect(feed) };
  }
  test('backfills paginated (≤ 1 request/s), emits history + forming candle, opens ONE combined socket, goes live', async () => {
    const h = harness();
    const p = h.feed.connect();
    await h.clock.flush();
    assert.equal(h.fetch.calls.length, 1, 'second page waits for the 1 s gap');
    h.clock.tick(1000); await h.clock.flush();
    assert.equal(h.fetch.calls.length, 2);
    h.clock.tick(1000); await h.clock.flush(); await p;
    assert.equal(h.ev.history.length, 1);
    const hist = h.ev.history[0].candles;
    assert.ok(hist.length >= 1499 && hist.length <= 1500, `covers backfillMinutes (${hist.length})`);
    assert.ok(hist.every((c, i) => !i || c.t > hist[i - 1].t), 'sorted, deduped');
    assert.ok(hist.every((c) => c.closed && c.buyV === 1.2 && c.sellV === 0.8));
    assert.equal(h.ev.candle.length, 1); assert.equal(h.ev.candle[0].candle.closed, false, 'the forming kline rides as a candle event');
    assert.equal(h.WS.instances.length, 1);
    assert.equal(h.WS.last().url, 'wss://data-stream.binance.vision/stream?streams=btcusdt@kline_1m/btcusdt@aggTrade');
    assert.equal(h.feed.state, 'connecting');
    h.WS.last().open(); await h.clock.flush();
    assert.equal(h.feed.state, 'live');
    h.WS.last().message(KLINE); h.WS.last().message(AGG);
    assert.equal(h.ev.candle.length, 2); assert.equal(h.ev.trade.length, 1);
    await h.feed.close();
    assert.equal(h.feed.state, 'closed'); assert.equal(h.clock.pending(), 0, 'no timers left behind');
  });
  test('drop → reconnecting with backoff; 90 s silence → watchdog reconnect; gap is re-backfilled; 10 failures → error but keeps trying', async () => {
    const h = harness({ backfillMinutes: 60 });
    const p = h.feed.connect(); await h.clock.flush(); await p;
    const ws1 = h.WS.last(); ws1.open(); await h.clock.flush();
    assert.equal(h.feed.state, 'live');
    ws1.close(1006, 'gone');
    assert.equal(h.feed.state, 'reconnecting');
    assert.equal(h.WS.instances.length, 1);
    h.clock.tick(1000); // backoff attempt 1 = 1 s
    assert.equal(h.WS.instances.length, 2, 'new socket after the backoff');
    const ws2 = h.WS.last();
    h.clock.tick(5 * 60e3); // five minutes pass before it opens → gap
    ws2.open(); await h.clock.flush(); await h.clock.flush();
    assert.ok(h.rows.some((q) => /startTime=/.test(q)), 'gap re-backfill from the last closed candle');
    assert.ok(h.ev.candle.filter((m) => m.candle.closed).length >= 3, 'gap candles emitted as closed prints');
    assert.equal(h.feed.state, 'live');
    ws2.message(KLINE);
    h.clock.tick(90_000); // silence
    assert.equal(h.feed.state, 'reconnecting'); assert.equal(ws2.readyState, 3, 'watchdog terminated the silent socket');
    // 10 consecutive failures → error status, still reconnecting
    for (let i = 0; i < 10; i++) { h.clock.tick(60_000); const w = h.WS.last(); w.error(new Error('refused')); }
    assert.equal(h.feed.state, 'error'); assert.match(h.feed.lastStatusDetail ?? h.ev.status[h.ev.status.length - 1].detail, /consecutive failures/);
    h.clock.tick(60_000);
    assert.ok(h.WS.instances.length >= 12, 'keeps trying after error');
    await h.feed.close();
  });
  test('429 holds REST off until Retry-After; a failed backfill still streams', async () => {
    const clock = fakeClock(Date.UTC(2026, 0, 13, 8, 0));
    const WS = fakeWebSocket();
    let calls = 0;
    const fetch = fakeFetch({ klines: () => (++calls === 1 ? { status: 429, headers: { 'retry-after': '7' } } : { json: [] }) });
    const feed = new BinanceFeed({ id: 'XAUUSD', feedParams: { stream: 'paxgusdt' } }, { backfillMinutes: 60 }, { fetch, WebSocket: WS, now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
    const ev = collect(feed);
    const p = feed.connect(); await clock.flush(); await p;
    assert.equal(ev.history.length, 1); assert.equal(ev.history[0].candles.length, 0, 'empty history rather than no history');
    assert.equal(WS.instances.length, 1, 'socket opened anyway');
    assert.equal(feed.restRetryAt, clock.now() + 7000);
    await feed.close();
  });
});

describe('yahoo', () => {
  const body = (ts, { nullAt = -1 } = {}) => ({ chart: { result: [{ timestamp: ts.map((t) => t / 1000), indicators: { quote: [{ open: ts.map((_, i) => (i === nullAt ? null : 10)), high: ts.map(() => 11), low: ts.map(() => 9), close: ts.map(() => 10.5), volume: ts.map(() => 100) }] } }] } });
  test('parses the chart body (skipping null rows); first poll = history + forming; later polls emit only new closed candles; errors degrade to status error at 5× interval', async () => {
    const t0 = Date.UTC(2026, 0, 13, 8, 0);
    const ts = [t0, t0 + 60e3, t0 + 120e3, t0 + 180e3];
    assert.equal(parseYahooChart(body(ts, { nullAt: 1 })).length, 3);
    assert.throws(() => parseYahooChart({ chart: { error: { description: 'Not Found' } } }), /Not Found/);
    const clock = fakeClock(t0 + 180e3 + 30e3);
    let n = 0;
    const fetch = fakeFetch({ 'finance/chart/CL%3DF': () => { n++; if (n === 2) return { status: 429 }; const extra = n >= 3 ? [t0 + 240e3] : []; return { json: body([...ts, ...extra]) }; } });
    const feed = new YahooFeed({ id: 'OIL' }, { pollSeconds: 60, symbols: { OIL: 'CL=F' } }, { fetch, now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
    const ev = collect(feed);
    await feed.connect();
    assert.equal(feed.kind, 'delayed'); assert.equal(feed.state, 'delayed');
    assert.equal(ev.history[0].candles.length, 3, 'three closed minutes'); assert.equal(ev.candle.length, 1); assert.equal(ev.candle[0].candle.closed, false, 'the newest bar is still forming');
    clock.tick(60_000); await clock.flush();
    assert.equal(feed.state, 'error'); assert.match(ev.status[ev.status.length - 1].detail, /HTTP 429/);
    clock.tick(60_000); await clock.flush();
    assert.equal(n, 2, 'after an error the poll waits 5× the interval');
    clock.tick(240_000); await clock.flush();
    assert.equal(n, 3); assert.equal(feed.state, 'delayed');
    const closedNew = ev.candle.filter((m) => m.candle.closed);
    assert.deepEqual(closedNew.map((m) => m.candle.t), [t0 + 180e3, t0 + 240e3], 'only candles newer than the last closed one, now closed');
    await feed.close();
    assert.equal(clock.pending(), 0);
  });
});
