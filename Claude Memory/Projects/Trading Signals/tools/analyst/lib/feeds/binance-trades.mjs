// lib/feeds/binance-trades.mjs — Binance spot aggTrades REST backfill for footprints (SPEC-PRO.md §P1).
//   forward (default, §P1):
//     GET https://data-api.binance.vision/api/v3/aggTrades?symbol=BTCUSDT&startTime=…&limit=1000  (first page)
//     GET …/aggTrades?symbol=BTCUSDT&fromId=<lastId + 1>&limit=1000                                (next pages)
//   backward (additive, `direction: 'backward'` — newest history first, so a truncated backfill loses the OLDEST
//   trades and `coverage.from` is exactly what FootprintBuilder.markPartialBefore() wants):
//     GET …/aggTrades?symbol=BTCUSDT[&endTime=…]&limit=1000                                         (newest page)
//     GET …/aggTrades?symbol=BTCUSDT&fromId=<firstId − limit>&limit=1000                            (walk back)
//   Row { a: aggTradeId, p, q, f, l, T: tradeTime, m: buyerIsMaker, M } → Trade { t: T, p, q, side, id: a }.
//   m = "buyer is the maker" ⇒ the SELLER aggressed ⇒ side 'sell' (source 05 §3: bid column = aggressive sellers).
//   Rules shared with binance.mjs: never more than 1 request/s; a 429/418 waits Retry-After (or 60 s) and the
//   page is retried; every HTTP call (retries included) counts toward maxRequests, so the total number of
//   calls is bounded no matter what the server does. Stops when a page is short (caught up / start of tape),
//   when a trade passes the window, or at maxRequests — the last case flags the result `partial`.
//   Clock and timers are injected (`now`, `setTimeout`) so the tests pace the 1 req/s rule on a fake clock.
//
// DEVIATION: the returned Trade[] carries additive array properties `partial`, `requests`, `coverage {from, to}`,
//   `direction`, `lastId`, `firstId` and `symbol` (§P1 says only "flags partial"); each Trade carries `id`
//   (the aggTrade id — what fromId pagination needs; the engine ignores it).
// DEVIATION: additive `direction: 'backward'` (see above). §P1's forward walk is the default; with it,
//   `partial` means the NEWEST trades after `coverage.to` are missing.
// DEVIATION: the forward first page is requested with startTime ONLY (no endTime): Binance's startTime+endTime
//   window rules have changed over time, and endTime is enforced client-side anyway.
// DEVIATION: a non-OK status other than 429/418 throws (like binance.mjs) rather than returning partial — a
//   4xx on a public endpoint is a bug to surface, not history to label.

export const REST_BASE = 'https://data-api.binance.vision/api/v3';
const MIN_GAP_MS = 1000;
const DEFAULT_HOLDOFF_MS = 60e3;
const PAGE_MAX = 1000;

/** aggTrades REST row → Trade (+ id). */
export function parseAggTradeRow(r) {
  return { t: +r.T, p: +r.p, q: +r.q, side: r.m ? 'sell' : 'buy', id: +r.a };
}

/** The request URL for one page. Exactly one of startTime / endTime / fromId / nothing (most recent). */
export function aggTradesUrl({ symbol, startTime = null, endTime = null, fromId = null, limit = PAGE_MAX }) {
  const pair = String(symbol).toUpperCase();
  const q = [`symbol=${pair}`];
  if (fromId !== null) q.push(`fromId=${fromId}`);
  else if (startTime !== null) q.push(`startTime=${Math.floor(startTime)}`);
  else if (endTime !== null) q.push(`endTime=${Math.floor(endTime)}`);
  q.push(`limit=${limit}`);
  return `${REST_BASE}/aggTrades?${q.join('&')}`;
}

/**
 * Paginated aggTrades backfill for [startTime, endTime].
 * @param {{symbol:string, startTime:number, endTime?:number|null, limit?:number, maxRequests?:number, cfg?:object,
 *          direction?:'forward'|'backward', fetch?:Function, log?:object, now?:Function, setTimeout?:Function}} o
 * @returns {Promise<Trade[] & {partial:boolean, requests:number, coverage:{from:number|null,to:number|null}, direction:string,
 *          firstId:number|null, lastId:number|null, symbol:string}>}  oldest→newest, deduped by id
 */
