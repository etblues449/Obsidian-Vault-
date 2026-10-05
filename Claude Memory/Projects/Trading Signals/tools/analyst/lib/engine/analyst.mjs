// lib/engine/analyst.mjs — the orchestrator (SPEC.md §4.9): feeds → CandleStore → sessions / liquidity /
// structure / orderflow / czt → journal / executor bridge, emitting the SSE-shaped events the server
// forwards and holding the per-symbol state the dashboard reads through snapshot() / chartData().
//
// Per symbol, on every feed print:
//   closed 1m         → journal.resolveOpen (walk-forward, with structure-TF swings so the stop can trail
//                       behind proved auctions — source 05 §7), session, price, delta source, day roll
//   closed analysis-TF → levels (liquidity + prior-day value area + naked POCs) → sweeps → zones → structure
//                       → orderflow (absorption, CVD divergence, profile) → HTF bias → czt.evaluate.
//                       A Setup is journaled, emitted, logged in the sources' language and offered to the
//                       bridge. A qualifying setup held back by the caps is logged as a 'guard' line.
//   forming 1m        → 'candle' events coalesced to ≤ 2/s per symbol (closed prints flush at once)
// Time: NEVER Date.now() — `now` is injected (the server passes the wall clock, the backtest a clock driven
// by candle time). Every evaluation of the strategy itself uses candle time (ctx.now = trigger close).
// State is plain objects; nothing engine-side is a class instance except the CandleStore.
//
// DEVIATION (additive): snapshot symbols carry czt.rejections/blocked (the dashboard shows them as the
//   CZT note); chartData candles carry `closed`; a replay feed's 'done' event is forwarded as 'done'
//   (backtest.mjs awaits it). The 'event' emitted here covers only the analyst's own log lines — the
//   server pipes the shared logger (which also carries feed/journal/bridge lines) to SSE, so it must
//   not subscribe to both.
//
// Pro (SPEC-PRO §P6) — per symbol:
//   footprint   a FootprintBuilder (analysis TF, the symbol's tick, bucket = bucketFor(ATR)) fed by EVERY trade the
//               feed emits (Binance aggTrades, the simulator's and a replay's synthetic trades alike); on each closed
//               analysis-TF candle closeCandle() → SSE 'footprint' { symbol, tf, footprint, trapped }; ctx.footprint /
//               ctx.footprints / ctx.trapped reach czt. A Binance symbol backfills its tape at start through
//               lib/feeds/binance-trades.mjs (backward, bounded by footprint.backfillMaxRequests) and REBUILDS the
//               builder from tape + the live trades that arrived meanwhile; a truncated tape marks older candles partial.
//   book        an OrderBook created on the FIRST 'depth' event a feed emits (so only feeds that carry depth — Binance —
//               ever have one; sim / replay / delayed report `reason` instead), fed by every depth snapshot and every
//               trade (noteTrade: absorption is decided by the tape, never by qty changes); SSE 'book' { symbol, summary }
//               at most once per second per symbol; ctx.book reaches czt (condition.bookImbalance / trigger.bookAbsorption).
//   notifier    optional (lib/notify.mjs): journal 'setup' / 'resolved' → Telegram; on each closed 1m candle the daily
//               digest is sent once per London day at notify.digestAt (the notifier remembers the dayKey); feed
//               'reconnecting' / 'error' statuses → feedProblem (rate-limited by the notifier).
//   read models footprintData(id, n) · bookData(id) · proData(id) back /api/footprint, /api/book, /api/pro.
// DEVIATION (Pro, additive): the book is created lazily on the first depth snapshot rather than "per Binance symbol"
//   — the feed, not the config name, is what proves depth exists (a Binance symbol overridden onto `simulated` by
//   ANALYST_FEED must not show an empty book). A trade backfill that fails or is disabled (backfillMaxRequests 0)
//   leaves footprints building from the live stream; `footprintData().backfill` reports which. `pro.hits` are the
//   five §P5 hits of the czt result's winning side as booleans.

import { EventEmitter } from 'node:events';
import { CandleStore, TF_MS } from './candles.mjs';
import { ema, lastAtr, vwap, cvd, delta, swings as findSwings } from './indicators.mjs';
import { resolveSession, sessionsForDay, dayBounds, localParts, previousDayKey, shiftDayKey } from './sessions.mjs';
import { computeLevels, detectSweeps, levelSide } from './liquidity.mjs';
import { marketStructure, findFvgs, findOrderBlocks, htfBias } from './structure.mjs';
import { detectAbsorption, cvdDivergence, volumeProfile, profileLevels, nakedPocs } from './orderflow.mjs';
import { evaluate, gradeFor, levelLabel } from './czt.mjs';
import { FootprintBuilder, bucketFor, serializeFootprint, trappedTraders, footprintConfig } from './footprint.mjs';
import { OrderBook } from './orderbook.mjs';
import { createFeed } from '../feeds/registry.mjs';
import { fetchAggTrades } from '../feeds/binance-trades.mjs';

const CANDLE_THROTTLE_MS = 500;   // ≤ 2 forming-candle bursts per second per symbol (SPEC §4.9 / §6)
const MAX_MARKERS = 400;          // sweep / absorption / setup markers kept per symbol for the chart
const MAX_TRADES = 20000;         // fallback when history.maxTradesInMemory is absent
const BOOK_THROTTLE_MS = 1000;    // SSE 'book' at most once per second per symbol (SPEC-PRO §P6)
const PRO_FOOTPRINTS = 12;        // columns the Pro panel shows (SPEC-PRO §P7); /api/footprint?n= overrides
const BOOK_HISTORY = 60;          // /api/book history length (SPEC-PRO §P6)
const PRO_HITS = { trigger: ['footprintImbalance', 'trappedTraders', 'bookAbsorption', 'unfinishedAuction'], condition: ['bookImbalance'] };
const iso = (t) => (fin(t) ? new Date(t).toISOString().slice(0, 16) + 'Z' : '?');

const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const sideOf = (l) => l.side || levelSide(l.kind);
const fmtPrice = (x, dp) => (fin(x) ? x.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp }) : '—');

