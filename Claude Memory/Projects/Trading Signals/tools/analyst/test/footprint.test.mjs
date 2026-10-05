// test/footprint.test.mjs — SPEC-PRO §P1 / §P8: bucketing in integer ticks, diagonal imbalance incl. the
// zero-cell rule, stacked runs, unfinished auctions, trapped traders both sides, the bounded O(1) builder
// (late trades, bucket switch, partial stamping) and the aggTrades backfill (fromId pagination, 1 req/s,
// 429 holdoff, maxRequests → partial) on a fake clock. Every expected number is computed by hand.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  FOOTPRINT_DEFAULTS, footprintConfig, decimalsOf, toTicks, fromTicks, bucketTicks, levelPrice, bucketFor,
  buildFootprint, serializeFootprint, trappedTraders, summarizeForCzt, FootprintBuilder,
} from '../lib/engine/footprint.mjs';
import { fetchAggTrades, parseAggTradeRow, aggTradesUrl, REST_BASE } from '../lib/feeds/binance-trades.mjs';
import { fakeClock, fakeFetch } from './helpers.mjs';

const T0 = Date.UTC(2026, 0, 5, 8, 0);         // 5m-aligned
const M5 = 300e3;
const tr = (t, p, q, side) => ({ t, p, q, side });
/** `cells` = [[price, bid, ask], …] → trades, one per non-zero side, in ascending price order; `tOffset` spreads them in time. */
function tape(cells, t = T0, { closeAt = null } = {}) {
  const out = [];
  let k = 0;
  for (const [p, bid, ask] of cells) {
    if (bid > 0) out.push(tr(t + k++ * 100, p, bid, 'sell'));
    if (ask > 0) out.push(tr(t + k++ * 100, p, ask, 'buy'));
  }
  if (closeAt !== null) out.push(tr(t + k * 100, closeAt, 0.001, 'buy'));
  return out;
}
const lvl = (fp, price) => fp.levels.find((l) => l.price === price);
const imb = (fp, price, side) => fp.imbalances.find((i) => i.price === price && i.side === side);

describe('integer-tick arithmetic (§P1: no float drift)', () => {
  test('decimalsOf / toTicks / fromTicks round-trip exactly, including 1e-7 ticks', () => {
    assert.equal(decimalsOf(0.01), 2); assert.equal(decimalsOf(1), 0); assert.equal(decimalsOf(0.25), 2);
    assert.equal(decimalsOf(1e-7), 7); assert.equal(decimalsOf(2.5e-6), 7);
    assert.equal(toTicks(85230.01, 0.01), 8523001);
    assert.equal(fromTicks(8523001, 0.01), 85230.01);
    assert.equal(fromTicks(3, 0.25), 0.75);
    assert.equal(fromTicks(123456789, 1e-7), 12.3456789);
    assert.equal(bucketTicks(0.05, 0.01), 5); assert.equal(bucketTicks(0.001, 0.01), 1, 'bucket below tick clamps to one tick');
  });
  test('levelPrice snaps by ticks: 1.15 / 0.01 floors to 114 in floats, 115 in ticks', () => {
    assert.equal(Math.floor(1.15 / 0.01), 114, 'the float trap this guards against');
    assert.equal(levelPrice(1.15, 0.01, 0.01), 1.15);
    assert.equal(levelPrice(85230.17, 0.05, 0.01), 85230.15);
    assert.equal(levelPrice(85230.15, 0.05, 0.01), 85230.15);
    assert.equal(levelPrice(4146.004, 0.5, 0.01), 4146);
    assert.equal(levelPrice(4146.49, 0.5, 0.01), 4146);
    assert.equal(levelPrice(4146.5, 0.5, 0.01), 4146.5);
    assert.throws(() => levelPrice(1, 1, 0), /tick/);
  });
  test('bucketFor = max(tick, round(atr × bucketAtr / tick) × tick), snapped to tick', () => {
    assert.equal(bucketFor(100, 0.01), 5, 'ATR 100 × 0.05 = 5.00');
    assert.equal(bucketFor(100, 0.01, { footprint: { bucketAtr: 0.1 } }), 10);
    assert.equal(bucketFor(0.3, 0.01), 0.02, '0.015 / 0.01 = 1.5 → rounds to 2 ticks');
    assert.equal(bucketFor(0.05, 0.01), 0.01, 'never below one tick');
    assert.equal(bucketFor(0, 0.01), 0.01); assert.equal(bucketFor(NaN, 0.5), 0.5);
    assert.equal(bucketFor(1234.5678, 0.01), 61.73);
    assert.deepEqual(footprintConfig(undefined), FOOTPRINT_DEFAULTS);
    assert.equal(footprintConfig({ footprint: { imbalanceRatio: 4, stackedMin: -1 } }).imbalanceRatio, 4);
    assert.equal(footprintConfig({ footprint: { stackedMin: -1 } }).stackedMin, 3, 'invalid values fall back to the default');
  });
});

