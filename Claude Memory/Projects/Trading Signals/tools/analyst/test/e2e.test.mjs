// test/e2e.test.mjs — SPEC §8 end-to-end: the replay feed plays a scripted London-killzone sweep-and-reclaim
// of the Asia low under a bullish 1h bias through the REAL Analyst (feeds → store → every engine module →
// czt → journal). Expected: exactly one long Setup, stop = sweep low − stopBufferAtr × ATR (source 01, the
// manipulation low), first target = the nearest buy-side pool ≥ minRr (the Asia / previous-session high,
// source 02/04), then the walk-forward resolver marks it WON when a later 1m candle trades through it.
//
// The script is sized from the engine's own ATR at the hand-over point so it stays valid if the random
// warm-up changes: sweep depth ≈ 0.8 ATR (inside [sweepMinDepthAtr, sweepMaxDepthAtr]), quiet candles
// > 0.5 ATR (zoneToleranceAtr) away from every level so no stray trigger fires before the sweep, and the
// rally CLOSES above the Asia high so the buy-side sweep is never "reclaimed" into a short.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Analyst } from '../lib/engine/analyst.mjs';
import { ReplayFeed } from '../lib/feeds/replay.mjs';
import { createJournal } from '../lib/journal.mjs';
import { createLogger } from '../lib/log.mjs';
import { loadConfig } from '../lib/config.mjs';
import { CandleStore, aggregate } from '../lib/engine/candles.mjs';
import { lastAtr } from '../lib/engine/indicators.mjs';
import { htfBias } from '../lib/engine/structure.mjs';
import { resolveSession } from '../lib/engine/sessions.mjs';
import { bucketFor } from '../lib/engine/footprint.mjs';
import { mkCandles } from './helpers.mjs';

const MIN = 60e3;
const T = (h, m) => Date.UTC(2026, 0, 13, h, m); // Tuesday 13 Jan 2026: London == UTC (GMT), no DST ambiguity

/** One scripted 1m candle: close moves to `c`, small wicks, explicit aggressor split. */
function bar(t, o, c, { wick = 0, v = 10, buyFrac = 0.5, lo, hi } = {}) {
  const h = Math.max(o, c, hi ?? -Infinity) + wick, l = Math.min(o, c, lo ?? Infinity) - wick;
  return { t, o, h, l, c, v, buyV: v * buyFrac, sellV: v * (1 - buyFrac), n: 10, closed: true };
}

function buildScenario() {
  // 1. Random uptrend 10 Jan 18:00 → 13 Jan 00:00 (54 h = 3240 candles; the 1h bias needs 60 closed hours in total).
  const random = mkCandles({ n: 3240, start: Date.UTC(2026, 0, 10, 18, 0), price: 100, drift: 0.00004, vol: 0.0012, seed: 11 });
  const P = random[random.length - 1].c, u = P * 0.001;
  const out = random.slice();
  let o = P;
  const push = (t, c, opts) => { const b = bar(t, o, c, opts); out.push(b); o = c; return b; };
  // 2. Asia 00:00–07:00: a 120-minute triangle wave between P − 2u and P + 2u (consolidation, source 03).
  for (let i = 0; i < 420; i++) {
    const phase = (i % 120) / 120;                                 // 0 → 1 over two hours
    const tri = phase < 0.5 ? -2 + 8 * phase : 2 - 8 * (phase - 0.5); // −2 … +2 … −2 (in u)
    const c = P + tri * u;
    push(T(0, i), c, { wick: 0.03 * u, buyFrac: 0.5 + 0.1 * Math.sign(c - o) });
  }
  // 3. London 07:00–08:10: a slow retracement from the mid toward the low (source 03) — monotone, so it leaves no
  //    equal highs / consolidation pool between the entry and the Asia high, and it stops 0.8u (> 2 ATR) above the low.
  for (let i = 0; i < 70; i++) push(T(7, i), P - (1.2 * u * (i + 1)) / 70, { wick: 0.03 * u, buyFrac: 0.45 });
  const history = out.slice(0, out.length - 10); // the live tape starts 08:00
  const atr0 = lastAtr(aggregate(history, '5m'), 14);
  const asiaLow = Math.min(...out.slice(3240, 3240 + 420).map((c) => c.l));
  const asiaHigh = Math.max(...out.slice(3240, 3240 + 420).map((c) => c.h));
  // 4. 08:10–08:15: the manipulation — sell-off into the Asia low, wick 0.8 ATR below it, close back inside (sources 01/02).
  const depth = 0.8 * atr0;
  const sweepLow = asiaLow - depth;
  push(T(8, 10), P - 1.5 * u, { wick: 0.03 * u, buyFrac: 0.3 });
  push(T(8, 11), P - 1.9 * u, { wick: 0.03 * u, buyFrac: 0.3 });
  push(T(8, 12), asiaLow + 0.6 * atr0, { lo: sweepLow, buyFrac: 0.3, v: 14 });
  push(T(8, 13), asiaLow + 0.9 * atr0, { wick: 0.03 * u, buyFrac: 0.45 });
  push(T(8, 14), asiaLow + 1.2 * atr0, { wick: 0.03 * u, buyFrac: 0.45 });
  // 5. 08:15–08:35: the expansion to the Asia high and through it (target), closing above (no reclaim ⇒ no short).
  const start = o, end = asiaHigh + 1.0 * u;
  for (let i = 0; i < 20; i++) push(T(8, 15 + i), start + ((end - start) * (i + 1)) / 20, { wick: 0.02 * u, buyFrac: 0.7, v: 12 });
  // 6. 08:35–08:45: hold above the Asia high.
  for (let i = 0; i < 10; i++) push(T(8, 35 + i), end + 0.05 * u * Math.sin(i), { wick: 0.02 * u, buyFrac: 0.5 });
  return { candles: out, history, P, u, atr0, asiaLow, asiaHigh, sweepLow, playLast: out.length - history.length };
}

