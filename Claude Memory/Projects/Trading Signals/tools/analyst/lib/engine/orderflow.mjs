// lib/engine/orderflow.mjs — executed flow (SPEC.md §4.6): per-candle delta, CVD and its divergence,
// absorption, effort-vs-result, volume profile (POC / value area / HVN / LVN / shape) and naked POCs.
//
// Source 05 (Rogers order-flow masterclass) is implemented literally and cited inline. Everything here
// is "executed flow" — irreversible prints — never resting-book guesses (source 05 §2). Pure functions,
// no state, no clock: `now` is a parameter of nakedPocs, never Date.now().
//
// DEVIATION (additive, SPEC §4.6): cvdDivergence also returns prevPriceSwing / prevCvdSwing / age so
//   czt can tell a fresh divergence from a stale one; detectAbsorption returns deltaSource, meanVol,
//   volMult, rangeAtr, wick alongside the spec fields.
// DEVIATION (SPEC §4.6, delta ≤ 0 / ≥ 0 in detectAbsorption): when a candle carries no aggressor
//   volume the delta is the body/range proxy (indicators.delta, source:'proxy'). A proxy delta's sign IS
//   the body direction, so "heavy sells but closes back up" (source 05 §4) can never satisfy delta ≤ 0.
//   For proxy candles the sign test is skipped — the volume/range/wick/close signature carries the
//   detection — and the result says `deltaSource:'proxy'` so the dashboard/journal can label it honestly.
// Review finding orderflow.mjs:115: source 05 §4 — bullish absorption "forms a lower wick and CLOSES BACK
//   UP", bearish "closes back down". detectAbsorption now requires c ≥ o (bullish) / c ≤ o (bearish); a
//   doji satisfies both and the wick ratio breaks the tie. A red bar with a long lower wick is a sell-off, not absorption.
// Review finding orderflow.mjs:193: the value area is the SPEC §4.6 literal — the smallest contiguous bucket
//   window containing the POC whose volume ≥ valueAreaPct × total (prefix sums, two pointers); ties →
//   centre nearest the POC → larger volume → lower window. The old greedy single-bucket growth put VAL
//   1.3 ATR off on the fixture.
// Review finding czt.mjs:128: cvdDivergence reports `source` ('proxy' when any candle between the two
//   compared legs lacks aggressor volume) so czt can label the reason and not count it as a trigger.
// Review finding czt.mjs:166: profileLevels(profile, { lvn: true }) also emits the profile's LVNs as Level
//   kind 'lvn' (side relative to `price`), merged when closer than `lvnMergeTol` — source 05 §5/§6: rejections
//   at (HTF) LVNs are prime reversal boundaries, so they are Zones. They are never targets (price moves through them).
// DEVIATION (additive): volumeProfile returns null (not a Profile) when there is nothing to profile
//   (no candles or zero total volume); Profile carries bucket/totalVol/low/high/n/pocVol/vaVol extras.
// DEVIATION (additive export): profileLevels(profile, opts) → Level[] (poc/vah/val) so the analyst and
//   czt can treat value-area edges as zones without re-deriving the Level shape.
// DEVIATION (SPEC §4.6 signature): nakedPocs(store, cfg, now, opts?) — `now` is required (task text:
//   nakedPocs(store, cfg, now)); `opts` {atr, tick, bucket} chooses the day-profile bucket; without it
//   the bucket is the day range / 50.

import { delta, cvd, wickRatios } from './indicators.mjs';
import { localParts, dayBounds, shiftDayKey } from './sessions.mjs';

const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const r8 = (x) => Math.round(x * 1e8) / 1e8; // strip float noise from derived prices
const isClosed = (c) => !!c && c.closed !== false;
/** The orderflow section of a strategy config, or the object itself when it already is that section. */
const ofCfg = (cfg) => (cfg && typeof cfg.orderflow === 'object' && cfg.orderflow ? cfg.orderflow : cfg) || {};
const lastClosedIndex = (candles) => { for (let i = candles.length - 1; i >= 0; i--) if (isClosed(candles[i])) return i; return -1; };

/** Source 05 §3: delta = aggressive buy volume − aggressive sell volume, "pure arithmetic, not a forecasting tool". */
export function candleDelta(c) { return delta(c); }

