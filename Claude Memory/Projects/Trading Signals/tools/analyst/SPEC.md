# TradeGuard Analyst — Build Specification

**Status:** authoritative interface contract. Every module is built against this file; if a
builder needs to deviate, the deviation is documented in the module header and in §9.

Target: Node ≥ 22, ESM (`.mjs`), **zero npm dependencies** (native `WebSocket`, `fetch`,
`node:http`, `node:test`). Runs on the Fold 8 Ultra in Termux and on a Windows PC. Serves a
phone-first dashboard on `http://127.0.0.1:8080`. Nothing here places orders.

## 0. What it is

An autonomous analysis engine. It ingests live 1-minute candles and aggressor-tagged trades,
maintains multi-timeframe state, runs five layers of analysis on every candle close, and emits
**Setups** (side, entry, stop, targets, score, reasons) through a **Condition → Zone → Trigger**
gate. Every setup is journaled and resolved walk-forward against real prices so the scorecard
(by symbol, by trigger type) tells you which confluences are actually working — "the best fit".

Strategy sources (verbatim, in `docs/sources/`):

1. **Manipulation low entry** — sweep below prior low inside an imbalance within a bullish run,
   engulf the prior 4H candle → entry at close or on an LTF imbalance retest; **stop at the
   manipulation low, non-negotiable**.
2. **Liquidity + sessions** — liquidity rests at previous highs/lows and around consolidation;
   wait for London/NY to sweep it, then target the next pool. Purge in London → entry in NY.
3. **Session cycle** — Asia = consolidation, London = manipulation, NY = distribution/expansion,
   then retracement. Time dictates the move.
4. **Liquidity fundamentals** — equal highs/lows are liquidity; buy-side taken → target sell-side
   and vice-versa; enter at the order block after the sweep.
5. **Order flow (Rogers)** — executed vs resting flow; delta, CVD, divergence = absorption;
   footprint imbalances; volume profile (POC/VAH/VAL, LVN/HVN, P/b/D shapes); **CZT**
   framework; invalidation stops; no fixed TP — trail behind proved auctions; tighten at
   problem areas.

## 1. Layout

```
analyst/
  package.json            zero deps; scripts: start, test, check, backtest, report
  SPEC.md                 this file
  README.md               runbook (Termux + Windows), architecture, extension guide
  server.mjs              HTTP + SSE + static; composes Analyst + feeds
  backtest.mjs            CLI: replay real history through the engine, print scorecard
  config/symbols.json     the four charts (feed adapter per symbol)
  config/strategy.json    every threshold and weight
  lib/config.mjs          load + validate both configs; env overrides
  lib/log.mjs             structured logger + ring buffer (the "execution feed")
  lib/feeds/base.mjs      FeedAdapter contract (written)
  lib/feeds/registry.mjs  name → adapter class
  lib/feeds/binance.mjs   REST backfill + combined WS (kline_1m + aggTrade), reconnect
  lib/feeds/simulated.mjs honest random walk, emits candles AND synthetic trades
  lib/feeds/yahoo.mjs     opt-in delayed poller (NQ=F, CL=F, GC=F); degrades to 'error' status
  lib/feeds/replay.mjs    feed from an in-memory candle array (backtests, tests)
  lib/engine/candles.mjs  CandleStore: ring buffers per TF, 1m → 5m/15m/1h/4h aggregation
  lib/engine/indicators.mjs EMA, ATR, VWAP, swings, delta/CVD, rolling stats
  lib/engine/sessions.mjs session + killzone resolution for a timestamp (DST-aware)
  lib/engine/liquidity.mjs levels (PDH/PDL, session H/L, equal H/L, consolidation), sweeps
  lib/engine/structure.mjs swings, BOS/CHoCH, FVG, order blocks, engulfing, HTF bias
  lib/engine/orderflow.mjs per-candle delta, CVD + divergence, absorption, volume profile
  lib/engine/czt.mjs      Condition → Zone → Trigger scoring; Setup construction
  lib/engine/risk.mjs     sizing, R:R, per-day/open caps
  lib/engine/analyst.mjs  orchestrator: feeds → store → modules → events; per-symbol state
  lib/journal.mjs         setups.jsonl / resolutions.jsonl, walk-forward resolver, scorecard
  lib/executor-bridge.mjs opt-in POST to the executor webhook (XAUUSD, grade A)
  public/index.html, app.css, app.js   dashboard (light default, dark toggle)
  public/vendor/lightweight-charts.standalone.production.js  v5.0.8 (vendored, offline)
  scripts/check.mjs       preflight: node version, config, reachability, port
  scripts/report.mjs      prints a markdown scorecard/digest to stdout and data/reports/
  scripts/termux-boot-analyst.sh   Termux:Boot launcher (copy to ~/.termux/boot/)
  scripts/install-termux.sh        one-shot phone install
  test/*.test.mjs         node:test — one file per module + server + e2e
  data/                   runtime journal (git-ignored)
```

