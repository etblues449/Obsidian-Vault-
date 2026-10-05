#!/usr/bin/env node
// backtest.mjs — replay real history through the engine and print the scorecard (SPEC.md §1, §8).
//
//   node backtest.mjs --symbol BTCUSD [--days N | --offline <file.json>] [--tf 5m] [--warmup 240] [--json]
//
// --days N      fetch N days of 1m klines from Binance (paginated, ≤ 1 request/s) for a `binance` symbol
// --offline f   load a JSON array of 1m candles (or {candles:[…]}) — no network at all
// --tf          analysis timeframe override (structure TF is lifted to match when it would be finer)
// --warmup      minutes of history the engine sees before the first live candle (default 240, ≤ half the data)
// --json        machine-readable result instead of the tables
//
// The Analyst is driven by a fake clock set from each candle's close BEFORE the engine sees it (the
// replay feed's listeners run in registration order), so every session, cooldown and expiry decision
// is made in candle time. The journal writes to an in-memory fs: a backtest never touches data/.
// Walk-forward resolution is the same code path as live (journal.resolveOpen on every closed 1m).

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { loadConfig } from './lib/config.mjs';
import { createLogger } from './lib/log.mjs';
import { createJournal } from './lib/journal.mjs';
import { Analyst } from './lib/engine/analyst.mjs';
import { ReplayFeed } from './lib/feeds/replay.mjs';
import { TF_MS } from './lib/engine/candles.mjs';
import { REST_BASE, parseKlineRow } from './lib/feeds/binance.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/** node:fs stand-in: three sync calls the Journal uses, backed by a Map. */
export function memoryFs() {
  const files = new Map();
  return {
    files,
    mkdirSync() {},
    appendFileSync(path, text) { files.set(path, (files.get(path) || '') + text); },
    readFileSync(path) { if (!files.has(path)) { const e = new Error(`ENOENT: ${path}`); e.code = 'ENOENT'; throw e; } return files.get(path); },
  };
}

/** Accept a bare array, {candles:[…]} or Binance kline rows. */
export function loadOfflineCandles(file) {
  const raw = JSON.parse(readFileSync(resolve(file), 'utf8'));
  const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.candles) ? raw.candles : null;
  if (!arr) throw new Error(`${file}: expected a JSON array of 1m candles or {candles:[…]}`);
  return arr.map((c) => (Array.isArray(c) ? parseKlineRow(c) : c)).filter((c) => c && Number.isFinite(c.t));
}

