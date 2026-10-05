// test/orderbook.test.mjs — SPEC-PRO §P2 / §P8: depth frame parsing, summary numbers by hand, walls by median,
// pulled vs traded-through (decided by noteTrade, never by qty changes), absorbed only after the wall is SEEN to
// persist/refill with ≥ absorbRatio × qty printed at its price, the 1-per-second history ring bounded by
// historySeconds, and the stand-alone depth adapter on fake socket/clock/fetch. Every expected number is hand-computed.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ORDERBOOK_DEFAULTS, orderbookConfig, median, normalizeSnapshot, findWalls, summarizeSnapshot,
  bookImbalanceFavours, recentAbsorption, OrderBook,
} from '../lib/engine/orderbook.mjs';
import {
  REST_BASE, WS_BASE, depthStreamName, isDepthStream, depthRestUrl, parseDepthLevels, parseDepthMessage,
  fetchDepthSnapshot, BinanceDepthFeed,
} from '../lib/feeds/binance-depth.mjs';
import { fakeClock, fakeWebSocket, fakeFetch } from './helpers.mjs';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
/** 20 bid levels 100…81 and 20 ask levels 101…120, qty 1 each, with per-price overrides {price: qty}. */
function mkBook(t, { bids = {}, asks = {} } = {}) {
  const b = [], a = [];
  for (let i = 0; i < 20; i++) { const p = 100 - i; b.push({ price: p, qty: bids[p] ?? 1 }); }
  for (let i = 0; i < 20; i++) { const p = 101 + i; a.push({ price: p, qty: asks[p] ?? 1 }); }
  return { t, bids: b, asks: a };
}
const CFG = { orderbook: { pullWindowMs: 3000, absorbRatio: 0.5, absorbWindowSec: 120 } };
const strip = (e) => ({ side: e.side, price: e.price, qty: e.qty, tradedQty: e.tradedQty, at: e.at, ageMs: e.ageMs });

const DEPTH = '{"stream":"btcusdt@depth20","data":{"lastUpdateId":1027024,"bids":[["85462.50000000","0.29537000"],["85462.49000000","1.00000000"],["85462.40000000","0.50000000"]],"asks":[["85462.51000000","0.50000000"],["85462.60000000","2.00000000"],["85462.52000000","0.10000000"]]}}';
const KLINE = '{"stream":"btcusdt@kline_1m","data":{"e":"kline","E":1791142274032,"s":"BTCUSDT","k":{"t":1791142260000,"T":1791142319999,"s":"BTCUSDT","i":"1m","f":6734731469,"L":6734731522,"o":"85462.50000000","c":"85462.50000000","h":"85462.50000000","l":"85462.49000000","v":"0.29537000","n":54,"x":false,"q":"25243.05602030","V":"0.03490000","Q":"2982.64125000","B":"0"}}}';

describe('config + maths', () => {
  test('orderbookConfig falls back to the §P5 defaults for missing or invalid values', () => {
    assert.deepEqual(orderbookConfig(undefined), ORDERBOOK_DEFAULTS);
    assert.deepEqual(orderbookConfig({}), ORDERBOOK_DEFAULTS);
    const c = orderbookConfig({ orderbook: { wallMult: 4, pullWindowMs: -1, historySeconds: 10.7, levels: 'x' } });
    assert.equal(c.wallMult, 4); assert.equal(c.pullWindowMs, 3000); assert.equal(c.historySeconds, 10); assert.equal(c.levels, 20);
  });
  test('median: odd → middle, even → mean of the two middles, empty → NaN, non-finite ignored', () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([1, 2, 4, 13]), 3);
    assert.equal(median([1]), 1);
    assert.ok(Number.isNaN(median([])));
    assert.equal(median([NaN, 5, Infinity, 1]), 3);
  });
});

