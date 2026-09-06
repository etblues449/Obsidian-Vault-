# Trade Guard executor — OANDA v20, XAU_USD

One persistent Python process on a Raspberry Pi that turns GOLD VIP Telegram
signals into OANDA orders with broker-side stop-loss and take-profit, under
the same risk rules as the paper console — plus the two the console only
displayed: a **daily loss cap** and a **max-drawdown breaker**.

**Practice by default.** Live needs either a passed funding gate or the
exact override phrase, and either path is written to the event log.

```
Telegram (read-only user session) → parse → validate → kill switch → live gate
  → daily cap · drawdown breaker · open-trade cap · duplicate check
  → live price + stale-signal check → size from broker spec (never rounds up)
  → MARKET order with stopLossOnFill / takeProfitOnFill → record → alert
Fills/closes arrive on OANDA's transaction stream = broker truth, not a guess.
```

## What you need

| Thing | Where |
|---|---|
| Raspberry Pi 4/5, 64-bit Raspberry Pi OS, Python 3.11+ | always on; a UPS or at least a "reboot on power" setting |
| OANDA Europe account (FCA 542574) — **practice first** | oanda.com → practice → *Manage API Access* → generate a personal token; note the account id `001-…` |
| Telegram `api_id` + `api_hash` | my.telegram.org → API development tools (a 6–8 digit id; a 10-digit number is wrong) |
| Optional: Supabase project URL + **service-role** key | dashboard sync — apply `executor/supabase/schema.sql` in the project's SQL editor first (RLS on, no anon access; the dashboard goes through the bearer-gated API route) |
| Optional: Telegram **bot** token + your chat id | alerts (talk to @BotFather; get your id from @userinfobot) |

The bot token is *outbound alerts*. Signal *ingest* still needs the user
session — bots cannot read channels they do not admin.

## Install (on the Pi)

```bash
sudo apt update && sudo apt install -y git python3-venv
git clone https://github.com/etblues449/Obsidian-Vault-.git ~/Obsidian-Vault-
ln -s ~/Obsidian-Vault-/"Claude Memory/Projects/Trading Signals/tools" ~/tradeguard   # no spaces for systemd
python3 -m venv ~/tradeguard-venv
~/tradeguard-venv/bin/python -m pip install -r ~/tradeguard/executor/requirements.txt

mkdir -p ~/.config/tradeguard && chmod 700 ~/.config/tradeguard
cat > ~/.config/tradeguard/executor.env <<'EOF'
OANDA_ENV=practice
OANDA_TOKEN=
OANDA_ACCOUNT_ID=
TG_API_ID=
TG_API_HASH=
TG_CHANNELS=GOLD VIP,THE WAR ZONE
# optional
SUPABASE_URL=
SUPABASE_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
# risk (defaults shown)
RISK_PCT=1
DAILY_LOSS_PCT=5
MAX_TRADES_PER_DAY=3
MAX_OPEN_TRADES=1
MAX_DD_PCT=20
MAX_ENTRY_DRIFT=0.5
EOF
chmod 600 ~/.config/tradeguard/executor.env
```

Fill the values in. Never paste them into a vault note, a chat, or git —
`*.session`, `*.env` and the state dir are git-ignored, and the executor's
logs mask every secret.

## First run

```bash
cd ~/tradeguard
~/tradeguard-venv/bin/python -m executor --login    # phone + code once → session file in ~/.config/tradeguard
~/tradeguard-venv/bin/python -m executor --list     # confirm the channel names/ids; adjust TG_CHANNELS if needed
~/tradeguard-venv/bin/python -m executor --check    # OANDA login, instrument spec, live price, sample sizing, Supabase, gates
~/tradeguard-venv/bin/python -m executor --dry-run  # everything except sending orders — watch a real signal flow through
```

`--check` prints a sample sizing for `SELL @ 4334 SL 4340`. If it says the
result is below the broker minimum, the executor **will refuse** such
signals at that balance/risk — it never rounds up to the minimum.

## Run as a service

```bash
sudo cp ~/tradeguard/executor/tradeguard-executor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tradeguard-executor
journalctl -u tradeguard-executor -f
```

The unit restarts on crash (max 5 starts per 5 minutes so a bug can't hammer
the broker) and re-syncs the open-trade book with OANDA on every start.

## Kill switch

Any of these stops **new** orders immediately; existing positions keep their
broker-side SL/TP:

