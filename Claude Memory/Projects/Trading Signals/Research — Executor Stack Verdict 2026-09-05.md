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

## Second pass — more brokers (2026-09-05, six verification agents)

Elliot asked for more options and chose a **Raspberry Pi / home box** as the executor host, which rules out anything needing a Windows terminal or an x86 desktop gateway. Each agent verified against the broker's own docs and T&Cs; `register.fca.org.uk` renders client-side only, so FRNs come from firm footers, FCA warning pages, Companies House and an FCA FOI annex.

| Broker (UK entity, FRN) | API path for an individual | Unattended auth? | Automation stance | Gold to UK retail | Loss % | Pi-viability |
|---|---|---|---|---|---|---|
| **Saxo** (Saxo Capital Markets UK Ltd, 551422) | OpenAPI: REST + WebSocket, OAuth 2.0 code/PKCE; live app self-service once funded; 120 req/min, 1 order/s; SIM = same API | **No** — certificate auth is institutional-only; access token 20 min, refresh token 40 min and rotates → one interactive login then refresh forever; an outage > 40 min needs a human | Docs contemplate "automatic trading"; GBT cl. 27(vii) bans only manipulation | XAUUSD FX spot 0.10 pt; Gold CFD 0.60 pt, 5 %; **no spread betting** | 60 % | VIABLE-WITH-CAVEATS |
| **Pepperstone via cTrader Open API** (Pepperstone Ltd, 684312) | Protobuf/JSON over TLS TCP or WS (`live.ctraderapi.com:5035/5036`); OAuth 2.0 — access token ~30 days, **refresh token never expires**; 10-s heartbeat; 50 req/s | **Yes** (after one OAuth consent) | "Ideal for … automated trading systems"; Spotware: "available for anyone registered with a cTrader-affiliated broker" (app reviewed by Spotware; Playground token for own account) | Spot Gold **spread bet on cTrader** 0.1 pt, 5 %; Razor 0.08 + commission | 72.9 % | VIABLE-WITH-CAVEATS — official Python SDK abandoned (last commit Aug 2024, CVE'd pins); speak protobuf yourself |
| **XTB** (XTB Ltd, 522157) | **xAPI discontinued 14 Mar 2025** — XTB help centre (Apr 2026): "API access is no longer available… no replacement" | — | ToB cl. 38.2(f) bans automated entry | GOLD CFD 0.9 pt, 0.001-lot min; no spread betting | 74 % | **NOT VIABLE** |
| **Darwinex** (Tradeslide Trading Tech Ltd, 586466) | FIX 4.4 (quickfix; Python reference client last commit 2022); FIX cannot query balance/positions; DARWIN REST API trades DARWINs only | Yes (credentials) — if granted | **Client Agreement cl. 9.6: automated tools "prohibited without our prior written consent… at our absolute discretion"** | XAUUSD CFD, 20:1 retail; spread behind login; no spread bet | 53.8 % | VIABLE-WITH-CAVEATS (weak) — consent + unpublished FIX terms first |
| **FOREX.com UK / City Index** (StoneX Financial Ltd, 446717) | "StoneX API" (ex-GCAPI): REST `ciapi.cityindex.com` + Lightstreamer; v1 LogOn obsolete → v2; pre-prod env with separate accounts | Yes (username/password/AppKey session) | Permitted with limits (GT 20.1.8 bans manipulation; MT annex blocks "excessive" automation) — but **AppKey only via a Partnerships application**; retail eligibility, rate limits, session life unpublished | FOREX.com: XAU/USD CFD from 0.10 pt, 5 %, min 10 oz; City Index: spread bet from 0.3 pt, 5 % | 74 % / 68 % | VIABLE-WITH-CAVEATS — get the AppKey before coding; City Index → "StoneX Trading" rebrand reported |
| **eToro (UK) Ltd** (583263) | New trading REST API (press release 29 Oct 2025: execution, cancels, SL/TP) — "available to select users in early access" | Unverified | Unverified | Commodities listed; leveraged gold via API unverified | **51 %** | POSSIBLE — confirm UK eligibility with eToro first |
| **FXCM UK** (Stratos Markets Ltd, 217689) | FIX 4.4 only (**≥ £5,000 balance**); ForexConnect is x86-only; REST/fxcmpy gone | Yes | Allowed | XAU listed; margin not on site | 65 % | POSSIBLE (heavy) |
| **ActivTrades plc** (434413) | .NET 8 WebSocket SDK (`ActivTrader.Client.API` 4.20.1, Feb 2026) "for accounts with specific permissions only" | — | Institutional/partner framing | — | 69 % (.co.uk) | Conditional — not Python/REST, permission needed |
| **CMC Markets UK plc** (173730) | None for retail (CMC Connect is institutional); MT4 EAs only | — | — | 0.2 pt, 5 % | 68 % | MT-ONLY → not on a Pi |
| **Admiral Markets UK Ltd** (595450) | MT4/MT5 only | — | — | unverified (site serves CySEC entity) | — | MT-ONLY |
| **Spreadex Ltd** (190941) | None | — | — | Gold from 0.3 pt | 61 % | NOT VIABLE |
| **Plus500UK Ltd** (509909) | None; **User Agreement: "Use of any automated data entry system … is expressly prohibited"** | — | Banned | — | unverified | NOT VIABLE |

**MetaTrader 5 Python** (`MetaTrader5` on PyPI, 5.0.6180, 2026-09-05): every wheel is `win_amd64`, `initialize()` takes a path to `metatrader64.exe`, MetaQuotes' Linux route is Wine on x86 — **not a Raspberry Pi route**. That rules out every MT-only broker (CMC, Admirals, Tickmill, …).

### Consolidated ranking for a Python worker on a Raspberry Pi (both passes)

Criteria: unattended auth that survives a reboot without a human; explicit permission to automate; practice/demo on the same API; gold cost on 6–8 dollar targets; Python simplicity; UK spread-bet (CGT-free) option; minimum trade size vs a small account; 3-year API risk.

1. **OANDA Europe (542574)** — long-lived personal token (no interactive login, ever), the only broker with an *explicit* personal-automation licence clause (Apr 2026), plain JSON REST + HTTP pricing stream, practice environment identical to live, UK spread bets. Open: gold spread and minimum gold unit on practice (a 5-minute check); highest loss disclosure (76.6 %).
2. **Capital.com UK (793714)** — API key + password, JSON REST + WebSocket, demo base URL (same code); the 10-minute keepalive is trivial on a Pi. Open: gold spread/min size; API docs frozen since Nov 2023; spread bets unverified.
3. **Pepperstone via cTrader Open API (684312)** — cheapest gold (0.1-pt spread bet on cTrader) and a never-expiring refresh token, but protobuf-over-TLS must be hand-rolled (SDK abandoned) and Spotware reviews the app.
4. **IG (195355)** — cheapest *verified* spread-bet gold (0.3 pt) and mature docs, but Lightstreamer needs a live thread, hard rate limits, weekend token death, and a **£5/pt minimum stake** — a 7-point stop risks ≥ £35, too large for a £500 account at 1 %.
5. **Saxo (551422)** — excellent API, but the 40-minute refresh cliff on a Pi that may reboot is an operational hazard; no spread betting.
6. **FOREX.com UK / City Index** — workable REST, but a discretionary AppKey and brand churn.
7. eToro (watch — early access), Darwinex, FXCM, ActivTrades — not for this build.

Not viable on a Pi or at all: XTB (API discontinued), CMC / Admirals / Tickmill (MetaTrader only), Spreadex (no API), Plus500 (automation banned), Trading 212 (API bars CFD and bans algorithmic trading).

### Second-pass sources (primary unless marked)

- Saxo: home.saxo/en-gb (footer, gold campaign, margin page); openapi.help.saxo articles 4416505486481 / 4416637088017; developer.saxo learn pages; SaxoBank/openapi-foundational-samples-python; general-business-terms-uk.pdf cl. 36.2
- cTrader: help.ctrader.com/open-api (connection, account-authentication, proxies-endpoints, api-application, symbol-data); openapi.ctrader.com; spotware/openapi-proto-messages `OpenApiMessages.proto`; PyPI ctrader-open-api; spotware/OpenApiPy issues #38 #43; MetaTrader5 on PyPI; mql5.com docs `mt5initialize_py`; mql5.com/en/articles/625; handbook.fca.org.uk COBS 22.5.11R; pepperstone.com/en-gb commodity-fees + ctrader pages; FCA warnings (IC Markets, FP Markets, FxPro clone)
- XTB: xtb.com/int/help-center "does-xtb-offer-investment-automation-tools-4"; XTB_UK_Terms_of_Business.pdf (ver. 05012026) cl. 18.4, 38.2(f); xtb.com/en/table-uk.pdf; FCA warning "xtb-limited-clone"; pawelkn/xapi-python (archived)
- Darwinex: darwinex.com (footer, algorithmic-trading/fix-api, deposit-insurance); help.darwinex.com (assets-available, margin-call, execution-costs, api-walkthrough); FCA client-agreement.pdf cl. 9.3, 9.6, 13.1, 14.4; darwinex/dwx-fix-connector; darwinex.com/api/accounting/profitsResume/looserUsersPercentage
- StoneX: docs.labs.gaincapital.com (updated 07 Nov 2025); forex.com/en-uk gold + terms pages; cityindex.com/en-uk (footer, strength-and-security, mt4-platform-support); Forex-com-UK-Terms.pdf / city-index-uk.pdf; fxuk-priips-cfd-commodity-kid-dec2025.pdf; FCA FOI 5126 annex; Companies House 05616586, 01761813; Finance Magnates 2026-01-05 (secondary)
- Elimination: cmcmarkets.com/en-gb (institutional, mt4, commodities); fxcm.com/uk api-trading; fxcm/ForexConnectAPI; spreadex.com; Plus500 UserAgreement.pdf (Jun 2026); etoro.com press release 2025-10-29, go.etoro.com developers, api-portal.etoro.com, builders.etoro.com (secondary); admiralmarkets.com MIFIDPRU 8; activtrades.com/en/trading-api; nuget ActivTrader.Client.API

## Key sources — first pass (primary unless marked)

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