## 2. Shared data shapes (plain objects; no classes cross module boundaries)

```js
Candle  = { t, o, h, l, c, v, buyV?, sellV?, n?, closed }         // t = open time ms UTC
Trade   = { t, p, q, side: 'buy'|'sell' }                          // side = aggressor
TF      = '1m'|'5m'|'15m'|'1h'|'4h'                                // TF_MS in candles.mjs
Swing   = { t, price, kind: 'high'|'low', index }                  // index into the TF array at detection time
Level   = { id, kind, price, t, tf, side: 'buy-side'|'sell-side', meta? , swept?: {t, depth} }
          // kind ∈ 'pdh'|'pdl'|'sessionHigh'|'sessionLow'|'asiaHigh'|'asiaLow'|'equalHighs'|
          //        'equalLows'|'consolidationHigh'|'consolidationLow'|'poc'|'vah'|'val'|'nakedPoc'
          // side: buy-side liquidity sits ABOVE price (highs), sell-side BELOW (lows)
Sweep   = { t, level: Level, depth, depthAtr, reclaimed: boolean, candle: Candle }
Zone    = { id, kind: 'fvg'|'orderBlock', side: 'bullish'|'bearish', top, bottom, t, tf, mitigated: boolean }
Bias    = { dir: 'bullish'|'bearish'|'neutral', strength: 0..1, reasons: string[] }
Session = { id, label, role, start, end, killzone: boolean, dayKey: 'YYYY-MM-DD' }
Profile = { poc, vah, val, hvn: number[], lvn: number[], shape: 'P'|'b'|'D'|'thin', buckets: [{price, vol}] }
Setup   = {
  id, symbol, t, tf, side: 'long'|'short',
  entry, stop, targets: [{price, label, rr}], rr,           // rr = to targets[0]
  score, grade: 'A'|'B'|'C',
  condition: { bias: Bias, session: Session, valueRelation: 'inside'|'above'|'below', hits: string[] },
  zone:      { level?: Level, zone?: Zone, hits: string[] },
  trigger:   { kind: string, sweep?: Sweep, hits: string[] },
  reasons: string[],                                         // human lines for the feed
  invalidation: string,                                      // "close below 85,120 (manipulation low)"
  size: { units, lots?, riskUsd, riskPct },
  status: 'open'|'won'|'lost'|'expired'|'cancelled', resolvedAt?, resultR?, mfeR?, maeR?
}
Event (SSE + feed) = { t, level: 'info'|'ok'|'warn'|'signal'|'guard'|'error', symbol, msg, data? }
```

## 3. Feeds (`lib/feeds/*`)

- `registry.mjs`: `export const FEEDS = { binance, simulated, yahoo, replay }` and
  `export function createFeed(symbolCfg, globalCfg, deps)` → adapter instance. `deps` lets tests
  inject `{ fetch, WebSocket, now, setTimeout, clearTimeout, setInterval, clearInterval }`.
