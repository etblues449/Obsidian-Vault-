# Due Diligence — "GOLD VIP" Telegram channel + T4Trade broker

**Date:** 2026-07-10 · **Prepared by:** Claude (research fan-out: 20 agents, every load-bearing claim adversarially verified against primary sources)
**Verdict up front:** Do not put money behind these signals, and do not deposit more at T4Trade. The channel matches the documented scam funnel point-for-point, and the broker is on the FCA's public warning list. Verify on paper first with the Trade Guard console — the evidence, not the marketing, decides.

---

## 1 · The broker: T4Trade (t4trade.com)

| Fact | Status | Source |
|---|---|---|
| Operated by Tradeco Limited; **only** licence is Seychelles FSA (securities dealer SD029). No FCA/CySEC/ASIC authorisation anywhere. | ✅ Confirmed against the FSA register | [fsaseychelles.sc](https://fsaseychelles.sc/regulated-entities/capital-markets) |
| **On the FCA warning list**: "This firm is not authorised by us and may be targeting people in the UK." First published 27 Feb 2023, still live (updated 11 May 2026). | ✅ Confirmed, fetched directly | [fca.org.uk/news/warnings/t4trade](https://www.fca.org.uk/news/warnings/t4trade) |
| FCA's own words: no **Financial Ombudsman** access, no **FSCS** compensation — "it's unlikely you'd get your money back if the firm goes out of business." | ✅ Confirmed verbatim | same FCA page |
| France (AMF): on the **Forex blacklist** since 17 Oct 2022. | ✅ Confirmed | [amf-france.org](https://www.amf-france.org/en/warnings/blacklists/forex/wwwt4tradecom) |
| Spain (CNMV): unauthorised-entity warning, 7 Nov 2022. | ✅ Confirmed | cnmv.es |
| Belgium (FSMA): named on its **"fraudulent trading platforms"** list, 5 Jun 2023 — "fraudsters… divert the investors' funds." | ✅ Confirmed | [fsma.be](https://www.fsma.be/en/warnings/beware-these-new-fraudulent-trading-platforms-0) |
| Portugal (CMVM) warning 3 Sep 2024; Italy (Consob) bulletins relay CNMV + Ukraine NSSMC notices. | ✅ Confirmed | fsma.be cross-ref, consob.it |
| Withdrawal complaints: WikiFX 4.01/10 with 27 documented complaints (blocked withdrawals, frozen accounts, surprise "fee" demands); large 1-star Trustpilot cohort alleging the same, claimed losses £1k–£94k; ForexPeaceArmy threads report declined withdrawals. | ⚠️ Pattern (review-site data) | wikifx.com, globegain.com, FPA |
| Platform: **MT4 only** (desktop / WebTrader / mobile) + proprietary TradeCopier. **No REST or FIX API for retail clients.** | ✅ Confirmed | fxempire.com/brokers/t4trade |

**Practical consequences:**
- "Claude executes trades on the t4trade portal" is not technically possible — there is no API. The only automation route is an MT4 Expert Advisor running inside their MT4, which means giving an EA live control of an account at a broker six regulators warn about.
- Even if the signals were good, the well-documented failure mode is at **withdrawal time** — profits you can see but can't take out are not profits.
- Your current exposure is already minimal (£0.38 archived / $4.72 enabled / £0). The right amount to add is zero.

## 2 · The channel: GOLD VIP / THE WAR ZONE

Everything observed in the screenshots matches the documented anatomy of the Telegram gold-signal funnel:

| Observed on the channel | The documented pattern | Verified? |
|---|---|---|
| "100% WIN RATE 🙌" | No real trader has one; a regulated firm could not legally market this. Zero-edge (coin-flip) providers post 8-wins-in-10 streaks 5.5% of the time — across thousands of channels, hot streaks are guaranteed to exist and are the only ones you get shown. | ✅ binomial math independently computed |
| Forwarded MT4 history screenshots as "proof" | Trivially fakeable: demo accounts, doctored history, hedged buy+sell where only the winning leg is published, wide "entry zones" with pips counted from the most favourable fill — even screenshots of trades whose stop had already been hit. The industry bar is a third-party **Myfxbook "Track Record Verified"** live account; screenshots are considered worthless. | ✅ |
| "Signal bot" pushing Zoom "account management" calls | The escalation stage: screen-share sessions lead to remote-access theft, reckless "managed" losses, or pay-fees-to-release-profits fraud. The FCA reports **£25m lost to screen-sharing scams**, Zoom named explicitly. | ✅ FCA press release |
| Same bot spamming "$10,000 giveaway" kick.com streams | Giveaway-bot spam funnels to advance-fee fraud, phishing and malware — the same operation's casino arm. | ✅ |
| Trades posted at fixed **5.00 lots** | 5 lots = $500 per $1.00 of gold movement. The channel's own 2026-06-15 screenshot risks ~$3,000 on a $6 stop — 600% of a $500 account. Channels earn **introducing-broker commission per lot** from partnered offshore brokers (e.g. OANDA openly pays IBs ~$5/lot), so oversized, frequent trading pays the channel whether you win or lose. | ✅ |
| Free channel + forwarded wins + urgency language | Stage one of: free channel → screenshots → paid VIP tier → broker referral → "account management." | ✅ |

**Base rates worth knowing:**
- An independent six-month audit of a ~200k-subscriber "XAUUSD Trading Signals" channel measured a **26% win rate** on its free signals against advertised 2,000%+ returns (coinspot.io audit).
- The FCA maintains warning-list entries against *named* Telegram XAUUSD signal channels.
- FTC (Apr 2026): $2.1B lost to social-media scams in 2025, over half investment scams. Action Fraud: UK victims lost **£2.4m per day** to investment fraud in 2025; 36% of reports involved social media.
- ESMA: 74–89% of retail CFD accounts lose money even *without* a scam layer on top.

## 3 · What "have access to the Telegram group" can safely mean

- ✅ **Telethon user-session logger** (`tools/signal_logger.py`): runs in Termux on the Fold 7 under your own account, passively reads the channels you've already joined (no admin needed, no bot), appends every message to `signals.jsonl`. Confirmed: pure Python, works in Termux; read-only listening on an aged personal account is the documented low-risk case (new/VoIP accounts and spammy patterns are what get banned).
- ✅ **Zero-code fallback**: Telegram Desktop → channel ⋮ menu → *Export chat history* (JSON) — then import into the console.
- ⚠️ **Android notification capture** (Tasker/MacroDroid): works but lossy — grouped "N new messages" notifications truncate text; muted chats emit nothing. Backup only.
- ❌ **Bot API**: a bot cannot read a channel unless the channel's *owner* adds it as admin — not an option for someone else's channel (still true in 2026).
- ❌ **Commercial Telegram→MT4 copiers** (TSC $39.99/mo etc.): blind execution — parsing failures produce wrong entries and inverted positions, and they'd be wired to a warned broker. Not appropriate here.

## 4 · What "executing trades within my risk parameters" means for now

Real-money auto-execution is off the table: no API exists at T4Trade, the broker carries six regulator warnings, and the signal source is unverified. What ships instead:

1. **Trade Guard console** (`tools/trade-guard.html`, also published as a Claude artifact) — every signal is paper-logged at *your* sizing (1% risk/trade, 5% daily cap by default), scored on win rate **with a 95% confidence interval**, expectancy, profit factor, max drawdown, and a paper equity curve.
2. **Funding gate** — six gates, all must be green before real money is even a conversation: ≥30 closed trades, ≥28 days forward test, profit factor ≥1.3, drawdown ≤20%, signals verifiably posted *before* the move, and an **FCA-authorised** broker. (Formulas verified: E = Win%×AvgWin − Loss%×AvgLoss; PF = gross wins ÷ |gross losses|; ~385 trades are needed for a ±5-point win-rate estimate — 30 is the *minimum* for the number to mean anything at all.)
3. If — and only if — the gates ever pass: smallest size (0.01 lots), FCA-regulated broker, same caps enforced.

## 5 · Recommended immediate actions

- [ ] **Do not deposit** anything further at T4Trade; attempt to withdraw the remaining $4.72 as a live test of their withdrawal process.
- [ ] **Never join** the Zoom "account management" calls; block/report @Signalstevebot.
- [ ] Run the paper verification for 4+ weeks via Trade Guard before any further conversation about live trading.
- [ ] If the itch is market exposure rather than signal-following: that's a Faceless Finance research topic (FCA-regulated platforms, sensible instruments), not a Telegram channel.
- [ ] Report the channel: FCA reporting form / Action Fraud, and Telegram's in-app report. Optional but civic.

---
*Sources are inline above; every table row marked ✅ was independently re-verified by an adversarial fact-check agent against the primary source (FCA, AMF, FSMA, FSA Seychelles registers fetched directly).*
