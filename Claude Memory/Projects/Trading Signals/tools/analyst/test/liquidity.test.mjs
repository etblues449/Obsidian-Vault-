// test/liquidity.test.mjs — SPEC §4.4 / §8. Generators are inline (helpers.mjs is a sibling build).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLevels, detectSweeps, dedupeLevels, levelSide } from '../lib/engine/liquidity.mjs';

const M = 60e3, H = 36e5;
const SESS = {
  timezone: 'Europe/London',
  list: [
    { id: 'asia', label: 'Asian', start: '00:00', end: '07:00', role: 'consolidation' },
    { id: 'london', label: 'London', start: '07:00', end: '12:00', role: 'manipulation', killzone: { start: '07:00', end: '10:00' } },
    { id: 'ny', label: 'New York', start: '12:00', end: '17:00', role: 'distribution', killzone: { start: '13:30', end: '16:00' } },
    { id: 'late', label: 'Late NY', start: '17:00', end: '24:00', role: 'retracement' },
  ],
};
const LIQ = { equalLevelToleranceAtr: 0.15, sweepMinDepthAtr: 0.05, sweepMaxDepthAtr: 2.0, consolidationCandles: 12, consolidationMaxRangeAtr: 2.5, levelExpiryHours: 72 };

const mk = (t, o, h, l, c, closed = true) => ({ t, o, h, l, c, v: 1, closed });
/** Flat 1m candles from `from` for `minutes`, with spikes { t, h?, l? }. */
function flat1m(from, minutes, price = 100, spikes = []) {
  const sp = new Map(spikes.map(s => [s.t, s])), out = [];
  for (let i = 0; i < minutes; i++) { const t = from + i * M, s = sp.get(t); out.push(mk(t, price, s?.h ?? price + 0.1, s?.l ?? price - 0.1, price)); }
  return out;
}
/** 1m → higher-TF aggregation (UTC-aligned buckets), last bucket closed only if complete. */
function agg(c1m, ms) {
  const b = new Map();
  for (const x of c1m) {
    const k = Math.floor(x.t / ms) * ms;
    let y = b.get(k);
    if (!y) b.set(k, (y = { t: k, o: x.o, h: x.h, l: x.l, c: x.c, v: 0, closed: true }));
    y.h = Math.max(y.h, x.h); y.l = Math.min(y.l, x.l); y.c = x.c; y.v += x.v;
  }
  const out = [...b.values()], last = out[out.length - 1], lastT = c1m[c1m.length - 1]?.t ?? 0;
  if (last && last.t + ms > lastT + M) last.closed = false;
  return out;
}
/** Minimal CandleStore stand-in (SPEC §4.1 `closed(tf, n?)`). */
function storeFrom1m(c1m) {
  const tfs = { '1m': c1m, '5m': agg(c1m, 5 * M), '15m': agg(c1m, 15 * M), '1h': agg(c1m, H), '4h': agg(c1m, 4 * H) };
  return storeOf(Object.fromEntries(Object.entries(tfs).map(([k, v]) => [k, v.filter(c => c.closed)])));
}
const storeOf = tfs => ({ closed: (tf, n) => (n ? (tfs[tf] || []).slice(-n) : tfs[tf] || []), get: tf => tfs[tf] || [], last: tf => (tfs[tf] || []).at(-1) });
const byKind = (levels, kind) => levels.find(l => l.kind === kind);
const series5m = (rows, t0 = Date.UTC(2026, 0, 13)) => rows.map((r, i) => mk(t0 + i * 5 * M, ...r));

// ---- computeLevels: day + session levels (GMT, so London == UTC) ----
const JAN13 = Date.UTC(2026, 0, 13);
const janSpikes = [
  { t: JAN13 + 10.5 * H, h: 110 },            // Mon 13 Jan 10:30 → PDH
  { t: JAN13 + 15 * H, l: 90 },               // 15:00 → PDL
  { t: JAN13 + 20 * H, h: 104 },              // 20:00 → Late-NY session high
  { t: JAN13 + 27 * H, h: 103, l: 97 },       // Tue 14 Jan 03:00 → Asia range
];