describe('buildFootprint — levels, sides, totals, POC', () => {
  test("'sell' aggressor → bid cell, 'buy' → ask cell; levels ascending, contiguous, empty ones present with zeros", () => {
    const trades = [tr(T0, 100.3, 2, 'sell'), tr(T0 + 1, 100.4, 1, 'buy'), tr(T0 + 2, 100.9, 4, 'buy'), tr(T0 + 3, 100.8, 1, 'sell')];
    const fp = buildFootprint(trades, { t: T0, tf: '5m', bucket: 0.2, tick: 0.1 });
    assert.deepEqual(fp.levels.map((l) => l.price), [100.2, 100.4, 100.6, 100.8]);
    assert.deepEqual(fp.levels.map((l) => [l.bid, l.ask, l.delta, l.total]), [[2, 0, -2, 2], [0, 1, 1, 1], [0, 0, 0, 0], [1, 4, 3, 5]]);
    assert.equal(fp.totalBid, 3); assert.equal(fp.totalAsk, 5); assert.equal(fp.delta, 2); assert.equal(fp.total, 8);
    assert.equal(fp.poc, 100.8); assert.equal(fp.nTrades, 4);
    assert.equal(fp.open, 100.3); assert.equal(fp.close, 100.8); assert.equal(fp.high, 100.9); assert.equal(fp.low, 100.3);
    assert.equal(fp.t, T0); assert.equal(fp.tf, '5m'); assert.equal(fp.bucket, 0.2); assert.equal(fp.tick, 0.1);
    assert.equal(fp.partial, false);
  });
  test('candle high/low stretch the ladder; an empty tape is an empty footprint, never a throw', () => {
    const fp = buildFootprint([tr(T0, 100, 1, 'buy')], { t: T0, tf: '1m', bucket: 1, tick: 1, high: 102, low: 98 });
    assert.deepEqual(fp.levels.map((l) => l.price), [98, 99, 100, 101, 102]);
    assert.equal(fp.high, 102); assert.equal(fp.low, 98);
    const empty = buildFootprint([], { t: T0, tf: '1m', bucket: 1, tick: 1 });
    assert.deepEqual(empty.levels, []); assert.equal(empty.poc, null); assert.equal(empty.nTrades, 0);
    assert.equal(empty.unfinishedHigh, false); assert.equal(empty.unfinishedLow, false);
    assert.deepEqual(empty.imbalances, []); assert.deepEqual(empty.stacked, []);
  });
  test('POC ties resolve to the level nearest mid-range; bad trades are skipped', () => {
    const fp = buildFootprint(tape([[100, 5, 0], [101, 0, 0], [102, 0, 0], [103, 0, 0], [104, 0, 0], [105, 0, 0], [106, 0, 5]].concat([[107, 0, 0]])), { t: T0, tf: '1m', bucket: 1, tick: 1 });
    // levels 100..106, mid 103: both 100 and 106 are 3 away → lower wins on exact tie
    assert.equal(fp.poc, 100);
    const fp2 = buildFootprint([tr(T0, 100, 1, 'buy'), tr(T0, NaN, 1, 'buy'), tr(T0, 101, -1, 'sell'), { t: T0 }], { t: T0, tf: '1m', bucket: 1, tick: 1 });
    assert.equal(fp2.nTrades, 1);
  });
});

describe('diagonal imbalance (source 05 §3) — ratio, zero cell, boundary', () => {
  // bucket 1, tick 1. Cells: [price, bid, ask]
  const cells = [
    [100, 10, 7],   // lowest: ask 7 but no level below → NOT comparable (no buy imbalance); bid 10 vs ask(101)=5 → 2.0 no
    [101, 10, 30],  // buy: ask 30 ≥ 3 × bid(100)=10 → exactly 3.0 ✓ ; sell: bid 10 vs ask(102)=29 no
    [102, 10, 29],  // buy: 29 vs 3×10 = 30 → ✗ (2.9)
    [103, 0, 5],    // buy: ask 5 vs bid(102)=10 → ✗ ; sell: bid 0 → ✗
    [104, 0, 5],    // buy: ask 5 vs bid(103)=0 → ZERO CELL → ratio ∞ ✓
    [105, 9, 0],    // sell: bid 9 vs ask(106)=3 → 3.0 ✓ ; buy: ask 0 ✗
    [106, 12, 3],   // sell: bid 12 vs ask(107)=0 → ∞ ✓
    [107, 4, 0],    // highest: bid 4 but no level above → NOT comparable
  ];
  const fp = buildFootprint(tape(cells), { t: T0, tf: '5m', bucket: 1, tick: 1 });
  test('buy imbalance at P needs ask(P) ≥ ratio × bid(P − bucket) and ask(P) > 0; sell mirrored upward', () => {
    assert.ok(imb(fp, 101, 'buy')); assert.equal(imb(fp, 101, 'buy').ratio, 3);
    assert.equal(imb(fp, 102, 'buy'), undefined, '2.9 is under 300 %');
    assert.equal(imb(fp, 103, 'buy'), undefined);
    assert.ok(imb(fp, 105, 'sell')); assert.equal(imb(fp, 105, 'sell').ratio, 3);
    assert.equal(imb(fp, 100, 'sell'), undefined);
    assert.equal(imb(fp, 101, 'sell'), undefined);
  });
  test('a zero opposite cell with a non-zero cell counts: ratio Infinity + infinite:true; serialised as null', () => {
    assert.deepEqual(imb(fp, 104, 'buy'), { price: 104, side: 'buy', ratio: Infinity, infinite: true });
    assert.deepEqual(imb(fp, 106, 'sell'), { price: 106, side: 'sell', ratio: Infinity, infinite: true });
    assert.equal(imb(fp, 103, 'sell'), undefined, 'a zero cell on the OWN side never counts');
    const ser = serializeFootprint(fp);
    assert.equal(ser.imbalances.find((i) => i.price === 104).ratio, null);
    assert.equal(ser.imbalances.find((i) => i.price === 104).infinite, true);
    assert.equal(ser.imbalances.find((i) => i.price === 101).ratio, 3);
    assert.equal(JSON.parse(JSON.stringify(ser)).imbalances.find((i) => i.price === 106).ratio, null);
    assert.equal(fp.imbalances.find((i) => i.price === 101).infinite, undefined, 'finite ratios carry no flag');
  });
  test('the ladder boundary is not a diagonal: no buy imbalance at the lowest level, no sell at the highest', () => {
    assert.equal(imb(fp, 100, 'buy'), undefined);
    assert.equal(imb(fp, 107, 'sell'), undefined);
    assert.equal(fp.imbalances.length, 4);
  });
  test('ratio comes from cfg.footprint.imbalanceRatio or an explicit override', () => {
    const loose = buildFootprint(tape(cells), { t: T0, tf: '5m', bucket: 1, tick: 1, cfg: { footprint: { imbalanceRatio: 2.5 } } });
    assert.ok(imb(loose, 102, 'buy'), '2.9 ≥ 2.5');
    const strict = buildFootprint(tape(cells), { t: T0, tf: '5m', bucket: 1, tick: 1, imbalanceRatio: 4 });
    assert.equal(imb(strict, 101, 'buy'), undefined); assert.ok(imb(strict, 104, 'buy'), '∞ passes any ratio');
  });
});

