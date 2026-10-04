// lib/engine/orderbook.mjs — visible top-of-book state: depth, imbalance, walls, pulled walls (spoofing),
// traded-through walls and ABSORPTION at a wall (SPEC-PRO.md §P2; source 05 §2 "Executed Flow vs. Resting
// Flow" and §4 "Absorption" are the authority).
//
//   Source 05 §2: resting flow (the DOM) "can be modified, moved, or canceled (spoofing) at any moment";
//   "Never treat a large resting limit wall on the DOM as a guaranteed bounce; it is only liquidity waiting
//   to be tested. Real conviction is measured by how the market reacts when aggressive market orders actually
//   collide with that resting size." So this module never scores a wall on its own — it scores what the TAPE
//   did to the wall:
//     wall          a visible level whose qty ≥ wallMult × the median qty of that side's levels (resting flow)
//     pulled        the wall vanished and executed volume AT its price stayed < absorbRatio × its size → it was
//                   cancelled, not filled (source 05 §2: spoofing)
//     tradedThrough the wall vanished AFTER ≥ absorbRatio × its size executed at its price → it was eaten
//     absorbed      ≥ absorbRatio × its size executed AT its price while the wall still stood (persisted) or
//                   came back at that price within pullWindowMs (refilled) — source 05 §4: "one side puts in
//                   immense aggressive effort, yet price fails to displace because a large passive player
//                   absorbs every contract". A bid wall absorbing is bullish absorption (passive buyers soaking
//                   up market sells); an ask wall absorbing is bearish.
//   Executed volume comes ONLY from noteTrade(): the engine never infers fills from qty changes (a smaller qty
//   can be a cancel just as well as a fill — that is the whole pulled-vs-traded distinction).
//
//   No level-3 claims: this is the visible top of book (20 levels per side). Say so in the UI tooltip.
//   No wall clock: every timestamp comes from the snapshot (`snap.t`) or the injected `now`.
//   Plain objects cross the boundary: summary() and history() hand out JSON-safe copies.
//
// DEVIATION: §P2 defines `pulled` as "a wall that disappeared within pullWindowMs without being traded through".
//   Here a wall is finalised as gone when it has been absent from every snapshot for pullWindowMs
//   (t − lastSeen ≥ pullWindowMs); a wall that re-qualifies at the same price inside that window is a REFILL
//   and keeps its history. A pull is therefore reported up to pullWindowMs late, and a brief 1-snapshot flicker
//   is never a pull. If the snapshot gap across the disappearance itself exceeds pullWindowMs (feed silence),
//   nothing is claimed — the book was not being watched (counted in `unobserved`).
// DEVIATION: additive `tradedThrough: [{ side, price, qty, tradedQty, ageMs, at }]` — a wall that vanished
//   after being filled. §P2 names only pulled/absorbed; the UI and the tests need the third outcome by name.
// DEVIATION: event entries (pulled / tradedThrough / absorbed) carry additive `at` (event time) and their `ageMs`
//   is time SINCE the event; a live wall's `ageMs` is time since it first qualified. Events stay in the summary
//   for absorbWindowSec (§P5 uses that window for the czt bookAbsorption hit); pullWindowMs is a detection
//   window, not a display window. `qty` on an event is the largest size the wall displayed; `lastQty` (additive)
//   is what it showed in its last snapshot.
// DEVIATION: `summary()` carries additive `levels` (the top-N snapshot, best first) and `refills` on walls;
//   additive helpers `bookImbalanceFavours()` and `recentAbsorption()` are the czt-side readers of §P5.
// DEVIATION: with cfg absent the §P5 defaults apply (levels 20, wallMult 5, pullWindowMs 3000, absorbRatio 0.5,
//   absorbWindowSec 120, imbalanceMin 0.25, historySeconds 600) — the `orderbook` config block lands with P5.

export const ORDERBOOK_DEFAULTS = Object.freeze({
  levels: 20, wallMult: 5, pullWindowMs: 3000, absorbRatio: 0.5, absorbWindowSec: 120, imbalanceMin: 0.25, historySeconds: 600,
});
const EPS = 1e-9;

