import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolveSession, sessionBounds, isKillzone, previousSessionRange, dayRange, dayBounds, sessionsForDay,
  localParts, parseHHMM, fmtHHMM, zonedTimeToUtc, tzOffsetMs, shiftDayKey, previousDayKey, isValidTimeZone,
} from '../lib/engine/sessions.mjs';
import { mkCandles, loadFixture } from './helpers.mjs';

const cfg = JSON.parse(readFileSync(new URL('../config/strategy.json', import.meta.url), 'utf8'));
const S = cfg.sessions;
const U = (...a) => Date.UTC(...a);
const H = 36e5;

// UK clock changes in 2026: BST starts Sun 29 Mar 01:00 UTC (clocks → 02:00), ends Sun 25 Oct 01:00 UTC (clocks → 01:00 GMT).
const SPRING = U(2026, 2, 29, 1, 0);
const AUTUMN = U(2026, 9, 25, 1, 0);

describe('time primitives', () => {
  test('parseHHMM / fmtHHMM', () => {
    assert.equal(parseHHMM('07:00'), 420);
    assert.equal(parseHHMM('24:00'), 1440);
    assert.equal(parseHHMM('13:30'), 810);
    for (const bad of ['24:01', '25:00', '7', '07:60', '', null, '0700']) assert.equal(parseHHMM(bad), null, String(bad));
    assert.equal(fmtHHMM(810), '13:30');
    assert.equal(fmtHHMM(0), '00:00');
  });
  test('isValidTimeZone', () => {
    assert.ok(isValidTimeZone('Europe/London') && isValidTimeZone('America/New_York') && isValidTimeZone('UTC'));
    assert.equal(isValidTimeZone('Mars/Olympus'), false);
    assert.equal(isValidTimeZone(''), false);
  });
  test('localParts gives London wall clock and the London calendar date', () => {
    const p = localParts(U(2026, 6, 1, 23, 30), 'Europe/London'); // 23:30 UTC in July = 00:30 BST next day
    assert.equal(p.dayKey, '2026-07-02');
    assert.equal(p.hh, 0); assert.equal(p.mm, 30); assert.equal(p.minutes, 30);
    const w = localParts(U(2026, 0, 15, 23, 30), 'Europe/London'); // January: GMT = UTC
    assert.equal(w.dayKey, '2026-01-15'); assert.equal(w.minutes, 23 * 60 + 30);
    assert.equal(localParts(U(2026, 0, 15, 0, 0), 'Europe/London').hh, 0); // never "24"
  });
  test('tzOffsetMs flips exactly at the transitions', () => {
    assert.equal(tzOffsetMs(SPRING - 1, 'Europe/London'), 0);
    assert.equal(tzOffsetMs(SPRING, 'Europe/London'), H);
    assert.equal(tzOffsetMs(AUTUMN - 1, 'Europe/London'), H);
    assert.equal(tzOffsetMs(AUTUMN, 'Europe/London'), 0);
    assert.equal(tzOffsetMs(SPRING, 'UTC'), 0);
  });
  test('zonedTimeToUtc through both transitions, the skipped hour and the repeated hour', () => {
    const tz = 'Europe/London';
    assert.equal(zonedTimeToUtc('2026-03-28', 7 * 60, tz), U(2026, 2, 28, 7));       // GMT day
    assert.equal(zonedTimeToUtc('2026-03-29', 7 * 60, tz), U(2026, 2, 29, 6));       // first BST day: 07:00 BST = 06:00 UTC
    assert.equal(zonedTimeToUtc('2026-03-29', 0, tz), U(2026, 2, 29, 0));            // midnight still GMT
    assert.equal(zonedTimeToUtc('2026-03-29', 90, tz), SPRING);                      // 01:30 does not exist → the jump instant
    assert.equal(zonedTimeToUtc('2026-10-25', 0, tz), U(2026, 9, 24, 23));           // midnight still BST
    assert.equal(zonedTimeToUtc('2026-10-25', 7 * 60, tz), U(2026, 9, 25, 7));       // 07:00 GMT
    assert.equal(zonedTimeToUtc('2026-10-25', 90, tz), U(2026, 9, 25, 0, 30));       // ambiguous 01:30 → first occurrence (BST)
    assert.equal(zonedTimeToUtc('2026-10-25', 1440, tz), U(2026, 9, 26, 0));         // 24:00 = next midnight GMT
    assert.throws(() => zonedTimeToUtc('nope', 0, tz), RangeError);
  });
  test('shiftDayKey / previousDayKey are calendar arithmetic', () => {
    assert.equal(previousDayKey('2026-03-01'), '2026-02-28');
    assert.equal(shiftDayKey('2026-12-31', 1), '2027-01-01');
    assert.equal(shiftDayKey('2026-10-25', -1), '2026-10-24');
  });
});