describe('snapshot normalisation + summary numbers (by hand)', () => {
  test('bids best (highest) first, asks best (lowest) first, pairs or objects, non-finite/zero rows dropped, trimmed to levels', () => {
    const s = normalizeSnapshot({ t: 5, bids: [[99, 1], [100, 2], ['98', '3'], ['x', 1], [97, 0]], asks: [{ price: 103, qty: 1 }, { price: 101, qty: 1 }, [102, 2]], lastUpdateId: 7 }, { levels: 20 });
    assert.deepEqual(s, { t: 5, bids: [{ price: 100, qty: 2 }, { price: 99, qty: 1 }, { price: 98, qty: 3 }], asks: [{ price: 101, qty: 1 }, { price: 102, qty: 2 }, { price: 103, qty: 1 }], lastUpdateId: 7 });
    assert.equal(normalizeSnapshot({ bids: [[1, 1], [2, 1], [3, 1]], asks: [] }, { levels: 2 }).bids.length, 2);
    assert.equal(normalizeSnapshot({ bids: [], asks: [] }).t, null);
    assert.throws(() => normalizeSnapshot(null), TypeError);
  });
  test('bestBid 100, bestAsk 101 → mid 100.5, spread 1, spreadBp 10000/100.5, depths 6/4, imbalance 0.2; no walls', () => {
    const s = summarizeSnapshot({ t: 1000, bids: [[100, 2], [99, 1], [98, 3]], asks: [[101, 1], [102, 2], [103, 1]] });
    assert.equal(s.t, 1000); assert.equal(s.bestBid, 100); assert.equal(s.bestAsk, 101);
    assert.equal(s.mid, 100.5); assert.equal(s.spread, 1); near(s.spreadBp, 10000 / 100.5);
    near(s.spreadBp, 99.50248756218906);
    assert.equal(s.bidDepth, 6); assert.equal(s.askDepth, 4); near(s.imbalance, 0.2);
    assert.deepEqual(s.walls, []); assert.deepEqual(s.nearestWall, { bid: null, ask: null });
    assert.deepEqual([s.pulled, s.absorbed, s.tradedThrough], [[], [], []]);
    assert.deepEqual(s.levels.bids.map((l) => l.price), [100, 99, 98]);
  });
  test('imbalance sign: bid-heavy positive, ask-heavy negative, one-sided ±1, empty 0 with null prices', () => {
    near(summarizeSnapshot({ bids: [[100, 1]], asks: [[101, 3]] }).imbalance, -0.5);
    assert.equal(summarizeSnapshot({ bids: [[100, 1]], asks: [] }).imbalance, 1);
    const e = summarizeSnapshot({ bids: [], asks: [] });
    assert.equal(e.imbalance, 0); assert.equal(e.bestBid, null); assert.equal(e.mid, null); assert.equal(e.spread, null); assert.equal(e.spreadBp, null);
  });
});

describe('walls by median', () => {
  test('one 6-lot among nineteen 1-lots: median 1 (the wall is in the median), 6 ≥ 5×1 → wall mult 6; 4.9 is not', () => {
    const book = mkBook(0, { bids: { 95: 6, 90: 4.9 } });
    const w = findWalls(normalizeSnapshot(book).bids, 'bid', 5);
    assert.deepEqual(w, [{ side: 'bid', price: 95, qty: 6, mult: 6 }]);
    assert.deepEqual(findWalls(normalizeSnapshot(book).asks, 'ask', 5), []);
  });
  test('even count uses the mean of the two middles: [1,2,4,13] → 3 → threshold 15: 13 no, 15 yes (inclusive)', () => {
    assert.deepEqual(findWalls([{ price: 101, qty: 1 }, { price: 102, qty: 2 }, { price: 103, qty: 4 }, { price: 104, qty: 13 }], 'ask'), []);
    const w = findWalls([{ price: 101, qty: 1 }, { price: 102, qty: 2 }, { price: 103, qty: 4 }, { price: 104, qty: 15 }], 'ask');
    assert.deepEqual(w, [{ side: 'ask', price: 104, qty: 15, mult: 5 }]);
    assert.deepEqual(findWalls([], 'ask'), []);
    assert.deepEqual(findWalls([{ price: 1, qty: 9 }], 'bid', 5), [], 'a single level is its own median — mult 1 < 5');
    assert.deepEqual(findWalls([{ price: 1, qty: 9 }], 'bid', 1), [{ side: 'bid', price: 1, qty: 9, mult: 1 }]);
  });
  test('summary walls sorted by price, nearestWall = highest bid wall / lowest ask wall, wallMult from cfg', () => {
    const s = summarizeSnapshot(mkBook(0, { bids: { 95: 6, 88: 7 }, asks: { 110: 5, 104: 8 } }));
    assert.deepEqual(s.walls.map((w) => [w.side, w.price, w.qty, w.mult, w.ageMs]), [['bid', 88, 7, 7, 0], ['bid', 95, 6, 6, 0], ['ask', 104, 8, 8, 0], ['ask', 110, 5, 5, 0]]);
    assert.equal(s.nearestWall.bid.price, 95); assert.equal(s.nearestWall.ask.price, 104);
    const strict = summarizeSnapshot(mkBook(0, { bids: { 95: 6 } }), { orderbook: { wallMult: 7 } });
    assert.deepEqual(strict.walls, []);
  });
});