describe('stacked imbalances', () => {
  // bid 1 at 102..105 feeds buy imbalances at 103..106 (ask 10 each ≥ 3×1); break the run at 107 (ask 2 vs bid(106)=1 → 2.0 ✗) then two more at 108,109 (not enough).
  const cells = [[101, 0, 5], [102, 1, 0], [103, 1, 10], [104, 1, 10], [105, 1, 10], [106, 1, 10], [107, 1, 2], [108, 1, 10], [109, 0, 10], [110, 0, 0], [111, 1, 0]];
  const fp = buildFootprint(tape(cells), { t: T0, tf: '5m', bucket: 1, tick: 1 });
  test('≥ stackedMin consecutive same-side imbalances form one run { side, from, to, count }', () => {
    assert.deepEqual(fp.imbalances.filter((i) => i.side === 'buy').map((i) => i.price), [103, 104, 105, 106, 108, 109]);
    assert.deepEqual(fp.stacked, [{ side: 'buy', from: 103, to: 106, count: 4 }]);
  });
  test('stackedMin from cfg (2 lets the 108–109 pair through) and sell runs are reported separately', () => {
    const two = buildFootprint(tape(cells), { t: T0, tf: '5m', bucket: 1, tick: 1, stackedMin: 2 });
    assert.deepEqual(two.stacked.map((s) => [s.from, s.to, s.count]), [[103, 106, 4], [108, 109, 2]]);
    const sells = buildFootprint(tape([[100, 10, 0], [101, 10, 1], [102, 10, 1], [103, 10, 1], [104, 0, 1]]), { t: T0, tf: '5m', bucket: 1, tick: 1 });
    // sell at P: bid(P) ≥ 3 × ask(P+1): 100 (10 vs 1) ✓, 101 ✓, 102 ✓, 103 (10 vs 1) ✓ ; 104 top → not comparable
    assert.deepEqual(sells.stacked, [{ side: 'sell', from: 100, to: 103, count: 4 }]);
    assert.ok(summarizeForCzt(sells, { side: 'short' }).stackedToward);
    assert.ok(!summarizeForCzt(sells, { side: 'long' }).stackedToward);
    assert.ok(summarizeForCzt(sells, { side: 'long' }).stackedAgainst);
  });
  test('a gap in the ladder breaks a run even when imbalances sit on both sides of it', () => {
    // buy imbalances at 103,104 then 106,107 (105 has ask 0) — with stackedMin 2 that is two runs, with 3 none
    const c = [[102, 1, 0], [103, 1, 10], [104, 1, 10], [105, 1, 0], [106, 1, 10], [107, 0, 10]];
    assert.deepEqual(buildFootprint(tape(c), { t: T0, tf: '5m', bucket: 1, tick: 1, stackedMin: 2 }).stacked.map((s) => [s.from, s.to]), [[103, 104], [106, 107]]);
    assert.deepEqual(buildFootprint(tape(c), { t: T0, tf: '5m', bucket: 1, tick: 1 }).stacked, []);
  });
});

describe('unfinished auction (source 05 §3)', () => {
  test('both sides printed at the extreme level ⇒ unfinished; a 0 on one side ⇒ finished', () => {
    const fp = buildFootprint(tape([[100, 4, 0], [101, 3, 3], [102, 2, 6]]), { t: T0, tf: '5m', bucket: 1, tick: 1 });
    assert.equal(fp.unfinishedHigh, true, 'bid 2 × ask 6 at the high');
    assert.equal(fp.unfinishedLow, false, 'bid 4 × ask 0 at the low — clean print');
    const fp2 = buildFootprint(tape([[100, 4, 1], [101, 3, 3], [102, 0, 6]]), { t: T0, tf: '5m', bucket: 1, tick: 1 });
    assert.equal(fp2.unfinishedHigh, false); assert.equal(fp2.unfinishedLow, true);
    // a ladder stretched to the candle's wick with no trade at the extreme level is finished (nothing printed)
    const fp3 = buildFootprint(tape([[100, 4, 1], [101, 3, 3]]), { t: T0, tf: '5m', bucket: 1, tick: 1, high: 103 });
    assert.equal(fp3.unfinishedHigh, false); assert.equal(fp3.unfinishedLow, true);
    assert.equal(summarizeForCzt(fp, { side: 'long' }).unfinishedToward, true, 'long targets above: the high is the magnet');
    assert.equal(summarizeForCzt(fp, { side: 'short' }).unfinishedToward, false);
    assert.equal(summarizeForCzt(fp2, { side: 'short' }).unfinishedToward, true);
  });
  test('summarizeForCzt: pocNearZone with a band, a price or a Level, with tolerance; null footprint is all-false', () => {
    const fp = buildFootprint(tape([[100, 1, 1], [101, 9, 9], [102, 1, 1]]), { t: T0, tf: '5m', bucket: 1, tick: 1 });
    assert.equal(fp.poc, 101);
    assert.equal(summarizeForCzt(fp, { side: 'long', zone: { top: 101.5, bottom: 100.5 } }).pocNearZone, true);
    assert.equal(summarizeForCzt(fp, { side: 'long', zone: { top: 99.5, bottom: 99 } }).pocNearZone, false);
    assert.equal(summarizeForCzt(fp, { side: 'long', zone: { top: 99.5, bottom: 99 }, tolerance: 1.5 }).pocNearZone, true);
    assert.equal(summarizeForCzt(fp, { side: 'long', zone: { price: 101 } }).pocNearZone, true);
    assert.equal(summarizeForCzt(fp, { side: 'long', zone: { id: 'x', kind: 'asiaLow', price: 103 } }).pocNearZone, false);
    assert.equal(summarizeForCzt(fp, { side: 'long' }).pocNearZone, false);
    assert.deepEqual(summarizeForCzt(null, { side: 'long' }), { stackedToward: false, stackedAgainst: false, unfinishedToward: false, pocNearZone: false });
  });
});

