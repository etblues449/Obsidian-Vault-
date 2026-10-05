import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Journal, createJournal, validateSetup, wilson, rOf, stepSetup, problemArea, summarize, scorecardRows, FILES, SCORECARD_BY } from '../lib/journal.mjs';
import { createLogger } from '../lib/log.mjs';

const strategy = JSON.parse(readFileSync(new URL('../config/strategy.json', import.meta.url), 'utf8'));
const M = 60e3, H = 36e5;
const T0 = Date.UTC(2026, 0, 5, 8, 0);          // trigger 5m candle opens 08:00 UTC
const ENTRY_T = T0 + 5 * M;                      // entry = close of the trigger candle ⇒ first 1m bar that counts
const bar = (i, { o = 100, h = 100.5, l = 99.5, c = 100, closed = true } = {}) => ({ t: ENTRY_T + i * M, o, h, l, c, v: 10, closed });

/** A canonical long: entry 100, stop 98 (R = 2), target 104 (2 R). */
function mkSetup(over = {}) {
  return {
    id: 'BTCUSD-1', symbol: 'BTCUSD', t: T0, tf: '5m', side: 'long',
    entry: 100, stop: 98, targets: [{ price: 104, label: 'PDH', rr: 2 }, { price: 106, label: 'eqH', rr: 3 }], rr: 2,
    score: 9.5, grade: 'A',
    condition: { bias: { dir: 'bullish', strength: 0.8, reasons: [] }, session: { id: 'london', killzone: true }, valueRelation: 'below', hits: ['biasAligned', 'killzone'] },
    zone: { hits: ['pdhPdl'] }, trigger: { kind: 'sweepReclaim', hits: ['sweepReclaim', 'deltaConfirms'] },
    reasons: ['Swept sell-side liquidity at Asia low 98.20 and reclaimed (manipulation)'], invalidation: 'close below 98 (manipulation low)',
    size: { units: 5, riskUsd: 10, riskPct: 1 }, status: 'open',
    ...over,
  };
}
const mkShort = (over = {}) => mkSetup({ id: 'BTCUSD-S', side: 'short', entry: 100, stop: 102, targets: [{ price: 96, label: 'PDL', rr: 2 }], rr: 2, ...over });

let dir, cfg;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'tradeguard-journal-')); cfg = structuredClone(strategy); cfg.journal.dir = dir; });
afterEach(() => rmSync(dir, { recursive: true, force: true }));
const lines = (name) => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

describe('pure helpers', () => {
  test('validateSetup catches every shape the resolver cannot work with', () => {
    assert.equal(validateSetup(mkSetup()), null);
    assert.equal(validateSetup(mkShort()), null);
    assert.match(validateSetup(null), /object/);
    assert.match(validateSetup(mkSetup({ id: '' })), /id/);
    assert.match(validateSetup(mkSetup({ side: 'buy' })), /side/);
    assert.match(validateSetup(mkSetup({ t: NaN })), /\.t/);
    assert.match(validateSetup(mkSetup({ stop: 100 })), /differ/);
    assert.match(validateSetup(mkSetup({ stop: 101 })), /wrong side/);           // long with stop above entry
    assert.match(validateSetup(mkShort({ stop: 99 })), /wrong side/);            // short with stop below entry
    assert.match(validateSetup(mkSetup({ targets: [] })), /targets\[0\]/);
    assert.match(validateSetup(mkSetup({ targets: [{ price: 97 }] })), /targets\[0\] is on the wrong side/);
  });
  test('wilson 95 % interval: n=0 is [0,1], 5/10 ≈ [0.237, 0.763], 1/1 ≈ [0.207, 1]', () => {
    assert.deepEqual(wilson(0, 0), [0, 1]);
    const [lo, hi] = wilson(5, 10);
    assert.ok(Math.abs(lo - 0.2366) < 1e-3 && Math.abs(hi - 0.7634) < 1e-3, `${lo} ${hi}`);
    const [lo1, hi1] = wilson(1, 1);
    assert.ok(Math.abs(lo1 - 0.2065) < 1e-3 && hi1 === 1, `${lo1} ${hi1}`);
    const [lo0] = wilson(0, 20);
    assert.equal(lo0, 0);
  });
  test('rOf measures against the ORIGINAL risk (stop0), signed by side', () => {
    const s = mkSetup();
    assert.equal(rOf(s, 104), 2); assert.equal(rOf(s, 98), -1); assert.equal(rOf(s, 100), 0);
    assert.equal(rOf({ ...s, stop: 99.5, stop0: 98 }, 99.5), -0.25);              // trailed stop → real R, not −1
    const sh = mkShort();
    assert.equal(rOf(sh, 96), 2); assert.equal(rOf(sh, 102), -1);
    assert.equal(rOf({ ...s, stop: 100 }, 104), 0);                                 // degenerate risk never divides by zero
  });
});

