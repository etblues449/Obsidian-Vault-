# TradeGuard Analyst: hand-off (2026-10-05, ~01:45 UK)

Branch `claude/lucid-ritchie-ilz9kv`, head `3f73b4e`, pushed. PR #92 is **still a draft and NOT merged to master**.
Code lives in `Claude Memory/Projects/Trading Signals/tools/analyst/`.

## 1. What is true right now (observed, not assumed)

| Item | State | Evidence |
|---|---|---|
| Test suite | 367 / 367 pass | `node --test`, run again at hand-off |
| Fixes from review round 1 (19 findings) | Landed | fixer result, in suite |
| Footprint, order book, Telegram notifier, tuner | Built and in suite | 35 + 29 + 28 + 15 tests |
| Pro UI, light theme only | Built, rendered at 390 px and 1280 px | 77 + 68 + 59 browser checks, 0 console errors |
| Integration (feeds, routes, SSE, notifier, digest) | Done | live smoke on real Binance |
| 7-day real-data backtest, current code | BTCUSD +6.20 R over 20 setups, XAUUSD +2.83 R over 21 | Pro hits show "n/a" offline (no trade tape) |
| **Verify round 2 (math, strategy, robustness, security lenses on the Pro code)** | **DID NOT RUN** | all four agents failed: org monthly spend limit, resets 04:10 UTC |
| README Pro section | Drafted, not applied | scratchpad draft only |
| SPEC.md light-only edits | Not done | SPEC.md still says dark mode and the `d` key |
| Vault handoff (`_index.md`, `sessions/2026-10-04.md`, `capture_queue.md`) | Not done | drafts exist, not applied |
| Soak servers (ports 18090, 18092) | Down after worker restart | health check returned nothing |
| PR #92 body | Stale (says "being built") | still the scaffold text |

Honest framing: the Pro code is tested and live-smoked but has **not had an adversarial review**. Do not merge it as "verified" until round 2 is done.

## 2. What the engine does (short)

Zero-dependency Node 22+. BTCUSD and XAUUSD (PAXG token) are live from Binance with aggressor-tagged trades. NQ1! and OIL are simulated and labelled SIM. Layers: sessions (London time, DST-safe), liquidity, structure, order flow, then a Condition, Zone, Trigger gate (minimum score 6, grades A at 9 and B at 7, minimum R:R 1.5). Setups are journaled and resolved against real prices. **Nothing places orders.** The executor bridge is off by default, gold only.

Pro adds: per-level footprints (diagonal and stacked imbalances, unfinished auctions, trapped traders), top-20 order book (walls pulled, absorbed, traded through), five new CZT hits, Telegram setup and resolution alerts plus a 17:05 digest, and a tuner that proposes weights and never applies them.

## 3. Running it on the Fold 8 Ultra

You already run commit `5254150` from a sparse checkout on port 8090. To move to the current build:

```bash
cd ~/tradeguard-src && git fetch origin claude/lucid-ritchie-ilz9kv && git checkout -q 3f73b4e
pkill -f "analyst/server.mjs"
cd ~/tradeguard/analyst && ANALYST_PORT=8090 node server.mjs
```

The server needs no restart of Termux, only of the node process. Port 8080 is taken on that phone, hence 8090. Telegram alerts need `ANALYST_TELEGRAM_BOT_TOKEN` and `ANALYST_TELEGRAM_CHAT_ID` in `~/.config/tradeguard/analyst.env` (create it with `chmod 600`). Use a **new** bot token, not the exposed one. Never put either value in the vault or in chat.

## 4. Next steps, in order