describe('trapped traders (source 05 §4)', () => {
  // prev: levels 100..109 (span 9 → upper third from 106). Stacked BUY at 107,108,109 (bid 1 at 106..108, ask 10 at 107..109).
  const prevBuy = buildFootprint(tape([[100, 5, 2], [101, 3, 3], [102, 3, 3], [103, 3, 3], [104, 3, 3], [105, 3, 3], [106, 1, 3], [107, 1, 10], [108, 1, 10], [109, 0, 10]]), { t: T0, tf: '5m', bucket: 1, tick: 1 });
  test('bearish: stacked buy imbalances in the upper third, then the last candle closes BELOW their lowest level', () => {
    assert.deepEqual(prevBuy.stacked, [{ side: 'buy', from: 107, to: 109, count: 3 }]);
    const last = buildFootprint(tape([[104, 4, 4], [105, 4, 4], [106, 4, 4], [107, 2, 2]], T0 + M5, { closeAt: 105 }), { t: T0 + M5, tf: '5m', bucket: 1, tick: 1 });
    assert.equal(last.close, 105);
    const r = trappedTraders([prevBuy, last]);
    assert.equal(r.side, 'bearish'); assert.equal(r.t, last.t); assert.equal(r.at, prevBuy.t);
    assert.deepEqual(r.levels, [107, 108, 109]); assert.equal(r.edge, 107); assert.equal(r.close, 105);
    assert.match(r.reason, /Trapped buyers: stacked buy imbalances at 107–109 then a close below \(105\) — their stops are market sells/);
    // close AT or ABOVE the lowest imbalance level ⇒ nobody is offside yet
    const held = buildFootprint(tape([[106, 4, 4], [107, 2, 2]], T0 + M5, { closeAt: 107 }), { t: T0 + M5, tf: '5m', bucket: 1, tick: 1 });
    assert.equal(trappedTraders([prevBuy, held]), null);
  });
  test('the stacked run must sit in the upper third — a run low in the candle is not a trap', () => {
    // same ladder shape but the buy run at 101..103 (lower third/middle)
    const low = buildFootprint(tape([[100, 1, 0], [101, 1, 10], [102, 1, 10], [103, 3, 10], [104, 3, 3], [105, 3, 3], [106, 3, 3], [107, 3, 3], [108, 3, 3], [109, 3, 3]]), { t: T0, tf: '5m', bucket: 1, tick: 1 });
    assert.deepEqual(low.stacked.map((s) => [s.side, s.from, s.to]), [['buy', 101, 103]]);
    const last = buildFootprint(tape([[99, 4, 4], [100, 4, 4]], T0 + M5, { closeAt: 99 }), { t: T0 + M5, tf: '5m', bucket: 1, tick: 1 });
    assert.equal(trappedTraders([low, last]), null);
  });
  test('bullish mirror: stacked sell imbalances in the lower third, then a close ABOVE their highest level', () => {
    // sell at P: bid(P) ≥ 3 × ask(P+1). Levels 100..109; sell run at 100,101,102 (bid 10, ask 1 at 101..103).
    const prevSell = buildFootprint(tape([[100, 10, 0], [101, 10, 1], [102, 10, 1], [103, 3, 1], [104, 3, 3], [105, 3, 3], [106, 3, 3], [107, 3, 3], [108, 3, 3], [109, 2, 5]]), { t: T0, tf: '5m', bucket: 1, tick: 1 });
    assert.deepEqual(prevSell.stacked, [{ side: 'sell', from: 100, to: 102, count: 3 }]);
    const last = buildFootprint(tape([[102, 4, 4], [103, 4, 4], [104, 4, 4]], T0 + M5, { closeAt: 104 }), { t: T0 + M5, tf: '5m', bucket: 1, tick: 1 });
    const r = trappedTraders([prevSell, last]);
    assert.equal(r.side, 'bullish'); assert.deepEqual(r.levels, [100, 101, 102]); assert.equal(r.edge, 102);
    assert.match(r.reason, /Trapped sellers: stacked sell imbalances at 100–102 then a close above \(104\) — their stops are market buys/);
    const notYet = buildFootprint(tape([[101, 4, 4], [102, 4, 4]], T0 + M5, { closeAt: 102 }), { t: T0 + M5, tf: '5m', bucket: 1, tick: 1 });
    assert.equal(trappedTraders([prevSell, notYet]), null);
  });
  test('lookback: the trap candle may be 2 back by default; 1 restricts to the previous candle; < 2 footprints → null', () => {
    const quiet = buildFootprint(tape([[106, 4, 4], [107, 4, 4]], T0 + M5, { closeAt: 107 }), { t: T0 + M5, tf: '5m', bucket: 1, tick: 1 });
    const last = buildFootprint(tape([[104, 4, 4], [105, 4, 4]], T0 + 2 * M5, { closeAt: 105 }), { t: T0 + 2 * M5, tf: '5m', bucket: 1, tick: 1 });
    assert.equal(trappedTraders([prevBuy, quiet, last]).side, 'bearish');
    assert.equal(trappedTraders([prevBuy, quiet, last], { lookback: 1 }), null);
    assert.equal(trappedTraders([prevBuy]), null); assert.equal(trappedTraders([]), null); assert.equal(trappedTraders(null), null);
    assert.equal(trappedTraders([prevBuy, { ...last, close: null }]), null, 'no close, no verdict');
  });
});

