// lib/executor-bridge.mjs — opt-in POST of a Setup to the executor's TradingView-style webhook
// (SPEC.md §1, strategy.json executorBridge). OFF by default. Nothing here places an order: the
// executor applies every gate of its own (gold-only, 1 %/trade, 5 %/day, alert_id idempotency).
//
// Gates, in order: cfg enabled → symbol in cfg symbols → grade ≥ minGrade → setup shape valid →
// secret present in the environment → not already attempted. Body:
//   { secret, alert_id: setup.id, time: floor(setup.t / 1000), side: 'BUY'|'SELL', entry, sl: stop, tp: targets[0].price }
// 5 s AbortController timeout. The secret comes from `env.ANALYST_EXECUTOR_SECRET` at send time
// and is never stored on the bridge, never logged, never part of a returned result.
//
// Dedupe is by alert_id and an alert is marked attempted BEFORE the request leaves: a timeout may
// have been received by the executor, and the one unrecoverable error here is a doubled order.
// A failed send is reported (`sent:false, status|error`), never retried on the same alert_id.
//
// DEVIATION: none from SPEC (which names the module but defines no API). The task brief says
//   `cfg.bridge.*`; strategy.json names the block `executorBridge`, so both are accepted:
//   cfg.executorBridge ?? cfg.bridge ?? cfg itself when it carries `enabled` directly.
//   Additive: createBridge() also takes `env` and `timeoutMs` (tests), and returns `stats()`.
// Review findings executor-bridge.mjs:96 / :84 — the executor's RESPONSE BODY is never logged (an
//   echoing endpoint would reflect the secret straight into stderr / the feed / SSE / the dashboard: the
//   status code is enough), every error string is scrubbed of the secret before it is logged or returned,
//   and the URL is logged with any user:password@ stripped — and a URL carrying userinfo is refused
//   outright (`no-url`), because the config loader rejects it too.

const GRADE_RANK = { A: 3, B: 2, C: 1 };
const MAX_SEEN = 5000; // bounded dedupe memory; a day has ≤ 12 grade-A setups across 4 symbols
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** grade ≥ minGrade in A > B > C order. Unknown grades never pass. */
export function gradeAtLeast(grade, minGrade) {
  return (GRADE_RANK[grade] ?? 0) >= (GRADE_RANK[minGrade] ?? Infinity);
}

/** URL for log lines: userinfo removed. A string that is not a URL is returned as-is. */
export function displayUrl(u) {
  try { const x = new URL(String(u)); x.username = ''; x.password = ''; return x.href; } catch { return String(u); }
}

/** The executor block from a strategy config (see DEVIATION). Always an object. */
export function bridgeConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return {};
  return cfg.executorBridge ?? cfg.bridge ?? (typeof cfg.enabled === 'boolean' ? cfg : {});
}

/** Webhook body for a setup. Pure; the caller supplies the secret. Throws on a malformed setup. */
export function toAlert(setup, secret) {
  if (!setup || typeof setup.id !== 'string' || !setup.id) throw new TypeError('setup.id must be a non-empty string');
  if (setup.side !== 'long' && setup.side !== 'short') throw new TypeError(`setup.side must be long|short, got ${JSON.stringify(setup.side)}`);
  const tp = setup.targets?.[0]?.price;
  if (![setup.t, setup.entry, setup.stop, tp].every(isNum)) throw new TypeError('setup.t, entry, stop and targets[0].price must be finite numbers');
  return { secret, alert_id: setup.id, time: Math.floor(setup.t / 1000), side: setup.side === 'long' ? 'BUY' : 'SELL', entry: setup.entry, sl: setup.stop, tp };
}

/**
 * @param {object} opts
 * @param {object} opts.cfg          strategy config (or its executorBridge block)
 * @param {Function} [opts.fetch]    fetch stand-in (tests)
 * @param {object} [opts.log]        logger; optional
 * @param {() => number} [opts.now]  clock for timestamps in results/logs; injected
 * @param {object} [opts.env]        environment holding ANALYST_EXECUTOR_SECRET (default process.env)
 * @param {number} [opts.timeoutMs]  request timeout (default 5000)
 * @returns {{ maybeSend(setup): Promise<{sent:boolean, status?:number, skipped?:string, error?:string}>, stats(): object }}
 */
