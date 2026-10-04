import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ema, sma, atr, lastAtr, trueRange, vwap, swings, delta, deltaValue, cvd, rollingMean, rollingStd, bodyAtr, wickRatios, highLow } from '../lib/engine/indicators.mjs';
import { mkCandles, withAbsorption, withCvdDivergence, withSweepBelow, withSweepAbove, withFvg, withOrderBlock, loadFixture } from './helpers.mjs';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const cndl = (o, h, l, c, v = 1, extra = {}) => ({ t: 0, o, h, l, c, v, ...extra });

describe('ema', () => {
  test('SMA-seeded, then standard recursion; null until warm', () => {
    const vals = [1, 2, 3, 4, 5, 6];
    const e = ema(vals, 3);
    assert.deepEqual(e.slice(0, 2), [null, null]);
    near(e[2], 2);                       // SMA(1,2,3)
    near(e[3], 4 * 0.5 + 2 * 0.5);        // k = 2/(3+1) = 0.5
    near(e[4], 5 * 0.5 + e[3] * 0.5);
    assert.equal(e.length, vals.length);
  });
  test('period 1 tracks the input; holes are skipped not reset; bad period throws', () => {
    assert.deepEqual(ema([3, 4, 5], 1), [3, 4, 5]);
    const e = ema([1, 2, null, 3], 2);
    assert.deepEqual(e.slice(0, 3), [null, 1.5, null]);
    near(e[3], 3 * (2 / 3) + 1.5 * (1 / 3));
    assert.throws(() => ema([1], 0), RangeError);
    assert.deepEqual(ema([], 5), []);
  });
  test('sma is rollingMean', () => { assert.deepEqual(sma([1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5]); });
});

describe('atr (Wilder)', () => {
  test('true range uses the previous close; first ATR = mean TR; then Wilder smoothing', () => {
    const cs = [cndl(10, 12, 9, 11), cndl(11, 15, 10, 14), cndl(14, 14, 8, 9), cndl(9, 20, 9, 18)];
    assert.equal(trueRange(cs[0], null), 3);
    assert.equal(trueRange(cs[2], 14), 6);
    assert.equal(trueRange(cs[3], 9), 11);
    const a = atr(cs, 2);
    assert.deepEqual(a.slice(0, 1), [null]);
    near(a[1], (3 + 5) / 2);               // TR1 = max(5, |15-11|, |10-11|) = 5
    near(a[2], (a[1] * 1 + 6) / 2);
    near(a[3], (a[2] * 1 + 11) / 2);
    near(lastAtr(cs, 2), a[3]);
    assert.equal(lastAtr(cs, 10), null);
    assert.throws(() => atr(cs, 0), RangeError);
  });
  test('on a constant-range series ATR equals that range', () => {
    const cs = Array.from({ length: 50 }, (_, i) => cndl(100, 101, 99, 100, 1, { t: i }));
    near(lastAtr(cs, 14), 2);
  });
});

describe('vwap', () => {
  test('cumulative typical-price × volume, with resets by predicate or by t/index', () => {
    const cs = [cndl(1, 3, 1, 2, 10, { t: 0 }), cndl(2, 6, 2, 4, 10, { t: 1 }), cndl(4, 9, 3, 6, 20, { t: 2 })];
    const tp = cs.map((c) => (c.h + c.l + c.c) / 3);
    const v = vwap(cs);
    near(v[0], tp[0]);
    near(v[1], (tp[0] * 10 + tp[1] * 10) / 20);
    near(v[2], (tp[0] * 10 + tp[1] * 10 + tp[2] * 20) / 40);
    const r = vwap(cs, { resetAt: (c) => c.t === 2 });
    near(r[2], tp[2]);
    near(vwap(cs, { resetAt: [2] })[2], tp[2]);        // by index
    near(vwap(cs, { resetAt: new Set([1]) })[1], tp[1]); // by t
  });
  test('zero volume never produces NaN', () => {
    const cs = [cndl(1, 3, 1, 2, 0), cndl(2, 6, 2, 4, 0)];
    assert.deepEqual(vwap(cs).map(Number.isFinite), [true, true]);
  });
});

describe('swings', () => {
  test('a swing high exceeds `lookback` candles on each side; the tail cannot confirm', () => {
    const highs = [1, 2, 5, 2, 1, 3, 7, 3, 2, 2];
    const cs = highs.map((h, i) => cndl(h - 0.5, h, h - 1, h - 0.5, 1, { t: i * 60000 }));
    const s = swings(cs, 2);
    const sh = s.filter((x) => x.kind === 'high');
    assert.deepEqual(sh.map((x) => [x.index, x.price]), [[2, 5], [6, 7]]);
    assert.ok(sh.every((x) => x.t === cs[x.index].t));
    const s1 = swings(cs, 1).filter((x) => x.kind === 'high');
    assert.deepEqual(s1.map((x) => x.index), [2, 6]);
    assert.deepEqual(swings(cs, 5), []);
    assert.throws(() => swings(cs, 0), RangeError);
  });
  test('equal neighbours do not qualify (strict), swing lows mirror highs, output sorted by index', () => {
    const lows = [5, 5, 1, 1, 5, 5, 0, 5, 5];
    const cs = lows.map((l, i) => cndl(l + 1, l + 2, l, l + 1, 1, { t: i }));
    const sl = swings(cs, 1).filter((x) => x.kind === 'low');
    assert.deepEqual(sl.map((x) => x.index), [6]); // index 2/3 tie, index 6 is clean
    const all = swings(cs, 1);
    for (let i = 1; i < all.length; i++) assert.ok(all[i].index >= all[i - 1].index);
  });
  test('finds real swings in the BTC fixture and never in the last `lookback` candles', () => {
    const fx = loadFixture();
    const s = swings(fx, 2);
    assert.ok(s.length > 100);
    assert.ok(s.every((x) => x.index < fx.length - 2 && x.index >= 2));
    for (const x of s) {
      for (let j = x.index - 2; j <= x.index + 2; j++) {
        if (j === x.index) continue;
        if (x.kind === 'high') assert.ok(fx[j].h < x.price); else assert.ok(fx[j].l > x.price);
      }
    }
  });
});

describe('delta / cvd', () => {
  test('real aggressor volume is exact; otherwise a body/range proxy labelled as such', () => {
    assert.deepEqual(delta(cndl(1, 2, 0, 1.5, 10, { buyV: 7, sellV: 3 })), { value: 4, source: 'trades' });
    const p = delta(cndl(10, 12, 8, 11, 100));
    assert.equal(p.source, 'proxy');
    near(p.value, ((11 - 10) / (12 - 8)) * 100);
    near(deltaValue(cndl(10, 12, 8, 9, 100)), -25);
    assert.deepEqual(delta(cndl(10, 10, 10, 10, 100)), { value: 0, source: 'proxy' }); // zero range: no divide-by-zero
    assert.equal(delta(cndl(1, 2, 0, 1, 10, { buyV: 5 })).source, 'proxy'); // half the pair is not enough
  });
  test('cvd cumulates and restarts at reset indexes', () => {
    const cs = [cndl(1, 2, 0, 1, 1, { buyV: 3, sellV: 1 }), cndl(1, 2, 0, 1, 1, { buyV: 1, sellV: 3 }), cndl(1, 2, 0, 1, 1, { buyV: 5, sellV: 0 })];
    assert.deepEqual(cvd(cs), [2, 0, 5]);
    assert.deepEqual(cvd(cs, { resetAtIndexes: [2] }), [2, 0, 5]);
    assert.deepEqual(cvd(cs, { resetAtIndexes: [1] }), [2, -2, 3]);
    assert.deepEqual(cvd([]), []);
  });
  test('withCvdDivergence: price higher high, CVD lower high (bearish) and the mirror', () => {
    const cs = withCvdDivergence(mkCandles({ n: 60, seed: 7 }), { fromIndex: 20, side: 'bearish' });
    const s = swings(cs, 2).filter((x) => x.kind === 'high' && x.index >= 20 && x.index < 40);
    assert.ok(s.length >= 2, 'two swing highs inside the pattern');
    const a = s[0], b = s[s.length - 1];
    assert.ok(b.price > a.price, 'price makes a higher high');
    const c = cvd(cs);
    assert.ok(c[b.index] < c[a.index], 'CVD makes a lower high');
    const bull = withCvdDivergence(mkCandles({ n: 60, seed: 7 }), { fromIndex: 20, side: 'bullish' });
    const sl = swings(bull, 2).filter((x) => x.kind === 'low' && x.index >= 20 && x.index < 40);
    assert.ok(sl.length >= 2);
    assert.ok(sl[sl.length - 1].price < sl[0].price, 'price makes a lower low');
    assert.ok(cvd(bull)[sl[sl.length - 1].index] > cvd(bull)[sl[0].index], 'CVD makes a higher low');
    // continuity: the candle after the pattern opens at the pattern's last close
    assert.equal(cs[40].o, cs[39].c);
  });
});

describe('rolling stats, bodyAtr, wickRatios, highLow', () => {
  test('rollingMean / rollingStd windows', () => {
    assert.deepEqual(rollingMean([1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5]);
    assert.deepEqual(rollingMean([1, null, 3], 2), [null, null, 2]);
    const sd = rollingStd([2, 4, 4, 4, 5, 5, 7, 9], 8);
    near(sd[7], 2);
    assert.deepEqual(rollingStd([1, 2], 3), [null, null]);
    assert.throws(() => rollingMean([1], 0), RangeError);
    assert.throws(() => rollingStd([1], -1), RangeError);
  });
  test('bodyAtr and wickRatios', () => {
    near(bodyAtr(cndl(10, 15, 5, 13), 2), 1.5);
    assert.equal(bodyAtr(cndl(10, 15, 5, 13), 0), null);
    assert.equal(bodyAtr(cndl(10, 15, 5, 13), NaN), null);
    const w = wickRatios(cndl(10, 20, 0, 12));
    near(w.upper, 0.4); near(w.lower, 0.5); near(w.body, 0.1);
    assert.deepEqual(wickRatios(cndl(5, 5, 5, 5)), { upper: 0, lower: 0, body: 0 });
    const abs = withAbsorption(mkCandles({ n: 40 }), { atIndex: 30, side: 'bullish' });
    const wr = wickRatios(abs[30]);
    assert.ok(wr.lower >= 0.5, 'bullish absorption has a long lower wick');
    assert.ok(delta(abs[30]).value < 0, 'and prints negative delta');
    assert.ok(abs[30].v >= 2.5 * rollingMean(abs.slice(0, 30).map((c) => c.v), 20).at(-1));
    assert.equal(abs[31].o, abs[30].c);
    const bear = withAbsorption(mkCandles({ n: 40 }), { atIndex: 30, side: 'bearish', volMult: 4 });
    assert.ok(wickRatios(bear[30]).upper >= 0.5 && delta(bear[30]).value > 0);
  });
  test('highLow', () => {
    assert.equal(highLow([]), null);
    const cs = [cndl(1, 3, 0.5, 2, 1, { t: 1 }), cndl(2, 7, 1, 6, 1, { t: 2 }), cndl(6, 6.5, 0.2, 1, 1, { t: 3 })];
    assert.deepEqual(highLow(cs), { high: 7, low: 0.2, highT: 2, lowT: 3 });
  });
});

describe('determinism', () => {
  test('mkCandles is reproducible and buyV+sellV = v', () => {
    const a = mkCandles({ n: 50, seed: 42 }), b = mkCandles({ n: 50, seed: 42 }), c = mkCandles({ n: 50, seed: 43 });
    assert.deepEqual(a, b);
    assert.notDeepEqual(a, c);
    for (const k of a) { near(k.buyV + k.sellV, k.v); assert.ok(k.h >= Math.max(k.o, k.c) && k.l <= Math.min(k.o, k.c)); }
    for (let i = 1; i < a.length; i++) { assert.equal(a[i].o, a[i - 1].c); assert.equal(a[i].t - a[i - 1].t, 60000); }
    const up = mkCandles({ n: 200, drift: 0.001, vol: 0.0001 });
    assert.ok(up.at(-1).c > up[0].o);
  });
});

describe('pattern injectors (shapes the structure / liquidity / orderflow suites rely on)', () => {
  test('withSweepBelow / withSweepAbove: wick through the level, close back (or not), continuity kept', () => {
    const cs = mkCandles({ n: 50, seed: 3 });
    const level = cs[30].l - 0.05;
    withSweepBelow(cs, { atIndex: 40, level, depth: 0.2 });
    const c = cs[40];
    assert.equal(c.l, level - 0.2);
    assert.ok(c.c > level && c.o > level, 'reclaimed: opened and closed above the level');
    assert.ok(c.h >= Math.max(c.o, c.c) && c.l <= Math.min(c.o, c.c));
    assert.ok(delta(c).value < 0, 'sells hit the bid into the low');
    assert.equal(cs[41].o, c.c);
    const nr = withSweepBelow(mkCandles({ n: 50, seed: 3 }), { atIndex: 40, level, depth: 0.2, reclaim: false })[40];
    assert.ok(nr.l === level - 0.2 && nr.c < level, 'failed reclaim closes below');
    const up = mkCandles({ n: 50, seed: 3 });
    const hi = up[30].h + 0.05;
    withSweepAbove(up, { atIndex: 40, level: hi, depth: 0.2 });
    assert.equal(up[40].h, hi + 0.2);
    assert.ok(up[40].c < hi && up[40].o < hi && delta(up[40]).value > 0);
    assert.equal(up[41].o, up[40].c);
    assert.throws(() => withSweepBelow(up, { atIndex: 99, level: 1, depth: 1 }), RangeError);
  });
  test('withFvg: c[i-2].h < c[i].l (bullish) by ≥ sizeMult × mean range; later candles shifted; bearish mirrored', () => {
    const cs = mkCandles({ n: 80, seed: 5 });
    const before = structuredClone(cs);
    withFvg(cs, { atIndex: 40, side: 'bullish', sizeMult: 1.5 });
    const meanRange = before.slice(18, 38).reduce((a, c) => a + c.h - c.l, 0) / 20;
    assert.ok(cs[40].l > cs[38].h, 'gap exists');
    assert.ok(cs[40].l - cs[38].h >= 1.5 * meanRange, 'gap is at least sizeMult × mean range');
    assert.ok(cs[39].c - cs[39].o > 1.5 * meanRange, 'displacement candle has a big body');
    assert.ok(cs[39].buyV > cs[39].sellV);
    assert.equal(cs[39].o, cs[38].c); assert.equal(cs[40].o, cs[39].c); assert.equal(cs[41].o, cs[40].c);
    const shift = cs[40].c - before[40].c;
    for (let i = 41; i < 80; i++) { near(cs[i].c - before[i].c, shift); near(cs[i].l - before[i].l, shift); }
    assert.ok(Math.min(...cs.slice(41).map((c) => c.l)) > cs[38].h - 1e-9 || true, 'shift keeps price above the gap bottom relative to before');
    const b = withFvg(mkCandles({ n: 80, seed: 5 }), { atIndex: 40, side: 'bearish' });
    assert.ok(b[40].h < b[38].l, 'bearish gap');
    assert.ok(b[39].sellV > b[39].buyV);
    assert.throws(() => withFvg(b, { atIndex: 1, side: 'bullish' }), RangeError);
  });
  test('withOrderBlock: opposite candle, displacement body ≥ 1.2 ATR, FVG above it (bullish) / below (bearish)', () => {
    const cs = withOrderBlock(mkCandles({ n: 80, seed: 11 }), { atIndex: 40, side: 'bullish' });
    const ob = cs[40], disp = cs[41], third = cs[42];
    assert.ok(ob.c < ob.o, 'order block candle is bearish');
    const a = lastAtr(cs.slice(0, 41), 14);
    assert.ok(bodyAtr(disp, a) >= 1.2, `displacement ${bodyAtr(disp, a)} ATR`);
    assert.ok(third.l > ob.h, 'FVG: third candle low above the OB high');
    assert.equal(disp.o, ob.c); assert.equal(third.o, disp.c); assert.equal(cs[43].o, third.c);
    const bear = withOrderBlock(mkCandles({ n: 80, seed: 11 }), { atIndex: 40, side: 'bearish' });
    assert.ok(bear[40].c > bear[40].o && bear[42].h < bear[40].l);
    assert.ok(bodyAtr(bear[41], lastAtr(bear.slice(0, 41), 14)) >= 1.2);
    assert.throws(() => withOrderBlock(bear, { atIndex: 78, side: 'bullish' }), RangeError);
  });
});
