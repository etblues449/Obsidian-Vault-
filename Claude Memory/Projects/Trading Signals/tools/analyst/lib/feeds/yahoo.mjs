// lib/feeds/yahoo.mjs — opt-in delayed poller (SPEC.md §3, kind='delayed'). Best effort only: Yahoo's
// chart endpoint is unofficial, ~15 min delayed for futures, has no trade tape (delta falls back to the
// body/range proxy) and will rate-limit. Polls every `pollSeconds`; on 429/5xx/parse failure reports
// status 'error' with the detail and keeps polling at 5× the interval until it recovers.
// The first successful poll is emitted as history; later polls emit only candles newer than the last
// one seen as closed 1m candles (Yahoo's final bar is still forming, so it is emitted with closed:false).

import { FeedAdapter } from './base.mjs';

export const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

/** Yahoo chart JSON → 1m Candle[] (oldest→newest). Rows with null OHLC are skipped. Throws on an unexpected shape. */
export function parseYahooChart(body) {
  const r = body?.chart?.result?.[0];
  if (!r || !Array.isArray(r.timestamp)) throw new Error(body?.chart?.error?.description || 'unexpected Yahoo chart body');
  const q = r.indicators?.quote?.[0] || {};
  const out = [];
  for (let i = 0; i < r.timestamp.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i], v = q.volume?.[i];
    if (![o, h, l, c].every((x) => typeof x === 'number' && Number.isFinite(x))) continue;
    out.push({ t: Math.floor(r.timestamp[i] / 60) * 60 * 1000, o, h, l, c, v: Number.isFinite(v) ? v : 0, closed: true });
  }
  return out.sort((a, b) => a.t - b.t);
}

export class YahooFeed extends FeedAdapter {
  /**
   * @param {{id:string}} symbol
   * @param {{pollSeconds?:number, symbols?:object, log?:object}} [opts]  feedDefaults.yahoo (+ log)
   * @param {object} [deps]
   */
  constructor(symbol, opts = {}, deps = {}) {
    super(symbol, opts);
    this.kind = 'delayed';
    this.ticker = opts.symbols?.[symbol.id] || symbol.feedParams?.ticker || symbol.id;
    this.pollMs = Math.max(5, Number(opts.pollSeconds) || 60) * 1000;
    this.log = opts.log ?? null;
    this.d = { fetch: deps.fetch ?? globalThis.fetch, now: deps.now ?? (() => Date.now()), setTimeout: deps.setTimeout ?? globalThis.setTimeout, clearTimeout: deps.clearTimeout ?? globalThis.clearTimeout };
    this._timer = null;
    this._closed = false;
    this.lastT = null;
    this.failures = 0;
  }

  url() { return `${YAHOO_BASE}/${encodeURIComponent(this.ticker)}?interval=1m&range=1d`; }

  async poll() {
    if (this._closed) return;
    try {
      const res = await this.d.fetch(this.url(), { headers: { 'user-agent': 'Mozilla/5.0 (TradeGuard Analyst)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const candles = parseYahooChart(await res.json());
      if (this._closed) return;
      const nowMs = this.d.now();
      // The newest bar is still forming unless its minute has fully elapsed.
      const marked = candles.map((c) => ({ ...c, closed: c.t + 60e3 <= nowMs }));
      if (this.lastT === null) {
        const closed = marked.filter((c) => c.closed);
        this.emit('history', { symbol: this.symbol.id, candles: closed });
        this.lastT = closed.length ? closed[closed.length - 1].t : null;
        const forming = marked.find((c) => !c.closed);
        if (forming) this.emit('candle', { symbol: this.symbol.id, candle: forming });
      } else {
        for (const c of marked) {
          if (c.t < this.lastT || (c.t === this.lastT && c.closed)) continue;
          this.emit('candle', { symbol: this.symbol.id, candle: c });
          if (c.closed) this.lastT = c.t;
        }
      }
      this.failures = 0;
      if (this.state !== 'delayed') this.setStatus('delayed', `Yahoo ${this.ticker}, ~15 min delayed`);
      this._schedule(this.pollMs);
    } catch (e) {
      this.failures++;
      const detail = `${this.ticker}: ${e?.message ?? e} (${this.failures} in a row)`;
      if (this.log) this.log.warn(this.symbol.id, `Yahoo poll failed — ${detail}`);
      this.setStatus('error', detail);
      this._schedule(this.pollMs * 5);
    }
  }

  _schedule(ms) {
    if (this._closed) return;
    this._timer = this.d.setTimeout(() => { this._timer = null; this.poll(); }, ms);
    if (this._timer && typeof this._timer.unref === 'function') this._timer.unref();
  }

  async connect() {
    if (this._closed) return;
    this.setStatus('connecting', `Yahoo ${this.ticker}`);
    await this.poll();
  }

  async close() {
    this._closed = true;
    if (this._timer) { this.d.clearTimeout(this._timer); this._timer = null; }
    if (this.state !== 'closed') this.setStatus('closed');
  }
}