test('computeLevels: PDH/PDL from the previous local day, previous session and Asia range, sides and ids', () => {
  const st = storeFrom1m(flat1m(JAN13, 33 * 60, 100, janSpikes)); // through 14 Jan 09:00
  const now = JAN13 + 33 * H;
  const lv = computeLevels({ store: st, tf: '5m', atr: 1, sessionsCfg: SESS, liqCfg: LIQ, now });
  const pdh = byKind(lv, 'pdh'), pdl = byKind(lv, 'pdl');
  assert.equal(pdh.price, 110); assert.equal(pdh.t, JAN13 + 10.5 * H); assert.equal(pdh.meta.dayKey, '2026-01-13');
  assert.equal(pdl.price, 90); assert.equal(pdl.side, 'sell-side'); assert.equal(pdh.side, 'buy-side');
  assert.equal(pdh.id, `pdh:${JAN13 + 10.5 * H}:110`); assert.equal(pdh.swept, null);
  // 09:00 is London → the previous session is today's Asia (00:00–07:00)
  const sh = byKind(lv, 'sessionHigh'), sl = byKind(lv, 'sessionLow');
  assert.equal(sh.price, 103); assert.equal(sl.price, 97); assert.equal(sh.meta.sessionId, 'asia'); assert.equal(sh.meta.dayKey, '2026-01-14');
  const ah = byKind(lv, 'asiaHigh'), al = byKind(lv, 'asiaLow');
  assert.equal(ah.price, 103); assert.equal(al.price, 97); assert.equal(ah.meta.complete, true);
  // flat market → the 12 candles before the last closed one are a consolidation
  assert.equal(byKind(lv, 'consolidationHigh').price, 100.1); assert.equal(byKind(lv, 'consolidationLow').price, 99.9);
  assert.equal(byKind(lv, 'equalHighs'), undefined, 'flat highs are not swings');
  for (let i = 1; i < lv.length; i++) assert.ok(lv[i - 1].price >= lv[i].price, 'sorted highest first');
  for (const l of lv) assert.equal(l.side, levelSide(l.kind));
});

test('computeLevels: inside Asia the previous session is yesterday\'s Late NY and the Asia range is partial', () => {
  const st = storeFrom1m(flat1m(JAN13, 26 * 60, 100, janSpikes)); // through 14 Jan 02:00
  const lv = computeLevels({ store: st, tf: '5m', atr: 1, sessionsCfg: SESS, liqCfg: LIQ, now: JAN13 + 26 * H });
  const sh = byKind(lv, 'sessionHigh');
  assert.equal(sh.price, 104); assert.equal(sh.meta.sessionId, 'late'); assert.equal(sh.meta.dayKey, '2026-01-13');
  const ah = byKind(lv, 'asiaHigh');
  assert.equal(ah.price, 100.1); assert.equal(ah.meta.complete, false); assert.equal(ah.meta.dayKey, '2026-01-14');
});

test('computeLevels: the previous DAY is the local (BST) day, not the UTC day', () => {
  // 14 Jul 2026 local = [13 Jul 23:00Z, 14 Jul 23:00Z). A: 13 Jul 22:30Z (local 13th) · B: 23:30Z (local 14th) · C: 14 Jul 23:30Z (local 15th)
  const from = Date.UTC(2026, 6, 13, 20);
  const spikes = [{ t: Date.UTC(2026, 6, 13, 22, 30), h: 120 }, { t: Date.UTC(2026, 6, 13, 23, 30), h: 115 }, { t: Date.UTC(2026, 6, 14, 23, 30), h: 118 }];
  const st = storeFrom1m(flat1m(from, 36 * 60, 100, spikes));
  const now = Date.UTC(2026, 6, 15, 7); // 08:00 BST, London session
  const lv = computeLevels({ store: st, tf: '5m', atr: 1, sessionsCfg: SESS, liqCfg: LIQ, now });
  assert.equal(byKind(lv, 'pdh').price, 115, 'UTC-day arithmetic would give 118');
  assert.equal(byKind(lv, 'pdh').meta.dayKey, '2026-07-14');
  assert.equal(byKind(lv, 'sessionHigh').price, 118, 'previous session = Asia 15 Jul local (starts 14 Jul 23:00Z)');
});