- **binance.mjs** — `kind='live'`.
  - Backfill: `GET https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=1000`
    paginated with `endTime` until `history.backfillMinutes` covered (≤ 3 requests). Row →
    `{t:k[0], o:+k[1], h:+k[2], l:+k[3], c:+k[4], v:+k[5], n:k[8], closed:true}`; also derive
    `buyV = +k[9]` (taker buy base volume), `sellV = v - buyV`.
  - Stream: ONE combined socket per adapter:
    `wss://data-stream.binance.vision/stream?streams=<s>@kline_1m/<s>@aggTrade`.
    Message `{stream, data}`; kline → candle (`k.x` = closed, `k.V` = taker buy base vol → buyV);
    aggTrade → `{t:T, p:+p, q:+q, side: m ? 'sell' : 'buy'}` (m = buyer is maker ⇒ seller aggressed).
  - Reconnect on close/error with `backoffMs(attempt)` + jitter, attempt reset on a clean 60s;
    heartbeat watchdog: no message for 90 s → terminate + reconnect. Binance closes sockets at 24 h
    — handle as a normal reconnect. After reconnect, re-backfill the gap (`startTime` = last closed t).
  - Status: connecting → live; reconnecting on drop; error (with detail) after 10 consecutive
    failures but keep trying forever (cap 60 s).
  - Rate limits: never more than 1 REST call/s; a 429/418 → wait `Retry-After` or 60 s.
- **simulated.mjs** — `kind='sim'`. Seeded (xorshift) GBM random walk at 1 s ticks; emits
  `trade` events (side by sign of tick) and the forming candle; closes candles on minute
  boundaries; backfills `backfillMinutes` of synthetic history on connect. Must be deterministic
  under injected `now`/timers for tests. Status `sim` immediately. Honest labelling is the point.
- **yahoo.mjs** — `kind='delayed'`. Polls `https://query1.finance.yahoo.com/v8/finance/chart/<sym>?interval=1m&range=1d`
  every `pollSeconds`; parses `chart.result[0].timestamp` + `indicators.quote[0]`; emits
  closed candles for new timestamps and a 'delayed' status. On 429/5xx/parse failure → status
  'error' with detail and keep polling at 5× interval. No trades (delta falls back to proxy).
- **replay.mjs** — `kind='replay'`. Constructed with `{candles, trades?, speed?}`; emits history
  (all but the last N) then plays the rest as forming→closed candles synchronously or on timers.

## 4. Engine

### 4.1 `candles.mjs`
`export const TF_MS = {'1m':60e3,'5m':3e5,'15m':9e5,'1h':36e5,'4h':144e5}`.
`class CandleStore { constructor({maxPerTf}) ; applyHistory(candles1m) ; applyCandle(c1m) → {updated: TF[], closed: TF[]} ; get(tf, n?) → Candle[] (oldest→newest, last may be forming) ; last(tf) ; closed(tf, n?) }`.
Aggregation: bucket = `Math.floor(t / TF_MS[tf]) * TF_MS[tf]` (UTC-aligned; 4h buckets at 00/04/08…).
Sum `v`, `buyV`, `sellV`, `n`. A higher-TF candle is `closed` when its last 1m child closed and
the next bucket started. Memory bounded by `maxPerTf` (drop oldest).

### 4.2 `indicators.mjs` (pure functions over arrays; no state)
`ema(values, period)` → array (null until warm) · `atr(candles, period)` (Wilder) · `vwap(candles, {resetAt?})` ·
`swings(candles, lookback)` → Swing[] (a high is a swing high when it exceeds `lookback` candles each side) ·
`delta(c)` → `buyV-sellV` if present else proxy `((c.c-c.o)/(c.h-c.l||1))*c.v` with `source:'proxy'` ·
`cvd(candles, {resetAtIndexes?})` · `rollingMean(values, n)` · `bodyAtr(c, atr)` · `wickRatios(c)` → `{upper, lower}` of range.