describe('OrderBook — pulled vs traded-through (decided by noteTrade)', () => {
  test('a wall that vanishes with nothing printed at its price is PULLED once it has been gone for pullWindowMs', () => {
    const ob = new OrderBook({ cfg: CFG, tick: 1 });
    ob.applySnapshot(mkBook(0, { bids: { 90: 10 } }));
    assert.deepEqual(ob.summary().walls.map((w) => [w.side, w.price, w.qty, w.mult, w.ageMs, w.refills, w.tradedQty]), [['bid', 90, 10, 10, 0, 0, 0]]);
    ob.applySnapshot(mkBook(1000, { bids: { 90: 10 } }));
    assert.equal(ob.summary().walls[0].ageMs, 1000);
    ob.applySnapshot(mkBook(2000));                       // gone
    assert.deepEqual(ob.summary().walls, []); assert.deepEqual(ob.summary().pulled, [], 'not yet — may still refill');
    ob.applySnapshot(mkBook(3000));                       // t − lastSeen = 2000 < 3000
    assert.deepEqual(ob.summary().pulled, []);
    const s = ob.applySnapshot(mkBook(4000));             // 3000 ≥ pullWindowMs → finalised
    assert.deepEqual(s.pulled.map(strip), [{ side: 'bid', price: 90, qty: 10, tradedQty: 0, at: 2000, ageMs: 2000 }]);
    assert.equal(s.pulled[0].lastQty, 10);
    assert.deepEqual(s.tradedThrough, []); assert.deepEqual(s.absorbed, []);
    assert.equal(ob.unobserved, 0);
    const later = ob.applySnapshot(mkBook(9000));
    assert.equal(later.pulled[0].ageMs, 7000, 'event age keeps counting');
  });
  test('the same disappearance after ≥ absorbRatio × qty printed AT the wall price is TRADED THROUGH, not pulled', () => {
    const ob = new OrderBook({ cfg: CFG, tick: 1 });
    ob.applySnapshot(mkBook(0, { bids: { 90: 10 } }));
    ob.applySnapshot(mkBook(1000, { bids: { 90: 10 } }));
    assert.equal(ob.noteTrade({ t: 1500, p: 90, q: 6, side: 'sell' }), true);
    assert.equal(ob.summary().walls[0].tradedQty, 6, 'live walls show what printed into them');
    assert.deepEqual(ob.summary().absorbed, [], 'absorption needs a snapshot that SEES the wall persist after the volume');
    ob.applySnapshot(mkBook(2000));
    ob.applySnapshot(mkBook(5000));
    const s = ob.summary();
    assert.deepEqual(s.pulled, []);
    assert.deepEqual(s.tradedThrough.map(strip), [{ side: 'bid', price: 90, qty: 10, tradedQty: 6, at: 2000, ageMs: 3000 }]);
  });
  test('prints NEXT to the wall do not count: 50 lots at 89 under a 90 wall → still pulled; 4 lots at 90 (< 5) → still pulled', () => {
    const ob = new OrderBook({ cfg: CFG, tick: 1 });
    ob.applySnapshot(mkBook(0, { bids: { 90: 10 } }));
    assert.equal(ob.noteTrade({ t: 500, p: 89, q: 50, side: 'sell' }), false);
    assert.equal(ob.noteTrade({ t: 600, p: 90, q: 4, side: 'sell' }), true);
    ob.applySnapshot(mkBook(1000)); ob.applySnapshot(mkBook(4000));
    const s = ob.summary();
    assert.deepEqual(s.pulled.map(strip), [{ side: 'bid', price: 90, qty: 10, tradedQty: 4, at: 1000, ageMs: 3000 }]);
    assert.deepEqual(s.tradedThrough, []);
  });
  test('a wall that vanished across a snapshot gap wider than pullWindowMs is UNOBSERVED — nothing is claimed', () => {
    const ob = new OrderBook({ cfg: CFG, tick: 1 });
    ob.applySnapshot(mkBook(0, { asks: { 110: 10 } }));
    const s = ob.applySnapshot(mkBook(10_000));
    assert.deepEqual(s.pulled, []); assert.deepEqual(s.tradedThrough, []); assert.deepEqual(s.walls, []);
    assert.equal(ob.unobserved, 1);
  });
  test('trades before any wall exists are not counted; bad prints are rejected', () => {
    const ob = new OrderBook({ cfg: CFG, tick: 1 });
    assert.equal(ob.noteTrade({ t: 0, p: 90, q: 100, side: 'sell' }), false);
    ob.applySnapshot(mkBook(1000, { bids: { 90: 10 } }));
    assert.equal(ob.summary().walls[0].tradedQty, 0);
    assert.equal(ob.noteTrade({ t: 1, p: NaN, q: 1 }), false); assert.equal(ob.noteTrade({ t: 1, p: 90, q: 0 }), false); assert.equal(ob.noteTrade(null), false);
  });
});