export async function fetchAggTrades({
  symbol, startTime, endTime = null, limit = PAGE_MAX, maxRequests, cfg, direction = 'forward',
  fetch = globalThis.fetch, log = null, now = () => Date.now(), setTimeout = globalThis.setTimeout,
} = {}) {
  if (!symbol) throw new TypeError('fetchAggTrades: symbol is required');
  if (!Number.isFinite(startTime)) throw new TypeError('fetchAggTrades: startTime (ms) is required');
  if (typeof fetch !== 'function') throw new TypeError('fetchAggTrades: no fetch available');
  if (direction !== 'forward' && direction !== 'backward') throw new RangeError(`fetchAggTrades: direction must be forward|backward, got ${direction}`);
  const pair = String(symbol).toUpperCase();
  const pageSize = Math.min(PAGE_MAX, Math.max(1, Math.floor(limit) || PAGE_MAX));
  const maxReq = Number.isInteger(maxRequests) && maxRequests > 0 ? maxRequests
    : (Number.isInteger(cfg?.footprint?.backfillMaxRequests) && cfg.footprint.backfillMaxRequests > 0 ? cfg.footprint.backfillMaxRequests : 40);
  const end = Number.isFinite(endTime) ? endTime : null;
  const say = (level, msg, data) => { if (log && typeof log[level] === 'function') log[level](pair, msg, data); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const backward = direction === 'backward';

  const byId = new Map();
  let requests = 0, fromId = null, lastRestAt = -Infinity, holdoffUntil = 0, done = false, first = true;
  while (requests < maxReq) {
    const wait = Math.max(holdoffUntil - now(), lastRestAt + MIN_GAP_MS - now());
    if (wait > 0) await sleep(wait);
    lastRestAt = now();
    requests++;
    const url = first
      ? (backward ? aggTradesUrl({ symbol: pair, endTime: end, limit: pageSize }) : aggTradesUrl({ symbol: pair, startTime, limit: pageSize }))
      : aggTradesUrl({ symbol: pair, fromId, limit: pageSize });
    const res = await fetch(url);
    if (res.status === 429 || res.status === 418) {
      const ra = Number(res.headers?.get?.('retry-after'));
      const ms = Number.isFinite(ra) && ra > 0 ? ra * 1000 : DEFAULT_HOLDOFF_MS;
      holdoffUntil = now() + ms;
      say('warn', `aggTrades rate limit (HTTP ${res.status}) — backing off ${Math.round(ms / 1000)} s`);
      continue;
    }
    if (!res.ok) throw new Error(`Binance aggTrades HTTP ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error('Binance aggTrades: unexpected body');
    first = false;
    let minId = Infinity, maxId = -Infinity, pastWindow = false;
    for (const r of rows) {
      const tr = parseAggTradeRow(r);
      if (!(Number.isFinite(tr.t) && Number.isFinite(tr.p) && Number.isFinite(tr.q) && Number.isFinite(tr.id))) continue;
      if (tr.id < minId) minId = tr.id;
      if (tr.id > maxId) maxId = tr.id;
      if (backward ? tr.t < startTime : (end !== null && tr.t > end)) { pastWindow = true; continue; }
      if (tr.t < startTime || (end !== null && tr.t > end)) continue;
      byId.set(tr.id, tr);
    }
    if (!rows.length || pastWindow || rows.length < pageSize) { done = true; break; }
    if (backward) {
      if (minId <= 0) { done = true; break; }           // start of the tape
      fromId = Math.max(0, minId - pageSize);
    } else fromId = maxId + 1;
  }

  const out = [...byId.values()].sort((a, b) => a.t - b.t || a.id - b.id);
  out.partial = !done;
  out.requests = requests;
  out.direction = direction;
  out.firstId = out.length ? out[0].id : null;
  out.lastId = out.length ? out[out.length - 1].id : null;
  out.symbol = pair;
  out.coverage = { from: out.length ? out[0].t : null, to: out.length ? out[out.length - 1].t : null };
  if (out.partial) say('warn', `aggTrades backfill stopped at ${requests} request(s) with history still missing (${backward ? 'before' : 'after'} ${backward ? out.coverage.from : out.coverage.to} ms) — footprints there are partial`);
  else say('info', `aggTrades backfill: ${out.length} trade(s) in ${requests} request(s)`);
  return out;
}
