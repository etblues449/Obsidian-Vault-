// lib/engine/liquidity.mjs — where resting liquidity sits (levels) and when it gets taken (sweeps).
// SPEC.md §4.4. Pure over the inputs: `now` is a parameter, never Date.now().
//
// Sources: 02 ("liquidity at previous highs and previous lows … above and below consolidating
// areas"; "wait for London / New York to sweep it, then target the next portion of liquidity");
// 03 (Asia = consolidation, London = manipulation — hence the Asia range as a first-class level);
// 04 ("equal highs and equal lows" are liquidity; "buy-side taken → target sell-side").
//
// Session / day resolution comes from ./sessions.mjs (localParts, sessionBounds,
//   dayBounds, shiftDayKey, resolveSession) — one DST implementation. (Review finding liquidity.mjs:137
//   / structure.mjs:176: the private Intl clock here disagreed with sessions.zonedTimeToUtc at 119 minutes
//   inside the 01:00–01:59 local hour on the two 2026 DST days; the helper block is gone.)
// DEVIATION: swings come from ./structure.mjs findSwings (same contract as indicators.swings).
// Additive (not in SPEC): computeLevels takes `prev` (previous Level[]; `swept` is carried over by
//   id so a recompute never forgets a purge), `swingLookback` and `htfTf`; Level.swept also records
//   `reclaimed`/`reclaimedT`; detectSweeps recognises a delayed reclaim — the close back on the
//   original side within liqCfg.sweepReclaimCandles (default 3) candles after an unreclaimed sweep —
//   and reports `reclaimedAfter` (0 = same candle). Level.swept is `null` rather than absent.
// Additive (review finding liquidity.mjs:137, source 01 "swept below the previous candle's low"): kinds
//   `prevCandleLow` / `prevCandleHigh` = the last CLOSED `htfTf` (default cfg.timeframes.htf, 4h) candle's
//   l / h, so the manipulation of the prior 4h low is a first-class sweep (weight key zone.prevCandle).

import { findSwings } from './structure.mjs';
import { localParts, sessionBounds, dayBounds, shiftDayKey, resolveSession } from './sessions.mjs';

const TF_MS = { '1m': 60e3, '5m': 3e5, '15m': 9e5, '1h': 36e5, '4h': 144e5 }; // mirror of candles.mjs
const TF_ORDER = ['1m', '5m', '15m', '1h', '4h'];
const BUY_SIDE = new Set(['pdh', 'sessionHigh', 'asiaHigh', 'equalHighs', 'consolidationHigh', 'vah', 'prevCandleHigh']);
const NOT_LIQUIDITY = new Set(['lvn']);   // zones price reacts at (source 05 §5), not pools of resting stops — detectSweeps ignores them

/** Buy-side liquidity sits ABOVE price (highs); sell-side BELOW (lows). */
export function levelSide(kind) { return BUY_SIDE.has(kind) ? 'buy-side' : 'sell-side'; }

function mkLevel(kind, price, t, tf, meta) {
  return { id: `${kind}:${t}:${Math.round(price * 1e6) / 1e6}`, kind, price, t, tf, side: levelSide(kind), meta, swept: null };
}

/** Highest high / lowest low of candles with fromMs ≤ t < toMs (candles oldest→newest). */
function rangeIn(candles, fromMs, toMs) {
  let high = -Infinity, low = Infinity, tHigh = 0, tLow = 0, n = 0;
  for (let i = candles.length - 1; i >= 0; i--) {
    const c = candles[i];
    if (c.t >= toMs) continue;
    if (c.t < fromMs) break;
    n++;
    if (c.h > high) { high = c.h; tHigh = c.t; }
    if (c.l < low) { low = c.l; tLow = c.t; }
  }
  return n ? { high, low, tHigh, tLow, n } : null;
}

/** Finest closed series that reaches back to fromMs (1m normally; coarser TFs if the ring is short). */
function covering(store, fromMs) {
  let first = null;
  for (const tf of TF_ORDER) {
    const cs = store.closed(tf) || [];
    if (!cs.length) continue;
    if (cs[0].t <= fromMs) return cs;
    first ??= cs;
  }
  return first || [];
}

