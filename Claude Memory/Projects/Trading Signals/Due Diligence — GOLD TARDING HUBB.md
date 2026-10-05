# Due Diligence — GOLD TARDING HUBB

**Added to the paper-verification portfolio 2026-10-04** at Elliot's request, with exactly the
same treatment as GOLD VIP: the logger records every post, the parser reads the signals, the
resolver scores TP1-vs-SL against real gold bars, the console and the funding gate decide.
Nothing here is executed with real money; the executor's gates are unchanged.

## What was observed (screenshot, 2026-10-04)

- Telegram channel titled **GOLD TARDING HUBB** (the channel's own spelling — the matcher is a
  case-insensitive substring, so the trailing badge/emoji in the title does not matter),
  443 subscribers at the time.
- 12:25 — a signal: `XAU/USD GOLD BUY 4177 / 4174 · TP 4181 · TP 4184 · TP 4187 · TP 4195 · SL 4167`.
- 12:49 — three posts within the same minute: "TP 1 HIT 40+ PIPS DONE", "TP 2 HIT 70+ PIPS
  DONE", "TP 3 HIT 100+ PIPS DONE".
- Immediately after: "Hi guys 👋 Are you in Big Loss? And big Running loss … Join For Account
  Management."

## How the tools read it

| Field | Value | Note |
|---|---|---|
| side | BUY | |
| entry | **4177** | the channel gave a zone 4174–4177; the paper fill is the **worse** edge for a buy, so the record never flatters the channel |
| SL | 4167 | 10 below the fill |
| TP1 (scored) | 4181 | +4 → **R:R 0.4 : 1** |
| TP2 / TP3 / TP4 | 4184 / 4187 / 4195 | R:R 0.7 / 1.0 / 1.8 |
| follow-ups | noise | "TP 1 HIT …" and the account-management pitch parse to nothing — they can never be mistaken for a new signal |

Both parsers (`signal_logger.py` dict, `executor/parser.py` dataclass) now understand entry zones
and keep every TP (`tps`); `tp` remains the first target, which is what `resolve_trades.py` and
the console score. Regression tests use this exact message.

## Red flags, in the same frame as GOLD VIP

- **Self-reported wins, no verified track record.** "TP HIT" posts are the channel marking its
  own homework 24 minutes after the call. The bar is a live Myfxbook / FX Blue link.
- **The account-management funnel** follows the win posts directly. That is where the pressure
  to deposit happens; it is the single clearest tell in the regulator warnings.
- **Multi-TP posting makes "win" cheap to claim.** TP1 is +4 against a −10 stop: one stop costs
  two and a half TP1 wins. A channel can show "100+ pips DONE" on TP3 while the honest TP1
  expectancy is negative. This is exactly the number the scorecard measures.
- "40+ pips" for a $4 move means they count a pip as $0.10 — not wrong, but it makes small moves
  sound large.
- **Not a reason to short-circuit the process:** the point of logging it is to let the evidence
  decide over ≥ 30 closed signals and ≥ 28 days, like GOLD VIP.

## What Elliot does on the phone

```bash
cd ~/Obsidian-Vault- && git pull
cd "Claude Memory/Projects/Trading Signals/tools"
python signal_logger.py --list        # confirm the exact dialog title contains "GOLD TARDING HUBB"
termux-wake-lock && python signal_logger.py   # restart the listener — it now reports `listening:` for the new channel too
```

The executor's default `TG_CHANNELS` includes the channel as well; `executor.env` overrides it if
set. Dry-run first, as for any new source.

Related: [[_index]] · [[Due Diligence — GOLD VIP + T4Trade]] · `tools/README.md`
