// lib/journal.mjs — append-only setup journal, walk-forward resolver and scorecard (SPEC.md §5).
//
// Files under `cfg.journal.dir` (created with mkdir -p; one writer, so appendFileSync is atomic enough):
//   setups.jsonl       one line per Setup at creation, exactly as recorded
//   trail.jsonl        one line per trailing-stop move (so a restart does not forget a tightened stop)
//   resolutions.jsonl  one line per resolution {id, symbol, status, resolvedAt, resultR, mfeR, maeR, exit, ...}
// load() replays setups → trail → resolutions and rebuilds the open set. A torn last line (crash
// mid-write) is counted in `malformed` and skipped, never fatal.
//
// Resolver (per closed 1m candle, in time order, after entry):
//   long : l ≤ stop ⇒ lost at the stop · h ≥ targets[0] ⇒ won at the target · BOTH in one candle ⇒
//          lost + `ambiguous:true` — conservative; the bar does not say which printed first
//          (resolve_trades.py made that a manual call, here it is auto-lost and flagged).
//   short: mirrored.  resolveTimeoutHours ⇒ expired, R taken from that candle's close.
//   R is measured against the ORIGINAL risk |entry − stop0| (source 05 §7: the invalidation point),
//   so a trailed stop-out reports its real signed R, not −1. mfeR/maeR are magnitudes ≥ 0.
// Trailing by proved auctions (source 05 §7, `journal.trailByProvedAuctions`): when the orchestrator
//   passes structure-TF swings, a swing low (long) that formed after entry, is confirmed before the
//   current candle and sits above the current stop moves the stop to swing ∓ stopBufferAtr×ATR.
//   The stop moves only in the trade direction and never beyond entry until the trade has reached
//   +1R mfe ("do not move your stop to break-even immediately … wait for your side to win a real
//   auction"). Every move is appended to setup.trail[] and to trail.jsonl.
//
// Statuses are the exit MECHANISM (stop → 'lost', target → 'won', timeout → 'expired'); `resultR`
// carries the money. The scorecard counts a win as resultR > 0, so a stop-out above entry after a
// trail counts as a win — that is the trader's experience, the mechanism is still visible in `exit`.
//
// Deterministic: no Date.now() — `now` is injected and only used for cancel() timestamps.
// DEVIATION: none from §5. Additive: trail.jsonl; `by:'all'` in scorecard(); cancel(); list(); open();
//   resolveOpen(symbol, candle, { swings, atr }) returns the resolutions it produced and the
//   Journal emits 'setup' / 'resolved' / 'trail' events so the orchestrator can forward them.

import { EventEmitter } from 'node:events';
import nodeFs from 'node:fs';
import { resolve as resolvePath, join } from 'node:path';
import { TF_MS } from './engine/candles.mjs';

export const FILES = { setups: 'setups.jsonl', trail: 'trail.jsonl', resolutions: 'resolutions.jsonl' };
export const SCORECARD_BY = ['symbol', 'trigger', 'grade', 'session', 'all'];
const HOUR = 36e5;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round = (x, dp = 4) => (isNum(x) ? Math.round(x * 10 ** dp) / 10 ** dp : x);

/** Shape check for a Setup line. Returns the first problem or null. Only what the resolver needs is mandatory. */
export function validateSetup(s) {
  if (!s || typeof s !== 'object') return 'setup must be an object';
  if (typeof s.id !== 'string' || !s.id) return 'setup.id must be a non-empty string';
  if (typeof s.symbol !== 'string' || !s.symbol) return 'setup.symbol must be a non-empty string';
  if (s.side !== 'long' && s.side !== 'short') return `setup.side must be 'long'|'short', got ${JSON.stringify(s.side)}`;
  if (!isNum(s.t)) return 'setup.t must be a finite number (ms)';
  if (!isNum(s.entry) || !isNum(s.stop)) return 'setup.entry and setup.stop must be finite numbers';
  if (s.entry === s.stop) return 'setup.stop must differ from setup.entry';
  if ((s.side === 'long') !== (s.stop < s.entry)) return `setup.stop is on the wrong side of entry for a ${s.side}`;
  const tp = s.targets?.[0]?.price;
  if (!isNum(tp)) return 'setup.targets[0].price must be a finite number';
  if ((s.side === 'long') !== (tp > s.entry)) return `setup.targets[0] is on the wrong side of entry for a ${s.side}`;
  return null;
}