/** Running sum of delta (source 05 §3: CVD "sums delta over a session"); pass session-open indexes to reset. */
export function cvdSeries(candles, { resetAtIndexes } = {}) { return cvd(candles, { resetAtIndexes }); }

/**
 * CVD extreme of the leg that ends at swing `s`: for a swing high, the max of CVD from the last swing
 * low before it (or the series start) up to the swing; mirrored for a low. This is "CVD High 1 / High 2"
 * in the source 05 §3 diagram — the peak of aggressive pressure behind each price push, not merely the
 * CVD print on the swing candle.
 */
function cvdLegExtreme(series, swingsSorted, s, candles) {
  const opposite = s.kind === 'high' ? 'low' : 'high';
  let start = 0;
  for (let i = swingsSorted.length - 1; i >= 0; i--) {
    const o = swingsSorted[i];
    if (o.index < s.index && o.kind === opposite) { start = o.index; break; }
  }
  let best = start;
  for (let j = start; j <= s.index; j++) {
    if (s.kind === 'high' ? series[j] > series[best] : series[j] < series[best]) best = j;
  }
  return { index: best, t: candles[best].t, value: series[best] };
}

/**
 * CVD divergence = absorption (source 05 §3): price makes a new high while CVD fails to make a new high
 * ⇒ bearish (passive sellers absorbing at resistance); price makes a new low while CVD fails to make a
 * new low ⇒ bullish. Compares the last `cvdDivergenceSwings` (≥ 2) confirmed swings of a kind: price must
 * exceed every earlier one in the window, CVD's leg extreme must not. When both kinds diverge the more
 * recent swing wins. `swings` must index into `candles`.
 * @returns {{kind:'bearish'|'bullish', t, priceSwing, prevPriceSwing, cvdSwing:{index,t,value}, prevCvdSwing:{index,t,value}, age:number, source:'trades'|'proxy'}|null}
 */
export function cvdDivergence(candles, swings, cfg = {}, { cvd: precomputed } = {}) {
  const n = Math.max(2, Math.floor(ofCfg(cfg).cvdDivergenceSwings ?? 2));
  if (!Array.isArray(candles) || candles.length < 3 || !Array.isArray(swings) || swings.length < n) return null;
  const sw = swings.filter((s) => s && Number.isInteger(s.index) && s.index >= 0 && s.index < candles.length && (s.kind === 'high' || s.kind === 'low')).sort((a, b) => a.index - b.index);
  const series = precomputed && precomputed.length === candles.length ? precomputed : cvdSeries(candles);
  const check = (kind) => {
    const same = sw.filter((s) => s.kind === kind);
    if (same.length < n) return null;
    const recent = same.slice(-n), latest = recent[n - 1], prevs = recent.slice(0, n - 1);
    const beyond = kind === 'high' ? (a, b) => a > b : (a, b) => a < b;
    if (!prevs.every((p) => beyond(latest.price, p.price))) return null;       // price did NOT make a new extreme
    const latestCvd = cvdLegExtreme(series, sw, latest, candles);
    let prevBest = null, prevBestSwing = null;
    for (const p of prevs) { const e = cvdLegExtreme(series, sw, p, candles); if (!prevBest || beyond(e.value, prevBest.value)) { prevBest = e; prevBestSwing = p; } }
    if (beyond(latestCvd.value, prevBest.value)) return null;                   // CVD confirmed the move: healthy, no divergence
    // Honest labelling: a CVD built from body/range proxies is price-vs-price, not executed flow (source 05 §3).
    let source = 'trades';
    for (let j = Math.min(prevBest.index, prevBestSwing.index); j <= latest.index; j++) if (delta(candles[j]).source === 'proxy') { source = 'proxy'; break; }
    return { kind: kind === 'high' ? 'bearish' : 'bullish', t: latest.t, priceSwing: latest, prevPriceSwing: prevBestSwing, cvdSwing: latestCvd, prevCvdSwing: prevBest, age: candles.length - 1 - latest.index, source };
  };
  const bear = check('high'), bull = check('low');
  if (bear && bull) return bear.priceSwing.index >= bull.priceSwing.index ? bear : bull;
  return bear || bull;
}

