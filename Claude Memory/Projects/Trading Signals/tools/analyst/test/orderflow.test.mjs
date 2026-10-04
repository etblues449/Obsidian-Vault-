// test/orderflow.test.mjs — SPEC §4.6 / §8. Candles are hand-built so every expected number can be
// checked by arithmetic against source 05; generators are inline to keep this file self-contained.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { candleDelta, cvdSeries, cvdDivergence, detectAbsorption, effortVsResult, volumeProfile, profileLevels, nakedPocs } from '../lib/engine/orderflow.mjs';
import { swings } from '../lib/engine/indicators.mjs';

const M1 = 60e3, M5 = 3e5, T0 = Date.UTC(2026, 0, 13);
const OF = { absorptionVolumeMult: 2.0, absorptionMaxRangeAtr: 0.6, absorptionMinWickRatio: 0.5, cvdDivergenceSwings: 2, volumeProfileWindowCandles: 288, volumeProfileBucketsAtr: 0.1, valueAreaPct: 0.70, nakedPocLookbackDays: 5 };
const CFG = {
  sessions: { timezone: 'Europe/London', list: [
    { id: 'asia', label: 'Asian', start: '00:00', end: '07:00', role: 'consolidation' },
    { id: 'london', label: 'London', start: '07:00', end: '12:00', role: 'manipulation', killzone: { start: '07:00', end: '10:00' } },
    { id: 'ny', label: 'New York', start: '12:00', end: '17:00', role: 'distribution', killzone: { start: '13:30', end: '16:00' } },
    { id: 'late', label: 'Late NY', start: '17:00', end: '24:00', role: 'retracement' } ] },
  orderflow: OF,
};

/** Candle with aggressor split: buyV = v·buyFrac. Omit buyFrac for a candle without aggressor data. */
const mk = (t, o, h, l, c, v = 10, buyFrac) => {
  const x = { t, o, h: Math.max(h, o, c), l: Math.min(l, o, c), c, v, closed: true };
  if (buyFrac !== undefined) { x.buyV = v * buyFrac; x.sellV = v - x.buyV; }
  return x;
};
/** Flat 50/50 candles o=c=price with symmetric ±wick. */
const flat = (n, { price = 100, wick = 0.5, v = 10, t0 = T0, ms = M1 } = {}) => Array.from({ length: n }, (_, i) => mk(t0 + i * ms, price, price + wick, price - wick, price, v, 0.5));
/** Zero-range candle at one price (all volume lands in one profile bucket). */
const at = (t, p, v) => mk(t, p, p, p, p, v);

/**
 * The source 05 §3 divergence picture: leg 1 (6 candles, strong flow), pullback (4), leg 2 (7, beyond
 * leg 1 but on weak flow), 3 confirm candles. dir=+1 → bearish picture (price HH); dir=−1 → bullish.
 * flow2 = buy fraction of leg 2 — 0.4 diverges, 0.9 confirms (price and CVD both HH).
 */
function divergencePath(dir, flow2) {
  const plan = [...Array(6).fill([0.8, 0.8]), ...Array(4).fill([-0.5, 0.35]), ...Array(7).fill([0.8, flow2]), ...Array(3).fill([-0.6, 0.35])];
  const out = [];
  let o = 100;
  plan.forEach(([move, f], k) => {
    const c = o + dir * move, up = c > o;
    out.push(mk(T0 + k * M5, o, up ? c + 0.1 : o + 0.05, up ? o - 0.05 : c - 0.1, c, 10, dir > 0 ? f : 1 - f));
    o = c;
  });
  return out;
}

// ---- delta / CVD ----
test('candleDelta: aggressive buy − aggressive sell when tagged, body/range proxy otherwise', () => {
  assert.deepEqual(candleDelta(mk(T0, 100, 101, 99, 100.5, 10, 0.7)), { value: 4, source: 'trades' });
  const p = candleDelta(mk(T0, 100, 101, 99, 100.5, 10));
  assert.equal(p.source, 'proxy');
  assert.ok(Math.abs(p.value - 2.5) < 1e-9, 'proxy = (c−o)/(h−l)·v = 0.5/2·10');
});