/** 95 % Wilson score interval for a proportion. n = 0 → [0, 1] (no information, not a crash). */
export function wilson(wins, n, z = 1.959964) {
  if (!(n > 0)) return [0, 1];
  const p = wins / n, z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

/** Signed R of `price` for a setup, measured against the original risk (entry − stop0). */
export function rOf(setup, price) {
  const risk = Math.abs(setup.entry - (setup.stop0 ?? setup.stop));
  if (!(risk > 0) || !isNum(price)) return 0;
  return (setup.side === 'long' ? price - setup.entry : setup.entry - price) / risk;
}

/** Group key for the scorecard. Unknown fields fall into an honest bucket rather than crashing. */
function groupKey(s, by) {
  switch (by) {
    case 'symbol': return s.symbol ?? 'unknown';
    case 'trigger': return s.trigger?.kind ?? 'unknown';
    case 'grade': return s.grade ?? 'unknown';
    case 'session': return s.condition?.session?.id ?? 'none';
    case 'all': return '*';
    default: throw new RangeError(`scorecard by must be one of ${SCORECARD_BY.join('|')}, got ${JSON.stringify(by)}`);
  }
}

/**
 * One scorecard row from resolved setups (status won|lost|expired, resultR finite). Pure.
 * profitFactor = gross R won / gross R lost; null when nothing was lost (undefined, and JSON-safe).
 * maxDdR = largest peak-to-trough fall of the cumulative-R curve in resolution order.
 */
export function summarize(key, resolved) {
  const rows = resolved.filter((s) => isNum(s.resultR)).sort((a, b) => (a.resolvedAt ?? 0) - (b.resolvedAt ?? 0));
  const n = rows.length;
  let wins = 0, sumR = 0, grossWon = 0, grossLost = 0, sumRr = 0, rrN = 0, cum = 0, peak = 0, maxDd = 0;
  for (const s of rows) {
    const r = s.resultR;
    if (r > 0) { wins++; grossWon += r; } else grossLost += -r;
    sumR += r;
    if (isNum(s.rr)) { sumRr += s.rr; rrN++; }
    cum += r; peak = Math.max(peak, cum); maxDd = Math.max(maxDd, peak - cum);
  }
  const [lo, hi] = wilson(wins, n);
  return {
    key, n, wins, losses: n - wins,
    winRate: n ? round(wins / n) : 0,
    expectancyR: n ? round(sumR / n) : 0,
    profitFactor: grossLost > 0 ? round(grossWon / grossLost) : null,
    maxDdR: round(maxDd),
    avgRr: rrN ? round(sumRr / rrN) : 0,
    netR: round(sumR),
    ci95: [round(lo), round(hi)],
  };
}

/** Scorecard rows grouped by `by`, most-traded first. Pure. */
export function scorecardRows(resolved, { by = 'trigger', symbol } = {}) {
  groupKey({}, by); // validate `by` before touching data
  const groups = new Map();
  for (const s of resolved) {
    if (symbol && s.symbol !== symbol) continue;
    if (!['won', 'lost', 'expired'].includes(s.status)) continue;
    const k = groupKey(s, by);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }
  return [...groups].map(([k, list]) => summarize(k, list)).sort((a, b) => b.n - a.n || String(a.key).localeCompare(String(b.key)));
}

/**
 * Walk one open setup forward over one candle. Pure: returns `{ setup, resolution|null, trail|null }`
 * with a NEW setup object (the input is not mutated). `opts.swings` are structure-TF swings,
 * `opts.atr` the current ATR for the trail buffer, `opts.cfg` the strategy config.
 */
export function stepSetup(setup, candle, { swings, atr, cfg = {} } = {}) {
  const s = { ...setup, trail: setup.trail ? [...setup.trail] : [] };
  const skip = { setup: s, resolution: null, trail: null };
  const entryT = s.t + (TF_MS[s.tf] ?? 0); // 1m children of the trigger candle are pre-entry (entry = its close)
  if (!candle || !isNum(candle.t) || candle.t < entryT || candle.closed === false) return skip;
  if ((s.lastCandleT ?? -Infinity) >= candle.t) return skip; // the same or an older bar replayed: already counted
  const long = s.side === 'long';
  const finish = (status, exit, exitPrice, extra = {}) => {
    const resolution = {
      id: s.id, symbol: s.symbol, status, exit, exitPrice: round(exitPrice, 8), resolvedAt: candle.t,
      resultR: round(rOf(s, exitPrice)), mfeR: round(s.mfeR), maeR: round(s.maeR), stop: s.stop, trail: s.trail, ...extra,
    };
    return { setup: { ...s, ...resolution, lastCandleT: candle.t }, resolution, trail: null };
  };

  // 1. Timeout first: the position would have been flat before this bar printed.
  const hours = cfg.journal?.resolveTimeoutHours;
  if (isNum(hours) && hours > 0 && candle.t >= entryT + hours * HOUR) return finish('expired', 'timeout', candle.c);

  // 2. Trail by proved auctions — using swings confirmed BEFORE this candle, so the move precedes the test.
  let trail = null;
  if (cfg.journal?.trailByProvedAuctions && Array.isArray(swings) && swings.length) {
    const structureTf = cfg.timeframes?.structure ?? '15m';
    const lookback = cfg.indicators?.swingLookback ?? 2;
    const confirmMs = (lookback + 1) * (TF_MS[structureTf] ?? TF_MS['15m']);
    const buffer = (cfg.czt?.stopBufferAtr ?? 0) * (isNum(atr) ? atr : 0);
    let best = null;
    for (const sw of swings) {
      if (sw.kind !== (long ? 'low' : 'high') || !isNum(sw.price) || !isNum(sw.t)) continue;
      if (sw.t < entryT || sw.t + confirmMs > candle.t) continue;            // formed after entry, confirmed before this bar
      const proposed = long ? sw.price - buffer : sw.price + buffer;
      if (long ? proposed <= s.stop : proposed >= s.stop) continue;           // only ever in the trade direction
      if (!best || (long ? proposed > best.proposed : proposed < best.proposed)) best = { sw, proposed };
    }
    if (best) {
      // Never past entry before +1R mfe (source 05: break-even too early gets stopped by normal rotation).
      const cap = (s.mfeR ?? 0) >= 1 ? best.proposed : long ? Math.min(best.proposed, s.entry) : Math.max(best.proposed, s.entry);
      if (long ? cap > s.stop : cap < s.stop) {
        trail = { id: s.id, symbol: s.symbol, t: candle.t, from: s.stop, to: round(cap, 8), swingT: best.sw.t, swingPrice: best.sw.price };
        s.stop = trail.to;
        s.trail.push(trail);
      }
    }
  }

  // 3. Excursions, then the stop/target test on this bar.
  const tp = s.targets[0].price;
  const favourable = long ? candle.h : candle.l, adverse = long ? candle.l : candle.h;
  s.mfeR = round(Math.max(s.mfeR ?? 0, rOf(s, favourable)));
  s.maeR = round(Math.max(s.maeR ?? 0, -rOf(s, adverse)));
  const hitStop = long ? candle.l <= s.stop : candle.h >= s.stop;
  const hitTarget = long ? candle.h >= tp : candle.l <= tp;
  if (hitStop && hitTarget) return { ...finish('lost', 'stop', s.stop, { ambiguous: true }), trail };
  if (hitStop) return { ...finish('lost', 'stop', s.stop), trail };
  if (hitTarget) return { ...finish('won', 'target', tp), trail };
  s.lastCandleT = candle.t;
  return { setup: s, resolution: null, trail };
}

export class Journal extends EventEmitter {
  /**
   * @param {object} opts
   * @param {object} opts.cfg          strategy config (journal.*, czt.stopBufferAtr, timeframes, indicators)
   * @param {string} [opts.dir]        overrides cfg.journal.dir
   * @param {object} [opts.log]        logger (info/ok/warn/error); optional
   * @param {() => number} [opts.now]  clock for cancel(); injected in tests
   * @param {object} [opts.fs]         node:fs stand-in for tests
   */
  constructor({ cfg = {}, dir, log = null, now = () => Date.now(), fs = nodeFs } = {}) {
    super();
    this.cfg = cfg;
    this.dir = resolvePath(dir ?? cfg.journal?.dir ?? 'data');
    this.log = log;
    this.now = now; // only cancel() without an explicit `t` reads the clock
    this.fs = fs;
    this.paths = Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, join(this.dir, f)]));
    this._setups = new Map();   // id → setup (open or resolved), insertion = creation order
    this._open = new Map();     // id → setup (status 'open')
  }

  _ensureDir() { this.fs.mkdirSync(this.dir, { recursive: true }); }
  _append(path, obj) { this._ensureDir(); this.fs.appendFileSync(path, JSON.stringify(obj) + '\n'); }
  _readLines(path) {
    let text;
    try { text = this.fs.readFileSync(path, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return { rows: [], malformed: 0 }; throw e; }
    const rows = []; let malformed = 0;
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try { rows.push(JSON.parse(line)); } catch { malformed++; }
    }
    return { rows, malformed };
  }

  /** Replay setups → trail → resolutions. Idempotent; returns counts. */
  load() {
    this._setups.clear(); this._open.clear();
    let malformed = 0;
    const setups = this._readLines(this.paths.setups); malformed += setups.malformed;
    for (const raw of setups.rows) {
      if (validateSetup(raw) || this._setups.has(raw.id)) { malformed++; continue; }
      const s = { ...raw, stop0: raw.stop, status: 'open', mfeR: 0, maeR: 0, trail: [] };
      this._setups.set(s.id, s); this._open.set(s.id, s);
    }
    const trail = this._readLines(this.paths.trail); malformed += trail.malformed;
    for (const mv of trail.rows) {
      const s = this._open.get(mv?.id);
      if (!s || !isNum(mv.to)) { malformed++; continue; }
      s.stop = mv.to; s.trail.push(mv);
    }
    const res = this._readLines(this.paths.resolutions); malformed += res.malformed;
    for (const r of res.rows) {
      const s = this._setups.get(r?.id);
      if (!s || !['won', 'lost', 'expired', 'cancelled'].includes(r.status)) { malformed++; continue; }
      Object.assign(s, r); this._open.delete(s.id);
    }
    const out = { setups: this._setups.size, open: this._open.size, resolved: this._setups.size - this._open.size, malformed };
    if (malformed && this.log) this.log.warn('*', `journal: skipped ${malformed} unreadable line(s) in ${this.dir}`, out);
    return out;
  }

  /** Append a Setup. Returns the stored (cloned) record, or null when the id is already journaled. Throws on a malformed setup. */
  record(setup) {
    const problem = validateSetup(setup);
    if (problem) throw new TypeError(`journal.record: ${problem}`);
    if (this._setups.has(setup.id)) return null;
    const line = structuredClone(setup);
    line.status = 'open';
    for (const k of ['resolvedAt', 'resultR', 'mfeR', 'maeR', 'trail', 'exit', 'exitPrice', 'stop0', 'ambiguous', 'lastCandleT']) delete line[k]; // creation state only
    this._append(this.paths.setups, line);
    const s = { ...line, stop0: line.stop, mfeR: 0, maeR: 0, trail: [] };
    this._setups.set(s.id, s); this._open.set(s.id, s);
    this.emit('setup', structuredClone(s));
    return structuredClone(s);
  }

  /**
   * Walk every open setup of `symbol` over one 1m candle. `swings` = structure-TF swings (optional),
   * `atr` = current ATR for the trail buffer. Returns the resolutions produced (plain objects).
   */
  resolveOpen(symbol, candle, { swings, atr } = {}) {
    if (!candle || !isNum(candle.t) || !isNum(candle.h) || !isNum(candle.l) || !isNum(candle.c)) return [];
    const out = [];
    for (const s of [...this._open.values()]) {
      if (s.symbol !== symbol) continue;
      const { setup, resolution, trail } = stepSetup(s, candle, { swings, atr, cfg: this.cfg });
      if (trail) { this._append(this.paths.trail, trail); this.emit('trail', trail); }
      this._setups.set(setup.id, setup);
      if (resolution) {
        this._append(this.paths.resolutions, resolution);
        this._open.delete(setup.id);
        out.push(resolution);
        this.emit('resolved', structuredClone(setup));
        if (this.log) this.log[resolution.resultR > 0 ? 'ok' : 'info'](symbol, `Setup ${setup.id} ${resolution.status} via ${resolution.exit} at ${resolution.exitPrice} (${resolution.resultR >= 0 ? '+' : ''}${resolution.resultR}R${resolution.ambiguous ? ', ambiguous bar' : ''})`, { id: setup.id, ...resolution });
      } else this._open.set(setup.id, setup);
    }
    return out;
  }

  /** Close an open setup without a market exit (0 R). Returns the resolution or null when not open. */
  cancel(id, { reason = 'cancelled', t } = {}) {
    const s = this._open.get(id);
    if (!s) return null;
    const resolution = { id, symbol: s.symbol, status: 'cancelled', exit: 'cancel', exitPrice: null, resolvedAt: isNum(t) ? t : this.now(), resultR: 0, mfeR: round(s.mfeR), maeR: round(s.maeR), stop: s.stop, trail: s.trail, reason };
    this._append(this.paths.resolutions, resolution);
    Object.assign(s, resolution); this._open.delete(id);
    this.emit('resolved', structuredClone(s));
    return resolution;
  }

  get(id) { const s = this._setups.get(id); return s ? structuredClone(s) : null; }
  /** Open setups (oldest first), optionally for one symbol. */
  open(symbol) { return [...this._open.values()].filter((s) => !symbol || s.symbol === symbol).map((s) => structuredClone(s)); }
  /** Newest first; `status` filters on the setup status. */
  list({ symbol, status, limit = 50 } = {}) {
    const all = [...this._setups.values()].filter((s) => (!symbol || s.symbol === symbol) && (!status || s.status === status));
    return all.slice(Math.max(0, all.length - Math.max(0, limit | 0))).reverse().map((s) => structuredClone(s));
  }
  scorecard({ symbol, by = 'trigger' } = {}) { return scorecardRows([...this._setups.values()], { by, symbol }); }
  /** Writes are synchronous; flush() exists so the server's shutdown path has one call to make. */
  flush() { return true; }
  close() { this.flush(); this.removeAllListeners(); }
}

export function createJournal(opts) { return new Journal(opts); }