/**
 * Absorption on the LAST CLOSED candle (source 05 §4, "effort versus result"): heavy aggressive volume
 * (≥ absorptionVolumeMult × mean of the prior `absorptionMeanCandles`, default 20) that fails to displace
 * price (range ≤ absorptionMaxRangeAtr × ATR), with the wick/delta signature —
 *   bullish at support: lower wick ≥ absorptionMinWickRatio of range, delta ≤ 0 AND the bar closes back up (c ≥ o) —
 *     sells hit the bid, passive buyers soak it up ("the bar forms a lower wick and closes back up");
 *   bearish at resistance: upper wick ≥ ratio, delta ≥ 0 AND c ≤ o (buys lift the ask into a ceiling, bar closes back down).
 * A doji (c === o) satisfies both close tests; the longer wick decides. The baseline excludes the candle itself so a
 * spike cannot inflate its own mean. See header DEVIATION for proxy delta.
 * @returns {{side:'bullish'|'bearish', t, vol, range, delta, deltaSource, meanVol, volMult, rangeAtr, wick:{upper,lower}}|null}
 */
export function detectAbsorption(candles, atr, cfg = {}) {
  const o = ofCfg(cfg);
  const volMult = o.absorptionVolumeMult ?? 2, maxRangeAtr = o.absorptionMaxRangeAtr ?? 0.6, minWick = o.absorptionMinWickRatio ?? 0.5;
  const meanN = Math.max(1, Math.floor(o.absorptionMeanCandles ?? 20));
  if (!fin(atr) || atr <= 0 || !Array.isArray(candles)) return null;
  const i = lastClosedIndex(candles);
  if (i < 0) return null;
  const c = candles[i];
  const prior = [];
  for (let j = i - 1; j >= 0 && prior.length < meanN; j--) if (isClosed(candles[j]) && fin(candles[j].v)) prior.push(candles[j].v);
  if (prior.length < Math.min(meanN, 5)) return null;                           // too little history to call anything "heavy"
  const meanVol = prior.reduce((a, b) => a + b, 0) / prior.length;
  const vol = fin(c.v) ? c.v : 0, range = c.h - c.l;
  if (!(meanVol > 0) || vol < volMult * meanVol || !(range >= 0) || range > maxRangeAtr * atr) return null;
  const w = wickRatios(c), d = delta(c);
  const deltaOk = (sign) => d.source === 'proxy' || (sign < 0 ? d.value <= 0 : d.value >= 0);
  const bull = w.lower >= minWick && deltaOk(-1) && c.c >= c.o, bear = w.upper >= minWick && deltaOk(+1) && c.c <= c.o;
  let side = null;
  if (bull && bear) side = w.lower > w.upper ? 'bullish' : w.upper > w.lower ? 'bearish' : d.value < 0 ? 'bullish' : d.value > 0 ? 'bearish' : null; // only a bodiless 50/50 bar gets here
  else side = bull ? 'bullish' : bear ? 'bearish' : null;
  if (!side) return null;
  return { side, t: c.t, vol, range, delta: d.value, deltaSource: d.source, meanVol, volMult: vol / meanVol, rangeAtr: range / atr, wick: { upper: w.upper, lower: w.lower } };
}

/**
 * Wyckoff effort vs result (source 05 §4): effort = volume relative to its mean, result = range in ATRs.
 * ratio = effort / result — large means lots of volume moved price little (absorption-like); null when
 * result is zero or an input is unusable.
 */
export function effortVsResult(c, atr, meanVol) {
  const effort = c && fin(c.v) && fin(meanVol) && meanVol > 0 ? c.v / meanVol : null;
  const result = c && fin(c.h) && fin(c.l) && fin(atr) && atr > 0 ? (c.h - c.l) / atr : null;
  const ratio = effort !== null && result !== null && result > 0 ? effort / result : null;
  return { effort, result, ratio };
}

