// test/czt.test.mjs — SPEC §4.7 / §8. Every ctx is built by hand (plain objects) against the shipped
// config/strategy.json weights, so a weight change that breaks the gate breaks a test here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, evaluateSide, levelLabel, gradeFor, REAL_TRIGGERS, CONFIRM_ONLY } from '../lib/engine/czt.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CFG = JSON.parse(readFileSync(resolve(HERE, '../config/strategy.json'), 'utf8'));
const SYM = { id: 'BTCUSD', dp: 2, tick: 0.01, contract: { unitsPerLot: 1, label: 'BTC' } };
const M5 = 3e5, ATR = 100, T = Date.UTC(2026, 0, 13, 8, 0); // 08:00 GMT on a January Tuesday = London killzone

const lvl = (kind, price, extra = {}) => ({ id: `${kind}:${price}`, kind, price, t: T - 36e5, tf: '1m', side: /High|pdh|vah/.test(kind) ? 'buy-side' : 'sell-side', meta: {}, swept: null, ...extra });
const LEVELS = () => [
  lvl('consolidationHigh', 86500), lvl('equalHighs', 86300, { meta: { count: 2 }, tf: '5m' }), lvl('pdh', 86000),
  lvl('sessionHigh', 85800, { meta: { label: 'Late NY' } }), lvl('asiaHigh', 85500),
  lvl('asiaLow', 85120), lvl('sessionLow', 84900, { meta: { label: 'Late NY' } }), lvl('pdl', 84800),
];
const SESSION = (over = {}) => ({ id: 'london', label: 'London', role: 'manipulation', start: T - 36e5, end: T + 4 * 36e5, killzone: true, dayKey: '2026-01-13', ...over });
const store = (arr) => ({ closed: (tf, n) => (tf === '5m' ? (n ? arr.slice(-n) : arr) : []) });

/**
 * The source-01 picture: bullish bias, London killzone, the candle sweeps the Asia low 85,120 by
 * 0.8 ATR (manipulation low 85,040), closes back above AND engulfs the previous bearish 5m body.
 * The fixture carries NO Asia high: at 85,500 it would be the next buy-side pool at 0.62 R and veto the
 * trade (sources 02/04 — see the targets test); the Asia range here is "the low that got swept".
 */
function source01Long(over = {}) {
  const prev = { t: T - M5, o: 85300, h: 85310, l: 85210, c: 85220, v: 40, closed: true };
  const cur = { t: T, o: 85200, h: 85330, l: 85040, c: 85320, v: 50, buyV: 17.5, sellV: 32.5, closed: true };
  const levels = LEVELS().filter(l => l.kind !== 'asiaHigh');
  const asiaLow = levels.find(l => l.kind === 'asiaLow');
  return {
    symbol: 'BTCUSD', symbolCfg: SYM, cfg: CFG, now: T + M5, store: store([prev, cur]), atr: ATR,
    session: SESSION(), bias: { dir: 'bullish', strength: 0.6, reasons: ['1h EMA50 rising over 10 bars'] },
    levels, sweeps: [{ t: T, level: asiaLow, depth: 80, depthAtr: 0.8, reclaimed: true, candle: cur, reclaimedAfter: 0 }],
    zones: [], profile: null, prevDayProfile: { poc: 85300, vah: 85600, val: 85000, hvn: [], lvn: [], shape: 'D', buckets: [] },
    absorption: null, divergence: null, structure: { trend: 'bullish', lastBos: null, lastChoch: null },
    lastClosed: cur, deltaInfo: { value: -15, source: 'trades' },
    limits: { setupsToday: 0, lastSetupT: null, openSetup: null },
    ...over,
  };
}

test('source 01 long: sweep + reclaim + engulf in a London killzone with bullish bias → grade-A long, stop at the manipulation low − buffer', () => {
  const r = evaluate(source01Long());
  const s = r.setup;
  assert.ok(s, `expected a setup, got rejections ${JSON.stringify(r.rejections)}`);
  assert.equal(r.side, 'long');
  assert.equal(s.id, `BTCUSD-${T}-long`);
  assert.equal(s.symbol, 'BTCUSD'); assert.equal(s.t, T); assert.equal(s.tf, '5m'); assert.equal(s.side, 'long'); assert.equal(s.status, 'open');
  assert.equal(s.entry, 85320, 'entry = close of the trigger candle');
  assert.equal(s.stop, 85040 - 0.1 * ATR, 'stop = manipulation low − stopBufferAtr × ATR (source 01)');
  // hits: biasAligned 2 + killzone 1.5 | asiaLow→sessionHighLow 1.5 + POC/VAL→valueArea 1 | sweepReclaim 3 + engulfing 1 = 10
  assert.deepEqual(s.condition.hits, ['biasAligned', 'killzone']);
  assert.deepEqual(s.zone.hits.slice().sort(), ['sessionHighLow', 'valueArea']);
  assert.deepEqual(s.trigger.hits, ['sweepReclaim', 'engulfing']);
  assert.equal(s.score, 10); assert.equal(s.grade, 'A');
  assert.equal(s.trigger.kind, 'sweepReclaim');
  assert.equal(s.trigger.sweep.level.kind, 'asiaLow');
  assert.equal(s.zone.level.kind, 'asiaLow', 'the swept level is the primary zone');
  assert.equal(s.condition.valueRelation, 'inside');
  assert.equal(s.condition.session.id, 'london');
  // targets: nearest OPPOSING (buy-side) liquidity giving ≥ 1.5 R; the VAH (0.97 R) is a value edge, not a pool — stepped over
  assert.deepEqual(s.targets.map(t => t.price), [85800, 86000, 86300], 'nearest first, max 3 (consolidationHigh 86,500 is the 4th)');
  assert.deepEqual(s.targets.map(t => t.kind), ['sessionHigh', 'pdh', 'equalHighs']);
  assert.equal(s.targets[0].label, 'Late NY high 85,800.00');
  assert.equal(s.rr, s.targets[0].rr);
  assert.ok(Math.abs(s.rr - 480 / 290) < 1e-12);
  for (const t of s.targets) assert.ok(t.rr >= CFG.czt.minRr);
  // reasons in the sources' language, naming the exact price
  assert.ok(s.reasons.some(x => x === 'Swept sell-side liquidity at Asia low 85,120.00 and reclaimed (manipulation low 85,040.00)'), s.reasons.join('\n'));
  assert.ok(s.reasons.some(x => /^Bias pushing higher on 1h/.test(x)));
  assert.ok(s.reasons.some(x => /^London killzone/.test(x)));
  assert.ok(s.reasons.some(x => x.startsWith('At Asia low 85,120.00')));
  assert.ok(s.reasons.includes('Engulfed the previous 5m candle (whole range) — closed 85,320.00 above its body 85,300.00'), s.reasons.join('\n'));
  assert.equal(s.reasons.length, s.condition.hits.length + s.zone.hits.length + s.trigger.hits.length, 'one line per hit');
  assert.equal(s.invalidation, 'close below 85,030.00 (manipulation low 85,040.00 − 0.1 ATR buffer)');
  // size: $10 budget / 290 = 0.0345 BTC → floored to 0.03 lot (unitsPerLot 1)
  assert.deepEqual([s.size.units, s.size.lots, s.size.riskUsd, s.size.riskPct], [0.03, 0.03, 8.7, 0.87]);
  // the short side was scored too and lost
  assert.equal(r.sides.short.setup, null);
  assert.deepEqual(r.sides.short.trigger.hits, ['deltaConfirms'], 'negative closing delta is the only short hit — a confirmation');
  assert.deepEqual(r.sides.short.trigger.real, []); assert.equal(r.sides.short.trigger.kind, null);
  assert.deepEqual(s.trigger.real, ['sweepReclaim', 'engulfing']);
  assert.equal(s.stopWidened, undefined, '2.9 ATR stop needs no widening');
  assert.equal(r.blocked, null); assert.equal(r.candidate, null);
});