export function createBridge({ cfg, fetch = globalThis.fetch, log = null, now = () => Date.now(), env = process.env, timeoutMs = 5000 } = {}) {
  const b = bridgeConfig(cfg);
  const symbols = new Set(Array.isArray(b.symbols) ? b.symbols : []);
  const seen = new Set();
  const stats = { attempted: 0, sent: 0, failed: 0, skipped: 0, lastStatus: null, lastAt: null };
  let warnedNoSecret = false;
  const say = (level, symbol, msg, data) => { if (log && typeof log[level] === 'function') log[level](symbol, msg, data); };
  const skip = (reason, symbol, level = null, msg = null) => { stats.skipped++; if (level) say(level, symbol, msg); return { sent: false, skipped: reason }; };

  async function maybeSend(setup) {
    const symbol = setup?.symbol ?? '*';
    if (b.enabled !== true) return skip('disabled', symbol);
    if (!symbols.has(symbol)) return skip('symbol', symbol, 'guard', `Bridge: ${symbol} is not in executorBridge.symbols — not forwarded`);
    if (!gradeAtLeast(setup?.grade, b.minGrade ?? 'A')) return skip('grade', symbol, 'guard', `Bridge: grade ${setup?.grade ?? '?'} < ${b.minGrade ?? 'A'} — not forwarded`);
    let body;
    try { body = toAlert(setup, ''); } catch (e) { return skip('invalid', symbol, 'warn', `Bridge: setup rejected — ${e.message}`); }
    if (typeof b.url !== 'string' || !/^https?:\/\/\S+$/.test(b.url)) return skip('no-url', symbol, 'warn', 'Bridge: executorBridge.url is not an http(s) URL');
    let parsedUrl = null;
    try { parsedUrl = new URL(b.url); } catch { /* handled below */ }
    if (!parsedUrl) return skip('no-url', symbol, 'warn', 'Bridge: executorBridge.url does not parse as a URL');
    if (parsedUrl.username || parsedUrl.password) return skip('no-url', symbol, 'warn', `Bridge: executorBridge.url carries user:password@ credentials — refused (${displayUrl(b.url)})`);
    const secret = typeof env?.ANALYST_EXECUTOR_SECRET === 'string' ? env.ANALYST_EXECUTOR_SECRET : '';
    if (!secret) {
      if (!warnedNoSecret) { warnedNoSecret = true; say('warn', symbol, 'Bridge: ANALYST_EXECUTOR_SECRET is not set — nothing will be forwarded until it is'); }
      return skip('no-secret', symbol);
    }
    if (seen.has(body.alert_id)) return skip('duplicate', symbol);
    seen.add(body.alert_id);
    if (seen.size > MAX_SEEN) seen.delete(seen.values().next().value);
    body.secret = secret;

    stats.attempted++;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new Error(`timeout after ${timeoutMs} ms`)), timeoutMs);
    const safe = { alert_id: body.alert_id, side: body.side, entry: body.entry, sl: body.sl, tp: body.tp, url: displayUrl(b.url) }; // what the feed may show — no secret
    const scrub = (x) => String(x).split(secret).join('[redacted]'); // belt and braces: a fetch error may embed the request
    try {
      const res = await fetch(b.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
      const status = Number(res?.status) || 0;
      stats.lastStatus = status; stats.lastAt = now();
      if (res?.ok) {
        stats.sent++;
        say('ok', symbol, `Bridge: forwarded ${body.side} ${symbol} @ ${body.entry} (alert ${body.alert_id}) — executor replied ${status}`, { ...safe, status });
        return { sent: true, status };
      }
      stats.failed++;
      // The response body is deliberately NOT read into the log: an endpoint that echoes its request would hand the secret to the feed.
      say('warn', symbol, `Bridge: executor refused alert ${body.alert_id} with HTTP ${status} (response body not logged)`, { ...safe, status });
      return { sent: false, status, error: `HTTP ${status}` };
    } catch (e) {
      stats.failed++; stats.lastStatus = null; stats.lastAt = now();
      const error = e?.name === 'AbortError' || ctrl.signal.aborted ? `timeout after ${timeoutMs} ms` : scrub(e?.message ?? e);
      say('warn', symbol, `Bridge: could not reach the executor for alert ${body.alert_id} — ${error}`, { ...safe, error });
      return { sent: false, error };
    } finally {
      clearTimeout(timer);
      body.secret = ''; // do not keep the secret reachable from a closure longer than the request
    }
  }

  return { maybeSend, stats: () => ({ ...stats, enabled: b.enabled === true, symbols: [...symbols], minGrade: b.minGrade ?? 'A', seen: seen.size }) };
}
