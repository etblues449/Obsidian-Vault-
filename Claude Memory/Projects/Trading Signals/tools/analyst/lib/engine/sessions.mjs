// Sessions — "time dictates when these moves are likely to happen" (source 03). Asia consolidates,
// London manipulates, New York distributes/expands, late NY retraces; liquidity is purged in the
// London/NY windows (source 02). Everything here resolves a UTC timestamp into that wall-clock
// cycle in `cfg.sessions.timezone` (Europe/London by default) using Intl, so the BST↔GMT change
// is handled by the platform's tz database rather than by hand-coded offsets (SPEC.md §4.3).
// Pure: no clock, no state beyond a formatter cache.
//
// DEVIATION: Session.start / Session.end are UTC ms bounds of that day's instance (what ranges, VWAP
//   anchors and chart markers need); the configured "HH:MM" strings are exposed as startLocal/endLocal.
//   Session also carries killzoneStart/killzoneEnd (ms), timezone, localTime and weekday.
// DEVIATION: a timestamp outside every configured session resolves to { id:'none', killzone:false, … }
//   instead of throwing, so a partial session list degrades rather than crashes the engine.
// DEVIATION: previousSessionRange / dayRange return null when no candles fall in the window, and add
//   highT, lowT, n, endMs, dayKey to the spec's { high, low, t }.
// DEVIATION (additive): dayBounds, sessionsForDay, localParts, tzOffsetMs, zonedTimeToUtc, shiftDayKey,
//   previousDayKey, parseHHMM, fmtHHMM, isValidTimeZone are exported beyond the §4.3 list.

