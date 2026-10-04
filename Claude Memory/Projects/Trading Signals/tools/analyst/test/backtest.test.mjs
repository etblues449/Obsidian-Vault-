// test/backtest.test.mjs — SPEC §8 backtest smoke: the offline replay of test/fixtures/btc-1m.json runs with
// no network, completes, and prints the scorecard table; the helpers behave.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBacktest, render, scorecardTable, table, memoryFs, loadOfflineCandles, fetchKlines } from '../backtest.mjs';
import { loadConfig } from '../lib/config.mjs';
import { fakeFetch, loadFixture } from './helpers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const FIXTURE = resolve(HERE, 'fixtures/btc-1m.json');
const run = (args) => new Promise((r) => execFile(process.execPath, [resolve(ROOT, 'backtest.mjs'), ...args], { cwd: ROOT, env: { ...process.env, ANALYST_SYMBOLS: '' }, timeout: 60_000 }, (error, stdout, stderr) => r({ code: error ? error.code ?? 1 : 0, stdout, stderr })));

describe('backtest', () => {
  test('runBacktest replays the fixture through the real engine with a candle-driven clock and resolves setups walk-forward', async () => {
    const { cfg, symbolsCfg } = loadConfig({ env: {} });
    const symbolCfg = symbolsCfg.symbols.find((s) => s.id === 'BTCUSD');
    const r = await runBacktest({ cfg, symbolCfg, candles: loadFixture(), warmupMinutes: 240 });
    assert.equal(r.symbol, 'BTCUSD'); assert.equal(r.tf, '5m'); assert.equal(r.candles, 2000); assert.equal(r.warmup, 240);
    assert.equal(r.from, 1791022620000); assert.equal(r.to, 1791142560000);
    assert.ok(Array.isArray(r.setups));
    for (const s of r.setups) {
      assert.ok(s.t >= r.from + 240 * 60e3, 'no setup from the warm-up window');
      assert.ok(['open', 'won', 'lost', 'expired'].includes(s.status));
      assert.ok(s.condition.session.killzone === true, 'every setup sits inside a killzone (tradeOnlyInKillzones)');
      assert.ok(s.score >= cfg.czt.minScore);
      if (s.status !== 'open') assert.ok(s.resolvedAt > s.t && typeof s.resultR === 'number');
    }
    assert.ok(r.setups.length >= 1, 'the real BTC day produces at least one setup');
    for (const k of ['trigger', 'session', 'grade', 'all']) assert.ok(Array.isArray(r.scorecard[k]));
    const resolved = r.setups.filter((s) => s.status !== 'open');
    assert.equal(r.scorecard.all[0]?.n ?? 0, resolved.length);
    assert.equal(r.open, r.setups.filter((s) => s.status === 'open').length);
    const text = render(r, 2);
    assert.match(text, /By trigger\nkey/); assert.match(text, /win%\s+expR\s+PF\s+maxDD/); assert.match(text, /Setups\n/);
    const r2 = await runBacktest({ cfg, symbolCfg, candles: loadFixture(), warmupMinutes: 240 });
    assert.deepEqual(r2.setups.map((s) => [s.id, s.status, s.resultR]), r.setups.map((s) => [s.id, s.status, s.resultR]), 'deterministic');
  });

  test('--tf 15m lifts the structure TF and still runs; a tiny input is refused', async () => {
    const { cfg, symbolsCfg } = loadConfig({ env: {} });
    const symbolCfg = symbolsCfg.symbols.find((s) => s.id === 'BTCUSD');
    const r = await runBacktest({ cfg, symbolCfg, candles: loadFixture(), tf: '15m', warmupMinutes: 600 });
    assert.equal(r.tf, '15m');
    await assert.rejects(() => runBacktest({ cfg, symbolCfg, candles: loadFixture().slice(0, 10) }), /at least 60/);
    await assert.rejects(() => runBacktest({ cfg, symbolCfg, candles: loadFixture(), tf: '2h' }), RangeError);
  });

  test('CLI: node backtest.mjs --symbol BTCUSD --offline fixture prints the table and exits 0; --json is parseable', async () => {
    const r = await run(['--symbol', 'BTCUSD', '--offline', FIXTURE]);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /TradeGuard backtest — BTCUSD · analysis 5m · 2000 × 1m candles/);
    assert.match(r.stdout, /By trigger\nkey\s+n\s+wins/);
    assert.match(r.stdout, /By session/); assert.match(r.stdout, /\(\d+ ms\)/);
    const j = await run(['--symbol', 'BTCUSD', '--offline', FIXTURE, '--json']);
    assert.equal(j.code, 0, j.stderr);
    const parsed = JSON.parse(j.stdout);
    assert.equal(parsed.symbol, 'BTCUSD'); assert.equal(parsed.candles, 2000); assert.ok(Array.isArray(parsed.setups));
    const bad = await run(['--symbol', 'NOPE', '--offline', FIXTURE]);
    assert.equal(bad.code, 2); assert.match(bad.stderr, /unknown symbol/);
    const noArgs = await run([]);
    assert.equal(noArgs.code, 2); assert.match(noArgs.stdout, /usage/);
  });

  test('helpers: memoryFs, loadOfflineCandles accepts arrays / {candles} / kline rows, table formatting, paginated fetchKlines', async () => {
    const fs = memoryFs();
    fs.appendFileSync('/x', 'a\n'); fs.appendFileSync('/x', 'b\n');
    assert.equal(fs.readFileSync('/x'), 'a\nb\n');
    assert.throws(() => fs.readFileSync('/y'), (e) => e.code === 'ENOENT');
    const c = loadOfflineCandles(FIXTURE);
    assert.equal(c.length, 2000);
    assert.equal(scorecardTable([]), '(no resolved setups)');
    assert.match(table([{ a: 1 }], [{ title: 'A', get: (r) => r.a, right: true }]), /^A\n-\n1$/);
    const row = (t) => [t, '1', '2', '0.5', '1.5', '3', t + 59999, '1', 10, '2', '1', '0'];
    const page1 = Array.from({ length: 1000 }, (_, i) => row(i * 60e3)), page2 = Array.from({ length: 20 }, (_, i) => row((1000 + i) * 60e3));
    const fetch = fakeFetch({ 'startTime=0&': { json: page1 }, 'startTime=60000000&': { json: page2 } });
    const now = () => 1020 * 60e3;
    const r = await fetchKlines('BTCUSDT', 1020 / 1440, { fetch, now, sleep: async () => {} });
    assert.equal(r.calls, 2); assert.equal(r.candles.length, 1020);
    assert.equal(r.candles[0].t, 0); assert.equal(r.candles[1019].t, 1019 * 60e3);
    assert.equal(r.candles[0].buyV, 2, 'k[9] = taker buy base volume'); assert.equal(r.candles[0].sellV, 1, 'sellV = v − buyV');
  });
});