describe('dayBounds across DST', () => {
  test('23h on spring-forward day, 25h on fall-back day, 24h otherwise', () => {
    const d = (k) => { const b = dayBounds(k, cfg); return (b.endMs - b.startMs) / H; };
    assert.equal(d('2026-03-28'), 24);
    assert.equal(d('2026-03-29'), 23);
    assert.equal(d('2026-03-30'), 24);
    assert.equal(d('2026-10-24'), 24);
    assert.equal(d('2026-10-25'), 25);
    assert.equal(d('2026-10-26'), 24);
    assert.deepEqual(dayBounds('2026-10-25', cfg), { startMs: U(2026, 9, 24, 23), endMs: U(2026, 9, 26, 0) });
    assert.deepEqual(dayBounds('2026-03-29', cfg), { startMs: U(2026, 2, 29, 0), endMs: U(2026, 2, 29, 23) });
  });
  test('accepts either the strategy config or its sessions block', () => {
    assert.deepEqual(dayBounds('2026-06-01', cfg), dayBounds('2026-06-01', S));
    assert.throws(() => dayBounds('2026-06-01', {}), TypeError);
  });
});

describe('resolveSession', () => {
  test('London 07:00 is 07:00 UTC in winter and 06:00 UTC in summer', () => {
    const winter = resolveSession(U(2026, 0, 15, 7, 0), cfg);
    assert.equal(winter.id, 'london'); assert.equal(winter.dayKey, '2026-01-15'); assert.equal(winter.localTime, '07:00');
    assert.equal(resolveSession(U(2026, 0, 15, 6, 59), cfg).id, 'asia');
    const summer = resolveSession(U(2026, 6, 15, 6, 0), cfg);
    assert.equal(summer.id, 'london'); assert.equal(summer.localTime, '07:00'); assert.equal(summer.killzone, true);
    assert.equal(resolveSession(U(2026, 6, 15, 5, 59), cfg).id, 'asia');
    assert.equal(resolveSession(U(2026, 6, 15, 7, 0), cfg).id, 'london', '08:00 BST is still London');
  });
  test('every session resolves with role, bounds and killzone flag matching the config', () => {
    const t = U(2026, 0, 15, 14, 0); // 14:00 GMT → NY killzone (13:30–16:00)
    const s = resolveSession(t, cfg);
    assert.equal(s.id, 'ny'); assert.equal(s.role, 'distribution'); assert.equal(s.label, 'New York');
    assert.equal(s.start, U(2026, 0, 15, 12)); assert.equal(s.end, U(2026, 0, 15, 17));
    assert.equal(s.startLocal, '12:00'); assert.equal(s.endLocal, '17:00');
    assert.equal(s.killzone, true); assert.equal(s.killzoneStart, U(2026, 0, 15, 13, 30)); assert.equal(s.killzoneEnd, U(2026, 0, 15, 16));
    assert.equal(resolveSession(U(2026, 0, 15, 12, 0), cfg).killzone, false, 'NY open but before 13:30');
    assert.equal(resolveSession(U(2026, 0, 15, 16, 0), cfg).killzone, false, 'killzone end is exclusive');
    const late = resolveSession(U(2026, 0, 15, 23, 59), cfg);
    assert.equal(late.id, 'late'); assert.equal(late.role, 'retracement'); assert.equal(late.killzone, false); assert.equal(late.end, U(2026, 0, 16, 0));
    assert.equal(resolveSession(U(2026, 0, 15, 0, 0), cfg).id, 'asia');
    assert.equal(resolveSession(U(2026, 0, 15, 0, 0), cfg).role, 'consolidation');
    assert.equal(resolveSession(U(2026, 0, 15, 10, 0), cfg).killzone, false, 'London killzone end 10:00 exclusive');
    assert.equal(resolveSession(U(2026, 0, 15, 9, 59), cfg).killzone, true);
  });
  test('spring-forward: the minute before the change is 00:59 GMT, the minute after is 02:00 BST, same dayKey', () => {
    const before = resolveSession(SPRING - 60e3, cfg), after = resolveSession(SPRING, cfg);
    assert.equal(before.localTime, '00:59'); assert.equal(after.localTime, '02:00');
    assert.equal(before.dayKey, '2026-03-29'); assert.equal(after.dayKey, '2026-03-29');
    assert.equal(before.id, 'asia'); assert.equal(after.id, 'asia');
    // Asia on 29 Mar is only 6 UTC hours long: 00:00 GMT → 07:00 BST = 06:00 UTC
    assert.equal(after.start, U(2026, 2, 29, 0)); assert.equal(after.end, U(2026, 2, 29, 6));
    assert.equal(resolveSession(U(2026, 2, 29, 6, 0), cfg).id, 'london');
    assert.equal(resolveSession(U(2026, 2, 29, 5, 59), cfg).id, 'asia');
    // the day before, London still opens at 07:00 UTC
    assert.equal(resolveSession(U(2026, 2, 28, 6, 30), cfg).id, 'asia');
    assert.equal(resolveSession(U(2026, 2, 28, 7, 0), cfg).id, 'london');
  });
  test('fall-back: 01:30 UTC is 01:30 GMT after being 01:30 BST an hour earlier; dayKey is the London date', () => {
    const first = resolveSession(AUTUMN - 30 * 60e3, cfg); // 00:30 UTC = 01:30 BST
    const second = resolveSession(AUTUMN + 30 * 60e3, cfg); // 01:30 UTC = 01:30 GMT
    assert.equal(first.localTime, '01:30'); assert.equal(second.localTime, '01:30');
    assert.equal(first.dayKey, '2026-10-25'); assert.equal(second.dayKey, '2026-10-25');
    assert.equal(first.id, 'asia'); assert.equal(second.id, 'asia');
    // Asia on 25 Oct is 8 UTC hours: 00:00 BST (23:00 UTC prev day) → 07:00 GMT
    assert.equal(second.start, U(2026, 9, 24, 23)); assert.equal(second.end, U(2026, 9, 25, 7));
    assert.equal(resolveSession(U(2026, 9, 25, 6, 59), cfg).id, 'asia');
    assert.equal(resolveSession(U(2026, 9, 25, 7, 0), cfg).id, 'london');
    // 23:30 UTC on 24 Oct is already 25 Oct in London (00:30 BST)
    assert.equal(resolveSession(U(2026, 9, 24, 23, 30), cfg).dayKey, '2026-10-25');
    // 23:30 UTC on 25 Oct is still 25 Oct (GMT now)
    assert.equal(resolveSession(U(2026, 9, 25, 23, 30), cfg).dayKey, '2026-10-25');
    assert.equal(resolveSession(U(2026, 9, 25, 23, 30), cfg).id, 'late');
    // the day after, London opens at 07:00 UTC again
    assert.equal(resolveSession(U(2026, 9, 26, 6, 30), cfg).id, 'asia');
    assert.equal(resolveSession(U(2026, 9, 26, 7, 0), cfg).id, 'london');
  });
  test('the real BTC fixture (3–4 Oct 2026, BST) resolves to London dates and sessions', () => {
    const fx = loadFixture();
    const first = resolveSession(fx[0].t, cfg); // 10:17 UTC = 11:17 BST → London
    assert.equal(first.dayKey, '2026-10-03'); assert.equal(first.id, 'london'); assert.equal(first.localTime, '11:17');
    const last = resolveSession(fx.at(-1).t, cfg); // 19:36 UTC = 20:36 BST → late
    assert.equal(last.dayKey, '2026-10-04'); assert.equal(last.id, 'late');
    const at2300 = fx.find((c) => c.t === U(2026, 9, 3, 23, 0));
    assert.equal(resolveSession(at2300.t, cfg).dayKey, '2026-10-04', '23:00 UTC is already 4 Oct in London');
    assert.equal(resolveSession(at2300.t, cfg).id, 'asia');
  });
  test('a gap in the session list resolves to an off-session marker instead of throwing', () => {
    const partial = { timezone: 'Europe/London', list: [{ id: 'london', label: 'London', start: '07:00', end: '12:00', role: 'manipulation' }] };
    const s = resolveSession(U(2026, 0, 15, 3), partial);
    assert.equal(s.id, 'none'); assert.equal(s.killzone, false); assert.equal(s.dayKey, '2026-01-15');
    assert.equal(isKillzone(U(2026, 0, 15, 8), partial), false, 'session without a killzone block');
  });
  test('isKillzone shortcut and a non-London timezone', () => {
    assert.equal(isKillzone(U(2026, 0, 15, 8), cfg), true);
    assert.equal(isKillzone(U(2026, 0, 15, 11), cfg), false);
    const ny = { ...S, timezone: 'America/New_York' };
    assert.equal(resolveSession(U(2026, 0, 15, 12, 0), ny).localTime, '07:00');
    assert.equal(resolveSession(U(2026, 0, 15, 12, 0), ny).id, 'london');
    assert.equal(resolveSession(U(2026, 0, 15, 12, 0), ny).dayKey, '2026-01-15');
  });
});