- `touch ~/.config/tradeguard/KILL` (remove the file to resume)
- set `kill_switch = true` on the `settings` row in Supabase (the dashboard's button)
- `sudo systemctl stop tradeguard-executor`

## Going live

1. Change `OANDA_ENV=live`, `OANDA_TOKEN` (a live token) and `OANDA_ACCOUNT_ID` (the live account) in the env file.
2. The executor refuses to start live unless **all six funding gates** pass (≥30 closed trades, ≥28 days, PF ≥ 1.3, max DD ≤ 20 %, and the two manual checks in `settings`) — **or** you set
   `GATE_OVERRIDE=I ACCEPT THE RISK OF LIVE TRADING WITHOUT A PASSED GATE`
   exactly. Either way the decision, the reason and the override flag are written to the event log and shown in the dashboard. Nothing is silent.
3. Start small: the first live orders will be whatever `RISK_PCT` of the live balance sizes to; consider `RISK_PCT=0.5` for the first week.

## Risk controls, in order of evaluation

| Control | Behaviour |
|---|---|
| Parse + validate | stop on the wrong side, TP on the wrong side, stop > 5 % of price, price outside [500, 20000] → rejected |
| Kill switch | file or dashboard flag → refused |
| Live gate | live env only: six gates or the override phrase |
| Duplicate | one order per Telegram message, ever |
| Open-trade cap | `MAX_OPEN_TRADES` (default 1) |
| Daily trade cap | `MAX_TRADES_PER_DAY` (default 3), London day |
| Daily loss cap | realised P&L today ≤ −`DAILY_LOSS_PCT` of the day-start balance → refused for the rest of the day |
| Drawdown breaker | NAV ≥ `MAX_DD_PCT` below its peak → refused until the stored peak is reset (`state.json` → `peak_nav`) |
| Stale signal | current mid has moved more than `MAX_ENTRY_DRIFT` × stop distance from the signalled entry → refused |
| Sizing | `RISK_PCT` of balance (converted to USD) ÷ stop distance, floored to the instrument's precision; below `minimumTradeSize` → refused |
| Execution | FOK market order with `stopLossOnFill` + `takeProfitOnFill`; a cancel/reject is logged, never retried blindly |

## Dashboard — `/trade` in jarvis-carousel

The phone view lives in the existing JARVIS web app (`JARVIS-Carousel/app/trade`),
installable as a PWA (Add to Home Screen; it also appears as an app shortcut).

- **Vercel env (names only):** `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (service-role,
  server-side only — the browser never sees it), and the existing `JARVIS_API_TOKEN`.
- **First open:** `https://<your-app>/trade#token=YOUR_JARVIS_API_TOKEN` once; the token is
  stored on the device and scrubbed from the address bar.
- **Shows:** worker heartbeat age, env badge (PRACTICE / LIVE / DRY RUN), NAV, balance,
  gold price, scorecard and the six gates as the worker last reported them, open and
  closed trades, the event log.
- **Does:** **KILL / RESUME** (sets `settings.kill_switch`; the worker checks it before
  every order) and the two manual gate checks. Every dashboard action is also written
  to `events`, so the worker's log and the dashboard's log are one log.
- Polls every 5 s while visible; no Supabase key in the browser (RLS on, no anon policies).

### Push notifications (optional — Telegram alerts work without this)

1. Generate VAPID keys once: `npx web-push generate-vapid-keys`.
2. Vercel env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:you@example.com`,
   and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (the same public key, for the browser). Redeploy.
3. On the phone, open `/trade` (installed as a PWA) → **ENABLE PUSH ON THIS DEVICE**.
4. On the Pi, add to `executor.env`: `DASHBOARD_URL=https://<your-app>` and
   `DASHBOARD_TOKEN=<JARVIS_API_TOKEN>`. Restart the service. Every alert the worker sends
   to Telegram is now also pushed to each enabled device (fills, closes, refusals, kill).

Expired device subscriptions are pruned automatically when the push service rejects them.

## Files in `~/.config/tradeguard/`

`executor.env` (secrets) · `executor_tg.session` (Telegram login) · `KILL` (optional) ·
`signals.jsonl` · `events.jsonl` · `trades.json` · `state.json` (peak NAV, last txn id, cached settings, last heartbeat)

The local files are the worker's source of truth for every guard; Supabase
is a mirror for the dashboard and can be down without weakening risk control.

## Tests

```bash
cd ~/tradeguard && ~/tradeguard-venv/bin/python -m unittest discover -s executor/tests -t . -v
```

Stdlib `unittest`; no network. Covers the parser, sizing/stats/gates/guards,
the OANDA client (request shapes, fills, cancels, rejects, streaming), the
stores, config validation (including the 32-bit `api_id` check), and the full
executor loop against a fake broker.

## Troubleshooting

- `struct.error: 'i' format requires…` — the `api_id` is wrong (too big). The executor now refuses it at config time.
- OANDA `401` — token/environment mismatch (a practice token on `OANDA_ENV=live` or vice versa) or a revoked token.
- `cancelled: MARKET_HALTED` / `FOK` cancels — market closed (gold is closed Fri 22:00 → Sun 23:00 London) or price moved during the request; nothing is retried, the signal is logged as failed.
- "below broker minimum" — increase the balance or `RISK_PCT`, or accept that sub-minimum signals are skipped. Do not lower the broker minimum by hand: it is not yours to change.
- Telegram session invalid after a phone-side "terminate session" — run `--login` again.