function parseHm(x) { const [h, m] = String(x).split(':').map(Number); return h * 60 + (m || 0); }

/** Greedy price clusters of swings: a swing joins when within `tol` of the cluster mean. */
function clusterSwings(swings, tol) {
  const sorted = swings.slice().sort((a, b) => a.price - b.price), out = [];
  let cur = null, sum = 0;
  for (const s of sorted) {
    if (cur && Math.abs(s.price - sum / cur.length) <= tol) { cur.push(s); sum += s.price; }
    else { cur = [s]; sum = s.price; out.push(cur); }
  }
  return out.filter(c => c.length >= 2);
}

/** Same kind within `tol` of an earlier level → keep the earlier one. */
export function dedupeLevels(levels, tol) {
  const kept = [];
  for (const l of levels) {
    const dup = kept.find(k => k.kind === l.kind && Math.abs(k.price - l.price) <= tol);
    if (dup) { if (dup.meta && l.meta?.count) dup.meta.count = (dup.meta.count || 1) + l.meta.count; continue; }
    kept.push(l);
  }
  return kept;
}

/**
 * All resting liquidity visible right now, highest price first.
 * - pdh/pdl: previous LOCAL day's range (sessionsCfg.timezone, DST-aware).
 * - sessionHigh/Low: the session before the one `now` is in.
 * - asiaHigh/Low: today's Asia range (partial while forming → meta.complete=false), else yesterday's.
 * - prevCandleHigh/Low: the last closed `htfTf` candle's h / l (source 01: "swept below the previous candle's low").
 * - equalHighs/Lows: ≥ 2 swing highs (lows) on `tf` within equalLevelToleranceAtr × ATR → one level
 *   at their mean, meta.count. Dropped once a candle other than the last closed one has CLOSED
 *   through them by more than the tolerance — that liquidity has been taken (source 04); the last
 *   closed candle is exempt so detectSweeps can still see the level it just ran.
 * - consolidationHigh/Low: the `consolidationCandles` candles BEFORE the last closed one, when their
 *   total range ≤ consolidationMaxRangeAtr × ATR (the last candle is the candidate sweeper).
 * Levels older than levelExpiryHours are dropped; same-kind levels within tolerance are merged.
 */
