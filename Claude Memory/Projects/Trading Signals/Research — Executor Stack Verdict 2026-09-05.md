# Research — Autonomous gold-signal executor: stack verdict (2026-09-05)

**Question.** Is *Telethon logger → Next.js on Vercel (inside JARVIS) → Supabase → push/Telegram alerts → autonomous execution via Interactive Brokers → pake-cli native wrapper* a sound, future-proof (2026–2029) stack for one UK individual auto-executing GOLD VIP's XAUUSD signals?

**Method.** Deep-research harness: 5 search angles → 24 sources fetched (nearly all primary: broker docs, FCA register, Companies House, GitHub, Vercel docs) → 118 claims extracted → top 25 adversarially verified by 3 independent votes each → **21 confirmed, 4 refuted, 0 unverified** → 12 findings after merge. 106 agents, 2,263 tool calls, ~3h40m. All figures fetched live 2026-09-05.

## Verdict

**No — three things must change.**

1. **Broker / API.** IBKR UK does offer UK retail a Gold CFD ("London Gold", 6.25% initial margin ≈ 16:1) — but for an **individual** account the Web API is **username + password only** (OAuth 1.0a/2.0 is documented for organisations and vendors; "OAuth 2.0 is not available to Individual account structures"), a username may hold **one brokerage session across all IB platforms** (the bot and your app cannot both be logged in), the session needs a `/tickle` at least every 5 min and dies daily, and **IBC — the standard tool for unattended IB Gateway — was retired and archived on 1 Sep 2026** with no successor. IBKR is demoted to fallback.
2. **Execution host.** Every viable broker API needs a persistent stream or a continuously maintained session. Vercel caps function duration at **300 s (Hobby) / 800 s (Pro)** and its own KB says a process that must hold a persistent connection "will not work on Vercel". → Execution must be a **persistent worker on an always-on host**; Next.js + Supabase are reduced to dashboard, sync and notifications.
3. **Wrapper.** Pake is alive (V3.15.6, 8 Aug 2026; ten releases in 2026) but **desktop-only** — no Android/iOS target in `Cargo.toml`, the CLI, or any release; mobile requests #666/#819/#960/#1104 closed unshipped. → Mobile = installable PWA (or Tauri 2 mobile if a native shell is truly needed); Pake only for an optional desktop wrapper.

**Dominant risk is the strategy, not the stack.** FCA-mandated disclosures live on 2026-09-05: **57.9 % (IBKR) · 65 % (Capital.com) · 69 % (IG) · 72.9 % (Pepperstone) · 76.6 % (OANDA)** of retail CFD accounts lose money. No surviving evidence validated the channel's edge, the FCA position of a signal follower, or Telegram's userbot ToS.

## Broker comparison (FCA-regulated, retail automation documented)

