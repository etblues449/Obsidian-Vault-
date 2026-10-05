// Shared test helpers (SPEC.md §8): deterministic candle generators, pattern injectors that shape
// a candle array into the exact structures the engine looks for, the real BTC fixture, and fakes
// for the clock, WebSocket and fetch so feed/server tests run offline and deterministically.
//
// Every injector MUTATES the array it is given and returns it, so calls chain:
//   withSweepBelow(withFvg(mkCandles({n: 300}), {atIndex: 120, side: 'bullish'}), {...})
// After reshaping a candle, the next candle's open is re-anchored to the new close (and later
// candles shifted when the injector moves price) so the series stays continuous — an injector
// must not accidentally create a second FVG or gap the engine would also detect.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** xorshift32 → () => float in [0, 1). Same seed, same sequence, on every platform. */
export function xorshift(seed = 1) {
  let x = (seed >>> 0) || 0x9e3779b9;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x / 0x100000000;
  };
}

/**
 * Deterministic 1m candles (closed) with buyV/sellV whose sign follows the candle direction.
 * `vol` is a per-candle relative move scale; `drift` a relative per-candle bias (0.0005 = +0.05 %/candle).
 */
export function mkCandles({ n, start = Date.UTC(2026, 0, 5), step = 60000, price = 100, drift = 0, vol = 0.002, seed = 1, volume = 10 } = {}) {
  if (!Number.isInteger(n) || n < 1) throw new RangeError('mkCandles needs n ≥ 1');
  const rnd = xorshift(seed);
  const out = [];
  let o = price;
  for (let i = 0; i < n; i++) {
    const r = (rnd() + rnd() + rnd() - 1.5) * vol * o + drift * o; // bell-ish move
    const c = o + r;
    const h = Math.max(o, c) + rnd() * vol * o * 0.5;
    const l = Math.min(o, c) - rnd() * vol * o * 0.5;
    const v = volume * (0.5 + rnd());
    const bias = 0.5 + 0.3 * Math.sign(r) * rnd();
    const buyV = v * bias, sellV = v - buyV;
    out.push({ t: start + i * step, o, h, l, c, v, buyV, sellV, n: Math.max(1, Math.round(v * 5)), closed: true });
    o = c;
  }
  return out;
}

const meanRange = (candles, upto, k = 20) => {
  const s = candles.slice(Math.max(0, upto - k), Math.max(1, upto));
  return s.reduce((a, c) => a + (c.h - c.l), 0) / s.length || candles[0].o * 0.002;
};
const meanVol = (candles, upto, k = 20) => {
  const s = candles.slice(Math.max(0, upto - k), Math.max(1, upto));
  return s.reduce((a, c) => a + c.v, 0) / s.length || 1;
};
const fixHL = (c) => { c.h = Math.max(c.h, c.o, c.c); c.l = Math.min(c.l, c.o, c.c); return c; };
/** Re-anchor candles[i+1].o to candles[i].c without changing their ranges beyond what that needs. */
const reanchor = (candles, i) => { if (candles[i + 1]) { candles[i + 1].o = candles[i].c; fixHL(candles[i + 1]); } };
/** Shift every candle from index `from` by `d` (keeps the series continuous after a displacement). */
const shiftFrom = (candles, from, d) => { for (let i = from; i < candles.length; i++) { const c = candles[i]; c.o += d; c.h += d; c.l += d; c.c += d; } };
const setFlow = (c, buyFrac) => { c.buyV = c.v * buyFrac; c.sellV = c.v - c.buyV; };

/** Candle `atIndex` wicks `depth` below `level` and (by default) closes back above it — a manipulation low (source 01). */
export function withSweepBelow(candles, { atIndex, level, depth, reclaim = true }) {
  const c = candles[atIndex];
  if (!c) throw new RangeError(`withSweepBelow: no candle at ${atIndex}`);
  c.o = Math.max(c.o, level + depth * 0.5);
  c.l = level - depth;
  c.c = reclaim ? level + depth : level - depth * 0.5;
  fixHL(c);
  if (reclaim) setFlow(c, 0.35); // heavy sells hit the bid into the low, buyers absorb (source 05)
  reanchor(candles, atIndex);
  return candles;
}