export class Analyst extends EventEmitter {
  /**
   * @param {object} opts
   * @param {object} opts.cfg          strategy config (validated by lib/config.mjs)
   * @param {object} opts.symbolsCfg   { symbols: [...], feedDefaults }
   * @param {object} [opts.log]        Logger (lib/log.mjs); optional — events still flow
   * @param {object} [opts.journal]    Journal (lib/journal.mjs); optional — setups are then kept in memory only
   * @param {object} [opts.bridge]     executor bridge with maybeSend(setup); optional
   * @param {Function} [opts.feedFactory]  (symbolCfg, globalCfg, deps) → adapter; default registry.createFeed
   * @param {Function} opts.now        injected clock (ms)
   * @param {object} [opts.timers]     { setTimeout, clearTimeout } for the candle throttle (tests inject a fake clock's)
   * @param {object} [opts.feedDeps]   passed to the feed factory (fetch, WebSocket, now, timers…); `fetch` also serves the trade backfill
   * @param {object} [opts.notifier]   lib/notify.mjs notifier (setup / resolved / digest / digestDue / feedProblem); optional
   * @param {boolean} [opts.tradeBackfill=true]  aggTrades tape backfill for Binance symbols at start (SPEC-PRO §P1)
   */
  constructor({ cfg, symbolsCfg, log = null, journal = null, bridge = null, notifier = null, feedFactory = createFeed, now = null, timers = {}, feedDeps = {}, tradeBackfill = true } = {}) {
    super();
    if (!cfg || !symbolsCfg || !Array.isArray(symbolsCfg.symbols)) throw new TypeError('Analyst needs { cfg, symbolsCfg }');
    if (typeof now !== 'function') throw new TypeError('Analyst needs an injected clock (`now: () => ms`) — the engine never reads the wall clock itself');
    this.cfg = cfg;
    this.symbolsCfg = symbolsCfg;
    this.log = log;
    this.journal = journal;
    this.bridge = bridge;
    this.notifier = notifier;
    this.tradeBackfill = tradeBackfill !== false;
    this.feedFactory = feedFactory;
    this.now = now;
    this.timers = { setTimeout: timers.setTimeout ?? globalThis.setTimeout, clearTimeout: timers.clearTimeout ?? globalThis.clearTimeout };
    this.feedDeps = { now, ...feedDeps };
    this.startedAt = null;
    this.running = false;
    this.symbols = new Map();
    for (const s of symbolsCfg.symbols) this.symbols.set(s.id, this._initSymbol(s));
    this._onResolved = (setup) => this._handleResolved(setup);
    this._onTrail = (mv) => this._handleTrail(mv);
    const quiet = (p) => { if (p && typeof p.catch === 'function') p.catch(() => {}); };
    this._onNotifySetup = (s) => quiet(this.notifier?.setup(s));
    this._onNotifyResolved = (s) => quiet(this.notifier?.resolved(s));
  }

  _initSymbol(symbolCfg) {
    const tfs = this.cfg.timeframes?.available || Object.keys(TF_MS);
    const tick = fin(symbolCfg.tick) && symbolCfg.tick > 0 ? symbolCfg.tick : Math.pow(10, -(fin(symbolCfg.dp) ? symbolCfg.dp : 2));
    return {
      id: symbolCfg.id, cfg: symbolCfg, feed: null, tick,
      fp: new FootprintBuilder({ tf: this.cfg.timeframes?.analysis ?? '5m', tick, cfg: this.cfg }), fpBucket: null, fpBackfill: null,
      book: null, bookEmitT: -Infinity, bookTimer: null, depthFrames: 0,
      store: new CandleStore({ maxPerTf: this.cfg.history?.maxCandlesPerTf ?? 3000, tfs }),
      status: { state: 'connecting', kind: symbolCfg.feed === 'binance' ? 'live' : symbolCfg.feed === 'simulated' ? 'sim' : symbolCfg.feed === 'yahoo' ? 'delayed' : symbolCfg.feed === 'replay' ? 'replay' : 'unknown', detail: null },
      price: null, lastCandleT: null, lastClosed1mT: null, deltaSource: 'proxy',
      session: null, bias: { dir: 'neutral', strength: 0, reasons: ['no data yet'] },
      atr: null, levels: [], zones: [], profile: null, prevDayProfile: null, prevDayKey: null, prevDayStart: null, nakedPocs: [],
      sweeps: [], absorption: null, divergence: null, structure: null, structSwings: [], structSwingsT: null, analysisSwings: [],
      czt: null, lastSetup: null, openSetup: null,
      setupsDayKey: null, setupsToday: 0, lastSetupT: null,
      markers: [], trades: [], tradeHead: 0,
      pendingTfs: new Set(), lastEmitT: -Infinity, flushTimer: null,
      analysedT: null,
    };
  }

  // ---- logging (through the shared logger when present; always as an 'event' on this emitter) ----
  _log(level, symbol, msg, data) {
    let ev;
    if (this.log && typeof this.log[level] === 'function') ev = this.log[level](symbol, msg, data);
    else { ev = { t: this.now(), level, symbol, msg }; if (data !== undefined) ev.data = data; }
    this.emit('event', ev);
    return ev;
  }