test('cvdSeries: running sum, optional session resets', () => {
  const cs = [mk(T0, 100, 101, 99, 100, 10, 0.8), mk(T0 + M1, 100, 101, 99, 100, 10, 0.3), mk(T0 + 2 * M1, 100, 101, 99, 100, 10, 0.6)];
  assert.deepEqual(cvdSeries(cs).map((x) => Math.round(x * 1e9) / 1e9), [6, 2, 4]);
  assert.deepEqual(cvdSeries(cs, { resetAtIndexes: [2] }).map((x) => Math.round(x * 1e9) / 1e9), [6, 2, 2]);
});

// ---- cvdDivergence ----
test('cvdDivergence: price HH with CVD lower high ⇒ bearish (absorption at resistance)', () => {
  const cs = divergencePath(+1, 0.4);
  const sw = swings(cs, 2);
  assert.deepEqual(sw.filter((s) => s.kind === 'high').map((s) => s.index), [5, 16], 'the two leg tops are confirmed swing highs');
  const d = cvdDivergence(cs, sw, OF);
  assert.ok(d, 'divergence expected');
  assert.equal(d.kind, 'bearish');
  assert.equal(d.t, cs[16].t);
  assert.equal(d.priceSwing.index, 16);
  assert.equal(d.prevPriceSwing.index, 5);
  assert.ok(d.priceSwing.price > d.prevPriceSwing.price, 'price made a higher high');
  // CVD: leg1 +6×6 = 36 at index 5; pullback −3×4 → 24 at the swing low (9); leg 2 −2×7 → 10 at 16.
  assert.ok(Math.abs(d.prevCvdSwing.value - 36) < 1e-9);
  assert.equal(d.cvdSwing.index, 9, 'the second leg never exceeded the CVD it started from');
  assert.ok(d.cvdSwing.value < d.prevCvdSwing.value, 'CVD made a lower high');
  assert.equal(d.age, cs.length - 1 - 16);
});

test('cvdDivergence: price LL with CVD higher low ⇒ bullish; the same config object works nested or flat', () => {
  const cs = divergencePath(-1, 0.4);
  const d = cvdDivergence(cs, swings(cs, 2), { orderflow: OF });
  assert.ok(d);
  assert.equal(d.kind, 'bullish');
  assert.equal(d.priceSwing.kind, 'low');
  assert.ok(d.priceSwing.price < d.prevPriceSwing.price, 'price made a lower low');
  assert.ok(d.cvdSwing.value > d.prevCvdSwing.value, 'CVD made a higher low');
});

test('cvdDivergence: CVD confirming the move (HH with HH) is healthy trend, not divergence', () => {
  const cs = divergencePath(+1, 0.9);
  assert.equal(cvdDivergence(cs, swings(cs, 2), OF), null);
});

test('cvdDivergence: too few swings, missing arrays, or a higher swing count the window cannot satisfy ⇒ null', () => {
  const cs = divergencePath(+1, 0.4);
  const sw = swings(cs, 2);
  assert.equal(cvdDivergence(cs, sw.filter((s) => s.index !== 5), OF), null, 'one swing high only');
  assert.equal(cvdDivergence(cs, [], OF), null);
  assert.equal(cvdDivergence([], sw, OF), null);
  assert.equal(cvdDivergence(cs, sw, { cvdDivergenceSwings: 3 }), null, 'three highs required, two present');
  assert.equal(cvdDivergence(cs, sw, { cvdDivergenceSwings: 0 }).kind, 'bearish', 'swing count floors at 2');
});

test('cvdDivergence: a precomputed CVD series of the right length is used as-is', () => {
  const cs = divergencePath(+1, 0.4);
  const sw = swings(cs, 2);
  const flatCvd = cs.map(() => 0);                         // CVD never moves ⇒ equal peaks ⇒ "fails to make a new high"
  assert.equal(cvdDivergence(cs, sw, OF, { cvd: flatCvd }).kind, 'bearish');
  const rising = cs.map((_, i) => i);                      // strictly rising CVD confirms
  assert.equal(cvdDivergence(cs, sw, OF, { cvd: rising }), null);
});

// ---- detectAbsorption ----
const absorptionBase = () => flat(30);
const bullishAbs = (over = {}) => ({ ...mk(T0 + 30 * M1, 100, 100.1, 99.6, 100.05, 30, 1 / 3), ...over }); // range 0.5, lower wick 0.8, delta −10