describe('record', () => {
  test('appends one JSONL line per setup, dedupes by id, refuses garbage', () => {
    const j = new Journal({ cfg });
    const stored = j.record(mkSetup());
    assert.equal(stored.status, 'open'); assert.equal(stored.stop0, 98); assert.deepEqual(stored.trail, []);
    assert.equal(j.record(mkSetup()), null);                                        // same id → no second line
    assert.equal(lines(FILES.setups).length, 1);
    assert.equal(lines(FILES.setups)[0].id, 'BTCUSD-1');
    assert.equal(lines(FILES.setups)[0].trail, undefined);                          // creation state only
    assert.throws(() => j.record(mkSetup({ id: 'x', stop: 101 })), /wrong side/);
    assert.equal(j.open().length, 1);
    assert.equal(j.open('XAUUSD').length, 0);
  });
  test('mkdir -p: a nested, non-existent dir is created on first write', () => {
    const nested = join(dir, 'a', 'b', 'c');
    const j = new Journal({ cfg, dir: nested });
    j.record(mkSetup());
    assert.ok(existsSync(join(nested, FILES.setups)));
  });
  test('record emits a plain-object copy, not the internal record', () => {
    const j = new Journal({ cfg });
    let got; j.on('setup', (s) => { got = s; });
    const ret = j.record(mkSetup());
    assert.equal(got.id, 'BTCUSD-1');
    ret.entry = 1; got.entry = 2;
    assert.equal(j.get('BTCUSD-1').entry, 100);
  });
});

describe('resolveOpen — walk-forward', () => {
  test('bars inside the trigger candle and forming bars are ignored', () => {
    const j = new Journal({ cfg }); j.record(mkSetup());
    assert.deepEqual(j.resolveOpen('BTCUSD', { t: T0 + 2 * M, o: 100, h: 110, l: 90, c: 100, closed: true }), []);  // pre-entry
    assert.deepEqual(j.resolveOpen('BTCUSD', bar(0, { h: 110, closed: false })), []);                             // forming
    assert.equal(j.open().length, 1);
    assert.equal(j.get('BTCUSD-1').mfeR, 0);
  });
  test('long: target touched ⇒ won at +rr R', () => {
    const j = new Journal({ cfg }); j.record(mkSetup());
    assert.deepEqual(j.resolveOpen('BTCUSD', bar(0, { h: 101, l: 99 })), []);
    const [r] = j.resolveOpen('BTCUSD', bar(1, { h: 104.2, l: 100, c: 103 }));
    assert.equal(r.status, 'won'); assert.equal(r.exit, 'target'); assert.equal(r.exitPrice, 104);
    assert.equal(r.resultR, 2); assert.equal(r.resolvedAt, ENTRY_T + M); assert.equal(r.ambiguous, undefined);
    assert.equal(j.open().length, 0);
    assert.equal(lines(FILES.resolutions).length, 1);
    assert.equal(j.get('BTCUSD-1').status, 'won');
    assert.deepEqual(j.resolveOpen('BTCUSD', bar(2, { l: 90 })), []);           // resolved setups are never touched again
  });
  test('long: stop touched ⇒ lost at −1 R; short mirrored', () => {
    const j = new Journal({ cfg }); j.record(mkSetup()); j.record(mkShort());
    const rs = j.resolveOpen('BTCUSD', bar(0, { h: 100.5, l: 97.9, c: 98.5 }));
    assert.equal(rs.length, 1); assert.equal(rs[0].id, 'BTCUSD-1'); assert.equal(rs[0].status, 'lost'); assert.equal(rs[0].resultR, -1);
    const [sh] = j.resolveOpen('BTCUSD', bar(1, { h: 102.1, l: 99, c: 101 }));
    assert.equal(sh.id, 'BTCUSD-S'); assert.equal(sh.status, 'lost'); assert.equal(sh.exit, 'stop'); assert.equal(sh.resultR, -1);
  });
  test('short: target touched ⇒ won', () => {
    const j = new Journal({ cfg }); j.record(mkShort());
    const [r] = j.resolveOpen('BTCUSD', bar(0, { h: 100.5, l: 95.9, c: 96.5 }));
    assert.equal(r.status, 'won'); assert.equal(r.resultR, 2);
  });
  test('one bar touching BOTH stop and target is LOST and flagged ambiguous (conservative)', () => {
    const j = new Journal({ cfg }); j.record(mkSetup());
    const [r] = j.resolveOpen('BTCUSD', bar(0, { h: 104.5, l: 97.5, c: 101 }));
    assert.equal(r.status, 'lost'); assert.equal(r.ambiguous, true); assert.equal(r.resultR, -1); assert.equal(r.exit, 'stop');
    assert.equal(lines(FILES.resolutions)[0].ambiguous, true);
    const j2 = new Journal({ cfg, dir: join(dir, 'short') }); j2.record(mkShort());
    const [rs] = j2.resolveOpen('BTCUSD', bar(0, { h: 102.5, l: 95.5, c: 99 }));
    assert.equal(rs.status, 'lost'); assert.equal(rs.ambiguous, true); assert.equal(rs.resultR, -1);
  });
  test('mfeR / maeR track the best and worst excursion in R (magnitudes)', () => {
    const j = new Journal({ cfg }); j.record(mkSetup());
    j.resolveOpen('BTCUSD', bar(0, { h: 101, l: 99 }));                           // +0.5 / −0.5
    j.resolveOpen('BTCUSD', bar(1, { h: 103, l: 99.6 }));                         // +1.5 / −0.2
    j.resolveOpen('BTCUSD', bar(2, { h: 100.2, l: 98.4 }));                       // +0.1 / −0.8
    const s = j.get('BTCUSD-1');
    assert.equal(s.mfeR, 1.5); assert.equal(s.maeR, 0.8); assert.equal(s.status, 'open');
    const [r] = j.resolveOpen('BTCUSD', bar(3, { h: 104, l: 100 }));
    assert.equal(r.mfeR, 2); assert.equal(r.maeR, 0.8);
  });
  test('resolveTimeoutHours ⇒ expired, R from that bar close (positive or negative)', () => {
    cfg.journal.resolveTimeoutHours = 2;
    const j = new Journal({ cfg }); j.record(mkSetup()); j.record(mkShort());
    assert.deepEqual(j.resolveOpen('BTCUSD', { t: ENTRY_T + 2 * H - M, o: 100, h: 100.5, l: 99.5, c: 100, v: 1, closed: true }), []);
    const rs = j.resolveOpen('BTCUSD', { t: ENTRY_T + 2 * H, o: 100, h: 101.2, l: 100.4, c: 101, v: 1, closed: true });
    assert.equal(rs.length, 2);
    const long = rs.find((r) => r.id === 'BTCUSD-1'), short = rs.find((r) => r.id === 'BTCUSD-S');
    assert.equal(long.status, 'expired'); assert.equal(long.exit, 'timeout'); assert.equal(long.resultR, 0.5);
    assert.equal(short.status, 'expired'); assert.equal(short.resultR, -0.5);
  });
  test('symbol isolation, replayed/out-of-order bars and bad candles are harmless', () => {
    const j = new Journal({ cfg }); j.record(mkSetup()); j.record(mkSetup({ id: 'XAU-1', symbol: 'XAUUSD' }));
    assert.deepEqual(j.resolveOpen('XAUUSD', bar(0, { l: 90 })).map((r) => r.id), ['XAU-1']);
    assert.equal(j.get('BTCUSD-1').status, 'open');
    j.resolveOpen('BTCUSD', bar(5, { h: 101 }));
    assert.deepEqual(j.resolveOpen('BTCUSD', bar(5, { h: 104 })), []);           // same bar again: already counted
    assert.deepEqual(j.resolveOpen('BTCUSD', bar(3, { h: 104 })), []);           // older bar: already counted
    assert.deepEqual(j.resolveOpen('BTCUSD', null), []);
    assert.deepEqual(j.resolveOpen('BTCUSD', { t: ENTRY_T + 9 * M, h: NaN, l: 1, c: 1 }), []);
    assert.equal(j.get('BTCUSD-1').status, 'open');
  });
  test('resolution events carry the whole setup and the logger sees a human line', () => {
    const log = createLogger({ stream: null, now: () => 1 });
    const j = new Journal({ cfg, log }); j.record(mkSetup());
    let ev; j.on('resolved', (s) => { ev = s; });
    j.resolveOpen('BTCUSD', bar(0, { h: 104 }));
    assert.equal(ev.id, 'BTCUSD-1'); assert.equal(ev.status, 'won'); assert.equal(ev.trigger.kind, 'sweepReclaim');
    const line = log.recent(1)[0];
    assert.equal(line.level, 'ok'); assert.match(line.msg, /won via target at 104 \(\+2R\)/);
  });
});