/** Mirror of withSweepBelow: wick above `level`, close back below when `reclaim`. */
export function withSweepAbove(candles, { atIndex, level, depth, reclaim = true }) {
  const c = candles[atIndex];
  if (!c) throw new RangeError(`withSweepAbove: no candle at ${atIndex}`);
  c.o = Math.min(c.o, level - depth * 0.5);
  c.h = level + depth;
  c.c = reclaim ? level - depth : level + depth * 0.5;
  fixHL(c);
  if (reclaim) setFlow(c, 0.65);
  reanchor(candles, atIndex);
  return candles;
}

/**
 * Three-candle displacement ending at `atIndex` that leaves a fair value gap of `sizeMult` × mean range:
 * bullish ⇒ candles[atIndex-2].h < candles[atIndex].l. Later candles are shifted so price continues
 * from the new level and the gap stays unmitigated until a test says otherwise.
 */
export function withFvg(candles, { atIndex, side, sizeMult = 1, displacementMult = 2 }) {
  if (atIndex < 2 || !candles[atIndex]) throw new RangeError(`withFvg: atIndex must be ≥ 2 and < ${candles.length}`);
  const dir = side === 'bullish' ? 1 : -1;
  const base = meanRange(candles, atIndex - 2);
  const gap = sizeMult * base;
  const c0 = candles[atIndex - 2], c1 = candles[atIndex - 1], c2 = candles[atIndex];
  const edge0 = dir > 0 ? c0.h : c0.l;      // the gap's near edge is c0's extreme
  const oldC2c = c2.c;
  c1.o = c0.c;
  c1.c = edge0 + dir * (gap + displacementMult * base);
  c1.h = Math.max(c1.o, c1.c) + base * 0.1; c1.l = Math.min(c1.o, c1.c) - base * 0.1;
  c1.v = Math.max(c1.v, 2 * meanVol(candles, atIndex - 2));
  setFlow(c1, dir > 0 ? 0.75 : 0.25);
  c2.o = c1.c;
  const gapFar = edge0 + dir * gap;          // c2's extreme stays beyond the gap
  c2.c = c2.o + dir * base * 0.3;
  if (dir > 0) { c2.l = Math.max(gapFar + base * 0.05, Math.min(c2.o, c2.c) - base * 0.1); c2.h = Math.max(c2.o, c2.c) + base * 0.2; }
  else { c2.h = Math.min(gapFar - base * 0.05, Math.max(c2.o, c2.c) + base * 0.1); c2.l = Math.min(c2.o, c2.c) - base * 0.2; }
  fixHL(c2);
  shiftFrom(candles, atIndex + 1, c2.c - oldC2c);
  reanchor(candles, atIndex);
  return candles;
}

/**
 * Order block at `atIndex`: the last opposite-coloured candle, then a displacement candle whose
 * body is several ATR, then a candle that leaves an FVG (source 04: enter at the order block after the sweep).
 * Bullish ⇒ candles[atIndex] is bearish and candles[atIndex+2].l > candles[atIndex].h.
 */
export function withOrderBlock(candles, { atIndex, side, sizeMult = 1 }) {
  if (!candles[atIndex + 2]) throw new RangeError('withOrderBlock: needs atIndex + 2 < length');
  const dir = side === 'bullish' ? 1 : -1;
  const base = meanRange(candles, atIndex);
  const ob = candles[atIndex];
  ob.o = candles[atIndex - 1] ? candles[atIndex - 1].c : ob.o;
  ob.c = ob.o - dir * base * 0.6;           // opposite colour
  ob.h = Math.max(ob.o, ob.c) + base * 0.15; ob.l = Math.min(ob.o, ob.c) - base * 0.15;
  setFlow(ob, dir > 0 ? 0.4 : 0.6);
  reanchor(candles, atIndex);
  return withFvg(candles, { atIndex: atIndex + 2, side, sizeMult });
}

/**
 * Absorption candle at `atIndex` (source 05): high volume, small range, long wick against the side,
 * delta signed against the move — bullish: lower wick, heavy sells hit the bid, closes back up.
 */
export function withAbsorption(candles, { atIndex, side, volMult = 3 }) {
  const c = candles[atIndex];
  if (!c) throw new RangeError(`withAbsorption: no candle at ${atIndex}`);
  const dir = side === 'bullish' ? 1 : -1;
  const range = 0.4 * meanRange(candles, atIndex);
  c.o = candles[atIndex - 1] ? candles[atIndex - 1].c : c.o;
  c.c = c.o + dir * range * 0.1;
  if (dir > 0) { c.l = Math.min(c.o, c.c) - range * 0.75; c.h = Math.max(c.o, c.c) + range * 0.15; }
  else { c.h = Math.max(c.o, c.c) + range * 0.75; c.l = Math.min(c.o, c.c) - range * 0.15; }
  c.v = volMult * meanVol(candles, atIndex);
  c.n = Math.round(c.v * 5);
  setFlow(c, dir > 0 ? 0.35 : 0.65);       // bullish absorption prints negative delta
  reanchor(candles, atIndex);
  return candles;
}