/** Maximal runs of equal values that are local maxima (`max`) or minima; edges count as ±∞ beyond. */
function extremaRuns(vols, max) {
  const out = [];
  const len = vols.length;
  for (let i = 0; i < len;) {
    let j = i;
    while (j + 1 < len && vols[j + 1] === vols[i]) j++;
    const before = i > 0 ? vols[i - 1] : (max ? -Infinity : Infinity);
    const after = j + 1 < len ? vols[j + 1] : (max ? -Infinity : Infinity);
    const ok = max ? vols[i] > before && vols[i] > after : vols[i] < before && vols[i] < after;
    if (ok) out.push({ start: i, end: j, vol: vols[i] });
    i = j + 1;
  }
  return out;
}

/**
 * Smallest contiguous window [lo, hi] of `vols` containing `poc` with Σ ≥ target (SPEC §4.6: "smallest
 * contiguous set around POC holding ≥ 70 %"). Prefix sums + two pointers: as the left edge `a` moves down
 * from the POC, the first right edge `b ≥ poc` that satisfies the target can only move down too, so the
 * scan is O(n). Ties: narrowest → centre nearest the POC → larger volume → lower window. Exported for tests.
 */
export function valueArea(vols, poc, target) {
  const len = vols.length;
  const pre = new Float64Array(len + 1);
  for (let k = 0; k < len; k++) pre[k + 1] = pre[k] + vols[k];
  const sum = (a, b) => pre[b + 1] - pre[a];
  const eps = 1e-12;
  let best = null, b = len - 1;
  if (sum(0, len - 1) < target - eps) return { lo: 0, hi: len - 1, vol: sum(0, len - 1) }; // cannot be reached: the whole range
  for (let a = poc; a >= 0; a--) {
    if (sum(a, len - 1) < target - eps) continue;                    // no right edge satisfies from this left edge; a lower one adds volume
    while (b > poc && sum(a, b - 1) >= target - eps) b--;            // shrink the right edge as far as the target allows
    const cand = { lo: a, hi: b, vol: sum(a, b), width: b - a, off: Math.abs((a + b) / 2 - poc) };
    // `a` descends, so on a full tie the later (lower) window replaces the earlier one.
    if (!best || cand.width < best.width || (cand.width === best.width && (cand.off < best.off - eps || (Math.abs(cand.off - best.off) <= eps && cand.vol >= best.vol - eps)))) best = cand;
  }
  return { lo: best.lo, hi: best.hi, vol: best.vol };
}

/**
 * Volume profile (source 05 §5). Each candle's volume is spread evenly over the price buckets its range
 * touches (a zero-range candle lands in one bucket). POC = heaviest bucket (tie → nearest the middle of
 * the range). Value area = the SMALLEST contiguous bucket window containing the POC whose volume is
 * ≥ `valueAreaPct` (70 %) of the total (SPEC §4.6 literal; ties → centre nearest the POC, then the heavier
 * window, then the lower one). HVN = local maxima of bucket volume at/above the mean
 * bucket volume ("agreed fair value"); LVN = local minima below `lvnFraction` (25 %) of the mean
 * ("rapid transactions without agreement — price moves through like a vacuum"). Plateaus collapse to one
 * price. Shape: 'thin' when the POC holds < `thinPocMult` (3×) the mean (elongated trend profile);
 * else by POC position in the range — top third 'P', bottom third 'b', middle 'D'.
 * Prices: POC/HVN/LVN/buckets at bucket centres; VAH = top edge of the highest VA bucket (≤ range high),
 * VAL = bottom edge of the lowest (≥ range low). Works on candles without buyV/sellV — only `v` is used.
 * @param {object} [opts] bucket (price size) | atr + bucketsAtr (0.1) | neither → range/50; tick snaps the bucket; maxBuckets caps resolution (5000).
 * @returns {{poc, vah, val, hvn:number[], lvn:number[], shape:'P'|'b'|'D'|'thin', buckets:{price,vol}[], bucket, totalVol, low, high, n, pocVol, vaVol}|null}
 */
