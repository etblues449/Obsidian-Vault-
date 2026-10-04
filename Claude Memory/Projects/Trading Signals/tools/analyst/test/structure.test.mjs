// test/structure.test.mjs — SPEC §4.5 / §8. Generators are inline (helpers.mjs is a sibling build).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSwings, marketStructure, findFvgs, findOrderBlocks, isEngulfing, htfBias } from '../lib/engine/structure.mjs';

const M5 = 3e5, H1 = 36e5, H4 = 144e5, T0 = Date.UTC(2026, 0, 13);
const CFG = { displacementBodyAtr: 1.2, fvgMinSizeAtr: 0.1, orderBlockMaxAgeCandles: 200, engulfingMinBodyAtr: 0.5 };
const STRAT = { timeframes: { bias: '1h', htf: '4h' }, indicators: { emaFast: 9, emaSlow: 21, emaBias: 50, atrPeriod: 14, swingLookback: 2 } };

const mk = (t, o, h, l, c) => ({ t, o, h, l, c, v: 1, closed: true });
/** rows = [[o,h,l,c], …] → candles spaced `ms` apart from t0. */
const series = (rows, ms = M5, t0 = T0) => rows.map((r, i) => mk(t0 + i * ms, ...r));
/** Flat candles, then override a few by index. */
function flat(n, { price = 100, wick = 0.3, patch = {} } = {}) {
  const rows = Array.from({ length: n }, () => [price, price + wick, price - wick, price]);
  for (const [i, r] of Object.entries(patch)) rows[+i] = r;
  return series(rows);
}
/** Close-to-close path → candles (o = prior close). Wicks are direction-aware so neighbouring highs/lows never tie. */
function path(closes, ms, t0 = T0, w = 0.2) {
  return closes.map((c, i) => {
    const o = i ? closes[i - 1] : c, up = c >= o;
    return mk(t0 + i * ms, o, up ? c + w : o + w / 2, up ? o - w / 2 : c - w, c);
  });
}
const store = tfs => ({ closed: (tf, n) => (n ? (tfs[tf] || []).slice(-n) : tfs[tf] || []) });

// ---- findSwings ----
test('findSwings: strict exceedance each side, kind/price/index/t, nothing on short input', () => {
  const cs = flat(9, { patch: { 4: [100, 103, 97, 100], 1: [100, 101, 99, 100] } });
  const sw = findSwings(cs, 2);
  assert.deepEqual(sw, [{ t: cs[4].t, price: 103, kind: 'high', index: 4 }, { t: cs[4].t, price: 97, kind: 'low', index: 4 }]);
  assert.deepEqual(findSwings(cs.slice(0, 4), 2), []);
  // an equal neighbour high is NOT exceeded → not a swing
  const eq = flat(9, { patch: { 4: [100, 103, 99.7, 100], 5: [100, 103, 99.7, 100] } });
  assert.equal(findSwings(eq, 2).filter(s => s.kind === 'high').length, 0);
});

// ---- marketStructure ----
test('marketStructure: BOS up on close above swing high, CHoCH down on close below swing low', () => {
  // swing low 90 @2, swing high 101 @6, higher low 95 @10, close 102 @13 (BOS up), close 94 @15 (CHoCH down)
  const cs = flat(16, { patch: {
    2: [100, 100.3, 90, 100], 6: [100, 101, 99.7, 100], 10: [100, 100.3, 95, 100], 13: [100, 102.5, 99.7, 102], 15: [100, 100.3, 93.5, 94],
  } });
  const s = marketStructure(cs, findSwings(cs, 2));
  assert.equal(s.trend, 'bearish');
  assert.deepEqual(s.lastBos, { t: cs[13].t, price: 101, dir: 'up', swingT: cs[6].t });
  assert.deepEqual(s.lastChoch, { t: cs[15].t, price: 95, dir: 'down', swingT: cs[10].t });
});

test('marketStructure: no break → neutral with nulls; a retired swing cannot break twice', () => {
  const cs = flat(12, { patch: { 3: [100, 102, 99.7, 100], 8: [100, 100.3, 98, 100] } });
  assert.deepEqual(marketStructure(cs, findSwings(cs, 2)), { trend: 'neutral', lastBos: null, lastChoch: null, refHigh: findSwings(cs, 2)[0], refLow: findSwings(cs, 2)[1] });
  const up = flat(14, { patch: { 3: [100, 102, 99.7, 100], 7: [100, 103, 99.7, 102.5], 8: [102.5, 103.5, 102, 103] } });
  const s = marketStructure(up, findSwings(up, 2));
  assert.equal(s.trend, 'bullish');
  assert.equal(s.lastBos.t, up[7].t, 'first close beyond breaks; the next higher close does not re-fire');
  assert.equal(s.refHigh.index, 8, 'the next swing high that forms becomes the new reference');
});