test('computeLevels: the 23-hour (2026-03-29) and 25-hour (2026-10-25) local days are bounded correctly', () => {
  const run = (from, spikes, now) => {
    const lv = computeLevels({ store: storeFrom1m(flat1m(from, 48 * 60, 100, spikes)), tf: '5m', atr: 1, sessionsCfg: SESS, liqCfg: LIQ, now });
    return byKind(lv, 'pdh');
  };
  // clocks forward 01:00→02:00 on 29 Mar: 28 Mar 23:30Z is still the 28th, 29 Mar 23:30Z is already the 30th (BST)
  const spring = run(Date.UTC(2026, 2, 28, 12), [
    { t: Date.UTC(2026, 2, 28, 23, 30), h: 120 }, { t: Date.UTC(2026, 2, 29, 0, 30), h: 115 }, { t: Date.UTC(2026, 2, 29, 22, 30), h: 118 }, { t: Date.UTC(2026, 2, 29, 23, 30), h: 117 },
  ], Date.UTC(2026, 2, 30, 8));
  assert.equal(spring.price, 118); assert.equal(spring.meta.dayKey, '2026-03-29'); assert.equal(spring.meta.candles, 23 * 60);
  // clocks back 02:00→01:00 on 25 Oct: the 25th runs 24 Oct 23:00Z → 26 Oct 00:00Z
  const autumn = run(Date.UTC(2026, 9, 24, 12), [
    { t: Date.UTC(2026, 9, 24, 22, 30), h: 120 }, { t: Date.UTC(2026, 9, 24, 23, 30), h: 115 }, { t: Date.UTC(2026, 9, 25, 23, 30), h: 118 }, { t: Date.UTC(2026, 9, 26, 0, 30), h: 117 },
  ], Date.UTC(2026, 9, 26, 9));
  assert.equal(autumn.price, 118); assert.equal(autumn.meta.dayKey, '2026-10-25'); assert.equal(autumn.meta.candles, 25 * 60);
});

test('computeLevels: the previous CLOSED htf (4h) candle high/low are levels — source 01 "swept below the previous candle\'s low" (review finding liquidity.mjs:137)', () => {
  // 1m flat at 100 from 13 Jan 00:00 through 09:00 (33 h incl. the 12 Jan start): the 04:00–08:00 4h candle carries the spikes
  const spikes = [...janSpikes, { t: JAN13 + 29.5 * H, h: 101.7 }, { t: JAN13 + 30.5 * H, l: 98.3 }]; // 14 Jan 05:30 / 06:30 → inside the 04:00 4h bucket
  const st = storeFrom1m(flat1m(JAN13, 33 * 60, 100, spikes)); // through 14 Jan 09:00; last closed 4h = 04:00–08:00
  const now = JAN13 + 33 * H;
  const lv = computeLevels({ store: st, tf: '5m', atr: 1, sessionsCfg: SESS, liqCfg: LIQ, now, htfTf: '4h' });
  const ph = byKind(lv, 'prevCandleHigh'), pl = byKind(lv, 'prevCandleLow');
  assert.equal(ph.price, 101.7); assert.equal(pl.price, 98.3);
  assert.equal(ph.side, 'buy-side'); assert.equal(pl.side, 'sell-side'); assert.equal(levelSide('prevCandleHigh'), 'buy-side');
  assert.equal(ph.t, JAN13 + 28 * H, 't = the 4h candle open (14 Jan 04:00)'); assert.equal(ph.tf, '4h'); assert.deepEqual(ph.meta, { tf: '4h', startMs: JAN13 + 28 * H, endMs: JAN13 + 32 * H });
  assert.equal(ph.id, `prevCandleHigh:${JAN13 + 28 * H}:101.7`); assert.equal(ph.swept, null);
  // default htfTf is 4h; another TF is honoured; an unknown TF or a store without it adds nothing
  assert.equal(byKind(computeLevels({ store: st, tf: '5m', atr: 1, sessionsCfg: SESS, liqCfg: LIQ, now }), 'prevCandleHigh').price, 101.7);
  const h1 = byKind(computeLevels({ store: st, tf: '5m', atr: 1, sessionsCfg: SESS, liqCfg: LIQ, now, htfTf: '1h' }), 'prevCandleHigh');
  assert.equal(h1.price, 100.1, 'the 08:00–09:00 1h candle is flat'); assert.equal(h1.tf, '1h');
  assert.equal(byKind(computeLevels({ store: st, tf: '5m', atr: 1, sessionsCfg: SESS, liqCfg: LIQ, now, htfTf: '2h' }), 'prevCandleHigh'), undefined);
  assert.equal(byKind(computeLevels({ store: storeOf({ '5m': st.closed('5m') }), tf: '5m', atr: 1, sessionsCfg: SESS, liqCfg: LIQ, now }), 'prevCandleHigh'), undefined);
  // a 4h candle that has not closed by `now` is not "the previous candle"
  const early = computeLevels({ store: st, tf: '5m', atr: 1, sessionsCfg: SESS, liqCfg: LIQ, now: JAN13 + 31 * H, htfTf: '4h' });
  assert.notEqual(byKind(early, 'prevCandleHigh')?.price, 101.7, 'at 07:00 the 04:00 bucket is still forming → the 00:00 candle is the previous one');
  // it is a first-class sweep target: a 5m candle wicking below the previous 4h low and closing back is a reclaimed sweep
  const c5 = [mk(now - 10 * M, 100, 100.1, 99.9, 100), mk(now - 5 * M, 100, 100.1, 97.9, 99.5)];
  const sw = detectSweeps({ candles: c5, levels: lv, atr: 1, liqCfg: LIQ });
  assert.ok(sw.some(x => x.level.kind === 'prevCandleLow' && x.reclaimed), sw.map(x => x.level.kind).join(','));
  // a sweep level pushed after the session levels: on an exact tie the session level is listed first (czt names the pool)
  const idx = (k) => lv.findIndex(l => l.kind === k);
  assert.ok(idx('asiaHigh') >= 0 && idx('prevCandleHigh') >= 0);
});