test('source 01: entry the candle AFTER the sweep — the stop is still the manipulation low, not the swept level (review finding czt.mjs:225)', () => {
  // Candle N (t = T) swept the Asia low to 85,040 and reclaimed; detectSweeps marked level.swept and will never re-emit it.
  // Candle N+1 engulfs N's body while still at the level → trigger engulfing, zone asiaLow. Old code: stop = min(85,120, N+1.l) − 10 = 85,110,
  // INSIDE the manipulation wick. Source 01: "your stop-loss has got to be at the manipulation low" — and entering later is explicitly allowed.
  const sweepC = { t: T, o: 85200, h: 85250, l: 85040, c: 85240, v: 50, buyV: 17.5, sellV: 32.5, closed: true };
  const next = { t: T + M5, o: 85230, h: 85300, l: 85160, c: 85290, v: 45, buyV: 28, sellV: 17, closed: true };
  const levels = LEVELS().filter(l => l.kind !== 'asiaHigh');
  levels.find(l => l.kind === 'asiaLow').swept = { t: T, depth: 80, reclaimed: true, reclaimedT: T };
  const ctx = source01Long({ lastClosed: next, store: store([sweepC, next]), levels, sweeps: [], now: T + 2 * M5, deltaInfo: { value: 11, source: 'trades' } });
  const r = evaluate(ctx), s = r.setup;
  assert.ok(s, JSON.stringify(r.rejections));
  assert.equal(s.entry, 85290);
  assert.equal(s.stop, 85040 - 0.1 * ATR, 'stop = candle N low − buffer (old code: 85,110, inside the wick)');
  assert.deepEqual(s.trigger.hits, ['engulfing', 'deltaConfirms']); assert.equal(s.trigger.kind, 'engulfing'); assert.equal(s.trigger.sweep, null);
  assert.equal(s.zone.level.kind, 'asiaLow', 'the recently swept level is the primary zone');
  assert.ok(s.reasons.some(x => /^At Asia low 85,120\.00 \(sell-side liquidity\) — swept and reclaimed 1 candle\(s\) ago, manipulation low 85,040\.00$/.test(x)), s.reasons.join('\n'));
  assert.match(s.invalidation, /^close below 85,030\.00 \(manipulation low 85,040\.00 − 0\.1 ATR buffer\)$/);
  // a 15m break AFTER the sweep still counts as ltfBos; one that closed before the sweep began does not
  const bos = evaluateSide({ ...ctx, structure: { trend: 'bullish', lastBos: { t: T, price: 85250, dir: 'up' }, lastChoch: null } }, 'long');
  assert.ok(bos.reasons.includes('15m break of structure up through 85,250.00 after the sweep'));
  const before = evaluateSide({ ...ctx, structure: { trend: 'bullish', lastBos: { t: T - 9e5, price: 85250, dir: 'up' }, lastChoch: null } }, 'long');
  assert.ok(!before.trigger.hits.includes('ltfBos'));
  // the sweep must be recent: older than triggerMaxAgeCandles (6) → the plain zone-edge stop applies again
  // (prevDayProfile off so the Asia low — not the prior-day POC magnet at 85,300 — is the nearest zone level)
  const stale = source01Long({ ...ctx, prevDayProfile: null, levels: levels.map(l => (l.kind === 'asiaLow' ? { ...l, swept: { t: T - 7 * M5, depth: 80, reclaimed: true, reclaimedT: T - 7 * M5 } } : l)) });
  assert.equal(evaluate(stale).sides.long.stop, 85120 - 10, 'a 7-candle-old sweep no longer anchors');
  // an unreclaimed sweep never anchors
  const un = source01Long({ ...ctx, prevDayProfile: null, levels: levels.map(l => (l.kind === 'asiaLow' ? { ...l, swept: { t: T, depth: 80, reclaimed: false, reclaimedT: null } } : l)) });
  assert.equal(evaluate(un).sides.long.stop, 85120 - 10);
});

test('deltaConfirms is a confirmation, never the only trigger; a PROXY delta is not awarded at all (review finding czt.mjs:156, source 05 §3)', () => {
  // green candle at the zone, no sweep / engulf / absorption / divergence / break — only the closing delta agrees
  const base = source01Long({ sweeps: [], engulfing: null, deltaInfo: { value: 30, source: 'trades' } });
  const r = evaluate(base);
  assert.equal(r.setup, null);
  assert.deepEqual(r.sides.long.trigger.hits, ['deltaConfirms']); assert.deepEqual(r.sides.long.trigger.real, []); assert.equal(r.sides.long.trigger.kind, null);
  assert.ok(r.sides.long.rejections.some(x => /^Only confirmations \(deltaConfirms\) — delta is arithmetic, not a trigger \(source 05 §3\)/.test(x)), r.sides.long.rejections.join('|'));
  assert.equal(r.sides.long.stop, null, 'no stop / targets are even computed without a real trigger');
  // the same candle from a feed without a trade tape: the proxy delta is the candle colour — no hit, no reason line
  const proxy = evaluateSide(source01Long({ sweeps: [], engulfing: null, deltaInfo: { value: 30, source: 'proxy' } }), 'long');
  assert.deepEqual(proxy.trigger.hits, []);
  assert.ok(!proxy.reasons.some(x => /Closing delta/.test(x)));
  // with a real trigger the executed delta still adds its weight and its line
  const withEng = evaluateSide(source01Long({ sweeps: [], deltaInfo: { value: 30, source: 'trades' } }), 'long');
  assert.deepEqual(withEng.trigger.hits, ['engulfing', 'deltaConfirms']); assert.deepEqual(withEng.trigger.real, ['engulfing']);
  assert.ok(withEng.reasons.includes('Closing delta +30 — aggressive buyers lifting the ask (confirmation)'));
  assert.equal(withEng.score, evaluateSide(source01Long({ sweeps: [], deltaInfo: { value: -30, source: 'trades' } }), 'long').score + CFG.czt.weights['trigger.deltaConfirms']);
  // the gate is ready for the Pro hits (SPEC-PRO §P5)
  for (const k of ['footprintImbalance', 'trappedTraders', 'bookAbsorption']) assert.ok(REAL_TRIGGERS.has(k), k);
  for (const k of ['deltaConfirms', 'unfinishedAuction']) { assert.ok(CONFIRM_ONLY.has(k), k); assert.ok(!REAL_TRIGGERS.has(k)); }
});

test('cvdDivergence built from a proxy CVD is labelled and does not satisfy the trigger gate (review finding czt.mjs:128)', () => {
  const base = source01Long({ sweeps: [], engulfing: null, deltaInfo: { value: 0 } });
  const real = evaluateSide({ ...base, divergence: { kind: 'bullish', t: T - M5, priceSwing: { price: 85050 }, source: 'trades' } }, 'long');
  assert.deepEqual(real.trigger.real, ['cvdDivergence']); assert.equal(real.trigger.kind, 'cvdDivergence');
  assert.ok(real.reasons.includes('Price made a lower low at 85,050.00 while CVD made a higher low — effort without result, sellers absorbed'));
  const proxy = evaluateSide({ ...base, divergence: { kind: 'bullish', t: T - M5, priceSwing: { price: 85050 }, source: 'proxy' } }, 'long');
  assert.deepEqual(proxy.trigger.hits, ['cvdDivergence'], 'still a weighted confirmation');
  assert.deepEqual(proxy.trigger.real, []); assert.equal(proxy.trigger.kind, null);
  assert.ok(proxy.reasons.includes('Price made a lower low at 85,050.00 while CVD made a higher low — effort without result, sellers absorbed (proxy — no trade tape)'));
  assert.ok(proxy.rejections.some(x => /^Only confirmations \(cvdDivergence\)/.test(x)));
});

