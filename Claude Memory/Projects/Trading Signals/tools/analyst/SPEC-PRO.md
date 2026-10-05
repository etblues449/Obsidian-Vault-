# TradeGuard Analyst — Pro ("God mode") addendum

Extends SPEC.md. Same rules: zero deps, ESM, plain objects across modules, injected clocks,
tests with node:test. Everything here runs on the SAME free feeds already in use: Binance
spot `aggTrade` (every trade, aggressor-tagged) and Binance partial depth (`@depth20`, 1 s).
Source 05 (docs/sources/05-order-flow-masterclass.md) is the authority for every definition.

## P1. Footprint — `lib/engine/footprint.mjs` (pure + one small stateful builder)

A footprint unpacks a candle into price levels with executed volume per side.

```js
FootprintLevel = { price, bid, ask, delta, total }          // bid = volume where the SELLER aggressed (hit the bid), ask = buyer lifted the ask
Footprint = { t, tf, bucket, high, low, totalBid, totalAsk, delta, poc,             // poc = level with max total
              levels: FootprintLevel[] (ascending price, contiguous — empty levels present with zeros),
              imbalances: [{ price, side:'buy'|'sell', ratio }],                   // see rule
              stacked: [{ side, from, to, count }],                                // ≥ cfg.footprint.stackedMin consecutive same-side imbalances
              unfinishedHigh: boolean, unfinishedLow: boolean,                     // both sides printed at the extreme level (no 0 print)
              nTrades }
```

- `bucketFor(atr, tick, cfg)` → bucket = max(tick, round(atr × cfg.footprint.bucketAtr / tick) × tick).
- `buildFootprint(trades, { t, tf, bucket, tick, high?, low? })` → Footprint. Trade side is the
  AGGRESSOR (`trade.side`): `'buy'` adds to `ask` at its level, `'sell'` adds to `bid`.
  Level price = floor(p / bucket) × bucket (snapped to tick, no float drift — use integer ticks internally).
- **Diagonal imbalance (source 05 §3):** buy imbalance at price P when `ask(P) ≥ ratio × bid(P − bucket)`
  and `ask(P) > 0`; sell imbalance at P when `bid(P) ≥ ratio × ask(P + bucket)` and `bid(P) > 0`;
  `ratio = cfg.footprint.imbalanceRatio` (default 3.0 = "300 %"). A zero opposite cell with a
  non-zero cell counts (ratio reported as `Infinity` → serialise as `null` + `infinite:true`).
- **Stacked:** ≥ `stackedMin` (default 3) consecutive levels with same-side imbalances.
- **Unfinished auction (§3):** at the candle's highest level both `bid > 0` and `ask > 0` ⇒
  `unfinishedHigh`; mirror for the low. (A finished auction prints a 0 on one side at the extreme.)
- `trappedTraders(footprints, { lookback = 2 })` → `{ side:'bullish'|'bearish', t, levels:[…], reason } | null`
  (§4): bearish when the previous candle carries a stacked BUY imbalance in its upper third and the
  last closed candle CLOSES below the lowest of those imbalance levels (the aggressive buyers are
  offside, their stops are market sells); bullish mirrored.
- `class FootprintBuilder { constructor({ tf, tick, bucket, maxCandles = 48 }); addTrade(trade) ; closeCandle(tOpen) → Footprint ; current() → Footprint|null ; recent(n) → Footprint[] (closed, oldest→newest) ; setBucket(bucket) (applies from the next candle) }`
  — incremental, O(1) per trade, bounded memory; buckets trades by `Math.floor(t / TF_MS[tf])`.
  A trade older than the current candle is applied to that candle if still held, else dropped.
- `summarizeForCzt(fp, { side, zone? })` → `{ stackedToward: boolean, stackedAgainst, unfinishedToward, pocNearZone }` (helpers czt uses).

Backfill: `lib/feeds/binance-trades.mjs` → `fetchAggTrades({ symbol, startTime, endTime, limit = 1000, maxRequests = cfg.footprint.backfillMaxRequests, fetch, log })`
→ Trade[] (uses `fromId` pagination after the first `startTime` page; stops at `maxRequests`; respects
the 1 req/s rule and 429 holdoff like binance.mjs). Default `backfillMaxRequests` 40 (= ≤ 40 000
trades — for BTCUSDT that is the last ~15–40 min, for PAXGUSDT many hours; the UI labels footprints
built from partial history as such via `fp.partial = true`).

## P2. Order book — `lib/engine/orderbook.mjs` + `lib/feeds/binance-depth.mjs`

