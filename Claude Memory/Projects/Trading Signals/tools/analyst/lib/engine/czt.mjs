// lib/engine/czt.mjs — the decision gate: Condition → Zone → Trigger (source 05 §6), scored with
// cfg.czt.weights, emitting a Setup only when every non-negotiable in sources 01–05 holds.
// SPEC.md §4.7. evaluate(ctx) is PURE given ctx: no clock (ctx.now), no store writes, no module
// state, no Date.now(). Same ctx ⇒ same result, byte for byte.
//
// Non-negotiables, where they live:
//   source 01 — "your stop-loss has got to be at the manipulation low": when a sweep triggered the
//               setup the stop is the manipulation extreme ∓ stopBufferAtr × ATR. If that puts it
//               further than maxStopAtr the trade is SKIPPED; the stop is never moved closer.
//   source 02 — liquidity rests at previous highs/lows and around consolidation; "wait for London /
//               New York to sweep it, then target the next portion of liquidity". Outside a
//               killzone the Condition layer caps the score below minScore (tradeOnlyInKillzones).
//   source 03 — "time dictates the move": the session role rides along with every Condition.
//   source 04 — "buy-side taken → target sell-side and vice-versa": targets are only ever OPPOSING
//               liquidity; the entry zone is the swept level / the order block.
//   source 05 — "You never take an order flow trigger in the middle of nowhere": ≥ 1 Zone hit AND
//               ≥ 1 Trigger hit; "enter on the close of the rejection bar"; invalidation stop.
//
// DEVIATION (one): condition.valueRelation is 'unknown' (not one of inside|above|below) when ctx has
//   no prevDayProfile — guessing 'inside' would silently fake a Condition.
// Additive (not in §4.7): the result also carries `side`, `rawScore` (before the killzone cap),
//   `rejections` (why no Setup), `blocked` + `candidate` (a qualifying Setup held back by
//   ctx.limits), and `sides` (both evaluations, for the CZT panel); condition carries `role` and
//   `capped`; targets carry `kind`. ctx may carry `engulfing` (precomputed) — otherwise it is derived
//   from the last two closed analysis-TF candles in ctx.store via structure.isEngulfing.
//   cfg.czt.triggerMaxAgeCandles (default 6) bounds how old a CVD divergence / structure break may
//   be to still count as this candle's trigger. A structure-TF CHoCH in the side direction counts
//   as the `ltfBos` hit (after a sweep the first break is a change of character by definition).
//   Levels already `swept` are never targets — that liquidity has been taken (source 04).

import { isEngulfing } from './structure.mjs';
import { size as riskSize, rr as riskRr, dailyCaps } from './risk.mjs';

const TF_MS = { '1m': 60e3, '5m': 3e5, '15m': 9e5, '1h': 36e5, '4h': 144e5 }; // mirror of candles.mjs
const BUY_SIDE = new Set(['pdh', 'sessionHigh', 'asiaHigh', 'equalHighs', 'consolidationHigh', 'vah']);
const MAGNETS = new Set(['poc', 'nakedPoc']);     // side-agnostic: a zone when at price, a target when beyond it
/** Level.kind → weight / targetsFrom group. Consolidation edges are "liquidity building up on both sides" (source 04) → equalHighsLows. */
const GROUP = {
  pdh: 'pdhPdl', pdl: 'pdhPdl',
  sessionHigh: 'sessionHighLow', sessionLow: 'sessionHighLow', asiaHigh: 'sessionHighLow', asiaLow: 'sessionHighLow',
  equalHighs: 'equalHighsLows', equalLows: 'equalHighsLows', consolidationHigh: 'equalHighsLows', consolidationLow: 'equalHighsLows',
  poc: 'valueArea', vah: 'valueArea', val: 'valueArea', nakedPoc: 'nakedPoc',
};
const TRIGGER_PRIORITY = ['sweepReclaim', 'absorption', 'cvdDivergence', 'ltfBos', 'engulfing', 'deltaConfirms']; // Setup.trigger.kind
const CAP_MARGIN = 0.5;          // outside a killzone the score is capped at minScore − 0.5 (visibly "just under")
const TARGET_DEDUPE_ATR = 0.1;   // two target levels this close are one pool
const DEFAULT_TRIGGER_AGE = 6;   // analysis candles