test('detectSweeps: a low-volume node is a zone, not resting liquidity — never swept (review finding czt.mjs:166)', () => {
  const lvn = { id: 'lvn:1:100', kind: 'lvn', price: 100, t: 1, tf: '1m', side: 'sell-side', meta: {}, swept: null };
  const c = mk(T0, 100.5, 100.6, 99.7, 100.3);
  assert.deepEqual(detectSweeps({ candles: [prevFlat, c], levels: [lvn], atr: 1, liqCfg: LIQ }), []);
  assert.equal(lvn.swept, null);
  assert.equal(detectSweeps({ candles: [prevFlat, c], levels: [lvn, PDL()], atr: 1, liqCfg: LIQ }).length, 1, 'the PDL at the same price still is');
});

test('computeLevels: now is optional (derived from the last closed candle), empty store → []', () => {
  const st = storeFrom1m(flat1m(JAN13, 33 * 60, 100, janSpikes));
  const lv = computeLevels({ store: st, tf: '5m', atr: 1, sessionsCfg: SESS, liqCfg: LIQ });
  assert.equal(byKind(lv, 'pdh').price, 110);
  assert.deepEqual(computeLevels({ store: storeOf({}), tf: '5m', atr: 1, sessionsCfg: SESS, liqCfg: LIQ }), []);
  assert.deepEqual(computeLevels({ store: storeOf({}), tf: '5m', atr: 1, sessionsCfg: SESS, liqCfg: LIQ, now: JAN13 }), []);
});

test('computeLevels: falls back to a coarser TF when the 1m ring does not reach the window', () => {
  const c1m = flat1m(JAN13, 33 * 60, 100, janSpikes);
  const tfs = { '1m': c1m.slice(-120), '5m': agg(c1m, 5 * M).filter(c => c.closed) };
  const lv = computeLevels({ store: storeOf(tfs), tf: '5m', atr: 1, sessionsCfg: SESS, liqCfg: LIQ, now: JAN13 + 33 * H });
  assert.equal(byKind(lv, 'pdh').price, 110); assert.equal(byKind(lv, 'pdl').price, 90);
});

