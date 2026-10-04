// lib/engine/footprint.mjs — Footprint (bid × ask) charts, diagonal imbalances, stacked imbalances,
// unfinished auctions and trapped traders (SPEC-PRO.md §P1; source 05 §3 "Footprint (Bid × Ask) Charts"
// and §4 "Trapped Traders" are the authority).
//
//   A footprint unpacks a candle into price levels. Per level (source 05 §3):
//     bid = volume executed at the BID  → the SELLER aggressed (hit the bid)   → trade.side === 'sell'
//     ask = volume executed at the ASK  → the BUYER aggressed (lifted the ask) → trade.side === 'buy'
//     delta = ask − bid ("aggressive market buy volume − aggressive market sell volume", §3)
//   Diagonal imbalance (§3 "aggressive volume diagonally exceeds opposing volume by a set ratio,
//   typically 300 %–400 %"): buy imbalance at P when ask(P) ≥ ratio × bid(P − bucket) and ask(P) > 0;
//   sell imbalance at P when bid(P) ≥ ratio × ask(P + bucket) and bid(P) > 0. A ZERO opposite cell with a
//   non-zero cell counts (ratio = Infinity, flagged `infinite: true`).
//   Stacked = ≥ stackedMin consecutive levels with same-side imbalances.
//   Unfinished auction (§3 "the high or low of a bar printed volume on both sides without a clean 0 bid or
//   ask print, signalling the market may revisit that price to complete business"): both bid > 0 and
//   ask > 0 at the candle's extreme level.
//   Trapped traders (§4): "a trapped buyer's stop loss is a market sell order" — bearish when a previous
//   candle carries a stacked BUY imbalance in its upper third and the last closed candle closes BELOW the
//   lowest of those levels (the aggressive buyers are offside); bullish mirrored.
//
// Price arithmetic is done in INTEGER TICKS (Math.round(p / tick)); level prices are reconstituted with
// toFixed(decimals-of-tick) so 1.15 / 0.01 can never floor to 114 and level prices never carry float drift.
// Pure functions + one small stateful FootprintBuilder (O(1) per trade, bounded to maxCandles candles).
// No wall clock anywhere: the builder buckets by trade.t; nothing reads Date.now().
//
// DEVIATION: Footprint carries additive `open`/`close` (first/last trade price), `total`, `tick`, `partial`
//   and `truncated` — §P1's shape has no close, yet trappedTraders is defined on "the last closed candle
//   CLOSES below"; the close has to travel with the footprint.
// DEVIATION: a diagonal neighbour OUTSIDE the footprint's level range is "not comparable" (no imbalance at
//   the lowest level for buys / the highest for sells). Treating the missing neighbour as 0 would print a
//   phantom imbalance at almost every bar extreme; a zero cell INSIDE the range still counts (§P1).
// DEVIATION: POC ties resolve to the level nearest the candle's mid-range (lower on an exact tie) — §P1 says
//   only "level with max total".
// DEVIATION: `trappedTraders` looks back up to `lookback` closed candles BEFORE the last one (k = 1 … lookback)
//   for the stacked imbalance, nearest first; §P1 names "the previous candle" and a lookback of 2 together.
// DEVIATION: with cfg absent the module falls back to the §P5 defaults (bucketAtr 0.05, imbalanceRatio 3,
//   stackedMin 3, maxCandles 48) — the `footprint` config block lands with the P5 builder.

import { TF_MS } from './candles.mjs';

export const FOOTPRINT_DEFAULTS = Object.freeze({ bucketAtr: 0.05, imbalanceRatio: 3.0, stackedMin: 3, maxCandles: 48, backfillMaxRequests: 40 });
const MAX_LEVELS = 5000;   // a contiguous ladder wider than this is emitted sparse + `truncated: true` (never OOM on a bad print)
const EPS = 1e-9;

