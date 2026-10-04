#!/usr/bin/env node
// server.mjs — HTTP + SSE + static (SPEC.md §6). node:http only; composes config → logger → journal →
// bridge → Analyst → feeds. `createServer()` is exported for tests (listen on port 0); `main()` runs
// when this file is the entry point.
//
// Routes: GET /health · /api/state · /api/chart/:symbol?tf=&limit= · /api/setups?symbol=&limit= ·
//         /api/scorecard?by= · /api/feed?limit=&symbol= · /events (SSE) · static from public/
// SSE: `retry: 3000`, a ": hb" comment every 15 s, events `event` | `candle` | `setup` | `status` | `levels`.
//      The shared logger's 'event' stream is what reaches the feed (feed/journal/bridge/analyst lines
//      all go through it); the Analyst's own 'event' is NOT subscribed here, that would double them.
//      On connect every client receives the current 'status' of each symbol so a reconnecting
//      dashboard repaints its pills without waiting for the next feed message.
// Safety: static files are served only from inside public/ (resolve + prefix check), bad requests get
//      JSON {error} and never crash the process, a slow SSE client (> 1 MB buffered) is dropped.
// Shutdown: SIGINT/SIGTERM → close feeds, end SSE clients, flush the journal, exit 0 (5 s hard limit).

import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { createLogger } from './lib/log.mjs';
import { createJournal, SCORECARD_BY } from './lib/journal.mjs';
import { createBridge } from './lib/executor-bridge.mjs';
import { Analyst } from './lib/engine/analyst.mjs';
import { TF_MS } from './lib/engine/candles.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PUBLIC_DIR = resolve(HERE, 'public');
const HEARTBEAT_MS = 15_000;
const SSE_MAX_BUFFER = 1 << 20;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

const json = (res, status, body) => {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(text) });
  res.end(text);
};
const intParam = (v, dflt, { min = 1, max = 5000 } = {}) => { const n = Number.parseInt(v ?? '', 10); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : dflt; };

/**
 * Build the HTTP server around an analyst + logger (+ optional journal). Nothing is listening yet.
 * @param {object} opts  { analyst, log, journal?, publicDir?, now?, timers? }
 * @returns {{ server: http.Server, clients: Set, close(): Promise<void>, broadcast(name, data) }}
 */
