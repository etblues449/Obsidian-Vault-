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
- `public/pro.js` · the "Pro" show/hide pill persists ONE preference (localStorage `tradeguard.pro`, `'1'`/`'0'`); with nothing stored the default follows §P7 per active symbol — shown when the symbol's `feed.kind` is `live` (a live feed that is still connecting counts), hidden for sim / replay / delayed · §P7 says "default shown on live symbols" without saying whether the preference is per symbol; one preference is what a phone user expects from a pill.
- `public/pro.js` · the footprint's shared price scale is capped at 240 rows, windowed around the latest candle's close (a column whose POC falls outside the window shows no bold cell) · the engine's `truncated` footprint (footprint.mjs deviation) can carry up to 5 000 levels; 12 × 5 000 cells would lock a phone. 240 × 12 = 2 880 cells renders in well under a frame.
- `public/pro.js` · the `p` key toggles the Pro panel and the footer lists it (the `d` key is gone with the theme) · §P7 names only the pill; a keyboard route keeps parity with `1–4` / `t`.
- `public/pro.js` · `/api/pro/:symbol` is read tolerantly until the integrator fixes the shape: footprints at `footprints` or `footprint.footprints`; `summary` / `history` / `reason` under `book` or at the top level; `hits` as booleans by key, as a string array, as `{ condition: [...], trigger: [...] }`, or absent — absent falls back to the active symbol's `czt.<layer>.hits` from `/api/state` (the same hits the CZT panel shows) · §P6 says only "both plus `trapped` and the czt pro hits, in one call". The shape the panel is written against is documented in the module header.
- `public/pro.js` · the SSE `footprint` payload may carry an optional `trapped` (the `trappedTraders()` result or `null`) next to `footprint`; when present it replaces the panel's trapped-traders line without a refetch · §P6's `footprint { symbol, tf, footprint }` has no trapped field, but trapped traders are decided exactly when a candle closes, so re-GETting `/api/pro` for one line would double the traffic per candle. Without the field the line keeps the last `/api/pro` value.
- `public/app.js` (Pro UI builder, additive) · two document CustomEvents are the only hooks pro.js uses: `tradeguard:state` `{ active }` after every `renderAll()` and `tradeguard:sse` `{ source }` when the EventSource is created; pro.js adds its `footprint` / `book` listeners to that ONE shared EventSource (never a second `/events` connection — the server drops slow clients per connection) · §P7 says "minimal hooks in app.js" without naming them.
- `public/app.js` (Pro UI builder, additive) · `HITS` gains the five §P5 keys with source-language labels (`bookImbalance` under condition; `footprintImbalance`, `trappedTraders`, `bookAbsorption`, `unfinishedAuction` under trigger) · the CZT panel renders an unknown hit as its raw camelCase key — one unbreakable word that at 390 px overflows the 1/3-width column and gives the PAGE a 7 px horizontal scroll (observed in the render check as soon as `/api/state` carried `footprintImbalance`). pro.css also adds `overflow-wrap: anywhere` to hit labels so a future unknown key can never widen the layout again.
- `public/` LIGHT ONLY (§P7) · removed: the `prefers-color-scheme` block and `[data-theme="dark"]` block in app.css, the `.icon-btn` toggle styles, `#themeBtn`, the pre-paint theme script and the `d` key in index.html, `Theme`, `Chart.applyTheme()`, `STORE.theme` and the `d` handler in app.js; `<meta name="color-scheme">` is now `light`; `:root` keeps `color-scheme: light` · SPEC.md §7 / §1 file list still describe "dark via prefers-color-scheme + toggle" and "d toggles theme" — superseded by this addendum; SPEC.md was not edited by the Pro UI builder (not an assigned file). Verified: `grep -rn prefers-color-scheme public/` (excluding vendor) returns nothing; Chromium with `colorScheme: 'dark'` emulation renders `rgb(249, 249, 247)`.
- `lib/notify.mjs` · the cooldown key is `${kind}:${symbol}` for setup / resolved / feedProblem (digest has no symbol); the hourly cap stays global and counts ATTEMPTS (failed sends included) · §P3 says "per-kind cooldown" — keyed on the kind alone, a 1-minute cooldown drops three of four setups when every symbol's 5m candle closes on the same minute; counting failures keeps a dying network from turning into a flood. A Telegram 429 holds every kind off for `Retry-After` (default 60 s) — `skipped:'holdoff'`.
- `lib/notify.mjs` · additive `notify.feedProblemCooldownMinutes` (default 15) · "rate-limited hard" needs its own number. With no `notify` block at all every §P5 default applies (`notifyConfig(cfg)` exported; wrong-typed values fall back to the default rather than throwing).
- `lib/notify.mjs` · `resolved()` is gated by `gradeAtLeast(grade, minGrade)` unless this process announced the setup (bounded id memory, 5000) and by `status ∈ won|lost|expired` (`skipped:'status'`; cancelled is not an exit) · the exit of a setup nobody was told about is noise. The emoji follows the money (a trailed stop-out at +0.4 R is ✅ LOST +0.40 R), the word the mechanism — same split as journal.mjs.
- `lib/notify.mjs` · the digest dayKey is remembered in `<cfg.journal.dir>/notify-state.json` (injectable `fs`; `stateFile` overrides, `stateFile: null` = memory only) and marked on the ATTEMPT — a failed digest is `already-sent` for the rest of the day (the result tells the caller), one that was never attempted (holdoff / cap / disabled) is un-marked and still owed · §P3 asks for the memory ("a restart does not resend") but names no home for it; retrying a failing digest every minute would eat the hourly cap.
- `lib/notify.mjs` · additive exports for the integrator: `digestDue({ t, cfg, lastDayKey })` → `{ due, dayKey, localTime }` (Europe/London via sessions.localParts, DST-aware; the notifier also exposes `digestDue(t)` bound to its own remembered day), `escapeHtml`, `clampHtml` (≤ 4096 chars, never cuts a tag or entity open, closes what the cut left open), `formatSetup / formatResolved / formatDigest / formatFeedProblem`, `fmtPrice / fmtSigned / fmtR`, and `send(kind, text, { symbol, key, cooldownMs })` on the notifier for `scripts/report.mjs --telegram`. `createNotifier` also takes `timeoutMs` (default 5000), `dp` (number | {symbol: dp} | fn — default: the decimals the setup's own prices carry, min 2) and `fs`. The `setup` message puts each reason on its own `• ` line under `Why:` (phone-readable) and adds an `<i>tf · session</i>` footer.
- `lib/notify.mjs` · error strings are scrubbed of the whole Telegram URL (`https://api.telegram.org/bot…` → `<telegram api>`) and then of the bare token before they are logged or returned; the response body is never read into a log line; log data carries only `{ kind, symbol, chars, status|error }` · a fetch failure quotes the request URL, which carries the token in its path — redacting the token alone would still leak the URL shape.
- `scripts/tune.mjs` · groups are by HIT (every `condition.*` / `zone.*` / `trigger.*` key a resolved setup carried, plus `trigger.kind`) rather than "by trigger kind and by zone kind" · a weight attaches to a hit; a setup with two zone hits is evidence for both. `expectancyR` comes from `journal.summarize` (R against the ORIGINAL stop — source 05 §7). Hits seen in the journal with no weight are listed in the table (`unknown: true`) but never written.
- `scripts/tune.mjs` · additive flags `--k` (k0, default 30), `--dir` (default `data/`, relative to the analyst root), `--symbol`, `--strategy` (default `config/strategy.json`), `--out` (default `<dir>/tune-proposal.json`), `--no-write`; exit codes 0 ok / dry run, 1 bad input or an invalid result, **2** for `--apply` without `--yes` (0 would read as "applied" to a shell script). `--apply` with nothing to change says so and exits 0 without asking for `--yes`. `validateStrategy()` runs on the rewritten config before anything is written; an invalid result is refused and the file untouched. `main(argv, { stdout, stderr, now, cwd })` is exported and injectable; the shrink result is rounded to 3 dp and floored at 0.
- `scripts/tune.mjs` · `rewriteWeights(text, weights)` edits the numeric values inside the `czt.weights` object of the RAW text (balanced-brace scan from `"czt": {` → `"weights": {`, string-aware): whitespace, key order, `_note` keys and every other byte survive; a key whose parsed value does not change is not touched at all (so `"3.0"` keeps its spelling); the result is parsed back and compared with the original outside `czt.weights` before it is returned — any difference throws and nothing is written · §P4 "keeping everything else byte-identical", proven in `test/tune.test.mjs` on a temp copy of `config/strategy.json` (line-by-line: only `"<weight>": <number>` lines differ) and on a tab-indented one-line file with a second, non-czt `weights` object.

- **Integrator (P5/P6, 2026-10-05)** · `lib/engine/czt.mjs` · the Pro hits read `ctx.footprint` / `ctx.footprints` / `ctx.trapped` / `ctx.book`: a footprint whose `t` is not the trigger candle's is ignored (it is not this candle's flow); `footprintImbalance` also accepts the stacked run on the SWEEP candle when the entry comes after a reclaimed sweep (`fps.find(f => f.t === sweepT)`); `ctx.trapped` (the analyst's own `trappedTraders()` result, `null` = none) wins over recomputing from `ctx.footprints` so `/api/pro.trapped` and the hit always agree · §P5 names the inputs but not their time alignment. Reason lines: the imbalance names the zone level when there is one ("at the Asia low", "… on the sweep candle") and the run's price span otherwise; `bookAbsorption` / `bookImbalance` say "visible top of book" (§P2's no-level-3 rule travels with the claim).
- `lib/engine/analyst.mjs` · the `OrderBook` is created LAZILY on the first `depth` event a feed emits, not "per Binance symbol": the feed, not the config name, proves depth exists (a Binance symbol forced onto `simulated` by `ANALYST_FEED` must not show an empty book); `bookData()` returns `{ summary: null, history: [], reason }` with the reason by feed kind ("No depth snapshot yet …" for live, "No order book for this feed (sim) …" otherwise) · §P6 says "per Binance symbol". `FootprintBuilder` is created eagerly per symbol (every feed may emit trades; sim/replay footprints come from their synthetic tape) and `closeCandle()` runs on EVERY analysis-TF close including the history one, so a feed with no tape shows empty, time-aligned footprints (nTrades 0) rather than nothing.
- `lib/engine/analyst.mjs` · the aggTrade tape backfill (`direction:'backward'`, `startTime = now − footprint.maxCandles × TF`, bounded by `backfillMaxRequests`) runs asynchronously after history and then REBUILDS the builder: tape (oldest→newest) + the live trades from the ring newer than `coverage.to`, `markPartialBefore(coverage.from)` when `partial`, `closeCandle()` for every bucket up to the last closed analysis candle; the rebuilt newest footprint is emitted as `footprint { …, rebuilt: true }` · without the rebuild every backfilled trade older than the live forming candle would be dropped by the builder's "older than everything held" rule. `footprint.backfillMaxRequests: 0` (or `tradeBackfill:false`) switches the tape off — read RAW because `footprintConfig()` treats 0 as "fall back to 40". A failed tape is a warn line; `footprintData().backfill` reports `{ state: running|done|error, requests, partial, coverage }` and `partial` is true while the tape is still loading.
- `lib/engine/analyst.mjs` · SSE `book` is throttled to ≤ 1/s per symbol with a trailing flush (a frame that arrives inside the second is emitted when the second ends, so the last state always reaches the UI); `footprint` events carry additive `trapped` (the §P7 builder's request) · §P6 says "at most 1/s" without naming the trailing edge.
- `lib/engine/analyst.mjs` · notifier wiring: `journal.on('setup'|'resolved')` → `notifier.setup / resolved` (without a journal `_emitSetup` calls `setup` directly); feed `reconnecting` / `error` statuses → `feedProblem`; on every LIVE closed 1m `notifier.digestDue(closeT)` → `digest(journal.scorecard({by:'trigger'}), { dayKey, setupsToday })` — the notifier's own dayKey memory makes the second symbol's close a no-op; history replay never triggers a digest · §P3 names the trigger, not the home. `snapshot().notifier = { enabled }` and `/health.notifier` surface the disabled state (the notifier's own skip is silent). Snapshot symbols carry additive `pro { footprints, bucket, partial, book, depthFrames, hits }`; `footprintData().bucket` is the bucket the NEXT candle uses (`setBucket` applies from the next candle).
- `lib/feeds/binance.mjs` · `<s>@depth20` rides the SAME combined socket (SPEC §3: one connection per symbol) as a third event `depth { symbol, snapshot, source: 'stream'|'rest' }`; `parseStreamMessage(raw, { t })` stamps depth frames with the adapter clock (the payload has none) and still returns null for anything else; frames whose `lastUpdateId` is older than the newest seen are dropped; one REST `GET /depth?limit=20` right after the socket opens (same ≤ 1 call/s pacing and 429 holdoff as klines; a failure is a warn line and never delays `live`); `opts.depth === false` / `feedParams.depth === false` keeps the socket at kline + aggTrade and ignores a stray depth frame · §P2's stand-alone `BinanceDepthFeed` stays available but the integrator chose the single socket. `test/feeds.test.mjs`'s socket-URL assertion was updated to the new three-stream URL (a contract change, not a weakened check).
- `server.mjs` · `/api/footprint/:symbol?n=` (n clamped 1…600, default 12), `/api/book/:symbol`, `/api/pro/:symbol` dispatch to `analyst.footprintData / bookData / proData`; unknown symbol → 404 (RangeError), other errors → 500, bad encoding → 400; SSE forwards `footprint` and `book`; `main()` builds the notifier (`createNotifier({ cfg: {…cfg, journal:{dir: dataDir}}, env, log, now, dp })`) and logs ON/off at start · §P6 lists the routes without the error contract.
- `backtest.mjs` · the "n/a (no trade tape)" note is a FOOTER line directly under the by-trigger table, not in its header · `test/backtest.test.mjs` and the README pin `By trigger\nkey…`; the line names all five Pro hits (`NO_TAPE_HITS` exported).
- `scripts/report.mjs --telegram` · sends the digest through `notifier.send('digest', …)` (no once-per-day memory: an explicit CLI run is explicit intent, and the server's evening digest keeps its own memory); exit 3 when not sent (disabled / skipped / HTTP error) with the reason on stderr; `digestFor({ cfg, journal, symbol, now })` exported · §P6 says only "gains --telegram to send the digest once".
- `config/strategy.json` + `lib/config.mjs` · the five Pro weights are REQUIRED in `czt.weights` (in `WEIGHT_KEYS` like every other hit); the `footprint` / `orderbook` / `notify` blocks are OPTIONAL (absent → the modules' §P5 defaults, exported as `PRO_DEFAULTS`) but validated key by key when present (`orderbook.levels ∈ 5|10|20`, `notify.digestAt` HH:MM, `notify.minGrade` A|B|C, an unknown `notify.*` key is refused by name so a token can never land in config) · §P5 says "add" without saying whether the blocks may be omitted.
- `test/` · the §P8 Pro e2e (`test/e2e.test.mjs`) feeds the replay a 10-trade tape for the manipulation minute (one sell at the sweep low, nine buys one bucket apart → nine buy imbalances, eight of them ratio ∞) and asserts the long's reason line, `trigger.real`, the Σ-weights score and the serialised SSE column; `test/analyst.test.mjs` covers footprint close/serialisation, lazy book + 1/s throttle + absorption via `noteTrade`, the tape rebuild (partial + live trade survives), and the notifier hooks with a stub notifier; `test/feeds.test.mjs` the depth frame on the combined socket (REST-first, stale drop, off switch); `test/server.test.mjs` the three routes + SSE; `test/config.test.mjs` the blocks · §P8 lists them as "czt tests for each new hit…, analyst/server tests for the new routes/SSE, and an e2e".

- **Round-1 review fixes (2026-10-05)** · `lib/engine/analyst.mjs` · (critical) 'trade' and 'status' event handlers at start() lines 172 and 174 were not wrapped in `_safe()`, allowing feed errors or handler exceptions to crash the process; both now wrapped (feed history/candle/depth/status/trade all crash-guarded). Feed event listeners are now detached in stop() to prevent memory leaks and handler duplication on restart—handlers stored in `sym.feedHandlers` and removed via `feed.off()`. The async trade backfill promise (line 325) now has a rejection handler to prevent unhandled promise rejection from leaking into the event loop (`_backfillTrades()` rejection caught and silenced).
- `server.mjs` · (high) heartbeat interval at line 82 wrote to SSE clients without try-catch; if `res.write()` throws, the interval crashes silently and no further heartbeats reach ANY client. Heartbeat now guarded with try-catch; if a write fails, that response is deleted from the broadcast set and destroyed.
- `lib/engine/orderbook.mjs` · (medium) history ring bounded only by `historySeconds` (time) and count check `h.length > historySeconds`, but on slow feeds the count check never triggers — with 1 snapshot per 10 seconds, 600 snapshots would take 6000 seconds to accumulate. Added `MAX_SNAPSHOTS = 2000` hard limit; the record method now enforces `h.length > Math.min(historySeconds, MAX_SNAPSHOTS)` so the ring never exceeds the hard cap regardless of snapshot frequency.

- **Round-2 review fixes (2026-10-05)** · `lib/engine/analyst.mjs` · (high) 'done' event listener at line 183 was never detached on stop(), causing a memory leak and duplicate event handlers on restart when start() is called again. Listener is now stored in `sym.feedHandlers.onDone` and detached in stop() like all other feed handlers, preventing listener accumulation across restart cycles.
- `lib/journal.mjs` · (medium) `_ensureDir()` was called before every append; if the directory became read-only AFTER the first write (permissions change, filesystem remount as read-only on Termux, Android lifecycle), all subsequent writes would fail with mkdirSync throwing EACCES; the journal would become unrecoverable. Fixed by caching the directory creation: `_ensureDir()` now sets `_dirEnsured = true` after the first call and returns immediately on subsequent calls, so mkdirSync is called exactly once per Journal instance, and write failures surface from appendFileSync (where they belong).
- `lib/feeds/binance.mjs` · (medium) `_lastDepthId` persisted across reconnects; if a socket reconnected without a fresh REST snapshot (e.g., REST call failed), the first stream frame would be compared against the previous `_lastDepthId`, potentially dropping new frames if they arrived out of sequence due to network jitter. Fixed by resetting `this._lastDepthId = undefined` in `_openSocket()` so that the next REST snapshot (or the first stream frame) establishes a fresh baseline for the new connection, accepting frames from a reconnected feed without stale-frame filtering from the previous session.