| Broker (FRN) | API path for an individual | Automation stance | Gold product | Constraints | Retail loss % |
|---|---|---|---|---|---|
| **OANDA Europe** (542574) | v20 REST + pricing stream, JSON; needs a v20 account (UK entity only — not the BVI or Poland divisions) | **API Licence Agreement (Apr 2026) cl. 4.1(d) expressly permits personal automated trading systems** | Spread bets for UK residents; gold spread **unverified** (19¢ claim refuted 1-2) | Practice environment identical to live | 76.6 % |
| **Capital.com UK** (793714) | REST + WebSocket (`wss://api-streaming-capital…`), separate **demo base URL** | API offered to UK retail; only crypto derivatives excluded | Gold Spot, epic `GOLD` | 10 req/s; 1 order per 0.1 s; session + WS expire after **10 min idle**; API docs unchanged since Nov 2023 | 65 % |
| **IG** (195355 / 114059) | REST + Lightstreamer via labs.ig.com, retail-accessible | Labs product since 2014, allowed | **Spot Gold spread bet: 0.3-pt spread, £5 min, 5 % margin** — cheapest verified | Hard limits: 100 trading req/min, 30 non-trading/min, 40 streams; streaming needs an active thread, no OAuth; tokens invalidated at weekend maintenance; MARKET subscription decommissioned May 2026 | 69 % |
| **Pepperstone** (684312) | No own REST API — cTrader Open API / cTrader Automate (C#) / MT4-5 EAs | Marketed "Ideal for … automated trading systems"; T&Cs only bar latency abuse | via cTrader/MT5 | Different stack (protobuf / MQL) | 72.9 % |
| **IBKR UK** | Web API = username/password (individuals); OAuth = orgs/vendors only | Allowed, but one session per username, tickle ≤ 5 min, 24 h max; IBC archived 2026-09-01 | "London Gold" CFD, 6.25 % margin (~16:1) | Legacy TWS socket API depends on unmaintained automation tooling | 57.9 % |
| **Trading 212** | API key exists only for Invest / ISA — **no CFD** endpoints | **API Terms cl. 4.2(a): "expressly prohibited from using our API for Algorithmic Trading"** | none via API | Dead end for execution | — |

## Execution host

- Vercel: 300 s Hobby / 800 s Pro max duration; WebSocket beta is inbound-only; "will not work on Vercel" for persistent-gateway processes (Vercel KB). Vercel cron granularity, Supabase free-tier pausing and Realtime/Edge/pg_cron limits: **not verified** (no surviving claim).
- Broker-side, all primary and unanimous: IG "a Lightstreamer connection needs an active thread"; Capital.com "ping … at least once every 10 minutes"; IBKR `/tickle` ≤ 5 min.
- ⇒ A single persistent worker (systemd on a small VPS, or a home box) holds the broker session, parses/validates signals, enforces risk locally **before** any order, and writes state to Supabase. Next.js on Vercel consumes Supabase Realtime for the dashboard and sends notifications.

## Refuted (do not repeat these)

| Claim | Vote |
|---|---|
| IBKR forces weekly TWS/Gateway shutdown + re-auth after 01:00 ET Sunday; IBC makes the daily restart hands-free with one human login per week | 0-3 |
| IBKR mobile 2FA must be acknowledged within ~3 min weekly, so zero-touch execution via Gateway is impossible | 0-3 |
| IBKR's Web API page (2024-08-20) says no endpoints are deprecated while merging into an OAuth 2.0 "beta" Web API with "Documentation coming soon" sections | 0-3 |
| OANDA UK quotes a 19-cent minimum spot-gold spread | 1-2 |

So the *precise* unattended-operation constraints of IBKR's legacy socket API are **not established** — only that the tooling used to work around them is now unmaintained.

## Open questions (nothing survived verification)

1. Can an individual IBKR account get a headless OAuth 1.0a key via the self-service portal (reported de facto, contradicted by IBKR's docs) — and will that hold to 2029?
2. FCA perimeter: does following third-party Telegram signals on your own account, or the unregulated channel providing them, fall under signal-provision / arranging / financial-promotion rules? Does a Telethon user-session logger breach Telegram's ToS (ban risk)?
3. Realised slippage and fill quality on **6–8 dollar** TP/SL targets at IG / OANDA / Capital.com during news and across the weekend gap; CGT-free spread bet vs CFD after costs.
4. Any independent, verifiable track record for GOLD VIP (edited/deleted signals, partial closes, win rate net of costs) that could justify skipping the 30-trade / 28-day demo gate, given 58–77 % base-rate losses.

## Coverage gaps (explicitly not verified)

FCA copy-trading rules; ESMA/FCA product-intervention texts (only the 20:1 gold cap referenced indirectly); UK CGT vs spread-bet tax treatment; Consumer Duty / 2024–26 marketing rules; Telegram ToS; independent audits of gold-signal channels; slippage on small targets; IBKR minimum deposit / inactivity / FSCS status; Supabase free-tier pausing; Next.js version churn. Whether the planned risk controls (1 % / 5 % daily / 20 % DD / kill-switch / 30-trade gate) match "industry practice" was not established — they are carried forward as Elliot's stated controls.

## Time-sensitivity

Loss percentages are rolling 12-month figures recalculated quarterly (IBKR showed 62.5 % in May 2026). IBC's retirement is four days old — a final 4.0 or a fork could still appear. Pake ships roughly fortnightly. IG's streaming schema is not frozen (May 2026 breaking change).

## Key sources (primary unless marked)

- IBKR: interactivebrokers.co.uk `margin-cfd.php`, `commissions-cfd-metals.php`, `products-cfds.php`; interactivebrokers.com `docs/web-api/authentication/{sessions,multiple-sessions,faq,oauth-2/register,oauth-1a}`; `campus/ibkr-api-page/webapi-doc`
- IBC: github.com/IbcAlpha/IBC (README retirement notice; release 3.24.2)
- IG: labs.ig.com (`faq.html`, `streaming-api-guide.html`, `reference/positions-otc.html`), ig.com/uk trading-apis page; trading-ig readthedocs (secondary)
- OANDA: developer.oanda.com/rest-live-v20/introduction; legal.oanda.com API Licence Agreement; FCA register 001b000000NMcEsAAL; Companies House 07110087
- Capital.com: open-api.capital.com; capital.com/en-gb; GitHub capital-com-sv/capital-api-postman; PyPI capitalcom-python (secondary)
- Pepperstone: pepperstone.com/en-gb/platforms/integrations; Companies House 08965105; fxempire (secondary)
- Trading 212: helpcentre article 14584770928157; docs.trading212.com/api/openapi.json; API-Terms_EN.pdf
- Pake: github.com/tw93/Pake releases + `src-tauri/Cargo.toml` + `bin/builders/BuilderProvider.ts`; npm pake-cli
- Vercel: vercel.com/docs/functions/limitations; vercel.com/kb/guide/can-i-deploy-discord-bots-to-vercel; docs/functions/websockets; docs/cron-jobs/usage-and-pricing
- Supabase: supabase.com/docs/guides/platform/free-project-pausing (fetched; no claim survived)
- FCA: fca.org.uk/firms/copy-trading; PS19/18; news/warnings/t4trade (fetched; no claim survived)

Related: [[Due Diligence — GOLD VIP + T4Trade]] · [[_index]] · [[sessions/2026-09-05]]