### 4.3 `sessions.mjs`
`resolveSession(tMs, cfg)` → Session (uses `Intl.DateTimeFormat` with `timeZone` to get local
HH:MM and the local date → `dayKey`). `sessionBounds(dayKey, sessionId, cfg)` → `{startMs, endMs}`.
`isKillzone(tMs, cfg)`. `previousSessionRange(candles1m, tMs, sessionId, cfg)` → `{high, low, t}`.
`dayRange(candles1m, dayKey, cfg)` → `{high, low}` (for PDH/PDL use the previous `dayKey`).
Must be correct across the BST↔GMT change (test with 2026-03-29 and 2026-10-25).

### 4.4 `liquidity.mjs`
`computeLevels({store, tf, atr, sessionsCfg, liqCfg, now})` → Level[]: PDH/PDL, previous session
high/low, Asia range H/L, equal highs/lows (two+ swings within `equalLevelToleranceAtr`), consolidation
range H/L (last `consolidationCandles` whose total range ≤ `consolidationMaxRangeAtr`). Expire after
`levelExpiryHours`. `detectSweeps({candles, levels, atr, liqCfg})` → Sweep[] for the LAST closed
candle: wick beyond level by depth ∈ [min,max] ATR, `reclaimed` = close back on the original side.
Mark `level.swept`.

### 4.5 `structure.mjs`
`findSwings` (re-export) · `marketStructure(candles, swings)` → `{trend, lastBos?, lastChoch?}` (BOS =
close beyond the last swing in trend direction; CHoCH = close beyond the last counter swing) ·
`findFvgs(candles, atr, cfg)` → Zone[] (bullish: `c[i-2].h < c[i].l`; size ≥ min) · `findOrderBlocks(candles, atr, cfg)` →
Zone[] (last opposite-coloured candle before a displacement body ≥ `displacementBodyAtr` that
leaves an FVG; `mitigated` when price trades back through) · `isEngulfing(prev, cur, atr, cfg)` ·
`htfBias({store, cfg})` → Bias from `bias` TF (EMA50 slope + EMA9/21 relation) and `htf` structure.