Binance partial depth: stream `<s>@depth20` (1 s) payload `{ lastUpdateId, bids:[[price,qty]…], asks:[[…]] }`
(top 20, best first). REST equivalent `GET /api/v3/depth?symbol=&limit=20` for the first snapshot.

```js
BookSnapshot = { t, bids:[{price, qty}] (best first), asks:[…] }
BookSummary  = { t, bestBid, bestAsk, mid, spread, spreadBp, bidDepth, askDepth, imbalance: (bidDepth−askDepth)/(bidDepth+askDepth) ∈ [−1,1],
                 walls: [{ side:'bid'|'ask', price, qty, mult, ageMs }],            // qty ≥ cfg.orderbook.wallMult × median qty of that side's 20 levels
                 nearestWall: { bid: wall|null, ask: wall|null },
                 pulled: [{ side, price, qty, ageMs }],                             // a wall that disappeared within cfg.orderbook.pullWindowMs without being traded through
                 absorbed: [{ side, price, qty, tradedQty, ageMs }] }               // a wall that price TOUCHED (trades printed at its price) and that persisted/refilled while ≥ absorbRatio × qty traded into it
```

- `class OrderBook { constructor({ cfg, tick, now }); applySnapshot(snap) ; noteTrade(trade) (for absorbed/traded-through accounting) ; summary() → BookSummary ; history(n) → BookSummary[] (1 per second, ring of cfg.orderbook.historySeconds) }`.
- `parseDepthMessage(data)` in binance-depth.mjs → BookSnapshot; `depthStreamName(stream)` → `${s}@depth20`.
- No level-3 claims: this is the visible top of book. Say so in the UI tooltip.

## P3. Notifications — `lib/notify.mjs`

