#!/usr/bin/env node
// scripts/check.mjs — preflight (SPEC.md §1): node ≥ 22, configs load, data dir writable, port free,
// Binance REST reachable (3 s timeout, non-fatal). Prints one PASS / WARN / FAIL line per check and
// exits 1 when anything FAILed, so install-termux.sh and a human get the same answer.

import net from 'node:net';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, ConfigError } from '../lib/config.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PING = 'https://data-api.binance.vision/api/v3/ping';
let fails = 0;
const say = (status, msg) => { if (status === 'FAIL') fails++; process.stdout.write(`${status.padEnd(4)} ${msg}\n`); };

// 1. Node version
const major = Number(process.versions.node.split('.')[0]);
if (major >= 22) say('PASS', `node ${process.version} (≥ 22; native WebSocket + fetch + node:test)`);
else say('FAIL', `node ${process.version} is too old — need 22+ (Termux: pkg upgrade nodejs; Windows: nodejs.org LTS)`);

// 2. Config
let loaded = null;
try {
  loaded = loadConfig({ env: process.env });
  const feeds = loaded.symbolsCfg.symbols.map((s) => `${s.id}=${s.feed}${s.feedOriginal ? `(was ${s.feedOriginal})` : ''}`).join(', ');
  say('PASS', `config: ${loaded.symbolsCfg.symbols.length} symbol(s) — ${feeds}`);
  for (const w of loaded.warnings) say('WARN', `config: ${w}`);
  if (loaded.applied.length) say('PASS', `config: env overrides applied — ${loaded.applied.join(', ')}`);
  const sims = loaded.symbolsCfg.symbols.filter((s) => s.feed === 'simulated').map((s) => s.id);
  if (sims.length) say('WARN', `${sims.join(', ')} run on the SIMULATED feed — synthetic prices, labelled SIM on the dashboard (switch to yahoo or a broker adapter for real data)`);
  if (loaded.cfg.executorBridge?.enabled && !process.env.ANALYST_EXECUTOR_SECRET) say('WARN', 'executorBridge.enabled but ANALYST_EXECUTOR_SECRET is not set — the bridge will refuse to send');
} catch (e) {
  if (e instanceof ConfigError) for (const issue of e.issues) say('FAIL', `config: ${issue}`);
  else say('FAIL', `config: ${e.message}`);
}

// 3. Data dir writable
if (loaded) {
  const dir = resolve(ROOT, loaded.cfg.journal.dir);
  try {
    mkdirSync(dir, { recursive: true });
    const probe = join(dir, `.write-test-${process.pid}`);
    writeFileSync(probe, 'ok'); unlinkSync(probe);
    say('PASS', `data dir writable: ${dir}`);
  } catch (e) { say('FAIL', `data dir ${dir} not writable: ${e.message}`); }
}

// 4. Port free (a busy port that answers /health ok:true is OUR analyst already running → WARN, not FAIL)
if (loaded) {
  const { host, port } = loaded.server;
  const free = await new Promise((r) => {
    const srv = net.createServer();
    srv.once('error', (e) => r({ ok: false, code: e.code }));
    srv.listen(port, host, () => srv.close(() => r({ ok: true })));
  });
  if (free.ok) say('PASS', `port ${host}:${port} is free`);
  else if (free.code === 'EADDRINUSE') {
    const ours = await fetchJson(`http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}/health`, 1500);
    if (ours && ours.ok === true) say('WARN', `port ${port} is busy — a TradeGuard Analyst is already running there (uptime ${ours.uptime}s)`);
    else say('FAIL', `port ${host}:${port} is in use by something else — set ANALYST_PORT or stop that process`);
  } else say('FAIL', `cannot bind ${host}:${port}: ${free.code}`);
}

// 5. Binance REST reachable (only matters when a symbol uses it; never fatal — the feed reconnects forever)
if (loaded) {
  const usesBinance = loaded.symbolsCfg.symbols.some((s) => s.feed === 'binance');
  if (!usesBinance) say('PASS', 'Binance not used by any symbol — reachability check skipped');
  else {
    const t0 = performance.now();
    const r = await fetchJson(PING, 3000);
    if (r) say('PASS', `Binance REST reachable (${Math.round(performance.now() - t0)} ms)`);
    else say('WARN', 'Binance REST not reachable within 3 s — live feeds will show Connecting…/Reconnecting… until the network is up');
  }
}

process.stdout.write(fails ? `\n${fails} FAIL — fix the lines above and re-run.\n` : '\nAll checks passed.\n');
process.exit(fails ? 1 : 0);

async function fetchJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try { const res = await fetch(url, { signal: ctrl.signal }); if (!res.ok) return null; return await res.json(); }
  catch { return null; }
  finally { clearTimeout(t); }
}
