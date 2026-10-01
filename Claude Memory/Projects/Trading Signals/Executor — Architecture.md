# Executor — Architecture (decided 2026-09-06)

Autonomous XAUUSD signal executor. Supersedes the "no auto-execution" decision of 2026-07-10 **only** under the controls below; the research that forced the stack change is in [[Research — Executor Stack Verdict 2026-09-05]].

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Broker | **OANDA Europe Ltd** (FCA 542574), v20 REST + streams | Long-lived personal token (no interactive login, survives reboots); the only broker with an explicit personal-automation licence clause (Apr 2026); practice environment identical to live; UK spread bets. Fallback: Capital.com. |
| Execution host | **Raspberry Pi / home box**, Python 3.11, systemd | Every viable broker API needs a persistent session; Vercel cannot hold one. MetaTrader-only brokers are excluded (MT5 Python is Windows-only). |
| Dashboard / sync | **Supabase** (existing project) + **`/trade` in jarvis-carousel** (Next.js 14) as an installable **PWA** | House pattern (PostgREST over fetch, bearer-gated API routes, `next-pwa` already present); one Vercel project (hobby cap). Pake is desktop-only → not used for mobile. |
| Signal ingest | Telethon read-only user session **on the Pi** | Bots cannot read channels. Session file lives in `~/.config/tradeguard`, never in the vault (2026-09-05 incident). |
| Alerts | Telegram Bot (worker) + Web Push (dashboard) | Bot token is outbound only. |
| Live vs practice | `OANDA_ENV=practice` default; `live` refuses to start unless all six funding gates pass **or** `GATE_OVERRIDE` equals the exact phrase; decision + reason logged to `events` | Elliot's "real execution now" is honoured as an explicit, logged override — never a silent default. |

## Data flow

```
GOLD VIP (Telegram) ──Telethon──▶ executor worker (Pi, systemd) ──REST──▶ OANDA v20
                                    │  parse → validate → guards → size    ◀──stream── fills/closes
                                    ├──▶ ~/.config/tradeguard/*.json(l)   (source of truth for guards)
                                    └──▶ Supabase: signals, trades, events, settings  (mirror)
                                                        │ Realtime
                                    jarvis-carousel /trade (PWA) ◀─────────┘
                                    kill switch · gate override · manual checks → settings row
```

## Risk controls enforced in code (worker, before any order)

1 % per trade (USD-converted, floored to the instrument's unit precision, **refused** below the broker minimum) · 5 % daily loss cap (London day) · 3 orders/day · 1 open trade · 20 % max-drawdown breaker on NAV vs stored peak · stale-signal drift ≤ 50 % of the stop · one order per message · kill switch (file **or** dashboard) · SL/TP always attached broker-side on fill · FOK market orders, no blind retries.

## Code

`tools/executor/` — `config.py` (env only; 32-bit `api_id` check; override phrase), `parser.py` (port of `signal_logger.parse_signal`, unified TP regex, validation), `risk.py` (sizing, stats with 95 % CI, six gates, daily/drawdown guards), `broker/oanda.py` (stdlib urllib v20 client: orders, pricing, home conversion, trades, reconnecting LDJSON streams), `store.py` (local JSONL/JSON + Supabase PostgREST mirror), `notify.py` (Telegram Bot), `telegram_source.py` (Telethon), `main.py` (loop, reconcile, `--login/--list/--check/--dry-run`), `tests/` (unittest, no network), `tradeguard-executor.service`, `README.md` (runbook).

## Verification ladder

1. Unit tests green (`python -m unittest discover -s executor/tests -t .`).
2. `--check` on the Pi: OANDA practice login, `XAU_USD` spec, live price, sample sizing, Supabase, gates.
3. `--dry-run` through a real GOLD VIP signal: parsed → sized → `dry_run_order` event, no order.
4. Practice run: a real signal → practice order with SL/TP visible in OANDA; kill switch halts the next; daily cap refuses.
5. Live: gate or explicit override, `RISK_PCT=0.5` for the first week.

## Open items carried from research

FCA perimeter for a signal follower and Telegram's userbot ToS are unverified; OANDA's practice gold spread and minimum unit are a 5-minute check on `--check`; the channel has no verified track record — the base rate at this broker is 76.6 % of retail CFD accounts losing money.

Related: [[_index]] · [[Research — Executor Stack Verdict 2026-09-05]] · [[Due Diligence — GOLD VIP + T4Trade]] · `tools/executor/README.md`