/** cfg.orderbook merged over the §P5 defaults (plain object, never the caller's). Invalid values fall back. */
export function orderbookConfig(cfg) {
  const ob = cfg?.orderbook ?? {};
  const out = { ...ORDERBOOK_DEFAULTS };
  for (const k of Object.keys(ORDERBOOK_DEFAULTS)) if (Number.isFinite(ob[k]) && ob[k] > 0) out[k] = ob[k];
  out.levels = Math.max(1, Math.floor(out.levels));
  out.historySeconds = Math.max(1, Math.floor(out.historySeconds));
  return out;
}

/** Median of a numeric array (mean of the two middle values for an even count). NaN for an empty array. */
export function median(values) {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  const n = a.length;
  if (!n) return NaN;
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
}

/** One side's rows → [{price, qty}], finite and qty > 0 only; accepts {price,qty} objects or [price, qty] pairs. */
function parseSide(rows) {
  const out = [];
  for (const r of rows ?? []) {
    const price = Array.isArray(r) ? +r[0] : +r?.price, qty = Array.isArray(r) ? +r[1] : +r?.qty;
    if (Number.isFinite(price) && Number.isFinite(qty) && qty > 0) out.push({ price, qty });
  }
  return out;
}

/**
 * Normalise a BookSnapshot: bids best (highest) first, asks best (lowest) first, trimmed to `levels` per side,
 * non-finite / zero rows dropped. `t` is left as given (null when the source carried none).
 * @param {{t?:number, bids:Array, asks:Array, lastUpdateId?:number}} snap
 */
export function normalizeSnapshot(snap, { levels = ORDERBOOK_DEFAULTS.levels } = {}) {
  if (!snap || typeof snap !== 'object') throw new TypeError('orderbook: snapshot must be an object with bids and asks');
  const bids = parseSide(snap.bids).sort((a, b) => b.price - a.price).slice(0, levels);
  const asks = parseSide(snap.asks).sort((a, b) => a.price - b.price).slice(0, levels);
  const out = { t: Number.isFinite(snap.t) ? +snap.t : null, bids, asks };
  if (Number.isFinite(snap.lastUpdateId)) out.lastUpdateId = +snap.lastUpdateId;
  return out;
}

/**
 * Walls on one side: qty ≥ wallMult × median qty of that side's levels (the median INCLUDES the wall itself —
 * one 50-lot among nineteen 1-lots has median 1). `mult` = qty / median.
 * @returns {{side:'bid'|'ask', price:number, qty:number, mult:number}[]} in the side's own order (best first)
 */
export function findWalls(levels, side, wallMult = ORDERBOOK_DEFAULTS.wallMult) {
  if (!levels?.length) return [];
  const med = median(levels.map((l) => l.qty));
  if (!(med > 0)) return [];
  const out = [];
  for (const l of levels) if (l.qty >= wallMult * med - EPS) out.push({ side, price: l.price, qty: l.qty, mult: l.qty / med });
  return out;
}

/**
 * Pure summary numbers for one normalised snapshot (no history, no events): bestBid/bestAsk/mid/spread/spreadBp,
 * depths, imbalance ∈ [−1, 1] (bid-heavy positive), walls (ageMs 0) and nearestWall.
 */