// ---- computeLevels: equal highs / lows and consolidation on the analysis TF ----
const NOSESS = { timezone: 'Europe/London', list: [] };
function eqRows() {
  const rows = Array.from({ length: 20 }, () => [100, 100.3, 99.7, 100]);
  rows[3] = [100, 102.0, 99.7, 100]; rows[9] = [100, 102.1, 99.7, 100]; rows[15] = [100, 105, 99.7, 100]; // highs: two equal, one alone
  rows[6] = [100, 100.3, 96.0, 100]; rows[12] = [100, 100.3, 96.1, 100];                               // lows: two equal
  return rows;
}

test('computeLevels: ≥2 swings within tolerance → one level at their mean with meta.count; lone swing is not a level', () => {
  const c5 = series5m(eqRows());
  const lv = computeLevels({ store: storeOf({ '5m': c5 }), tf: '5m', atr: 1, sessionsCfg: NOSESS, liqCfg: LIQ, now: c5.at(-1).t + 5 * M });
  const eh = byKind(lv, 'equalHighs'), el = byKind(lv, 'equalLows');
  assert.ok(Math.abs(eh.price - 102.05) < 1e-9); assert.equal(eh.meta.count, 2); assert.equal(eh.t, c5[3].t); assert.equal(eh.tf, '5m');
  assert.deepEqual(eh.meta.swings, [{ t: c5[3].t, price: 102.0 }, { t: c5[9].t, price: 102.1 }]);
  assert.ok(Math.abs(el.price - 96.05) < 1e-9); assert.equal(el.meta.count, 2); assert.equal(el.side, 'sell-side');
  assert.equal(lv.filter(l => l.kind === 'equalHighs').length, 1, '105 is a lone swing, not liquidity');
  assert.equal(byKind(lv, 'consolidationHigh'), undefined, 'last 12 candles span 9 ATR → no consolidation');
  // widen the tolerance → 102 / 102.1 still one cluster, 105 still outside
  const wide = computeLevels({ store: storeOf({ '5m': c5 }), tf: '5m', atr: 1, sessionsCfg: NOSESS, liqCfg: { ...LIQ, equalLevelToleranceAtr: 1 }, now: c5.at(-1).t + 5 * M });
  assert.equal(wide.filter(l => l.kind === 'equalHighs').length, 1);
  // ATR unusable → no swing-based levels, no throw
  assert.equal(computeLevels({ store: storeOf({ '5m': c5 }), tf: '5m', atr: 0, sessionsCfg: NOSESS, liqCfg: LIQ, now: c5.at(-1).t }).length, 0);
});

test('computeLevels: equal highs already closed through are gone, unless the last closed candle did it', () => {
  const rows = eqRows();
  rows[17] = [100, 103, 99.7, 102.8]; // closes 0.75 above 102.05 → liquidity taken
  const c5 = series5m(rows);
  const lv = computeLevels({ store: storeOf({ '5m': c5 }), tf: '5m', atr: 1, sessionsCfg: NOSESS, liqCfg: LIQ, now: c5.at(-1).t + 5 * M });
  assert.equal(byKind(lv, 'equalHighs'), undefined);
  assert.ok(byKind(lv, 'equalLows'), 'lows untouched');
  const rows2 = eqRows();
  rows2[19] = [100, 103, 99.7, 102.8]; // the LAST closed candle: still a level so detectSweeps can judge it
  const c5b = series5m(rows2);
  const lv2 = computeLevels({ store: storeOf({ '5m': c5b }), tf: '5m', atr: 1, sessionsCfg: NOSESS, liqCfg: LIQ, now: c5b.at(-1).t + 5 * M });
  assert.ok(byKind(lv2, 'equalHighs'));
});