test('detectAbsorption: heavy volume, small range, lower wick, delta ≤ 0 ⇒ bullish absorption at support', () => {
  const cs = [...absorptionBase(), bullishAbs()];
  const a = detectAbsorption(cs, 1, OF);
  assert.ok(a);
  assert.equal(a.side, 'bullish');
  assert.equal(a.t, cs[30].t);
  assert.equal(a.vol, 30);
  assert.ok(Math.abs(a.range - 0.5) < 1e-9);
  assert.ok(Math.abs(a.delta + 10) < 1e-9);
  assert.equal(a.deltaSource, 'trades');
  assert.equal(a.meanVol, 10, 'baseline is the 20 candles BEFORE the candidate');
  assert.equal(a.volMult, 3);
  assert.ok(Math.abs(a.wick.lower - 0.8) < 1e-9);
});

test('detectAbsorption: upper wick with delta ≥ 0 ⇒ bearish absorption at resistance', () => {
  const bear = mk(T0 + 30 * M1, 100, 100.4, 99.9, 99.95, 30, 2 / 3); // upper wick (100.4−100)/0.5 = 0.8, delta +10
  const a = detectAbsorption([...absorptionBase(), bear], 1, OF);
  assert.equal(a?.side, 'bearish');
  assert.ok(Math.abs(a.wick.upper - 0.8) < 1e-9);
});

test('detectAbsorption: each gate rejects on its own — volume, range, wick, delta sign', () => {
  const base = absorptionBase();
  assert.equal(detectAbsorption([...base, bullishAbs({ v: 15, buyV: 5, sellV: 10 })], 1, OF), null, 'volume 1.5× mean < 2×');
  assert.equal(detectAbsorption([...base, bullishAbs({ l: 99.0 })], 1, OF), null, 'range 1.1 ATR > 0.6');
  assert.equal(detectAbsorption([...base, bullishAbs({ l: 99.9, h: 100.3 })], 1, OF), null, 'lower wick 0.25 < 0.5 and upper 0.5 with delta −10 fails the bearish sign');
  assert.equal(detectAbsorption([...base, bullishAbs({ buyV: 25, sellV: 5 })], 1, OF), null, 'positive delta on a lower-wick bar is not absorption');
  assert.equal(detectAbsorption([...base, bullishAbs()], 0, OF), null, 'no ATR');
  assert.equal(detectAbsorption([...base, bullishAbs()], 0.5, OF), null, 'ATR 0.5 ⇒ range 1.0 ATR > 0.6');
});

test('detectAbsorption: evaluates the last CLOSED candle, ignores a forming print, needs history', () => {
  const forming = { ...mk(T0 + 31 * M1, 100, 100, 99, 99.5, 500, 0.1), closed: false };
  const a = detectAbsorption([...absorptionBase(), bullishAbs(), forming], 1, OF);
  assert.equal(a?.t, T0 + 30 * M1, 'the forming candle is skipped; the closed absorption bar is found');
  assert.equal(detectAbsorption([bullishAbs()], 1, OF), null, 'no baseline');
  assert.equal(detectAbsorption([...flat(3), bullishAbs()], 1, OF), null, 'fewer than 5 prior candles');
  assert.equal(detectAbsorption([...flat(6), bullishAbs()], 1, OF)?.side, 'bullish', 'a short but ≥ 5-candle baseline is enough');
  assert.equal(detectAbsorption([], 1, OF), null);
});

test('detectAbsorption: candles without aggressor volume use the proxy delta and say so', () => {
  const cs = [...flat(30).map((c) => { const { buyV, sellV, ...rest } = c; return rest; }), bullishAbs({ buyV: undefined, sellV: undefined })];
  const a = detectAbsorption(cs, 1, OF);
  assert.equal(a?.side, 'bullish');
  assert.equal(a.deltaSource, 'proxy');
});

// ---- effortVsResult ----
test('effortVsResult: effort = v/meanVol, result = range/ATR, ratio = effort/result; nulls on unusable input', () => {
  assert.deepEqual(effortVsResult(bullishAbs(), 1, 10), { effort: 3, result: 0.5, ratio: 6 });
  assert.deepEqual(effortVsResult(at(T0, 100, 30), 1, 10), { effort: 3, result: 0, ratio: null });
  assert.deepEqual(effortVsResult(bullishAbs(), 0, 10), { effort: 3, result: null, ratio: null });
  assert.deepEqual(effortVsResult(bullishAbs(), 1, 0), { effort: null, result: 0.5, ratio: null });
});