describe('trailing by proved auctions (source 05 §7)', () => {
  const structTf = 15 * M, lookback = strategy.indicators.swingLookback;
  const confirm = (lookback + 1) * structTf;
  const swingLow = (price, t) => ({ t, price, kind: 'low', index: 0 });
  const swingHigh = (price, t) => ({ t, price, kind: 'high', index: 0 });

  test('the first trail waits for a PROVED auction: normal rotation never moves the stop (review finding journal.mjs:173)', () => {
    // Reviewer's reproduction: long 100 / stop 98; rotation 100.6 → 99.6 → 100.8 (mfe 0.4R) prints a confirmed swing low at 99.6.
    // Old code trailed to 99.5 and the next rotation to 99.3 stopped the trade out although the original stop survives.
    const j = new Journal({ cfg }); j.record(mkSetup());
    const swT = ENTRY_T + 15 * M, at = swT + confirm;
    j.resolveOpen('BTCUSD', bar(0, { h: 100.6, l: 99.9, c: 100.5 }));
    j.resolveOpen('BTCUSD', { ...bar(0, { h: 100.6, l: 99.6, c: 99.7 }), t: swT });
    j.resolveOpen('BTCUSD', { ...bar(0, { h: 100.8, l: 99.8, c: 100.7 }), t: swT + M });
    assert.equal(j.get('BTCUSD-1').mfeR, 0.4);
    j.resolveOpen('BTCUSD', { ...bar(0, { h: 100.7, l: 100.2, c: 100.4 }), t: at }, { swings: [swingLow(99.6, swT)], atr: 1 });
    assert.equal(j.get('BTCUSD-1').stop, 98, 'no auction won (mfe 0.4R, no swing high cleared) → the stop stays at the manipulation low');
    assert.equal(j.get('BTCUSD-1').trail.length, 0);
    assert.deepEqual(j.resolveOpen('BTCUSD', { ...bar(0, { h: 100.4, l: 99.3, c: 99.5 }), t: at + M }, { swings: [swingLow(99.6, swT)], atr: 1 }), [], 'the 99.3 rotation does not stop it out');
    assert.equal(j.get('BTCUSD-1').status, 'open');
    assert.equal(lines(FILES.trail).length, 0);
  });

  test('the auction is won by a close through a post-entry structure-TF swing high or an opposing level; the trail then follows', () => {
    const j = new Journal({ cfg }); j.record(mkSetup());
    const hiT = ENTRY_T + M, loT = ENTRY_T + 15 * M;
    const sw = [swingHigh(100.8, hiT), swingLow(99.6, loT)];
    // the swing high is confirmed, the close 100.7 is below it → not yet won; the confirmed swing low does NOT trail
    j.resolveOpen('BTCUSD', { ...bar(0, { h: 100.75, l: 100.1, c: 100.7 }), t: loT + confirm }, { swings: sw, atr: 1 });
    assert.equal(j.get('BTCUSD-1').stop, 98);
    // this bar CLOSES above the swing high 100.8 → the auction is won — the trail takes effect from the NEXT bar
    j.resolveOpen('BTCUSD', { ...bar(0, { h: 100.95, l: 100.3, c: 100.9 }), t: loT + confirm + M }, { swings: sw, atr: 1 });
    assert.equal(j.get('BTCUSD-1').stop, 98, 'the move never rides on the print that proved it');
    j.resolveOpen('BTCUSD', { ...bar(0, { h: 100.95, l: 100.3, c: 100.6 }), t: loT + confirm + 2 * M }, { swings: sw, atr: 1 });
    const s = j.get('BTCUSD-1');
    assert.equal(s.stop, 99.5, 'now trails to the swing low 99.6 − 0.1 ATR');
    assert.equal(s.trail[0].reason, 'provedAuction'); assert.equal(s.trail[0].swingPrice, 99.6);
    // an opposing LEVEL closed through counts as the won auction too (no swing high needed)
    const j2 = new Journal({ cfg, dir: join(dir, 'lvl') }); j2.record(mkSetup());
    // (the close sits > zoneToleranceAtr above the level, so this is a clean clear, not a problem-area tighten)
    const lvl = [{ kind: 'asiaHigh', price: 100.5, side: 'buy-side' }];
    j2.resolveOpen('BTCUSD', { ...bar(0, { h: 101.3, l: 100.1, c: 101.2 }), t: loT + confirm }, { swings: [swingLow(99.6, loT)], atr: 1, levels: lvl });
    assert.equal(j2.get('BTCUSD-1').stop, 98);
    j2.resolveOpen('BTCUSD', { ...bar(0, { h: 101.3, l: 100.9, c: 101.2 }), t: loT + confirm + M }, { swings: [swingLow(99.6, loT)], atr: 1, levels: lvl });
    assert.equal(j2.get('BTCUSD-1').stop, 99.5);
    assert.equal(j2.get('BTCUSD-1').trail[0].reason, 'provedAuction');
  });

  test('a confirmed post-entry swing low moves a long stop up to swing − buffer, capped at entry before +1R', () => {
    const j = new Journal({ cfg }); j.record(mkSetup());
    j.resolveOpen('BTCUSD', bar(0, { h: 102.1, l: 99.9, c: 101.5 }));               // mfe 1.05R: the auction is proved
    const swT = ENTRY_T + 15 * M;
    const at = swT + confirm;                                                     // first bar on which the swing is confirmed
    // unconfirmed swing (one ms too young) → no move
    assert.deepEqual(j.resolveOpen('BTCUSD', { ...bar(0), t: at - 1 }, { swings: [swingLow(99, swT)], atr: 1 }), []);
    assert.equal(j.get('BTCUSD-1').stop, 98);
    // confirmed → stop to 99 − 0.1×ATR(1) = 98.9
    j.resolveOpen('BTCUSD', { ...bar(0), t: at }, { swings: [swingLow(99, swT)], atr: 1 });
    const s = j.get('BTCUSD-1');
    assert.equal(s.stop, 98.9); assert.equal(s.trail.length, 1);
    assert.deepEqual({ from: s.trail[0].from, to: s.trail[0].to, swingPrice: s.trail[0].swingPrice }, { from: 98, to: 98.9, swingPrice: 99 });
    assert.equal(lines(FILES.trail).length, 1);
    // a higher swing low above entry while mfe < 1R → capped AT entry (break-even is the ceiling, not beyond)
    const j3 = new Journal({ cfg, dir: join(dir, 'cap') }); j3.record(mkSetup());
    const hi3 = swingHigh(100.8, ENTRY_T);                                        // post-entry swing high, confirmed 45 min later
    j3.resolveOpen('BTCUSD', { ...bar(0, { h: 100.9, l: 100.1, c: 100.85 }), t: ENTRY_T + confirm }, { swings: [hi3], atr: 1 }); // closes above it: won
    const sw2 = swingLow(101, at + M);
    j3.resolveOpen('BTCUSD', { ...bar(0, { h: 101.5 }), t: at + M + confirm }, { swings: [hi3, swingLow(99, swT), sw2], atr: 1 });
    assert.equal(j3.get('BTCUSD-1').mfeR, 0.75, 'auction won by the close above 100.8, but mfe < 1R at the time of the move');
    assert.equal(j3.get('BTCUSD-1').stop, 100, 'capped at entry');
    j.resolveOpen('BTCUSD', { ...bar(0, { h: 101.5 }), t: at + M + confirm }, { swings: [swingLow(99, swT), sw2], atr: 1 });
    assert.equal(j.get('BTCUSD-1').stop, 100.9, 'past +1R the cap is gone');
    assert.equal(j.get('BTCUSD-1').trail.length, 2);
    // the same swings again → nothing new (only ever in the trade direction; no duplicate moves)
    j.resolveOpen('BTCUSD', { ...bar(0, { h: 101.5 }), t: at + 2 * M + confirm }, { swings: [swingLow(99, swT), sw2], atr: 1 });
    assert.equal(j.get('BTCUSD-1').trail.length, 2);
  });
  test('after +1R mfe the stop may pass entry; a lower swing never moves it back down; stop-out at a trailed level reports real R', () => {
    const j = new Journal({ cfg }); j.record(mkSetup());
    j.resolveOpen('BTCUSD', bar(0, { h: 102.5 }));                                 // mfe = 1.25R
    const swT = ENTRY_T + M, at = swT + confirm;
    j.resolveOpen('BTCUSD', { ...bar(0, { h: 102, l: 101.2 }), t: at }, { swings: [swingLow(101, swT)], atr: 1 });
    assert.equal(j.get('BTCUSD-1').stop, 100.9); assert.equal(j.get('BTCUSD-1').status, 'open');
    j.resolveOpen('BTCUSD', { ...bar(0, { h: 102, l: 101.2 }), t: at + M }, { swings: [swingLow(101, swT), swingLow(100.2, swT + M)], atr: 1 });
    assert.equal(j.get('BTCUSD-1').stop, 100.9);                                   // 100.2 − 0.1 < 100.9 → ignored
    const [r] = j.resolveOpen('BTCUSD', { ...bar(0, { l: 100.8, h: 101.5 }), t: at + 2 * M }, { swings: [swingLow(101, swT)], atr: 1 });
    assert.equal(r.status, 'lost'); assert.equal(r.exit, 'stop'); assert.equal(r.exitPrice, 100.9);
    assert.equal(r.resultR, 0.45);                                                 // (100.9 − 100) / 2 — a "lost" with positive R
    assert.equal(r.trail.length, 1);
  });
  test('short mirror: swing highs trail the stop down; swing lows are ignored', () => {
    const j = new Journal({ cfg }); j.record(mkShort());
    j.resolveOpen('BTCUSD', bar(0, { h: 100.2, l: 97.9, c: 98.5 }));               // mfe 1.05R: proved
    const swT = ENTRY_T + M, at = swT + confirm;
    j.resolveOpen('BTCUSD', { ...bar(0, { l: 99 }), t: at }, { swings: [swingHigh(101, swT), swingLow(99.2, swT)], atr: 2 });
    assert.equal(j.get('BTCUSD-S').stop, 101.2);                                   // 101 + 0.1×2
  });
  test('switched off in config, or without swings/atr, nothing moves', () => {
    cfg.journal.trailByProvedAuctions = false;
    const j = new Journal({ cfg }); j.record(mkSetup());
    j.resolveOpen('BTCUSD', bar(0, { h: 102.1 }));                                 // +1R proved — and still nothing moves when off
    const swT = ENTRY_T + M;
    j.resolveOpen('BTCUSD', { ...bar(0), t: swT + confirm }, { swings: [swingLow(99, swT)], atr: 1 });
    assert.equal(j.get('BTCUSD-1').stop, 98);
    cfg.journal.trailByProvedAuctions = true;
    const j2 = new Journal({ cfg, dir: join(dir, 'two') }); j2.record(mkSetup());
    j2.resolveOpen('BTCUSD', bar(0, { h: 102.1 }));
    j2.resolveOpen('BTCUSD', { ...bar(0), t: swT + confirm });
    assert.equal(j2.get('BTCUSD-1').stop, 98);
    j2.resolveOpen('BTCUSD', { ...bar(0), t: swT + confirm + M }, { swings: [swingLow(99, swT)] });   // no ATR → zero buffer, still moves
    assert.equal(j2.get('BTCUSD-1').stop, 99);
  });
  test('tighten only at problem areas (source 05 §7 step 4, review finding journal.mjs:156): opposing HVN / level within tolerance or an opposing CVD divergence → stop to the last analysis-TF swing', () => {
    const tol = strategy.czt.zoneToleranceAtr; // 0.5 ATR
    const s0 = { ...mkSetup(), stop0: 98, mfeR: 0, maeR: 0, trail: [] };
    assert.equal(problemArea(s0, bar(0, { c: 100 }), { hvn: [103.5], tol }), null, 'far from the HVN');
    assert.equal(problemArea(s0, bar(0, { c: 103.1 }), { hvn: [103.5], tol }), 'hvn 103.5');
    assert.equal(problemArea(s0, bar(0, { c: 103.1 }), { hvn: [96.5], tol }), null, 'an HVN BELOW a long is not opposing');
    assert.equal(problemArea(s0, bar(0, { c: 103.1 }), { levels: [{ kind: 'pdh', price: 103.4, side: 'buy-side' }], tol }), 'level pdh 103.4');
    assert.equal(problemArea(s0, bar(0, { c: 103.1 }), { levels: [{ kind: 'equalLows', price: 103.4, side: 'sell-side' }], tol }), null, 'a sell-side level is not opposing a long');
    assert.equal(problemArea(s0, bar(0, { c: 100.1 }), { divergence: { kind: 'bearish' }, tol }), 'cvdDivergence');
    assert.equal(problemArea(s0, bar(0, { c: 100.1 }), { divergence: { kind: 'bullish' }, tol }), null);
    assert.equal(problemArea({ ...s0, side: 'short', stop: 102 }, bar(0, { c: 97.2 }), { hvn: [96.8], tol }), 'hvn 96.8');
    // Long 100/98, target 104. Price rallies to 102.6 (mfe 1.3R) into an HVN at 103 with no structure-TF swing to trail behind.
    const j = new Journal({ cfg }); j.record(mkSetup());
    const sw5 = (price, t) => ({ t, price, kind: 'low', index: 0 });
    const a5 = ENTRY_T + 10 * M, confirm5 = (lookback + 1) * 5 * M;
    j.resolveOpen('BTCUSD', bar(0, { h: 101.2, l: 99.9, c: 101.1 }));
    j.resolveOpen('BTCUSD', { ...bar(0, { h: 102.2, l: 100.9, c: 102.1 }), t: a5 }); // mfe 1.1R
    j.resolveOpen('BTCUSD', { ...bar(0, { h: 102.7, l: 101.4, c: 102.6 }), t: a5 + confirm5 }, { swings: [], atr: 1, hvn: [103.0], analysisSwings: [sw5(102.0, a5)] });
    const s = j.get('BTCUSD-1');
    assert.equal(s.stop, 101.9, 'tightened to the 5m swing 102.0 − 0.1 ATR although no 15m swing exists');
    assert.equal(s.trail.length, 1); assert.equal(s.trail[0].reason, 'problemArea'); assert.equal(s.trail[0].problem, 'hvn 103');
    assert.equal(lines(FILES.trail)[0].reason, 'problemArea');
    // the same bar again without a problem area would not have moved it (no auction gate passed via swings, mfe ≥ 1 but no structure swing)
    const j2 = new Journal({ cfg, dir: join(dir, 'np') }); j2.record(mkSetup());
    j2.resolveOpen('BTCUSD', bar(0, { h: 102.2, l: 99.9, c: 102.1 }));
    j2.resolveOpen('BTCUSD', { ...bar(0, { h: 102.7, l: 101.4, c: 102.6 }), t: a5 + confirm5 }, { swings: [], atr: 1, hvn: [103.0], analysisSwings: [sw5(102.0, a5 + 5 * M)] });
    assert.equal(j2.get('BTCUSD-1').stop, 98, 'an unconfirmed 5m swing is not used');
    j2.resolveOpen('BTCUSD', { ...bar(0, { h: 102.7, l: 101.4, c: 102.6 }), t: a5 + confirm5 + M }, { swings: [], atr: 1, hvn: [105.0], analysisSwings: [sw5(102.0, a5)] });
    assert.equal(j2.get('BTCUSD-1').stop, 98, 'no problem area → the structure-TF rule still governs (no 15m swing → no move)');
    // an opposing CVD divergence tightens too, but step 1 still caps at entry before +1R
    const j3 = new Journal({ cfg, dir: join(dir, 'dv') }); j3.record(mkSetup());
    j3.resolveOpen('BTCUSD', bar(0, { h: 100.9, l: 99.9, c: 100.8 }));           // mfe 0.45R
    j3.resolveOpen('BTCUSD', { ...bar(0, { h: 100.9, l: 100.3, c: 100.7 }), t: a5 + confirm5 }, { swings: [], atr: 1, divergence: { kind: 'bearish' }, analysisSwings: [sw5(100.4, a5)] });
    assert.equal(j3.get('BTCUSD-1').stop, 100, 'swing 100.4 − 0.1 = 100.3 would be past entry before +1R → capped at entry');
    assert.equal(j3.get('BTCUSD-1').trail[0].problem, 'cvdDivergence');
  });
  test('stepSetup is pure: the input setup is untouched', () => {
    const s = { ...mkSetup(), stop0: 98, mfeR: 1.2, maeR: 0, trail: [] };
    const frozen = structuredClone(s);
    const swT = ENTRY_T + M;
    const out = stepSetup(s, { ...bar(0, { h: 104 }), t: swT + confirm }, { swings: [swingLow(99, swT)], atr: 1, cfg });
    assert.deepEqual(s, frozen);
    assert.equal(out.resolution.status, 'won'); assert.equal(out.trail.to, 98.9); assert.equal(out.setup.stop, 98.9);
  });
});