/**
 * CVD divergence over 20 candles from `fromIndex` (source 05, "effort failing to produce result"):
 * bearish ⇒ price prints a swing high, pulls back, then a HIGHER high while cumulative delta
 * (buyV−sellV) peaks LOWER on the second high. Bullish is the mirror. Swings confirm with lookback ≤ 3.
 */
export function withCvdDivergence(candles, { fromIndex, side }) {
  const LEN = 20;
  if (fromIndex < 1 || fromIndex + LEN > candles.length) throw new RangeError(`withCvdDivergence: needs 1 ≤ fromIndex and fromIndex + ${LEN} ≤ length`);
  const dir = side === 'bearish' ? 1 : -1;   // direction of the "price makes a new extreme" legs
  const base = meanRange(candles, fromIndex);
  const v = meanVol(candles, fromIndex);
  // [move in base units, buy fraction] per candle: leg1 (strong flow), pullback, leg2 (weak flow → lower CVD peak), confirm
  const plan = [
    ...Array(6).fill([0.8, 0.8]),
    ...Array(4).fill([-0.5, 0.35]),
    ...Array(7).fill([0.8, 0.4]),
    ...Array(3).fill([-0.6, 0.35]),
  ];
  const oldLastC = candles[fromIndex + LEN - 1].c;
  let o = candles[fromIndex - 1].c;
  plan.forEach(([move, buyFrac], k) => {
    const c = candles[fromIndex + k];
    c.o = o;
    c.c = o + dir * move * base;
    // Wick 0.1·base beyond the close in the move direction, 0.05·base beyond the open against it, so the
    // last candle of a leg holds a STRICT extreme (a reversal candle's wick never ties with it).
    const up = c.c > c.o;
    c.h = up ? c.c + base * 0.1 : c.o + base * 0.05;
    c.l = up ? c.o - base * 0.05 : c.c - base * 0.1;
    c.v = v;
    setFlow(c, dir > 0 ? buyFrac : 1 - buyFrac);
    o = c.c;
  });
  shiftFrom(candles, fromIndex + LEN, o - oldLastC);
  reanchor(candles, fromIndex + LEN - 1);
  return candles;
}

let fixtureCache = null;
/** The 2000 real Binance BTCUSDT 1m candles (closed, with buyV/sellV/n). Returns a fresh deep copy. */
export function loadFixture() {
  if (!fixtureCache) fixtureCache = JSON.parse(readFileSync(resolve(HERE, 'fixtures', 'btc-1m.json'), 'utf8'));
  return structuredClone(fixtureCache);
}

/**
 * Virtual clock + timers. `run(untilMs)` fires every due timer in time order (timers scheduled while
 * running fire too if due), then sets now = untilMs. `tick(ms)` = run(now + ms).
 */
export function fakeClock(startMs = Date.UTC(2026, 0, 5)) {
  let now = startMs, seq = 0;
  const timers = new Map(); // id → {at, fn, args, every}
  // Handles look like Node's Timeout (unref/ref/hasRef) and coerce to their numeric id, so adapter code
  // written against real timers (`t.unref?.()`, `clearTimeout(t)`) runs unchanged.
  const handle = (id) => ({ id, unref() { return this; }, ref() { return this; }, hasRef: () => true, [Symbol.toPrimitive]: () => id });
  const schedule = (fn, ms, every, args) => { const id = ++seq; timers.set(id, { at: now + Math.max(0, Number(ms) || 0), fn, args, every }); return handle(id); };
  const cancel = (h) => { timers.delete(h && typeof h === 'object' ? h.id : Number(h)); };
  const clock = {
    now: () => now,
    setTimeout: (fn, ms, ...args) => schedule(fn, ms, null, args),
    clearTimeout: cancel,
    setInterval: (fn, ms, ...args) => schedule(fn, ms, Math.max(1, Number(ms) || 1), args),
    clearInterval: cancel,
    pending: () => timers.size,
    run(untilMs) {
      for (;;) {
        let nextId = null, next = null;
        for (const [id, tm] of timers) if (tm.at <= untilMs && (!next || tm.at < next.at || (tm.at === next.at && id < nextId))) { next = tm; nextId = id; }
        if (!next) break;
        now = Math.max(now, next.at);
        if (next.every) next.at += next.every; else timers.delete(nextId);
        next.fn(...next.args);
      }
      now = Math.max(now, untilMs);
      return now;
    },
    tick(ms) { return clock.run(now + ms); },
    /** Resolve microtasks between timer steps: `await clock.flush()` */
    flush: () => new Promise((r) => setImmediate(r)),
  };
  return clock;
}