/** Paginated Binance klines for the last `days` days (oldest→newest, closed only). */
export async function fetchKlines(pair, days, { fetch = globalThis.fetch, now = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)), progress = null } = {}) {
  const end = Math.floor(now() / 60e3) * 60e3;
  let start = end - days * 86400e3;
  const out = [];
  let calls = 0;
  while (start < end) {
    const url = `${REST_BASE}/klines?symbol=${pair}&interval=1m&limit=1000&startTime=${start}&endTime=${end - 1}`;
    const res = await fetch(url);
    calls++;
    if (res.status === 429 || res.status === 418) { const ra = Number(res.headers?.get?.('retry-after')) || 60; progress?.(`rate limited — waiting ${ra} s`); await sleep(ra * 1000); continue; }
    if (!res.ok) throw new Error(`Binance klines HTTP ${res.status} for ${pair}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) break;
    for (const k of rows) { const c = parseKlineRow(k, now()); if (c.closed) out.push(c); }
    progress?.(`${out.length} candles (${new Date(rows[rows.length - 1][0]).toISOString().slice(0, 16)}Z)`);
    const lastT = rows[rows.length - 1][0];
    if (rows.length < 1000 || lastT + 60e3 >= end) break;
    start = lastT + 60e3;
    await sleep(1000); // never more than 1 REST call/s (SPEC §3)
  }
  return { candles: out, calls };
}

/**
 * Run the replay. Returns { symbol, tf, candles, from, to, warmup, setups, scorecard:{trigger,session,grade}, open, log }.
 * `candles` are 1m, oldest→newest. Pure with respect to the file system.
 */
export async function runBacktest({ cfg, symbolCfg, candles, tf, warmupMinutes = 240, log = null }) {
  const c = structuredClone(cfg);
  if (tf) {
    if (!TF_MS[tf]) throw new RangeError(`unknown tf ${tf}`);
    c.timeframes.analysis = tf;
    if (TF_MS[c.timeframes.structure] < TF_MS[tf]) c.timeframes.structure = tf;
    if (TF_MS[c.timeframes.bias] < TF_MS[c.timeframes.structure]) c.timeframes.bias = c.timeframes.structure;
    if (TF_MS[c.timeframes.htf] < TF_MS[c.timeframes.bias]) c.timeframes.htf = c.timeframes.bias;
    if (!c.timeframes.available.includes(tf)) c.timeframes.available.push(tf);
  }
  const sorted = candles.slice().sort((a, b) => a.t - b.t);
  if (sorted.length < 60) throw new Error(`need at least 60 candles, got ${sorted.length}`);
  const warmup = Math.min(Math.max(1, warmupMinutes | 0), Math.floor(sorted.length / 2));
  let clock = sorted[0].t;
  const now = () => clock;
  const logger = log ?? createLogger({ now, stream: null, capacity: 5000 });
  const journal = createJournal({ cfg: c, dir: 'backtest-memory', log: logger, now, fs: memoryFs() });
  const symbolsCfg = { symbols: [{ ...symbolCfg, feed: 'replay', feedParams: { candles: sorted, playLast: sorted.length - warmup } }] };
  const analyst = new Analyst({
    cfg: c, symbolsCfg, log: logger, journal, now,
    timers: { setTimeout: () => null, clearTimeout: () => {} }, // synchronous replay: closed prints flush themselves
    feedFactory: (s, g, deps) => {
      const feed = new ReplayFeed(s, s.feedParams, deps);
      // Registered before the Analyst's own listeners, so the clock is already at the candle's close when the engine runs.
      feed.on('history', (m) => { if (m.candles.length) clock = m.candles[m.candles.length - 1].t + 60e3; });
      feed.on('candle', (m) => { clock = m.candle.t + 60e3; });
      return feed;
    },
  });
  await analyst.start();
  await analyst.stop();
  const setups = journal.list({ symbol: symbolCfg.id, limit: 100000 }).reverse();
  const scorecard = { trigger: journal.scorecard({ by: 'trigger' }), session: journal.scorecard({ by: 'session' }), grade: journal.scorecard({ by: 'grade' }), all: journal.scorecard({ by: 'all' }) };
  return { symbol: symbolCfg.id, tf: c.timeframes.analysis, candles: sorted.length, from: sorted[0].t, to: sorted[sorted.length - 1].t, warmup, setups, scorecard, open: journal.open(symbolCfg.id).length, log: logger };
}

// ---- rendering ----
const iso = (t) => new Date(t).toISOString().slice(0, 16).replace('T', ' ') + 'Z';
const fmt = (x, dp = 2) => (typeof x === 'number' && Number.isFinite(x) ? x.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp }) : '—');
const signed = (x, dp = 2) => (typeof x === 'number' && Number.isFinite(x) ? (x > 0 ? '+' : '') + x.toFixed(dp) : '—');

export function table(rows, cols) {
  const cells = rows.map((r) => cols.map((c) => String(c.get(r) ?? '')));
  const widths = cols.map((c, i) => Math.max(c.title.length, ...cells.map((r) => r[i].length)));
  const line = (vals) => vals.map((v, i) => (cols[i].right ? v.padStart(widths[i]) : v.padEnd(widths[i]))).join('  ');
  return [line(cols.map((c) => c.title)), line(widths.map((w) => '-'.repeat(w))), ...cells.map(line)].join('\n');
}

export function scorecardTable(rows) {
  if (!rows.length) return '(no resolved setups)';
  return table(rows, [
    { title: 'key', get: (r) => r.key }, { title: 'n', get: (r) => r.n, right: true }, { title: 'wins', get: (r) => r.wins, right: true },
    { title: 'win%', get: (r) => fmt(r.winRate * 100, 0), right: true }, { title: 'expR', get: (r) => signed(r.expectancyR), right: true },
    { title: 'PF', get: (r) => (r.profitFactor == null ? '∞' : fmt(r.profitFactor)), right: true }, { title: 'maxDD', get: (r) => fmt(r.maxDdR) + 'R', right: true },
    { title: 'avgRR', get: (r) => fmt(r.avgRr), right: true }, { title: 'netR', get: (r) => signed(r.netR), right: true },
    { title: 'CI95', get: (r) => `${fmt(r.ci95[0] * 100, 0)}–${fmt(r.ci95[1] * 100, 0)}%`, right: true },
  ]);
}

export function setupLine(s, dp = 2) {
  let displayStatus = s.status;
  if (s.status !== 'open') {
    const r = Number(s.resultR) || 0;
    if (r > 0.05) displayStatus = 'won';
    else if (r < -0.05) displayStatus = 'lost';
    else displayStatus = 'flat';
    if (s.exit) displayStatus += '/' + s.exit;
  }
  
  const res = s.status === 'open' ? 'open' : `${displayStatus} ${signed(s.resultR)}R${s.resolvedAt ? ' @ ' + iso(s.resolvedAt) : ''}${s.ambiguous ? ' (ambiguous bar)' : ''}`;
  return `${iso(s.t)}  ${s.side.toUpperCase().padEnd(5)} ${s.grade} ${fmt(s.score, 1).padStart(4)}  entry ${fmt(s.entry, dp)}  stop ${fmt(s.stop, dp)}  T1 ${fmt(s.targets?.[0]?.price, dp)} (${fmt(s.rr, 2)}R)  → ${res}  [${[...(s.condition?.hits || []), ...(s.zone?.hits || []), ...(s.trigger?.hits || [])].join(', ')}]`;
}

export function render(r, dp = 2) {
  const out = [];
  out.push(`TradeGuard backtest — ${r.symbol} · analysis ${r.tf} · ${r.candles} × 1m candles ${iso(r.from)} → ${iso(r.to)} · warm-up ${r.warmup} min`);
  out.push(`Setups: ${r.setups.length} (${r.open} still open)   net ${signed(r.scorecard.all[0]?.netR ?? 0)}R   expectancy ${signed(r.scorecard.all[0]?.expectancyR ?? 0)}R/trade`);
  out.push('', 'By trigger', scorecardTable(r.scorecard.trigger));
  out.push('', 'By session', scorecardTable(r.scorecard.session));
  out.push('', 'By grade', scorecardTable(r.scorecard.grade));
  out.push('', 'Setups');
  if (!r.setups.length) out.push('(none — no Condition → Zone → Trigger confluence reached minScore inside a killzone)');
  for (const s of r.setups) out.push(setupLine(s, dp));
  return out.join('\n');
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const { values } = parseArgs({ args: argv, options: {
    symbol: { type: 'string' }, days: { type: 'string' }, offline: { type: 'string' }, tf: { type: 'string' },
    warmup: { type: 'string', default: '240' }, json: { type: 'boolean', default: false }, verbose: { type: 'boolean', default: false }, help: { type: 'boolean', default: false },
  } });
  if (values.help || !values.symbol) {
    process.stdout.write('usage: node backtest.mjs --symbol BTCUSD [--days N | --offline <file.json>] [--tf 5m] [--warmup 240] [--json] [--verbose]\n');
    return values.help ? 0 : 2;
  }
  const { cfg, symbolsCfg } = loadConfig({ env: { ...env, ANALYST_SYMBOLS: undefined } });
  const symbolCfg = symbolsCfg.symbols.find((s) => s.id === values.symbol);
  if (!symbolCfg) { process.stderr.write(`unknown symbol ${values.symbol} (configured: ${symbolsCfg.symbols.map((s) => s.id).join(', ')})\n`); return 2; }
  let candles;
  if (values.offline) candles = loadOfflineCandles(values.offline);
  else {
    const days = Number(values.days);
    if (!(days > 0)) { process.stderr.write('give --days N (Binance fetch) or --offline <file.json>\n'); return 2; }
    const feedOriginal = symbolCfg.feedOriginal ?? symbolCfg.feed;
    if (feedOriginal !== 'binance' || !symbolCfg.feedParams?.stream) { process.stderr.write(`${symbolCfg.id} is not a binance symbol — use --offline with your own 1m candles\n`); return 2; }
    const pair = symbolCfg.feedParams.stream.toUpperCase();
    process.stderr.write(`fetching ${days} day(s) of ${pair} 1m klines from Binance…\n`);
    const r = await fetchKlines(pair, days, { progress: (m) => process.stderr.write(`  ${m}\n`) });
    candles = r.candles;
    process.stderr.write(`  ${candles.length} candles in ${r.calls} request(s)\n`);
  }
  const t0 = performance.now();
  const r = await runBacktest({ cfg, symbolCfg, candles, tf: values.tf, warmupMinutes: Number(values.warmup) || 240 });
  const ms = Math.round(performance.now() - t0);
  if (values.json) {
    const { log, ...rest } = r;
    process.stdout.write(JSON.stringify({ ...rest, ms, feed: log.recent(50) }, null, 2) + '\n');
  } else {
    process.stdout.write(render(r, symbolCfg.dp) + `\n\n(${ms} ms)\n`);
    if (values.verbose) for (const e of r.log.recent(500).reverse()) process.stdout.write(`${iso(e.t)} ${e.level.padEnd(6)} ${e.msg}\n`);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then((code) => process.exit(code), (e) => { process.stderr.write(`backtest failed: ${e.stack || e.message}\n`); process.exit(1); });
}