### 4.6 `orderflow.mjs`
`candleDelta(c)` (via indicators) · `cvdSeries(candles)` · `cvdDivergence(candles, swings, cfg)` →
`{kind:'bearish'|'bullish', t, priceSwing, cvdSwing}|null` (price HH while CVD LH ⇒ bearish; price LL while CVD HL ⇒ bullish) ·
`detectAbsorption(candles, atr, cfg)` → `{side:'bullish'|'bearish', t, vol, range, delta}|null` for the last closed candle:
vol ≥ `absorptionVolumeMult`×mean(20), range ≤ `absorptionMaxRangeAtr`×ATR, and (bullish: lower wick ratio ≥ min and delta ≤ 0) / (bearish: upper wick ≥ min and delta ≥ 0) ·
`volumeProfile(candles, {bucket})` → Profile (distribute each candle's `v` evenly across its range buckets; VA = smallest contiguous set around POC holding ≥ 70 %; shape by POC position in range: top third P, bottom third b, middle D, thin if max bucket < 3× mean) ·
`nakedPocs(store, cfg)` → Level[] of prior-day POCs not yet traded through.

### 4.7 `czt.mjs`
`evaluate(ctx)` → `{ condition, zone, trigger, score, setup: Setup|null }` where
`ctx = { symbol, symbolCfg, cfg, now, store, atr, session, bias, levels, sweeps, zones, profile, prevDayProfile, absorption, divergence, structure, lastClosed, deltaInfo }`.
- Condition hits: `biasAligned` (bias.dir matches candidate side), `killzone`, `outsideValueTrend`
  (price outside prev-day VA ⇒ expect expansion; aligned with side), `insideValueRotation` (inside VA ⇒ fade extremes).
- Zone hits: price within `zoneToleranceAtr` of a Level/Zone appropriate to the side (longs at
  sell-side liquidity/lows, bullish OB/FVG, VAL/POC; shorts mirrored).
- Trigger hits (last closed analysis-TF candle): `sweepReclaim` (a Sweep with `reclaimed`),
  `absorption` (matching side), `cvdDivergence`, `engulfing`, `ltfBos` (structure TF BOS in side
  direction after the sweep), `deltaConfirms` (closing candle delta sign matches side).
- A candidate side needs ≥ 1 trigger hit. Score = Σ weights. Emit a Setup when
  `score ≥ minScore` and `rr ≥ minRr`.
- **Entry** = close of the trigger candle. **Stop** = sweep extreme (manipulation low/high) ∓
  `stopBufferAtr`×ATR; if no sweep, the zone's far edge; reject if stop distance > `maxStopAtr`×ATR.
  **Targets** = nearest opposing liquidity in `targetsFrom` order, ≥ `minRr`; up to 3.
- `grade` by `gradeA`/`gradeB`. `reasons` = one line per hit, in source-document language
  ("Swept sell-side liquidity at Asia low 85,120 and reclaimed (manipulation)").
- Respect `maxSetupsPerSymbolPerDay`, `cooldownMinutes`, `oneOpenPerSymbol` (state passed in `ctx.limits`).

### 4.8 `risk.mjs`
`size({balance, riskPct, entry, stop, contract})` → `{units, lots, riskUsd, riskPct}` (lots = units /
unitsPerLot, floored to 0.01; refuse → `units:0` with `reason`). `rr(entry, stop, target)`. `dailyCaps(state, cfg)`.

### 4.9 `analyst.mjs`
`class Analyst extends EventEmitter { constructor({cfg, symbolsCfg, log, journal, bridge?, feedFactory, now}) ; start() ; stop() ; snapshot(symbolId?) ; chartData(symbolId, tf, limit) }`.
Per symbol: feed → store; on every closed **1m** candle recompute cheap things (session, delta);
on every closed **analysis-TF** candle run liquidity → structure → orderflow → czt; emit events:
`'event'` (feed lines), `'candle'` {symbol, tf, candle} for every TF touched (throttled to the forming
1m at ≤ 2/s), `'setup'`, `'status'`, `'levels'` {symbol, levels, zones, profile}. Journal every setup;
run `journal.resolveOpen(symbol, candle)` on each closed 1m. `snapshot()` returns what the
dashboard's watchlist and CZT panel need; `chartData()` returns `{candles, ema9, ema21, ema50, vwap,
delta, cvd, levels, zones, markers, profile, session}` for the UI.

## 5. Journal (`lib/journal.mjs`)
Append-only JSONL under `cfg.journal.dir`: `setups.jsonl` (one line per Setup at creation),
`resolutions.jsonl` (one line when resolved). `resolveOpen(symbol, candle1m)`: for each open setup —
long: `l ≤ stop` ⇒ lost (−1 R), `h ≥ targets[0]` ⇒ won (+rr R), both in one candle ⇒ **lost**
(conservative, as `resolve_trades.py` treats ambiguous as a manual call — here it is auto-lost and
flagged `ambiguous:true`); track `mfeR`/`maeR`; `resolveTimeoutHours` ⇒ expired at close (R from
close). If `trailByProvedAuctions`: after price makes a new structure-TF swing in the trade
direction, move stop to that swing ∓ buffer (never past entry before +1 R) — record each move.
`scorecard({symbol?, by:'symbol'|'trigger'|'grade'|'session'})` → rows `{key, n, wins, winRate,
expectancyR, profitFactor, maxDdR, avgRr, ci95}`. `load()` on start rebuilds open setups.

## 6. Server (`server.mjs`)
- `ANALYST_HOST` (default `127.0.0.1`), `ANALYST_PORT` (8080). Static from `public/` with a
  path-traversal guard (resolve + prefix check), correct MIME, `Cache-Control: no-cache` for html/js.
- `GET /health` → `{ok, uptime, symbols:{id:{state,kind,lastCandleT}}}`.
- `GET /api/state` → `analyst.snapshot()`.
- `GET /api/chart/:symbol?tf=5m&limit=500` → `analyst.chartData(...)`.
- `GET /api/setups?symbol=&limit=50` and `GET /api/scorecard?by=trigger`.
- `GET /api/feed?limit=200` → ring buffer.
- `GET /events` → SSE (`retry: 3000`, heartbeat comment every 15 s); event names:
  `event`, `candle`, `setup`, `status`, `levels`. Coalesce forming-candle updates to ≤ 2/s per symbol.
- JSON errors `{error}`; never crash on a bad request. SIGINT/SIGTERM → close feeds, flush journal, exit 0.

## 7. Dashboard (`public/`)
Light theme default (`:root` tokens), dark via `prefers-color-scheme` + `data-theme` toggle. Mobile
first (390 px), no horizontal scroll, touch targets ≥ 44 px. Layout top→bottom: header (TradeGuard,
status pill for the active symbol: Connecting… / Live / Delayed / Simulated / Reconnecting…), symbol
tabs, TF pills, chart (lightweight-charts v5: `createChart`, `addSeries(LightweightCharts.CandlestickSeries,…)`,
`LineSeries` ×3 (EMA 9/21/50) + VWAP, `HistogramSeries` volume (own pane / scale), `HistogramSeries` delta
(own scale), `createPriceLine` per Level (styled by kind; swept levels dashed), `createSeriesMarkers`
for sweeps (▲▼ "SWEEP"), absorption ("ABS"), setups (arrow + grade), session opens ("LDN", "NY")),
CZT panel (Condition / Zone / Trigger columns with ✓/– per hit, score bar, current setup card:
side, entry, stop, targets, R:R, size, invalidation, reasons), watchlist table (symbol, price, Δ%,
session, bias, feed badge LIVE/SIM/DELAYED, last setup), execution feed (live logs, newest first,
colour by level, filter by symbol), scorecard (by trigger, by symbol). Loads `/api/chart` on tab/TF
change, then applies SSE deltas; on SSE drop, reconnects (EventSource does) and re-fetches.
Keyboard: 1–4 symbols, t cycles TF, d toggles theme. No external network except `/`.

## 8. Tests (`test/*.test.mjs`, `node --test test/`)
Every module gets positive + negative cases built from synthetic candle generators in
`test/helpers.mjs` (`mkCandles`, `withSweepBelow`, `withFvg`, `withOrderBlock`, `withAbsorption`,
`withCvdDivergence`, `fakeWebSocket`, `fakeFetch`). Binance parser tests use these captured samples:

```
kline:    {"stream":"btcusdt@kline_1m","data":{"e":"kline","E":1791142274032,"s":"BTCUSDT","k":{"t":1791142260000,"T":1791142319999,"s":"BTCUSDT","i":"1m","f":6734731469,"L":6734731522,"o":"85462.50000000","c":"85462.50000000","h":"85462.50000000","l":"85462.49000000","v":"0.29537000","n":54,"x":false,"q":"25243.05602030","V":"0.03490000","Q":"2982.64125000","B":"0"}}}
aggTrade: {"stream":"paxgusdt@aggTrade","data":{"e":"aggTrade","E":1791142265500,"s":"PAXGUSDT","a":37416157,"p":"4146.00000000","q":"0.01890000","f":51562765,"l":51562765,"T":1791142265492,"m":false,"M":true}}
klines REST row: [1791142140000,"85466.00000000","85466.01000000","85462.49000000","85462.50000000","0.81900000",1791142199999,"69996.12071080",236,"0.23085000","19729.73114640","0"]
```
Server test: listen on port 0, GET each route, open `/events` and receive ≥ 1 event. E2E test:
replay feed with a scripted sweep-and-reclaim at a prior low in a bullish bias during a London
killzone ⇒ exactly one long Setup with stop at the sweep low − buffer, and a target at the prior
high; then the resolver marks it won when a later candle trades through the target.
Backtest smoke: `node backtest.mjs --symbol BTCUSD --days 1 --offline fixtures/btc-1m.json` runs
without network.

## 9. Deviations log
(builders append here: module · what · why)