describe('load — replay', () => {
  test('rebuilds open setups, trailed stops and resolutions from the three files', () => {
    const a = new Journal({ cfg });
    a.record(mkSetup()); a.record(mkSetup({ id: 'BTCUSD-2' })); a.record(mkSetup({ id: 'XAU-1', symbol: 'XAUUSD', grade: 'B', trigger: { kind: 'absorption' } }));
    a.resolveOpen('BTCUSD', bar(0, { h: 104 }));                                   // BTCUSD-1 and -2 both won on this bar
    const swT = ENTRY_T + M;
    a.resolveOpen('XAUUSD', bar(0, { h: 102.1 }));                                 // +1R: the auction is proved
    a.resolveOpen('XAUUSD', { ...bar(0), t: swT + 3 * 15 * M }, { swings: [{ t: swT, price: 99, kind: 'low' }], atr: 1 });
    assert.equal(a.get('XAU-1').stop, 98.9);
    assert.equal(lines(FILES.setups).every((l) => l.auctionWon === undefined && l.mfeR === undefined), true, 'in-memory gate state never lands in setups.jsonl');

    const b = new Journal({ cfg });
    const counts = b.load();
    assert.deepEqual(counts, { setups: 3, open: 1, resolved: 2, malformed: 0 });
    assert.equal(b.get('BTCUSD-1').status, 'won'); assert.equal(b.get('BTCUSD-1').resultR, 2);
    const x = b.get('XAU-1');
    assert.equal(x.status, 'open'); assert.equal(x.stop, 98.9); assert.equal(x.stop0, 98); assert.equal(x.trail.length, 1);
    assert.deepEqual(b.open().map((s) => s.id), ['XAU-1']);
    // the restored journal keeps working: the trailed stop is what gets hit
    const [r] = b.resolveOpen('XAUUSD', bar(60, { l: 98.85 }));
    assert.equal(r.exitPrice, 98.9); assert.equal(r.resultR, -0.55);              // (98.9 − 100) / 2: the trailed stop, not −1
    assert.equal(b.record(mkSetup()), null);                                       // ids stay unique across restarts
  });
  test('an empty dir loads to nothing; a torn last line, junk and unknown ids are skipped and counted', () => {
    assert.deepEqual(new Journal({ cfg }).load(), { setups: 0, open: 0, resolved: 0, malformed: 0 });
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, FILES.setups), JSON.stringify(mkSetup()) + '\n' + 'not json\n' + JSON.stringify(mkSetup({ id: 'dup' })).slice(0, 40));
    appendFileSync(join(dir, FILES.trail), JSON.stringify({ id: 'nope', to: 99 }) + '\n');
    appendFileSync(join(dir, FILES.resolutions), JSON.stringify({ id: 'BTCUSD-1', status: 'maybe' }) + '\n');
    const log = createLogger({ stream: null, now: () => 1 });
    const j = new Journal({ cfg, log });
    assert.deepEqual(j.load(), { setups: 1, open: 1, resolved: 0, malformed: 4 });
    assert.equal(j.get('BTCUSD-1').stop, 98);
    assert.match(log.recent(1)[0].msg, /skipped 4 unreadable/);
    assert.equal(j.load().setups, 1);                                              // idempotent
  });
});