  // ---- lifecycle ----
  async start() {
    if (this.running) return;
    this.running = true;
    this.startedAt = this.now();
    if (this.journal) {
      if (typeof this.journal.load === 'function' && !this.journal._analystLoaded) {
        const counts = this.journal.load();
        this.journal._analystLoaded = true;
        this._log('info', '*', `Journal loaded: ${counts.setups} setups, ${counts.open} open, ${counts.resolved} resolved`, counts);
      }
      this.journal.on('resolved', this._onResolved);
      this.journal.on('trail', this._onTrail);
      if (this.notifier) { this.journal.on('setup', this._onNotifySetup); this.journal.on('resolved', this._onNotifyResolved); }
      for (const sym of this.symbols.values()) {
        const open = this.journal.open(sym.id);
        sym.openSetup = open.length ? open[open.length - 1] : null;
        const recent = this.journal.list({ symbol: sym.id, limit: 1 });
        sym.lastSetup = recent[0] ?? sym.openSetup;
        if (sym.lastSetup) { sym.lastSetupT = sym.lastSetup.t; this._countSetupsToday(sym); }
      }
    }
    const globalCfg = { cfg: this.cfg, symbolsCfg: this.symbolsCfg, log: this.log };
    await Promise.all([...this.symbols.values()].map(async (sym) => {
      let feed;
      try { feed = this.feedFactory(sym.cfg, globalCfg, this.feedDeps); }
      catch (e) { sym.status = { state: 'error', kind: sym.status.kind, detail: e.message }; this._log('error', sym.id, `Feed could not be created: ${e.message}`); this.emit('status', { symbol: sym.id, ...sym.status }); return; }
      sym.feed = feed;
      sym.status.kind = feed.kind ?? sym.status.kind;
      feed.on('history', (m) => this._safe(sym, () => this._onHistory(sym, m.candles)));
      feed.on('candle', (m) => this._safe(sym, () => this._onCandle(sym, m.candle)));
      feed.on('trade', (m) => this._onTrade(sym, m.trade));
      feed.on('depth', (m) => this._safe(sym, () => this._onDepth(sym, m.snapshot, m.source)));
      feed.on('status', (m) => this._onStatus(sym, m));
      feed.on('done', () => this.emit('done', { symbol: sym.id }));
      try { await feed.connect(); }
      catch (e) { this._onStatus(sym, { state: 'error', detail: e?.message ?? String(e) }); }
    }));
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    for (const sym of this.symbols.values()) {
      if (sym.flushTimer) { this.timers.clearTimeout(sym.flushTimer); sym.flushTimer = null; }
      if (sym.bookTimer) { this.timers.clearTimeout(sym.bookTimer); sym.bookTimer = null; }
      if (sym.feed) { try { await sym.feed.close(); } catch { /* closing */ } }
    }
    if (this.journal) {
      this.journal.off('resolved', this._onResolved);
      this.journal.off('trail', this._onTrail);
      this.journal.off('setup', this._onNotifySetup);
      this.journal.off('resolved', this._onNotifyResolved);
      if (typeof this.journal.flush === 'function') this.journal.flush();
    }
  }

  /** A feed bug must surface in the feed, not kill the process. */
  _safe(sym, fn) {
    try { fn(); }
    catch (e) { this._log('error', sym.id, `Engine error: ${e?.message ?? e}`, { stack: String(e?.stack || '').split('\n').slice(0, 4).join(' | ') }); }
  }

  // ---- feed handlers ----
  _onStatus(sym, { state, detail }) {
    const kind = sym.feed?.kind ?? sym.status.kind;
    sym.status = { state, kind, detail: detail ?? null };
    const level = state === 'error' ? 'error' : state === 'reconnecting' ? 'warn' : state === 'live' || state === 'sim' || state === 'delayed' ? 'ok' : 'info';
    this._log(level, sym.id, `Feed ${state}${detail ? ` — ${detail}` : ''}`);
    this.emit('status', { symbol: sym.id, state, kind, detail: detail ?? null });
    if (this.notifier && (state === 'error' || state === 'reconnecting')) { const p = this.notifier.feedProblem(sym.id, `feed ${state}${detail ? ` — ${detail}` : ''}`); if (p?.catch) p.catch(() => {}); }
  }

  _onTrade(sym, trade) {
    if (!trade || !fin(trade.p)) return;
    // Pro: every trade feeds the footprint (source 05 §3) and the book's executed-volume accounting (§2/§4).
    sym.fp.addTrade(trade);
    if (sym.book) sym.book.noteTrade(trade);
    const max = this.cfg.history?.maxTradesInMemory ?? MAX_TRADES;
    if (max <= 0) return;
    if (sym.trades.length < max) sym.trades.push(trade);
    else { sym.trades[sym.tradeHead] = trade; sym.tradeHead = (sym.tradeHead + 1) % max; }
  }

  /** The trade ring in chronological order. */
  _ringTrades(sym) {
    const max = this.cfg.history?.maxTradesInMemory ?? MAX_TRADES;
    return sym.trades.length < max ? sym.trades : [...sym.trades.slice(sym.tradeHead), ...sym.trades.slice(0, sym.tradeHead)];
  }

  // ---- Pro: order book (SPEC-PRO §P2 / §P6) ----
  _onDepth(sym, snapshot, source) {
    if (!snapshot || !Array.isArray(snapshot.bids) || !Array.isArray(snapshot.asks)) return;
    if (!sym.book) {
      sym.book = new OrderBook({ cfg: this.cfg, tick: sym.tick, now: this.now });
      this._log('info', sym.id, `Order book: first depth snapshot (${source ?? 'stream'}) — visible top of book, ${snapshot.bids.length}+${snapshot.asks.length} levels, not level 3`);
    }
    sym.book.applySnapshot(snapshot);
    sym.depthFrames++;
    this._queueBook(sym);
  }

  _queueBook(sym) {
    const wait = sym.bookEmitT + BOOK_THROTTLE_MS - this.now();
    if (wait <= 0) this._emitBook(sym);
    else if (!sym.bookTimer) sym.bookTimer = this.timers.setTimeout(() => { sym.bookTimer = null; this._emitBook(sym); }, wait);
  }

  _emitBook(sym) {
    if (!sym.book) return;
    sym.bookEmitT = this.now();
    this.emit('book', { symbol: sym.id, summary: sym.book.summary() });
  }

  // ---- Pro: footprint tape backfill (SPEC-PRO §P1 / §P6) ----
  _wantsTradeBackfill(sym) {
    return this.tradeBackfill && sym.cfg.feed === 'binance' && typeof sym.cfg.feedParams?.stream === 'string' && footprintConfig(this.cfg).backfillMaxRequests > 0;
  }