describe('FootprintBuilder — incremental, bounded, late trades, bucket switch', () => {
  test('buckets trades by floor(t / TF_MS[tf]); current() is the forming candle; closeCandle() finalises and recent() lists closed oldest→newest', () => {
    const b = new FootprintBuilder({ tf: '5m', tick: 0.01, bucket: 0.05 });
    assert.equal(b.bucket, 0.05); assert.equal(b.maxCandles, 48, 'default from FOOTPRINT_DEFAULTS');
    assert.equal(b.current(), null); assert.deepEqual(b.recent(), []);
    assert.ok(b.addTrade(tr(T0 + 1000, 100.02, 1, 'buy')));
    assert.ok(b.addTrade(tr(T0 + 2000, 100.07, 2, 'sell')));
    const cur = b.current();
    assert.equal(cur.t, T0); assert.equal(cur.nTrades, 2); assert.deepEqual(cur.levels.map((l) => [l.price, l.bid, l.ask]), [[100, 0, 1], [100.05, 2, 0]]);
    assert.deepEqual(b.recent(), [], 'nothing closed yet');
    const fp = b.closeCandle(T0 + 299_999); // any time inside the bucket
    assert.equal(fp.t, T0); assert.equal(fp.nTrades, 2); assert.equal(fp.close, 100.07);
    assert.equal(b.current(), null);
    assert.deepEqual(b.recent().map((f) => f.t), [T0]); assert.equal(b.last().t, T0);
    // next candle's trades arrive BEFORE its kline close (the live order of events)
    b.addTrade(tr(T0 + M5 + 10, 100.1, 1, 'buy'));
    assert.equal(b.current().t, T0 + M5);
    b.closeCandle(T0 + M5);
    assert.deepEqual(b.recent().map((f) => f.t), [T0, T0 + M5]);
    assert.deepEqual(b.recent(1).map((f) => f.t), [T0 + M5]);
  });
  test('memory is bounded to maxCandles closed (+ the forming one); the oldest are dropped', () => {
    const b = new FootprintBuilder({ tf: '1m', tick: 1, bucket: 1, maxCandles: 3 });
    for (let i = 0; i < 10; i++) { b.addTrade(tr(T0 + i * 60e3 + 5, 100 + i, 1, 'buy')); b.closeCandle(T0 + i * 60e3); }
    assert.equal(b.recent().length, 3); assert.ok(b.size <= 4);
    assert.deepEqual(b.recent().map((f) => f.t), [7, 8, 9].map((i) => T0 + i * 60e3));
    b.addTrade(tr(T0 + 10 * 60e3, 110, 1, 'buy'));
    assert.ok(b.size <= 4, 'forming candle + 3 closed');
    assert.equal(b.recent().length, 3);
  });
  test('a late trade for a still-held candle is applied (the closed footprint updates); older than anything held → dropped and counted', () => {
    const b = new FootprintBuilder({ tf: '1m', tick: 1, bucket: 1, maxCandles: 2 });
    b.addTrade(tr(T0 + 1, 100, 1, 'buy')); b.closeCandle(T0);
    b.addTrade(tr(T0 + 60e3 + 1, 101, 1, 'buy')); b.closeCandle(T0 + 60e3);
    assert.equal(b.recent()[0].totalAsk, 1);
    assert.ok(b.addTrade(tr(T0 + 50e3, 100, 5, 'sell')), 'late print for the first (held) candle');
    const first = b.recent()[0];
    assert.equal(first.t, T0); assert.equal(first.totalBid, 5); assert.equal(first.nTrades, 2);
    assert.equal(b.current(), null, 'a late trade does not reopen a closed candle');
    assert.equal(b.addTrade(tr(T0 - 60e3, 99, 1, 'buy')), false, 'before everything held');
    assert.equal(b.dropped, 1);
    b.addTrade(tr(T0 + 120e3, 102, 1, 'buy')); b.closeCandle(T0 + 120e3); // ring is 2: T0 falls out
    b.addTrade(tr(T0 + 180e3, 103, 1, 'buy'));
    assert.equal(b.addTrade(tr(T0 + 2, 100, 1, 'buy')), false, 'the T0 candle is no longer held');
    assert.equal(b.dropped, 2);
    assert.deepEqual(b.recent().map((f) => f.t), [T0 + 60e3, T0 + 120e3]);
  });
  test('setBucket applies from the NEXT candle; closeCandle on an empty bucket yields an empty footprint and keeps order', () => {
    const b = new FootprintBuilder({ tf: '1m', tick: 0.5, bucket: 1 });
    b.addTrade(tr(T0 + 1, 100.5, 1, 'buy'));
    b.setBucket(2.5);
    b.addTrade(tr(T0 + 2, 101.5, 1, 'buy'));
    assert.equal(b.current().bucket, 1, 'forming candle keeps its ladder');
    assert.deepEqual(b.current().levels.map((l) => l.price), [100, 101]);
    b.closeCandle(T0);
    const empty = b.closeCandle(T0 + 60e3); // no trades in that minute
    assert.equal(empty.t, T0 + 60e3); assert.deepEqual(empty.levels, []); assert.equal(empty.bucket, 2.5, 'new bucket from the next candle');
    b.addTrade(tr(T0 + 120e3 + 1, 102.5, 1, 'sell'));
    assert.equal(b.current().bucket, 2.5); assert.deepEqual(b.current().levels.map((l) => l.price), [102.5]);
    b.closeCandle(T0 + 120e3);
    assert.deepEqual(b.recent().map((f) => [f.t, f.bucket, f.nTrades]), [[T0, 1, 2], [T0 + 60e3, 2.5, 0], [T0 + 120e3, 2.5, 1]]);
    b.setBucket(0); assert.equal(b.nextBucket, null, 'invalid bucket ignored');
  });
  test('markPartialBefore stamps footprints built from a truncated backfill (and re-stamps held ones)', () => {
    const b = new FootprintBuilder({ tf: '1m', tick: 1, bucket: 1 });
    b.addTrade(tr(T0 + 30e3, 100, 1, 'buy')); b.closeCandle(T0);
    b.addTrade(tr(T0 + 60e3, 100, 1, 'buy')); b.closeCandle(T0 + 60e3);
    assert.deepEqual(b.recent().map((f) => f.partial), [false, false]);
    b.markPartialBefore(T0 + 30e3);  // backfill coverage starts mid-first-candle
    assert.deepEqual(b.recent().map((f) => f.partial), [true, false]);
    b.addTrade(tr(T0 + 120e3, 100, 1, 'buy'));
    assert.equal(b.current().partial, false);
    assert.equal(buildFootprint([tr(T0, 1, 1, 'buy')], { t: T0, tf: '1m', bucket: 1, tick: 1, partial: true }).partial, true);
  });
  test('constructor validates tf and tick; the builder and buildFootprint agree on the same tape', () => {
    assert.throws(() => new FootprintBuilder({ tf: '2m', tick: 1 }), /timeframe/);
    assert.throws(() => new FootprintBuilder({ tf: '1m', tick: 0 }), /tick/);
    const trades = tape([[100, 10, 7], [101, 10, 30], [102, 10, 29], [103, 0, 5], [104, 0, 5], [105, 9, 0], [106, 12, 3], [107, 4, 0]]);
    const b = new FootprintBuilder({ tf: '5m', tick: 1, bucket: 1 });
    for (const t of trades) b.addTrade(t);
    const viaBuilder = b.closeCandle(T0), pure = buildFootprint(trades, { t: T0, tf: '5m', bucket: 1, tick: 1 });
    assert.deepEqual(viaBuilder, pure);
  });
  test('addTrade stays O(1): 200k trades over one candle finish fast and the state holds only traded levels', () => {
    const b = new FootprintBuilder({ tf: '5m', tick: 0.01, bucket: 0.05 });
    const start = process.hrtime.bigint();
    for (let i = 0; i < 200_000; i++) b.addTrade(tr(T0 + (i % 299_000), 100 + ((i * 7) % 500) / 100, 0.01, i & 1 ? 'buy' : 'sell'));
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    assert.ok(ms < 2000, `200k trades took ${ms.toFixed(0)} ms`);
    const fp = b.closeCandle(T0);
    assert.equal(fp.nTrades, 200_000); assert.equal(fp.levels.length, 100); assert.equal(fp.truncated, false);
    assert.ok(Math.abs(fp.total - 2000) < 1e-6);
  });
});