const fmtCache = new Map();
function formatter(timeZone) {
  let f = fmtCache.get(timeZone);
  if (!f) {
    // hourCycle 'h23' avoids the "24:00" hour some ICU builds emit with hour12:false.
    f = new Intl.DateTimeFormat('en-GB', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' });
    fmtCache.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(tz) {
  try { formatter(tz); return true; } catch { return false; }
}

/** "HH:MM" → minutes since local midnight (0..1440; "24:00" allowed as an end bound), or null. */
export function parseHHMM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(typeof s === 'string' ? s.trim() : '');
  if (!m) return null;
  const hh = +m[1], mm = +m[2];
  if (mm > 59 || hh > 24 || (hh === 24 && mm !== 0)) return null;
  return hh * 60 + mm;
}
export const fmtHHMM = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Wall-clock parts of `tMs` in `timeZone`. `minutes` = minutes since local midnight; `dayKey` = local calendar date. */
export function localParts(tMs, timeZone) {
  const p = {};
  for (const { type, value } of formatter(timeZone).formatToParts(new Date(tMs))) p[type] = value;
  const y = +p.year, mo = +p.month, d = +p.day, hh = +p.hour % 24, mm = +p.minute, ss = +p.second;
  return { y, mo, d, hh, mm, ss, minutes: hh * 60 + mm, dayKey: `${p.year}-${p.month}-${p.day}`, weekday: p.weekday };
}

/** UTC offset (ms) of `timeZone` at instant `tMs`: local wall clock − UTC. */
export function tzOffsetMs(tMs, timeZone) {
  const l = localParts(tMs, timeZone);
  const asUtc = Date.UTC(l.y, l.mo - 1, l.d, l.hh, l.mm, l.ss);
  return asUtc - Math.floor(tMs / 1000) * 1000;
}

/**
 * Local wall-clock (dayKey, minutes) → UTC ms. Minutes may be 1440 (= next day 00:00).
 * Works through DST transitions by iterating the offset. A wall-clock time that does not exist
 * (inside the spring-forward gap) resolves to the instant the clocks jump to; an ambiguous one
 * (the autumn repeat hour) resolves to its first occurrence.
 */
export function zonedTimeToUtc(dayKey, minutes, timeZone) {
  const [y, mo, d] = dayKey.split('-').map(Number);
  if (![y, mo, d].every(Number.isInteger)) throw new RangeError(`bad dayKey ${JSON.stringify(dayKey)} (expected YYYY-MM-DD)`);
  const wall = Date.UTC(y, mo - 1, d, 0, minutes);
  let guess = wall - tzOffsetMs(wall, timeZone);
  for (let i = 0; i < 3; i++) {
    const next = wall - tzOffsetMs(guess, timeZone);
    if (next === guess) break;
    guess = next;
  }
  // Prefer the earlier of two candidates when the hour repeats; land on the jump when it is skipped.
  const earlier = guess - 36e5;
  if (tzOffsetMs(earlier, timeZone) !== tzOffsetMs(guess, timeZone) && earlier + tzOffsetMs(earlier, timeZone) === wall) return earlier;
  if (guess + tzOffsetMs(guess, timeZone) !== wall) {
    // Skipped wall time: walk forward from safely before the gap to the first instant whose local clock is ≥ target.
    let g = guess - 3 * 36e5;
    while (g + tzOffsetMs(g, timeZone) < wall) g += 60e3;
    return g;
  }
  return guess;
}

/** dayKey ± n calendar days (pure date arithmetic, timezone-free). */
export function shiftDayKey(dayKey, n) {
  const [y, mo, d] = dayKey.split('-').map(Number);
  const t = Date.UTC(y, mo - 1, d + n);
  const dt = new Date(t);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}
export const previousDayKey = (dayKey) => shiftDayKey(dayKey, -1);

const sessionsCfg = (cfg) => {
  const s = cfg && cfg.sessions && Array.isArray(cfg.sessions.list) ? cfg.sessions : cfg;
  if (!s || !Array.isArray(s.list) || !s.timezone) throw new TypeError('sessions config must be { timezone, list[] } (or a strategy config containing it)');
  return s;
};

function findSession(s, minutes) {
  for (const sess of s.list) {
    const a = parseHHMM(sess.start), b = parseHHMM(sess.end);
    if (a !== null && b !== null && minutes >= a && minutes < b) return sess;
  }
  return null;
}

/** Local day bounds: 00:00 of dayKey → 00:00 of the next day (23/24/25 h on DST days). */
export function dayBounds(dayKey, cfg) {
  const { timezone } = sessionsCfg(cfg);
  return { startMs: zonedTimeToUtc(dayKey, 0, timezone), endMs: zonedTimeToUtc(dayKey, 1440, timezone) };
}

/** UTC bounds of `sessionId` on local date `dayKey`; `killzone` bounds included when configured. */
export function sessionBounds(dayKey, sessionId, cfg) {
  const s = sessionsCfg(cfg);
  const sess = s.list.find((x) => x.id === sessionId);
  if (!sess) throw new RangeError(`unknown session id ${JSON.stringify(sessionId)}`);
  const out = { startMs: zonedTimeToUtc(dayKey, parseHHMM(sess.start), s.timezone), endMs: zonedTimeToUtc(dayKey, parseHHMM(sess.end), s.timezone) };
  if (sess.killzone) out.killzone = { startMs: zonedTimeToUtc(dayKey, parseHHMM(sess.killzone.start), s.timezone), endMs: zonedTimeToUtc(dayKey, parseHHMM(sess.killzone.end), s.timezone) };
  return out;
}

/**
 * Resolve the session a timestamp falls in.
 * @returns {{id, label, role, start:number, end:number, startLocal:string, endLocal:string, killzone:boolean, killzoneStart?:number, killzoneEnd?:number, dayKey:string, timezone:string, localTime:string}}
 *   start/end are UTC ms for THIS day's instance of the session (for chart markers and ranges).
 */
export function resolveSession(tMs, cfg) {
  const s = sessionsCfg(cfg);
  const lp = localParts(tMs, s.timezone);
  const sess = findSession(s, lp.minutes);
  const base = { dayKey: lp.dayKey, timezone: s.timezone, localTime: fmtHHMM(lp.minutes), weekday: lp.weekday };
  if (!sess) return { id: 'none', label: 'Off-session', role: 'none', start: tMs, end: tMs, startLocal: null, endLocal: null, killzone: false, ...base };
  const b = sessionBounds(lp.dayKey, sess.id, s);
  const out = { id: sess.id, label: sess.label, role: sess.role, start: b.startMs, end: b.endMs, startLocal: sess.start, endLocal: sess.end, killzone: false, ...base };
  if (b.killzone) {
    out.killzoneStart = b.killzone.startMs; out.killzoneEnd = b.killzone.endMs;
    out.killzone = tMs >= b.killzone.startMs && tMs < b.killzone.endMs;
  }
  return out;
}

export function isKillzone(tMs, cfg) { return resolveSession(tMs, cfg).killzone; }

/** All sessions of a local day with UTC bounds, in start order (chart "LDN"/"NY" markers, VWAP anchors). */
export function sessionsForDay(dayKey, cfg) {
  const s = sessionsCfg(cfg);
  return s.list.map((sess) => ({ id: sess.id, label: sess.label, role: sess.role, dayKey, ...sessionBounds(dayKey, sess.id, s) })).sort((a, b) => a.startMs - b.startMs);
}

function rangeOf(candles1m, startMs, endMs) {
  let high = -Infinity, low = Infinity, n = 0, highT = null, lowT = null;
  for (const c of candles1m) {
    if (c.t < startMs || c.t >= endMs) continue;
    n++;
    if (c.h > high) { high = c.h; highT = c.t; }
    if (c.l < low) { low = c.l; lowT = c.t; }
  }
  return n ? { high, low, highT, lowT, n } : null;
}

/**
 * High/low of the most recent COMPLETED instance of `sessionId` before `tMs` (source 02: liquidity
 * rests at the previous session's high and low). Looks back up to `maxDaysBack` days for one that
 * has candles. `t` = that session's UTC start.
 * @returns {{high, low, t, endMs, dayKey, n}|null}
 */
export function previousSessionRange(candles1m, tMs, sessionId, cfg, { maxDaysBack = 7 } = {}) {
  const s = sessionsCfg(cfg);
  let dayKey = localParts(tMs, s.timezone).dayKey;
  for (let i = 0; i <= maxDaysBack; i++) {
    const b = sessionBounds(dayKey, sessionId, s);
    if (b.endMs <= tMs) {
      const r = rangeOf(candles1m, b.startMs, b.endMs);
      if (r) return { ...r, t: b.startMs, endMs: b.endMs, dayKey };
    }
    dayKey = previousDayKey(dayKey);
  }
  return null;
}

/** High/low of local calendar day `dayKey` (pass the previous dayKey for PDH/PDL). */
export function dayRange(candles1m, dayKey, cfg) {
  const { startMs, endMs } = dayBounds(dayKey, cfg);
  const r = rangeOf(candles1m, startMs, endMs);
  return r ? { ...r, t: startMs, endMs, dayKey } : null;
}
