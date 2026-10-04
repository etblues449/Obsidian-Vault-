// lib/engine/structure.mjs — swings, BOS/CHoCH, fair-value gaps, order blocks, engulfing, HTF bias.
// SPEC.md §4.5. Pure functions over plain candle arrays; no clock, no state.
//
// Sources: 01 (manipulation low — the sweep happens "inside this area of imbalance in what is
// already a pretty bullish run" and "we have engulfed that previous four-hour candle"; this module
// supplies the imbalance / engulf / bias facts, czt.mjs places the stop at the manipulation low);
// 04 ("enter a trade in this order block here once price has swept liquidity").
//
// Indicators come from ./indicators.mjs (ema / atr / swings) — one implementation, one seed. (Review
//   finding structure.mjs:176: a private Wilder ATR seeded one bar later than indicators.atr disagreed
//   by 0.84 % on the fixture 1h series; the private copies are gone.) findSwings is a thin wrapper that
//   keeps the `lookback = 2` default and clamps a non-integer lookback the way the old copy did.
// Additive (not in SPEC): findFvgs/findOrderBlocks take an optional 4th arg `{ tf }` to stamp
//   Zone.tf; zones carry `mitigatedT` (and order blocks `displacementT`); isEngulfing returns
//   `{ side, bodyAtr, full } | null` rather than a bare boolean (truthiness still works);
//   marketStructure also returns the unbroken reference swings `refHigh`/`refLow`; htfBias halves
//   strength when the htf structure contradicts the bias-TF EMAs and returns an `htf` summary.

import { ema, atr, swings } from './indicators.mjs';

const SLOPE_BARS = 10;      // EMA50 slope window on the bias TF (task brief)
const OB_SEARCH_BACK = 10;  // how far back from a displacement we look for its order-block candle

/** Swing highs/lows (indicators.swings): a high is a swing high when it strictly exceeds `lookback` candles each side. */
export function findSwings(candles, lookback = 2) {
  return swings(candles, Math.max(1, lookback | 0));
}

/**
 * Walk-forward structure. `swings` must index into `candles`. A swing at index s is only
 * referenced from candle s+1 on; it cannot be closed through earlier anyway (the `lookback`
 * neighbours that confirm it are, by definition, inside its range), so there is no look-ahead.
 * BOS  = close beyond the latest swing in the trend direction (neutral counts as "with trend").
 * CHoCH = close beyond the latest counter swing; flips the trend. A broken swing is retired so one
 * level can only break once; the next swing that forms becomes the new reference.
 */
export function marketStructure(candles, swings = findSwings(candles, 2)) {
  const sorted = swings.slice().sort((a, b) => a.index - b.index);
  let trend = 'neutral', lastBos = null, lastChoch = null, refHigh = null, refLow = null, p = 0;
  for (let i = 0; i < candles.length; i++) {
    while (p < sorted.length && sorted[p].index < i) {
      const s = sorted[p++];
      if (s.kind === 'high') refHigh = s; else refLow = s;
    }
    const { c: close, t } = candles[i];
    if (refHigh && close > refHigh.price) {
      const brk = { t, price: refHigh.price, dir: 'up', swingT: refHigh.t };
      if (trend === 'bearish') lastChoch = brk; else lastBos = brk;
      trend = 'bullish'; refHigh = null;
    } else if (refLow && close < refLow.price) {
      const brk = { t, price: refLow.price, dir: 'down', swingT: refLow.t };
      if (trend === 'bullish') lastChoch = brk; else lastBos = brk;
      trend = 'bearish'; refLow = null;
    }
  }
  return { trend, lastBos, lastChoch, refHigh, refLow };
}

function mkZone(kind, side, top, bottom, t, tf) {
  return { id: `${kind}:${side}:${t}`, kind, side, top, bottom, t, tf, mitigated: false, mitigatedT: null };
}

/**
 * Scan candles[from..] against a zone: `mitigated` on the first trade into it, dropped (returns
 * false) when `invalid(c)` fires — a filled FVG or an order block that price closed through.
 */