// ---- volumeProfile ----
test('volumeProfile: POC, 70 % value area grown toward the heavier neighbour, HVN/LVN, D shape', () => {
  // bucket 1: [100,101)=10  [101,102)=30  [102,103)=100 (POC)  [103,104)=20  [104,105)=5   total 165, mean 33
  const cs = [at(T0, 100.5, 10), at(T0 + M1, 101.5, 30), at(T0 + 2 * M1, 102.5, 100), at(T0 + 3 * M1, 103.5, 20), at(T0 + 4 * M1, 104.5, 5)];
  const p = volumeProfile(cs, { bucket: 1 });
  assert.equal(p.poc, 102.5);
  assert.equal(p.pocVol, 100);
  // VA target 115.5: POC 100 → add 30 (101 bucket, heavier than 20) → 130 ≥ 115.5 ⇒ VA = [101, 103)
  assert.equal(p.val, 101);
  assert.equal(p.vah, 103);
  assert.equal(p.vaVol, 130);
  assert.deepEqual(p.hvn, [102.5], 'the POC is the only local maximum at/above the mean');
  assert.deepEqual(p.lvn, [104.5], 'the 5-volume tail is below 25 % of the mean (8.25); the 10-volume tail is not');
  assert.equal(p.shape, 'D', 'POC in the middle third and 100 ≥ 3×33');
  assert.equal(p.totalVol, 165);
  assert.equal(p.buckets.length, 5);
  assert.ok(Math.abs(p.buckets.reduce((a, b) => a + b.vol, 0) - 165) < 1e-6, 'buckets conserve volume');
  assert.deepEqual(p.buckets.map((b) => b.price), [100.5, 101.5, 102.5, 103.5, 104.5]);
  assert.equal(p.bucket, 1);
  assert.equal(p.n, 5);
});

test('volumeProfile: a candle spreads evenly across the buckets its range touches; buyV/sellV not needed', () => {
  const p = volumeProfile([mk(T0, 100.3, 102.7, 100.2, 102.5, 30)], { bucket: 1 });
  assert.deepEqual(p.buckets.map((b) => b.vol), [10, 10, 10]);
  assert.equal(p.poc, 101.5, 'three-way tie resolves to the middle bucket');
  assert.equal(p.shape, 'thin', 'uniform volume: POC < 3× mean');
  assert.equal(p.vah, 102.7, 'VAH is clamped to the range high');
  assert.equal(p.val, 100.2, 'VAL is clamped to the range low');
});

test('volumeProfile: shapes — P (value at top), b (value at bottom), thin (no concentration)', () => {
  const build = (vols) => volumeProfile(vols.map((v, i) => at(T0 + i * M1, 100.5 + i, v)), { bucket: 1 });
  assert.equal(build([5, 5, 5, 5, 100]).shape, 'P');
  assert.equal(build([100, 5, 5, 5, 5]).shape, 'b');
  assert.equal(build([10, 10, 10, 10, 10]).shape, 'thin');
  assert.equal(build([10, 10, 10, 10, 10]).poc, 102.5, 'all-equal tie → bucket nearest the middle of the range');
});

test('volumeProfile: value area on a tie grows both ways; LVN at an interior gap collapses to one price', () => {
  // [100)=20 [101)=0 [102)=0 [103)=0 [104)=50 [105)=20   total 90, mean 15; POC 104.5
  const cs = [at(T0, 100.5, 20), at(T0 + M1, 104.5, 50), at(T0 + 2 * M1, 105.5, 20)];
  const p = volumeProfile(cs, { bucket: 1 });
  assert.equal(p.poc, 104.5);
  // target 63: 50 → neighbours 0 (down) vs 20 (up) → +20 = 70 ⇒ VA [104,106)
  assert.equal(p.val, 104); assert.equal(p.vah, 105.5);
  assert.deepEqual(p.lvn, [102.5], 'the three empty buckets are one LVN run at its centre');
  assert.deepEqual(p.hvn, [100.5, 104.5], 'both local maxima are ≥ mean (15)');
  // exact tie: [101)=40 (POC) with 30 either side → both added at once; VA edges clamp to the traded range
  const tie = volumeProfile([at(T0, 100.5, 30), at(T0 + M1, 101.5, 40), at(T0 + 2 * M1, 102.5, 30)], { bucket: 1 });
  assert.equal(tie.val, 100.5); assert.equal(tie.vah, 102.5); assert.equal(tie.vaVol, 100);
});