export function createServer({ analyst, log, journal = null, publicDir = PUBLIC_DIR, now = () => Date.now(), timers = {} } = {}) {
  if (!analyst || !log) throw new TypeError('createServer needs { analyst, log }');
  const T = { setInterval: timers.setInterval ?? globalThis.setInterval, clearInterval: timers.clearInterval ?? globalThis.clearInterval };
  const root = resolve(publicDir);
  const clients = new Set();
  const startedAt = now();

  // ---- SSE fan-out ----
  function broadcast(name, data) {
    if (!clients.size) return;
    const frame = `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) {
      if (res.writableLength > SSE_MAX_BUFFER || res.destroyed) { clients.delete(res); res.destroy(); continue; }
      res.write(frame);
    }
  }
  const onLog = (ev) => broadcast('event', ev);
  const onCandle = (m) => broadcast('candle', m);
  const onSetup = (s) => broadcast('setup', s);
  const onStatus = (s) => broadcast('status', s);
  const onLevels = (m) => broadcast('levels', m);
  log.on('event', onLog);
  analyst.on('candle', onCandle); analyst.on('setup', onSetup); analyst.on('status', onStatus); analyst.on('levels', onLevels);
  const heartbeat = T.setInterval(() => { for (const res of clients) { if (res.destroyed) clients.delete(res); else res.write(': hb\n\n'); } }, HEARTBEAT_MS);
  if (heartbeat && typeof heartbeat.unref === 'function') heartbeat.unref();

  function sse(req, res) {
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    res.write('retry: 3000\n: connected\n\n');
    clients.add(res);
    const snap = analyst.snapshot();
    for (const s of snap.symbols || []) res.write(`event: status\ndata: ${JSON.stringify({ symbol: s.id, state: s.feed?.state, kind: s.feed?.kind, detail: s.feed?.detail ?? null })}\n\n`);
    const drop = () => { clients.delete(res); };
    req.on('close', drop); res.on('close', drop); res.on('error', drop);
  }

  // ---- API ----
  function api(url, res) {
    const p = url.pathname;
    if (p === '/health') {
      const snap = analyst.snapshot();
      const symbols = {};
      for (const s of snap.symbols || []) symbols[s.id] = { state: s.feed?.state ?? null, kind: s.feed?.kind ?? null, lastCandleT: s.lastCandleT ?? null };
      return json(res, 200, { ok: true, uptime: Math.round((now() - startedAt) / 1000), uptimeMs: now() - startedAt, symbols });
    }
    if (p === '/api/state') return json(res, 200, analyst.snapshot());
    if (p.startsWith('/api/chart/')) {
      let id;
      try { id = decodeURIComponent(p.slice('/api/chart/'.length)); } catch { return json(res, 400, { error: 'bad symbol encoding' }); }
      const tf = url.searchParams.get('tf') || undefined;
      if (tf !== undefined && !TF_MS[tf]) return json(res, 400, { error: `unknown tf ${tf} (expected ${Object.keys(TF_MS).join('|')})` });
      const limit = intParam(url.searchParams.get('limit'), 500);
      try { return json(res, 200, analyst.chartData(id, tf, limit)); }
      catch (e) { return json(res, e instanceof RangeError ? 404 : 500, { error: e.message }); }
    }
    if (p === '/api/setups') {
      if (!journal) return json(res, 200, []);
      const symbol = url.searchParams.get('symbol') || undefined, status = url.searchParams.get('status') || undefined;
      return json(res, 200, journal.list({ symbol, status, limit: intParam(url.searchParams.get('limit'), 50) }));
    }
    if (p === '/api/scorecard') {
      if (!journal) return json(res, 200, []);
      const by = url.searchParams.get('by') || 'trigger', symbol = url.searchParams.get('symbol') || undefined;
      if (!SCORECARD_BY.includes(by)) return json(res, 400, { error: `by must be one of ${SCORECARD_BY.join('|')}` });
      try { return json(res, 200, journal.scorecard({ by, symbol })); }
      catch (e) { return json(res, e instanceof RangeError ? 400 : 500, { error: e.message }); }
    }
    if (p === '/api/feed') {
      const symbol = url.searchParams.get('symbol') || undefined;
      return json(res, 200, log.recent(intParam(url.searchParams.get('limit'), 200, { max: 2000 }), { symbol }));
    }
    return json(res, 404, { error: `no route ${p}` });
  }

  // ---- static ----
  function serveStatic(url, res, headOnly) {
    let rel;
    try { rel = decodeURIComponent(url.pathname); } catch { return json(res, 400, { error: 'bad path encoding' }); }
    if (rel === '/' || rel === '') rel = '/index.html';
    if (rel.includes('\0')) return json(res, 400, { error: 'bad path' });
    const file = resolve(root, '.' + rel);
    if (file !== root && !file.startsWith(root + sep)) return json(res, 404, { error: 'not found' }); // traversal guard
    let st;
    try { st = statSync(file); } catch { return json(res, 404, { error: 'not found' }); }
    if (!st.isFile()) return json(res, 404, { error: 'not found' });
    const ext = extname(file).toLowerCase();
    const headers = { 'content-type': MIME[ext] || 'application/octet-stream', 'content-length': st.size, 'x-content-type-options': 'nosniff' };
    headers['cache-control'] = ['.html', '.js', '.mjs', '.css'].includes(ext) ? 'no-cache' : 'public, max-age=86400';
    res.writeHead(200, headers);
    if (headOnly) return res.end();
    const stream = createReadStream(file);
    stream.on('error', () => { if (!res.headersSent) json(res, 500, { error: 'read error' }); else res.destroy(); });
    stream.pipe(res);
  }

  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('allow', 'GET, HEAD'); return json(res, 405, { error: 'method not allowed' }); }
      if (url.pathname === '/events') { if (req.method === 'HEAD') return json(res, 405, { error: 'method not allowed' }); return sse(req, res); }
      if (url.pathname === '/health' || url.pathname.startsWith('/api/')) return api(url, res);
      return serveStatic(url, res, req.method === 'HEAD');
    } catch (e) {
      log.error('*', `HTTP handler error: ${e.message}`, { url: req.url });
      if (!res.headersSent) json(res, 500, { error: 'internal error' }); else res.destroy();
    }
  });
  server.keepAliveTimeout = 65_000;

  async function close() {
    T.clearInterval(heartbeat);
    log.off('event', onLog);
    analyst.off('candle', onCandle); analyst.off('setup', onSetup); analyst.off('status', onStatus); analyst.off('levels', onLevels);
    for (const res of clients) { try { res.end(); } catch { /* gone */ } }
    clients.clear();
    await new Promise((r) => server.close(() => r()));
  }

  return { server, clients, broadcast, close };
}

/** Compose and run. Exits 1 with a plain message on a config error or a busy port. */
export async function main({ env = process.env, argv = process.argv } = {}) {
  let loaded;
  try { loaded = loadConfig({ env }); }
  catch (e) { process.stderr.write(`${e.message}\n`); process.exit(1); }
  const { cfg, symbolsCfg, server: bind, warnings, applied } = loaded;
  const log = createLogger({ now: () => Date.now(), level: env.ANALYST_LOG_LEVEL || 'info', json: env.ANALYST_LOG_JSON === '1' });
  for (const w of warnings) log.warn('*', `Config: ${w}`);
  if (applied.length) log.info('*', `Config overrides from env: ${applied.join(', ')}`);
  const dataDir = resolve(HERE, cfg.journal.dir);
  const journal = createJournal({ cfg, dir: dataDir, log, now: () => Date.now() });
  const bridge = createBridge({ cfg, log, now: () => Date.now(), env });
  const analyst = new Analyst({ cfg, symbolsCfg, log, journal, bridge, now: () => Date.now() });
  const app = createServer({ analyst, log, journal });

  await new Promise((resolveListen) => {
    app.server.once('error', (e) => {
      if (e.code === 'EADDRINUSE') process.stderr.write(`\nPort ${bind.port} on ${bind.host} is already in use — is another analyst running? Stop it (pkill -f "analyst/server.mjs") or start this one with ANALYST_PORT=${bind.port + 1}.\n`);
      else process.stderr.write(`\nCannot listen on ${bind.host}:${bind.port}: ${e.message}\n`);
      process.exit(1);
    });
    app.server.listen(bind.port, bind.host, resolveListen);
  });
  const addr = app.server.address();
  const url = `http://${bind.host === '0.0.0.0' ? '127.0.0.1' : bind.host}:${addr.port}/`;
  log.ok('*', `TradeGuard Analyst listening on ${url}  (data: ${dataDir})`);
  for (const s of symbolsCfg.symbols) log.info(s.id, `feed ${s.feed}${s.feedOriginal ? ` (overrides ${s.feedOriginal})` : ''} → ${s.feed === 'binance' ? 'LIVE' : s.feed === 'simulated' ? 'SIM' : s.feed === 'yahoo' ? 'DELAYED' : s.feed.toUpperCase()}${s.sourceNote ? ` — ${s.sourceNote}` : ''}`);
  if (cfg.executorBridge?.enabled) log.warn('*', `Executor bridge ENABLED for ${cfg.executorBridge.symbols.join(', ')} (grade ≥ ${cfg.executorBridge.minGrade}) → ${cfg.executorBridge.url}`);
  else log.info('*', 'Executor bridge off — analysis only, nothing here places orders');

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return; shuttingDown = true;
    log.info('*', `${signal} — shutting down`);
    const hard = setTimeout(() => process.exit(0), 5000); hard.unref();
    try { await analyst.stop(); journal.flush(); await app.close(); journal.close(); } catch (e) { log.error('*', `Shutdown error: ${e.message}`); }
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (e) => { log.error('*', `Uncaught: ${e?.stack || e}`); });
  process.on('unhandledRejection', (e) => { log.error('*', `Unhandled rejection: ${e?.stack || e}`); });

  await analyst.start();
  return { app, analyst, journal, log, url };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
