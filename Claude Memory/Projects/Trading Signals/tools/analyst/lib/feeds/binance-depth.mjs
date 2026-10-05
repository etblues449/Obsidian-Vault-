// lib/feeds/binance-depth.mjs — Binance spot partial book depth for lib/engine/orderbook.mjs (SPEC-PRO.md §P2).
//   Stream:  wss://data-stream.binance.vision/stream?streams=<s>@depth20   (top 20 per side, every 1 s)
//            payload { lastUpdateId, bids:[[price, qty]…], asks:[[price, qty]…] } — best first, NO timestamp.
//   REST:    GET https://data-api.binance.vision/api/v3/depth?symbol=BTCUSDT&limit=20   (the first snapshot)
//   This is the VISIBLE top of book — source 05 §2 "resting flow … can be modified, moved, or canceled (spoofing)
//   at any moment". Nothing here is level 3 and the UI must say so.
//
//   The partial-depth payload carries no event time, so `parseDepthMessage(raw, { t })` stamps the snapshot with
//   the caller's clock (the feed passes its injected `now()`); a snapshot without `t` is stamped by OrderBook's
//   own injected clock. The only wall clock here is the adapter's default `deps.now` (as in binance.mjs) — the
//   parser and the engine module never read it.
//
//   `BinanceDepthFeed` is a stand-alone adapter (one socket per symbol: `<s>@depth20`) with the same resilience
//   rules as binance.mjs — exponential backoff with jitter, attempt reset after a clean 60 s, 90 s silence
//   watchdog, 'error' after 10 consecutive failures but never giving up, ≤ 1 REST call/s, 429/418 holdoff. It
//   emits 'book' { symbol, snapshot } and the usual 'status'. The integrator may instead add `<s>@depth20` to
//   binance.mjs's combined socket and route frames through parseDepthMessage() — both paths produce the same
//   BookSnapshot.
//
// DEVIATION: `depthStreamName(stream, { levels, speed })` takes optional levels (5|10|20, default 20) and speed
//   ('100ms' → `@depth20@100ms`); §P2 names only `${s}@depth20`, which is the default output.
// DEVIATION: BookSnapshot carries additive `lastUpdateId` (Binance's sequence number — lets a consumer drop a
//   stale frame after a reconnect) and `stream` when the frame came from the combined stream.
// DEVIATION: additive `BinanceDepthFeed` adapter (events 'book'/'status'), `depthRestUrl()` and
//   `fetchDepthSnapshot()` — §P2 names only the parser and the stream name; without an adapter nothing would
//   actually carry depth frames into OrderBook.

import { FeedAdapter, backoffMs } from './base.mjs';

export const REST_BASE = 'https://data-api.binance.vision/api/v3';
export const WS_BASE = 'wss://data-stream.binance.vision/stream';
export const DEPTH_LEVELS = Object.freeze([5, 10, 20]);
const MIN_REST_GAP_MS = 1000;
const WATCHDOG_MS = 90e3;
const CLEAN_RESET_MS = 60e3;
const ERROR_AFTER = 10;
const DEPTH_RE = /^([a-z0-9]+)@depth(5|10|20)(?:@100ms)?$/;

/** `${s}@depth20` (lower-cased), optionally another level count or the 100 ms variant. */
export function depthStreamName(stream, { levels = 20, speed = null } = {}) {
  const s = String(stream || '').toLowerCase();
  if (!s) throw new TypeError('depthStreamName: stream (e.g. btcusdt) is required');
  const n = DEPTH_LEVELS.includes(levels) ? levels : 20;
  return `${s}@depth${n}${speed === '100ms' ? '@100ms' : ''}`;
}

/** True for a partial-depth stream name (`btcusdt@depth20`, `…@depth10@100ms`). */
export function isDepthStream(name) { return DEPTH_RE.test(String(name || '').toLowerCase()); }

/** REST URL for the first snapshot. `limit` ∈ 5|10|20|50|100|500|1000|5000; the engine wants 20. */
export function depthRestUrl(symbol, limit = 20) {
  return `${REST_BASE}/depth?symbol=${String(symbol).toUpperCase()}&limit=${Math.max(1, Math.floor(limit))}`;
}

