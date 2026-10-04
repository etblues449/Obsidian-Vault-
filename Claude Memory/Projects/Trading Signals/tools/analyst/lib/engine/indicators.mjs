// Indicators — pure functions over arrays, no state, no clock (SPEC.md §4.2).
// Series-returning functions give an array the same length as the input with `null` until the
// indicator is warm, so index i of the output always lines up with candle i.
//
// DEVIATION: `delta(c)` returns `{ value, source: 'trades'|'proxy' }` rather than a bare number — the
//   spec says the proxy carries `source:'proxy'`, which only an object can; `deltaValue(c)` gives the number.
// DEVIATION: `wickRatios` adds `body` alongside `{upper, lower}`.
// DEVIATION (additive): `sma`, `trueRange`, `lastAtr`, `deltaValue`, `rollingStd`, `highLow` are exported
//   beyond the §4.2 list. Nothing listed in §4.2 is missing or renamed.

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Exponential moving average, SMA-seeded (standard charting-platform definition). */
export function ema(values, period) {
  if (!Number.isInteger(period) || period < 1) throw new RangeError(`ema period must be a positive integer, got ${period}`);
  const out = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let sum = 0, count = 0, prev = null;
  for (let i = 0; i < values.length; i++) {
    const v = num(values[i]);
    if (v === null) continue; // a hole does not reset the average; it is simply skipped
    if (prev === null) {
      sum += v; count++;
      if (count === period) prev = sum / period;
    } else prev = v * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function sma(values, period) { return rollingMean(values, period); }

/** True range of candle i given the previous close. */
export const trueRange = (c, prevClose) => (prevClose == null ? c.h - c.l : Math.max(c.h - c.l, Math.abs(c.h - prevClose), Math.abs(c.l - prevClose)));

/** Average true range, Wilder smoothing: first value = mean of the first `period` TRs, then ATR = (prev·(n−1) + TR)/n. */
export function atr(candles, period) {
  if (!Number.isInteger(period) || period < 1) throw new RangeError(`atr period must be a positive integer, got ${period}`);
  const out = new Array(candles.length).fill(null);
  let sum = 0, prev = null;
  for (let i = 0; i < candles.length; i++) {
    const tr = trueRange(candles[i], i ? candles[i - 1].c : null);
    if (i < period) { sum += tr; if (i === period - 1) { prev = sum / period; out[i] = prev; } }
    else { prev = (prev * (period - 1) + tr) / period; out[i] = prev; }
  }
  return out;
}

/** Last warm ATR value or null — the single number most engine rules scale by. */
export function lastAtr(candles, period) {
  const a = atr(candles, period);
  for (let i = a.length - 1; i >= 0; i--) if (a[i] !== null) return a[i];
  return null;
}

/**
 * Volume-weighted average price over typical price (h+l+c)/3.
 * `resetAt` restarts the accumulation: a function (candle, index) → boolean, or an iterable of
 * candle open times / indexes at which a new anchor starts (e.g. session opens). Zero cumulative
 * volume falls back to the typical price so the line never has holes.
 */
export function vwap(candles, { resetAt } = {}) {
  let reset = () => false;
  if (typeof resetAt === 'function') reset = resetAt;
  else if (resetAt != null) { const set = new Set(resetAt); reset = (c, i) => set.has(c.t) || set.has(i); }
  const out = new Array(candles.length).fill(null);
  let pv = 0, vol = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (i === 0 || reset(c, i)) { pv = 0; vol = 0; }
    const tp = (c.h + c.l + c.c) / 3;
    pv += tp * c.v; vol += c.v;
    out[i] = vol > 0 ? pv / vol : tp;
  }
  return out;
}

/**
 * Confirmed swing points. A swing high at i has h[i] strictly greater than the highs of the
 * `lookback` candles on EACH side (so it needs `lookback` later candles to confirm — the last
 * `lookback` candles can never be swings yet). Mirrored for lows. Sorted by index.
 * @returns {{t:number, price:number, kind:'high'|'low', index:number}[]}
 */
export function swings(candles, lookback) {
  if (!Number.isInteger(lookback) || lookback < 1) throw new RangeError(`swing lookback must be a positive integer, got ${lookback}`);
  const out = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true, isLow = true;
    for (let j = i - lookback; j <= i + lookback && (isHigh || isLow); j++) {
      if (j === i) continue;
      if (candles[j].h >= c.h) isHigh = false;
      if (candles[j].l <= c.l) isLow = false;
    }
    if (isHigh) out.push({ t: c.t, price: c.h, kind: 'high', index: i });
    if (isLow) out.push({ t: c.t, price: c.l, kind: 'low', index: i });
  }
  return out;
}