test('e2e: London-killzone sweep-and-reclaim of the Asia low under bullish bias → exactly one long, stop at the manipulation low − buffer, won at the prior high', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'analyst-e2e-'));
  try {
    const { cfg, symbolsCfg } = loadConfig({ env: { ANALYST_SYMBOLS: 'BTCUSD', ANALYST_FEED: 'replay' } });
    const sc = buildScenario();
    const { candles, history, asiaLow, asiaHigh, sweepLow, playLast } = sc;
    assert.equal(playLast, 45);
    assert.equal(resolveSession(T(8, 10), cfg).killzone, true, 'the sweep candle opens inside the London killzone');

    // Preconditions the scenario relies on — asserted so a drift in the generators fails loudly here, not downstream.
    const pre = new CandleStore({ maxPerTf: cfg.history.maxCandlesPerTf });
    pre.applyHistory(history);
    const bias = htfBias({ store: pre, cfg });
    assert.equal(bias.dir, 'bullish', `bias must be bullish at hand-over: ${bias.reasons.join(' | ')}`);
    assert.ok(sc.atr0 > 0 && sc.atr0 < 0.6 * sc.u, `ATR ${sc.atr0} vs u ${sc.u}`);

    let clock = history[0].t;
    const now = () => clock;
    const log = createLogger({ now, stream: null });
    const journal = createJournal({ cfg, dir, log, now });
    const symbol = { ...symbolsCfg.symbols[0], feedParams: { candles, playLast } };
    const events = { setup: [], levels: [], candle: [], status: [], event: [] };
    const analyst = new Analyst({
      cfg, symbolsCfg: { symbols: [symbol] }, log, journal, now,
      timers: { setTimeout: () => null, clearTimeout: () => {} },
      feedFactory: (s, g, deps) => {
        const feed = new ReplayFeed(s, s.feedParams, deps);
        feed.on('history', (m) => { clock = m.candles[m.candles.length - 1].t + MIN; });
        feed.on('candle', (m) => { clock = m.candle.t + MIN; });
        return feed;
      },
    });
    for (const k of Object.keys(events)) analyst.on(k, (m) => events[k].push(structuredClone(m)));
    let levelsAtSetup = null;
    analyst.on('setup', (s) => { if (s.status === 'open' && !levelsAtSetup) levelsAtSetup = structuredClone(analyst.symbols.get('BTCUSD').levels); });
    await analyst.start();
    await analyst.stop();

    // --- exactly one setup, a long, from the sweep candle ---
    const all = journal.list({ symbol: 'BTCUSD', limit: 100 });
    assert.equal(all.length, 1, `expected exactly one setup, got ${all.map((s) => `${s.side}@${new Date(s.t).toISOString()}`).join(', ')}\nfeed:\n${log.recent(40).map((e) => `${e.level} ${e.msg}`).join('\n')}`);
    const s = all[0];
    assert.equal(s.side, 'long');
    assert.equal(s.t, T(8, 10), 'trigger = the 5m candle that swept the low');
    assert.equal(s.tf, '5m');
    assert.equal(s.id, `BTCUSD-${T(8, 10)}-long`);
    assert.equal(s.entry, candles.find((c) => c.t === T(8, 14)).c, 'entry = close of the trigger candle');
    assert.ok(s.trigger.hits.includes('sweepReclaim'), s.trigger.hits.join(','));
    assert.equal(s.trigger.kind, 'sweepReclaim');
    assert.ok(['asiaLow', 'sessionLow', 'equalLows'].includes(s.trigger.sweep.level.kind), s.trigger.sweep.level.kind);
    assert.ok(s.condition.hits.includes('killzone') && s.condition.hits.includes('biasAligned'), s.condition.hits.join(','));
    assert.equal(s.condition.session.id, 'london'); assert.equal(s.condition.session.killzone, true);
    assert.ok(s.zone.hits.includes('sessionHighLow'), s.zone.hits.join(','));
    assert.ok(s.score >= cfg.czt.minScore); assert.ok(['A', 'B'].includes(s.grade));

    // --- the stop: manipulation low − stopBufferAtr × ATR (source 01, non-negotiable) ---
    const describe = () => `targets ${JSON.stringify(s.targets)}\nlevels at setup: ${levelsAtSetup.map((l) => `${l.kind}@${l.price.toFixed(4)}(${l.side}${l.swept ? ',swept' : ''})`).join(' ')}`;
    const atrAtSetup = s.trigger.sweep.depth / s.trigger.sweep.depthAtr;
    assert.ok(Math.abs(s.stop0 - (sweepLow - cfg.czt.stopBufferAtr * atrAtSetup)) < 1e-9, `stop ${s.stop0} vs ${sweepLow - cfg.czt.stopBufferAtr * atrAtSetup}`);
    assert.ok(s.trigger.sweep.depthAtr >= cfg.liquidity.sweepMinDepthAtr && s.trigger.sweep.depthAtr <= cfg.liquidity.sweepMaxDepthAtr);
    assert.ok(Math.abs(s.trigger.sweep.level.price - asiaLow) < 1e-9, 'the swept level is the Asia low');
    assert.match(s.invalidation, /^close below .* \(manipulation low/);
    assert.ok(s.reasons.some((r) => /^Swept sell-side liquidity at (Asia low|Asian low|equal lows)/.test(r)), s.reasons.join('\n'));

    // --- the target: nearest opposing (buy-side) pool giving ≥ minRr — the Asia / previous-session high ---
    const buySide = levelsAtSetup.filter((l) => l.side === 'buy-side' && l.price > s.entry && !l.swept);
    const eligible = buySide.filter((l) => (l.price - s.entry) / (s.entry - s.stop0) >= cfg.czt.minRr).sort((a, b) => a.price - b.price);
    assert.ok(eligible.length, 'at least one buy-side pool above entry at ≥ minRr');
    assert.equal(s.targets[0].price, eligible[0].price, `first target is the nearest eligible buy-side pool\n${describe()}`);
    assert.ok(Math.abs(s.targets[0].price - asiaHigh) < 1e-9, `target at the prior (Asia) high ${asiaHigh}, got ${s.targets[0].label}\n${describe()}`);
    // The Asia high is also where the three Asia peaks cluster, so the engine may name the pool "equal highs" (source 04) — same price.
    assert.ok(['asiaHigh', 'sessionHigh', 'equalHighs'].includes(s.targets[0].kind), s.targets[0].kind);
    assert.ok(levelsAtSetup.some((l) => l.kind === 'asiaHigh' && Math.abs(l.price - s.targets[0].price) < 1e-6), 'an asiaHigh level sits at the target price');
    assert.ok(s.rr >= cfg.czt.minRr);
    assert.ok(s.size.units > 0, `sized: ${JSON.stringify(s.size)}`);

    // --- walk-forward: won when a later 1m candle traded through the target ---
    assert.equal(s.status, 'won'); assert.equal(s.exit, 'target');
    assert.ok(Math.abs(s.resultR - s.rr) < 1e-3, `won = +rr R against the original risk (journal rounds to 4 dp): ${s.resultR} vs ${s.rr}`);
    const winner = candles.find((c) => c.t >= T(8, 15) && c.h >= s.targets[0].price);
    assert.equal(s.resolvedAt, winner.t, 'resolved on the first candle whose high reached the target');
    assert.ok(s.mfeR >= s.rr && s.maeR < 1, `mfe ${s.mfeR} mae ${s.maeR}`);

    // --- the SSE-shaped surface saw it: open then won; levels on every 5m close; candles per TF ---
    const open = events.setup.find((x) => x.id === s.id && x.status === 'open');
    const won = events.setup.find((x) => x.id === s.id && x.status === 'won');
    assert.ok(open && won, 'setup emitted twice: on creation and on resolution');
    assert.ok(events.setup.indexOf(open) < events.setup.indexOf(won));
    assert.equal(events.levels.length, 1 + 9, 'history + nine 5m closes (08:00 → 08:45)');
    assert.ok(events.candle.some((m) => m.tf === '1m' && m.candle.closed) && events.candle.some((m) => m.tf === '5m'));
    const sig = events.event.find((e) => e.level === 'signal');
    assert.ok(sig && /^LONG [AB] \(\d+\.\d\) 5m @ /.test(sig.msg), sig?.msg);
    const snap = analyst.snapshot().symbols[0];
    assert.equal(snap.openSetup, null); assert.equal(snap.lastSetup.status, 'won');
    assert.equal(analyst.snapshot().limits.setupsToday.BTCUSD, 1);
    const marker = analyst.chartData('BTCUSD', '5m', 50).markers.find((m) => m.kind === 'setup' && m.t === s.t);
    assert.ok(marker && /^LONG [AB]$/.test(marker.text), 'setup marker on the chart');

    // --- durability: the journal on disk holds the open line and the resolution ---
    assert.equal(readFileSync(join(dir, 'setups.jsonl'), 'utf8').trim().split('\n').length, 1);
    assert.match(readFileSync(join(dir, 'resolutions.jsonl'), 'utf8'), /"status":"won"/);
    const reloaded = createJournal({ cfg, dir, now });
    assert.deepEqual(reloaded.load(), { setups: 1, open: 0, resolved: 1, malformed: 0 });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('e2e Pro (SPEC-PRO §P8): stacked BUY imbalances on the sweep candle at the swept Asia low under bullish bias → the long\'s reasons name the imbalance; the footprint SSE column is serialised', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'analyst-e2e-pro-'));
  try {
    const { cfg, symbolsCfg } = loadConfig({ env: { ANALYST_SYMBOLS: 'BTCUSD', ANALYST_FEED: 'replay' } });
    const sc = buildScenario();
    const { candles, history, sweepLow, playLast } = sc;
    const bucket = bucketFor(sc.atr0, symbolsCfg.symbols[0].tick, cfg);
    assert.equal(bucket, 0.01, `footprint bucket for ATR ${sc.atr0} at tick 0.01 (bucketAtr ${cfg.footprint.bucketAtr})`);
    // The tape of the manipulation minute (08:12): one sell hits the bid at the sweep low, then aggressive buyers lift the ask
    // on each of the next nine levels. bid(P − bucket) is 0 above the first level, so every one of them is a buy imbalance
    // (ratio ∞ → serialised null) and together they are one stacked run of 9 (source 05 §3).
    const px = (k) => +(sweepLow + k * bucket).toFixed(2);
    const trades = [{ t: T(8, 12) + 500, p: px(0), q: 1, side: 'sell' }];
    for (let k = 1; k <= 9; k++) trades.push({ t: T(8, 12) + 1000 + k * 1000, p: px(k), q: 5, side: 'buy' });
    let clock = history[0].t;
    const now = () => clock;
    const log = createLogger({ now, stream: null });
    const journal = createJournal({ cfg, dir, log, now });
    const symbol = { ...symbolsCfg.symbols[0], feedParams: { candles, trades, playLast } };
    const fpEvents = [], bookEvents = [];
    const analyst = new Analyst({
      cfg, symbolsCfg: { symbols: [symbol] }, log, journal, now,
      timers: { setTimeout: () => null, clearTimeout: () => {} },
      feedFactory: (s, g, deps) => {
        const feed = new ReplayFeed(s, s.feedParams, deps);
        feed.on('history', (m) => { clock = m.candles[m.candles.length - 1].t + MIN; });
        feed.on('candle', (m) => { clock = m.candle.t + MIN; });
        return feed;
      },
    });
    analyst.on('footprint', (m) => fpEvents.push(structuredClone(m)));
    analyst.on('book', (m) => bookEvents.push(m));
    await analyst.start();
    await analyst.stop();

    const all = journal.list({ symbol: 'BTCUSD', limit: 100 });
    assert.equal(all.length, 1, `expected exactly one setup, got ${all.map((s) => `${s.side}@${new Date(s.t).toISOString()}`).join(', ')}\nfeed:\n${log.recent(40).map((e) => `${e.level} ${e.msg}`).join('\n')}`);
    const s = all[0];
    assert.equal(s.side, 'long'); assert.equal(s.t, T(8, 10)); assert.equal(s.status, 'won');
    assert.ok(s.trigger.hits.includes('sweepReclaim') && s.trigger.hits.includes('footprintImbalance'), s.trigger.hits.join(','));
    assert.ok(s.trigger.real.includes('footprintImbalance'), 'a REAL trigger (satisfies the gate on its own)');
    assert.equal(s.trigger.kind, 'sweepReclaim', 'the sweep still names the setup (TRIGGER_PRIORITY)');
    const line = s.reasons.find((r) => /^Stacked buy imbalances/.test(r));
    assert.match(line ?? '', /^Stacked buy imbalances \(×9\) at the (Asia low|Asian low|equal lows|Asian session low|previous session low) — aggressive buyers stepping in at the zone$/, s.reasons.join('\n'));
    assert.ok(!s.trigger.hits.includes('unfinishedAuction'), 'only buys printed at the top of the tape — a finished auction');
    // score = Σ weights of its hits, the footprint weight among them
    const W = cfg.czt.weights;
    const sum = [...s.condition.hits.map((h) => W[`condition.${h}`]), ...s.zone.hits.map((h) => W[`zone.${h}`]), ...s.trigger.hits.map((h) => W[`trigger.${h}`])].reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(s.score - sum) < 1e-9, `score ${s.score} vs Σ weights ${sum}`);
    assert.ok(sum >= cfg.czt.minScore + W['trigger.footprintImbalance']);
    assert.ok(s.score >= cfg.czt.minScore && ['A', 'B'].includes(s.grade));
    // the footprint SSE column for the sweep candle, exactly as the dashboard receives it
    assert.equal(fpEvents.length, 1 + 9, 'history + nine 5m closes (08:00 → 08:45), one footprint event each');
    const col = fpEvents.find((m) => m.footprint.t === T(8, 10));
    assert.ok(col); assert.equal(col.symbol, 'BTCUSD'); assert.equal(col.tf, '5m'); assert.equal(col.trapped, null);
    const f = col.footprint;
    assert.equal(f.nTrades, 10); assert.equal(f.bucket, bucket); assert.equal(f.partial, false); assert.equal(f.totalAsk, 45); assert.equal(f.totalBid, 1);
    assert.deepEqual(f.stacked, [{ side: 'buy', from: px(1), to: px(9), count: 9 }]);
    assert.equal(f.imbalances.length, 9); assert.equal(f.imbalances[0].ratio, 5);
    assert.ok(f.imbalances.slice(1).every((i) => i.ratio === null && i.infinite === true), 'Infinity ratios travel as null + infinite:true');
    assert.equal(f.unfinishedHigh, false, 'only buys printed at the top level'); assert.equal(f.unfinishedLow, false, 'only the one sell printed at the low level — a finished auction (clean 0 ask)');
    assert.ok(fpEvents.filter((m) => m.footprint.t !== T(8, 10)).every((m) => m.footprint.nTrades === 0), 'no other candle had a tape');
    assert.equal(bookEvents.length, 0, 'a replay feed has no depth → no book, no book events');
    const pro = analyst.proData('BTCUSD');
    assert.equal(pro.book.summary, null); assert.match(pro.book.reason, /^No order book for this feed \(replay\)/);
    assert.equal(pro.footprints.find((x) => x.t === T(8, 10)).nTrades, 10);
    assert.equal(pro.partial, false); assert.equal(pro.backfill, null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