/** `[[price, qty], …]` (strings or numbers) → [{price, qty}], finite rows only (sorting is OrderBook's job). */
export function parseDepthLevels(rows) {
  const out = [];
  if (!Array.isArray(rows)) return out;
  for (const r of rows) {
    const price = Array.isArray(r) ? +r[0] : +r?.price, qty = Array.isArray(r) ? +r[1] : +r?.qty;
    if (Number.isFinite(price) && Number.isFinite(qty)) out.push({ price, qty });
  }
  return out;
}

/**
 * One depth frame → BookSnapshot `{ t, lastUpdateId?, bids:[{price,qty}] (best first), asks:[…], stream? }`.
 * Accepts a JSON string, a combined-stream `{stream, data}` wrapper or the bare payload (also the REST body).
 * Returns null for anything that is not a depth payload (a kline/aggTrade frame on a shared socket, a
 * subscribe ack, bad JSON). `t` is the caller's clock (the payload has none); null when not given.
 */
export function parseDepthMessage(raw, { t = null } = {}) {
  let msg;
  try { msg = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
  if (!msg || typeof msg !== 'object') return null;
  const wrapped = msg.data && typeof msg.data === 'object' && 'stream' in msg;
  const data = wrapped ? msg.data : msg;
  if (!data || typeof data !== 'object' || !Array.isArray(data.bids) || !Array.isArray(data.asks)) return null;
  if (wrapped && !isDepthStream(msg.stream)) return null;
  const bids = parseDepthLevels(data.bids).sort((a, b) => b.price - a.price);
  const asks = parseDepthLevels(data.asks).sort((a, b) => a.price - b.price);
  const snap = { t: Number.isFinite(t) ? +t : null, bids, asks };
  if (Number.isFinite(+data.lastUpdateId)) snap.lastUpdateId = +data.lastUpdateId;
  if (wrapped) snap.stream = String(msg.stream);
  return snap;
}

/**
 * The first snapshot over REST (one call, no pacing of its own — BinanceDepthFeed paces it). Throws on HTTP
 * errors; a 429/418 error carries `retryAfterMs` (Retry-After or 60 s) so the caller can hold REST off.
 */
export async function fetchDepthSnapshot({ symbol, limit = 20, fetch = globalThis.fetch, now = null } = {}) {
  if (!symbol) throw new TypeError('fetchDepthSnapshot: symbol is required');
  if (typeof fetch !== 'function') throw new TypeError('fetchDepthSnapshot: no fetch available');
  const res = await fetch(depthRestUrl(symbol, limit));
  if (res.status === 429 || res.status === 418) {
    const ra = Number(res.headers?.get?.('retry-after'));
    const err = new Error(`Binance depth rate limit (HTTP ${res.status})`);
    err.status = res.status; err.retryAfterMs = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 60e3;
    throw err;
  }
  if (!res.ok) { const err = new Error(`Binance depth HTTP ${res.status}`); err.status = res.status; throw err; }
  const body = await res.json();
  const snap = parseDepthMessage(body, { t: typeof now === 'function' ? now() : null });
  if (!snap) throw new Error('Binance depth: unexpected body');
  return snap;
}

/**
 * Stand-alone partial-depth adapter. Events: 'book' { symbol, snapshot }, 'status' { symbol, state, detail }.
 * `symbol.feedParams.stream` (e.g. 'btcusdt') names the pair, like binance.mjs.
 */
export class BinanceDepthFeed extends FeedAdapter {
  /**
   * @param {{id:string, feedParams?:{stream?:string}}} symbol
   * @param {{levels?:number, speed?:'100ms'|null, restFirst?:boolean, log?:object}} [opts]
   * @param {{fetch?:Function, WebSocket?:Function, now?:Function, setTimeout?:Function, clearTimeout?:Function, random?:Function}} [deps]
   */
  constructor(symbol, opts = {}, deps = {}) {
    super(symbol, opts);
    this.kind = 'live';
    this.stream = String(symbol.feedParams?.stream || symbol.id).toLowerCase();
    this.pair = this.stream.toUpperCase();
    this.levels = DEPTH_LEVELS.includes(opts.levels) ? opts.levels : 20;
    this.speed = opts.speed === '100ms' ? '100ms' : null;
    this.restFirst = opts.restFirst !== false;
    this.log = opts.log ?? null;
    this.d = {
      fetch: deps.fetch ?? globalThis.fetch, WebSocket: deps.WebSocket ?? globalThis.WebSocket,
      now: deps.now ?? (() => Date.now()), setTimeout: deps.setTimeout ?? globalThis.setTimeout, clearTimeout: deps.clearTimeout ?? globalThis.clearTimeout,
      random: deps.random ?? Math.random,
    };
    this.ws = null;
    this.attempt = 0;
    this.lastUpdateId = null;   // newest sequence seen — older frames after a reconnect are dropped
    this.frames = 0;
    this.lastRestAt = -Infinity;
    this.restRetryAt = 0;
    this._timers = new Set();
    this._closed = false;
    this._connectedAt = null;
    this._wsGen = 0;
  }

  get streamName() { return depthStreamName(this.stream, { levels: this.levels, speed: this.speed }); }
  get url() { return `${WS_BASE}?streams=${this.streamName}`; }

  _after(ms, fn) {
    const h = this.d.setTimeout(() => { this._timers.delete(h); if (!this._closed) fn(); }, ms);
    this._timers.add(h);
    if (h && typeof h.unref === 'function') h.unref();
    return h;
  }
  _cancel(h) { if (h) { this.d.clearTimeout(h); this._timers.delete(h); } }
  _sleep(ms) { return new Promise((r) => this._after(ms, r)); }
  _say(level, msg, data) { if (this.log && typeof this.log[level] === 'function') this.log[level](this.symbol.id, msg, data); }

  _emitBook(snap) {
    if (!snap) return;
    if (Number.isFinite(snap.lastUpdateId)) {
      if (this.lastUpdateId !== null && snap.lastUpdateId < this.lastUpdateId) return;   // stale frame
      this.lastUpdateId = snap.lastUpdateId;
    }
    this.frames++;
    this.emit('book', { symbol: this.symbol.id, snapshot: snap });
  }

  /** One rate-limited REST snapshot. */
  async _restSnapshot() {
    const wait = Math.max(this.restRetryAt - this.d.now(), this.lastRestAt + MIN_REST_GAP_MS - this.d.now());
    if (wait > 0) await this._sleep(wait);
    if (this._closed) return null;
    this.lastRestAt = this.d.now();
    try {
      return await fetchDepthSnapshot({ symbol: this.pair, limit: this.levels, fetch: this.d.fetch, now: this.d.now });
    } catch (e) {
      if (e.retryAfterMs) this.restRetryAt = this.d.now() + e.retryAfterMs;
      throw e;
    }
  }

  async connect() {
    if (this._closed) return;
    this.setStatus('connecting');
    if (this.restFirst) {
      try {
        const snap = await this._restSnapshot();
        if (this._closed) return;
        this._emitBook(snap);
      } catch (e) { this._say('warn', `Depth snapshot failed: ${e.message} — streaming without it (the first frame is a full top-20 anyway)`); }
    }
    this._openSocket();
  }

  _openSocket() {
    if (this._closed) return;
    const gen = ++this._wsGen;
    let ws;
    try { ws = new this.d.WebSocket(this.url); } catch (e) { this._onFailure(`socket constructor: ${e.message}`); return; }
    this.ws = ws;
    let watchdog = null, cleanTimer = null;
    const alive = () => this.ws === ws && gen === this._wsGen && !this._closed;
    const kick = () => {
      this._cancel(watchdog);
      watchdog = this._after(WATCHDOG_MS, () => { if (alive()) { this._say('warn', `No depth frame for ${WATCHDOG_MS / 1000} s — reconnecting`); this._drop(ws, 'watchdog'); } });
    };
    ws.onopen = () => {
      if (!alive()) return;
      this._connectedAt = this.d.now();
      kick();
      cleanTimer = this._after(CLEAN_RESET_MS, () => { if (alive()) this.attempt = 0; });
      this.attempt = 0;
      this.setStatus('live');
    };
    ws.onmessage = (ev) => {
      if (!alive()) return;
      kick();
      this._emitBook(parseDepthMessage(ev.data, { t: this.d.now() }));
    };
    ws.onerror = (ev) => { if (alive()) this._drop(ws, ev?.message || ev?.error?.message || 'socket error'); };
    ws.onclose = (ev) => { if (alive()) this._drop(ws, `closed (${ev?.code ?? '?'}${ev?.reason ? ' ' + ev.reason : ''})`); };
    ws._cleanup = () => { this._cancel(watchdog); this._cancel(cleanTimer); };
  }

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