// ---- findFvgs ----
test('findFvgs: bullish gap c[i-2].h < c[i].l, mitigated on touch, dropped when filled, min size', () => {
  const cs = series([[100, 100.5, 99.5, 100], [100, 103, 99.8, 102.8], [102.8, 104, 101.2, 103.5], [103.5, 104, 103, 103.8]]);
  const z = findFvgs(cs, 1, CFG, { tf: '5m' });
  assert.equal(z.length, 1);
  assert.deepEqual(z[0], { id: `fvg:bullish:${cs[1].t}`, kind: 'fvg', side: 'bullish', top: 101.2, bottom: 100.5, t: cs[1].t, tf: '5m', mitigated: false, mitigatedT: null });
  const touched = [...cs, mk(T0 + 4 * M5, 103.8, 104, 101.0, 103)];
  assert.equal(findFvgs(touched, 1, CFG)[0].mitigated, true);
  assert.equal(findFvgs(touched, 1, CFG)[0].mitigatedT, touched[4].t);
  const filled = [...cs, mk(T0 + 4 * M5, 103.8, 104, 100.4, 103)];
  assert.deepEqual(findFvgs(filled, 1, CFG), [], 'wick through the whole gap = filled = gone');
  assert.deepEqual(findFvgs(cs, 10, CFG), [], 'gap 0.7 < 0.1 × ATR 10');
});

test('findFvgs: bearish gap c[i-2].l > c[i].h and ATR guard', () => {
  const cs = series([[100, 100.5, 99.5, 100], [100, 100.2, 97, 97.2], [97.2, 98.8, 96, 96.5]]);
  const z = findFvgs(cs, 1, CFG);
  assert.equal(z.length, 1);
  assert.equal(z[0].side, 'bearish'); assert.equal(z[0].top, 99.5); assert.equal(z[0].bottom, 98.8);
  assert.deepEqual(findFvgs(cs, 0, CFG), []);
  assert.deepEqual(findFvgs(cs, NaN, CFG), []);
});

// ---- findOrderBlocks ----
test('findOrderBlocks: last down-close before an up displacement that leaves an FVG → low→high zone', () => {
  const cs = series([
    [100, 100.5, 99.5, 100],
    [100, 100.4, 99.2, 99.4],      // 1: the order block (down close)
    [99.4, 99.9, 99.3, 99.8],      // 2: small up candle in between — OB search must skip it
    [99.8, 102.2, 99.7, 102.0],    // 3: displacement, body 2.2 ≥ 1.2 × ATR 1
    [102.0, 103, 101.0, 102.5],    // 4: low 101.0 > c[2].h 99.9 → FVG left behind
    [102.5, 103, 102, 102.8],
  ]);
  const z = findOrderBlocks(cs, 1, CFG, { tf: '5m' });
  assert.equal(z.length, 1);
  assert.equal(z[0].kind, 'orderBlock'); assert.equal(z[0].side, 'bullish');
  assert.equal(z[0].top, 100.4); assert.equal(z[0].bottom, 99.2); assert.equal(z[0].t, cs[1].t);
  assert.equal(z[0].displacementT, cs[3].t); assert.equal(z[0].mitigated, false); assert.equal(z[0].tf, '5m');
  const touched = [...cs, mk(T0 + 6 * M5, 102.8, 103, 100.3, 101)];
  assert.equal(findOrderBlocks(touched, 1, CFG)[0].mitigated, true);
  const violated = [...cs, mk(T0 + 6 * M5, 102.8, 103, 98.5, 99.0)];
  assert.deepEqual(findOrderBlocks(violated, 1, CFG), [], 'a close through the block retires it');
});

test('findOrderBlocks: no FVG or a small body → no block; bearish mirrored', () => {
  const noFvg = series([[100, 100.5, 99.5, 100], [100, 100.4, 99.2, 99.4], [99.4, 102.2, 99.3, 102.0], [102.0, 103, 100.2, 102.5]]);
  assert.deepEqual(findOrderBlocks(noFvg, 1, CFG), [], 'c[3].l 100.2 < c[1].h 100.4 → no gap');
  const small = series([[100, 100.5, 99.5, 100], [100, 100.4, 99.2, 99.4], [99.4, 100.5, 99.3, 100.4], [100.4, 103, 101.0, 102.5]]);
  assert.deepEqual(findOrderBlocks(small, 1, CFG), [], 'body 1.0 < 1.2 ATR');
  const bear = series([[100, 100.5, 99.5, 100], [100, 100.8, 99.6, 100.6], [100.6, 100.7, 98.4, 98.6], [98.6, 99.4, 97.5, 98.0]]);
  const z = findOrderBlocks(bear, 1, CFG);
  assert.equal(z.length, 1); assert.equal(z[0].side, 'bearish'); assert.equal(z[0].top, 100.8); assert.equal(z[0].bottom, 99.6);
});

