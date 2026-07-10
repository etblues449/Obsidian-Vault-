# Trade Guard — tools

Paper-trading verification pipeline for the GOLD VIP / THE WAR ZONE Telegram
signals. **Nothing in this folder places real orders.** The point is to make
the channel prove itself on paper, at your risk sizing, before a single pound
is exposed.

## Pieces

| File | What it is |
|---|---|
| `trade-guard.html` | The console. Open it in any browser (works offline). Also published as a Claude artifact. |
| `signal_logger.py` | Read-only Telethon listener for Termux. Appends every channel message to `signals.jsonl`, parsing XAUUSD signals where it can. |
| `signals.jsonl` | Created by the logger. Import it into the console with the **Import** button. Git-ignored by default is fine — it's regenerable. |

## The loop

1. **Capture** — run `signal_logger.py` in Termux (or just paste signals into
   the console by hand; the paste box parses `SELL @ 4334 SL 4340 TP 4326`
   style text directly).
2. **Size** — the console computes the lots *your* risk parameters allow
   (default 1% per trade), and shows what the channel's 5.00-lot sizing would
   have done to your account.
3. **Log** — one tap logs the paper trade. Close it at TP, SL, or a manual
   price when the market resolves it.
4. **Score** — win rate (with a 95% confidence interval, which is the part the
   channel's marketing leaves out), expectancy, profit factor, max drawdown,
   paper equity curve.
5. **Gate** — six funding gates. All green before real money is even a
   conversation. Two are manual honesty checks (signals arrive *before* the
   move; broker is FCA-authorised).

## Termux setup for the logger

```bash
pkg install python
pip install telethon
cd ~/jarvis/vault/"Claude Memory/Projects/Trading Signals/tools"
python signal_logger.py --login    # one-time; api_id/api_hash from my.telegram.org
python signal_logger.py --list     # find the exact channel names/IDs
python signal_logger.py            # listen + log
```

Credentials: export `TG_API_ID` / `TG_API_HASH` in the shell or type them at
the prompt. Never write them into a vault note (CLAUDE.md rule). The
`jarvis_tg.session` file that Telethon creates is a credential too — keep it
out of git (`.gitignore` it if the tools folder ever syncs it).

## Why paper first (the short version)

- A "100% win rate" claim is not evidence, it's a tell. Over 15 trades, a
  coin-flip strategy hits a 10-streak surprisingly often across thousands of
  channels — you only ever get shown the survivors.
- MT4 history screenshots are trivially faked (demo accounts, one leg of a
  hedged pair, editing tools). The bar is a **live Myfxbook / FX Blue** link.
- Signal channels typically earn introducing-broker commission per lot from a
  partnered offshore broker — they get paid when you trade, not when you win.
- 30+ trades over 4+ weeks at your own sizing is the minimum sample where a
  win rate starts to mean anything. The console enforces exactly that.