export function summarizeSnapshot(snap, cfg) {
  const c = orderbookConfig(cfg);
  const s = normalizeSnapshot(snap, c);
  const bestBid = s.bids.length ? s.bids[0].price : null;
  const bestAsk = s.asks.length ? s.asks[0].price : null;
  const mid = bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : null;
  const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;
  const spreadBp = spread !== null && mid > 0 ? (spread / mid) * 10_000 : null;
  const bidDepth = s.bids.reduce((a, l) => a + l.qty, 0);
  const askDepth = s.asks.reduce((a, l) => a + l.qty, 0);
  const total = bidDepth + askDepth;
  const imbalance = total > 0 ? (bidDepth - askDepth) / total : 0;
  const bidWalls = findWalls(s.bids, 'bid', c.wallMult), askWalls = findWalls(s.asks, 'ask', c.wallMult);
  const walls = [...bidWalls, ...askWalls].map((w) => ({ ...w, ageMs: 0, refills: 0 })).sort((a, b) => a.price - b.price);
  return {
    t: s.t, bestBid, bestAsk, mid, spread, spreadBp, bidDepth, askDepth, imbalance,
    walls,
    nearestWall: { bid: walls.find((w) => w.side === 'bid' && w.price === bidWalls[0]?.price) ?? null, ask: walls.find((w) => w.side === 'ask' && w.price === askWalls[0]?.price) ?? null },
    pulled: [], absorbed: [], tradedThrough: [],
    levels: { bids: s.bids.map((l) => ({ ...l })), asks: s.asks.map((l) => ({ ...l })) },
  };
}

// ---------------------------------------------------------------------------------------------------------
// czt-side readers (§P5)
// ---------------------------------------------------------------------------------------------------------

/** condition.bookImbalance: |imbalance| ≥ imbalanceMin in the side's favour (long ⇐ bid-heavy, short ⇐ ask-heavy). */
export function bookImbalanceFavours(summary, side, imbalanceMin = ORDERBOOK_DEFAULTS.imbalanceMin) {
  if (!summary || !Number.isFinite(summary.imbalance)) return false;
  const long = side === 'long' || side === 'bullish' || side === 'bid';
  return long ? summary.imbalance >= imbalanceMin - EPS : summary.imbalance <= -imbalanceMin + EPS;
}

/**
 * trigger.bookAbsorption: the most recent absorbed wall in the side's favour (long ⇐ a BID wall absorbing market
 * sells; short ⇐ an ASK wall absorbing market buys) within `tolerance` of `price` and younger than `windowMs`.
 * @returns {object|null} the absorbed entry
 */
export function recentAbsorption(summary, { side, price, tolerance = Infinity, windowMs = ORDERBOOK_DEFAULTS.absorbWindowSec * 1000 } = {}) {
  if (!summary?.absorbed?.length) return null;
  const long = side === 'long' || side === 'bullish' || side === 'bid';
  const want = long ? 'bid' : 'ask';
  let best = null;
  for (const a of summary.absorbed) {
    if (a.side !== want) continue;
    if (Number.isFinite(a.ageMs) && a.ageMs > windowMs) continue;
    if (Number.isFinite(price) && Number.isFinite(tolerance) && Math.abs(a.price - price) > tolerance + EPS) continue;
    if (!best || a.ageMs < best.ageMs) best = a;
  }
  return best;
}

// ---------------------------------------------------------------------------------------------------------
// Stateful book
// ---------------------------------------------------------------------------------------------------------

/**
 * Visible top-of-book tracker. Feed it every depth snapshot (applySnapshot) and every trade (noteTrade);
 * read summary() / history(n). Memory: one tracked record per live wall, events for absorbWindowSec, and a
 * ring of historySeconds summaries (one per second).
 */
export class OrderBook {
  /** @param {{cfg?:object, tick?:number, now?:() => number}} o */
  constructor({ cfg, tick = null, now = null } = {}) {
    this.cfg = orderbookConfig(cfg);
    if (tick !== null && !(Number.isFinite(tick) && tick > 0)) throw new RangeError(`OrderBook: tick must be > 0, got ${tick}`);
    if (now !== null && typeof now !== 'function') throw new TypeError('OrderBook: now must be a function');
    this.tick = tick;
    this.now = now;
    this._t = null;             // time of the last snapshot
    this._snap = null;          // last normalised snapshot
    this._walls = new Map();    // key → tracked wall record
    this._events = [];          // { kind:'pulled'|'tradedThrough'|'absorbed', side, price, qty, lastQty, tradedQty, at, rec? }
    this._history = [];         // summaries, oldest→newest, ≤ historySeconds, one per second
    this._summary = null;       // cached summary for the last snapshot
    this._dirty = false;
    this.snapshots = 0;
    this.trades = 0;
    this.unobserved = 0;        // walls that vanished across a snapshot gap wider than pullWindowMs — nothing claimed
  }