  async _backfillTrades(sym) {
    if (sym.fpBackfill) return; // once per start
    const fcfg = footprintConfig(this.cfg);
    const tf = this.cfg.timeframes.analysis, tfMs = TF_MS[tf];
    const pair = String(sym.cfg.feedParams.stream).toUpperCase();
    const nowMs = this.now();
    const startTime = Math.floor(nowMs / tfMs) * tfMs - fcfg.maxCandles * tfMs; // the whole footprint ring; maxRequests bounds the cost
    sym.fpBackfill = { state: 'running', startedAt: nowMs, pair, startTime };
    const relog = { info: (_, m, d) => this._log('info', sym.id, m, d), warn: (_, m, d) => this._log('warn', sym.id, m, d) };
    try {
      const trades = await fetchAggTrades({ symbol: pair, startTime, direction: 'backward', cfg: this.cfg, fetch: this.feedDeps.fetch ?? globalThis.fetch, log: relog, now: this.now, setTimeout: this.timers.setTimeout });
      if (!this.running) return;
      this._rebuildFootprints(sym, trades);
      sym.fpBackfill = { state: 'done', pair, trades: trades.length, requests: trades.requests, partial: trades.partial, coverage: trades.coverage, finishedAt: this.now() };
      this._log('info', sym.id, `Footprint tape: ${trades.length} trade(s) in ${trades.requests} request(s), ${iso(trades.coverage.from)} → ${iso(trades.coverage.to)}${trades.partial ? ' — PARTIAL: older candles are flagged partial' : ''}`, { requests: trades.requests, partial: trades.partial });
      const last = sym.fp.last();
      if (last) this.emit('footprint', { symbol: sym.id, tf, footprint: serializeFootprint(last), trapped: trappedTraders(sym.fp.recent()), rebuilt: true });
    } catch (e) {
      sym.fpBackfill = { state: 'error', pair, error: e?.message ?? String(e), finishedAt: this.now() };
      this._log('warn', sym.id, `Footprint tape backfill failed: ${e?.message ?? e} — footprints build from the live stream only`);
    }
  }

  /** Replace the builder with one built from the backfilled tape + the live trades that arrived meanwhile. */
  _rebuildFootprints(sym, trades) {
    const tf = this.cfg.timeframes.analysis, tfMs = TF_MS[tf];
    const fresh = new FootprintBuilder({ tf, tick: sym.tick, bucket: sym.fpBucket ?? undefined, cfg: this.cfg });
    for (const tr of trades) fresh.addTrade(tr);
    const to = fin(trades.coverage?.to) ? trades.coverage.to : -Infinity;
    for (const tr of this._ringTrades(sym)) if (tr.t > to) fresh.addTrade(tr);
    if (trades.partial && fin(trades.coverage?.from)) fresh.markPartialBefore(trades.coverage.from);
    const lastClosed = sym.store.lastClosed(tf);
    const first = trades.length ? trades[0].t : (sym.trades.length ? this._ringTrades(sym)[0].t : null);
    if (lastClosed && fin(first)) for (let b = fresh.bucketStart(first); b <= lastClosed.t; b += tfMs) fresh.closeCandle(b);
    sym.fp = fresh;
  }

  _onHistory(sym, candles) {
    const { count } = sym.store.applyHistory(candles || []);
    const last = sym.store.last('1m');
    if (last) { sym.price = last.c; sym.lastCandleT = last.t; sym.deltaSource = delta(last).source; }
    const lc = sym.store.lastClosed('1m');
    if (lc) { sym.lastClosed1mT = lc.t; this._onClosed1m(sym, lc, { resolve: false }); }
    this._refreshStructureSwings(sym);
    this._analyze(sym, { live: false });
    this._log('info', sym.id, `History loaded: ${count} × 1m candles${last ? ` to ${new Date(last.t).toISOString().slice(0, 16)}Z` : ''}`);
    if (this._wantsTradeBackfill(sym)) this._backfillTrades(sym); // async, bounded, never throws
    for (const tf of sym.store.tfs) if (sym.store.size(tf)) sym.pendingTfs.add(tf);
    this._flushCandles(sym, true);
    this.emit('levels', { symbol: sym.id, levels: sym.levels, zones: sym.zones, profile: sym.profile });
  }

  _onCandle(sym, raw) {
    if (!raw) return;
    let candle = raw;
    // A candle without aggressor volume gets it from the trade tape when the tape covers the minute (sim / binance).
    if ((raw.buyV == null || raw.sellV == null) && sym.trades.length) {
      const agg = this._tradeVolume(sym, raw.t);
      if (agg) candle = { ...raw, buyV: agg.buyV, sellV: agg.sellV };
    }
    const { updated, closed } = sym.store.applyCandle(candle);
    if (!updated.length) return;
    const stored = sym.store.last('1m');
    sym.price = stored.c; sym.lastCandleT = stored.t; sym.deltaSource = delta(stored).source;
    for (const tf of updated) sym.pendingTfs.add(tf);
    if (closed.includes('1m')) {
      const c1 = sym.store.lastClosed('1m');
      if (c1 && c1.t !== sym.lastClosed1mT) { sym.lastClosed1mT = c1.t; this._onClosed1m(sym, c1, { resolve: true }); }
      if (closed.includes(this.cfg.timeframes.structure)) this._refreshStructureSwings(sym);
      if (closed.includes(this.cfg.timeframes.analysis) && this._analyze(sym, { live: true })) {
        this.emit('levels', { symbol: sym.id, levels: sym.levels, zones: sym.zones, profile: sym.profile });
      }
      this._flushCandles(sym, true);
    } else this._queueCandles(sym);
  }

  /** buyV/sellV summed from the trade ring for minute `t`, or null when the tape has nothing for it. */
  _tradeVolume(sym, t) {
    let buyV = 0, sellV = 0, n = 0;
    const end = t + 60e3;
    for (const tr of sym.trades) {
      if (tr.t < t || tr.t >= end) continue;
      n++; if (tr.side === 'buy') buyV += tr.q; else sellV += tr.q;
    }
    return n ? { buyV, sellV } : null;
  }

  // ---- candle event throttle ----
  _queueCandles(sym) {
    const now = this.now();
    const wait = sym.lastEmitT + CANDLE_THROTTLE_MS - now;
    if (wait <= 0) this._flushCandles(sym);
    else if (!sym.flushTimer) sym.flushTimer = this.timers.setTimeout(() => { sym.flushTimer = null; this._flushCandles(sym); }, wait);
  }

  _flushCandles(sym, force = false) {
    if (sym.flushTimer && force) { this.timers.clearTimeout(sym.flushTimer); sym.flushTimer = null; }
    if (!sym.pendingTfs.size) return;
    const tfs = [...sym.pendingTfs]; sym.pendingTfs.clear();
    sym.lastEmitT = this.now();
    for (const tf of tfs) {
      const c = sym.store.last(tf);
      if (c) this.emit('candle', { symbol: sym.id, tf, candle: this._chartCandle(c) });
    }
  }