export function volumeProfile(candles, opts = {}) {
  const { valueAreaPct = 0.7, lvnFraction = 0.25, hvnMinFraction = 1, thinPocMult = 3, maxBuckets = 5000, tick } = opts;
  const rows = Array.isArray(candles) ? candles.filter((c) => c && fin(c.h) && fin(c.l) && c.h >= c.l) : [];
  if (!rows.length) return null;
  let lo = Infinity, hi = -Infinity, total = 0;
  for (const c of rows) { if (c.l < lo) lo = c.l; if (c.h > hi) hi = c.h; if (fin(c.v) && c.v > 0) total += c.v; }
  if (!(total > 0)) return null;
  const span = hi - lo;
  let bucket = fin(opts.bucket) && opts.bucket > 0 ? opts.bucket
    : fin(opts.atr) && opts.atr > 0 ? opts.atr * (fin(opts.bucketsAtr) && opts.bucketsAtr > 0 ? opts.bucketsAtr : 0.1)
    : span / 50;
  if (fin(tick) && tick > 0) bucket = Math.max(tick, Math.round(bucket / tick) * tick);
  if (!(bucket > 0)) bucket = span > 0 ? span / 50 : Math.max(Math.abs(hi) * 1e-6, 1e-9); // every candle at one price and no tick
  if (span / bucket > maxBuckets) bucket = span / maxBuckets;
  const idx = (p) => Math.floor(p / bucket + 1e-9);                             // epsilon: 100/0.1 must land in bucket 1000, not 999
  const i0 = idx(lo), len = idx(hi) - i0 + 1;
  const vols = new Float64Array(len);
  for (const c of rows) {
    if (!(fin(c.v) && c.v > 0)) continue;
    const a = idx(c.l) - i0, b = idx(c.h) - i0, share = c.v / (b - a + 1);
    for (let k = a; k <= b; k++) vols[k] += share;
  }
  const mid = (len - 1) / 2;
  let poc = 0;
  for (let k = 1; k < len; k++) if (vols[k] > vols[poc] || (vols[k] === vols[poc] && Math.abs(k - mid) < Math.abs(poc - mid))) poc = k;
  const { lo: vaLo, hi: vaHi, vol: vaVol } = valueArea(vols, poc, valueAreaPct * total);
  const centre = (k) => r8((i0 + k + 0.5) * bucket);
  const mean = total / len;
  const hvn = extremaRuns(vols, true).filter((r) => r.vol >= hvnMinFraction * mean).map((r) => centre((r.start + r.end) / 2));
  const lvn = extremaRuns(vols, false).filter((r) => r.vol < lvnFraction * mean).map((r) => centre((r.start + r.end) / 2));
  const pos = len > 1 ? poc / (len - 1) : 0.5;
  const shape = vols[poc] < thinPocMult * mean ? 'thin' : pos >= 2 / 3 ? 'P' : pos <= 1 / 3 ? 'b' : 'D';
  const buckets = Array.from(vols, (v, k) => ({ price: centre(k), vol: r8(v) }));
  return {
    poc: centre(poc), vah: r8(Math.min(hi, (i0 + vaHi + 1) * bucket)), val: r8(Math.max(lo, (i0 + vaLo) * bucket)),
    hvn, lvn, shape, buckets, bucket: r8(bucket), totalVol: total, low: lo, high: hi, n: rows.length, pocVol: r8(vols[poc]), vaVol: r8(vaVol),
  };
}

/**
 * The profile's reference prices as Level objects (source 05 §6 zones: VAH, VAL, POC). VAH is buy-side
 * (above), VAL sell-side (below); the POC's side is relative to `price` (sell-side when below or unknown).
 * With `lvn: true` the profile's low-volume nodes follow as kind 'lvn' (source 05 §5: "rejections at LVNs
 * provide prime reversal boundaries"; §6: HTF LVNs are zones), side relative to `price`, LVNs closer than
 * `lvnMergeTol` to each other merged at their mean (meta.count), at most `lvnMax` nearest to `price`.
 */