  /** Price key: integer ticks when a tick is known, else the exact price. */
  _key(p) { return this.tick ? Math.round(p / this.tick) : p; }
  _wallKey(side, p) { return `${side}:${this._key(p)}`; }

  /** Ingest one BookSnapshot ({t?, bids, asks}; rows as {price,qty} or [price,qty]). Returns the new summary. */
  applySnapshot(snap) {
    const s = normalizeSnapshot(snap, this.cfg);
    let t = s.t;
    if (t === null) {
      if (!this.now) throw new TypeError('OrderBook.applySnapshot: snapshot has no t and no clock was injected');
      t = this.now();
    }
    if (this._t !== null && t < this._t) t = this._t;   // never let time run backwards (an out-of-order frame)
    s.t = t;
    const c = this.cfg;

    // 1. Walls present now, keyed by side:price.
    const present = new Map();
    for (const w of findWalls(s.bids, 'bid', c.wallMult)) present.set(this._wallKey('bid', w.price), w);
    for (const w of findWalls(s.asks, 'ask', c.wallMult)) present.set(this._wallKey('ask', w.price), w);

    // 2. Update tracked walls: refresh, refill, or start the disappearance clock.
    for (const [key, rec] of this._walls) {
      const w = present.get(key);
      if (w) {
        if (rec.missingSince !== null) { rec.refills++; rec.missingSince = null; }
        rec.qty = w.qty; rec.mult = w.mult; rec.lastSeen = t;
        if (w.qty > rec.peakQty) rec.peakQty = w.qty;
        present.delete(key);
      } else {
        if (rec.missingSince === null) rec.missingSince = t;
        if (t - rec.lastSeen >= c.pullWindowMs) this._finalise(rec, t);
      }
    }
    // 3. New walls.
    for (const [key, w] of present) {
      this._walls.set(key, { key, side: w.side, price: w.price, qty: w.qty, peakQty: w.qty, mult: w.mult, firstSeen: t, lastSeen: t, tradedQty: 0, missingSince: null, refills: 0, absorbedAt: null });
    }
    // 4. Absorption can also complete on a refill (trades printed during the dip count — the wall came back).
    for (const rec of this._walls.values()) this._checkAbsorbed(rec, t);

    this._expireEvents(t);
    this._t = t;
    this._snap = s;
    this.snapshots++;
    this._summary = this._build();
    this._dirty = false;
    this._record(this._summary);
    return this._summary;
  }

  /**
   * Executed volume. Only a print AT a tracked wall's price counts toward it (bid wall ⇐ sells hitting it, ask
   * wall ⇐ buys lifting it). Accumulates only — absorption is confirmed by the NEXT snapshot, which is the first
   * moment the wall is actually seen to have persisted (or refilled) after that volume traded into it.
   * @returns {boolean} true when the print landed on a tracked wall
   */
  noteTrade(trade) {
    const p = +trade?.p, q = +trade?.q;
    if (!(Number.isFinite(p) && Number.isFinite(q) && q > 0)) return false;
    if (!this._walls.size) return false;
    const k = this._key(p);
    let hit = false;
    for (const rec of this._walls.values()) {
      if (this._key(rec.price) !== k) continue;
      rec.tradedQty += q;
      hit = true;
      this.trades++;
    }
    if (hit) this._dirty = true;
    return hit;
  }

  /** The latest BookSummary (null before the first snapshot). A fresh plain object every call. */
  summary() {
    if (!this._snap) return null;
    if (this._dirty) { this._summary = this._build(); this._dirty = false; }
    return clone(this._summary);
  }