test('computeLevels: consolidation = the 12 candles before the last closed one, within 2.5 ATR; then a sweep of its high', () => {
  const rows = Array.from({ length: 14 }, () => [100, 100.2, 99.8, 100]);
  rows[13] = [100, 101, 99.9, 100.05]; // last closed: wicks 0.8 above the box, closes back inside
  const c5 = series5m(rows);
  const lv = computeLevels({ store: storeOf({ '5m': c5 }), tf: '5m', atr: 1, sessionsCfg: NOSESS, liqCfg: LIQ, now: c5.at(-1).t + 5 * M });
  const ch = byKind(lv, 'consolidationHigh'), cl = byKind(lv, 'consolidationLow');
  assert.equal(ch.price, 100.2); assert.equal(cl.price, 99.8); assert.equal(ch.t, c5[1].t); assert.equal(ch.meta.candles, 12);
  assert.ok(Math.abs(ch.meta.rangeAtr - 0.4) < 1e-9);
  const sw = detectSweeps({ candles: c5, levels: lv, atr: 1, liqCfg: LIQ });
  assert.equal(sw.length, 1); assert.equal(sw[0].level.kind, 'consolidationHigh');
  assert.ok(Math.abs(sw[0].depth - 0.8) < 1e-9); assert.equal(sw[0].reclaimed, true);
  // a wide window is not a consolidation
  const wide = rows.map(r => [...r]); wide[5] = [100, 104, 99.8, 100];
  const lw = computeLevels({ store: storeOf({ '5m': series5m(wide) }), tf: '5m', atr: 1, sessionsCfg: NOSESS, liqCfg: LIQ, now: c5.at(-1).t + 5 * M });
  assert.equal(byKind(lw, 'consolidationHigh'), undefined);
});

test('computeLevels: expiry, dedupe and `prev` carry of swept', () => {
  const st = storeFrom1m(flat1m(JAN13, 33 * 60, 100, janSpikes));
  const now = JAN13 + 33 * H;
  const lv = computeLevels({ store: st, tf: '5m', atr: 1, sessionsCfg: SESS, liqCfg: { ...LIQ, levelExpiryHours: 8 }, now });
  assert.equal(byKind(lv, 'pdh'), undefined, '22.5 h old');
  assert.equal(byKind(lv, 'asiaHigh').price, 103, '6 h old');
  const base = computeLevels({ store: st, tf: '5m', atr: 1, sessionsCfg: SESS, liqCfg: LIQ, now });
  const pdl = byKind(base, 'pdl');
  pdl.swept = { t: now - H, depth: 0.4, reclaimed: true, reclaimedT: now - H };
  const again = computeLevels({ store: st, tf: '5m', atr: 1, sessionsCfg: SESS, liqCfg: LIQ, now, prev: base });
  assert.deepEqual(byKind(again, 'pdl').swept, pdl.swept);
  assert.notEqual(byKind(again, 'pdl').swept, pdl.swept, 'copied, not shared');
  assert.equal(byKind(again, 'pdh').swept, null);
});

test('dedupeLevels: same kind within tolerance keeps the first and sums counts; different kinds untouched', () => {
  const a = { id: 'a', kind: 'equalHighs', price: 100, meta: { count: 2 } }, b = { id: 'b', kind: 'equalHighs', price: 100.1, meta: { count: 2 } };
  const c = { id: 'c', kind: 'pdh', price: 100.05, meta: {} }, d = { id: 'd', kind: 'equalHighs', price: 101, meta: { count: 2 } };
  const out = dedupeLevels([a, b, c, d], 0.15);
  assert.deepEqual(out.map(l => l.id), ['a', 'c', 'd']); assert.equal(a.meta.count, 4);
});

// ---- detectSweeps ----
const PDL = () => ({ id: 'pdl:1:100', kind: 'pdl', price: 100, t: 1, tf: '1m', side: 'sell-side', meta: {}, swept: null });
const PDH = () => ({ id: 'pdh:1:110', kind: 'pdh', price: 110, t: 1, tf: '1m', side: 'buy-side', meta: {}, swept: null });
const T0 = Date.UTC(2026, 0, 14, 8);
const prevFlat = mk(T0 - 5 * M, 100.5, 100.7, 100.3, 100.5);