/** cfg.footprint merged over the §P5 defaults (plain object, never the caller's). */
export function footprintConfig(cfg) {
  const fp = cfg?.footprint ?? {};
  const out = { ...FOOTPRINT_DEFAULTS };
  for (const k of Object.keys(FOOTPRINT_DEFAULTS)) if (Number.isFinite(fp[k]) && fp[k] > 0) out[k] = fp[k];
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Integer-tick price arithmetic
// ---------------------------------------------------------------------------------------------------------

/** Number of decimals needed to print `tick` exactly (handles 1e-7 style). Capped at 10. */
export function decimalsOf(tick) {
  const s = String(tick);
  const e = s.indexOf('e-');
  if (e >= 0) {
    const mant = s.slice(0, e), dot = mant.indexOf('.');
    return Math.min(10, Number(s.slice(e + 2)) + (dot >= 0 ? mant.length - dot - 1 : 0));
  }
  const dot = s.indexOf('.');
  return dot < 0 ? 0 : Math.min(10, s.length - dot - 1);
}

const checkTick = (tick) => { if (!(Number.isFinite(tick) && tick > 0)) throw new RangeError(`footprint: tick must be > 0, got ${tick}`); return tick; };
/** Price → integer ticks (nearest). */
export const toTicks = (p, tick) => Math.round(p / tick);
/** Integer ticks → price, printed exactly (no drift). */
export const fromTicks = (ticks, tick, dec = decimalsOf(tick)) => Number((ticks * tick).toFixed(dec));
/** Bucket size in whole ticks (≥ 1). */
export const bucketTicks = (bucket, tick) => Math.max(1, Math.round(bucket / tick));
/** Level price for a trade price: floor(p / bucket) × bucket, computed in ticks. */
export function levelPrice(p, bucket, tick) {
  checkTick(tick);
  const bt = bucketTicks(bucket, tick);
  return fromTicks(Math.floor(toTicks(p, tick) / bt) * bt, tick);
}

/** §P1: bucket = max(tick, round(atr × bucketAtr / tick) × tick), snapped to tick. */
export function bucketFor(atr, tick, cfg) {
  checkTick(tick);
  const { bucketAtr } = footprintConfig(cfg);
  if (!(Number.isFinite(atr) && atr > 0)) return fromTicks(1, tick);
  const n = Math.max(1, Math.round((atr * bucketAtr) / tick));
  return fromTicks(n, tick);
}

const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString('en-GB', { maximumFractionDigits: 2 }) : String(n));

// ---------------------------------------------------------------------------------------------------------
// Accumulation state (shared by buildFootprint and the builder) — O(1) per trade
// ---------------------------------------------------------------------------------------------------------

function newState({ t, tf, bucket, tick }) {
  return {
    t, tf, bucket, tick, bt: bucketTicks(bucket, tick), dec: decimalsOf(tick),
    cells: new Map(),            // level index → { bid, ask, n }
    minIdx: Infinity, maxIdx: -Infinity,
    totalBid: 0, totalAsk: 0, n: 0,
    open: null, close: null, high: -Infinity, low: Infinity,
    closed: false, dirty: true, fp: null, partial: false,
  };
}

function applyTrade(st, trade) {
  const p = +trade.p, q = +trade.q;
  if (!(Number.isFinite(p) && Number.isFinite(q) && q >= 0)) return false;
  const idx = Math.floor(toTicks(p, st.tick) / st.bt);
  let cell = st.cells.get(idx);
  if (!cell) { cell = { bid: 0, ask: 0, n: 0 }; st.cells.set(idx, cell); }
  if (trade.side === 'sell') { cell.bid += q; st.totalBid += q; } else { cell.ask += q; st.totalAsk += q; }
  cell.n++; st.n++;
  if (idx < st.minIdx) st.minIdx = idx;
  if (idx > st.maxIdx) st.maxIdx = idx;
  if (st.open === null) st.open = p;
  st.close = p;
  if (p > st.high) st.high = p;
  if (p < st.low) st.low = p;
  st.dirty = true;
  return true;
}

/** Index of the level that would hold price `p` (used to stretch the ladder to a candle's high/low). */
const idxOf = (p, st) => Math.floor(toTicks(p, st.tick) / st.bt);

