// CandleStore — bounded per-timeframe candle history built from a single stream of 1-minute
// candles (SPEC.md §4.1). Pure data: every candle is a plain object, every read returns a fresh
// array. No clock in here: time comes from the candles themselves.
//
// Aggregation rules:
//   bucket(t, tf) = floor(t / TF_MS[tf]) * TF_MS[tf]   → UTC-aligned, so 4h buckets sit at 00/04/08…
//   o = first child's open, c = latest child's close, h/l = extremes, v/buyV/sellV/n = sums.
//   A higher-TF candle is `closed` once its final 1m child closed OR a child from a later bucket
//   arrived (the feed may skip the last minute — the bucket must still close).
//   Each higher-TF bucket is kept as (aggregate of CLOSED children) ⊕ (the one forming child), so a
//   forming 1m print that repeats every tick replaces its own contribution instead of double-counting,
//   and correctness never depends on how many 1m candles the ring still holds.
//   A 1m candle that arrives for an older bucket (gap re-backfill after a reconnect) is a late
//   correction: it replaces the stored 1m print and that bucket is rebuilt from its children.
//
// DEVIATION (additive): beyond §4.1 — `TFS`, `bucketStart`, `aggregate` (pure), `normalizeCandle` are
//   exported; CandleStore adds `lastClosed(tf)`, `size(tf)`, `clear()`, an optional `tfs` constructor
//   option, and `applyHistory` returns `{count}`. `maxPerTf` defaults to 3000 (= history.maxCandlesPerTf).
// DEVIATION (review finding candles.mjs:251): the FIRST higher-TF bucket of a series whose first child is
//   not its bucket start (a backfill that begins mid-bucket — with a 4320-minute backfill the first 4h
//   bucket is partial ~239/240 of the time) carries `partial: true`: its o/h/l/v describe only the
//   children we hold. `get()` still returns it (the chart may hatch it); `closed()` / `lastClosed()`
//   skip it, so ATR / bias / swings / prevCandle levels never read a truncated bar as a real one.

export const TF_MS = { '1m': 60e3, '5m': 3e5, '15m': 9e5, '1h': 36e5, '4h': 144e5 };
export const TFS = Object.keys(TF_MS);
const MIN = TF_MS['1m'];

export const bucketStart = (t, tf) => Math.floor(t / TF_MS[tf]) * TF_MS[tf];

/** Validate + copy a 1m candle into canonical numeric form. Throws on garbage — a feed bug must surface, not corrupt history. */
export function normalizeCandle(c) {
  if (!c || typeof c !== 'object') throw new TypeError('candle must be an object');
  const t = Number(c.t), o = Number(c.o), h = Number(c.h), l = Number(c.l), cl = Number(c.c), v = Number(c.v ?? 0);
  if (![t, o, h, l, cl, v].every(Number.isFinite)) throw new TypeError(`candle has non-finite fields: ${JSON.stringify(c)}`);
  if (t % MIN !== 0) throw new RangeError(`1m candle open time ${t} is not minute-aligned`);
  const out = { t, o, h: Math.max(h, o, cl), l: Math.min(l, o, cl), c: cl, v, closed: c.closed !== false };
  if (c.buyV != null && Number.isFinite(Number(c.buyV))) { out.buyV = Number(c.buyV); out.sellV = c.sellV != null && Number.isFinite(Number(c.sellV)) ? Number(c.sellV) : Math.max(0, v - out.buyV); }
  if (c.n != null && Number.isFinite(Number(c.n))) out.n = Number(c.n);
  return out;
}

/** Fold `child` into aggregate `agg` (mutates agg). Volume fields sum; buyV/sellV/n appear when any child carries them. */
function fold(agg, child) {
  if (child.h > agg.h) agg.h = child.h;
  if (child.l < agg.l) agg.l = child.l;
  agg.c = child.c;
  agg.v += child.v;
  if (child.buyV !== undefined) { agg.buyV = (agg.buyV ?? 0) + child.buyV; agg.sellV = (agg.sellV ?? 0) + (child.sellV ?? 0); }
  if (child.n !== undefined) agg.n = (agg.n ?? 0) + child.n;
  return agg;
}
function seed(child, bucketT, { partial = false } = {}) {
  const agg = { t: bucketT, o: child.o, h: child.h, l: child.l, c: child.c, v: child.v, closed: false };
  if (partial) agg.partial = true; // first child was not the bucket start: o/h/l/v are truncated
  if (child.buyV !== undefined) { agg.buyV = child.buyV; agg.sellV = child.sellV ?? 0; }
  if (child.n !== undefined) agg.n = child.n;
  return agg;
}
const isLastChild = (childT, tf) => childT + MIN === bucketStart(childT, tf) + TF_MS[tf];

