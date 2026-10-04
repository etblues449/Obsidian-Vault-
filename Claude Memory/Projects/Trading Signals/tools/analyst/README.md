# TradeGuard Analyst — live charts, autonomous analysis, paper setups

A zero-dependency Node ≥ 22 app that serves the TradeGuard dashboard on
`http://localhost:8080` (Fold 8 Ultra / Termux and Windows) and analyses four charts
without anyone watching them. It ingests 1-minute candles and aggressor-tagged trades,
keeps multi-timeframe state, runs five layers of analysis on every candle close, and emits
**setups** through a Condition → Zone → Trigger gate — side, entry, stop at the
manipulation extreme, opposing-liquidity targets, R:R, score, grade, and the reasons in the
language of the strategy sources. Every setup is journaled and resolved walk-forward against
real prices, so the scorecard tells you which confluences actually work.

**Nothing here places orders.** The optional executor bridge is off by default, gold-only,
and only ever posts to the existing executor's webhook on `127.0.0.1` — every executor gate
still applies. The strategy sources it implements are checked in verbatim under
`docs/sources/` so the engine can be audited against them.

## The four charts and where the data comes from

| Tab | Feed | What you are looking at |
|---|---|---|
| **BTCUSD** | Binance spot `BTCUSDT`, live | real-time 1m klines + every trade tagged by aggressor → true delta / CVD. No API key. |
| **XAUUSD** | Binance spot `PAXGUSDT`, live | PAX Gold — a token redeemable for physical gold that tracks spot XAU within a few dollars. Same stream types, true delta. The only symbol the executor bridge may forward (the executor is gold-only). |
| **NQ1!** | **simulated** (badge `SIM`) | There is no free, keyless real-time feed for CME futures. A seeded random walk keeps the whole pipeline exercised; the seed price is a placeholder, not a quote. |
| **OIL** | **simulated** (badge `SIM`) | Same reason. |

To put real data behind NQ1!/OIL: set `"feed": "yahoo"` in `config/symbols.json` (15-minute
**delayed**, best effort — Yahoo rate-limits and changes without notice; the badge says
`DELAYED` and delta falls back to a body/range proxy), or write a broker adapter — see
*Extending*. The feed badge on every row is the truth about what you are looking at.

## Quick start — Termux (Fold 8 Ultra)

```bash
pkg install nodejs                     # need 22+ : node --version
cd ~/Obsidian-Vault- && git pull
cd "Claude Memory/Projects/Trading Signals/tools/analyst"
sh scripts/install-termux.sh           # ~/tradeguard symlink, Node check, Termux:Boot script, preflight, start
```

Then once: install **Termux:Boot** from F-Droid and open it; Android Settings → Apps → Termux
→ Battery → **Unrestricted** (same for Termux:Boot); Chrome → `http://localhost:8080` → ⋮ →
*Add to Home screen*. From then on the phone boots → the analyst is running → tap the icon.
Manual control: `npm start` (foreground), `termux-wake-lock` first if you run it by hand,
`pkill -f "analyst/server.mjs"` to stop, log at `~/tradeguard-analyst.log`.

## Quick start — Windows

Install Node 22 LTS, then in a terminal:

```powershell
cd "C:\path\to\Obsidian-Vault-\Claude Memory\Projects\Trading Signals\tools\analyst"
npm run check      # preflight: node version, config, data dir, port, Binance reachability
npm start          # http://localhost:8080
```

`ANALYST_PORT=8090 npm start` (PowerShell: `$env:ANALYST_PORT=8090; npm start`) if 8080 is
taken. The server binds `127.0.0.1` only; set `ANALYST_HOST=0.0.0.0` deliberately if another
device on the LAN should see it.

## Dashboard tour

Top to bottom (phone) / chart + CZT side by side (desktop ≥ 1024 px):

- **Header** — status pill for the active symbol: *Connecting… / Live / Delayed / Simulated /
  Reconnecting… / Error*. Light theme only (by request — no dark mode).
- **Symbol tabs** and **timeframe pills** (1m 5m 15m 1h 4h). Keys `1–4`, `t`.
- **Chart** — candles, EMA 9 / 21 / 50, session VWAP, volume pane, delta pane; price lines for
  every liquidity level (previous-day high/low, session highs/lows, Asia range, equal
  highs/lows, consolidation edges, POC / VAH / VAL, naked POCs — swept levels dashed); FVG and
  order-block zones as shaded boxes; markers for sweeps, absorption prints, setups (with grade)
  and session opens. Times are Europe/London because the sources are session-based.