const levelSide = (l) => l.side || (BUY_SIDE.has(l.kind) ? 'buy-side' : 'sell-side');
const fmtFor = (dp) => { const f = new Intl.NumberFormat('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp }); return (x) => f.format(x); };
const fmtDelta = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100) / 100}`;
const near = (c, price, tol) => price >= c.l - tol && price <= c.h + tol;               // the candle traded within tol of the level
const overlaps = (c, z, tol) => z.bottom <= c.h + tol && z.top >= c.l - tol;             // the candle traded into the zone

/** Human name in the sources' language ("Asia low", "previous day high", "London high", "equal lows"). */
export function levelLabel(l) {
  const m = l.meta || {};
  switch (l.kind) {
    case 'pdh': return 'previous day high';
    case 'pdl': return 'previous day low';
    case 'sessionHigh': return `${m.label || 'previous session'} high`;
    case 'sessionLow': return `${m.label || 'previous session'} low`;
    case 'asiaHigh': return 'Asia high';
    case 'asiaLow': return 'Asia low';
    case 'equalHighs': return `equal highs${m.count ? ` (×${m.count})` : ''}`;
    case 'equalLows': return `equal lows${m.count ? ` (×${m.count})` : ''}`;
    case 'consolidationHigh': return 'consolidation high';
    case 'consolidationLow': return 'consolidation low';
    case 'poc': return 'prior-day POC';
    case 'vah': return 'prior-day VAH';
    case 'val': return 'prior-day VAL';
    case 'nakedPoc': return 'naked POC';
    default: return l.kind;
  }
}

/** Prior-day VAH/POC/VAL as Levels (source 05 §6 Zone list), unless the caller already supplied those kinds. */
function profileLevels(profile, have, tf) {
  if (!profile) return [];
  const present = new Set(have.map(l => l.kind));
  return [['vah', profile.vah], ['poc', profile.poc], ['val', profile.val]]
    .filter(([kind, price]) => Number.isFinite(price) && !present.has(kind))
    .map(([kind, price]) => ({ id: `${kind}:prevDay`, kind, price, t: null, tf, side: levelSide({ kind }), meta: { source: 'prevDayProfile' }, swept: null }));
}

export function gradeFor(score, czt) {
  return score >= (czt.gradeA ?? 9) ? 'A' : score >= (czt.gradeB ?? 7) ? 'B' : 'C';
}

/**
 * Score one candidate side. Returns the three layers, the score and — when every gate passes — the
 * Setup (before ctx.limits, which evaluate() applies to the winning side only).
 */
export function evaluateSide(ctx, side) {
  const { cfg, symbolCfg = {}, lastClosed: c, atr, session, bias, store } = ctx;
  const czt = cfg.czt ?? {}, W = czt.weights ?? {}, tfs = cfg.timeframes ?? {};
  const tf = tfs.analysis ?? '5m', tfMs = TF_MS[tf] ?? 3e5, structTfMs = TF_MS[tfs.structure ?? '15m'] ?? 9e5;
  const bull = side === 'long', dir = bull ? 1 : -1;
  const fmt = fmtFor(symbolCfg.dp ?? 2);
  const tol = (czt.zoneToleranceAtr ?? 0.5) * atr;
  const maxAgeMs = (czt.triggerMaxAgeCandles ?? DEFAULT_TRIGGER_AGE) * tfMs;
  const entry = c.c;
  const hits = { condition: [], zone: [], trigger: [] }, reasons = { condition: [], zone: [], trigger: [] };
  const hit = (layer, key, line) => { if (!hits[layer].includes(key)) { hits[layer].push(key); reasons[layer].push(line); } };

  // ---- Trigger (last closed analysis-TF candle) ----
  const wantLevelSide = bull ? 'sell-side' : 'buy-side';     // longs are born at swept lows, shorts at swept highs
  const sweeps = (ctx.sweeps || []).filter(s => s?.reclaimed && s.t === c.t && s.level && levelSide(s.level) === wantLevelSide);
  const sweep = sweeps.length ? sweeps.reduce((a, b) => (b.depth > a.depth ? b : a)) : null;
  let manipExtreme = null;
  if (sweep) {
    // The manipulation extreme is the deepest excursion past the level (= the sweep candle's wick, or
    // the deepest wick since an unreclaimed sweep when the reclaim came a candle or two later).
    manipExtreme = bull ? Math.min(sweep.level.price - sweep.depth, c.l) : Math.max(sweep.level.price + sweep.depth, c.h);
    hit('trigger', 'sweepReclaim', `Swept ${wantLevelSide} liquidity at ${levelLabel(sweep.level)} ${fmt(sweep.level.price)} and reclaimed (manipulation ${bull ? 'low' : 'high'} ${fmt(manipExtreme)})`);
  }
  const abs = ctx.absorption;
  if (abs && abs.side === (bull ? 'bullish' : 'bearish') && (abs.t == null || abs.t === c.t)) {
    const d = Number.isFinite(abs.delta) ? ` (delta ${fmtDelta(abs.delta)})` : '';
    hit('trigger', 'absorption', bull
      ? `Bullish absorption at ${fmt(c.l)}: heavy sells hit the bid${d}, no follow-through, closed back up — sellers trapped`
      : `Bearish absorption at ${fmt(c.h)}: heavy buys lifted the ask${d}, no follow-through, closed back down — buyers trapped`);
  }
  const div = ctx.divergence;
  if (div && div.kind === (bull ? 'bullish' : 'bearish') && (div.t == null || c.t - div.t <= maxAgeMs)) {
    const ps = Number.isFinite(div.priceSwing?.price) ? div.priceSwing.price : div.priceSwing;
    const at = Number.isFinite(ps) ? ` at ${fmt(ps)}` : '';
    hit('trigger', 'cvdDivergence', bull
      ? `Price made a lower low${at} while CVD made a higher low — effort without result, sellers absorbed`
      : `Price made a higher high${at} while CVD made a lower high — effort without result, buyers exhausting`);
  }
  let eng = ctx.engulfing, prev = null;
  if (eng === undefined && typeof store?.closed === 'function' && atr > 0) {
    const arr = store.closed(tf) || [];
    let i = arr.length - 1;
    while (i >= 0 && arr[i].t !== c.t) i--;
    prev = i > 0 ? arr[i - 1] : (i < 0 && arr.length ? arr[arr.length - 1] : null);
    eng = prev ? isEngulfing(prev, c, atr, cfg.structure ?? {}) : null;
  }
  if (eng && (eng.side ? eng.side === (bull ? 'bullish' : 'bearish') : (c.c > c.o) === bull)) {
    const edge = prev ? ` — closed ${fmt(c.c)} ${bull ? 'above' : 'below'} its body ${fmt(bull ? Math.max(prev.o, prev.c) : Math.min(prev.o, prev.c))}` : ` (close ${fmt(c.c)})`;
    hit('trigger', 'engulfing', `Engulfed the previous ${tf} candle${eng.full ? ' (whole range)' : ''}${edge}`);
  }
  const s = ctx.structure, wantDir = bull ? 'up' : 'down';
  const brk = [s?.lastBos, s?.lastChoch].filter(b => b && b.dir === wantDir).sort((a, b) => b.t - a.t)[0];
  if (brk && Number.isFinite(brk.t)) {
    const sweepT = sweep ? (sweep.level.swept?.t ?? sweep.t) : null;
    const recent = c.t - brk.t <= Math.max(structTfMs, maxAgeMs);
    const afterSweep = sweepT == null || brk.t + structTfMs > sweepT;  // the breaking candle closed after the sweep began
    if (recent && afterSweep) {
      const what = brk === s.lastChoch ? 'change of character' : 'break of structure';
      hit('trigger', 'ltfBos', `${tfs.structure ?? '15m'} ${what} ${wantDir} through ${fmt(brk.price)}${sweep ? ' after the sweep' : ''}`);
    }
  }
  const dv = typeof ctx.deltaInfo === 'number' ? ctx.deltaInfo : ctx.deltaInfo?.value;
  if (Number.isFinite(dv) && Math.sign(dv) === dir) {
    const proxy = ctx.deltaInfo?.source === 'proxy' ? ' (proxy — no trade tape)' : '';
    hit('trigger', 'deltaConfirms', `Closing delta ${fmtDelta(dv)} — aggressive ${bull ? 'buyers lifting the ask' : 'sellers hitting the bid'}${proxy}`);
  }

  // ---- Zone: the candle traded into a reference level / zone appropriate to the side ----
  const levels = (ctx.levels || []).filter(l => l && Number.isFinite(l.price));
  if (sweep && !levels.some(l => l.id === sweep.level.id)) levels.push(sweep.level); // a sweep proves price reached that level
  const all = [...levels, ...profileLevels(ctx.prevDayProfile, levels, tf)];
  const zoneLevels = all
    .filter(l => GROUP[l.kind] && (MAGNETS.has(l.kind) || levelSide(l) === wantLevelSide) && near(c, l.price, tol))
    .sort((a, b) => Math.abs(a.price - entry) - Math.abs(b.price - entry));
  for (const l of zoneLevels) {
    const what = MAGNETS.has(l.kind) || l.kind === 'vah' || l.kind === 'val' ? (l.kind === 'nakedPoc' ? 'untested' : 'value') : `${wantLevelSide} liquidity`;
    hit('zone', GROUP[l.kind], `At ${levelLabel(l)} ${fmt(l.price)} (${what})`);
  }
  const zoneZones = (ctx.zones || [])
    .filter(z => z && z.side === (bull ? 'bullish' : 'bearish') && (z.kind === 'fvg' || z.kind === 'orderBlock') && overlaps(c, z, tol))
    .sort((a, b) => (a.kind === b.kind ? Math.abs((a.top + a.bottom) / 2 - entry) - Math.abs((b.top + b.bottom) / 2 - entry) : a.kind === 'orderBlock' ? -1 : 1));
  for (const z of zoneZones) {
    hit('zone', z.kind, z.kind === 'fvg'
      ? `Inside ${z.side} imbalance (FVG) ${fmt(z.bottom)}–${fmt(z.top)}`
      : `Inside ${z.side} order block ${fmt(z.bottom)}–${fmt(z.top)}`);
  }
  const primaryLevel = sweep ? sweep.level : zoneLevels[0] ?? null;
  const primaryZone = zoneZones[0] ?? null;

  // ---- Condition: context (source 05 §6 step 1; sources 02/03 for time) ----
  const biasTf = tfs.bias ?? '1h';
  if (bias?.dir === (bull ? 'bullish' : 'bearish')) {
    const str = Number.isFinite(bias.strength) ? ` (strength ${bias.strength.toFixed(2)})` : '';
    hit('condition', 'biasAligned', `Bias pushing ${bull ? 'higher' : 'lower'} on ${biasTf}${str}`);
  }
  if (session?.killzone) hit('condition', 'killzone', `${session.label ?? session.id} killzone — ${session.role ?? 'manipulation'} window, time dictates the move`);
  const p = ctx.prevDayProfile;
  let valueRelation = 'unknown';
  if (p && Number.isFinite(p.vah) && Number.isFinite(p.val)) {
    valueRelation = entry > p.vah ? 'above' : entry < p.val ? 'below' : 'inside';
    if ((valueRelation === 'above' && bull) || (valueRelation === 'below' && !bull))
      hit('condition', 'outsideValueTrend', `Accepting ${valueRelation} prior-day value (VAH ${fmt(p.vah)} / VAL ${fmt(p.val)}) — expect expansion ${bull ? 'higher' : 'lower'}`);
    else if (valueRelation === 'inside' && (bull ? entry - p.val <= tol : p.vah - entry <= tol))
      hit('condition', 'insideValueRotation', `Inside prior-day value ${fmt(p.val)}–${fmt(p.vah)} at its ${bull ? 'lower' : 'upper'} extreme — rotation, fade the extreme`);
  }

  // ---- Score, then the killzone cap (source 02) ----
  const sum = (layer) => hits[layer].reduce((a, k) => a + (W[`${layer}.${k}`] ?? 0), 0);
  const rawScore = sum('condition') + sum('zone') + sum('trigger');
  const minScore = czt.minScore ?? 6;
  const onlyKz = (cfg.sessions?.tradeOnlyInKillzones ?? true) !== false;
  const capped = onlyKz && !session?.killzone;
  const score = capped ? Math.min(rawScore, Math.max(0, minScore - CAP_MARGIN)) : rawScore;
  if (capped) reasons.condition.push(`Outside the London / New York killzones (${session?.label ?? 'no session'}) — wait for the session to sweep; score capped`);

  const rejections = [];
  if (!hits.trigger.length) rejections.push('No trigger on the last closed candle — wait for price to show its hand at the zone');
  if (!hits.zone.length) rejections.push('No zone — never take a trigger in the middle of nowhere (source 05)');
  if (capped) rejections.push('Outside killzone: tradeOnlyInKillzones caps the score (source 02 — wait for London / New York)');
  if (score < minScore) rejections.push(`Score ${score.toFixed(1)} < minScore ${minScore}`);

  // ---- Stop (source 01 / 05 §7) and targets (source 02 / 04) — computed once the layers agree ----
  let stop = null, stopNote = null, targets = [];
  if (hits.trigger.length && hits.zone.length) {
    const buffer = (czt.stopBufferAtr ?? 0.1) * atr;
    let anchor;
    if (sweep) { anchor = manipExtreme; stopNote = `manipulation ${bull ? 'low' : 'high'} ${fmt(manipExtreme)}`; }
    else if (primaryZone) {
      anchor = bull ? Math.min(primaryZone.bottom, c.l) : Math.max(primaryZone.top, c.h);
      stopNote = `${primaryZone.kind === 'fvg' ? 'imbalance' : 'order block'} far edge ${fmt(anchor)}`;
    } else {
      anchor = bull ? Math.min(primaryLevel.price, c.l) : Math.max(primaryLevel.price, c.h);
      stopNote = `${levelLabel(primaryLevel)} ${fmt(anchor)}`;
    }
    stop = anchor - dir * buffer;
    const distAtr = (dir * (entry - stop)) / atr;
    if (!(distAtr > 0)) rejections.push(`Entry ${fmt(entry)} is not beyond the stop ${fmt(stop)}`);
    else if (distAtr > (czt.maxStopAtr ?? 3)) rejections.push(`Stop ${distAtr.toFixed(2)} ATR from entry > maxStopAtr ${czt.maxStopAtr ?? 3} — source 01: the stop stays at the ${stopNote}, non-negotiable, so the trade is skipped rather than the stop tightened`);

    const from = czt.targetsFrom ?? ['sessionHighLow', 'pdhPdl', 'equalHighsLows', 'valueArea', 'nakedPoc'];
    const minRr = czt.minRr ?? 1.5;
    const oppSide = bull ? 'buy-side' : 'sell-side';
    const cands = all
      .filter(l => GROUP[l.kind] && from.includes(GROUP[l.kind]) && !l.swept && dir * (l.price - entry) > 0 && (MAGNETS.has(l.kind) || levelSide(l) === oppSide))
      .map(l => ({ price: l.price, label: `${levelLabel(l)} ${fmt(l.price)}`, rr: riskRr(entry, stop, l.price), kind: l.kind, prio: from.indexOf(GROUP[l.kind]) }))
      .sort((a, b) => Math.abs(a.price - entry) - Math.abs(b.price - entry) || a.prio - b.prio);
    const nearest = cands[0];
    for (const t of cands) {
      if (t.rr < minRr) continue;                                   // too close to pay for the stop
      if (targets.some(x => Math.abs(x.price - t.price) <= TARGET_DEDUPE_ATR * atr)) continue;
      targets.push({ price: t.price, label: t.label, rr: t.rr, kind: t.kind });
      if (targets.length === 3) break;
    }
    if (!targets.length) rejections.push(nearest
      ? `No opposing (${oppSide}) liquidity giving ≥ ${minRr} R — nearest ${nearest.label} is ${nearest.rr.toFixed(2)} R`
      : `No opposing (${oppSide}) liquidity ${bull ? 'above' : 'below'} entry to target (source 04)`);
  }

  const condition = { bias: bias ?? null, session: session ?? null, valueRelation, role: session?.role ?? null, capped: capped ? 'outsideKillzone' : null, hits: hits.condition };
  const zone = { level: primaryLevel, zone: primaryZone, hits: hits.zone };
  const trigger = { kind: TRIGGER_PRIORITY.find(k => hits.trigger.includes(k)) ?? null, sweep, hits: hits.trigger };
  const allReasons = [...reasons.condition, ...reasons.zone, ...reasons.trigger];
  let setup = null;
  if (!rejections.length) {
    const symbol = ctx.symbol ?? symbolCfg.id ?? 'UNKNOWN';
    const sizeRes = riskSize({ balance: cfg.risk?.balance, riskPct: cfg.risk?.riskPct, entry, stop, contract: symbolCfg.contract });
    setup = {
      id: `${symbol}-${c.t}-${side}`, symbol, t: c.t, tf, side,
      entry, stop, targets, rr: targets[0].rr,
      score, grade: gradeFor(score, czt),
      condition, zone, trigger,
      reasons: allReasons,
      invalidation: `close ${bull ? 'below' : 'above'} ${fmt(stop)} (${stopNote} ${bull ? '−' : '+'} ${czt.stopBufferAtr ?? 0.1} ATR buffer)`,
      size: sizeRes,
      status: 'open',
    };
  }
  return { side, condition, zone, trigger, score, rawScore, reasons: allReasons, rejections, stop, targets, setup };
}

/**
 * The gate. Both sides are scored; the stronger one is reported (a Setup wins over a score, a higher
 * score over a lower, more trigger hits break ties, then long). ctx.limits = { setupsToday,
 * lastSetupT, openSetup, openAcrossSymbols?, dailyLossPct? } with ctx.now feed risk.dailyCaps; a
 * qualifying Setup held back by them is returned as `candidate` with `blocked` saying why.
 */
export function evaluate(ctx) {
  const empty = (why) => ({
    side: null, condition: { bias: ctx?.bias ?? null, session: ctx?.session ?? null, valueRelation: 'unknown', role: ctx?.session?.role ?? null, capped: null, hits: [] },
    zone: { level: null, zone: null, hits: [] }, trigger: { kind: null, sweep: null, hits: [] },
    score: 0, rawScore: 0, reasons: [], rejections: [why], blocked: null, candidate: null, setup: null, sides: null,
  });
  if (!ctx || !ctx.cfg) return empty('No config');
  if (!ctx.lastClosed || !Number.isFinite(ctx.lastClosed.c)) return empty('No closed analysis-TF candle yet');
  if (!Number.isFinite(ctx.atr) || ctx.atr <= 0) return empty('ATR not warm');

  const sides = { long: evaluateSide(ctx, 'long'), short: evaluateSide(ctx, 'short') };
  const rank = (r) => [r.setup ? 1 : 0, r.score, r.trigger.hits.length, r.side === 'long' ? 1 : 0];
  const best = [sides.long, sides.short].sort((a, b) => { const x = rank(a), y = rank(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return y[i] - x[i]; return 0; })[0];

  let setup = best.setup, blocked = null, candidate = null;
  if (setup) {
    const caps = dailyCaps({ ...(ctx.limits || {}), now: ctx.now ?? ctx.lastClosed.t }, ctx.cfg);
    if (!caps.allowed) { blocked = caps.reasons.join('; '); candidate = setup; setup = null; }
  }
  return {
    side: best.side, condition: best.condition, zone: best.zone, trigger: best.trigger,
    score: best.score, rawScore: best.rawScore, reasons: best.reasons, rejections: best.rejections,
    blocked, candidate, setup, sides,
  };
}