describe('scorecard', () => {
  test('rows by trigger with expectancy, profit factor, drawdown, Wilson CI; open setups excluded', () => {
    const j = new Journal({ cfg });
    j.record(mkSetup({ id: 'a' })); j.record(mkSetup({ id: 'b', grade: 'B' })); j.record(mkSetup({ id: 'c', trigger: { kind: 'absorption' }, rr: 3, targets: [{ price: 106, rr: 3 }] }));
    j.record(mkSetup({ id: 'd', symbol: 'XAUUSD', trigger: { kind: 'absorption' }, condition: { session: { id: 'ny' } } }));
    j.record(mkSetup({ id: 'e', symbol: 'XAUUSD', trigger: { kind: 'absorption' }, condition: { session: { id: 'ny' } } }));
    j.record(mkSetup({ id: 'f', trigger: { kind: 'engulfing' } }));
    j.record(mkSetup({ id: 'g', trigger: { kind: 'engulfing' }, rr: 3, targets: [{ price: 106, rr: 3 }] }));
    j.resolveOpen('XAUUSD', bar(0, { l: 97 }));                                    // d, e → −1 each
    j.resolveOpen('BTCUSD', bar(1, { h: 104.1 }));                                 // a, b, f → +2 each; c, g (tp 106) still open
    assert.equal(j.get('c').status, 'open');
    j.resolveOpen('BTCUSD', bar(2, { l: 97.9 }));                                  // c, g → −1
    assert.deepEqual(j.resolveOpen('BTCUSD', bar(2, { l: 97.9 })), []);           // replayed bar: nothing to do
    assert.equal(j.get('g').status, 'lost');
    assert.equal(j.cancel('g'), null);                                             // already resolved
    const rows = j.scorecard({ by: 'trigger' });
    assert.deepEqual(rows.map((r) => r.key), ['absorption', 'engulfing', 'sweepReclaim']);  // n desc, then key
    const abs = rows[0];
    assert.equal(abs.n, 3); assert.equal(abs.wins, 0); assert.equal(abs.losses, 3); assert.equal(abs.expectancyR, -1);
    assert.equal(abs.profitFactor, 0); assert.equal(abs.maxDdR, 3); assert.equal(abs.winRate, 0); assert.equal(abs.avgRr, round4(7 / 3));
    assert.deepEqual(abs.ci95, [0, round4(wilson(0, 3)[1])]);
    const sw = rows[2];
    assert.equal(sw.n, 2); assert.equal(sw.wins, 2); assert.equal(sw.expectancyR, 2); assert.equal(sw.profitFactor, null); assert.equal(sw.maxDdR, 0); assert.equal(sw.netR, 4);
    assert.deepEqual(sw.ci95, [round4(wilson(2, 2)[0]), 1]);
    const eng = rows[1];
    assert.equal(eng.n, 2); assert.equal(eng.wins, 1); assert.equal(eng.winRate, 0.5); assert.equal(eng.expectancyR, 0.5); assert.equal(eng.profitFactor, 2); assert.equal(eng.maxDdR, 1);
    // other groupings
    assert.deepEqual(j.scorecard({ by: 'symbol' }).map((r) => [r.key, r.n, r.netR]), [['BTCUSD', 5, 4], ['XAUUSD', 2, -2]]);
    assert.deepEqual(j.scorecard({ by: 'grade' }).map((r) => [r.key, r.n]), [['A', 6], ['B', 1]]);
    assert.deepEqual(j.scorecard({ by: 'session' }).map((r) => [r.key, r.n]), [['london', 5], ['ny', 2]]);
    const all = j.scorecard({ by: 'all' });
    assert.equal(all.length, 1); assert.equal(all[0].key, '*'); assert.equal(all[0].n, 7); assert.equal(all[0].netR, 2);
    assert.deepEqual(j.scorecard({ by: 'trigger', symbol: 'XAUUSD' }).map((r) => [r.key, r.n]), [['absorption', 2]]);
    assert.throws(() => j.scorecard({ by: 'colour' }), RangeError);
    assert.deepEqual(SCORECARD_BY, ['symbol', 'trigger', 'grade', 'session', 'all']);
  });
  test('maxDdR is the deepest peak-to-trough fall of the cumulative curve in resolution order', () => {
    const rows = [
      { status: 'won', resultR: 2, resolvedAt: 1 }, { status: 'lost', resultR: -1, resolvedAt: 2 }, { status: 'lost', resultR: -1, resolvedAt: 3 },
      { status: 'lost', resultR: -1, resolvedAt: 4 }, { status: 'won', resultR: 3, resolvedAt: 5 }, { status: 'expired', resultR: -0.5, resolvedAt: 6 },
    ];
    const r = summarize('x', rows.slice().reverse());                                // order of the input must not matter
    assert.equal(r.maxDdR, 3); assert.equal(r.netR, 1.5); assert.equal(r.wins, 2); assert.equal(r.profitFactor, round4(5 / 3.5));
    assert.equal(r.expectancyR, 0.25);
    const empty = summarize('e', []);
    assert.deepEqual(empty, { key: 'e', n: 0, wins: 0, losses: 0, winRate: 0, expectancyR: 0, profitFactor: null, maxDdR: 0, avgRr: 0, netR: 0, ci95: [0, 1] });
    assert.deepEqual(scorecardRows([{ status: 'open', resultR: undefined, symbol: 'X' }, { status: 'cancelled', resultR: 0, symbol: 'X' }], { by: 'symbol' }), []);
  });
});
const round4 = (x) => Math.round(x * 1e4) / 1e4;