describe('OrderBook — absorbed (source 05 §4: effort into a passive wall that holds)', () => {
  test('a bid wall of 10 persists while 5 lots print at its price → absorbed at the confirming snapshot; 4.5 is not enough', () => {
    const ob = new OrderBook({ cfg: CFG, tick: 1 });
    ob.applySnapshot(mkBook(0, { bids: { 90: 10 } }));
    ob.applySnapshot(mkBook(1000, { bids: { 90: 10 } }));
    ob.noteTrade({ t: 1500, p: 90, q: 4.5, side: 'sell' });
    assert.deepEqual(ob.applySnapshot(mkBook(2000, { bids: { 90: 10 } })).absorbed, [], '4.5 < 0.5 × 10');
    ob.noteTrade({ t: 2500, p: 90, q: 0.5, side: 'sell' });
    const s = ob.applySnapshot(mkBook(3000, { bids: { 90: 10 } }));
    assert.deepEqual(s.absorbed.map(strip), [{ side: 'bid', price: 90, qty: 10, tradedQty: 5, at: 3000, ageMs: 0 }]);
    assert.equal(s.absorbed[0].lastQty, 10);
    assert.deepEqual(s.walls.map((w) => [w.price, w.ageMs, w.tradedQty]), [[90, 3000, 5]]);
    // more volume keeps flowing into it: the entry tracks tradedQty live, `at` stays the confirmation time
    ob.noteTrade({ t: 3500, p: 90, q: 2, side: 'sell' });
    const s2 = ob.applySnapshot(mkBook(4000, { bids: { 90: 10 } }));
    assert.deepEqual(s2.absorbed.map(strip), [{ side: 'bid', price: 90, qty: 10, tradedQty: 7, at: 3000, ageMs: 1000 }]);
    // then it is eaten: absorbed stays on record AND the disappearance is traded-through
    ob.applySnapshot(mkBook(5000)); ob.applySnapshot(mkBook(8000));
    const s3 = ob.summary();
    assert.deepEqual(s3.absorbed.map(strip), [{ side: 'bid', price: 90, qty: 10, tradedQty: 7, at: 3000, ageMs: 5000 }]);
    assert.deepEqual(s3.tradedThrough.map(strip), [{ side: 'bid', price: 90, qty: 10, tradedQty: 7, at: 5000, ageMs: 3000 }]);
    assert.deepEqual(s3.pulled, []);
    // events expire after absorbWindowSec
    const s4 = ob.applySnapshot(mkBook(200_000));
    assert.deepEqual([s4.absorbed, s4.tradedThrough, s4.pulled], [[], [], []]);
  });
  test('REFILL: the wall dips out for one frame while 6 lots print, comes back inside pullWindowMs → absorbed, refills 1, never pulled', () => {
    const ob = new OrderBook({ cfg: CFG, tick: 1 });
    ob.applySnapshot(mkBook(0, { asks: { 110: 10 } }));
    ob.applySnapshot(mkBook(1000, { asks: { 110: 10 } }));
    ob.noteTrade({ t: 1500, p: 110, q: 6, side: 'buy' });
    ob.applySnapshot(mkBook(2000));                              // dip
    assert.deepEqual(ob.summary().absorbed, [], 'not standing → not yet');
    const s = ob.applySnapshot(mkBook(3000, { asks: { 110: 10 } }));   // back
    assert.deepEqual(s.walls.map((w) => [w.side, w.price, w.ageMs, w.refills, w.tradedQty]), [['ask', 110, 3000, 1, 6]]);
    assert.deepEqual(s.absorbed.map(strip), [{ side: 'ask', price: 110, qty: 10, tradedQty: 6, at: 3000, ageMs: 0 }]);
    assert.deepEqual(s.pulled, []); assert.deepEqual(s.tradedThrough, []);
    assert.equal(s.nearestWall.ask.price, 110);
  });
  test('qty is the largest size the wall displayed: a wall that grows 10 → 20 needs 10 printed, not 5', () => {
    const ob = new OrderBook({ cfg: CFG, tick: 1 });
    ob.applySnapshot(mkBook(0, { bids: { 90: 10 } }));
    ob.applySnapshot(mkBook(1000, { bids: { 90: 20 } }));
    ob.noteTrade({ t: 1500, p: 90, q: 6, side: 'sell' });
    assert.deepEqual(ob.applySnapshot(mkBook(2000, { bids: { 90: 20 } })).absorbed, []);
    ob.noteTrade({ t: 2500, p: 90, q: 4, side: 'sell' });
    const s = ob.applySnapshot(mkBook(3000, { bids: { 90: 20 } }));
    assert.deepEqual(s.absorbed.map(strip), [{ side: 'bid', price: 90, qty: 20, tradedQty: 10, at: 3000, ageMs: 0 }]);
  });
  test('prices match in integer ticks: a print at "85230.01000000" lands on the 85230.01 wall, 85230.02 does not', () => {
    const ob = new OrderBook({ cfg: CFG, tick: 0.01 });
    const book = (t) => ({ t, bids: Array.from({ length: 20 }, (_, i) => [Number((85230.05 - i * 0.01).toFixed(2)), i === 4 ? 10 : 1]), asks: Array.from({ length: 20 }, (_, i) => [Number((85230.06 + i * 0.01).toFixed(2)), 1]) });
    ob.applySnapshot(book(0));
    assert.deepEqual(ob.summary().walls.map((w) => [w.side, w.price, w.qty]), [['bid', 85230.01, 10]]);
    assert.equal(ob.summary().spread, 0.01, 'spread snapped to the tick grid, not 0.00999999999476');
    assert.equal(85230.06 - 85230.05 === 0.01, false, 'the float trap this guards against');
    assert.equal(summarizeSnapshot(book(0)).spread === 0.01, false, 'the pure helper has no tick and reports the raw float');
    assert.equal(ob.noteTrade({ t: 100, p: +'85230.01000000', q: 3, side: 'sell' }), true);
    assert.equal(ob.noteTrade({ t: 200, p: 85230.02, q: 3, side: 'sell' }), false);
    assert.equal(ob.summary().walls[0].tradedQty, 3);
  });
});