  /** Last `n` summaries, oldest→newest, one per second, bounded by historySeconds. */
  history(n = this.cfg.historySeconds) {
    const k = Math.max(0, Math.floor(n));
    return this._history.slice(Math.max(0, this._history.length - k)).map(clone);
  }

  /** The last normalised snapshot (levels best first), or null. */
  snapshot() { return this._snap ? clone(this._snap) : null; }

  clear() { this._walls.clear(); this._events.length = 0; this._history.length = 0; this._snap = null; this._summary = null; this._t = null; }

  // ---- internals ----
  _checkAbsorbed(rec, t) {
    if (rec.absorbedAt !== null) return;
    if (rec.missingSince !== null) return;                       // the wall must stand (or have come back) when the ratio is reached
    if (rec.peakQty <= 0 || rec.tradedQty < this.cfg.absorbRatio * rec.peakQty - EPS) return;
    rec.absorbedAt = t;
    this._events.push({ kind: 'absorbed', side: rec.side, price: rec.price, qty: rec.peakQty, lastQty: rec.qty, tradedQty: rec.tradedQty, at: t, rec });
    this._dirty = true;
  }

  /** The wall has been gone for pullWindowMs: pulled, traded through, or unobserved. */
  _finalise(rec, t) {
    this._walls.delete(rec.key);
    for (const ev of this._events) if (ev.rec === rec) { ev.tradedQty = rec.tradedQty; ev.rec = null; }
    if (rec.missingSince - rec.lastSeen > this.cfg.pullWindowMs) { this.unobserved++; return; }   // we were not watching when it went
    const kind = rec.tradedQty >= this.cfg.absorbRatio * rec.peakQty - EPS ? 'tradedThrough' : 'pulled';
    this._events.push({ kind, side: rec.side, price: rec.price, qty: rec.peakQty, lastQty: rec.qty, tradedQty: rec.tradedQty, at: rec.missingSince, rec: null });
    this._dirty = true;
  }

  _expireEvents(t) {
    const win = this.cfg.absorbWindowSec * 1000;
    this._events = this._events.filter((ev) => t - ev.at <= win);
  }

  _build() {
    const t = this._t, s = this._snap;
    const base = summarizeSnapshot({ ...s, t }, { orderbook: this.cfg });
    const walls = base.walls.map((w) => {
      const rec = this._walls.get(this._wallKey(w.side, w.price));
      return rec ? { ...w, ageMs: t - rec.firstSeen, refills: rec.refills, tradedQty: rec.tradedQty } : { ...w, tradedQty: 0 };
    });
    const ev = (kind) => this._events.filter((e) => e.kind === kind)
      .map((e) => ({ side: e.side, price: e.price, qty: e.qty, lastQty: e.rec ? e.rec.qty : e.lastQty, tradedQty: e.rec ? e.rec.tradedQty : e.tradedQty, at: e.at, ageMs: Math.max(0, t - e.at) }))
      .sort((a, b) => a.ageMs - b.ageMs || a.price - b.price);
    return {
      ...base, walls,
      nearestWall: {
        bid: walls.filter((w) => w.side === 'bid').sort((a, b) => b.price - a.price)[0] ?? null,
        ask: walls.filter((w) => w.side === 'ask').sort((a, b) => a.price - b.price)[0] ?? null,
      },
      pulled: ev('pulled'), absorbed: ev('absorbed'), tradedThrough: ev('tradedThrough'),
    };
  }

  /** One summary per second: a second frame inside the same second replaces the first; bounded by count and by age. */
  _record(summary) {
    const sec = Math.floor(summary.t / 1000);
    const h = this._history;
    if (h.length && Math.floor(h[h.length - 1].t / 1000) === sec) h[h.length - 1] = summary; else h.push(summary);
    const minT = summary.t - this.cfg.historySeconds * 1000;
    while (h.length && (h.length > this.cfg.historySeconds || h[0].t < minT)) h.shift();
  }
}

/** Deep plain copy (summaries hold only numbers, strings, nulls, arrays and plain objects). */
const clone = (o) => structuredClone(o);
