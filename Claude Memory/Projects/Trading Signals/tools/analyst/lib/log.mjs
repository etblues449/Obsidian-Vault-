// Structured logger + ring buffer — the "execution feed" (SPEC.md §1, §2 Event, §6 /api/feed).
//
// Every line is an Event = { t, level, symbol, msg, data? } (plain object). Events are
//   1. kept in a bounded ring buffer (newest-first reads for the dashboard feed),
//   2. emitted on the logger ('event') so server.mjs can pipe them to SSE,
//   3. written to a stream as text or JSON lines.
// `now` is injectable so tests are deterministic. Secrets never reach a line: any data key that
// looks like a credential is redacted before the event is stored or printed.
//
// DEVIATION: SPEC.md names this module but defines no API. Contract chosen here:
//   createLogger({capacity, now, stream, level, json}) → Logger with info/ok/warn/signal/guard/error(symbol, msg, data?),
//   child(symbol), recent(limit, {symbol, level, minLevel, since}) newest-first, and an 'event' EventEmitter signal.
//   A 'debug' level exists below the §2 enum for development; it is printed when enabled but never stored in the feed.

import { EventEmitter } from 'node:events';

/** Severity order used for the output threshold. 'debug' is below the SPEC enum and is never stored in the feed. */
export const LEVELS = ['debug', 'info', 'ok', 'signal', 'guard', 'warn', 'error'];
const RANK = Object.fromEntries(LEVELS.map((l, i) => [l, i]));
const SECRET_KEY = /secret|token|password|passwd|apikey|api_key|authorization|cookie|private/i;

/** Fixed-capacity FIFO with O(1) push. Also used for the in-memory trade buffer (`history.maxTradesInMemory`). */
export class RingBuffer {
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError(`RingBuffer capacity must be a positive integer, got ${capacity}`);
    this.capacity = capacity;
    this._buf = new Array(capacity);
    this._head = 0; // index of the next write
    this.size = 0;
  }
  push(item) {
    this._buf[this._head] = item;
    this._head = (this._head + 1) % this.capacity;
    if (this.size < this.capacity) this.size++;
    return this;
  }
  /** Oldest → newest. */
  toArray() {
    const out = new Array(this.size);
    const start = (this._head - this.size + this.capacity) % this.capacity;
    for (let i = 0; i < this.size; i++) out[i] = this._buf[(start + i) % this.capacity];
    return out;
  }
  /** Newest → oldest, optionally filtered, at most `limit`. Filtering happens before the limit. */
  recent(limit = this.size, pred = null) {
    const out = [];
    for (let i = 1; i <= this.size && out.length < limit; i++) {
      const item = this._buf[(this._head - i + this.capacity) % this.capacity];
      if (!pred || pred(item)) out.push(item);
    }
    return out;
  }
  last() { return this.size ? this._buf[(this._head - 1 + this.capacity) % this.capacity] : undefined; }
  clear() { this._buf = new Array(this.capacity); this._head = 0; this.size = 0; }
}

/** Deep-ish copy of `data` with credential-looking keys replaced, Errors flattened, cycles cut. */
export function redact(data, depth = 0, seen = new WeakSet()) {
  if (data == null || typeof data !== 'object') return data;
  if (data instanceof Error) return { name: data.name, message: data.message, ...(data.code ? { code: data.code } : {}) };
  if (seen.has(data) || depth > 6) return '[circular]';
  seen.add(data);
  if (Array.isArray(data)) return data.map((v) => redact(v, depth + 1, seen));
  const out = {};
  for (const [k, v] of Object.entries(data)) out[k] = SECRET_KEY.test(k) ? '[redacted]' : redact(v, depth + 1, seen);
  return out;
}

function fmtTime(t) {
  const d = new Date(t);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`;
}

export class Logger extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {number}   [opts.capacity=2000]  ring-buffer size (feed depth)
   * @param {() => number} [opts.now]        clock; injected in tests
   * @param {{write(s:string):any}|null} [opts.stream=process.stderr]  null = silent (buffer + events only)
   * @param {string}   [opts.level='info']   minimum level written to the stream (the buffer always keeps info+)
   * @param {boolean}  [opts.json=false]     JSON lines instead of text
   * @param {string}   [opts.symbol='*']     default symbol tag for this logger (see child())
   */
  constructor(opts = {}) {
    super();
    const { capacity = 2000, now = () => Date.now(), stream = process.stderr, level = 'info', json = false, symbol = '*', buffer = null, parent = null } = opts;
    if (!(level in RANK)) throw new RangeError(`unknown log level '${level}' (expected one of ${LEVELS.join(', ')})`);
    this.now = now;
    this.stream = stream;
    this.threshold = RANK[level];
    this.json = json;
    this.symbol = symbol;
    this.buffer = buffer || new RingBuffer(capacity);
    this._parent = parent;
  }

  /**
   * Core write. Returns the Event (plain object) so callers can forward it.
   * Accepts (level, symbol, msg, data?) or, with the symbol omitted, (level, msg, data?) — the
   * symbol is omitted when `msg` is missing or is the data object (i.e. not a string).
   */
  log(level, symbol, msg, data) {
    if (!(level in RANK)) level = 'info';
    if (msg === undefined || (typeof msg === 'object' && data === undefined)) { data = msg; msg = symbol; symbol = this.symbol; }
    const ev = { t: this.now(), level, symbol: symbol ?? this.symbol, msg: String(msg) };
    if (data !== undefined) ev.data = redact(data);
    if (RANK[level] >= RANK.info) this.buffer.push(ev);
    if (this.stream && RANK[level] >= this.threshold) {
      try {
        this.stream.write(this.json
          ? JSON.stringify(ev) + '\n'
          : `${fmtTime(ev.t)} ${level.toUpperCase().padEnd(6)} [${ev.symbol}] ${ev.msg}${ev.data !== undefined ? ' ' + JSON.stringify(ev.data) : ''}\n`);
      } catch { /* a dead stream must never take the engine down */ }
    }
    (this._parent || this).emit('event', ev);
    return ev;
  }

  debug(symbol, msg, data) { return this.log('debug', symbol, msg, data); }
  info(symbol, msg, data) { return this.log('info', symbol, msg, data); }
  ok(symbol, msg, data) { return this.log('ok', symbol, msg, data); }
  signal(symbol, msg, data) { return this.log('signal', symbol, msg, data); }
  guard(symbol, msg, data) { return this.log('guard', symbol, msg, data); }
  warn(symbol, msg, data) { return this.log('warn', symbol, msg, data); }
  error(symbol, msg, data) { return this.log('error', symbol, msg, data); }

  /** A logger bound to one symbol, sharing this buffer and emitting through this logger's 'event'. */
  child(symbol) {
    return new Logger({ now: this.now, stream: this.stream, level: LEVELS[this.threshold], json: this.json, symbol, buffer: this.buffer, parent: this._parent || this });
  }

  /**
   * Feed read: newest first. `filter` = { symbol?, level?, minLevel?, since? (ms, exclusive) }.
   * @returns {object[]} Events
   */
  recent(limit = 200, filter = {}) {
    const { symbol, level, minLevel, since } = filter;
    const minRank = minLevel ? RANK[minLevel] ?? 0 : 0;
    return this.buffer.recent(Math.max(0, limit | 0), (ev) =>
      (!symbol || ev.symbol === symbol || ev.symbol === '*') &&
      (!level || ev.level === level) &&
      RANK[ev.level] >= minRank &&
      (since === undefined || ev.t > since));
  }
}

export function createLogger(opts) { return new Logger(opts); }