describe('OrderBook — history ring, clock, shapes', () => {
  test('one summary per second, oldest→newest, bounded by historySeconds (count) and by age', () => {
    const ob = new OrderBook({ cfg: { orderbook: { historySeconds: 5 } } });
    for (let i = 0; i < 8; i++) ob.applySnapshot(mkBook(i * 1000));
    assert.deepEqual(ob.history().map((h) => h.t), [3000, 4000, 5000, 6000, 7000]);
    assert.deepEqual(ob.history(2).map((h) => h.t), [6000, 7000]);
    ob.applySnapshot(mkBook(8000)); ob.applySnapshot(mkBook(8400, { bids: { 95: 9 } }));
    const h = ob.history();
    assert.deepEqual(h.map((x) => x.t), [4000, 5000, 6000, 7000, 8400], 'a second frame in the same second replaces the first');
    assert.equal(h[4].walls.length, 1);
    ob.applySnapshot(mkBook(100_000));
    assert.deepEqual(ob.history().map((x) => x.t), [100_000], 'entries older than historySeconds are dropped even when the count allows');
    assert.deepEqual(ob.history(0), []);
  });
  test('a snapshot without t is stamped by the injected clock; without a clock it throws; time never runs backwards', () => {
    const ob = new OrderBook({ now: () => 777 });
    assert.equal(ob.summary(), null);
    assert.equal(ob.applySnapshot({ bids: [[100, 1]], asks: [[101, 1]] }).t, 777);
    assert.throws(() => new OrderBook().applySnapshot({ bids: [], asks: [] }), /no clock/);
    const ob2 = new OrderBook({ cfg: CFG });
    ob2.applySnapshot(mkBook(5000)); ob2.applySnapshot(mkBook(4000));
    assert.equal(ob2.summary().t, 5000);
    assert.throws(() => new OrderBook({ tick: 0 }), RangeError);
    assert.throws(() => new OrderBook({ now: 5 }), TypeError);
  });
  test('summary() and history() hand out JSON-safe copies; mutating one never leaks back', () => {
    const ob = new OrderBook({ cfg: CFG, tick: 1 });
    ob.applySnapshot(mkBook(0, { bids: { 90: 10 }, asks: { 110: 10 } }));
    const s = ob.summary();
    assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
    s.walls.length = 0; s.bidDepth = -1;
    assert.equal(ob.summary().walls.length, 2); assert.equal(ob.summary().bidDepth, 29, '19 one-lots + the 10-lot wall');
    assert.equal(ob.snapshot().bids.length, 20); assert.equal(ob.snapshots, 1);
    ob.clear();
    assert.equal(ob.summary(), null); assert.deepEqual(ob.history(), []);
  });
});