1. **After 04:10 UTC (spend limit resets):** run verify round 2 on commit `3f73b4e`. The four lenses are math, strategy, robustness, security. The workflow script is `/root/.claude/projects/-home-user-Obsidian-Vault-/c3961659-be14-56b3-984e-da5d7573f585/workflows/scripts/tradeguard-pro-mode-wf_37f49160-0ba.js`. Resume with `resumeFromRunId: wf_37f49160-0ba`; completed agents replay from cache, only the four reviews run live. Alternatively run `/code-review` on the diff `35839d4..3f73b4e` by hand.
2. Fix whatever it confirms, rerun `node --test`, commit.
3. **Presentation fix (small, agreed in my notes):** a trailed stop that locked in profit prints as `lost/stop +0.92R` in the backtest and `lost +0.92R` on the dashboard. Change only the wording (sign of the R decides won, lost or flat; mechanism after it). Do not change journal status semantics. Files: `backtest.mjs` print, `public/app.js` setup card and watchlist, `scripts/report.mjs`. Add a test.
4. README: apply the Pro section from the scratchpad draft (`readme-pro-draft.md`), add the config-table rows for `footprint`, `orderbook`, `notify` and the five weights, add the `p` key to the tour, put in the final test count and backtest numbers.
5. SPEC.md: update section 1 (file list) and section 7 (no dark mode, `p` key, Pro pill). SPEC-PRO section P9 should already hold every deviation.
6. Soak the final build 30 minutes or more on a spare port, confirm zero ERROR lines.
7. Vault session end (per CLAUDE.md): update `Claude Memory/Projects/Trading Signals/_index.md` (replace the "being built, 3 of 6 modules" bullet), add a TradeGuard addendum to `sessions/2026-10-04.md`, tick and add items in `Claude Memory/Account/capture_queue.md`. Drafts are in the scratchpad `vault-handoff-draft.md`.
8. PR #92: rewrite the body with the observed numbers, mark ready, merge to master (your standing instruction), confirm the master head. Then `git pull` on the phone and run `sh scripts/install-termux.sh` for the boot script. Delete `~/tradeguard-src` afterwards.

## 5. Decisions and constraints to keep

- Light theme only. Dark mode was removed on your instruction.
- Paper analysis only. The bridge stays off unless you turn it on deliberately.
- Weights never auto-apply. `node scripts/tune.mjs` proposes after about 30 resolved live setups; a human commits any change.
- Secrets live in env files outside the vault. Single write path to master. No force-push.
- XAUUSD runs on PAXG (a gold token), not spot XAU. NQ1! and OIL stay simulated until you choose a real feed (Yahoo delayed or a broker adapter).

## 6. Known caveats

- Pro hits cannot be backtested (no historical trade tape or book). Their weights are unproven until the live scorecard has data.
- The 7-day backtest is one week, 20 to 21 setups per symbol. Confidence intervals are wide (win rate 24 to 76 percent on the best trigger). Treat it as a smoke test, not an edge.
- Gold results are weak: sweep-reclaim 0 wins in 7, CVD divergence 0 in 5. The strategy fit on gold is unproven.
- Your open trades (two XAUUSD buys, 0.18 lots on an $84 balance) are far larger than the 1 percent risk the engine uses. At the stop that loss is several times the balance. That is outside this codebase but worth acting on.
- Other open items in `_index.md` are yours: rotate the exposed Telegram bot token and api_id/api_hash, MetaAPI account, T4Trade withdrawal.

## 7. Where things are

| Thing | Path |
|---|---|
| Engine and dashboard | `tools/analyst/` |
| Contracts | `SPEC.md`, `SPEC-PRO.md` (deviations in section 9 and P9) |
| Strategy sources | `tools/analyst/docs/sources/01-05.md` |
| Config | `config/strategy.json`, `config/symbols.json` |
| Scratchpad (drafts, backtest logs, screenshots) | `/tmp/claude-0/-home-user-Obsidian-Vault-/c3961659-be14-56b3-984e-da5d7573f585/scratchpad/` (ephemeral, lost when the container is reclaimed) |
| Full transcript | `/root/.claude/projects/-home-user-Obsidian-Vault-/c3961659-be14-56b3-984e-da5d7573f585.jsonl` |
