// lib/feeds/simulated.mjs — honest random walk (SPEC.md §3, kind='sim').
// Seeded xorshift GBM at 1 s ticks: every tick is a synthetic aggressor-tagged trade (side = sign of
// the tick), the forming 1m candle is re-emitted on each tick and closed on the minute boundary.
// On connect it backfills `backfillMinutes` of synthetic 1m history so the engine has something to
// chew on. Deterministic under injected `now`/timers — same seed, same tape, every run.
// Status is 'sim' from the first instant: the dashboard must never mistake this for a market.
//
// feedParams: { seed (doubles as the starting price — a placeholder, not a quote), volatility
//   (per-1m-candle relative sigma, default 0.0005), tickSize (price rounding, default 0.01),
//   backfillMinutes (default: globalCfg.history.backfillMinutes) }

import { FeedAdapter } from './base.mjs';

/** xorshift32 → () => [0,1). Same sequence everywhere (mirrors test/helpers.mjs). */
export function xorshift(seed = 1) {
  let x = (seed >>> 0) || 0x9e3779b9;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 0x100000000; };
}

/** Cheap string hash so two symbols with the same numeric seed walk different paths. */
function hash32(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }

export class SimulatedFeed extends FeedAdapter {
  /**
   * @param {{id:string, feedParams?:object}} symbol
   * @param {{backfillMinutes?: number}} [opts]   usually globalCfg.history
   * @param {{now?:Function, setTimeout?:Function, clearTimeout?:Function, setInterval?:Function, clearInterval?:Function}} [deps]
   */
  constructor(symbol, opts = {}, deps = {}) {
    super(symbol, opts);
    this.kind = 'sim';
    const p = symbol.feedParams || {};
    this.price0 = Number.isFinite(p.seed) && p.seed > 0 ? p.seed : 100;
    this.sigma1m = Number.isFinite(p.volatility) && p.volatility > 0 ? p.volatility : 0.0005;
    this.tickSize = Number.isFinite(p.tickSize) && p.tickSize > 0 ? p.tickSize : 0.01;
    this.backfillMinutes = Number.isInteger(p.backfillMinutes) ? p.backfillMinutes : (Number.isInteger(opts.backfillMinutes) ? opts.backfillMinutes : 1440);
    this.tickMs = Number.isFinite(p.tickMs) && p.tickMs > 0 ? p.tickMs : 1000;
    this.rnd = xorshift((hash32(symbol.id) ^ Math.floor(this.price0 * 1000)) >>> 0);
    this.now = deps.now ?? (() => Date.now());
    this.timers = { setInterval: deps.setInterval ?? globalThis.setInterval, clearInterval: deps.clearInterval ?? globalThis.clearInterval };
    this._interval = null;
    this.price = this.price0;
    this.candle = null; // forming 1m candle
  }

  _round(p) { return Math.max(this.tickSize, Math.round(p / this.tickSize) * this.tickSize); }
  /** One Gaussian step (Box–Muller) scaled to `sigma`, applied as GBM. */
  _stepPrice(sigma) {
    const u = Math.max(1e-12, this.rnd()), v = this.rnd();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    this.price = this._round(this.price * Math.exp(sigma * z - sigma * sigma / 2));
    return z;
  }

  /** Synthetic closed 1m history ending at the minute before `nowMs`. */
  _backfill(nowMs) {
    const end = Math.floor(nowMs / 60e3) * 60e3;
    const out = [];
    for (let i = this.backfillMinutes; i >= 1; i--) {
      const t = end - i * 60e3;
      const o = this.price;
      let h = o, l = o;
      const ticks = 12; // coarse intra-minute path: enough for a wick, cheap for a day of history
      let buyV = 0, sellV = 0;
      for (let k = 0; k < ticks; k++) {
        const z = this._stepPrice(this.sigma1m / Math.sqrt(ticks));
        if (this.price > h) h = this.price; if (this.price < l) l = this.price;
        const q = 0.5 + this.rnd(); if (z >= 0) buyV += q; else sellV += q;
      }
      out.push({ t, o, h, l, c: this.price, v: buyV + sellV, buyV, sellV, n: ticks, closed: true });
    }
    return out;
  }

  _tick() {
    const nowMs = this.now();
    const t = Math.floor(nowMs / 60e3) * 60e3;
    const z = this._stepPrice(this.sigma1m / Math.sqrt(60e3 / this.tickMs));
    const q = Math.round((0.5 + this.rnd()) * 100) / 100;
    const side = z >= 0 ? 'buy' : 'sell';
    if (this.candle && this.candle.t !== t) {
      // Minute boundary: the previous candle's final print, then start the new one.
      this.emit('candle', { symbol: this.symbol.id, candle: { ...this.candle, closed: true } });
      this.candle = null;
    }
    if (!this.candle) this.candle = { t, o: this.price, h: this.price, l: this.price, c: this.price, v: 0, buyV: 0, sellV: 0, n: 0, closed: false };
    const c = this.candle;
    if (this.price > c.h) c.h = this.price; if (this.price < c.l) c.l = this.price;
    c.c = this.price; c.v += q; c.n++; if (side === 'buy') c.buyV += q; else c.sellV += q;
    this.emit('trade', { symbol: this.symbol.id, trade: { t: nowMs, p: this.price, q, side } });
    this.emit('candle', { symbol: this.symbol.id, candle: { ...c } });
  }

  async connect() {
    if (this.state === 'closed' || this._interval) return;
    try {
      this.setStatus('sim', 'synthetic random walk — not a market');
      const history = this._backfill(this.now());
      this.emit('history', { symbol: this.symbol.id, candles: history });
      this._interval = this.timers.setInterval(() => { try { this._tick(); } catch (e) { this.setStatus('error', e?.message ?? String(e)); } }, this.tickMs);
      if (this._interval && typeof this._interval.unref === 'function') this._interval.unref();
    } catch (e) {
      this.setStatus('error', e?.message ?? String(e));
    }
  }

  async close() {
    if (this._interval) { this.timers.clearInterval(this._interval); this._interval = null; }
    if (this.state !== 'closed') this.setStatus('closed');
  }
}
