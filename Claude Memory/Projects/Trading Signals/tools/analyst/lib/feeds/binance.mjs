// lib/feeds/binance.mjs — Binance spot public data (SPEC.md §3, kind='live'). No key, no account.
//   Backfill: GET data-api.binance.vision/api/v3/klines?symbol=…&interval=1m&limit=1000, paginated
//             backwards with endTime until history.backfillMinutes is covered (≤ 1 request/s).
//   Stream:   ONE combined socket per adapter — <s>@kline_1m + <s>@aggTrade + <s>@depth20. kline.k.x = closed,
//             k.V = taker-buy base volume → buyV (sellV = v − buyV): true aggressor delta (source 05 §3).
//             aggTrade.m = "buyer is the maker" ⇒ the SELLER aggressed ⇒ side 'sell'.
//             depth20 (SPEC-PRO §P2, 1 s partial book, top 20 per side) → 'depth' { symbol, snapshot } for
//             lib/engine/orderbook.mjs; the payload has no timestamp so the frame is stamped with the adapter's clock.
//             One REST GET /depth?limit=20 right after the socket opens seeds the book before the first 1 s frame.
//   Resilience: reconnect on close/error with exponential backoff + jitter (attempt counter reset after a
//             clean 60 s), 90 s silence watchdog, Binance's 24 h socket cut handled as a plain reconnect,
//             gap re-backfill from the last closed candle after every reconnect, 'error' status after 10
//             consecutive failures (keeps trying forever, 60 s cap), 429/418 → Retry-After or 60 s.
// Everything injectable through `deps` ({ fetch, WebSocket, now, setTimeout, clearTimeout, random }) so the
// tests run against fakes with a virtual clock.
//
// DEVIATION (SPEC-PRO §P6, additive): the depth stream rides on the SAME combined socket (one connection per
//   symbol, as SPEC §3 requires) and surfaces as a third event, 'depth' { symbol, snapshot: BookSnapshot }.
//   `opts.depth === false` (or symbol.feedParams.depth === false) leaves the socket at kline + aggTrade only.
//   parseStreamMessage(raw, { t }) takes the clock stamp for depth frames; it still returns null for anything else.
//   The REST snapshot on connect is best-effort (a failure is a warn line, the 1 s stream fills the book anyway)
//   and obeys the same ≤ 1 REST call/s + 429 holdoff as the klines calls.

import { FeedAdapter, backoffMs } from './base.mjs';
import { depthStreamName, parseDepthMessage, fetchDepthSnapshot } from './binance-depth.mjs';

export const REST_BASE = 'https://data-api.binance.vision/api/v3';
export const WS_BASE = 'wss://data-stream.binance.vision/stream';
const PAGE = 1000;
const MIN_REST_GAP_MS = 1000;
const WATCHDOG_MS = 90e3;
const CLEAN_RESET_MS = 60e3;
const ERROR_AFTER = 10;

/** REST klines row → Candle (SPEC §3). `closed` false when the row's close time is still in the future. */
export function parseKlineRow(k, nowMs = Infinity) {
  const v = +k[5], buyV = +k[9];
  const c = { t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v, n: +k[8], closed: +k[6] < nowMs };
  if (Number.isFinite(buyV)) { c.buyV = buyV; c.sellV = Math.max(0, v - buyV); }
  return c;
}

/** Combined-stream kline payload → Candle. */
export function parseKline(data) {
  const k = data.k;
  const v = +k.v, buyV = +k.V;
  const c = { t: +k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v, n: +k.n, closed: k.x === true };
  if (Number.isFinite(buyV)) { c.buyV = buyV; c.sellV = Math.max(0, v - buyV); }
  return c;
}

/** Combined-stream aggTrade payload → Trade. m = buyer is maker ⇒ seller aggressed. */
export function parseAggTrade(data) {
  return { t: +data.T, p: +data.p, q: +data.q, side: data.m ? 'sell' : 'buy' };
}

/**
 * Parse one combined-stream message. Returns { candle } | { trade } | { depth } | null for anything else.
 * `t` stamps a depth frame (the partial-depth payload carries no event time — SPEC-PRO §P2).
 */