  // ---- per closed 1m ----
  _onClosed1m(sym, c1, { resolve }) {
    sym.session = resolveSession(c1.t + 60e3 - 1, this.cfg);
    this._rollDay(sym, sym.session.dayKey);
    if (resolve && this.journal) {
      const atr = sym.atr ?? undefined;
      // Source 05 §7 step 4 (review finding journal.mjs:156): the resolver also sees the current levels, the developing
      // profile's HVNs, a fresh CVD divergence and the analysis-TF swings so it can tighten at problem areas.
      this.journal.resolveOpen(sym.id, c1, { swings: sym.structSwings, atr, levels: sym.levels, hvn: sym.profile?.hvn ?? [], divergence: sym.divergence, analysisSwings: sym.analysisSwings });
    }
    if (resolve && this.notifier) this._maybeDigest(c1.t + 60e3);
  }

  /** SPEC-PRO §P3: the daily digest once per London day when a 1m candle closes at or after notify.digestAt. */
  _maybeDigest(closeT) {
    let due;
    try { due = this.notifier.digestDue(closeT); } catch { return; }
    if (!due?.due) return;
    let setupsToday = 0;
    for (const s of this.symbols.values()) setupsToday += s.setupsToday;
    const rows = this.journal ? this.journal.scorecard({ by: 'trigger' }) : [];
    Promise.resolve(this.notifier.digest(rows, { dayKey: due.dayKey, setupsToday, title: `Digest ${due.dayKey}` }))
      .then((r) => { if (r?.sent) this._log('ok', '*', `Telegram digest sent for ${due.dayKey} (${rows.length} trigger row(s), ${setupsToday} setup(s) today)`); else if (r?.error) this._log('warn', '*', `Telegram digest for ${due.dayKey} failed: ${r.error}`); })
      .catch(() => {});
  }

  _refreshStructureSwings(sym) {
    const tf = this.cfg.timeframes.structure;
    const cs = sym.store.closed(tf);
    sym.structSwings = cs.length ? findSwings(cs, this.cfg.indicators.swingLookback) : [];
    sym.structSwingsT = cs.length ? cs[cs.length - 1].t : null;
  }

  /** Day-keyed counters (setups per London day). */
  _rollDay(sym, dayKey) {
    if (sym.setupsDayKey === dayKey) return;
    sym.setupsDayKey = dayKey;
    sym.setupsToday = 0;
    this._countSetupsToday(sym);
  }
  _countSetupsToday(sym) {
    if (!this.journal || !sym.setupsDayKey) return;
    const { startMs, endMs } = dayBounds(sym.setupsDayKey, this.cfg);
    sym.setupsToday = this.journal.list({ symbol: sym.id, limit: 200 }).filter((s) => s.t >= startMs && s.t < endMs).length;
  }

  /** Realised loss today across all symbols, in account currency (for risk.dailyLossPct). */
  _dailyLossUsd(dayKey) {
    if (!this.journal || !dayKey) return 0;
    const { startMs, endMs } = dayBounds(dayKey, this.cfg);
    let pnl = 0;
    for (const s of this.journal.list({ limit: 500 })) {
      if (!fin(s.resultR) || !fin(s.resolvedAt) || s.resolvedAt < startMs || s.resolvedAt >= endMs) continue;
      const riskUsd = fin(s.size?.riskUsd) && s.size.riskUsd > 0 ? s.size.riskUsd : 0;
      pnl += s.resultR * riskUsd;
    }
    return pnl < 0 ? -pnl : 0;
  }