Telegram Bot API (the executor's alert channel): `POST https://api.telegram.org/bot<token>/sendMessage`
`{ chat_id, text, parse_mode:'HTML', disable_web_page_preview:true }`.
- `createNotifier({ cfg, env = process.env, fetch, log, now })` → `{ enabled, setup(setup), resolved(setup), digest(scorecardRows, { dayKey }), feedProblem(symbol, msg), stats() }`.
  Enabled only when `env.ANALYST_TELEGRAM_BOT_TOKEN` and `env.ANALYST_TELEGRAM_CHAT_ID` are both set;
  the token is read at send time and never logged (log.mjs redacts `token` keys anyway); 5 s timeout;
  per-kind cooldown (`notify.cooldownMinutes`, default 1) and a hard cap of `notify.maxPerHour` (default 30);
  failures logged at warn, never thrown. `setup()` sends only when `gradeAtLeast(setup.grade, cfg.notify.minGrade)`
  (default `'B'`). Message formats (HTML, ≤ 4096 chars):
  - setup: `🟢 LONG BTCUSD · grade A · score 9.5\nEntry 85,161.82 · Stop 85,063.15 (−98.67) · T1 85,428.01 (2.70 R)\nWhy: …reasons…\nInvalidation: …` (🔴 SHORT).
  - resolved: `✅ WON +2.70 R` / `❌ LOST −1.00 R` / `⏱ EXPIRED` with symbol, side, entry→exit.
  - digest: a compact scorecard table by trigger + today's setups count.
  - feedProblem: `⚠️ XAUUSD: …` (reconnect loops, fallbacks) — rate-limited hard.
- Daily digest trigger: the Analyst calls `notifier.digest()` once per London day when the 1m candle
  closes at or after `cfg.notify.digestAt` (default `"17:05"`, Europe/London via sessions.mjs); the
  dayKey already sent is remembered so a restart does not resend.

## P4. Best-fit tuner — `scripts/tune.mjs`

`node scripts/tune.mjs [--min 30] [--apply]` reads the journal, groups resolved setups by trigger kind
and by zone kind, and PROPOSES new `czt.weights` by shrinking each hit's weight toward the evidence:
`w' = w × (1 + k × clamp(expectancyR_of_setups_with_hit, −1, 1))` with `k = n / (n + 30)` (Bayesian
shrinkage toward the prior weight; a group with n < `--min` keeps its weight). Prints a table
(hit, n, expR, w → w'), writes `data/tune-proposal.json`, and only with `--apply` rewrites
`config/strategy.json` weights (keeping everything else byte-identical) — and even then prints the
diff and asks for `--yes`. Never runs automatically.

## P5. CZT additions — `lib/engine/czt.mjs` + `config/strategy.json` + `lib/config.mjs`

New weights (add to `czt.weights` AND to `WEIGHT_KEYS` in config.mjs):
`trigger.footprintImbalance 2.0` (a stacked imbalance in the side's direction on the trigger candle, or on the sweep candle for a reclaim),
`trigger.trappedTraders 2.0` (footprint.trappedTraders agrees with the side),
`trigger.bookAbsorption 1.5` (BookSummary.absorbed has a wall on the side's favour within zoneToleranceAtr of price in the last `orderbook.absorbWindowSec`),
`trigger.unfinishedAuction 0.5` (the opposite extreme of the trigger candle is unfinished → the market "may revisit that price to complete business"; it is a target-side magnet, not an entry reason — therefore it may NOT be the only trigger),
`condition.bookImbalance 0.5` (|imbalance| ≥ `orderbook.imbalanceMin` (0.25) in the side's favour).
Gate: `deltaConfirms` and `unfinishedAuction` are confirmations only — the ≥ 1-trigger rule needs
one of sweepReclaim / absorption / cvdDivergence / engulfing / ltfBos / footprintImbalance / trappedTraders / bookAbsorption.
`ctx` gains `footprint` (last closed analysis-TF Footprint|null), `footprints` (recent), `book` (BookSummary|null).
Reasons in source language: "Stacked buy imbalances (×4) at the Asia low — aggressive buyers stepping in at the zone",
"Trapped buyers: stacked buy imbalances at 85,230 then a close below — their stops are market sells".
New config blocks (defaults): `footprint { bucketAtr 0.05, imbalanceRatio 3.0, stackedMin 3, maxCandles 48, backfillMaxRequests 40 }`,
`orderbook { levels 20, wallMult 5, pullWindowMs 3000, absorbRatio 0.5, absorbWindowSec 120, imbalanceMin 0.25, historySeconds 600 }`,
`notify { minGrade "B", onResolve true, digestAt "17:05", cooldownMinutes 1, maxPerHour 30 }`.
Also `czt.minStopAtr 0.35` (see findings) — stops narrower than this are widened AWAY from entry.

## P6. Wiring — `lib/engine/analyst.mjs`, `server.mjs`, `backtest.mjs`

- Per Binance symbol: `FootprintBuilder` fed by every trade; on each closed analysis-TF candle `closeCandle()`
  and emit SSE `footprint { symbol, tf, footprint }`; `OrderBook` fed by depth snapshots (+ `noteTrade`);
  emit SSE `book { symbol, summary }` at most 1/s. Sim/replay feeds produce footprints from their synthetic trades
  (so the panel always has something to show) and no book (panel says "no order book for this feed").
- Routes: `GET /api/footprint/:symbol?n=12` → `{ symbol, tf, bucket, footprints: Footprint[], partial }`;
  `GET /api/book/:symbol` → `{ symbol, summary, history: BookSummary[] (last 60) }` or `{ symbol, summary: null, reason }`;
  `GET /api/pro/:symbol` → both plus `trapped` and the czt pro hits, in one call.
- Backtest: footprint/book triggers are reported as `n/a (no trade tape)` in the table header; the
  weights simply never fire.
- Notifier wired to journal 'setup'/'resolved' and the daily digest; `scripts/report.mjs` gains `--telegram` to send the digest once.

## P7. Dashboard — `public/pro.js`, `public/pro.css`, `public/index.html` (+ minimal hooks in app.js)

- **LIGHT THEME ONLY** (user instruction 2026-10-04 23:xx): remove the dark token block, the
  `prefers-color-scheme: dark` rule, the theme toggle button, the `d` key and the localStorage theme
  key; chart colours read the light tokens. Keep `color-scheme: light` on `:root`.
- A **Pro** section between the chart and the CZT panel (desktop: a third column under the chart; phone:
  stacked), with a persisted "Pro" show/hide pill (default shown on live symbols):
  - **Footprint panel**: the last 12 analysis-TF candles as columns, each a vertical list of price rows
    (`bid × ask`), imbalance cells outlined (buy = up colour, sell = down colour), stacked runs filled,
    POC row bold, unfinished extremes marked with a small `▲`/`▼`, candle delta and total under each
    column; rows aligned on a shared price scale across the 12 columns; horizontal scroll inside the
    panel on phone, never the page; "partial history" badge when `partial`.
  - **DOM ladder**: top-20 asks above, bids below, qty bars scaled to the max, walls highlighted,
    spread + depth imbalance meter, "pulled"/"absorbed" chips with ages; tooltip: "visible top of book, not level 3".
  - **Pro hits** strip: the five new CZT hits with ✓/– like the CZT panel.
  - Live via SSE `footprint`/`book`; initial via `/api/pro/:symbol`; errors render a one-line message, never throw.
  - Touch targets ≥ 44 px; no horizontal page scroll at 390 px; no console errors.

## P8. Tests

`test/footprint.test.mjs` (bucketing, diagonal imbalance incl. zero-cell, stacked, unfinished, trapped traders both sides, builder bounds/late trade, backfill pagination with fakeFetch incl. 429), `test/orderbook.test.mjs` (snapshot parse, summary numbers by hand, walls by median, pulled vs traded-through, absorbed with noteTrade, history ring), `test/notify.test.mjs` (disabled without env, message formats, grade gate, cooldown + hourly cap, timeout/failure never throws, token never in logs, digest once per day), `test/tune.test.mjs` (shrinkage maths, --apply refused without --yes, byte-identical rewrite of untouched keys), czt tests for each new hit and the confirmation-only gate, analyst/server tests for the new routes/SSE, and an e2e where a stacked buy imbalance at a swept Asia low under a bullish bias produces a long whose reasons mention the imbalance.

## P9. Deviations log (Pro)
(builders append here)

- `lib/engine/footprint.mjs` · Footprint carries additive `open`/`close` (first/last trade price), `total`, `tick`, `partial`, `truncated` · `trappedTraders` is defined on "the last closed candle CLOSES below" but §P1's shape has no close; it has to travel with the footprint. `truncated: true` + a sparse ladder when a contiguous ladder would exceed 5000 levels (a bad print must not OOM the engine).
- `lib/engine/footprint.mjs` · a diagonal neighbour OUTSIDE the footprint's level range is "not comparable" — no buy imbalance at the lowest level, no sell imbalance at the highest · treating the missing neighbour as 0 would print a phantom imbalance at almost every bar extreme; a zero cell INSIDE the range still counts (ratio `Infinity`, `infinite: true`; `serializeFootprint()` turns it into `null`).
- `lib/engine/footprint.mjs` · POC ties resolve to the level nearest the candle's mid-range (lower on an exact tie) · §P1 says only "level with max total".
- `lib/engine/footprint.mjs` · `trappedTraders` looks back k = 1 … `lookback` closed candles before the last one, nearest first; the stacked run's lowest level (`from`) must be ≥ low + ⅔ range for "upper third" (mirror: `to` ≤ low + ⅓ range) · §P1 names "the previous candle" and `lookback = 2` together. Result also carries `at` (trap candle t), `edge`, `close`.
- `lib/engine/footprint.mjs` · `FootprintBuilder` additive: `markPartialBefore(tMs)` (stamps `partial` on candles opening before a truncated backfill's coverage), `last()`, `clear()`, `size`, `dropped`, `bucketStart()`; `cfg` may be passed to the constructor for `imbalanceRatio`/`stackedMin`/`maxCandles`; with no cfg the §P5 defaults apply (the `footprint` config block lands with P5) · the integrator needs a way to label partial footprints and the §P1 shape gives none. A late trade for a held CLOSED candle re-finalises that footprint lazily on the next `recent()`/`closeCandle()`; `closeCandle()` on a bucket with no trades returns an empty footprint and keeps it in the ring (time alignment for the UI).
- `lib/feeds/binance-trades.mjs` · returned `Trade[]` carries additive array properties `partial`, `requests`, `coverage {from, to}`, `direction`, `firstId`, `lastId`, `symbol`; each Trade carries `id` (aggTrade id) · fromId pagination needs the id; §P1 says only "flags partial".
- `lib/feeds/binance-trades.mjs` · additive `direction: 'backward'` (newest page first — no params or `endTime` — then `fromId = firstId − limit` back to `startTime`) · §P1's forward walk is the default, but when it hits `maxRequests` the NEWEST trades are the ones missing, which is the wrong end for a live footprint ("the last ~15–40 min") and for `markPartialBefore`; backward loses the OLDEST and `coverage.from` is exactly the stamp. Every HTTP call, 429 retries included, counts toward `maxRequests` so a rate-limit storm is bounded.
- `lib/feeds/binance-trades.mjs` · the forward first page sends `startTime` ONLY (no `endTime`; `endTime` is enforced client-side — the walk stops at the first trade past it) · Binance's startTime+endTime window rules have changed over time. A non-OK status other than 429/418 throws (like binance.mjs) rather than returning partial.
- `test/footprint.test.mjs` · the 1 req/s and Retry-After pacing is asserted on `fakeClock` by driving the pending promise (flush microtasks → advance to the next timer); a 200k-trade candle is asserted to finish under 2 s as the O(1) check.
- `lib/engine/orderbook.mjs` · `pulled` is finalised when a wall has been ABSENT from every snapshot for `pullWindowMs` (t − lastSeen ≥ pullWindowMs); a wall that re-qualifies at the same price inside that window is a **refill** (keeps `firstSeen`, `tradedQty`; `refills` counter) · §P2 says "disappeared within pullWindowMs" — read literally a one-frame flicker of a 1 s depth stream would be a spoof every time. A pull is therefore reported up to pullWindowMs late. If the snapshot gap across the disappearance itself exceeds pullWindowMs (feed silence), nothing is claimed (`unobserved` counter) — the book was not being watched.
- `lib/engine/orderbook.mjs` · additive `tradedThrough: [{ side, price, qty, lastQty, tradedQty, at, ageMs }]` — a wall that vanished AFTER ≥ absorbRatio × qty printed at its price (eaten, not cancelled) · §P2 names only pulled/absorbed; the pulled-vs-traded-through distinction needs the third outcome by name. Executed volume comes ONLY from `noteTrade()` prints AT the wall price (integer-tick match) — a smaller displayed qty is never inferred to be a fill.
- `lib/engine/orderbook.mjs` · `absorbed` is confirmed by the first SNAPSHOT that shows the wall standing (persisted) or back (refilled) after ≥ absorbRatio × qty has printed at its price — never at trade time (the last snapshot is stale by then) · `qty` on events is the largest size the wall displayed (`lastQty` additive); events carry `at` and their `ageMs` is time since the event, a live wall's `ageMs` is time since it first qualified; events stay in the summary for `absorbWindowSec` (§P5's czt window) — `pullWindowMs` is a detection window, not a display window.
- `lib/engine/orderbook.mjs` · summary carries additive `levels {bids, asks}` (the top-N, best first) and `walls[].refills/tradedQty`; additive pure exports `orderbookConfig`, `median`, `normalizeSnapshot`, `findWalls`, `summarizeSnapshot` and the czt-side readers `bookImbalanceFavours(summary, side, imbalanceMin)` / `recentAbsorption(summary, { side, price, tolerance, windowMs })` (§P5 `condition.bookImbalance` / `trigger.bookAbsorption`) · with cfg absent the §P5 defaults apply (the `orderbook` config block lands with P5). The median INCLUDES the candidate level (one 50-lot among nineteen 1-lots has median 1). `history()` keeps one summary per second (a second frame in the same second replaces the first) bounded by `historySeconds` in count AND age. A snapshot without `t` is stamped by the injected `now`; with neither, `applySnapshot` throws.
- `lib/feeds/binance-depth.mjs` · additive `BinanceDepthFeed` adapter (one `<s>@depth20` socket per symbol; events `'book' { symbol, snapshot }` + `'status'`; same backoff / 60 s clean reset / 90 s watchdog / 10-failure `error` / ≤ 1 REST call/s / 429 holdoff as binance.mjs; drops frames whose `lastUpdateId` is older than the last one seen), `depthRestUrl()`, `fetchDepthSnapshot()`, `isDepthStream()`, `parseDepthLevels()` · §P2 names only the parser and the stream name — without an adapter nothing carries depth frames into `OrderBook`. The integrator may instead add `<s>@depth20` to binance.mjs's combined socket and route frames through `parseDepthMessage()`; both paths yield the same BookSnapshot. `depthStreamName(stream, { levels, speed })` accepts 5|10|20 and `'100ms'` (default output is exactly `${s}@depth20`). BookSnapshot carries additive `lastUpdateId` and `stream`; the partial-depth payload has NO timestamp, so `parseDepthMessage(raw, { t })` stamps the caller's clock (`t: null` when none is given).
- `test/orderbook.test.mjs` · also exercises the adapter on `fakeWebSocket`/`fakeClock`/`fakeFetch` (REST-first snapshot, stale-sequence drop, backoff, watchdog, error-after-10, Retry-After) · §P8 lists only the engine cases for this file; the adapter is additive and has no other home.
- `lib/engine/czt.mjs` (round-1 fixer) · the P5 gate is in place ahead of the Pro hits: `REAL_TRIGGERS` already lists footprintImbalance / trappedTraders / bookAbsorption and `CONFIRM_ONLY` lists deltaConfirms / unfinishedAuction; `TRIGGER_PRIORITY` ranks trappedTraders / footprintImbalance after sweepReclaim and bookAbsorption after absorption. The integrator only has to call `hit('trigger', '<name>', line)` (confirmations with `{ confirmOnly: true }`) and add the weights to `czt.weights` + `WEIGHT_KEYS`. `czt.minStopAtr` 0.35 is live (SPEC.md §9).