describe('cancel / list / misc', () => {
  test('cancel closes an open setup at 0 R with the injected clock; unknown ids are a no-op', () => {
    const j = createJournal({ cfg, now: () => 12345 });
    j.record(mkSetup());
    const r = j.cancel('BTCUSD-1', { reason: 'superseded' });
    assert.equal(r.status, 'cancelled'); assert.equal(r.resultR, 0); assert.equal(r.resolvedAt, 12345); assert.equal(r.reason, 'superseded');
    assert.equal(j.cancel('BTCUSD-1'), null); assert.equal(j.cancel('ghost'), null);
    assert.equal(j.open().length, 0);
    assert.equal(j.scorecard({ by: 'all' }).length, 0);                             // cancelled trades never enter the scorecard
    assert.equal(lines(FILES.resolutions)[0].status, 'cancelled');
    const j2 = new Journal({ cfg }); j2.load();
    assert.equal(j2.get('BTCUSD-1').status, 'cancelled');
  });
  test('list is newest-first with symbol/status/limit filters; get returns copies', () => {
    const j = new Journal({ cfg });
    for (let i = 0; i < 5; i++) j.record(mkSetup({ id: `s${i}`, symbol: i % 2 ? 'XAUUSD' : 'BTCUSD' }));
    j.resolveOpen('BTCUSD', bar(0, { h: 104 }));
    assert.deepEqual(j.list().map((s) => s.id), ['s4', 's3', 's2', 's1', 's0']);
    assert.deepEqual(j.list({ limit: 2 }).map((s) => s.id), ['s4', 's3']);
    assert.deepEqual(j.list({ symbol: 'XAUUSD' }).map((s) => s.id), ['s3', 's1']);
    assert.deepEqual(j.list({ status: 'won' }).map((s) => s.id), ['s4', 's2', 's0']);
    assert.equal(j.get('nope'), null);
    const g = j.get('s0'); g.entry = 0; assert.equal(j.get('s0').entry, 100);
    assert.equal(j.flush(), true); j.close();
  });
  test('an fs that throws on write surfaces the error (no silent data loss)', () => {
    const fs = { mkdirSync() {}, appendFileSync() { throw new Error('EACCES'); }, readFileSync() { const e = new Error('x'); e.code = 'ENOENT'; throw e; } };
    const j = new Journal({ cfg, fs });
    assert.throws(() => j.record(mkSetup()), /EACCES/);
    assert.equal(j.open().length, 0);                                               // nothing half-recorded in memory either
  });
});