- **CZT panel** — the three columns of the gate with ✓ per hit, the score bar, and the current
  setup card: side, entry, stop, targets with R, size at your risk %, invalidation, reasons.
  When a qualifying setup is held back by a cap, the panel says why.
- **Watchlist** — all four symbols: price, change, session, bias, feed badge, last setup.
- **Execution feed (live logs)** — newest first, filter by symbol. Levels: `INFO` (closes,
  connections), `OK`, `WARN` (reconnects, fallbacks), `SIGNAL` (setups), `GUARD` (caps,
  volatility, refusals), `ERROR`.
- **Scorecard** — by trigger, symbol, grade or session: n, win rate with a 95 % Wilson
  interval, expectancy in R, profit factor, max drawdown in R.

## How the engine decides

On every closed **5m** candle (`timeframes.analysis`), per symbol:

1. **Sessions** (`sessions.mjs`) — Asia / London / New York / late NY in Europe/London wall
   time, DST-aware; killzones inside London and NY. *Source 03: time dictates the move.*
2. **Liquidity** (`liquidity.mjs`) — previous-day high/low, previous-session and Asia range,
   equal highs/lows, consolidation edges; sweep detection on the last closed candle (wick
   through a level by a bounded depth, reclaim on close or within a few candles).
   *Sources 02 and 04: liquidity rests at previous highs/lows and around consolidation;
   buy-side taken → target sell-side.*
3. **Structure** (`structure.mjs`) — swings, BOS / CHoCH, fair-value gaps, order blocks,
   engulfing, higher-timeframe bias (1h EMA slope and 9/21 relation, halved when the 4h
   structure disagrees). *Source 01: the engulf and the imbalance; source 04: the order
   block after the sweep.*
4. **Order flow** (`orderflow.mjs`) — per-candle delta from aggressor-tagged trades (or an
   honestly-labelled proxy), CVD and its divergence against price swings, absorption
   (heavy volume, no result, the right wick and delta sign), volume profile with POC and the
   70 % value area, HVN / LVN, P / b / D / thin shape, naked POCs. *Source 05, implemented
   from its definitions.*