  // ---- the analysis-TF pipeline (returns true when it ran for a new closed candle) ----
  _analyze(sym, { live }) {
    const cfg = this.cfg, tf = cfg.timeframes.analysis;
    const c5 = sym.store.closed(tf);
    if (!c5.length) return false;
    const lastClosed = c5[c5.length - 1];
    if (sym.analysedT === lastClosed.t) return false; // same candle twice (history then its own close, or a replayed child)
    sym.analysedT = lastClosed.t;
    const closeT = lastClosed.t + TF_MS[tf];
    const atr = lastAtr(c5, cfg.indicators.atrPeriod);
    sym.atr = atr;
    // Pro: the footprint bucket follows the ATR (applies from the next candle); close this candle's footprint.
    if (atr > 0) { const b = bucketFor(atr, sym.tick, cfg); if (b !== sym.fpBucket) { sym.fpBucket = b; sym.fp.setBucket(b); } }
    const footprint = sym.fp.closeCandle(lastClosed.t);
    const footprints = sym.fp.recent();
    const trapped = trappedTraders(footprints);
    const book = sym.book ? sym.book.summary() : null;
    this.emit('footprint', { symbol: sym.id, tf, footprint: serializeFootprint(footprint), trapped });
    const session = resolveSession(lastClosed.t, cfg);
    if (!sym.session) { sym.session = resolveSession(closeT - 1, cfg); this._rollDay(sym, sym.session.dayKey); }

    // 1. Resting liquidity (sources 02/04) + prior-day value (source 05 §6) + naked POCs (source 05 §8).
    const liqCfg = { ...cfg.liquidity, swingLookback: cfg.indicators.swingLookback };
    const levels = computeLevels({ store: sym.store, tf, atr, sessionsCfg: cfg.sessions, liqCfg, now: closeT, prev: sym.levels, htfTf: cfg.timeframes.htf });
    const dayKey = localParts(closeT, cfg.sessions.timezone).dayKey;
    const prevDay = previousDayKey(dayKey);
    if (sym.prevDayKey !== prevDay) {
      const { startMs, endMs } = dayBounds(prevDay, cfg);
      const all1m = sym.store.get('1m');
      const dayCandles = all1m.filter((c) => c.t >= startMs && c.t < endMs && c.closed !== false);
      sym.prevDayProfile = dayCandles.length ? volumeProfile(dayCandles, { atr, bucketsAtr: cfg.orderflow.volumeProfileBucketsAtr, tick: sym.cfg.tick, valueAreaPct: cfg.orderflow.valueAreaPct }) : null;
      sym.prevDayKey = prevDay;
      sym.prevDayStart = startMs;
    }
    const extra = [];
    // Prior-day VAH/POC/VAL + LVNs as zones (source 05 §6; review finding czt.mjs:166) — LVNs closer than one zone tolerance merge.
    if (sym.prevDayProfile) extra.push(...profileLevels(sym.prevDayProfile, { t: sym.prevDayStart, tf: '1m', price: lastClosed.c, meta: { dayKey: prevDay }, lvn: true, lvnMergeTol: atr ? cfg.czt.zoneToleranceAtr * atr : 0 }));
    try { sym.nakedPocs = nakedPocs(sym.store, cfg, closeT, { atr, tick: sym.cfg.tick }); } catch { sym.nakedPocs = []; }
    extra.push(...sym.nakedPocs);
    const prevById = new Map(sym.levels.filter((l) => l.swept).map((l) => [l.id, l.swept]));
    for (const l of extra) if (prevById.has(l.id)) l.swept = { ...prevById.get(l.id) };
    const allLevels = [...levels, ...extra].sort((a, b) => b.price - a.price);
    const sweeps = detectSweeps({ candles: c5, levels: allLevels, atr, liqCfg });
    sym.levels = allLevels;
    sym.sweeps = sweeps;

    // 2. Structure (source 01: imbalance + engulf; source 04: order block) on the analysis TF; BOS/CHoCH on the structure TF.
    sym.zones = atr ? [...findFvgs(c5, atr, cfg.structure, { tf }), ...findOrderBlocks(c5, atr, cfg.structure, { tf })] : [];
    const cS = sym.store.closed(cfg.timeframes.structure);
    sym.structure = cS.length ? marketStructure(cS, sym.structSwingsT === cS[cS.length - 1].t ? sym.structSwings : findSwings(cS, cfg.indicators.swingLookback)) : null;

    // 3. Executed flow (source 05): absorption, CVD divergence, developing profile.
    sym.absorption = atr ? detectAbsorption(c5, atr, cfg) : null;
    sym.analysisSwings = c5.length > 2 * cfg.indicators.swingLookback + 1 ? findSwings(c5, cfg.indicators.swingLookback) : [];
    const div = sym.analysisSwings.length ? cvdDivergence(c5, sym.analysisSwings, cfg) : null;
    sym.divergence = div && div.age <= cfg.indicators.swingLookback + 1 ? div : null; // an old divergence is not THIS candle's trigger
    const win = c5.slice(-cfg.orderflow.volumeProfileWindowCandles);
    sym.profile = volumeProfile(win, { atr, bucketsAtr: cfg.orderflow.volumeProfileBucketsAtr, tick: sym.cfg.tick, valueAreaPct: cfg.orderflow.valueAreaPct });

    // 4. Bias (source 01: "the bias is pushing us higher").
    sym.bias = htfBias({ store: sym.store, cfg });

    // 5. Condition → Zone → Trigger.
    const openAcross = this.journal ? this.journal.open().length : [...this.symbols.values()].filter((s) => s.openSetup).length;
    const ctx = {
      symbol: sym.id, symbolCfg: sym.cfg, cfg, now: closeT, store: sym.store, atr, session, bias: sym.bias,
      levels: sym.levels, sweeps, zones: sym.zones, profile: sym.profile, prevDayProfile: sym.prevDayProfile,
      absorption: sym.absorption, divergence: sym.divergence, structure: sym.structure, lastClosed, deltaInfo: delta(lastClosed),
      footprint, footprints, trapped, book,
      limits: { setupsToday: sym.setupsToday, lastSetupT: sym.lastSetupT, openSetup: sym.openSetup, openAcrossSymbols: openAcross - (sym.openSetup ? 1 : 0), dailyLossUsd: this._dailyLossUsd(dayKey) },
    };
    const result = evaluate(ctx);
    sym.czt = result;

    // Chart markers for what the engine saw on this candle.
    for (const s of sweeps) if (s.reclaimed) this._marker(sym, { t: lastClosed.t, kind: 'sweep', side: sideOf(s.level), text: `SWEEP ${levelLabel(s.level)}` });
    if (sym.absorption) this._marker(sym, { t: lastClosed.t, kind: 'absorption', side: sym.absorption.side, text: `ABS ${sym.absorption.deltaSource === 'proxy' ? '(proxy)' : ''}`.trim() });

    if (!live) return true;
    if (result.setup) this._emitSetup(sym, result.setup);
    else if (result.blocked) this._log('guard', sym.id, `Setup held back: ${result.blocked} (${result.candidate.side} ${result.candidate.grade} ${result.candidate.score.toFixed(1)} @ ${fmtPrice(result.candidate.entry, sym.cfg.dp)})`, { id: result.candidate.id, blocked: result.blocked });
    // A near miss inside a killzone is worth a feed line; outside one the cap is the only reason and would repeat every candle.
    else if (result.trigger.hits.length && result.zone.hits.length && !result.condition.capped) this._log('info', sym.id, `${result.side} ${result.score.toFixed(1)} pts — ${result.rejections[0]}`, { hits: { condition: result.condition.hits, zone: result.zone.hits, trigger: result.trigger.hits } });
    return true;
  }

  _marker(sym, m) {
    if (sym.markers.length && sym.markers[sym.markers.length - 1].t === m.t && sym.markers[sym.markers.length - 1].kind === m.kind) return;
    sym.markers.push(m);
    if (sym.markers.length > MAX_MARKERS) sym.markers.splice(0, sym.markers.length - MAX_MARKERS);
  }