/** Materialise a Footprint from an accumulation state. O(levels). */
function finalize(st, { high, low, imbalanceRatio, stackedMin } = {}) {
  let minIdx = st.minIdx, maxIdx = st.maxIdx;
  if (Number.isFinite(high)) maxIdx = Math.max(maxIdx, idxOf(high, st));
  if (Number.isFinite(low)) minIdx = Math.min(minIdx, idxOf(low, st));
  const levels = [];
  let truncated = false;
  if (st.n > 0 || Number.isFinite(minIdx)) {
    if (maxIdx - minIdx + 1 > MAX_LEVELS) {
      truncated = true;
      for (const idx of [...st.cells.keys()].sort((a, b) => a - b)) {
        const c = st.cells.get(idx);
        levels.push({ idx, price: fromTicks(idx * st.bt, st.tick, st.dec), bid: c.bid, ask: c.ask, delta: c.ask - c.bid, total: c.bid + c.ask, n: c.n });
      }
    } else {
      for (let idx = minIdx; idx <= maxIdx; idx++) {
        const c = st.cells.get(idx);
        const bid = c ? c.bid : 0, ask = c ? c.ask : 0;
        levels.push({ idx, price: fromTicks(idx * st.bt, st.tick, st.dec), bid, ask, delta: ask - bid, total: bid + ask, n: c ? c.n : 0 });
      }
    }
  }
  const hi = Number.isFinite(high) ? Math.max(high, st.high) : st.high;
  const lo = Number.isFinite(low) ? Math.min(low, st.low) : st.low;

  // POC: max total; ties → nearest the mid-range (lower on an exact tie).
  let poc = null, pocTotal = -1, pocDist = Infinity;
  const mid = levels.length ? (levels[0].price + levels[levels.length - 1].price) / 2 : 0;
  for (const l of levels) {
    const d = Math.abs(l.price - mid);
    if (l.total > pocTotal + EPS || (Math.abs(l.total - pocTotal) <= EPS && d < pocDist - EPS)) { poc = l.price; pocTotal = l.total; pocDist = d; }
  }
  if (pocTotal <= 0) poc = null;

  // Diagonal imbalances (source 05 §3). Contiguous or sparse, neighbours are found by idx.
  const byIdx = new Map(levels.map((l) => [l.idx, l]));
  const imbalances = [];
  const ratio = imbalanceRatio;
  const imbAt = new Map(); // idx → side
  for (const l of levels) {
    const below = byIdx.get(l.idx - 1), above = byIdx.get(l.idx + 1);
    if (below && l.ask > 0 && (below.bid <= 0 || l.ask >= ratio * below.bid - EPS)) {
      const r = below.bid > 0 ? l.ask / below.bid : Infinity;
      imbalances.push(r === Infinity ? { price: l.price, side: 'buy', ratio: Infinity, infinite: true } : { price: l.price, side: 'buy', ratio: r });
      imbAt.set(l.idx, (imbAt.get(l.idx) ? 'both' : 'buy'));
    }
    if (above && l.bid > 0 && (above.ask <= 0 || l.bid >= ratio * above.ask - EPS)) {
      const r = above.ask > 0 ? l.bid / above.ask : Infinity;
      imbalances.push(r === Infinity ? { price: l.price, side: 'sell', ratio: Infinity, infinite: true } : { price: l.price, side: 'sell', ratio: r });
      imbAt.set(l.idx, (imbAt.get(l.idx) ? 'both' : 'sell'));
    }
  }

  // Stacked: ≥ stackedMin consecutive levels (by idx) carrying a same-side imbalance.
  const stacked = [];
  for (const side of ['buy', 'sell']) {
    let run = null;
    for (const l of levels) {
      const s = imbAt.get(l.idx);
      const hit = s === side || s === 'both';
      if (hit && run && l.idx === run.toIdx + 1) { run.toIdx = l.idx; run.to = l.price; run.count++; }
      else if (hit) { if (run && run.count >= stackedMin) stacked.push(strip(run)); run = { side, from: l.price, to: l.price, fromIdx: l.idx, toIdx: l.idx, count: 1 }; }
      else { if (run && run.count >= stackedMin) stacked.push(strip(run)); run = null; }
    }
    if (run && run.count >= stackedMin) stacked.push(strip(run));
  }
  stacked.sort((a, b) => a.from - b.from);

  const top = levels.length ? levels[levels.length - 1] : null, bottom = levels.length ? levels[0] : null;
  const unfinishedHigh = !!(top && top.bid > 0 && top.ask > 0);
  const unfinishedLow = !!(bottom && bottom.bid > 0 && bottom.ask > 0);

  return {
    t: st.t, tf: st.tf, bucket: st.bucket, tick: st.tick,
    open: st.open, close: st.close,
    high: Number.isFinite(hi) ? hi : null, low: Number.isFinite(lo) ? lo : null,
    totalBid: st.totalBid, totalAsk: st.totalAsk, total: st.totalBid + st.totalAsk, delta: st.totalAsk - st.totalBid,
    poc, levels: levels.map(({ idx, ...l }) => l), imbalances, stacked, unfinishedHigh, unfinishedLow,
    nTrades: st.n, partial: st.partial, truncated,
  };
}
const strip = ({ side, from, to, count }) => ({ side, from, to, count });