function track(zone, candles, from, invalid) {
  const bull = zone.side === 'bullish';
  for (let j = from; j < candles.length; j++) {
    const c = candles[j];
    if (invalid(c)) return false;
    if (!zone.mitigated && (bull ? c.l <= zone.top : c.h >= zone.bottom)) { zone.mitigated = true; zone.mitigatedT = c.t; }
  }
  return true;
}

/** Fair-value gaps: bullish when c[i-2].h < c[i].l (size ≥ fvgMinSizeAtr × ATR); bearish mirrored. */
export function findFvgs(candles, atr, cfg = {}, { tf = null } = {}) {
  const out = [], n = candles.length;
  if (n < 3 || !(atr > 0)) return out;
  const minSize = (cfg.fvgMinSizeAtr ?? 0.1) * atr;
  const start = Math.max(2, n - (cfg.fvgMaxAgeCandles ?? cfg.orderBlockMaxAgeCandles ?? 200));
  for (let i = start; i < n; i++) {
    const a = candles[i - 2], m = candles[i - 1], b = candles[i];
    let z = null;
    if (b.l - a.h >= minSize) z = mkZone('fvg', 'bullish', b.l, a.h, m.t, tf);
    else if (a.l - b.h >= minSize) z = mkZone('fvg', 'bearish', a.l, b.h, m.t, tf);
    if (!z) continue;
    // A gap is gone once a wick trades through all of it ("filled"); a touch only mitigates it.
    const filled = z.side === 'bullish' ? c => c.l <= z.bottom : c => c.h >= z.top;
    if (track(z, candles, i + 1, filled)) out.push(z);
  }
  return out;
}

/**
 * Order blocks (source 04): the last opposite-coloured candle before a displacement whose body is
 * ≥ displacementBodyAtr × ATR AND which leaves an FVG (source 01 — the imbalance is what proves the
 * displacement). Bullish OB = that down-close candle's low→high. `mitigated` once a later candle
 * trades into it; dropped once a later candle CLOSES through it (a violated block is no zone).
 */
export function findOrderBlocks(candles, atr, cfg = {}, { tf = null } = {}) {
  const n = candles.length;
  if (n < 3 || !(atr > 0)) return [];
  const bodyMin = (cfg.displacementBodyAtr ?? 1.2) * atr, fvgMin = (cfg.fvgMinSizeAtr ?? 0.1) * atr;
  const start = Math.max(1, n - (cfg.orderBlockMaxAgeCandles ?? 200));
  const zones = new Map(), dead = new Set();
  for (let i = start; i < n - 1; i++) {
    const d = candles[i], body = d.c - d.o;
    if (Math.abs(body) < bodyMin) continue;
    const up = body > 0;
    const gap = up ? candles[i + 1].l - candles[i - 1].h : candles[i - 1].l - candles[i + 1].h;
    if (gap < fvgMin) continue;
    let k = -1;
    for (let j = i - 1; j >= Math.max(0, i - OB_SEARCH_BACK); j--) {
      const x = candles[j];
      if (up ? x.c < x.o : x.c > x.o) { k = j; break; }
    }
    if (k < 0 || zones.has(k) || dead.has(k)) continue;
    const ob = candles[k];
    const z = mkZone('orderBlock', up ? 'bullish' : 'bearish', ob.h, ob.l, ob.t, tf);
    z.displacementT = d.t;
    const violated = up ? c => c.c < z.bottom : c => c.c > z.top;
    if (track(z, candles, i + 1, violated)) zones.set(k, z); else dead.add(k);
  }
  return [...zones.values()];
}

/**
 * Engulfing, as source 01 uses it: the candle traded through the previous candle's body and closed
 * on the far side of it, with a body ≥ engulfingMinBodyAtr × ATR. This is a superset of the classic
 * body-engulf (open at/beyond the prior body) — in a bullish run the prior candle is often itself
 * bullish, and the manipulation candle opens near its close, sweeps its low, then closes above it.
 * `full` = the whole prior RANGE was engulfed (swept its low and closed above its high — the exact
 * source-01 picture). Returns null when not engulfing.
 */