  _emitSetup(sym, setup) {
    let stored = setup;
    if (this.journal) {
      stored = this.journal.record(setup);
      if (!stored) return; // already journaled (restart replayed the same candle)
    }
    sym.lastSetup = stored; sym.openSetup = stored; sym.lastSetupT = stored.t; sym.setupsToday++;
    if (!this.journal) this._onNotifySetup(stored); // with a journal the notifier rides its 'setup' event
    this._marker(sym, { t: stored.t, kind: 'setup', side: stored.side, text: `${stored.side.toUpperCase()} ${stored.grade}`, grade: stored.grade });
    const dp = sym.cfg.dp;
    this._log('signal', sym.id, `${stored.side.toUpperCase()} ${stored.grade} (${stored.score.toFixed(1)}) ${stored.tf} @ ${fmtPrice(stored.entry, dp)} · stop ${fmtPrice(stored.stop, dp)} · T1 ${fmtPrice(stored.targets[0].price, dp)} (${stored.rr.toFixed(2)} R) · ${stored.trigger.kind}`, { id: stored.id, reasons: stored.reasons, invalidation: stored.invalidation, size: stored.size });
    if (stored.size && !(stored.size.units > 0)) this._log('guard', sym.id, `Size refused: ${stored.size.reason}`, { id: stored.id });
    this.emit('setup', stored);
    if (this.bridge && typeof this.bridge.maybeSend === 'function') {
      Promise.resolve().then(() => this.bridge.maybeSend(stored)).then((r) => { if (r && r.sent) this.emit('bridge', { id: stored.id, ...r }); }).catch((e) => this._log('warn', sym.id, `Bridge error: ${e?.message ?? e}`));
    }
  }

  _handleResolved(setup) {
    const sym = this.symbols.get(setup.symbol);
    if (!sym) return;
    if (sym.openSetup && sym.openSetup.id === setup.id) sym.openSetup = null;
    sym.lastSetup = setup;
    this._marker(sym, { t: setup.resolvedAt ?? setup.t, kind: 'setup', side: setup.side, text: `${setup.status.toUpperCase()} ${fin(setup.resultR) ? (setup.resultR > 0 ? '+' : '') + setup.resultR.toFixed(2) + 'R' : ''}`.trim(), grade: setup.grade });
    this.emit('setup', setup);
  }

  _handleTrail(mv) {
    const sym = this.symbols.get(mv.symbol);
    if (!sym) return;
    if (sym.openSetup && sym.openSetup.id === mv.id) { sym.openSetup = { ...sym.openSetup, stop: mv.to, trail: [...(sym.openSetup.trail || []), mv] }; this.emit('setup', sym.openSetup); }
    this._log('info', sym.id, `Stop trailed to ${fmtPrice(mv.to, sym.cfg.dp)} behind the ${mv.swingPrice != null ? `swing at ${fmtPrice(mv.swingPrice, sym.cfg.dp)}` : 'proved auction'} (${mv.id})`, mv);
  }

  // ---- read models ----
  _chartCandle(c) { return { t: c.t, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v, delta: delta(c).value, closed: c.closed !== false }; }

  _change(sym) {
    const all = sym.store.get('1m');
    if (!all.length || !fin(sym.price)) return { abs: null, pct: null, windowLabel: null };
    let ref = null, label;
    if (sym.session?.dayKey) {
      const { startMs } = dayBounds(sym.session.dayKey, this.cfg);
      ref = all.find((c) => c.t >= startMs) ?? null;
      label = 'today';
    }
    if (!ref || ref === all[all.length - 1]) { ref = all[0]; const h = Math.round((all[all.length - 1].t - ref.t) / 36e5); label = h >= 1 ? `${h}h` : 'session'; }
    const abs = sym.price - ref.o;
    return { abs, pct: ref.o ? (abs / ref.o) * 100 : null, windowLabel: label };
  }

  _cztView(sym) {
    const r = sym.czt, W = this.cfg.czt.weights || {};
    const layer = (name) => { const hits = r?.[name]?.hits ?? []; return { hits, score: hits.reduce((a, k) => a + (W[`${name}.${k}`] ?? 0), 0) }; };
    const score = r?.score ?? 0;
    return {
      condition: layer('condition'), zone: layer('zone'), trigger: layer('trigger'),
      score, grade: r && score >= (this.cfg.czt.minScore ?? 6) ? gradeFor(score, this.cfg.czt) : null, side: r?.side ?? null,
      rejections: r?.rejections ?? [], blocked: r?.blocked ?? null,
    };
  }

  /** Watchlist + CZT panel read model. With `symbolId`, the symbols array holds just that one. */
  snapshot(symbolId) {
    const now = this.now();
    const list = symbolId ? [this.symbols.get(symbolId)].filter(Boolean) : [...this.symbols.values()];
    const setupsToday = {};
    for (const s of this.symbols.values()) setupsToday[s.id] = s.setupsToday;
    return {
      t: now, uptimeMs: this.startedAt === null ? 0 : now - this.startedAt,
      symbols: list.map((s) => ({
        id: s.id, name: s.cfg.name, dp: s.cfg.dp,
        feed: { state: s.status.state, kind: s.status.kind, sourceNote: s.cfg.sourceNote ?? null, detail: s.status.detail ?? null, feedOriginal: s.cfg.feedOriginal ?? null },
        price: s.price, change: this._change(s),
        session: s.session ?? resolveSession(now, this.cfg), bias: s.bias, czt: this._cztView(s),
        lastSetup: s.lastSetup, openSetup: s.openSetup, lastCandleT: s.lastCandleT, atr: s.atr, deltaSource: s.deltaSource,
        pro: { footprints: s.fp.size, bucket: s.fpBucket, partial: s.fpBackfill?.state === 'running' || s.fp.recent(PRO_FOOTPRINTS).some((f) => f.partial), book: !!s.book, depthFrames: s.depthFrames, hits: this._proHits(s) },
      })),
      limits: { setupsToday, openCount: this.journal ? this.journal.open().length : [...this.symbols.values()].filter((s) => s.openSetup).length },
      notifier: this.notifier ? { enabled: !!this.notifier.enabled } : null,
    };
  }

  // ---- Pro read models (SPEC-PRO §P6 routes) ----
  _sym(symbolId) {
    const sym = this.symbols.get(symbolId);
    if (!sym) throw new RangeError(`unknown symbol ${JSON.stringify(symbolId)}`);
    return sym;
  }

  /** The five §P5 hits of the last czt evaluation's winning side, as booleans. */
  _proHits(sym) {
    const r = sym.czt;
    const out = {};
    for (const [layer, keys] of Object.entries(PRO_HITS)) for (const k of keys) out[k] = !!r?.[layer]?.hits?.includes(k);
    return out;
  }