describe('czt-side readers (§P5)', () => {
  test('bookImbalanceFavours: ≥ imbalanceMin in the side\'s favour (inclusive), either side vocabulary', () => {
    assert.equal(bookImbalanceFavours({ imbalance: 0.3 }, 'long'), true);
    assert.equal(bookImbalanceFavours({ imbalance: 0.3 }, 'short'), false);
    assert.equal(bookImbalanceFavours({ imbalance: 0.25 }, 'bullish'), true);
    assert.equal(bookImbalanceFavours({ imbalance: 0.2 }, 'long'), false);
    assert.equal(bookImbalanceFavours({ imbalance: -0.4 }, 'bearish'), true);
    assert.equal(bookImbalanceFavours({ imbalance: -0.1 }, 'short', 0.1), true);
    assert.equal(bookImbalanceFavours(null, 'long'), false);
  });
  test('recentAbsorption: a BID wall absorbing favours a long, within tolerance of price and inside the window; newest wins', () => {
    const summary = { absorbed: [
      { side: 'bid', price: 90, ageMs: 5000, tradedQty: 6 }, { side: 'bid', price: 92, ageMs: 1000, tradedQty: 8 }, { side: 'ask', price: 110, ageMs: 500, tradedQty: 9 },
    ] };
    assert.equal(recentAbsorption(summary, { side: 'long' }).price, 92);
    assert.equal(recentAbsorption(summary, { side: 'long', price: 90, tolerance: 1 }).price, 90);
    assert.equal(recentAbsorption(summary, { side: 'long', price: 95, tolerance: 1 }), null);
    assert.equal(recentAbsorption(summary, { side: 'long', windowMs: 500 }), null);
    assert.equal(recentAbsorption(summary, { side: 'short' }).price, 110);
    assert.equal(recentAbsorption({ absorbed: [] }, { side: 'long' }), null);
    assert.equal(recentAbsorption(null, { side: 'long' }), null);
  });
});