// ---------------------------------------------------------------------------------------------------------
// Pure API
// ---------------------------------------------------------------------------------------------------------

/**
 * Build one Footprint from a candle's trades (any order; `open`/`close` follow trade order as given, so
 * pass them oldest→newest). `high`/`low` (the candle's) stretch the ladder so empty extreme levels appear.
 * @param {Trade[]} trades  @param {{t:number, tf:string, bucket:number, tick:number, high?:number, low?:number, cfg?:object, imbalanceRatio?:number, stackedMin?:number}} opts
 */
export function buildFootprint(trades, opts = {}) {
  const { t = null, tf = null, tick, high, low, cfg } = opts;
  checkTick(tick);
  const fcfg = footprintConfig(cfg);
  const bucket = Number.isFinite(opts.bucket) && opts.bucket > 0 ? fromTicks(bucketTicks(opts.bucket, tick), tick) : fromTicks(1, tick);
  const st = newState({ t, tf, bucket, tick });
  if (opts.partial) st.partial = true;
  for (const tr of trades ?? []) applyTrade(st, tr);
  return finalize(st, { high, low, imbalanceRatio: opts.imbalanceRatio ?? fcfg.imbalanceRatio, stackedMin: opts.stackedMin ?? fcfg.stackedMin });
}

/** JSON-safe copy: Infinity ratios → null (`infinite: true` already marks them). */
export function serializeFootprint(fp) {
  if (!fp) return fp;
  return { ...fp, imbalances: fp.imbalances.map((i) => (i.ratio === Infinity ? { ...i, ratio: null, infinite: true } : { ...i })) };
}

/**
 * Trapped traders (source 05 §4). `footprints` = closed footprints oldest→newest.
 * @returns {{side:'bullish'|'bearish', t:number, at:number, levels:number[], edge:number, close:number, reason:string}|null}
 */