test('detectSweeps: wick below a sell-side level within [min,max] ATR, reclaimed = close back above; marks level.swept', () => {
  const level = PDL(), c = mk(T0, 100.5, 100.6, 99.7, 100.3);
  const sw = detectSweeps({ candles: [prevFlat, c], levels: [level], atr: 1, liqCfg: LIQ });
  assert.equal(sw.length, 1);
  assert.equal(sw[0].t, T0); assert.equal(sw[0].level, level); assert.equal(sw[0].candle, c);
  assert.ok(Math.abs(sw[0].depth - 0.3) < 1e-9); assert.ok(Math.abs(sw[0].depthAtr - 0.3) < 1e-9);
  assert.equal(sw[0].reclaimed, true); assert.equal(sw[0].reclaimedAfter, 0);
  assert.equal(level.swept.t, T0); assert.equal(level.swept.reclaimed, true); assert.equal(level.swept.reclaimedT, T0);
  // not reclaimed: closes below
  const l2 = PDL(), c2 = mk(T0, 100.5, 100.6, 99.7, 99.8);
  const sw2 = detectSweeps({ candles: [prevFlat, c2], levels: [l2], atr: 1, liqCfg: LIQ });
  assert.equal(sw2[0].reclaimed, false); assert.equal(l2.swept.reclaimed, false); assert.equal(l2.swept.reclaimedT, null);
});

test('detectSweeps: depth outside [min,max] ATR, price already beyond the level, or an already-swept level → nothing', () => {
  assert.deepEqual(detectSweeps({ candles: [prevFlat, mk(T0, 100.5, 100.6, 99.98, 100.3)], levels: [PDL()], atr: 1, liqCfg: LIQ }), [], '0.02 < 0.05');
  assert.deepEqual(detectSweeps({ candles: [prevFlat, mk(T0, 100.5, 100.6, 97.5, 100.3)], levels: [PDL()], atr: 1, liqCfg: LIQ }), [], '2.5 > 2.0');
  const below = mk(T0, 99.5, 99.7, 99.4, 99.6), prevBelow = mk(T0 - 5 * M, 99.6, 99.8, 99.4, 99.5);
  assert.deepEqual(detectSweeps({ candles: [prevBelow, below], levels: [PDL()], atr: 1, liqCfg: LIQ }), [], 'came from below: not a sweep');
  const done = PDL(); done.swept = { t: T0 - 5 * M, depth: 0.3, reclaimed: true, reclaimedT: T0 - 5 * M };
  assert.deepEqual(detectSweeps({ candles: [prevFlat, mk(T0, 100.5, 100.6, 99.7, 100.3)], levels: [done], atr: 1, liqCfg: LIQ }), []);
  // a sub-threshold poke on the prior candle still lets this one count as coming from above
  const poke = mk(T0 - 5 * M, 100.3, 100.4, 99.98, 99.97);
  assert.equal(detectSweeps({ candles: [poke, mk(T0, 99.97, 100.5, 99.6, 100.2)], levels: [PDL()], atr: 1, liqCfg: LIQ }).length, 1);
});

test('detectSweeps: only the last CLOSED candle counts; bad ATR or empty inputs → []', () => {
  const level = PDL(), closed = mk(T0, 100.5, 100.6, 99.7, 100.3), forming = mk(T0 + 5 * M, 100.3, 100.4, 100.2, 100.3, false);
  const sw = detectSweeps({ candles: [prevFlat, closed, forming], levels: [level], atr: 1, liqCfg: LIQ });
  assert.equal(sw.length, 1); assert.equal(sw[0].candle, closed);
  assert.deepEqual(detectSweeps({ candles: [forming], levels: [PDL()], atr: 1, liqCfg: LIQ }), []);
  assert.deepEqual(detectSweeps({ candles: [prevFlat, closed], levels: [PDL()], atr: 0, liqCfg: LIQ }), []);
  assert.deepEqual(detectSweeps({ candles: [prevFlat, closed], levels: [PDL()], atr: NaN, liqCfg: LIQ }), []);
  assert.deepEqual(detectSweeps({ candles: [], levels: [PDL()], atr: 1, liqCfg: LIQ }), []);
  assert.deepEqual(detectSweeps({ candles: [prevFlat, closed], levels: [], atr: 1, liqCfg: LIQ }), []);
});