/** Pure aggregation of a t-sorted 1m array into `tf` candles (backtests, tests, bucket rebuilds). */
export function aggregate(candles1m, tf) {
  if (tf === '1m') return candles1m.map((c) => ({ ...c }));
  if (!TF_MS[tf]) throw new RangeError(`unknown timeframe ${tf}`);
  const out = [];
  let cur = null;
  for (const c of candles1m) {
    const b = bucketStart(c.t, tf);
    if (cur && cur.t === b) fold(cur, c);
    else {
      if (cur) cur.closed = true; // a later bucket started
      cur = seed(c, b, { partial: !cur && c.t !== b }); // only the leading bucket can be partial (see header)
      out.push(cur);
    }
    cur.closed = c.closed && isLastChild(c.t, tf);
  }
  return out;
}

/** Binary search for candle with open time `t` in a t-sorted array. Returns index or -(insertionPoint+1). */
function findT(arr, t) {
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].t === t) return mid;
    if (arr[mid].t < t) lo = mid + 1; else hi = mid - 1;
  }
  return -(lo + 1);
}

export class CandleStore {
  /**
   * @param {object} [opts]
   * @param {number} [opts.maxPerTf=3000]  oldest candles are dropped beyond this, per timeframe
   * @param {string[]} [opts.tfs=TFS]      timeframes to maintain ('1m' is always included)
   */
  constructor({ maxPerTf = 3000, tfs = TFS } = {}) {
    if (!Number.isInteger(maxPerTf) || maxPerTf < 2) throw new RangeError(`maxPerTf must be an integer ≥ 2, got ${maxPerTf}`);
    this.maxPerTf = maxPerTf;
    this.tfs = ['1m', ...tfs.filter((tf) => tf !== '1m')];
    for (const tf of this.tfs) if (!TF_MS[tf]) throw new RangeError(`unknown timeframe ${tf}`);
    this.clear();
  }

  clear() {
    this._series = Object.fromEntries(this.tfs.map((tf) => [tf, []]));
    // Per higher TF: { bucket, closedAgg: aggregate of closed children | null, lastClosedT }
    this._open = Object.fromEntries(this.tfs.filter((tf) => tf !== '1m').map((tf) => [tf, null]));
  }

  /** Replace everything with `candles1m` (any order; duplicates by `t` collapse to the last one). */
  applyHistory(candles1m) {
    const byT = new Map();
    for (const raw of candles1m) { const c = normalizeCandle(raw); byT.set(c.t, c); }
    const sorted = [...byT.values()].sort((a, b) => a.t - b.t);
    this.clear();
    this._series['1m'] = sorted.slice(-this.maxPerTf);
    for (const tf of this.tfs) {
      if (tf === '1m') continue;
      this._series[tf] = aggregate(sorted, tf).slice(-this.maxPerTf);
      const last = this._series[tf].at(-1);
      if (last) {
        const st = { bucket: last.t, closedAgg: null, lastClosedT: -Infinity };
        for (const c of sorted) if (c.t >= last.t && c.closed) { st.closedAgg = st.closedAgg ? fold(st.closedAgg, c) : seed(c, last.t); st.lastClosedT = c.t; }
        this._open[tf] = st;
      }
    }
    return { count: this._series['1m'].length };
  }

  /**
   * Apply one 1m print (forming or closed).
   * @returns {{updated: string[], closed: string[]}} timeframes whose newest candle changed / whose candle closed on this print
   */
  applyCandle(raw) {
    const c = normalizeCandle(raw);
    const s1 = this._series['1m'];
    const updated = new Set(['1m']), closed = new Set();
    const last = s1[s1.length - 1];
    if (c.closed) closed.add('1m');
    if (!last || c.t > last.t) {
      if (last && !last.closed) {
        // The previous forming candle never got its final print (dropped message): close it as it stands.
        last.closed = true; closed.add('1m');
        this._applyChild(last, updated, closed);
      }
      s1.push(c);
      if (s1.length > this.maxPerTf) s1.shift();
      this._applyChild(c, updated, closed);
    } else if (c.t === last.t) {
      if (last.closed && !c.closed) return { updated: [], closed: [] }; // stale forming print after the close
      s1[s1.length - 1] = c;
      this._applyChild(c, updated, closed);
    } else {
      // Late correction / gap re-backfill. Older than the window → ignore.
      const idx = findT(s1, c.t);
      if (idx >= 0) s1[idx] = c;
      else if (-idx - 1 === 0 && s1.length >= this.maxPerTf) return { updated: [], closed: [] };
      else { s1.splice(-idx - 1, 0, c); if (s1.length > this.maxPerTf) s1.shift(); }
      for (const tf of this.tfs) if (tf !== '1m' && this._rebuildBucket(tf, bucketStart(c.t, tf))) updated.add(tf);
    }
    return { updated: [...updated], closed: [...closed] };
  }