export function computeLevels({ store, tf, atr, sessionsCfg, liqCfg = {}, now, prev, swingLookback, htfTf = '4h' }) {
  const tz = sessionsCfg?.timezone || 'UTC';
  const list = Array.isArray(sessionsCfg?.list) ? sessionsCfg.list : [];
  const sCfg = { timezone: tz, list };
  const tfCandles = store.closed(tf) || [];
  if (now == null) now = tfCandles.length ? tfCandles[tfCandles.length - 1].t + (TF_MS[tf] || 0) : null;
  if (!Number.isFinite(now)) return [];
  const atrOk = Number.isFinite(atr) && atr > 0;
  const tol = atrOk ? (liqCfg.equalLevelToleranceAtr ?? 0.15) * atr : 0;
  const clock = localParts(now, tz);
  const levels = [];

  // 1. Previous day high / low (source 02: "previous highs and previous lows").
  const prevDay = shiftDayKey(clock.dayKey, -1);
  const { startMs: dayFrom, endMs: dayTo } = dayBounds(prevDay, sCfg);
  const rd = rangeIn(covering(store, dayFrom), dayFrom, dayTo);
  if (rd) {
    levels.push(mkLevel('pdh', rd.high, rd.tHigh, '1m', { dayKey: prevDay, candles: rd.n }));
    levels.push(mkLevel('pdl', rd.low, rd.tLow, '1m', { dayKey: prevDay, candles: rd.n }));
  }

  if (list.length) {
    // 2. Previous session high / low (source 02: "purged during London, entry during New York").
    const cur = resolveSession(now, sCfg);
    let idx = list.findIndex(x => x.id === cur.id);
    if (idx < 0) { // a gap in the list (config validation forbids it): the latest session that has started today
      let best = -1;
      list.forEach((x, k) => { const m = parseHm(x.start); if (m <= clock.minutes && (best < 0 || m >= parseHm(list[best].start))) best = k; });
      idx = best >= 0 ? best : 0;
    }
    const prevIdx = (idx - 1 + list.length) % list.length;
    const prevDayKey = idx === 0 ? shiftDayKey(clock.dayKey, -1) : clock.dayKey;
    const spec = list[prevIdx], w = sessionBounds(prevDayKey, spec.id, sCfg);
    const rs = rangeIn(covering(store, w.startMs), w.startMs, Math.min(w.endMs, now));
    if (rs) {
      const meta = { sessionId: spec.id, label: spec.label, dayKey: prevDayKey, startMs: w.startMs, endMs: w.endMs, candles: rs.n };
      levels.push(mkLevel('sessionHigh', rs.high, rs.tHigh, '1m', meta));
      levels.push(mkLevel('sessionLow', rs.low, rs.tLow, '1m', { ...meta }));
    }
    // 3. Asia range (source 03: Asia consolidates, London manipulates it).
    if (list.some(x => x.id === 'asia')) {
      for (const dk of [clock.dayKey, shiftDayKey(clock.dayKey, -1)]) {
        const wa = sessionBounds(dk, 'asia', sCfg);
        if (wa.startMs > now) continue;
        const ra = rangeIn(covering(store, wa.startMs), wa.startMs, Math.min(wa.endMs, now));
        if (!ra) continue;
        const meta = { sessionId: 'asia', dayKey: dk, startMs: wa.startMs, endMs: wa.endMs, complete: now >= wa.endMs, candles: ra.n };
        levels.push(mkLevel('asiaHigh', ra.high, ra.tHigh, '1m', meta));
        levels.push(mkLevel('asiaLow', ra.low, ra.tLow, '1m', { ...meta }));
        break;
      }
    }
  }

  // 3b. The previous higher-timeframe candle (source 01: "we have obviously swept below the previous candle's low").
  //     Pushed AFTER the session levels so that, on an exact price tie, the session level stays the named pool.
  if (htfTf && TF_MS[htfTf]) {
    const hc = store.closed(htfTf) || [];
    const last = hc.length ? hc[hc.length - 1] : null;
    if (last && Number.isFinite(last.h) && Number.isFinite(last.l) && last.t + TF_MS[htfTf] <= now) {
      const meta = { tf: htfTf, startMs: last.t, endMs: last.t + TF_MS[htfTf] };
      levels.push(mkLevel('prevCandleHigh', last.h, last.t, htfTf, meta));
      levels.push(mkLevel('prevCandleLow', last.l, last.t, htfTf, { ...meta }));
    }
  }

  if (atrOk && tfCandles.length) {
    // 4. Equal highs / lows (source 04).
    const swings = findSwings(tfCandles, swingLookback ?? liqCfg.swingLookback ?? 2);
    const lastIdx = tfCandles.length - 1;
    for (const kind of ['high', 'low']) {
      for (const cl of clusterSwings(swings.filter(s => s.kind === kind), tol)) {
        const price = cl.reduce((s, x) => s + x.price, 0) / cl.length;
        const first = cl.reduce((a, b) => (a.index < b.index ? a : b));
        let taken = false;
        for (let j = first.index + 1; j < lastIdx && !taken; j++) {
          const c = tfCandles[j].c;
          taken = kind === 'high' ? c > price + tol : c < price - tol;
        }
        if (taken) continue;
        levels.push(mkLevel(kind === 'high' ? 'equalHighs' : 'equalLows', price, first.t, tf,
          { count: cl.length, swings: cl.map(s => ({ t: s.t, price: s.price })).sort((a, b) => a.t - b.t) }));
      }
    }
    // 5. Consolidation range (source 02: "above consolidating areas and below consolidating areas").
    const nC = liqCfg.consolidationCandles ?? 12;
    if (tfCandles.length > nC) {
      const win = tfCandles.slice(lastIdx - nC, lastIdx), rc = rangeIn(win, -Infinity, Infinity);
      const rangeAtr = (rc.high - rc.low) / atr;
      if (rangeAtr <= (liqCfg.consolidationMaxRangeAtr ?? 2.5)) {
        const meta = { candles: nC, rangeAtr, startMs: win[0].t, endMs: win[nC - 1].t };
        levels.push(mkLevel('consolidationHigh', rc.high, win[0].t, tf, meta));
        levels.push(mkLevel('consolidationLow', rc.low, win[0].t, tf, { ...meta }));
      }
    }
  }

  const expiryMs = (liqCfg.levelExpiryHours ?? 72) * 36e5;
  const out = dedupeLevels(levels.filter(l => now - l.t <= expiryMs), tol);
  if (prev?.length) {
    const sw = new Map(prev.filter(p => p.swept).map(p => [p.id, p.swept]));
    for (const l of out) if (sw.has(l.id)) l.swept = { ...sw.get(l.id) };
  }
  return out.sort((a, b) => b.price - a.price);
}

