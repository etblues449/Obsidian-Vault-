// lib/feeds/replay.mjs — feed from an in-memory candle array (SPEC.md §3, kind='replay').
// Used by backtest.mjs and the e2e test: emits `history` (all but the last `playLast` candles), then
// plays the rest as closed 1m candles — synchronously when `speed` is 0 (the default: a backtest is
// a loop, not a wait) or paced by `speed` ms per candle on the injected timers.
//
// Nothing here reads a clock: the caller drives time by listening to 'candle' BEFORE the engine does
// (EventEmitter listeners run in registration order) and setting its injected `now` from candle.t.
//
// DEVIATION (additive): options `playLast` (how many candles play live; SPEC says "the last N" without
//   naming it), `forming` (emit a forming print before each closed one so the throttle path is
//   exercised), and `speed` in ms per candle. Trades, when supplied, are emitted in time order between
//   the candles they precede.

import { FeedAdapter } from './base.mjs';
import { normalizeCandle } from '../engine/candles.mjs';

export class ReplayFeed extends FeedAdapter {
  /**
   * @param {{id:string}} symbol
   * @param {{candles: object[], trades?: object[], speed?: number, playLast?: number, forming?: boolean}} opts
   * @param {{setTimeout?: Function, clearTimeout?: Function}} [deps]
   */
  constructor(symbol, opts = {}, deps = {}) {
    super(symbol, opts);
    this.kind = 'replay';
    const raw = Array.isArray(opts.candles) ? opts.candles : [];
    this.candles = raw.map((c) => ({ ...normalizeCandle(c), closed: true })).sort((a, b) => a.t - b.t);
    this.trades = (Array.isArray(opts.trades) ? opts.trades : []).slice().sort((a, b) => a.t - b.t);
    this.speed = Number.isFinite(opts.speed) && opts.speed > 0 ? opts.speed : 0;
    this.playLast = Number.isInteger(opts.playLast) ? Math.max(0, Math.min(this.candles.length, opts.playLast)) : Math.min(this.candles.length, 60);
    this.forming = opts.forming === true;
    this.timers = { setTimeout: deps.setTimeout ?? globalThis.setTimeout, clearTimeout: deps.clearTimeout ?? globalThis.clearTimeout };
    this._timer = null;
    this._tradeIdx = 0;
    this._pos = 0;
    this.done = false;
    this._resolveDone = null;
    this.finished = new Promise((r) => { this._resolveDone = r; });
  }

  async connect() {
    if (this.state === 'closed') return;
    try {
      const split = this.candles.length - this.playLast;
      const history = this.candles.slice(0, split);
      this._pos = split;
      this.setStatus('connecting');
      // Trades that precede the first live candle ride along with history (they belong to it).
      const firstLiveT = this.candles[split]?.t ?? Infinity;
      while (this._tradeIdx < this.trades.length && this.trades[this._tradeIdx].t < firstLiveT) this._tradeIdx++;
      this.emit('history', { symbol: this.symbol.id, candles: history });
      this.setStatus('live', 'replay');
      if (this.speed === 0) { while (this._step()) { /* synchronous replay */ } }
      else this._schedule();
    } catch (e) {
      this.setStatus('error', e?.message ?? String(e));
    }
  }

  /** Emit the next candle (and the trades before it). Returns false when the array is exhausted. */
  _step() {
    if (this.state === 'closed') return false;
    if (this._pos >= this.candles.length) { this._finish(); return false; }
    const c = this.candles[this._pos++];
    const until = c.t + 60e3;
    while (this._tradeIdx < this.trades.length && this.trades[this._tradeIdx].t < until) {
      this.emit('trade', { symbol: this.symbol.id, trade: this.trades[this._tradeIdx++] });
    }
    if (this.forming) this.emit('candle', { symbol: this.symbol.id, candle: { ...c, closed: false } });
    this.emit('candle', { symbol: this.symbol.id, candle: c });
    if (this._pos >= this.candles.length) this._finish();
    return this._pos < this.candles.length;
  }

  _schedule() {
    this._timer = this.timers.setTimeout(() => { this._timer = null; if (this._step()) this._schedule(); }, this.speed);
  }

  _finish() {
    if (this.done) return;
    this.done = true;
    this.emit('done', { symbol: this.symbol.id });
    this._resolveDone();
  }

  async close() {
    if (this._timer) { this.timers.clearTimeout(this._timer); this._timer = null; }
    if (this.state !== 'closed') this.setStatus('closed');
    this._finish();
  }
}