/**
 * Returns a WebSocket-compatible class. Tests drive instances: `.open()`, `.message(obj)`,
 * `.close(code, reason)`, `.error(err)`; the adapter's sends land in `.sent[]` (parsed when JSON).
 * `FakeWS.instances` lists every socket constructed, newest last.
 */
export function fakeWebSocket() {
  class FakeWS {
    static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
    static instances = [];
    static last() { return FakeWS.instances[FakeWS.instances.length - 1]; }
    constructor(url, protocols) {
      this.url = String(url); this.protocols = protocols;
      this.readyState = 0; this.sent = []; this.closedWith = null;
      this._listeners = new Map();
      FakeWS.instances.push(this);
    }
    addEventListener(type, fn) { if (!this._listeners.has(type)) this._listeners.set(type, new Set()); this._listeners.get(type).add(fn); }
    removeEventListener(type, fn) { this._listeners.get(type)?.delete(fn); }
    dispatch(type, ev) {
      const event = { type, target: this, ...ev };
      if (typeof this['on' + type] === 'function') this['on' + type](event);
      for (const fn of this._listeners.get(type) || []) fn(event);
    }
    send(data) {
      if (this.readyState !== 1) throw new Error(`InvalidStateError: send() while readyState=${this.readyState}`);
      let parsed = data;
      if (typeof data === 'string') { try { parsed = JSON.parse(data); } catch { /* keep raw */ } }
      this.sent.push(parsed);
    }
    open() { this.readyState = 1; this.dispatch('open', {}); return this; }
    message(obj) { this.dispatch('message', { data: typeof obj === 'string' ? obj : JSON.stringify(obj) }); return this; }
    error(err = new Error('socket error')) { this.dispatch('error', { error: err, message: err.message }); return this; }
    close(code = 1000, reason = '') {
      if (this.readyState === 3) return this;
      this.readyState = 3; this.closedWith = { code, reason };
      this.dispatch('close', { code, reason, wasClean: code === 1000 });
      return this;
    }
    terminate() { return this.close(1006, 'terminated'); }
  }
  return FakeWS;
}

/**
 * fetch stand-in. `routes`: { [substringOrRegex]: spec | (url, opts, call) => spec } (object, Map or
 * array of pairs). spec = { status=200, json?, text?, headers?={} } or an Error to throw (network failure).
 * Unmatched URLs → 404. Every call is recorded in `fetch.calls` as { url, opts, t }.
 */
export function fakeFetch(routes = {}) {
  // An object-literal key is always a string, so a RegExp key arrives as "/…/flags" — turn it back into one.
  const matcher = (m) => {
    if (m instanceof RegExp) return m;
    const re = /^\/(.+)\/([gimsuy]*)$/.exec(String(m));
    return re ? new RegExp(re[1], re[2]) : String(m);
  };
  const list = (routes instanceof Map ? [...routes] : Array.isArray(routes) ? routes : Object.entries(routes)).map(([m, r]) => [matcher(m), r]);
  const fetch = async (url, opts = {}) => {
    url = String(url);
    const call = { url, opts, i: fetch.calls.length };
    fetch.calls.push(call);
    const hit = list.find(([m]) => (m instanceof RegExp ? m.test(url) : url.includes(m)));
    let spec = hit ? hit[1] : { status: 404, text: 'not found' };
    if (typeof spec === 'function') spec = await spec(url, opts, call);
    if (spec instanceof Error) throw spec;
    const { status = 200, json, text, headers = {} } = spec || {};
    const body = text !== undefined ? String(text) : json !== undefined ? JSON.stringify(json) : '';
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers(headers),
      json: async () => (json !== undefined ? structuredClone(json) : JSON.parse(body)),
      text: async () => body,
    };
  };
  fetch.calls = [];
  return fetch;
}