test('detectSweeps: buy-side mirrored; deepest sweep first; level without side falls back to kind', () => {
  const pdh = PDH(), pdl = PDL();
  const c = mk(T0, 109.5, 110.9, 99.8, 109.8); // runs both: 0.9 above PDH, 0.2 below PDL
  const sw = detectSweeps({ candles: [mk(T0 - 5 * M, 109.4, 109.6, 109.2, 109.5), c], levels: [pdl, pdh], atr: 1, liqCfg: LIQ });
  assert.equal(sw.length, 2); assert.equal(sw[0].level, pdh); assert.equal(sw[0].reclaimed, true);
  assert.equal(sw[1].level, pdl); assert.equal(sw[1].reclaimed, true);
  const noSide = { ...PDH(), side: undefined };
  assert.equal(detectSweeps({ candles: [mk(T0 - 5 * M, 109.4, 109.6, 109.2, 109.5), mk(T0, 109.5, 110.4, 109.3, 109.9)], levels: [noSide], atr: 1, liqCfg: LIQ }).length, 1);
});

test('detectSweeps: an unreclaimed sweep reclaimed within sweepReclaimCandles is reported once, with the full excursion', () => {
  const level = PDL();
  const a = mk(T0, 100.5, 100.6, 99.6, 99.8);          // sweeps 0.4, closes below
  const b = mk(T0 + 5 * M, 99.8, 99.9, 99.3, 99.5);     // deeper (0.7), still below
  const c = mk(T0 + 10 * M, 99.5, 100.4, 99.4, 100.2);  // closes back above → reclaimed after 2
  const s1 = detectSweeps({ candles: [prevFlat, a], levels: [level], atr: 1, liqCfg: LIQ });
  assert.equal(s1.length, 1); assert.equal(s1[0].reclaimed, false);
  assert.deepEqual(detectSweeps({ candles: [prevFlat, a, b], levels: [level], atr: 1, liqCfg: LIQ }), [], 'still below: nothing new');
  const s3 = detectSweeps({ candles: [prevFlat, a, b, c], levels: [level], atr: 1, liqCfg: LIQ });
  assert.equal(s3.length, 1); assert.equal(s3[0].reclaimed, true); assert.equal(s3[0].reclaimedAfter, 2);
  assert.ok(Math.abs(s3[0].depth - 0.7) < 1e-9); assert.equal(s3[0].candle, c); assert.equal(s3[0].t, c.t);
  assert.equal(level.swept.reclaimed, true); assert.equal(level.swept.reclaimedT, c.t); assert.ok(Math.abs(level.swept.depth - 0.7) < 1e-9);
  assert.deepEqual(detectSweeps({ candles: [prevFlat, a, b, c, mk(T0 + 15 * M, 100.2, 100.3, 99.9, 100.1)], levels: [level], atr: 1, liqCfg: LIQ }), [], 'done is done');
});

test('detectSweeps: a late reclaim outside the window, or after a breakout past max depth, is not a sweep', () => {
  const late = PDL(), a = mk(T0, 100.5, 100.6, 99.6, 99.8);
  detectSweeps({ candles: [prevFlat, a], levels: [late], atr: 1, liqCfg: LIQ });
  const drift = [1, 2, 3].map(i => mk(T0 + i * 5 * M, 99.8, 99.9, 99.6, 99.8));
  const back = mk(T0 + 20 * M, 99.8, 100.3, 99.7, 100.2);
  assert.deepEqual(detectSweeps({ candles: [prevFlat, a, ...drift, back], levels: [late], atr: 1, liqCfg: LIQ }), [], '4 candles later > window 3');
  assert.equal(late.swept.reclaimed, false);
  const wide = PDL();
  detectSweeps({ candles: [prevFlat, a], levels: [wide], atr: 1, liqCfg: LIQ });
  const crash = mk(T0 + 5 * M, 99.8, 99.9, 97.5, 98.0), rip = mk(T0 + 10 * M, 98.0, 100.5, 97.9, 100.3);
  assert.deepEqual(detectSweeps({ candles: [prevFlat, a, crash, rip], levels: [wide], atr: 1, liqCfg: LIQ }), [], '2.5 ATR excursion was a breakout');
  // window is configurable
  const cfgd = PDL();
  detectSweeps({ candles: [prevFlat, a], levels: [cfgd], atr: 1, liqCfg: { ...LIQ, sweepReclaimCandles: 5 } });
  assert.equal(detectSweeps({ candles: [prevFlat, a, ...drift, back], levels: [cfgd], atr: 1, liqCfg: { ...LIQ, sweepReclaimCandles: 5 } }).length, 1);
});