describe('fetchAggTrades — fromId pagination, 1 req/s, 429 holdoff, maxRequests → partial', () => {
  const SAMPLE = JSON.parse('{"a":37416157,"p":"4146.00000000","q":"0.01890000","f":51562765,"l":51562765,"T":1791142265492,"m":false,"M":true}');
  const T_START = Date.UTC(2026, 0, 13, 8, 0);
  /** A deterministic tape: id i ↔ t = T_START + (i − ID0) × 10 ms, price walks, side alternates. */
  const ID0 = 1000;
  const row = (id) => ({ a: id, p: (85000 + (id % 50) * 0.01).toFixed(2), q: '0.01', f: id, l: id, T: T_START + (id - ID0) * 10, m: id % 3 === 0, M: true });
  const params = (url) => Object.fromEntries(new URL(url).searchParams);
  /** Serves a tape of `total` trades (ids ID0 … ID0+total−1) honouring startTime / fromId / endTime / limit. */
  const server = (total, { onCall } = {}) => (url) => {
    const q = params(url);
    onCall?.(q, url);
    const limit = Number(q.limit);
    const lastId = ID0 + total - 1;
    let from;
    if (q.fromId !== undefined) from = Number(q.fromId);
    else if (q.startTime !== undefined) from = ID0 + Math.max(0, Math.ceil((Number(q.startTime) - T_START) / 10));
    else if (q.endTime !== undefined) from = Math.max(ID0, ID0 + Math.floor((Number(q.endTime) - T_START) / 10) - limit + 1);
    else from = Math.max(ID0, lastId - limit + 1);
    const rows = [];
    for (let id = Math.max(from, ID0); id <= lastId && rows.length < limit; id++) rows.push(row(id));
    return { json: rows };
  };
  /** Drive a fake-clock promise: flush microtasks, advance to the next timer, repeat until settled. */
  async function drive(p, clock) {
    let settled = false; p.then(() => { settled = true; }, () => { settled = true; });
    for (let i = 0; i < 10_000 && !settled; i++) { await clock.flush(); if (settled) break; if (clock.pending()) clock.tick(1000); else await clock.flush(); }
    return p;
  }
  const deps = (clock, fetch) => ({ fetch, now: clock.now, setTimeout: clock.setTimeout });

  test('parseAggTradeRow: m = buyer is maker ⇒ seller aggressed ⇒ side sell; id kept for pagination', () => {
    assert.deepEqual(parseAggTradeRow(SAMPLE), { t: 1791142265492, p: 4146, q: 0.0189, side: 'buy', id: 37416157 });
    assert.equal(parseAggTradeRow({ ...SAMPLE, m: true }).side, 'sell');
    assert.equal(aggTradesUrl({ symbol: 'btcusdt', startTime: 1.9 }), `${REST_BASE}/aggTrades?symbol=BTCUSDT&startTime=1&limit=1000`);
    assert.equal(aggTradesUrl({ symbol: 'BTCUSDT', fromId: 5, limit: 10 }), `${REST_BASE}/aggTrades?symbol=BTCUSDT&fromId=5&limit=10`);
    assert.equal(aggTradesUrl({ symbol: 'BTCUSDT', endTime: 7 }), `${REST_BASE}/aggTrades?symbol=BTCUSDT&endTime=7&limit=1000`);
    assert.equal(aggTradesUrl({ symbol: 'BTCUSDT' }), `${REST_BASE}/aggTrades?symbol=BTCUSDT&limit=1000`);
  });
  test('first page by startTime, then fromId = lastId + 1 until a short page; trades oldest→newest, deduped, not partial', async () => {
    const clock = fakeClock(T_START + 3600e3);
    const seen = [];
    const fetch = fakeFetch({ aggTrades: server(2500, { onCall: (q) => seen.push({ ...q, at: clock.now() }) }) });
    const trades = await drive(fetchAggTrades({ symbol: 'btcusdt', startTime: T_START, ...deps(clock, fetch) }), clock);
    assert.equal(trades.length, 2500); assert.equal(trades.partial, false); assert.equal(trades.requests, 3); assert.equal(trades.direction, 'forward');
    assert.equal(seen.length, 3);
    assert.deepEqual(seen.map((q) => [q.startTime, q.fromId, q.limit]), [[String(T_START), undefined, '1000'], [undefined, String(ID0 + 1000), '1000'], [undefined, String(ID0 + 2000), '1000']]);
    assert.ok(seen.every((q) => q.symbol === 'BTCUSDT'));
    assert.equal(trades[0].id, ID0); assert.equal(trades[2499].id, ID0 + 2499);
    assert.ok(trades.every((t, i) => i === 0 || t.t >= trades[i - 1].t), 'ascending');
    assert.deepEqual(trades.coverage, { from: T_START, to: T_START + 2499 * 10 });
    assert.equal(trades.firstId, ID0); assert.equal(trades.lastId, ID0 + 2499);
    assert.deepEqual(Object.keys(trades[0]).sort(), ['id', 'p', 'q', 'side', 't']);
    assert.equal(trades[ID0 % 3 === 0 ? 0 : 3 - (ID0 % 3)].side, 'sell');
  });
  test('never more than 1 request per second (paced on the injected clock)', async () => {
    const clock = fakeClock(T_START + 3600e3);
    const at = [];
    const fetch = fakeFetch({ aggTrades: server(4200, { onCall: () => at.push(clock.now()) }) });
    const trades = await drive(fetchAggTrades({ symbol: 'BTCUSDT', startTime: T_START, ...deps(clock, fetch) }), clock);
    assert.equal(trades.length, 4200); assert.equal(at.length, 5);
    for (let i = 1; i < at.length; i++) assert.ok(at[i] - at[i - 1] >= 1000, `gap ${at[i] - at[i - 1]} ms between request ${i - 1} and ${i}`);
    assert.equal(at[0], T_START + 3600e3, 'the first request goes out at once');
  });
  test('429 → Retry-After holdoff then the same page is retried; the retry counts toward maxRequests; 418 without the header waits 60 s', async () => {
    const clock = fakeClock(T_START + 3600e3);
    const at = []; let n = 0;
    const tapeFn = server(1500, { onCall: (q) => at.push({ at: clock.now(), fromId: q.fromId }) });
    const fetch = fakeFetch({ aggTrades: (url) => { n++; if (n === 2) return { status: 429, headers: { 'retry-after': '7' } }; return tapeFn(url); } });
    const trades = await drive(fetchAggTrades({ symbol: 'BTCUSDT', startTime: T_START, ...deps(clock, fetch) }), clock);
    assert.equal(trades.length, 1500); assert.equal(trades.partial, false); assert.equal(trades.requests, 3);
    assert.equal(at.length, 2, 'the 429 response did not reach the tape');
    assert.equal(fetch.calls.length, 3);
    assert.equal(at[1].at - at[0].at, 1000 + 7000, 'second REST call (first retry) went out exactly Retry-After later');
    assert.equal(at[1].fromId, String(ID0 + 1000), 'the retried page is the same fromId page');
    // 418 without Retry-After: 60 s holdoff
    const clock2 = fakeClock(T_START + 3600e3); let m = 0; const at2 = [];
    const fetch2 = fakeFetch({ aggTrades: (url) => { m++; if (m === 1) return { status: 418 }; return server(10, { onCall: () => at2.push(clock2.now()) })(url); } });
    const t2 = await drive(fetchAggTrades({ symbol: 'BTCUSDT', startTime: T_START, ...deps(clock2, fetch2) }), clock2);
    assert.equal(t2.length, 10); assert.equal(at2[0] - (T_START + 3600e3), 60_000);
    // a 429 storm cannot run away: every call counts
    const clock3 = fakeClock(T_START + 3600e3);
    const fetch3 = fakeFetch({ aggTrades: () => ({ status: 429, headers: { 'retry-after': '1' } }) });
    const t3 = await drive(fetchAggTrades({ symbol: 'BTCUSDT', startTime: T_START, maxRequests: 4, ...deps(clock3, fetch3) }), clock3);
    assert.equal(t3.length, 0); assert.equal(t3.partial, true); assert.equal(fetch3.calls.length, 4);
  });
  test('stops at maxRequests and flags partial (forward: the newest trades are the missing ones); cfg.footprint.backfillMaxRequests is the default cap', async () => {
    const clock = fakeClock(T_START + 3600e3);
    const fetch = fakeFetch({ aggTrades: server(5000) });
    const trades = await drive(fetchAggTrades({ symbol: 'BTCUSDT', startTime: T_START, maxRequests: 2, ...deps(clock, fetch) }), clock);
    assert.equal(trades.length, 2000); assert.equal(trades.partial, true); assert.equal(trades.requests, 2);
    assert.equal(trades.coverage.to, T_START + 1999 * 10);
    const warns = [];
    const log = { warn: (sym, m) => warns.push([sym, m]), info: () => {} };
    const clock2 = fakeClock(T_START + 3600e3);
    const fetch2 = fakeFetch({ aggTrades: server(5000) });
    const t2 = await drive(fetchAggTrades({ symbol: 'BTCUSDT', startTime: T_START, cfg: { footprint: { backfillMaxRequests: 3 } }, log, ...deps(clock2, fetch2) }), clock2);
    assert.equal(t2.length, 3000); assert.equal(t2.partial, true); assert.equal(fetch2.calls.length, 3);
    assert.equal(warns.length, 1); assert.equal(warns[0][0], 'BTCUSDT'); assert.match(warns[0][1], /stopped at 3 request\(s\).*partial/);
    // exactly filling the tape with the last page full: one extra (empty) page proves completion
    const clock3 = fakeClock(T_START + 3600e3);
    const fetch3 = fakeFetch({ aggTrades: server(2000) });
    const t3 = await drive(fetchAggTrades({ symbol: 'BTCUSDT', startTime: T_START, ...deps(clock3, fetch3) }), clock3);
    assert.equal(t3.length, 2000); assert.equal(t3.partial, false); assert.equal(t3.requests, 3);
  });
  test('endTime bounds the window client-side: the walk stops at the first trade past it', async () => {
    const clock = fakeClock(T_START + 3600e3);
    const fetch = fakeFetch({ aggTrades: server(5000) });
    const trades = await drive(fetchAggTrades({ symbol: 'BTCUSDT', startTime: T_START + 5000, endTime: T_START + 12_000, ...deps(clock, fetch) }), clock);
    // ids with t ∈ [T_START+5000, T_START+12000] → (id−ID0) ∈ [500, 1200] → 701 trades over 2 pages (500..1499 then 1500..)
    assert.equal(trades.length, 701); assert.equal(trades.partial, false); assert.equal(trades.requests, 1, 'the first page already crossed endTime');
    assert.equal(trades[0].t, T_START + 5000); assert.equal(trades[700].t, T_START + 12_000);
    assert.equal(trades.firstId, ID0 + 500); assert.equal(trades.lastId, ID0 + 1200);
  });
  test("direction 'backward': newest page first, fromId walks back by limit until startTime; partial means the OLDEST are missing", async () => {
    const clock = fakeClock(T_START + 3600e3);
    const seen = [];
    const fetch = fakeFetch({ aggTrades: server(5000, { onCall: (q) => seen.push(q) }) });
    const trades = await drive(fetchAggTrades({ symbol: 'BTCUSDT', startTime: T_START + 25_000, direction: 'backward', ...deps(clock, fetch) }), clock);
    // tape ids ID0..ID0+4999 (t up to +49990). Window from +25000 → offsets 2500..4999 = 2500 trades over 3 pages
    assert.equal(trades.length, 2500); assert.equal(trades.partial, false); assert.equal(trades.direction, 'backward'); assert.equal(trades.requests, 3);
    assert.equal(trades[0].id, ID0 + 2500); assert.equal(trades[2499].id, ID0 + 4999);
    assert.deepEqual(seen.map((q) => [q.startTime, q.endTime, q.fromId]), [[undefined, undefined, undefined], [undefined, undefined, String(ID0 + 3000)], [undefined, undefined, String(ID0 + 2000)]]);
    assert.ok(trades.every((t, i) => i === 0 || t.t >= trades[i - 1].t), 'ascending after the backward walk');
    const clock2 = fakeClock(T_START + 3600e3);
    const fetch2 = fakeFetch({ aggTrades: server(5000) });
    const cut = await drive(fetchAggTrades({ symbol: 'BTCUSDT', startTime: T_START, direction: 'backward', maxRequests: 2, ...deps(clock2, fetch2) }), clock2);
    assert.equal(cut.length, 2000); assert.equal(cut.partial, true);
    assert.equal(cut.coverage.from, T_START + 3000 * 10, 'the newest 2000 trades; everything before coverage.from is missing');
    assert.equal(cut[cut.length - 1].id, ID0 + 4999);
    // with endTime the newest page is requested by endTime
    const clock3 = fakeClock(T_START + 3600e3); const seen3 = [];
    const fetch3 = fakeFetch({ aggTrades: server(5000, { onCall: (q) => seen3.push(q) }) });
    const win = await drive(fetchAggTrades({ symbol: 'BTCUSDT', startTime: T_START + 10_000, endTime: T_START + 20_000, direction: 'backward', ...deps(clock3, fetch3) }), clock3);
    assert.equal(seen3[0].endTime, String(T_START + 20_000));
    assert.equal(win.length, 1001); assert.equal(win[0].t, T_START + 10_000); assert.equal(win[1000].t, T_START + 20_000);
  });
  test('a backfill feeds the builder: markPartialBefore(coverage.from) labels exactly the truncated candles', async () => {
    const clock = fakeClock(T_START + 3600e3);
    const fetch = fakeFetch({ aggTrades: server(5000) });
    const trades = await drive(fetchAggTrades({ symbol: 'BTCUSDT', startTime: T_START, direction: 'backward', maxRequests: 2, ...deps(clock, fetch) }), clock);
    assert.equal(trades.partial, true);
    const b = new FootprintBuilder({ tf: '1m', tick: 0.01, bucket: 0.05 });
    for (const t of trades) b.addTrade(t);
    b.closeCandle(T_START);
    if (trades.partial) b.markPartialBefore(trades.coverage.from);
    // all 5000 trades sit inside the first minute (t ≤ +49.99 s), so the single candle is partial
    assert.deepEqual(b.recent().map((f) => [f.t, f.partial, f.nTrades]), [[T_START, true, 2000]]);
  });
  test('hard failures surface: non-OK status and a malformed body throw; missing inputs are TypeErrors', async () => {
    const clock = fakeClock(T_START);
    await assert.rejects(drive(fetchAggTrades({ symbol: 'BTCUSDT', startTime: T_START, ...deps(clock, fakeFetch({ aggTrades: { status: 500 } })) }), clock), /HTTP 500/);
    await assert.rejects(drive(fetchAggTrades({ symbol: 'BTCUSDT', startTime: T_START, ...deps(clock, fakeFetch({ aggTrades: { json: { code: -1121, msg: 'Invalid symbol.' } } })) }), clock), /unexpected body/);
    await assert.rejects(drive(fetchAggTrades({ symbol: 'BTCUSDT', startTime: T_START, ...deps(clock, fakeFetch({ aggTrades: new Error('ECONNRESET') })) }), clock), /ECONNRESET/);
    await assert.rejects(fetchAggTrades({ startTime: T_START, fetch: fakeFetch() }), TypeError);
    await assert.rejects(fetchAggTrades({ symbol: 'BTCUSDT', fetch: fakeFetch() }), TypeError);
    await assert.rejects(fetchAggTrades({ symbol: 'BTCUSDT', startTime: T_START, direction: 'sideways', fetch: fakeFetch() }), RangeError);
    const empty = await drive(fetchAggTrades({ symbol: 'BTCUSDT', startTime: T_START, ...deps(clock, fakeFetch({ aggTrades: { json: [] } })) }), clock);
    assert.equal(empty.length, 0); assert.equal(empty.partial, false); assert.deepEqual(empty.coverage, { from: null, to: null });
  });
});