export function trappedTraders(footprints, { lookback = 2 } = {}) {
  const n = footprints?.length ?? 0;
  if (n < 2) return null;
  const last = footprints[n - 1];
  if (!last || !Number.isFinite(last.close)) return null;
  for (let k = 1; k <= lookback && n - 1 - k >= 0; k++) {
    const prev = footprints[n - 1 - k];
    if (!prev?.levels?.length || !prev.stacked?.length) continue;
    const lo = prev.levels[0].price, hi = prev.levels[prev.levels.length - 1].price, span = hi - lo;
    const upperThird = lo + (span * 2) / 3, lowerThird = lo + span / 3;
    const buyRuns = prev.stacked.filter((s) => s.side === 'buy' && s.from >= upperThird - EPS);
    if (buyRuns.length) {
      const edge = Math.min(...buyRuns.map((s) => s.from)), top = Math.max(...buyRuns.map((s) => s.to));
      if (last.close < edge) {
        const levels = prev.levels.filter((l) => buyRuns.some((s) => l.price >= s.from - EPS && l.price <= s.to + EPS)).map((l) => l.price);
        return { side: 'bearish', t: last.t, at: prev.t, levels, edge, close: last.close,
          reason: `Trapped buyers: stacked buy imbalances at ${fmt(edge)}–${fmt(top)} then a close below (${fmt(last.close)}) — their stops are market sells` };
      }
    }
    const sellRuns = prev.stacked.filter((s) => s.side === 'sell' && s.to <= lowerThird + EPS);
    if (sellRuns.length) {
      const edge = Math.max(...sellRuns.map((s) => s.to)), bottom = Math.min(...sellRuns.map((s) => s.from));
      if (last.close > edge) {
        const levels = prev.levels.filter((l) => sellRuns.some((s) => l.price >= s.from - EPS && l.price <= s.to + EPS)).map((l) => l.price);
        return { side: 'bullish', t: last.t, at: prev.t, levels, edge, close: last.close,
          reason: `Trapped sellers: stacked sell imbalances at ${fmt(bottom)}–${fmt(edge)} then a close above (${fmt(last.close)}) — their stops are market buys` };
      }
    }
  }
  return null;
}

/**
 * Helpers czt uses. `side` 'long'|'short' (or 'bullish'|'bearish'); `zone` = {top,bottom} | {price} | Level.
 * unfinishedToward = the extreme in the trade's direction is unfinished (a target-side magnet, §P5).
 */