describe('binance-depth — parsing', () => {
  test('stream name, stream detection, REST url', () => {
    assert.equal(depthStreamName('BTCUSDT'), 'btcusdt@depth20');
    assert.equal(depthStreamName('paxgusdt', { levels: 10 }), 'paxgusdt@depth10');
    assert.equal(depthStreamName('btcusdt', { levels: 7 }), 'btcusdt@depth20', 'invalid level count → 20');
    assert.equal(depthStreamName('btcusdt', { speed: '100ms' }), 'btcusdt@depth20@100ms');
    assert.throws(() => depthStreamName(''), TypeError);
    assert.equal(isDepthStream('btcusdt@depth20'), true); assert.equal(isDepthStream('BTCUSDT@depth5@100ms'), true);
    assert.equal(isDepthStream('btcusdt@depth'), false); assert.equal(isDepthStream('btcusdt@aggTrade'), false);
    assert.equal(depthRestUrl('btcusdt'), `${REST_BASE}/depth?symbol=BTCUSDT&limit=20`);
    assert.equal(depthRestUrl('PAXGUSDT', 5), `${REST_BASE}/depth?symbol=PAXGUSDT&limit=5`);
  });
  test('combined-stream frame → BookSnapshot: numbers, bids desc, asks asc, lastUpdateId, caller t', () => {
    const s = parseDepthMessage(DEPTH, { t: 1791142265500 });
    assert.deepEqual(s, {
      t: 1791142265500, lastUpdateId: 1027024, stream: 'btcusdt@depth20',
      bids: [{ price: 85462.5, qty: 0.29537 }, { price: 85462.49, qty: 1 }, { price: 85462.4, qty: 0.5 }],
      asks: [{ price: 85462.51, qty: 0.5 }, { price: 85462.52, qty: 0.1 }, { price: 85462.6, qty: 2 }],
    });
    assert.equal(parseDepthMessage(JSON.parse(DEPTH)).t, null, 'no clock given → null (OrderBook stamps it)');
    const bare = parseDepthMessage({ lastUpdateId: 1, bids: [['1', '2']], asks: [['3', '4']] }, { t: 9 });
    assert.deepEqual(bare, { t: 9, lastUpdateId: 1, bids: [{ price: 1, qty: 2 }], asks: [{ price: 3, qty: 4 }] });
  });
  test('non-depth frames → null: kline on a shared socket, subscribe ack, bad JSON, wrong stream name with a book shape', () => {
    assert.equal(parseDepthMessage(KLINE), null);
    assert.equal(parseDepthMessage('{"result":null,"id":1}'), null);
    assert.equal(parseDepthMessage('not json'), null);
    assert.equal(parseDepthMessage(null), null);
    assert.equal(parseDepthMessage({ stream: 'btcusdt@aggTrade', data: { bids: [], asks: [] } }), null);
    assert.deepEqual(parseDepthLevels([['1', 'x'], ['2', '3'], 'junk', null]), [{ price: 2, qty: 3 }]);
    assert.deepEqual(parseDepthLevels('nope'), []);
  });
  test('fetchDepthSnapshot: parses the REST body and stamps now(); 429 carries retryAfterMs; 5xx throws', async () => {
    const fetch = fakeFetch({ 'limit=20': { json: { lastUpdateId: 55, bids: [['100', '1']], asks: [['101', '2']] } }, 'limit=5': { status: 429, headers: { 'retry-after': '7' } }, 'limit=10': { status: 503 } });
    const s = await fetchDepthSnapshot({ symbol: 'btcusdt', fetch, now: () => 4242 });
    assert.deepEqual(s, { t: 4242, lastUpdateId: 55, bids: [{ price: 100, qty: 1 }], asks: [{ price: 101, qty: 2 }] });
    assert.equal(fetch.calls[0].url, `${REST_BASE}/depth?symbol=BTCUSDT&limit=20`);
    await assert.rejects(fetchDepthSnapshot({ symbol: 'btcusdt', limit: 5, fetch }), (e) => e.status === 429 && e.retryAfterMs === 7000);
    await assert.rejects(fetchDepthSnapshot({ symbol: 'btcusdt', limit: 10, fetch }), /HTTP 503/);
    await assert.rejects(fetchDepthSnapshot({ fetch }), TypeError);
  });
});