describe('sessionBounds / sessionsForDay', () => {
  test('bounds + killzone bounds; unknown id throws', () => {
    const b = sessionBounds('2026-06-10', 'ny', cfg);
    assert.deepEqual(b, { startMs: U(2026, 5, 10, 11), endMs: U(2026, 5, 10, 16), killzone: { startMs: U(2026, 5, 10, 12, 30), endMs: U(2026, 5, 10, 15) } });
    assert.equal(sessionBounds('2026-06-10', 'asia', cfg).killzone, undefined);
    assert.throws(() => sessionBounds('2026-06-10', 'tokyo', cfg), /unknown session/);
  });
  test('sessionsForDay tiles the London day contiguously, including DST days', () => {
    for (const dk of ['2026-03-29', '2026-10-25', '2026-06-10']) {
      const list = sessionsForDay(dk, cfg);
      assert.deepEqual(list.map((s) => s.id), ['asia', 'london', 'ny', 'late']);
      const db = dayBounds(dk, cfg);
      assert.equal(list[0].startMs, db.startMs);
      assert.equal(list.at(-1).endMs, db.endMs);
      for (let i = 1; i < list.length; i++) assert.equal(list[i].startMs, list[i - 1].endMs);
    }
  });
});

describe('previousSessionRange / dayRange', () => {
  const start = U(2026, 9, 23, 0, 0); // Fri 23 Oct 00:00 UTC (01:00 BST) → runs through the 25 Oct change
  const c1 = mkCandles({ n: 4 * 24 * 60, start, seed: 9 });
  const hl = (from, to) => { const k = c1.filter((c) => c.t >= from && c.t < to); return { high: Math.max(...k.map((c) => c.h)), low: Math.min(...k.map((c) => c.l)), n: k.length }; };

  test('previous completed instance of a session, across the fall-back day', () => {
    // At 14:00 UTC on Sun 25 Oct (GMT), the last COMPLETED London session is 25 Oct 07:00–12:00 UTC
    const r = previousSessionRange(c1, U(2026, 9, 25, 14), 'london', cfg);
    const want = hl(U(2026, 9, 25, 7), U(2026, 9, 25, 12));
    assert.equal(r.dayKey, '2026-10-25'); assert.equal(r.t, U(2026, 9, 25, 7)); assert.equal(r.endMs, U(2026, 9, 25, 12));
    assert.equal(r.high, want.high); assert.equal(r.low, want.low); assert.equal(r.n, 300);
    // At 09:00 UTC on 25 Oct (inside London), the previous London is Sat 24 Oct, BST: 06:00–11:00 UTC
    const r2 = previousSessionRange(c1, U(2026, 9, 25, 9), 'london', cfg);
    assert.equal(r2.dayKey, '2026-10-24'); assert.equal(r2.t, U(2026, 9, 24, 6)); assert.equal(r2.endMs, U(2026, 9, 24, 11));
    assert.deepEqual({ high: r2.high, low: r2.low }, { high: hl(r2.t, r2.endMs).high, low: hl(r2.t, r2.endMs).low });
    // Asia on 25 Oct spans the extra hour: 23:00 UTC 24 Oct → 07:00 UTC 25 Oct = 480 candles
    const asia = previousSessionRange(c1, U(2026, 9, 25, 12), 'asia', cfg);
    assert.equal(asia.t, U(2026, 9, 24, 23)); assert.equal(asia.n, 480);
    assert.ok(asia.highT >= asia.t && asia.lowT < asia.endMs);
  });
  test('exact session end counts as completed; no candles → null; falls back across empty days', () => {
    const r = previousSessionRange(c1, U(2026, 9, 24, 11, 0), 'london', cfg); // London ends 11:00 UTC on 24 Oct (BST)
    assert.equal(r.t, U(2026, 9, 24, 6));
    assert.equal(previousSessionRange([], U(2026, 9, 24, 11), 'london', cfg), null);
    // only Friday's candles exist; asking on Monday finds Friday's session, 3 days back
    const fri = c1.filter((c) => c.t < U(2026, 9, 24, 0));
    const r3 = previousSessionRange(fri, U(2026, 9, 26, 14), 'ny', cfg);
    assert.equal(r3.dayKey, '2026-10-23'); assert.equal(r3.t, U(2026, 9, 23, 11));
    assert.equal(previousSessionRange(fri, U(2026, 9, 26, 14), 'ny', cfg, { maxDaysBack: 1 }), null);
  });
  test('dayRange uses London calendar days, 25h on 25 Oct; previous dayKey gives PDH/PDL', () => {
    const d = dayRange(c1, '2026-10-25', cfg);
    assert.equal(d.t, U(2026, 9, 24, 23)); assert.equal(d.endMs, U(2026, 9, 26, 0)); assert.equal(d.n, 25 * 60);
    const want = hl(d.t, d.endMs);
    assert.equal(d.high, want.high); assert.equal(d.low, want.low);
    const pd = dayRange(c1, previousDayKey(resolveSession(U(2026, 9, 25, 12), cfg).dayKey), cfg);
    assert.equal(pd.dayKey, '2026-10-24'); assert.equal(pd.n, 24 * 60);
    assert.equal(dayRange(c1, '2026-01-01', cfg), null);
  });
  test('spring-forward day is 23 candles-hours long', () => {
    const c = mkCandles({ n: 3 * 24 * 60, start: U(2026, 2, 28, 0, 0), seed: 3 });
    assert.equal(dayRange(c, '2026-03-29', cfg).n, 23 * 60);
    assert.equal(dayRange(c, '2026-03-28', cfg).n, 24 * 60);
    const asia = previousSessionRange(c, U(2026, 2, 29, 12), 'asia', cfg);
    assert.equal(asia.n, 6 * 60, 'Asia 00:00 GMT → 07:00 BST is six UTC hours');
  });
});