  /** Fold a 1m child (in order) into every higher TF. */
  _applyChild(c, updated, closed) {
    for (const tf of this.tfs) {
      if (tf === '1m') continue;
      const series = this._series[tf];
      const b = bucketStart(c.t, tf);
      let st = this._open[tf];
      if (!st || b > st.bucket) {
        const cur = series[series.length - 1];
        if (cur && !cur.closed) { cur.closed = true; closed.add(tf); }
        st = this._open[tf] = { bucket: b, closedAgg: null, lastClosedT: -Infinity };
        series.push(seed(c, b, { partial: !series.length && c.t !== b }));
        if (series.length > this.maxPerTf) series.shift();
      } else if (b < st.bucket) { if (this._rebuildBucket(tf, b)) updated.add(tf); continue; }
      let candle;
      if (c.closed) {
        if (c.t > st.lastClosedT) { st.closedAgg = st.closedAgg ? fold(st.closedAgg, c) : seed(c, b, { partial: series.length === 1 && !!series[0].partial && series[0].t === b }); st.lastClosedT = c.t; }
        else if (!this._rebuildBucket(tf, b)) continue; // duplicate closed child we cannot re-derive: keep what we have
        candle = { ...this._open[tf].closedAgg };
      } else {
        if (c.t <= st.lastClosedT) continue; // forming print older than a closed child: stale
        candle = st.closedAgg ? fold({ ...st.closedAgg }, c) : seed(c, b);
      }
      if (c.closed && isLastChild(c.t, tf)) candle.closed = true;
      const slot = series.length && series[series.length - 1].t === b ? series[series.length - 1] : null;
      if (slot?.partial) candle.partial = true;
      if (!slot) series.push(candle); else series[series.length - 1] = candle;
      updated.add(tf);
      if (candle.closed) closed.add(tf);
    }
  }

  /**
   * Rebuild bucket `b` of `tf` from the 1m children held. Returns false (and leaves the series alone)
   * when the ring no longer holds the bucket's start, since a partial rebuild would be wrong.
   */
  _rebuildBucket(tf, b) {
    const s1 = this._series['1m'];
    if (!s1.length || s1[0].t > b) return false;
    let i = findT(s1, b);
    if (i < 0) i = -i - 1;
    const end = b + TF_MS[tf];
    let agg = null, closedAgg = null, lastClosedT = -Infinity, lastChildClosed = false;
    for (; i < s1.length && s1[i].t < end; i++) {
      const c = s1[i];
      agg = agg ? fold(agg, c) : seed(c, b);
      if (c.closed) { closedAgg = closedAgg ? fold(closedAgg, c) : seed(c, b); lastClosedT = c.t; }
      lastChildClosed = c.closed && isLastChild(c.t, tf);
    }
    if (!agg) return false;
    const series = this._series[tf];
    const idx = findT(series, b);
    const last = series[series.length - 1];
    agg.closed = lastChildClosed || (!!last && b < last.t);
    if (idx >= 0) series[idx] = agg;
    else { series.splice(-idx - 1, 0, agg); if (series.length > this.maxPerTf) series.shift(); }
    if (this._open[tf] && this._open[tf].bucket === b) this._open[tf] = { bucket: b, closedAgg, lastClosedT };
    return true;
  }

  /** Oldest → newest; the last candle may be forming. Returns a new array of the stored objects. */
  get(tf, n) {
    const s = this._series[tf];
    if (!s) throw new RangeError(`timeframe ${tf} is not maintained by this store`);
    return n === undefined ? s.slice() : s.slice(-Math.max(0, n));
  }
  /** Newest candle (forming or closed) or undefined. */
  last(tf) { const s = this.get(tf); return s[s.length - 1]; }
  /** Closed, non-partial candles only, oldest → newest (a leading partial bucket is not a real bar — see header). */
  closed(tf, n) {
    const s = this._series[tf];
    if (!s) throw new RangeError(`timeframe ${tf} is not maintained by this store`);
    const start = s.length && s[0].partial ? 1 : 0;
    const end = s.length && !s[s.length - 1].closed ? s.length - 1 : s.length;
    if (end <= start) return [];
    return n === undefined ? s.slice(start, end) : s.slice(Math.max(start, end - n), end);
  }
  lastClosed(tf) { return this.closed(tf, 1)[0]; }
  size(tf) { return this._series[tf]?.length ?? 0; }
}