describe('binance-depth — BinanceDepthFeed adapter (fake socket, clock, fetch)', () => {
  function harness(opts = {}) {
    const clock = fakeClock(Date.UTC(2026, 0, 13, 8, 0, 0));
    const WS = fakeWebSocket();
    const fetch = fakeFetch({ [`${REST_BASE}/depth`]: { json: { lastUpdateId: 100, bids: [['100', '1'], ['99', '2']], asks: [['101', '1']] } } });
    const feed = new BinanceDepthFeed({ id: 'BTCUSD', feedParams: { stream: 'btcusdt' } }, opts, { fetch, WebSocket: WS, now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, random: () => 0.5 });
    const ev = { book: [], status: [] };
    for (const k of Object.keys(ev)) feed.on(k, (m) => ev[k].push(m));
    return { clock, WS, fetch, feed, ev };
  }
  test('REST first snapshot → book event stamped with the clock; one @depth20 socket; frames → book; stale lastUpdateId dropped', async () => {
    const h = harness();
    assert.equal(h.feed.kind, 'live'); assert.equal(h.feed.streamName, 'btcusdt@depth20');
    await h.feed.connect();
    assert.equal(h.fetch.calls.length, 1);
    assert.equal(h.ev.book.length, 1);
    assert.equal(h.ev.book[0].symbol, 'BTCUSD'); assert.equal(h.ev.book[0].snapshot.t, h.clock.now()); assert.equal(h.ev.book[0].snapshot.lastUpdateId, 100);
    assert.deepEqual(h.ev.book[0].snapshot.bids.map((l) => l.price), [100, 99]);
    assert.equal(h.WS.instances.length, 1);
    assert.equal(h.WS.last().url, `${WS_BASE}?streams=btcusdt@depth20`);
    assert.equal(h.feed.state, 'connecting');
    h.WS.last().open();
    assert.equal(h.feed.state, 'live');
    h.clock.tick(1000);
    h.WS.last().message(DEPTH);                                     // lastUpdateId 1027024 > 100
    assert.equal(h.ev.book.length, 2); assert.equal(h.ev.book[1].snapshot.t, h.clock.now()); assert.equal(h.ev.book[1].snapshot.stream, 'btcusdt@depth20');
    h.WS.last().message({ stream: 'btcusdt@depth20', data: { lastUpdateId: 5, bids: [['1', '1']], asks: [['2', '1']] } });
    assert.equal(h.ev.book.length, 2, 'older sequence number → dropped');
    h.WS.last().message(KLINE);
    assert.equal(h.ev.book.length, 2, 'a kline frame is not a book');
    // a frame straight into an OrderBook — the two modules agree on the shape
    const ob = new OrderBook({ tick: 0.01 });
    const s = ob.applySnapshot(h.ev.book[1].snapshot);
    assert.equal(s.bestBid, 85462.5); assert.equal(s.bestAsk, 85462.51); assert.equal(s.spread, 0.01);
    await h.feed.close();
    assert.equal(h.feed.state, 'closed'); assert.equal(h.clock.pending(), 0, 'no timers left behind');
  });
  test('drop → reconnecting with backoff and a new socket; 90 s silence → watchdog; 10 failures → error but keeps trying; restFirst:false skips REST', async () => {
    const h = harness({ restFirst: false });
    await h.feed.connect();
    assert.equal(h.fetch.calls.length, 0);
    const ws1 = h.WS.last(); ws1.open();
    assert.equal(h.feed.state, 'live');
    ws1.close(1006, 'gone');
    assert.equal(h.feed.state, 'reconnecting'); assert.equal(h.WS.instances.length, 1);
    h.clock.tick(1000);
    assert.equal(h.WS.instances.length, 2, 'new socket after the 1 s backoff');
    const ws2 = h.WS.last(); ws2.open(); ws2.message(DEPTH);
    assert.equal(h.feed.state, 'live'); assert.equal(h.ev.book.length, 1);
    h.clock.tick(90_000);
    assert.equal(h.feed.state, 'reconnecting'); assert.equal(ws2.readyState, 3, 'watchdog terminated the silent socket');
    for (let i = 0; i < 10; i++) { h.clock.tick(60_000); h.WS.last().error(new Error('refused')); }
    assert.equal(h.feed.state, 'error'); assert.match(h.ev.status[h.ev.status.length - 1].detail, /consecutive failures/);
    h.clock.tick(60_000);
    assert.ok(h.WS.instances.length >= 12, 'keeps trying after error');
    await h.feed.close();
    assert.equal(h.clock.pending(), 0);
  });
  test('a failed REST snapshot still streams (warn logged, no token/secret anywhere)', async () => {
    const clock = fakeClock(0);
    const WS = fakeWebSocket();
    const warns = [];
    const fetch = fakeFetch({ [`${REST_BASE}/depth`]: { status: 429, headers: { 'retry-after': '5' } } });
    const feed = new BinanceDepthFeed({ id: 'XAUUSD', feedParams: { stream: 'paxgusdt' } }, { log: { warn: (s, m) => warns.push(`${s}: ${m}`) } }, { fetch, WebSocket: WS, now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, random: () => 0.5 });
    await feed.connect();
    assert.equal(WS.instances.length, 1); assert.equal(WS.last().url, `${WS_BASE}?streams=paxgusdt@depth20`);
    assert.equal(warns.length, 1); assert.match(warns[0], /XAUUSD: Depth snapshot failed: Binance depth rate limit \(HTTP 429\)/);
    assert.equal(feed.restRetryAt, 5000, 'Retry-After honoured for the next REST call');
    await feed.close();
  });
});