export function parseStreamMessage(raw, { t = null } = {}) {
  let msg;
  try { msg = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
  const data = msg?.data ?? msg;
  if (!data || typeof data !== 'object') return null;
  if (data.e === 'kline' && data.k) return { candle: parseKline(data) };
  if (data.e === 'aggTrade') return { trade: parseAggTrade(data) };
  if (Array.isArray(data.bids) && Array.isArray(data.asks)) { const depth = parseDepthMessage(msg, { t }); return depth ? { depth } : null; }
  return null;
}

export class BinanceFeed extends FeedAdapter {
  /**
   * @param {{id:string, feedParams:{stream:string}}} symbol
   * @param {{backfillMinutes?:number, log?:object}} [opts]
   * @param {object} [deps]
   */
  constructor(symbol, opts = {}, deps = {}) {
    super(symbol, opts);
    this.kind = 'live';
    this.stream = String(symbol.feedParams?.stream || symbol.id).toLowerCase();
    this.pair = this.stream.toUpperCase();
    this.backfillMinutes = Number.isInteger(opts.backfillMinutes) ? opts.backfillMinutes : 1440;
    this.depth = opts.depth !== false && symbol.feedParams?.depth !== false;   // SPEC-PRO §P2 partial book on the same socket
    this.depthLevels = [5, 10, 20].includes(opts.depthLevels) ? opts.depthLevels : 20;
    this.log = opts.log ?? null;
    this.d = {
      fetch: deps.fetch ?? globalThis.fetch, WebSocket: deps.WebSocket ?? globalThis.WebSocket,
      now: deps.now ?? (() => Date.now()), setTimeout: deps.setTimeout ?? globalThis.setTimeout, clearTimeout: deps.clearTimeout ?? globalThis.clearTimeout,
      random: deps.random ?? Math.random,
    };
    this.ws = null;
    this.attempt = 0;        // consecutive failed connections
    this.lastClosedT = null; // newest closed 1m candle we emitted (gap re-backfill starts after it)
    this.lastRestAt = -Infinity;
    this.restRetryAt = 0;    // 429/418 holdoff
    this._timers = new Set();
    this._closed = false;
    this._connectedAt = null;
    this._wsGen = 0;
  }

  // ---- timers (every one tracked so close() can clear them) ----
  _after(ms, fn) {
    const h = this.d.setTimeout(() => { this._timers.delete(h); if (!this._closed) fn(); }, ms);
    this._timers.add(h);
    if (h && typeof h.unref === 'function') h.unref();
    return h;
  }
  _cancel(h) { if (h) { this.d.clearTimeout(h); this._timers.delete(h); } }
  _sleep(ms) { return new Promise((r) => this._after(ms, r)); }
  _say(level, msg, data) { if (this.log && typeof this.log[level] === 'function') this.log[level](this.symbol.id, msg, data); }

  // ---- REST ----
  /** One rate-limited klines request. Throws on HTTP/network errors; honours 429/418 Retry-After. */
  async _klines(params) {
    const wait = Math.max(this.restRetryAt - this.d.now(), this.lastRestAt + MIN_REST_GAP_MS - this.d.now());
    if (wait > 0) await this._sleep(wait);
    if (this._closed) return [];
    this.lastRestAt = this.d.now();
    const url = `${REST_BASE}/klines?symbol=${this.pair}&interval=1m&limit=${PAGE}${params}`;
    const res = await this.d.fetch(url);
    if (res.status === 429 || res.status === 418) {
      const ra = Number(res.headers?.get?.('retry-after'));
      this.restRetryAt = this.d.now() + (Number.isFinite(ra) && ra > 0 ? ra * 1000 : 60e3);
      throw new Error(`Binance rate limit (HTTP ${res.status}) — backing off ${Math.round((this.restRetryAt - this.d.now()) / 1000)} s`);
    }
    if (!res.ok) throw new Error(`Binance klines HTTP ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error('Binance klines: unexpected body');
    return rows.map((k) => parseKlineRow(k, this.d.now()));
  }

  /** Backfill `backfillMinutes` of 1m candles, newest page first, ≤ 5 pages at 72 h. Oldest→newest, closed only. */
  async backfill() {
    const nowMs = this.d.now();
    const since = nowMs - this.backfillMinutes * 60e3;
    let endTime = nowMs;
    const pages = [];
    const maxPages = Math.ceil(this.backfillMinutes / PAGE) + 1;
    for (let i = 0; i < maxPages; i++) {
      const rows = await this._klines(`&endTime=${endTime}`);
      if (!rows.length) break;
      pages.unshift(rows);
      if (rows[0].t <= since || rows.length < PAGE) break;
      endTime = rows[0].t - 1;
    }
    const byT = new Map();
    for (const page of pages) for (const c of page) if (c.t >= since) byT.set(c.t, c);
    return [...byT.values()].sort((a, b) => a.t - b.t);
  }

  /** Closed candles after `fromT` (gap after a reconnect). Paginates forward. */
  async _gap(fromT) {
    const out = [];
    let start = fromT + 60e3;
    for (let i = 0; i < 10; i++) {
      const rows = await this._klines(`&startTime=${start}`);
      const closed = rows.filter((c) => c.closed && c.t >= start);
      out.push(...closed);
      if (rows.length < PAGE || !closed.length) break;
      start = closed[closed.length - 1].t + 60e3;
    }
    return out;
  }

  // ---- lifecycle ----
  async connect() {
    if (this._closed) return;
    this.setStatus('connecting');
    try {
      const history = await this.backfill();
      if (this._closed) return;
      const closed = history.filter((c) => c.closed);
      if (closed.length) this.lastClosedT = closed[closed.length - 1].t;
      this.emit('history', { symbol: this.symbol.id, candles: closed });
      const forming = history.find((c) => !c.closed);
      if (forming) this.emit('candle', { symbol: this.symbol.id, candle: forming });
    } catch (e) {
      this._say('warn', `Backfill failed: ${e.message} — streaming without history, will retry on reconnect`);
      this.emit('history', { symbol: this.symbol.id, candles: [] });
    }
    this._openSocket();
  }

  _openSocket() {
    if (this._closed) return;
    const gen = ++this._wsGen;
    let ws;
    try {
      ws = new this.d.WebSocket(`${WS_BASE}?streams=${this.streams().join('/')}`);
    } catch (e) { this._onFailure(`socket constructor: ${e.message}`); return; }
    this.ws = ws;
    // Reset depth frame sequence on reconnect to accept fresh frames (SPEC-PRO §P2 finding)
    this._lastDepthId = undefined;
    let watchdog = null, cleanTimer = null;
    const alive = () => this.ws === ws && gen === this._wsGen && !this._closed;
    const kick = () => {
      this._cancel(watchdog);
      watchdog = this._after(WATCHDOG_MS, () => { if (alive()) { this._say('warn', `No message for ${WATCHDOG_MS / 1000} s — reconnecting`); this._drop(ws, 'watchdog'); } });
    };
    ws.onopen = () => {
      if (!alive()) return;
      this._connectedAt = this.d.now();
      kick();
      cleanTimer = this._after(CLEAN_RESET_MS, () => { if (alive()) this.attempt = 0; });
      this._afterOpen(ws, alive);
    };
    ws.onmessage = (ev) => {
      if (!alive()) return;
      kick();
      const parsed = parseStreamMessage(ev.data, { t: this.d.now() });
      if (!parsed) return;
      if (parsed.candle) {
        const c = parsed.candle;
        if (c.closed && (this.lastClosedT === null || c.t > this.lastClosedT)) this.lastClosedT = c.t;
        this.emit('candle', { symbol: this.symbol.id, candle: c });
      } else if (parsed.trade) this.emit('trade', { symbol: this.symbol.id, trade: parsed.trade });
      else if (parsed.depth && this.depth) this._onDepth(parsed.depth, 'stream'); // depth off ⇒ no book, even for a stray frame
    };
    ws.onerror = (ev) => { if (alive()) this._drop(ws, ev?.message || ev?.error?.message || 'socket error'); };
    ws.onclose = (ev) => { if (alive()) this._drop(ws, `closed (${ev?.code ?? '?'}${ev?.reason ? ' ' + ev.reason : ''})`); };
    const cleanup = () => { this._cancel(watchdog); this._cancel(cleanTimer); };
    ws._cleanup = cleanup;
  }

  /** After the socket opens: fill any gap since the last closed candle, then report live. */
  async _afterOpen(ws, alive) {
    if (this.lastClosedT !== null && this.d.now() - this.lastClosedT > 2 * 60e3) {
      try {
        const gap = await this._gap(this.lastClosedT);
        if (!alive()) return;
        for (const c of gap) { if (c.t > this.lastClosedT) this.lastClosedT = c.t; this.emit('candle', { symbol: this.symbol.id, candle: c }); }
        if (gap.length) this._say('info', `Re-backfilled ${gap.length} candle(s) missed while disconnected`);
      } catch (e) { this._say('warn', `Gap re-backfill failed: ${e.message}`); }
    }
    if (alive()) { this.attempt = 0; this.setStatus('live'); }
    if (alive() && this.depth) this._depthSnapshot(alive); // best-effort seed for the book; never delays 'live'
  }

  /** The stream names of the combined socket (SPEC §3 + SPEC-PRO §P2). */
  streams() {
    const out = [`${this.stream}@kline_1m`, `${this.stream}@aggTrade`];
    if (this.depth) out.push(depthStreamName(this.stream, { levels: this.depthLevels }));
    return out;
  }

  /** Depth frames: drop one whose lastUpdateId is older than the newest seen (a stale frame after a reconnect). */
  _onDepth(snapshot, source) {
    if (!snapshot) return;
    const id = snapshot.lastUpdateId;
    if (Number.isFinite(id)) {
      if (this._lastDepthId !== undefined && id < this._lastDepthId) return;
      this._lastDepthId = id;
    }
    this.emit('depth', { symbol: this.symbol.id, snapshot, source });
  }

  /** One rate-limited REST depth snapshot after the socket opens (SPEC-PRO §P6 "REST snapshot on connect"). */
  async _depthSnapshot(alive) {
    try {
      const wait = Math.max(this.restRetryAt - this.d.now(), this.lastRestAt + MIN_REST_GAP_MS - this.d.now());
      if (wait > 0) await this._sleep(wait);
      if (!alive()) return;
      this.lastRestAt = this.d.now();
      const snap = await fetchDepthSnapshot({ symbol: this.pair, limit: this.depthLevels, fetch: this.d.fetch, now: this.d.now });
      if (alive()) this._onDepth(snap, 'rest');
    } catch (e) {
      if (Number.isFinite(e?.retryAfterMs)) this.restRetryAt = this.d.now() + e.retryAfterMs;
      this._say('warn', `Depth snapshot failed: ${e?.message ?? e} — the 1 s depth stream fills the book`);
    }
  }

  /** Tear down `ws` and schedule a reconnect. Idempotent per socket. */
  _drop(ws, why) {
    if (this.ws !== ws) return;
    ws._cleanup?.();
    ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
    try { if (typeof ws.terminate === 'function') ws.terminate(); else ws.close(); } catch { /* already gone */ }
    this.ws = null;
    this._onFailure(why);
  }

  _onFailure(why) {
    if (this._closed) return;
    // A socket that lived ≥ 60 s dropped cleanly (Binance's 24 h cut, a network blip): not a failure streak.
    const wasHealthy = this._connectedAt !== null && this.d.now() - this._connectedAt >= CLEAN_RESET_MS;
    this._connectedAt = null;
    this.attempt = wasHealthy ? 1 : this.attempt + 1;
    const delay = backoffMs(this.attempt - 1, { jitter: (this.d.random() - 0.5) * 0.4 });
    if (this.attempt >= ERROR_AFTER) this.setStatus('error', `${why} — ${this.attempt} consecutive failures, retrying in ${Math.round(delay / 1000)} s`);
    else this.setStatus('reconnecting', `${why} — retry ${this.attempt} in ${Math.round(delay / 1000)} s`);
    this._after(delay, () => this._openSocket());
  }

  async close() {
    this._closed = true;
    for (const h of this._timers) this.d.clearTimeout(h);
    this._timers.clear();
    const ws = this.ws; this.ws = null;
    if (ws) { ws._cleanup?.(); ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null; try { ws.close(); } catch { /* ignore */ } }
    if (this.state !== 'closed') this.setStatus('closed');
  }
}