export function isEngulfing(prev, cur, atr, cfg = {}) {
  if (!prev || !cur || !(atr > 0)) return null;
  const body = Math.abs(cur.c - cur.o);
  if (body < (cfg.engulfingMinBodyAtr ?? 0.5) * atr) return null;
  const pTop = Math.max(prev.o, prev.c), pBot = Math.min(prev.o, prev.c);
  if (cur.c > cur.o && cur.l <= pBot && cur.c >= pTop)
    return { side: 'bullish', bodyAtr: body / atr, full: cur.l <= prev.l && cur.c >= prev.h };
  if (cur.c < cur.o && cur.h >= pTop && cur.c <= pBot)
    return { side: 'bearish', bodyAtr: body / atr, full: cur.h >= prev.h && cur.c <= prev.l };
  return null;
}

/**
 * Higher-timeframe bias (source 01: "the bias is pushing us higher"). On cfg.timeframes.bias:
 * bullish when EMA50 rose over the last 10 closed bars AND EMA9 > EMA21; bearish when both are the
 * reverse; neutral otherwise. strength = clamp(|EMA9−EMA21| / ATR, 0, 1). cfg.timeframes.htf
 * structure (marketStructure) is reported in `htf` and in reasons; when it contradicts the EMA
 * direction the strength is halved — never flips the direction.
 * Needs emaBias + 10 closed bias-TF candles; until then it is honestly neutral with the reason.
 */
export function htfBias({ store, cfg }) {
  const tfs = cfg?.timeframes || {}, ind = cfg?.indicators || {};
  const biasTf = tfs.bias || '1h', htfTf = tfs.htf || '4h';
  const fast = ind.emaFast ?? 9, slow = ind.emaSlow ?? 21, long = ind.emaBias ?? 50;
  const atrP = ind.atrPeriod ?? 14, L = ind.swingLookback ?? 2;
  const reasons = [];
  const candles = store.closed(biasTf) || [];
  const n = candles.length - 1, need = long + SLOPE_BARS;
  const closes = candles.map(c => c.c);
  const e9 = ema(closes, fast), e21 = ema(closes, slow), e50 = ema(closes, long), a = atr(candles, atrP);
  const warm = n >= 0 && e50[n] != null && e50[n - SLOPE_BARS] != null && e9[n] != null && e21[n] != null && a[n] > 0;
  let dir = 'neutral', strength = 0;
  if (!warm) {
    reasons.push(`${biasTf}: need ${need} closed candles for the EMA${long} slope (have ${candles.length})`);
  } else {
    const slope = e50[n] - e50[n - SLOPE_BARS], spread = (e9[n] - e21[n]) / a[n];
    if (slope > 0 && spread > 0) dir = 'bullish'; else if (slope < 0 && spread < 0) dir = 'bearish';
    reasons.push(`${biasTf} EMA${long} ${slope > 0 ? 'rising' : slope < 0 ? 'falling' : 'flat'} over ${SLOPE_BARS} bars`);
    reasons.push(`${biasTf} EMA${fast} ${spread > 0 ? 'above' : spread < 0 ? 'below' : 'at'} EMA${slow} (${Math.abs(spread).toFixed(2)} ATR)`);
    if (dir === 'neutral') reasons.push(`${biasTf}: EMA${long} slope and EMA${fast}/${slow} disagree → neutral`);
    else { strength = clamp(Math.abs(spread), 0, 1); reasons.push(`Bias pushing ${dir === 'bullish' ? 'higher' : 'lower'} on ${biasTf}`); }
  }
  let htf = null;
  const htfCandles = store.closed(htfTf) || [];
  if (htfCandles.length > 2 * L + 1) {
    const s = marketStructure(htfCandles, findSwings(htfCandles, L));
    htf = { tf: htfTf, trend: s.trend, lastBos: s.lastBos, lastChoch: s.lastChoch };
    if (s.trend !== 'neutral') {
      const last = s.lastChoch && (!s.lastBos || s.lastChoch.t > s.lastBos.t) ? 'CHoCH' : 'BOS';
      reasons.push(`${htfTf} structure ${s.trend} (last ${last} ${s.trend === 'bullish' ? 'up' : 'down'})`);
      if (dir !== 'neutral' && s.trend !== dir) { strength *= 0.5; reasons.push(`${htfTf} structure conflicts with ${biasTf} EMAs — strength halved`); }
    }
  }
  return { dir, strength, reasons, htf };
}

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