/**
 * Sweeps by the LAST closed candle (a trailing forming candle is ignored). For a buy-side level the
 * candle must come from below it (its open or the prior close is on the original side, allowing a
 * sub-threshold poke) and wick above it by depth ∈ [sweepMinDepthAtr, sweepMaxDepthAtr] × ATR;
 * `reclaimed` = closed back below (the manipulation that source 01/02 trade). Sell-side mirrored.
 * A level already swept is not re-swept, but if it was NOT reclaimed and this candle closes back on
 * the original side within sweepReclaimCandles of the sweep, a reclaimed Sweep is emitted
 * (depth = the deepest excursion since; if that ran past the max depth it was a breakout, not a
 * sweep, and nothing is emitted). Mutates `level.swept`. Deepest first.
 */
export function detectSweeps({ candles, levels, atr, liqCfg = {} }) {
  if (!Number.isFinite(atr) || atr <= 0 || !candles?.length || !levels?.length) return [];
  let i = candles.length - 1;
  while (i >= 0 && candles[i].closed === false) i--;
  if (i < 0) return [];
  const c = candles[i], prevClose = i > 0 ? candles[i - 1].c : c.o;
  const minD = (liqCfg.sweepMinDepthAtr ?? 0.05) * atr, maxD = (liqCfg.sweepMaxDepthAtr ?? 2) * atr;
  const window = liqCfg.sweepReclaimCandles ?? 3;
  const out = [];
  for (const level of levels) {
    const P = level.price;
    if (!Number.isFinite(P) || NOT_LIQUIDITY.has(level.kind)) continue; // a low-volume node holds no resting orders: nothing to sweep
    const up = (level.side || levelSide(level.kind)) === 'buy-side';
    const beyond = x => (up ? x - P : P - x);           // signed excursion past the level
    const ext = x => (up ? x.h : x.l);                  // the candle's far extreme
    const back = up ? c.c < P : c.c > P;                // closed on the original side
    if (level.swept) {
      if (level.swept.reclaimed) continue;
      let k = i - 1;
      while (k >= 0 && i - k <= window && candles[k].t !== level.swept.t) k--;
      if (k < 0 || i - k > window || !back) continue;
      let depth = level.swept.depth;
      for (let j = k + 1; j <= i; j++) depth = Math.max(depth, beyond(ext(candles[j])));
      if (depth > maxD) continue;
      Object.assign(level.swept, { reclaimed: true, reclaimedT: c.t, depth });
      out.push({ t: c.t, level, depth, depthAtr: depth / atr, reclaimed: true, candle: c, reclaimedAfter: i - k });
      continue;
    }
    const depth = beyond(ext(c));
    if (depth < minD || depth > maxD) continue;
    const origin = up ? Math.min(c.o, prevClose) : Math.max(c.o, prevClose);
    if (beyond(origin) > minD) continue;                // price was already beyond the level: not a sweep
    level.swept = { t: c.t, depth, reclaimed: back, reclaimedT: back ? c.t : null };
    out.push({ t: c.t, level, depth, depthAtr: depth / atr, reclaimed: back, candle: c, reclaimedAfter: 0 });
  }
  return out.sort((a, b) => b.depthAtr - a.depthAtr);
}