test('targets: the NEXT opposing pool must pay minRr — the engine never measures R past an intervening pool (review finding czt.mjs:242)', () => {
  // Reviewer's reproduction: long at 1,004 / stop 993 (risk 11); Asia high 1,017 is the next pool at 1.18 R, PDH 1,048 at 4.0 R beyond it.
  const sym = { id: 'X', dp: 0, tick: 1, contract: { unitsPerLot: 1, label: 'X' } };
  const cur = { t: T, o: 1000, h: 1005, l: 994, c: 1004, v: 50, buyV: 20, sellV: 30, closed: true };
  const low = { id: 'asiaLow:996', kind: 'asiaLow', price: 996, t: T - 36e5, tf: '1m', side: 'sell-side', meta: {}, swept: null };
  const levels = [low, { ...low, id: 'asiaHigh:1017', kind: 'asiaHigh', price: 1017, side: 'buy-side' }, { ...low, id: 'pdh:1048', kind: 'pdh', price: 1048, side: 'buy-side' }];
  const ctx = source01Long({ symbol: 'X', symbolCfg: sym, atr: 10, lastClosed: cur, store: store([cur]), levels, prevDayProfile: null, engulfing: null,
    sweeps: [{ t: T, level: low, depth: 2, depthAtr: 0.2, reclaimed: true, candle: cur, reclaimedAfter: 0 }], deltaInfo: { value: -10, source: 'trades' } });
  const r = evaluate(ctx);
  assert.equal(r.setup, null);
  assert.equal(r.sides.long.stop, 993);
  assert.deepEqual(r.sides.long.targets, []);
  assert.ok(r.rejections.some(x => /^Next buy-side pool Asia high 1,017 pays only 1\.18 R < minRr 1\.5 — too close to pay for the stop; never target past it/.test(x)), r.rejections.join('|'));
  // move the Asia high out to 1.5 R+ and it IS the target, PDH second
  const ok = evaluate({ ...ctx, levels: levels.map(l => (l.kind === 'asiaHigh' ? { ...l, price: 1021 } : l)) });
  assert.ok(ok.setup); assert.deepEqual(ok.setup.targets.map(t => [t.price, t.kind]), [[1021, 'asiaHigh'], [1048, 'pdh']]);
  // a swept pool is not "resting liquidity" any more: it neither vetoes nor targets
  const swept = evaluate({ ...ctx, levels: levels.map(l => (l.kind === 'asiaHigh' ? { ...l, swept: { t: T - 36e5, depth: 3, reclaimed: true } } : l)) });
  assert.ok(swept.setup); assert.deepEqual(swept.setup.targets.map(t => t.price), [1048]);
  // value levels (VAH/POC) too close are stepped over, not vetoes: they are magnets, not resting stops
  const value = evaluate({ ...ctx, levels: [low, levels[2]], prevDayProfile: { poc: 1000, vah: 1012, val: 990 } });
  assert.ok(value.setup, JSON.stringify(value.rejections)); assert.deepEqual(value.setup.targets.map(t => t.price), [1048]);
  // a pool outside targetsFrom is neither a target nor a veto (the user chooses which pools count)
  const cfg = structuredClone(CFG); cfg.czt.targetsFrom = ['pdhPdl'];
  assert.deepEqual(evaluate({ ...ctx, cfg }).setup.targets.map(t => t.kind), ['pdh']);
});

test('czt.minStopAtr: a micro stop under a shallow sweep is widened AWAY from entry, rr/targets use the widened stop (review finding "micro stops")', () => {
  // shallow 0.05 ATR sweep of the Asia low, entry 15 points above the level: raw stop 85,105 is 0.30 ATR from entry 85,135
  const cur = { t: T, o: 85130, h: 85150, l: 85115, c: 85135, v: 160, buyV: 60, sellV: 100, closed: true };
  const levels = LEVELS().filter(l => l.kind !== 'asiaHigh');
  const asiaLow = levels.find(l => l.kind === 'asiaLow');
  const ctx = source01Long({ lastClosed: cur, store: store([cur]), levels, engulfing: null, absorption: { side: 'bullish', t: T, delta: -40 },
    sweeps: [{ t: T, level: asiaLow, depth: 5, depthAtr: 0.05, reclaimed: true, candle: cur, reclaimedAfter: 0 }], deltaInfo: { value: -40, source: 'trades' } });
  const r = evaluate(ctx), s = r.setup;
  assert.ok(s, JSON.stringify(r.rejections));
  assert.equal(s.stop, 85135 - 0.35 * ATR, 'entry − minStopAtr × ATR');
  assert.deepEqual(s.stopWidened, { from: 85105, to: 85100, minStopAtr: 0.35 });
  assert.ok(Math.abs(s.rr - (s.targets[0].price - 85135) / 35) < 1e-9, 'R measured against the widened stop');
  assert.equal(s.targets[0].kind, 'poc', 'the prior-day POC above is the nearest magnet');
  assert.ok(s.reasons.includes('Stop widened from 85,105.00 to 85,100.00 — the manipulation low 85,115.00 sits 0.30 ATR from entry, under czt.minStopAtr 0.35 (a stop inside the spread is fiction; widened away from entry, never toward it)'), s.reasons.join('\n'));
  assert.equal(s.invalidation, 'close below 85,100.00 (manipulation low 85,115.00, widened to 0.35 ATR minimum)');
  assert.equal(s.reasons.length, s.condition.hits.length + s.zone.hits.length + s.trigger.hits.length + 1, 'one extra line for the widening');
  // the setting is honoured: 0 disables it; maxStopAtr still applies after widening
  const cfg0 = structuredClone(CFG); cfg0.czt.minStopAtr = 0;
  const raw = evaluate({ ...ctx, cfg: cfg0 }).setup;
  assert.equal(raw.stop, 85105); assert.equal(raw.stopWidened, undefined);
  const cfgBig = structuredClone(CFG); cfgBig.czt.minStopAtr = 2.5; cfgBig.czt.maxStopAtr = 2;
  assert.ok(evaluate({ ...ctx, cfg: cfgBig }).rejections.some(x => /2\.50 ATR from entry > maxStopAtr 2/.test(x)));
  // a stop already wider than the minimum is never touched
  assert.equal(evaluate(source01Long()).setup.stop, 85030);
});