test('volumeProfile: bucket derivation (atr×bucketsAtr, tick snapping, range/50 default, cap) and null on nothing', () => {
  const cs = flat(10, { wick: 2 });
  assert.equal(volumeProfile(cs, { atr: 1, bucketsAtr: 0.1 }).bucket, 0.1);
  assert.equal(volumeProfile(cs, { atr: 1, bucketsAtr: 0.1, tick: 0.25 }).bucket, 0.25, 'snapped up to the tick');
  assert.equal(volumeProfile(cs, { atr: 1, bucketsAtr: 0.3, tick: 0.25 }).bucket, 0.25, 'rounded to the nearest tick multiple');
  assert.equal(volumeProfile(cs).bucket, 4 / 50, 'no hint ⇒ range / 50');
  assert.equal(volumeProfile(cs, { bucket: 1e-6, maxBuckets: 100 }).buckets.length, 101, 'resolution capped');
  assert.equal(volumeProfile([], { bucket: 1 }), null);
  assert.equal(volumeProfile(cs.map((c) => ({ ...c, v: 0 })), { bucket: 1 }), null, 'zero volume ⇒ nothing to profile');
  assert.equal(volumeProfile([{ t: T0, o: 1, h: NaN, l: 1, c: 1, v: 5 }], { bucket: 1 }), null, 'garbage candles are ignored');
  const one = volumeProfile([at(T0, 100, 5)], {});
  assert.ok(one && one.poc > 99.99 && one.poc < 100.01, 'single-price input without a tick still profiles');
  const edge = volumeProfile([at(T0, 100, 5)], { bucket: 0.1 });
  assert.equal(edge.poc, 100.05, '100 / 0.1 lands in bucket 1000, not 999');
});

test('profileLevels: poc/vah/val as Level objects with sides', () => {
  const p = volumeProfile([at(T0, 100.5, 10), at(T0 + M1, 101.5, 50), at(T0 + 2 * M1, 102.5, 10)], { bucket: 1 });
  const lv = profileLevels(p, { t: T0, tf: '5m', price: 100 });
  assert.deepEqual(lv.map((l) => [l.kind, l.price, l.side]), [['poc', 101.5, 'buy-side'], ['vah', 102, 'buy-side'], ['val', 101, 'sell-side']]);
  assert.equal(profileLevels(p, { t: T0, price: 105 })[0].side, 'sell-side');
  assert.deepEqual(profileLevels(null), []);
  for (const l of lv) { assert.equal(l.t, T0); assert.equal(l.tf, '5m'); assert.equal(l.swept, null); assert.ok(l.id.startsWith(`${l.kind}:${T0}:`)); }
});

// ---- nakedPocs ----
/** 1m candles over four London days (January ⇒ GMT, so local day = UTC day). */
function fourDays() {
  const day = (d, h, m = 0) => Date.UTC(2026, 0, d, h, m);
  const out = [];
  // 04 Jan: POC 110 (never revisited); the 00:00 candle makes the ring cover the day start
  out.push(at(day(4, 0), 110, 1));
  for (let i = 0; i < 10; i++) out.push(at(day(4, 8, i), 110, 10));
  out.push(at(day(4, 9), 112, 1));
  out.push(at(day(4, 9, 1), 114, 1));
  // 05 Jan: POC 100.5 — then 06 Jan trades through it
  for (let i = 0; i < 10; i++) out.push(at(day(5, 8, i), 100.5, 10));
  out.push(at(day(5, 9), 103.5, 1));
  // 06 Jan: POC 103.5; one candle spans 100..101 (tests 05 Jan's POC)
  for (let i = 0; i < 10; i++) out.push(at(day(6, 8, i), 103.5, 10));
  out.push(mk(day(6, 9), 101, 101, 100, 100.2, 1));
  out.push(at(day(6, 10), 101.5, 1));
  // 07 Jan (today): price at 105
  out.push(at(day(7, 8), 105, 10));
  out.push(at(day(7, 9), 105, 10));
  return out;
}
const storeOf = (arr) => ({ get: (tf) => (tf === '1m' ? arr.slice() : []), closed: (tf) => (tf === '1m' ? arr.slice() : []) });
const NOW = Date.UTC(2026, 0, 7, 12);

