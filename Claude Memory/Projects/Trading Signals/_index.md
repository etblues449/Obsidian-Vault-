# Trading Signals — Project Index

## Goal
Independently verify (or bury) the "GOLD VIP" / "THE WAR ZONE" Telegram XAUUSD signals **on paper, at Elliot's own risk sizing, before any real money moves** — and keep a hard funding gate between the channel's marketing and the bank account.

## Status (2026-07-10)
- **Due diligence: complete, verdict negative** — T4Trade is on the FCA warning list (no FOS/FSCS), blacklisted by AMF France, on FSMA Belgium's *fraudulent platforms* list, warned by CNMV/CMVM/Consob; heavy withdrawal-complaint pattern; **no API exists** (MT4 only), so portal auto-execution is impossible even in principle. The channel matches the documented signal-scam funnel point-for-point ("100% win rate" claim, forwarded MT4 screenshots, Zoom "account management" bot, giveaway spam, 5.00-lot sizing). Full citations: [[Due Diligence — GOLD VIP + T4Trade]].
- **Trade Guard console: live** — `tools/trade-guard.html` + published Claude artifact. Risk parameters → position sizer (parses pasted Telegram signals) → paper trade log → scorecard with 95% CI → equity curve → 6-gate funding gate → red-flag checklist. Rendered/tested both themes; all math verified (XAUUSD $100 per $1 per lot; lots = balance×risk% ÷ (stop$×100)).
- **Signal logger: written, parser unit-tested** — `tools/signal_logger.py` (Telethon, read-only, Termux-ready). Awaiting Elliot: my.telegram.org api_id/api_hash + first run. Zero-code fallback: Telegram Desktop → Export chat history → import JSONL into console.
- **Auto-resolver: live (2026-07-13)** — `tools/resolve_trades.py` adjudicates logged signals against real gold bars (Yahoo 15m → Stooq daily fallback, keyless, stdlib-only): TP-first = win, SL-first = loss, bar spanning both = ambiguous → manual call. Console import now applies resolutions (E2E-tested: auto-close, idempotent re-import, correct P&L). Idea ported from HKUDS/Vibe-Trading's loader-fallback + exit-reason design after evaluating the full framework — the platform itself (FastAPI/React/LLM agent) was rejected as a replacement: wrong tool class for a phone-first verification console, and an LLM trading agent is what the funding gates guard against.
- **worldmonitor repo: cloned & reviewed** (scratchpad, not vendored into vault — it's a 4,000-file AGPL TypeScript app). Verdict: excellent *market-context* dashboard (gold/commodity variant at commodity.worldmonitor.app; `npm run dev:finance` locally); it is not and should not be a trade executor. Revisit if a self-hosted market screen is wanted on the Fold 7.

## Key Decisions
- **No real-money execution by Claude, and no auto-execution wired to this channel.** Paper verification first; the funding gate decides, not sentiment. Two gates are structural: signals must be provably posted *before* the move, and any live broker must be FCA-authorised (T4Trade fails this permanently).
- Risk caps: 1% per trade, 5% daily, ≥30 closed trades + ≥28 days forward test, PF ≥ 1.3, max DD ≤ 20%.
- Telethon user-session (not Bot API — bots can't read channels without owner-granted admin; confirmed still true 2026). Read-only, aged account = documented low-risk case.
- Commercial Telegram→MT4 copiers rejected (blind execution + would wire to a warned broker).

## Next Actions
- [ ] **Elliot: withdraw the residual $4.72 from T4Trade** — live test of their withdrawal process; deposit nothing further.
- [ ] **Elliot: block/report @Signalstevebot; never join the Zoom calls.**
- [ ] Elliot: get api_id/api_hash from my.telegram.org → run `signal_logger.py --login` then `--list` in Termux (guide: `tools/README.md`).
- [ ] Run the paper loop for 4+ weeks; import `signals.jsonl` into Trade Guard weekly.
- [ ] Review scorecard at 30 closed trades — expected outcome per base rates: channel fails the gate (independent audit of a comparable channel: 26% actual win rate vs "100%" claimed).
- [ ] Optional: report the channel (FCA form / Action Fraud / Telegram report).

## Reference
- [[Due Diligence — GOLD VIP + T4Trade]] — full cited findings (FCA/AMF/FSMA/FSA primary sources)
- `tools/README.md` — the verification loop + Termux setup
- Sessions: [[sessions/2026-07-10]]