test('zones: prior-day LVNs are zones but never targets; the previous 4h candle high/low is a first-class level (review findings czt.mjs:166, liquidity.mjs:137)', () => {
  const lvnLevels = LEVELS().filter(l => !['asiaHigh', 'asiaLow'].includes(l.kind));
  lvnLevels.push({ id: 'lvn:1', kind: 'lvn', price: 85130, t: T - 36e5, tf: '1m', side: 'sell-side', meta: { source: 'prevDayProfile' }, swept: null });
  lvnLevels.push({ id: 'lvn:2', kind: 'lvn', price: 85700, t: T - 36e5, tf: '1m', side: 'buy-side', meta: { source: 'prevDayProfile' }, swept: null });
  const cur = { t: T, o: 85200, h: 85330, l: 85110, c: 85320, v: 50, buyV: 17.5, sellV: 32.5, closed: true };
  const ctx = source01Long({ lastClosed: cur, levels: lvnLevels, sweeps: [], prevDayProfile: null, deltaInfo: { value: 20, source: 'trades' } });
  const r = evaluateSide(ctx, 'long');
  assert.ok(r.trigger.hits.includes('engulfing'));
  assert.deepEqual(r.zone.hits, ['valueArea'], 'the LVN is a zone (weight group valueArea)');
  assert.ok(r.reasons.includes('At prior-day LVN 85,130.00 (low-volume node — rejection boundary)'));
  assert.equal(r.zone.level.kind, 'lvn');
  assert.ok(r.setup, JSON.stringify(r.rejections));
  assert.ok(!r.setup.targets.some(t => t.kind === 'lvn'), 'an LVN above entry is never a target');
  assert.equal(r.setup.stop, 85110 - 10, 'no sweep → the candle low under the LVN, − buffer');
  // previous 4h candle low as the swept level
  const pcl = { id: 'prevCandleLow:1', kind: 'prevCandleLow', price: 85120, t: T - 144e5, tf: '4h', side: 'sell-side', meta: { tf: '4h' }, swept: null };
  const pch = { id: 'prevCandleHigh:1', kind: 'prevCandleHigh', price: 85900, t: T - 144e5, tf: '4h', side: 'buy-side', meta: { tf: '4h' }, swept: null };
  const base = source01Long();
  const levels = base.levels.filter(l => l.kind !== 'asiaLow').concat([pcl, pch]);
  const r2 = evaluate({ ...base, levels, sweeps: [{ ...base.sweeps[0], level: pcl }] });
  assert.ok(r2.setup, JSON.stringify(r2.rejections));
  assert.ok(r2.setup.zone.hits.includes('prevCandle'));
  assert.ok(r2.setup.reasons.includes('Swept sell-side liquidity at previous 4h candle low 85,120.00 and reclaimed (manipulation low 85,040.00)'));
  assert.equal(r2.setup.score, 10 - CFG.czt.weights['zone.sessionHighLow'] + CFG.czt.weights['zone.prevCandle']);
  assert.ok(!r2.setup.targets.some(t => t.kind === 'prevCandleHigh'), 'prevCandle is not in targetsFrom by default');
  assert.equal(levelLabel(pch), 'previous 4h candle high');
});