export function summarizeForCzt(fp, { side, zone = null, tolerance = 0 } = {}) {
  const long = side === 'long' || side === 'bullish';
  const out = { stackedToward: false, stackedAgainst: false, unfinishedToward: false, pocNearZone: false };
  if (!fp) return out;
  const toward = long ? 'buy' : 'sell', against = long ? 'sell' : 'buy';
  out.stackedToward = (fp.stacked ?? []).some((s) => s.side === toward);
  out.stackedAgainst = (fp.stacked ?? []).some((s) => s.side === against);
  out.unfinishedToward = long ? !!fp.unfinishedHigh : !!fp.unfinishedLow;
  if (zone && Number.isFinite(fp.poc)) {
    const top = Number.isFinite(zone.top) ? zone.top : zone.price, bottom = Number.isFinite(zone.bottom) ? zone.bottom : zone.price;
    if (Number.isFinite(top) && Number.isFinite(bottom)) out.pocNearZone = fp.poc >= Math.min(top, bottom) - tolerance - EPS && fp.poc <= Math.max(top, bottom) + tolerance + EPS;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Stateful builder
// ---------------------------------------------------------------------------------------------------------

/**
 * Incremental footprint builder: O(1) per trade, memory bounded to maxCandles (+ the forming candle).
 * Trades are bucketed by floor(t / TF_MS[tf]); a trade older than the forming candle is applied to that
 * candle if its cells are still held (the closed footprint is re-finalised lazily), else dropped.
 */
export class FootprintBuilder {
  /** @param {{tf:string, tick:number, bucket?:number, maxCandles?:number, cfg?:object}} o */
  constructor({ tf, tick, bucket, maxCandles, cfg } = {}) {
    if (!TF_MS[tf]) throw new RangeError(`FootprintBuilder: unknown timeframe ${tf}`);
    checkTick(tick);
    this.cfg = footprintConfig(cfg);
    this.tf = tf; this.tfMs = TF_MS[tf]; this.tick = tick;
    this.bucket = Number.isFinite(bucket) && bucket > 0 ? fromTicks(bucketTicks(bucket, tick), tick) : fromTicks(1, tick);
    this.nextBucket = null;
    this.maxCandles = Number.isInteger(maxCandles) && maxCandles > 0 ? maxCandles : this.cfg.maxCandles;
    this._states = new Map();   // bucketStart → state
    this._order = [];           // held bucketStarts, ascending
    this._currentT = null;      // bucketStart of the forming candle (null after it closes)
    this.dropped = 0;           // late trades for candles no longer held
    this.partialBefore = -Infinity; // candles opening before this were built from incomplete history
  }

  get size() { return this._states.size; }
  bucketStart(t) { return Math.floor(t / this.tfMs) * this.tfMs; }

  /** Bucket change applies from the NEXT candle (the forming one keeps its ladder). */
  setBucket(bucket) {
    if (!(Number.isFinite(bucket) && bucket > 0)) return;
    this.nextBucket = fromTicks(bucketTicks(bucket, this.tick), this.tick);
  }

  /** Footprints whose candle opens before `tMs` are flagged `partial` (built from a truncated backfill). */
  markPartialBefore(tMs) {
    this.partialBefore = Number.isFinite(tMs) ? tMs : -Infinity;
    for (const st of this._states.values()) { const p = st.t < this.partialBefore; if (p !== st.partial) { st.partial = p; st.dirty = true; } }
  }

  _start(b) {
    if (this.nextBucket !== null) { this.bucket = this.nextBucket; this.nextBucket = null; }
    const st = newState({ t: b, tf: this.tf, bucket: this.bucket, tick: this.tick });
    st.partial = b < this.partialBefore;
    this._states.set(b, st);
    // keep _order ascending (a candle opened by closeCandle() for an empty bucket may be out of order)
    if (!this._order.length || b > this._order[this._order.length - 1]) this._order.push(b);
    else { this._order.push(b); this._order.sort((x, y) => x - y); }
    this._prune();
    return st;
  }

  _prune() {
    const cap = this.maxCandles + 1; // closed ring + the forming candle
    while (this._order.length > cap) { const old = this._order.shift(); this._states.delete(old); if (old === this._currentT) this._currentT = null; }
  }

  /** @returns {boolean} true when the trade landed in a held candle. */
  addTrade(trade) {
    const t = +trade?.t;
    if (!Number.isFinite(t)) return false;
    const b = this.bucketStart(t);
    let st = this._states.get(b);
    if (!st) {
      const newest = this._order.length ? this._order[this._order.length - 1] : -Infinity;
      if (b < newest) { this.dropped++; return false; }   // older than everything held → dropped
      st = this._start(b);
      this._currentT = b;
    }
    return applyTrade(st, trade);
  }

  /** Close (finalise) the candle opening at `tOpen`. A bucket without trades yields an empty footprint. */
  closeCandle(tOpen) {
    const b = this.bucketStart(+tOpen);
    let st = this._states.get(b);
    if (!st) {
      const newest = this._order.length ? this._order[this._order.length - 1] : -Infinity;
      if (b < newest - this.maxCandles * this.tfMs) return finalize(newState({ t: b, tf: this.tf, bucket: this.bucket, tick: this.tick }), this._fin());
      st = this._start(b);
    }
    st.closed = true;
    if (this._currentT === b) this._currentT = null;
    return this._fp(st);
  }

  _fin() { return { imbalanceRatio: this.cfg.imbalanceRatio, stackedMin: this.cfg.stackedMin }; }
  _fp(st) { if (st.dirty || !st.fp) { st.fp = finalize(st, this._fin()); st.dirty = false; } return st.fp; }

  /** The forming candle's footprint (null when none is forming). */
  current() {
    if (this._currentT === null) return null;
    const st = this._states.get(this._currentT);
    return st && !st.closed ? this._fp(st) : null;
  }

  /** Closed footprints, oldest→newest, last `n`. */
  recent(n = this.maxCandles) {
    const out = [];
    for (let i = this._order.length - 1; i >= 0 && out.length < n; i--) {
      const st = this._states.get(this._order[i]);
      if (st?.closed) out.push(this._fp(st));
    }
    return out.reverse();
  }

  /** The newest closed footprint, or null. */
  last() { const r = this.recent(1); return r.length ? r[0] : null; }

  clear() { this._states.clear(); this._order.length = 0; this._currentT = null; }
}