test('nakedPocs: one POC per completed London day, dropped once price trades at it, today excluded', () => {
  const lv = nakedPocs(storeOf(fourDays()), CFG, NOW, { bucket: 1 });
  assert.deepEqual(lv.map((l) => [l.meta.dayKey, l.price, l.side]), [['2026-01-04', 110.5, 'buy-side'], ['2026-01-06', 103.5, 'sell-side']]);
  const a = lv[0];
  assert.equal(a.kind, 'nakedPoc'); assert.equal(a.tf, '1m'); assert.equal(a.swept, null);
  assert.equal(a.t, Date.UTC(2026, 0, 4), 't is the London day start');
  assert.equal(a.id, `nakedPoc:${Date.UTC(2026, 0, 4)}:110.5`);
  assert.equal(a.meta.candles, 13);
  assert.equal(a.meta.shape, 'b', 'value built at the bottom of the day range');
  assert.ok(lv.every((l) => l.meta.dayKey !== '2026-01-07'), 'today is still developing');
  assert.ok(lv.every((l) => l.meta.dayKey !== '2026-01-05'), '06 Jan traded 100–101 through the 100.5 POC');
});

test('nakedPocs: lookback window, partial first day skipped, now gates completed days, empty store', () => {
  const cs = fourDays();
  assert.deepEqual(nakedPocs(storeOf(cs), { ...CFG, orderflow: { ...OF, nakedPocLookbackDays: 2 } }, NOW, { bucket: 1 }).map((l) => l.meta.dayKey), ['2026-01-06']);
  assert.deepEqual(nakedPocs(storeOf(cs.slice(1)), CFG, NOW, { bucket: 1 }).map((l) => l.meta.dayKey), ['2026-01-06'], 'ring starts 04 Jan 08:00 ⇒ that day is not fully covered');
  const padded = [at(Date.UTC(2026, 0, 3, 23, 59), 110, 1), ...cs.slice(1)];
  assert.deepEqual(nakedPocs(storeOf(padded), CFG, NOW, { bucket: 1 }).map((l) => l.meta.dayKey), ['2026-01-04', '2026-01-06'], 'ring reaching before 00:00 covers 04 Jan; 03 Jan itself is still partial');
  const midDay6 = Date.UTC(2026, 0, 6, 9, 30);
  assert.deepEqual(nakedPocs(storeOf(cs.filter((c) => c.t <= midDay6)), CFG, midDay6, { bucket: 1 }).map((l) => l.meta.dayKey), ['2026-01-04'], '05 Jan POC is tested by 06 Jan 09:00; 06 Jan is today');
  assert.deepEqual(nakedPocs(storeOf([]), CFG, NOW), []);
  assert.deepEqual(nakedPocs({ closed: () => cs.slice() }, CFG, NOW, { bucket: 1 }).length, 2, 'a store exposing only closed() works');
});

test('nakedPocs: bucket from atr × volumeProfileBucketsAtr, tick snap, and the range/50 fallback', () => {
  const cs = fourDays();
  const byAtr = nakedPocs(storeOf(cs), CFG, NOW, { atr: 10 });
  assert.deepEqual(byAtr.map((l) => l.meta.bucket), [1, 1]);
  assert.deepEqual(nakedPocs(storeOf(cs), CFG, NOW, { atr: 10, tick: 0.25 }).map((l) => l.meta.bucket), [1, 1]);
  const fallback = nakedPocs(storeOf(cs), CFG, NOW);
  assert.equal(fallback.length, 2);
  assert.ok(Math.abs(fallback[0].price - 110) < 0.1, 'range/50 buckets still centre the POC on the heavy price');
});

test('nakedPocs: refuses to guess the clock or the timezone', () => {
  assert.throws(() => nakedPocs(storeOf(fourDays()), CFG), /now/);
  assert.throws(() => nakedPocs(storeOf(fourDays()), { orderflow: OF }, NOW), /sessions/);
});

test('orderflow.mjs never reads the wall clock', () => {
  const src = readFileSync(fileURLToPath(new URL('../lib/engine/orderflow.mjs', import.meta.url)), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // comments may mention the rule; code may not break it
  assert.doesNotMatch(code, /Date\.now|new Date\(/);
});