export function profileLevels(profile, { t, tf = '1m', price, prefix = '', meta, lvn = false, lvnMergeTol = 0, lvnMax = 6 } = {}) {
  if (!profile) return [];
  const sideOf = (p) => (fin(price) && p > price ? 'buy-side' : 'sell-side');
  const mk = (kind, p, side, extra) => ({ id: `${prefix}${kind}:${t}:${r8(p)}`, kind, price: p, t, tf, side, meta: { shape: profile.shape, ...meta, ...extra }, swept: null });
  const out = [
    mk('poc', profile.poc, sideOf(profile.poc)),
    mk('vah', profile.vah, 'buy-side'),
    mk('val', profile.val, 'sell-side'),
  ];
  if (lvn && Array.isArray(profile.lvn) && profile.lvn.length) {
    const groups = [];
    for (const p of profile.lvn.filter(fin).slice().sort((a, b) => a - b)) {
      const g = groups[groups.length - 1];
      if (g && Math.abs(p - g.sum / g.n) <= lvnMergeTol) { g.sum += p; g.n++; } else groups.push({ sum: p, n: 1 });
    }
    const nodes = groups.map((g) => ({ p: r8(g.sum / g.n), n: g.n }));
    const kept = fin(price) ? nodes.sort((a, b) => Math.abs(a.p - price) - Math.abs(b.p - price)).slice(0, lvnMax) : nodes.slice(0, lvnMax);
    for (const { p, n } of kept) out.push(mk('lvn', p, sideOf(p), { count: n }));
  }
  return out;
}

/** Index of the first candle with t ≥ ms in a t-sorted array. */
function lowerBound(arr, ms) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].t < ms) lo = m + 1; else hi = m; }
  return lo;
}

/**
 * Naked POCs (source 05 §6/§8: "Prior Session Point of Control / Naked POCs (untested levels)"): the POC
 * of each completed prior London day within `nakedPocLookbackDays` that price has not traded at since
 * (no later 1m candle with l ≤ poc ≤ h — a touch is a test). One per day. Days the 1m ring no longer
 * fully covers are skipped — a partial-day POC would be a guess. Today is excluded (still developing).
 * @param {{get?:Function, closed:Function}} store  CandleStore (or any object with get('1m')/closed('1m'))
 * @param {object} cfg  full strategy config (sessions.timezone + orderflow.*)
 * @param {number} now  ms UTC — required; the engine never reads the wall clock
 * @param {{atr?:number, tick?:number, bucket?:number}} [opts]  day-profile bucket (see volumeProfile)
 * @returns {Level[]} kind 'nakedPoc', oldest day first; side = where it sits relative to the last price
 */
export function nakedPocs(store, cfg, now, opts = {}) {
  if (!cfg || !cfg.sessions || !cfg.sessions.timezone) throw new TypeError('nakedPocs needs the strategy config (sessions.timezone + orderflow)');
  if (!fin(now)) throw new TypeError('nakedPocs needs `now` in ms — the engine never reads the wall clock');
  const o = ofCfg(cfg);
  const lookback = Math.max(0, Math.floor(o.nakedPocLookbackDays ?? 5));
  const all = typeof store.get === 'function' ? store.get('1m') : store.closed('1m');
  if (!all.length) return [];
  const price = all[all.length - 1].c;
  const today = localParts(now, cfg.sessions.timezone).dayKey;
  const bucket = fin(opts.bucket) && opts.bucket > 0 ? opts.bucket : fin(opts.atr) && opts.atr > 0 ? opts.atr * (o.volumeProfileBucketsAtr ?? 0.1) : undefined;
  const out = [];
  for (let d = lookback; d >= 1; d--) {
    const dayKey = shiftDayKey(today, -d);
    const { startMs, endMs } = dayBounds(dayKey, cfg);
    if (endMs > now || all[0].t > startMs) continue;
    const from = lowerBound(all, startMs), to = lowerBound(all, endMs);
    if (to <= from) continue;
    const prof = volumeProfile(all.slice(from, to), { bucket, tick: opts.tick, valueAreaPct: o.valueAreaPct ?? 0.7 });
    if (!prof) continue;
    let tested = false;
    for (let k = to; k < all.length && !tested; k++) if (all[k].l <= prof.poc && all[k].h >= prof.poc) tested = true;
    if (tested) continue;
    out.push({
      id: `nakedPoc:${startMs}:${r8(prof.poc)}`, kind: 'nakedPoc', price: prof.poc, t: startMs, tf: '1m',
      side: prof.poc > price ? 'buy-side' : 'sell-side',
      meta: { dayKey, vah: prof.vah, val: prof.val, shape: prof.shape, bucket: prof.bucket, candles: to - from },
      swept: null,
    });
  }
  return out;
}