// ---- isEngulfing ----
test('isEngulfing: classic body engulf, source-01 full engulf after a bullish prior candle, rejections', () => {
  const prevRed = mk(T0, 101, 102.5, 99.8, 100);
  const classic = mk(T0 + M5, 99.9, 102, 99.7, 101.5);
  const cl = isEngulfing(prevRed, classic, 1, CFG);
  assert.equal(cl.side, 'bullish'); assert.ok(Math.abs(cl.bodyAtr - 1.6) < 1e-9);
  assert.equal(cl.full, false, 'closed above the prior body but not above its high');
  // source 01: prior 4H candle is itself bullish; the manipulation candle sweeps its low and closes above its high
  const prevGreen = mk(T0, 100, 101.5, 99.5, 101);
  const manip = mk(T0 + M5, 101, 102.5, 99.0, 102.2);
  const e = isEngulfing(prevGreen, manip, 1, CFG);
  assert.equal(e.side, 'bullish'); assert.equal(e.full, true); assert.ok(Math.abs(e.bodyAtr - 1.2) < 1e-9);
  assert.equal(isEngulfing(prevRed, mk(T0 + M5, 99.9, 100.5, 99.7, 100.2), 1, CFG), null, 'body 0.3 < 0.5 ATR');
  assert.equal(isEngulfing(prevRed, mk(T0 + M5, 100.2, 101.5, 100.1, 100.9), 1, CFG), null, 'never traded below prior body');
  assert.equal(isEngulfing(null, classic, 1, CFG), null);
  assert.equal(isEngulfing(prevRed, classic, 0, CFG), null);
  const bear = isEngulfing(mk(T0, 100, 101.2, 98.0, 101), mk(T0 + M5, 101.1, 101.5, 98.5, 99.0), 1, CFG);
  assert.equal(bear.side, 'bearish'); assert.ok(Math.abs(bear.bodyAtr - 2.1) < 1e-9);
  assert.equal(bear.full, false, 'closed below the prior body but not below its low');
  const bearFull = isEngulfing(mk(T0, 100, 101.2, 99.8, 101), mk(T0 + M5, 101.1, 101.5, 98.5, 99.0), 1, CFG);
  assert.equal(bearFull.full, true);
});

// ---- htfBias ----
test('htfBias: rising 1h EMAs → bullish with clamped strength and the reasons that fired', () => {
  const h1 = path(Array.from({ length: 70 }, (_, i) => 100 + i * 0.5), H1);
  const b = htfBias({ store: store({ '1h': h1 }), cfg: STRAT });
  assert.equal(b.dir, 'bullish');
  assert.ok(b.strength > 0 && b.strength <= 1);
  assert.ok(b.reasons.some(r => /1h EMA50 rising over 10 bars/.test(r)), b.reasons.join(' | '));
  assert.ok(b.reasons.some(r => /1h EMA9 above EMA21/.test(r)));
  assert.equal(b.htf, null, 'no 4h candles → no structure claim');
});

test('htfBias: falling → bearish; too little history → neutral, says so; disagreement → neutral', () => {
  const down = path(Array.from({ length: 70 }, (_, i) => 200 - i * 0.5), H1);
  assert.equal(htfBias({ store: store({ '1h': down }), cfg: STRAT }).dir, 'bearish');
  const short = htfBias({ store: store({ '1h': down.slice(0, 48) }), cfg: STRAT });
  assert.equal(short.dir, 'neutral'); assert.equal(short.strength, 0);
  assert.match(short.reasons[0], /need 60 closed candles .* \(have 48\)/);
  // long uptrend then a 10-bar dip: EMA50 still rising (price above it), EMA9 below EMA21 → neutral
  const mixed = path([...Array.from({ length: 60 }, (_, i) => 100 + i * 0.5), ...Array.from({ length: 10 }, (_, i) => 129 - i)], H1);
  const m = htfBias({ store: store({ '1h': mixed }), cfg: STRAT });
  assert.equal(m.dir, 'neutral');
  assert.ok(m.reasons.some(r => /disagree/.test(r)));
  assert.equal(htfBias({ store: store({}), cfg: STRAT }).dir, 'neutral');
});

test('htfBias: 4h structure is reported; a conflicting 4h trend halves strength, an agreeing one does not', () => {
  const h1 = path(Array.from({ length: 70 }, (_, i) => 100 + i * 0.5), H1);
  const zig = (dir, n) => Array.from({ length: n }, (_, i) => 150 + dir * i * 1.5 + 4 * Math.sin((i * Math.PI) / 3));
  const bear4h = path(zig(-1, 48), H4), bull4h = path(zig(1, 48), H4);
  const agree = htfBias({ store: store({ '1h': h1, '4h': bull4h }), cfg: STRAT });
  const conflict = htfBias({ store: store({ '1h': h1, '4h': bear4h }), cfg: STRAT });
  assert.equal(agree.htf.trend, 'bullish'); assert.equal(conflict.htf.trend, 'bearish');
  assert.equal(agree.htf.tf, '4h'); assert.ok(conflict.htf.lastBos && conflict.htf.lastBos.dir === 'down');
  assert.equal(conflict.strength, agree.strength / 2);
  assert.equal(conflict.dir, 'bullish', 'htf conflict never flips the direction');
  assert.ok(conflict.reasons.some(r => /4h structure conflicts/.test(r)));
  assert.ok(agree.reasons.some(r => /4h structure bullish/.test(r)));
});