/**
 * Per-candle delta (source 05: aggressive buy volume − aggressive sell volume, "pure arithmetic").
 * With aggressor-tagged volume it is exact (`source:'trades'`); without, a body/range proxy
 * (`source:'proxy'`) so simulated/delayed feeds still get a signed estimate — never silently equal.
 * @returns {{value:number, source:'trades'|'proxy'}}
 */
export function delta(c) {
  if (c.buyV != null && c.sellV != null && Number.isFinite(c.buyV) && Number.isFinite(c.sellV)) return { value: c.buyV - c.sellV, source: 'trades' };
  return { value: ((c.c - c.o) / (c.h - c.l || 1)) * (c.v ?? 0), source: 'proxy' };
}
export const deltaValue = (c) => delta(c).value;

/**
 * Cumulative volume delta. `resetAtIndexes` (iterable of indexes) restarts the running sum at those
 * candles — source 05 sums delta "over a session", so pass session-open indexes.
 */
export function cvd(candles, { resetAtIndexes } = {}) {
  const resets = resetAtIndexes ? new Set(resetAtIndexes) : null;
  const out = new Array(candles.length).fill(null);
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    if (resets && resets.has(i)) sum = 0;
    sum += delta(candles[i]).value;
    out[i] = sum;
  }
  return out;
}

/** Rolling arithmetic mean of the last n values (null until n values seen; holes are skipped). */
export function rollingMean(values, n) {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`rollingMean window must be a positive integer, got ${n}`);
  const out = new Array(values.length).fill(null);
  const win = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const v = num(values[i]);
    if (v === null) continue;
    win.push(v); sum += v;
    if (win.length > n) sum -= win.shift();
    if (win.length === n) out[i] = sum / n;
  }
  return out;
}

/** Rolling population standard deviation over the last n values. */
export function rollingStd(values, n) {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`rollingStd window must be a positive integer, got ${n}`);
  const out = new Array(values.length).fill(null);
  const win = [];
  for (let i = 0; i < values.length; i++) {
    const v = num(values[i]);
    if (v === null) continue;
    win.push(v);
    if (win.length > n) win.shift();
    if (win.length === n) {
      const m = win.reduce((a, b) => a + b, 0) / n;
      out[i] = Math.sqrt(win.reduce((a, b) => a + (b - m) * (b - m), 0) / n);
    }
  }
  return out;
}

/** Candle body expressed in ATR multiples (null when ATR is unusable). */
export function bodyAtr(c, atrValue) {
  return atrValue > 0 && Number.isFinite(atrValue) ? Math.abs(c.c - c.o) / atrValue : null;
}

/** Upper/lower wick and body as fractions of the candle range (all 0 for a doji with no range). */
export function wickRatios(c) {
  const range = c.h - c.l;
  if (!(range > 0)) return { upper: 0, lower: 0, body: 0 };
  const top = Math.max(c.o, c.c), bottom = Math.min(c.o, c.c);
  return { upper: (c.h - top) / range, lower: (bottom - c.l) / range, body: (top - bottom) / range };
}

/** Highest high / lowest low over a candle slice — the shape liquidity levels are made of. */
export function highLow(candles) {
  if (!candles.length) return null;
  let high = -Infinity, low = Infinity, highT = null, lowT = null;
  for (const c of candles) {
    if (c.h > high) { high = c.h; highT = c.t; }
    if (c.l < low) { low = c.l; lowT = c.t; }
  }
  return { high, low, highT, lowT };
}