5. **CZT** (`czt.mjs`) — *Condition* (bias aligned, inside a killzone, inside/outside
   yesterday's value), *Zone* (price at a level or zone that fits the side), *Trigger*
   (sweep-and-reclaim, absorption, CVD divergence, engulfing, lower-TF break, delta confirms).
   Weighted sum over `czt.weights`; a setup needs ≥ 1 zone hit **and** ≥ 1 trigger hit,
   `score ≥ minScore`, `rr ≥ minRr`. Grades: A ≥ 9, B ≥ 7, else C.

Non-negotiables, enforced in code:

- **The stop is the manipulation extreme** ∓ a small ATR buffer when a sweep triggered the
  setup (source 01, "non-negotiable"). No sweep → the far edge of the zone. Stops wider than
  `maxStopAtr` ATR are rejected.
- **Targets are the nearest opposing liquidity** (session high/low, previous-day high/low,
  equal highs/lows, value-area edge, naked POC), each giving at least `minRr`; swept levels
  are never targets (source 04).
- **No trigger "in the middle of nowhere"** — no zone hit, no setup (source 05).
- **Outside a killzone nothing emits** (`sessions.tradeOnlyInKillzones`; source 02/03:
  London purge → New York entry).
- **Caps** — `maxSetupsPerSymbolPerDay`, `cooldownMinutes`, `oneOpenPerSymbol`,
  `risk.maxOpenAcrossSymbols`; a blocked candidate is shown in the CZT panel, not silently
  dropped.
- **No fixed take-profit philosophy** (source 05 §7) — the journal measures R against the
  original invalidation point and trails the stop behind newly confirmed structure swings
  once the setup has proved +1 R.

### What "best fit" means

The scorecard groups resolved setups by trigger kind, symbol, grade or session. The groups
with positive expectancy in R over a real sample are the confluences worth trusting on that
instrument. Treat nothing as proven under **30 resolved setups and 28 days** — the same bar
the paper console uses for the Telegram channels, for the same reason: a coin flips ten heads
in a row more often than intuition says.

## Configuration — `config/strategy.json`

Every number the engine uses, with the source it comes from:

| Key | Default | Meaning · source |
|---|---|---|
| `timeframes.base/analysis/structure/bias/htf` | 1m / 5m / 15m / 1h / 4h | which TF each layer reads |
| `history.backfillMinutes` | 4320 | 72 h of 1m history on start (5 Binance pages); the 1h bias needs 60 closed hours to warm |
| `history.maxCandlesPerTf` | 5000 | ring size per TF (bounded memory) |
| `sessions.list[]` | Asia 00–07, London 07–12 (KZ 07–10), NY 12–17 (KZ 13:30–16), late 17–24 | Europe/London wall time · source 03 |
| `sessions.tradeOnlyInKillzones` | true | source 02 |
| `indicators.emaFast/emaSlow/emaBias/atrPeriod/swingLookback` | 9 / 21 / 50 / 14 / 2 | |
| `liquidity.equalLevelToleranceAtr` | 0.15 | two swings this close = one liquidity pool · source 04 |
| `liquidity.sweepMinDepthAtr/sweepMaxDepthAtr` | 0.05 / 2.0 | a wick through a level counts as a sweep in this range · source 01 |
| `liquidity.sweepReclaimCandles` | 3 | a reclaim may come up to this many candles after the wick |
| `liquidity.consolidationCandles/consolidationMaxRangeAtr` | 12 / 2.5 | consolidation = liquidity on both sides · source 04 |
| `structure.displacementBodyAtr` | 1.2 | body size that makes an order block · source 04 |
| `structure.fvgMinSizeAtr` | 0.1 | imbalance worth marking · source 01 |
| `structure.engulfingMinBodyAtr` | 0.5 | source 01 |
| `orderflow.absorptionVolumeMult/absorptionMaxRangeAtr/absorptionMinWickRatio` | 2.0 / 0.6 / 0.5 | effort without result · source 05 §4 |
| `orderflow.absorptionMeanCandles` | 20 | baseline window before the candidate |
| `orderflow.cvdDivergenceSwings` | 2 | source 05 §3 |
| `orderflow.volumeProfileWindowCandles/volumeProfileBucketsAtr/valueAreaPct` | 288 / 0.1 / 0.70 | source 05 §5 |
| `orderflow.nakedPocLookbackDays` | 5 | |
| `czt.zoneToleranceAtr` | 0.5 | "at the zone" |
| `czt.weights.*` | see file | per-hit weights for the three columns |
| `czt.minScore/gradeA/gradeB/minRr` | 6 / 9 / 7 / 1.5 | |
| `czt.stopBufferAtr/maxStopAtr` | 0.1 / 3.0 | source 01 |
| `czt.targetsFrom[]` | session H/L, PDH/PDL, equal H/L, value area, naked POC | priority order · source 04 |
| `czt.maxSetupsPerSymbolPerDay/cooldownMinutes/oneOpenPerSymbol` | 3 / 30 / true | |
| `czt.triggerMaxAgeCandles` | 6 | how old a divergence / break may be and still trigger |
| `risk.balance/riskPct/dailyLossPct/maxOpenAcrossSymbols` | 1000 / 1 / 5 / 2 | mirrors the executor caps; `balance` is a display assumption (`ANALYST_BALANCE`) |
| `journal.resolveTimeoutHours/trailByProvedAuctions` | 48 / true | source 05 §7 |
| `executorBridge.*` | enabled false, XAUUSD, grade A | see below |

Environment overrides: `ANALYST_HOST`, `ANALYST_PORT`, `ANALYST_DATA_DIR`, `ANALYST_BALANCE`,
`ANALYST_SYMBOLS=BTCUSD,XAUUSD`, `ANALYST_FEED=simulated` (every symbol) or
`ANALYST_FEED_BTCUSD=replay`, `ANALYST_SET='czt.minScore=5;risk.riskPct=0.5'` (any dotted
path, re-validated), `ANALYST_EXECUTOR_URL`, `ANALYST_EXECUTOR_ENABLED=1`,
`ANALYST_EXECUTOR_SECRET` (never written anywhere).

## Backtest and report

```bash
node backtest.mjs --symbol BTCUSD --days 7            # fetches 7 days of 1m klines from Binance, replays, resolves, prints the scorecard
node backtest.mjs --symbol XAUUSD --days 7 --json      # machine-readable
node backtest.mjs --symbol BTCUSD --offline test/fixtures/btc-1m.json   # no network: the 2,000 real candles shipped with the tests
npm run report                                        # scorecard by trigger / symbol / session + last 20 setups as markdown, also saved under data/reports/
```

Backtests have no trade tape, so delta is the body/range proxy there (the output says so);
live runs on Binance symbols use real aggressor volume.

## Executor bridge (off by default)

When `executorBridge.enabled` is true (or `ANALYST_EXECUTOR_ENABLED=1`), grade-A setups on
the symbols listed (default: XAUUSD only) are POSTed to the executor's TradingView webhook as
`{ secret, alert_id, time, side, entry, sl, tp }`. The secret is read from
`ANALYST_EXECUTOR_SECRET` at send time and never stored or logged; each `alert_id` is sent at
most once, even if the first attempt timed out (a doubled order is the one unrecoverable
error). The executor still parses, validates, sizes and gates every alert exactly as it does a
Telegram signal — dry-run first, as for any new source.

**Port collision to know about:** the executor's TradingView listener also defaults to port
**8080** (`TRADINGVIEW_WEBHOOK_PORT`), the same as this dashboard. Running both on one device
means either `TRADINGVIEW_WEBHOOK_PORT=8787` in `executor.env` (which is this bridge's default
URL, `http://127.0.0.1:8787/webhook`) or moving the dashboard with `ANALYST_PORT` and pointing
`ANALYST_EXECUTOR_URL` at the executor's port. Whichever loses the race reports `EADDRINUSE`
and exits rather than silently binding elsewhere.

## Extending

**Add a feed adapter** (4 steps): copy `lib/feeds/simulated.mjs` to `lib/feeds/<name>.mjs`;
implement `connect()` / `close()` and emit `history`, `candle`, `trade`, `status` in the shapes
documented in `lib/feeds/base.mjs`; register it in `lib/feeds/registry.mjs`; set
`"feed": "<name>"` on a symbol in `config/symbols.json`. Tests inject fakes through `deps`
(`fetch`, `WebSocket`, timers) — see `test/feeds.test.mjs`.

**Add a trigger** (3 steps): compute the signal in the right engine module and pass it in
the `ctx` built by `lib/engine/analyst.mjs`; add the hit in `lib/engine/czt.mjs`
(`trigger.<name>`) with a reason line in the sources' language; add the weight to
`czt.weights` in `config/strategy.json` (the config validator rejects unknown weight keys,
so add it to `WEIGHT_KEYS` in `lib/config.mjs` too).

**Add a symbol**: one entry in `config/symbols.json` (`id`, `name`, `feed`, `feedParams`,
`dp`, `tick`, `contract`). The tabs, watchlist and journal pick it up; keys `1–9` reach it.

## Tests

```bash
npm test          # node --test — every module, the server on a random port, an end-to-end sweep-and-reclaim scenario, the offline backtest
npm run check     # preflight
```

All tests are offline: feeds are faked, the clock is injected, the 2,000-candle BTC fixture
is real Binance data captured 2026-10-03/04.

## Troubleshooting

- **Port in use** — `EADDRINUSE` is reported with the port; set `ANALYST_PORT`. The usual
  culprit on the phone is the executor's TradingView listener, which also defaults to 8080.
- **Pill says *Simulated* on BTCUSD/XAUUSD** — Binance was unreachable (or blocked by the
  network you are on). The feed retried with backoff and fell back to simulation from the
  last real price so the dashboard keeps working; the feed shows the WARN line with the
  reason. It keeps retrying the live stream in the background.
- **Pill flickers *Reconnecting…* once a day** — Binance closes streams at 24 h; the
  adapter reconnects and re-backfills the gap. Normal.
- **Termux killed it in the background** — battery setting not Unrestricted, or no wake
  lock; `install-termux.sh` sets the boot script up with `termux-wake-lock`.
- **Bias stays *neutral* for a while after a restart** — the 1h EMA50 needs 60 closed hours;
  the 72 h backfill covers it, a shorter `history.backfillMinutes` does not.
- **Clock / DST** — sessions use `Intl` with `Europe/London`; Node ships the time-zone data,
  nothing to install. If the phone's clock is wrong, candles will look late — fix the clock.
- **`node --test test/` fails** — Node 22 rejects a bare directory; use `npm test`.