test('evaluate is pure: same ctx → identical result, ctx untouched, no clock', () => {
  const a = source01Long(), b = source01Long();
  const snap = JSON.stringify({ ...a, store: null });
  const r1 = evaluate(a), r2 = evaluate(b), r3 = evaluate(a);
  assert.deepEqual(r1, r2); assert.deepEqual(r1, r3);
  assert.equal(JSON.stringify({ ...a, store: null }), snap, 'ctx is not mutated');
  for (const f of ['czt', 'risk']) {
    const code = readFileSync(resolve(HERE, `../lib/engine/${f}.mjs`), 'utf8').split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n');
    assert.ok(!/Date\.now\s*\(|new Date\s*\(/.test(code), `no clock in ${f}.mjs`);
  }
});

test('tradeOnlyInKillzones: outside a killzone the Condition layer caps the score below minScore; flag false lets it through', () => {
  const r = evaluate(source01Long({ session: SESSION({ id: 'asia', label: 'Asian', role: 'consolidation', killzone: false }) }));
  assert.equal(r.setup, null);
  assert.equal(r.condition.capped, 'outsideKillzone');
  assert.ok(r.score <= CFG.czt.minScore - 0.5, `score ${r.score} must sit under minScore`);
  assert.equal(r.rawScore, 8.5, 'raw = 10 − 1.5 killzone weight');
  assert.ok(r.rejections.some(x => /killzone/i.test(x)));
  assert.ok(r.reasons.some(x => /Outside the London \/ New York killzones/.test(x)));
  const cfg = structuredClone(CFG); cfg.sessions.tradeOnlyInKillzones = false;
  const r2 = evaluate(source01Long({ cfg, session: SESSION({ id: 'asia', label: 'Asian', role: 'consolidation', killzone: false }) }));
  assert.ok(r2.setup); assert.equal(r2.setup.score, 8.5); assert.equal(r2.setup.grade, 'B'); assert.equal(r2.condition.capped, null);
});

test('a Setup needs ≥ 1 trigger hit AND ≥ 1 zone hit', () => {
  // zone without trigger: no sweep, no engulf, delta against
  const noTrig = evaluate(source01Long({ sweeps: [], engulfing: null }));
  assert.equal(noTrig.setup, null);
  assert.ok(noTrig.rejections.some(x => /No trigger/.test(x)), noTrig.rejections.join('|'));
  assert.ok(noTrig.zone.hits.length >= 1);
  // trigger without zone: absorption in the middle of nowhere
  const noZone = evaluate(source01Long({ sweeps: [], engulfing: null, levels: [], prevDayProfile: null, absorption: { side: 'bullish', t: T, vol: 300, range: 20, delta: -40 } }));
  assert.equal(noZone.setup, null);
  assert.deepEqual(noZone.trigger.hits, ['absorption']);
  assert.ok(noZone.rejections.some(x => /No zone — never take a trigger in the middle of nowhere/.test(x)));
});

test('source 01: a stop beyond maxStopAtr skips the trade — the stop is never tightened', () => {
  const ctx = source01Long();
  ctx.lastClosed.l = 84760; ctx.sweeps[0].depth = 360; ctx.sweeps[0].depthAtr = 3.6; // 5.7 ATR from entry
  const r = evaluate(ctx);
  assert.equal(r.setup, null);
  assert.equal(r.sides.long.stop, 84750, 'reported stop is still the manipulation low − buffer');
  assert.ok(r.rejections.some(x => /5\.70 ATR from entry > maxStopAtr 3 .* non-negotiable/.test(x)), r.rejections.join('|'));
});

test('targets: opposing side only, never a swept pool, each ≥ minRr, nearest first, max 3', () => {
  const ctx = source01Long();
  ctx.levels.push(lvl('equalLows', 85900, { tf: '5m' }));                      // sell-side ABOVE entry: not opposing → ignored
  ctx.levels.find(l => l.kind === 'sessionHigh').swept = { t: T - 36e5, depth: 30, reclaimed: true }; // already taken (source 04)
  const s = evaluate(ctx).setup;
  assert.ok(s);
  assert.deepEqual(s.targets.map(t => t.price), [86000, 86300, 86500]);
  assert.ok(s.targets.every((t, i, a) => i === 0 || t.price > a[i - 1].price));
  // nothing beyond entry pays ≥ 1.5 R → no setup, with the nearest named
  // the Asia high at 85,500 is the NEXT buy-side pool and pays only 0.62 R → the trade is vetoed, not re-targeted past it
  const tight = source01Long({ levels: LEVELS() });
  const r = evaluate(tight);
  assert.equal(r.setup, null);
  assert.ok(r.rejections.some(x => /^Next buy-side pool Asia high 85,500\.00 pays only 0\.62 R < minRr 1\.5/.test(x)), r.rejections.join('|'));
  // nothing beyond entry pays and there is no pool to blame: the nearest candidate (a value edge) is named
  const nothing = source01Long();
  nothing.levels = nothing.levels.filter(l => l.side === 'sell-side');
  const r1 = evaluate(nothing);
  assert.equal(r1.setup, null);
  assert.ok(r1.rejections.some(x => /No opposing \(buy-side\) liquidity giving ≥ 1\.5 R — nearest prior-day VAH 85,600\.00 is 0\.97 R/.test(x)), r1.rejections.join('|'));
  const none = source01Long(); none.levels = none.levels.filter(l => l.side === 'sell-side'); none.prevDayProfile = null;
  assert.ok(evaluate(none).rejections.some(x => /No opposing \(buy-side\) liquidity above entry to target \(source 04\)/.test(x)));
});

test('short mirror: sweep above a session high in the NY killzone with bearish bias → short, stop at the manipulation high + buffer, sell-side targets', () => {
  const prev = { t: T - M5, o: 85320, h: 85430, l: 85310, c: 85420, v: 40, closed: true };
  const cur = { t: T, o: 85400, h: 85580, l: 85300, c: 85310, v: 60, buyV: 39, sellV: 21, closed: true };
  // no Asia low / Late-NY low: at 0.68 R / 1.46 R they would be the next sell-side pool and veto the short (sources 02/04)
  const levels = LEVELS().filter(l => !['asiaLow', 'sessionLow'].includes(l.kind)); levels.push(lvl('equalLows', 84500, { tf: '5m' }));
  const hi = levels.find(l => l.kind === 'asiaHigh'); // 85,500
  const ctx = source01Long({
    store: store([prev, cur]), lastClosed: cur, bias: { dir: 'bearish', strength: 0.4, reasons: [] },
    session: SESSION({ id: 'ny', label: 'New York', role: 'distribution' }), levels,
    sweeps: [{ t: T, level: hi, depth: 80, depthAtr: 0.8, reclaimed: true, candle: cur, reclaimedAfter: 0 }],
    deltaInfo: { value: 18, source: 'trades' },
  });
  const r = evaluate(ctx), s = r.setup;
  assert.ok(s, JSON.stringify(r.rejections));
  assert.equal(s.id, `BTCUSD-${T}-short`); assert.equal(s.side, 'short');
  assert.equal(s.entry, 85310); assert.equal(s.stop, 85580 + 10);
  assert.deepEqual(s.trigger.hits, ['sweepReclaim', 'engulfing']);
  assert.deepEqual(s.targets.map(t => t.price), [84800, 84500], 'the VAL (1.11 R) is a value edge, stepped over; PDL then equal lows');
  assert.ok(s.reasons.includes('Swept buy-side liquidity at Asia high 85,500.00 and reclaimed (manipulation high 85,580.00)'));
  assert.ok(s.reasons.some(x => /^New York killzone — distribution window/.test(x)));
  assert.equal(s.invalidation, 'close above 85,590.00 (manipulation high 85,580.00 + 0.1 ATR buffer)');
  assert.equal(r.sides.long.setup, null);
});

test('limits (ctx.limits): one open per symbol, daily cap and cooldown hold a qualifying setup back as `candidate`', () => {
  const open = evaluate(source01Long({ limits: { setupsToday: 1, lastSetupT: T - 2 * 36e5, openSetup: { id: 'BTCUSD-1-long' } } }));
  assert.equal(open.setup, null); assert.ok(open.candidate); assert.equal(open.candidate.id, `BTCUSD-${T}-long`);
  assert.match(open.blocked, /One open setup per symbol: BTCUSD-1-long is still open/);
  const cap = evaluate(source01Long({ limits: { setupsToday: 3, lastSetupT: T - 2 * 36e5, openSetup: null } }));
  assert.equal(cap.setup, null); assert.match(cap.blocked, /Daily cap reached: 3\/3/);
  const cold = evaluate(source01Long({ now: T, limits: { setupsToday: 1, lastSetupT: T - 10 * 60e3, openSetup: null } }));
  assert.equal(cold.setup, null); assert.match(cold.blocked, /Cooldown: 20 min left of 30/);
  const warm = evaluate(source01Long({ now: T, limits: { setupsToday: 1, lastSetupT: T - 31 * 60e3, openSetup: null } }));
  assert.ok(warm.setup); assert.equal(warm.blocked, null);
  // limits never change the analysis itself
  assert.deepEqual(cold.candidate, warm.setup);
});

test('no sweep: absorption at a bullish order block → stop at the zone far edge − buffer, trigger kind absorption', () => {
  const cur = { t: T, o: 85200, h: 85270, l: 85150, c: 85260, v: 150, buyV: 52, sellV: 98, closed: true };
  const ctx = source01Long({
    lastClosed: cur, store: store([cur]), sweeps: [], engulfing: null,
    zones: [{ id: 'orderBlock:bullish:1', kind: 'orderBlock', side: 'bullish', top: 85180, bottom: 85100, t: T - 4 * M5, tf: '5m', mitigated: true }],
    absorption: { side: 'bullish', t: T, vol: 150, range: 120, delta: -46 },
  });
  const s = evaluate(ctx).setup;
  assert.ok(s);
  assert.equal(s.trigger.kind, 'absorption');
  assert.deepEqual(s.trigger.hits, ['absorption']);
  assert.deepEqual(s.zone.hits.slice().sort(), ['orderBlock', 'sessionHighLow', 'valueArea']);
  assert.equal(s.zone.zone.kind, 'orderBlock');
  assert.equal(s.stop, 85100 - 10, 'order block bottom − buffer');
  assert.equal(s.score, 9.5); assert.equal(s.grade, 'A');
  assert.ok(s.reasons.includes('Inside bullish order block 85,100.00–85,180.00'));
  assert.ok(s.reasons.includes('Bullish absorption at 85,150.00: heavy sells hit the bid (delta -46), no follow-through, closed back up — sellers trapped'));
  assert.equal(s.invalidation, 'close below 85,090.00 (order block far edge 85,100.00 − 0.1 ATR buffer)');
  // a trigger candle that wicks below the zone pushes the stop under that wick, never inside it
  const deeper = source01Long({ ...ctx, lastClosed: { ...cur, l: 85060 } });
  assert.equal(evaluate(deeper).setup.stop, 85060 - 10);
  // an FVG alone is a zone too (source 01: "inside this area of imbalance")
  const fvg = evaluate(source01Long({ ...ctx, zones: [{ id: 'fvg:bullish:1', kind: 'fvg', side: 'bullish', top: 85200, bottom: 85140, t: T - 3 * M5, tf: '5m', mitigated: false }] }));
  assert.ok(fvg.setup.zone.hits.includes('fvg'));
  assert.equal(fvg.setup.stop, 85140 - 10);
  assert.ok(fvg.setup.reasons.includes('Inside bullish imbalance (FVG) 85,140.00–85,200.00'));
});

test('condition: value relation (source 05 §6 step 1) — outside value expects expansion, inside near VAL fades the extreme, no profile is "unknown"', () => {
  const above = evaluateSide(source01Long({ prevDayProfile: { poc: 85000, vah: 85250, val: 84700 } }), 'long');
  assert.equal(above.condition.valueRelation, 'above');
  assert.ok(above.condition.hits.includes('outsideValueTrend'));
  assert.ok(above.reasons.includes('Accepting above prior-day value (VAH 85,250.00 / VAL 84,700.00) — expect expansion higher'));
  const inside = evaluateSide(source01Long({ prevDayProfile: { poc: 85500, vah: 85900, val: 85290 } }), 'long');
  assert.equal(inside.condition.valueRelation, 'inside');
  assert.ok(inside.condition.hits.includes('insideValueRotation'));
  assert.ok(!inside.condition.hits.includes('outsideValueTrend'));
  const below = evaluateSide(source01Long({ prevDayProfile: { poc: 85900, vah: 86100, val: 85700 } }), 'long');
  assert.equal(below.condition.valueRelation, 'below');
  assert.ok(!below.condition.hits.includes('outsideValueTrend'), 'below value is a SHORT expansion condition, not a long one');
  const none = evaluateSide(source01Long({ prevDayProfile: null }), 'long');
  assert.equal(none.condition.valueRelation, 'unknown');
  assert.deepEqual(none.condition.hits, ['biasAligned', 'killzone']);
  assert.equal(none.condition.role, 'manipulation');
});

test('triggers: CVD divergence and structure break age out; BOS must come after the sweep; CHoCH counts; delta sign and proxy note', () => {
  const base = source01Long();
  const fresh = evaluateSide({ ...base, divergence: { kind: 'bullish', t: T - 2 * M5, priceSwing: { price: 85050 }, cvdSwing: { price: -120 } } }, 'long');
  assert.ok(fresh.trigger.hits.includes('cvdDivergence'));
  assert.ok(fresh.reasons.includes('Price made a lower low at 85,050.00 while CVD made a higher low — effort without result, sellers absorbed'));
  const stale = evaluateSide({ ...base, divergence: { kind: 'bullish', t: T - 10 * M5, priceSwing: 85050 } }, 'long');
  assert.ok(!stale.trigger.hits.includes('cvdDivergence'));
  const wrongKind = evaluateSide({ ...base, divergence: { kind: 'bearish', t: T - M5 } }, 'long');
  assert.ok(!wrongKind.trigger.hits.includes('cvdDivergence'));

  // the 15m candle that contains the 5m sweep candle (t = T) broke structure → confirmation
  const bos = evaluateSide({ ...base, structure: { trend: 'bullish', lastBos: { t: T, price: 85250, dir: 'up' }, lastChoch: null } }, 'long');
  assert.ok(bos.trigger.hits.includes('ltfBos'));
  assert.ok(bos.reasons.includes('15m break of structure up through 85,250.00 after the sweep'));
  // the 15m candle that CLOSED as the sweep candle opened broke before the sweep → not a confirmation of it
  const closedBefore = evaluateSide({ ...base, structure: { trend: 'bullish', lastBos: { t: T - 9e5, price: 85250, dir: 'up' }, lastChoch: null } }, 'long');
  assert.ok(!closedBefore.trigger.hits.includes('ltfBos'));
  // with no sweep, any recent break in the side direction counts
  const noSweep = evaluateSide({ ...base, sweeps: [], structure: { trend: 'bullish', lastBos: { t: T - 9e5, price: 85250, dir: 'up' }, lastChoch: null } }, 'long');
  assert.ok(noSweep.reasons.includes('15m break of structure up through 85,250.00'));
  const before = evaluateSide({ ...base, structure: { trend: 'bullish', lastBos: { t: T - 2 * 36e5, price: 85250, dir: 'up' }, lastChoch: null } }, 'long');
  assert.ok(!before.trigger.hits.includes('ltfBos'), 'a break two hours before the sweep is not a confirmation of it');
  const choch = evaluateSide({ ...base, structure: { trend: 'bullish', lastBos: null, lastChoch: { t: T, price: 85250, dir: 'up' } } }, 'long');
  assert.ok(choch.reasons.includes('15m change of character up through 85,250.00 after the sweep'));
  const down = evaluateSide({ ...base, structure: { trend: 'bearish', lastBos: { t: T, price: 85250, dir: 'down' }, lastChoch: null } }, 'long');
  assert.ok(!down.trigger.hits.includes('ltfBos'));

  const delta = evaluateSide({ ...base, deltaInfo: { value: 22.5, source: 'trades' } }, 'long');
  assert.ok(delta.trigger.hits.includes('deltaConfirms'));
  assert.ok(delta.reasons.includes('Closing delta +22.5 — aggressive buyers lifting the ask (confirmation)'));
  assert.ok(!evaluateSide({ ...base, deltaInfo: { value: 22.5, source: 'proxy' } }, 'long').trigger.hits.includes('deltaConfirms'), 'a proxy delta is the candle colour, not flow');
  assert.ok(evaluateSide({ ...base, deltaInfo: 40 }, 'long').trigger.hits.includes('deltaConfirms'), 'a bare number works too');
  assert.ok(!evaluateSide({ ...base, deltaInfo: { value: 0 } }, 'long').trigger.hits.includes('deltaConfirms'));
});

test('engulfing: precomputed ctx.engulfing wins over the store; no store and no override → no hit', () => {
  const override = evaluateSide(source01Long({ store: null, engulfing: { side: 'bullish', bodyAtr: 1.2, full: true } }), 'long');
  assert.ok(override.trigger.hits.includes('engulfing'));
  assert.ok(override.reasons.some(x => x.startsWith('Engulfed the previous 5m candle (whole range)')));
  assert.ok(!evaluateSide(source01Long({ store: null }), 'long').trigger.hits.includes('engulfing'));
  assert.ok(!evaluateSide(source01Long({ engulfing: { side: 'bearish' } }), 'long').trigger.hits.includes('engulfing'));
  assert.ok(evaluateSide(source01Long({ store: null, engulfing: true }), 'long').trigger.hits.includes('engulfing'), 'a bare truthy engulf uses the candle colour');
});

test('absorption must be on the trigger candle and on the right side; a delayed-reclaim sweep uses the deepest excursion', () => {
  const old = evaluateSide(source01Long({ absorption: { side: 'bullish', t: T - M5, delta: -40 } }), 'long');
  assert.ok(!old.trigger.hits.includes('absorption'));
  const bear = evaluateSide(source01Long({ absorption: { side: 'bearish', t: T, delta: 40 } }), 'long');
  assert.ok(!bear.trigger.hits.includes('absorption'));
  // reclaim came one candle after the sweep: the sweep candle wicked to 85,000, this candle only to 85,060
  const ctx = source01Long();
  ctx.lastClosed.l = 85060; ctx.lastClosed.c = 85200; ctx.engulfing = null;
  ctx.sweeps[0] = { t: T, level: { ...ctx.levels.find(l => l.kind === 'asiaLow'), swept: { t: T - M5, depth: 120, reclaimed: true, reclaimedT: T } }, depth: 120, depthAtr: 1.2, reclaimed: true, candle: ctx.lastClosed, reclaimedAfter: 1 };
  const s = evaluate(ctx).setup;
  assert.ok(s);
  assert.equal(s.stop, 85000 - 10, 'manipulation low = level − deepest depth, not this candle\'s low');
  assert.ok(s.reasons.includes('Swept sell-side liquidity at Asia low 85,120.00 and reclaimed (manipulation low 85,000.00)'));
  // an unreclaimed sweep is not a trigger
  const un = source01Long(); un.sweeps[0].reclaimed = false; un.engulfing = null;
  assert.equal(evaluate(un).setup, null);
});

test('a sweep level missing from ctx.levels still counts as the zone (price demonstrably reached it)', () => {
  const ctx = source01Long({ levels: LEVELS().filter(l => l.kind !== 'asiaLow' && l.kind !== 'asiaHigh'), prevDayProfile: null });
  const r = evaluate(ctx);
  assert.ok(r.setup, JSON.stringify(r.rejections));
  assert.deepEqual(r.setup.zone.hits, ['sessionHighLow']);
});

test('degenerate ctx never throws: missing ctx, no candle, cold ATR, missing optional fields', () => {
  for (const bad of [null, undefined, {}, { cfg: CFG }, { cfg: CFG, lastClosed: { c: 1 }, atr: 0 }, { cfg: CFG, lastClosed: {}, atr: 1 }]) {
    const r = evaluate(bad);
    assert.equal(r.setup, null); assert.equal(r.score, 0); assert.equal(r.rejections.length, 1);
  }
  const sparse = evaluate({ cfg: CFG, atr: ATR, lastClosed: { t: T, o: 1, h: 2, l: 0, c: 1, closed: true } });
  assert.equal(sparse.setup, null); assert.ok(sparse.rejections.length >= 2);
  const noWeights = structuredClone(CFG); delete noWeights.czt.weights;
  assert.equal(evaluate(source01Long({ cfg: noWeights })).score, 0);
});

test('levelLabel and gradeFor speak the sources\' language', () => {
  assert.equal(levelLabel(lvl('asiaLow', 1)), 'Asia low');
  assert.equal(levelLabel(lvl('pdh', 1)), 'previous day high');
  assert.equal(levelLabel(lvl('sessionLow', 1, { meta: { label: 'London' } })), 'London low');
  assert.equal(levelLabel(lvl('equalLows', 1, { meta: { count: 3 } })), 'equal lows (×3)');
  assert.equal(levelLabel({ kind: 'nakedPoc' }), 'naked POC');
  assert.equal(levelLabel({ kind: 'lvn' }), 'prior-day LVN');
  assert.equal(levelLabel({ kind: 'prevCandleLow', meta: { tf: '1h' } }), 'previous 1h candle low');
  assert.equal(levelLabel({ kind: 'somethingNew' }), 'somethingNew');
  assert.deepEqual([5, 7, 8.99, 9, 12].map(s => gradeFor(s, CFG.czt)), ['C', 'B', 'B', 'A', 'A']);
});

// ---------------------------------------------------------------------------------------------------------------
// SPEC-PRO §P5 — the Pro hits (source 05 §2–§4) and the confirmation-only gate
// ---------------------------------------------------------------------------------------------------------------
/** A Footprint in the engine's shape (only the fields czt reads matter: t, stacked, unfinished*, high/low, poc, close). */
const fpOf = ({ t = T, stacked = [], unfinishedHigh = false, unfinishedLow = false, high = 85330, low = 85040, close = 85320, levels = [], poc = 85100 } = {}) =>
  ({ t, tf: '5m', bucket: 5, tick: 0.01, open: 85200, close, high, low, totalBid: 30, totalAsk: 20, total: 50, delta: -10, poc, levels, imbalances: [], stacked, unfinishedHigh, unfinishedLow, nTrades: 100, partial: false, truncated: false });
const BOOK = (over = {}) => ({ t: T + M5, bestBid: 85319, bestAsk: 85320, mid: 85319.5, spread: 1, spreadBp: 0.12, bidDepth: 14, askDepth: 6, imbalance: 0.4, walls: [], nearestWall: { bid: null, ask: null }, pulled: [], absorbed: [], tradedThrough: [], levels: { bids: [], asks: [] }, ...over });

test('Pro: trigger.footprintImbalance — a stacked imbalance in the side\'s direction on the trigger candle is a REAL trigger named at the zone (SPEC-PRO §P5, source 05 §3)', () => {
  const stackedBuy = [{ side: 'buy', from: 85040, to: 85060, count: 4 }];
  const base = source01Long({ footprint: fpOf({ stacked: stackedBuy }) });
  const r = evaluate(base);
  assert.ok(r.setup, r.rejections.join('|'));
  assert.ok(r.trigger.hits.includes('footprintImbalance') && r.trigger.real.includes('footprintImbalance'));
  assert.ok(r.setup.reasons.includes('Stacked buy imbalances (×4) at the Asia low — aggressive buyers stepping in at the zone'), r.setup.reasons.join('\n'));
  assert.equal(r.score, evaluate(source01Long()).score + CFG.czt.weights['trigger.footprintImbalance'], 'adds exactly its weight');
  assert.equal(r.trigger.kind, 'sweepReclaim', 'the sweep outranks it for Setup.trigger.kind');
  // alone (no sweep / engulf / absorption / divergence / break) it satisfies the ≥ 1-REAL-trigger gate and names the kind
  const alone = evaluate(source01Long({ sweeps: [], engulfing: null, deltaInfo: { value: 0 }, footprint: fpOf({ stacked: stackedBuy }) }));
  assert.ok(alone.setup, alone.rejections.join('|'));
  assert.deepEqual(alone.trigger.hits, ['footprintImbalance']); assert.deepEqual(alone.trigger.real, ['footprintImbalance']); assert.equal(alone.trigger.kind, 'footprintImbalance');
  assert.match(alone.setup.reasons.find(x => /^Stacked buy/.test(x)), /^Stacked buy imbalances \(×4\) at the prior-day POC — aggressive buyers stepping in at the zone$/, 'without a sweep the nearest zone level names the place');
  // a SELL run is against a long (and is the short's hit); a footprint from another candle is not this candle's flow
  const against = evaluateSide(source01Long({ footprint: fpOf({ stacked: [{ side: 'sell', from: 85300, to: 85330, count: 3 }] }) }), 'long');
  assert.ok(!against.trigger.hits.includes('footprintImbalance'));
  assert.ok(evaluateSide(source01Long({ footprint: fpOf({ stacked: [{ side: 'sell', from: 85300, to: 85330, count: 3 }] }) }), 'short').trigger.hits.includes('footprintImbalance'));
  const stale = evaluateSide(source01Long({ footprint: fpOf({ t: T - M5, stacked: stackedBuy }) }), 'long');
  assert.ok(!stale.trigger.hits.includes('footprintImbalance'), 'a footprint stamped on another candle is ignored');
  // entry the candle AFTER a reclaimed sweep: the stacked run on the SWEEP candle still counts ("or on the sweep candle for a reclaim")
  const sweepC = { t: T, o: 85200, h: 85250, l: 85040, c: 85240, v: 50, buyV: 17.5, sellV: 32.5, closed: true };
  const next = { t: T + M5, o: 85230, h: 85300, l: 85160, c: 85290, v: 45, buyV: 28, sellV: 17, closed: true };
  const levels = LEVELS().filter(l => l.kind !== 'asiaHigh');
  levels.find(l => l.kind === 'asiaLow').swept = { t: T, depth: 80, reclaimed: true, reclaimedT: T };
  const after = evaluateSide(source01Long({ lastClosed: next, store: store([sweepC, next]), levels, sweeps: [], now: T + 2 * M5, engulfing: null, deltaInfo: { value: 0 },
    footprints: [fpOf({ t: T, stacked: stackedBuy, close: 85240 }), fpOf({ t: T + M5, close: 85290 })] }), 'long');
  assert.ok(after.trigger.real.includes('footprintImbalance'), after.trigger.hits.join(','));
  assert.ok(after.reasons.includes('Stacked buy imbalances (×4) at the Asia low on the sweep candle — aggressive buyers stepping in at the zone'), after.reasons.join('\n'));
});

test('Pro: trigger.trappedTraders — footprint.trappedTraders() agreeing with the side is a REAL trigger; ctx.trapped (precomputed) wins (source 05 §4)', () => {
  const lv = (from, to, step) => { const out = []; for (let p = from; p <= to + 1e-9; p += step) out.push({ price: Math.round(p * 100) / 100, bid: 1, ask: 1, delta: 0, total: 2, n: 2 }); return out; };
  // previous candle: stacked SELL imbalances in its lower third (85,000–85,020 of 85,000–85,100); the trigger candle closes above → trapped sellers (bullish)
  const prev = fpOf({ t: T - M5, levels: lv(85000, 85100, 5), stacked: [{ side: 'sell', from: 85000, to: 85020, count: 3 }], close: 85050 });
  const base = source01Long({ sweeps: [], engulfing: null, deltaInfo: { value: 0 }, footprints: [prev, fpOf({ t: T, close: 85320 })] });
  const r = evaluate(base);
  assert.ok(r.setup, r.rejections.join('|'));
  assert.deepEqual(r.trigger.hits, ['trappedTraders']); assert.equal(r.trigger.kind, 'trappedTraders');
  assert.ok(r.setup.reasons.includes('Trapped sellers: stacked sell imbalances at 85,000–85,020 then a close above (85,320) — their stops are market buys'), r.setup.reasons.join('\n'));
  assert.ok(!evaluateSide(base, 'short').trigger.hits.includes('trappedTraders'), 'a bullish trap is not a short\'s trigger');
  // a bearish trap (stacked BUY in the upper third, then a close below) is the short's
  const prevBuy = fpOf({ t: T - M5, levels: lv(85300, 85400, 5), stacked: [{ side: 'buy', from: 85380, to: 85400, count: 3 }], close: 85390 });
  const bear = evaluateSide(source01Long({ sweeps: [], engulfing: null, deltaInfo: { value: 0 }, footprints: [prevBuy, fpOf({ t: T, close: 85320 })] }), 'short');
  assert.ok(bear.trigger.real.includes('trappedTraders'), bear.trigger.hits.join(','));
  assert.ok(bear.reasons.some(x => /^Trapped buyers: stacked buy imbalances at 85,380–85,400 then a close below \(85,320\) — their stops are market sells$/.test(x)), bear.reasons.join('\n'));
  // the analyst passes its own result: null means "none", even when ctx.footprints would say otherwise; a stale trap (other candle) is ignored
  assert.ok(!evaluateSide({ ...base, trapped: null }, 'long').trigger.hits.includes('trappedTraders'));
  const explicit = evaluateSide({ ...base, footprints: [], trapped: { side: 'bullish', t: T, at: T - M5, levels: [85000], edge: 85020, close: 85320, reason: 'Trapped sellers: custom line' } }, 'long');
  assert.ok(explicit.reasons.includes('Trapped sellers: custom line'));
  assert.ok(!evaluateSide({ ...base, footprints: [], trapped: { side: 'bullish', t: T - M5, edge: 85020, close: 85320, reason: 'x' } }, 'long').trigger.hits.includes('trappedTraders'));
});

test('Pro: trigger.bookAbsorption — an absorbed wall on the side\'s favour within zoneToleranceAtr of entry and inside absorbWindowSec is a REAL trigger (source 05 §4)', () => {
  const wall = { side: 'bid', price: 85300, qty: 12, lastQty: 12, tradedQty: 7, at: T + M5 - 30e3, ageMs: 30e3 };
  const base = source01Long({ sweeps: [], engulfing: null, deltaInfo: { value: 0 }, book: BOOK({ imbalance: 0, absorbed: [wall] }) });
  const r = evaluate(base);
  assert.ok(r.setup, r.rejections.join('|'));
  assert.deepEqual(r.trigger.hits, ['bookAbsorption']); assert.equal(r.trigger.kind, 'bookAbsorption');
  assert.ok(r.setup.reasons.includes('Absorption at the bid wall 85,300.00: 7 traded into 12 resting and it held — passive buyers soaking up market sells (visible top of book)'), r.setup.reasons.join('\n'));
  assert.ok(!evaluateSide(base, 'short').trigger.hits.includes('bookAbsorption'), 'a bid wall absorbing is bullish, never the short\'s trigger');
  assert.ok(evaluateSide({ ...base, book: BOOK({ imbalance: 0, absorbed: [{ ...wall, side: 'ask', price: 85330 }] }) }, 'short').trigger.hits.includes('bookAbsorption'));
  assert.ok(!evaluateSide({ ...base, book: BOOK({ imbalance: 0, absorbed: [{ ...wall, ageMs: 121e3 }] }) }, 'long').trigger.hits.includes('bookAbsorption'), 'older than orderbook.absorbWindowSec');
  assert.ok(!evaluateSide({ ...base, book: BOOK({ imbalance: 0, absorbed: [{ ...wall, price: 85200 }] }) }, 'long').trigger.hits.includes('bookAbsorption'), 'further than zoneToleranceAtr (0.5 ATR = 50) from entry');
  assert.ok(!evaluateSide({ ...base, book: null }, 'long').trigger.hits.includes('bookAbsorption'));
});

test('Pro: trigger.unfinishedAuction is a CONFIRMATION only — weight, a reason line, never the gate (SPEC-PRO §P5)', () => {
  const base = source01Long({ sweeps: [], engulfing: null, deltaInfo: { value: 0 }, footprint: fpOf({ unfinishedHigh: true }) });
  const r = evaluate(base);
  assert.equal(r.setup, null);
  assert.deepEqual(r.sides.long.trigger.hits, ['unfinishedAuction']); assert.deepEqual(r.sides.long.trigger.real, []); assert.equal(r.sides.long.trigger.kind, null);
  assert.ok(r.sides.long.rejections.some(x => /^Only confirmations \(unfinishedAuction\)/.test(x)), r.sides.long.rejections.join('|'));
  assert.ok(r.sides.long.reasons.includes("Unfinished auction at the trigger candle's high 85,330.00 — both sides printed at the extreme, the market may revisit it to complete business (target-side magnet, confirmation)"), r.sides.long.reasons.join('\n'));
  // with the sweep it adds exactly its weight; the LOW being unfinished is the short's magnet, not the long's
  const withSweep = evaluate(source01Long({ footprint: fpOf({ unfinishedHigh: true }) }));
  assert.equal(withSweep.score, evaluate(source01Long()).score + CFG.czt.weights['trigger.unfinishedAuction']);
  assert.ok(!evaluateSide(source01Long({ footprint: fpOf({ unfinishedLow: true }) }), 'long').trigger.hits.includes('unfinishedAuction'));
  assert.ok(evaluateSide(source01Long({ footprint: fpOf({ unfinishedLow: true }) }), 'short').trigger.hits.includes('unfinishedAuction'));
});

test('Pro: condition.bookImbalance — |depth imbalance| ≥ orderbook.imbalanceMin in the side\'s favour (source 05 §2: context, not conviction)', () => {
  const r = evaluate(source01Long({ book: BOOK({ imbalance: 0.3 }) }));
  assert.ok(r.setup && r.condition.hits.includes('bookImbalance'), r.condition.hits.join(','));
  assert.ok(r.setup.reasons.includes('Visible book 30 % bid-heavy (depth imbalance +0.3, ≥ 0.25) — resting buyers outweigh; top of book, not level 3'), r.setup.reasons.join('\n'));
  assert.equal(r.score, evaluate(source01Long()).score + CFG.czt.weights['condition.bookImbalance']);
  assert.ok(!evaluateSide(source01Long({ book: BOOK({ imbalance: 0.2 }) }), 'long').condition.hits.includes('bookImbalance'), 'below imbalanceMin');
  assert.ok(!evaluateSide(source01Long({ book: BOOK({ imbalance: -0.3 }) }), 'long').condition.hits.includes('bookImbalance'), 'ask-heavy is the short\'s context');
  assert.ok(evaluateSide(source01Long({ book: BOOK({ imbalance: -0.3 }) }), 'short').condition.hits.includes('bookImbalance'));
  // a book alone never makes a Setup: it is a Condition, and the gate still needs a REAL trigger
  const only = evaluate(source01Long({ sweeps: [], engulfing: null, deltaInfo: { value: 0 }, book: BOOK({ imbalance: 0.6 }) }));
  assert.equal(only.setup, null); assert.ok(only.sides.long.rejections.some(x => /^No trigger on the last closed candle/.test(x)));
  // every Pro weight is in the shipped config, so a missing one would make the scorer silently ignore the hit
  for (const k of ['trigger.footprintImbalance', 'trigger.trappedTraders', 'trigger.bookAbsorption', 'trigger.unfinishedAuction', 'condition.bookImbalance']) assert.equal(typeof CFG.czt.weights[k], 'number', k);
});