  _bookReason(sym) {
    const kind = sym.status.kind;
    if (kind === 'live') return sym.depthFrames ? null : 'No depth snapshot yet — waiting for the first order-book frame';
    return `No order book for this feed (${kind}) — the visible top of book exists only on Binance live symbols`;
  }

  /** GET /api/footprint/:symbol?n= → { symbol, tf, bucket, tick, partial, footprints, current, backfill }. */
  footprintData(symbolId, n = PRO_FOOTPRINTS) {
    const sym = this._sym(symbolId);
    const k = Math.max(1, Math.min(footprintConfig(this.cfg).maxCandles, n | 0 || PRO_FOOTPRINTS));
    const footprints = sym.fp.recent(k).map(serializeFootprint);
    const running = sym.fpBackfill?.state === 'running';
    return {
      symbol: sym.id, tf: sym.fp.tf, bucket: sym.fp.bucket, tick: sym.tick,
      partial: running || footprints.some((f) => f.partial), footprints,
      current: serializeFootprint(sym.fp.current()), backfill: sym.fpBackfill, dropped: sym.fp.dropped,
    };
  }

  /** GET /api/book/:symbol → { symbol, summary, history } or { symbol, summary: null, history: [], reason }. */
  bookData(symbolId, n = BOOK_HISTORY) {
    const sym = this._sym(symbolId);
    if (!sym.book) return { symbol: sym.id, summary: null, history: [], reason: this._bookReason(sym) };
    return { symbol: sym.id, summary: sym.book.summary(), history: sym.book.history(Math.max(1, Math.min(600, n | 0 || BOOK_HISTORY))), frames: sym.depthFrames };
  }

  /** GET /api/pro/:symbol → footprint + book + trapped traders + the czt Pro hits, in one call (shape pro.js reads). */
  proData(symbolId, n = PRO_FOOTPRINTS) {
    const sym = this._sym(symbolId);
    const fp = this.footprintData(symbolId, n);
    const { symbol, ...book } = this.bookData(symbolId);
    return { symbol, tf: fp.tf, bucket: fp.bucket, tick: fp.tick, partial: fp.partial, footprints: fp.footprints, current: fp.current, backfill: fp.backfill, book, trapped: trappedTraders(sym.fp.recent()), hits: this._proHits(sym), feed: { state: sym.status.state, kind: sym.status.kind } };
  }

  /** Session-open indexes (VWAP / CVD anchors) and LDN / NY markers for a candle series. */
  _sessionAnchors(candles) {
    const resets = new Set(), markers = [];
    if (!candles.length) return { resets, markers };
    const tz = this.cfg.sessions.timezone;
    let dayKey = localParts(candles[0].t, tz).dayKey;
    const lastDay = localParts(candles[candles.length - 1].t, tz).dayKey;
    const starts = [];
    for (let guard = 0; guard < 400; guard++) {
      for (const s of sessionsForDay(dayKey, this.cfg)) starts.push(s);
      if (dayKey === lastDay) break;
      dayKey = shiftDayKey(dayKey, 1);
    }
    let i = 0;
    for (const s of starts.sort((a, b) => a.startMs - b.startMs)) {
      while (i < candles.length && candles[i].t < s.startMs) i++;
      if (i >= candles.length) break;
      // Review finding analyst.mjs:468: a session that opened before the first candle has no bar to mark; an open that is
      // not bar-aligned (07:00 on a 4h chart) belongs to the bar CONTAINING it — the previous one — not the next bar.
      if (i === 0 && candles[0].t > s.startMs) continue;
      const j = candles[i].t > s.startMs ? i - 1 : i;
      if (j > 0) resets.add(j);
      if (s.id === 'london' || s.id === 'ny') markers.push({ t: candles[j].t, kind: 'session', text: s.id === 'london' ? 'LDN' : 'NY', side: null });
      else if (s.id === 'asia' && j > 0) markers.push({ t: candles[j].t, kind: 'session', text: 'ASIA', side: null });
    }
    return { resets, markers };
  }

  /** Chart read model: candles + indicators + levels/zones/markers for one symbol and TF. */
  chartData(symbolId, tf = this.cfg.timeframes.analysis, limit = 500) {
    const sym = this.symbols.get(symbolId);
    if (!sym) throw new RangeError(`unknown symbol ${JSON.stringify(symbolId)}`);
    if (!TF_MS[tf] || !sym.store.tfs.includes(tf)) throw new RangeError(`unknown timeframe ${JSON.stringify(tf)}`);
    const n = Math.max(1, Math.min(5000, limit | 0));
    const all = sym.store.get(tf);
    const closes = all.map((c) => c.c);
    const ind = this.cfg.indicators;
    const { resets, markers: sessionMarkers } = this._sessionAnchors(all);
    const series = {
      ema9: ema(closes, ind.emaFast), ema21: ema(closes, ind.emaSlow), ema50: ema(closes, ind.emaBias),
      vwap: vwap(all, ind.vwapSessionReset ? { resetAt: (c, i) => resets.has(i) } : {}),
      cvd: cvd(all, ind.vwapSessionReset ? { resetAtIndexes: resets } : {}),
    };
    const from = Math.max(0, all.length - n);
    const pts = (arr) => { const out = []; for (let i = from; i < all.length; i++) if (fin(arr[i])) out.push({ t: all[i].t, v: arr[i] }); return out; };
    const candles = all.slice(from).map((c) => this._chartCandle(c));
    const firstT = candles.length ? candles[0].t : Infinity;
    const markers = [...sym.markers.filter((m) => m.t >= firstT), ...sessionMarkers.filter((m) => m.t >= firstT)].sort((a, b) => a.t - b.t);
    return {
      symbol: sym.id, tf, dp: sym.cfg.dp, candles,
      ema9: pts(series.ema9), ema21: pts(series.ema21), ema50: pts(series.ema50), vwap: pts(series.vwap), cvd: pts(series.cvd),
      levels: sym.levels, zones: sym.zones, markers, profile: sym.profile,
      session: sym.session ?? resolveSession(this.now(), this.cfg),
      setups: this.journal ? this.journal.list({ symbol: sym.id, limit: 50 }) : [sym.lastSetup].filter(Boolean),
    };
  }
}

export function createAnalyst(opts) { return new Analyst(opts); }
