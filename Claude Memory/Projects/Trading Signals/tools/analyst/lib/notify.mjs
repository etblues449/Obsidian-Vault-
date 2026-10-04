// lib/notify.mjs — Telegram alerts for the Analyst (SPEC-PRO.md §P3). Analysis only: a message, never an order.
//
// Transport: Telegram Bot API `POST https://api.telegram.org/bot<token>/sendMessage`
//   { chat_id, text, parse_mode:'HTML', disable_web_page_preview:true }, 5 s AbortController timeout.
// Enabled ONLY when BOTH `env.ANALYST_TELEGRAM_BOT_TOKEN` and `env.ANALYST_TELEGRAM_CHAT_ID` are present.
// The token is read from the environment AT SEND TIME, is never stored on the notifier, never part of a
// result, never passed to the logger (log.mjs would redact a `token` key anyway) — and every error string
// is scrubbed of it before it is logged, because a fetch failure may embed the request URL. The Telegram
// response body is never read into a log line.
//
// Every user-derived string (symbol, reasons, invalidation, labels, feed messages, scorecard keys) is
// HTML-escaped; messages are clamped to Telegram's 4096 chars without cutting a tag or an entity open.
// Rate limits: a per-kind cooldown (`notify.cooldownMinutes`, default 1) and a hard sliding-hour cap of
// `notify.maxPerHour` (default 30) sends — attempted sends count, failed ones included, so a dying network
// cannot turn into a flood. A Telegram 429 holds every kind off for Retry-After (default 60 s).
// Failures are logged at warn and reported in the result; nothing here ever throws into the engine.
//
// Message formats (source 05 §7 language — R is measured against the invalidation point, the ORIGINAL stop):
//   setup       🟢 LONG BTCUSD · grade A · score 9.5 / Entry · Stop (−risk) · T1 (R) / Why: reasons / Invalidation
//   resolved    ✅ WON +2.70 R · ❌ LOST −1.00 R · ⏱ EXPIRED ±x R  with symbol, side, entry → exit
//   digest      📊 compact scorecard table by trigger + today's setup count (once per London day)
//   feedProblem ⚠️ XAUUSD: … (rate-limited hard: its own, longer cooldown)
//
// DEVIATION: §P3 says "per-kind cooldown". A 1-minute cooldown keyed on the kind alone would drop three of
//   four setups when every symbol's 5m candle closes on the same minute, so the cooldown key is
//   `${kind}:${symbol}` for setup / resolved / feedProblem (digest has no symbol). The hourly cap stays global.
// DEVIATION: additive `notify.feedProblemCooldownMinutes` (default 15) — "rate-limited hard" needs its own
//   number; with no config block at all every §P5 default applies (the `notify` block lands with P5).
// DEVIATION: `resolved()` is also gated by `gradeAtLeast(grade, minGrade)` (or by the setup having been
//   announced by this process) — the exit of a setup nobody was told about is noise, not news.
// DEVIATION: the digest dayKey is remembered in `<journal.dir>/notify-state.json` (injectable `fs`,
//   `stateFile: null` disables) so a restart after 17:05 does not resend — §P3 asks for the memory but names
//   no home for it. The dayKey is marked on the ATTEMPT, so a failed digest is not retried every minute
//   into the hourly cap; the result tells the caller.
// DEVIATION: additive exports — `digestDue({ t, cfg, lastDayKey })` for the Analyst's 17:05 trigger,
//   `notifyConfig`, `escapeHtml`, `clampHtml`, the four `format*` functions and `fmtPrice` / `fmtR`; the
//   returned object also carries `send(kind, text, opts)` for scripts/report.mjs `--telegram`.

import nodeFs from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { gradeAtLeast } from './executor-bridge.mjs';
import { localParts, parseHHMM } from './engine/sessions.mjs';

export const TELEGRAM_API = 'https://api.telegram.org';
export const MAX_MESSAGE_CHARS = 4096;
export const KINDS = Object.freeze(['setup', 'resolved', 'digest', 'feedProblem']);
export const ENV_TOKEN = 'ANALYST_TELEGRAM_BOT_TOKEN';
export const ENV_CHAT = 'ANALYST_TELEGRAM_CHAT_ID';
export const NOTIFY_DEFAULTS = Object.freeze({ minGrade: 'B', onResolve: true, digestAt: '17:05', cooldownMinutes: 1, maxPerHour: 30, feedProblemCooldownMinutes: 15 });
const STATE_FILE = 'notify-state.json';
const HOUR = 36e5, MIN = 60e3;
const MAX_ANNOUNCED = 5000;
const MINUS = '−';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The notify block merged over the §P5 defaults; a wrong-typed value falls back to its default. */
export function notifyConfig(cfg) {
  const n = isObj(cfg?.notify) ? cfg.notify : {};
  const num = (k, { min = 0 } = {}) => (isNum(n[k]) && n[k] >= min ? n[k] : NOTIFY_DEFAULTS[k]);
  return {
    minGrade: ['A', 'B', 'C'].includes(n.minGrade) ? n.minGrade : NOTIFY_DEFAULTS.minGrade,
    onResolve: typeof n.onResolve === 'boolean' ? n.onResolve : NOTIFY_DEFAULTS.onResolve,
    digestAt: parseHHMM(n.digestAt) !== null ? n.digestAt : NOTIFY_DEFAULTS.digestAt,
    cooldownMinutes: num('cooldownMinutes'),
    maxPerHour: Number.isInteger(n.maxPerHour) && n.maxPerHour >= 1 ? n.maxPerHour : NOTIFY_DEFAULTS.maxPerHour,
    feedProblemCooldownMinutes: num('feedProblemCooldownMinutes'),
  };
}

/** Telegram HTML needs &, < and > escaped; quotes are escaped too so an attribute can never be broken out of. */
export function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Decimal places shown for a setup: the most any of its prices carries (2 … 8). */
function decimalsFor(setup) {
  let dp = 2;
  for (const x of [setup?.entry, setup?.stop, setup?.targets?.[0]?.price]) {
    if (!isNum(x)) continue;
    const s = String(x);
    const i = s.indexOf('.');
    if (i >= 0 && !/e/i.test(s)) dp = Math.max(dp, Math.min(8, s.length - i - 1));
  }
  return dp;
}

/** 85161.82 → "85,161.82". Non-numbers → "—". */
export function fmtPrice(x, dp = 2) {
  return isNum(x) ? x.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp }) : '—';
}
/** Signed with a real minus sign: +2.70 / −1.00 / 0.00. */
export function fmtSigned(x, dp = 2) {
  if (!isNum(x)) return '—';
  const r = Math.abs(x).toFixed(dp);
  return (x > 0 && Number(r) !== 0 ? '+' : x < 0 && Number(r) !== 0 ? MINUS : '') + r;
}
export const fmtR = (x) => `${fmtSigned(x)} R`;
const sideWord = (side) => (side === 'short' ? 'SHORT' : 'LONG');

/**
 * Clamp an HTML message to `max` chars without leaving a tag or an entity half-written, and close any
 * tag the cut left open (Telegram rejects unbalanced HTML with a 400 — a long reasons list must not
 * silence the alert). Pure.
 */
export function clampHtml(text, max = MAX_MESSAGE_CHARS) {
  let s = String(text ?? '');
  if (s.length <= max) return s;
  const ell = '…';
  let cut = s.slice(0, Math.max(0, max - 1));
  cut = cut.replace(/<[^>]*$/, '').replace(/&[^;\s<]*$/, ''); // a tag or entity opened but not finished
  const closers = () => {
    const open = [];
    for (const m of cut.matchAll(/<(\/?)([a-zA-Z]+)[^>]*>/g)) {
      if (m[1]) { const i = open.lastIndexOf(m[2].toLowerCase()); if (i >= 0) open.splice(i, 1); } else open.push(m[2].toLowerCase());
    }
    return open.reverse().map((t) => `</${t}>`).join('');
  };
  let tail = closers();
  while (cut.length + ell.length + tail.length > max && cut.length) {
    cut = cut.slice(0, cut.length - (cut.length + ell.length + tail.length - max)).replace(/<[^>]*$/, '').replace(/&[^;\s<]*$/, '');
    tail = closers();
  }
  return cut + ell + tail;
}

/** 🟢 LONG BTCUSD · grade A · score 9.5 … (HTML). `dp` overrides the price decimals. */
export function formatSetup(setup, { dp } = {}) {
  const s = setup ?? {};
  const d = isNum(dp) ? dp : decimalsFor(s);
  const t1 = s.targets?.[0];
  const risk = isNum(s.stop) && isNum(s.entry) ? s.stop - s.entry : null;
  const lines = [
    `${s.side === 'short' ? '🔴' : '🟢'} <b>${sideWord(s.side)} ${escapeHtml(s.symbol ?? '?')}</b> · grade ${escapeHtml(s.grade ?? '?')} · score ${isNum(s.score) ? s.score.toFixed(1) : '—'}`,
    `Entry ${fmtPrice(s.entry, d)} · Stop ${fmtPrice(s.stop, d)} (${fmtSigned(risk, d)}) · T1 ${fmtPrice(t1?.price, d)} (${isNum(t1?.rr ?? s.rr) ? (t1?.rr ?? s.rr).toFixed(2) : '—'} R)${t1?.label ? ` ${escapeHtml(t1.label)}` : ''}`,
  ];
  const reasons = Array.isArray(s.reasons) ? s.reasons.filter((r) => typeof r === 'string' && r.trim()) : [];
  if (reasons.length) lines.push(`Why:\n${reasons.map((r) => `• ${escapeHtml(r)}`).join('\n')}`);
  if (typeof s.invalidation === 'string' && s.invalidation.trim()) lines.push(`Invalidation: ${escapeHtml(s.invalidation)}`);
  if (s.tf || s.condition?.session?.label) lines.push(`<i>${[s.tf && escapeHtml(s.tf), s.condition?.session?.label && escapeHtml(s.condition.session.label)].filter(Boolean).join(' · ')}</i>`);
  return lines.join('\n');
}

/** ✅ WON +2.70 R · BTCUSD LONG · 85,161.82 → 85,428.01 (HTML). The emoji follows the money, the word the mechanism. */
export function formatResolved(setup, { dp } = {}) {
  const s = setup ?? {};
  const d = isNum(dp) ? dp : decimalsFor(s);
  const status = String(s.status ?? 'resolved').toUpperCase();
  const r = isNum(s.resultR) ? s.resultR : 0;
  const emoji = s.status === 'expired' ? '⏱' : s.status === 'cancelled' ? '⏹' : r > 0 ? '✅' : '❌';
  const exit = isNum(s.exitPrice) ? s.exitPrice : s.status === 'won' ? s.targets?.[0]?.price : s.status === 'lost' ? s.stop : null;
  const lines = [
    `${emoji} <b>${escapeHtml(status)} ${fmtR(r)}</b> · ${escapeHtml(s.symbol ?? '?')} ${sideWord(s.side)} · ${fmtPrice(s.entry, d)} → ${fmtPrice(exit, d)}`,
  ];
  const detail = [];
  if (s.exit) detail.push(`via ${escapeHtml(s.exit)}${s.ambiguous ? ' (ambiguous bar)' : ''}`);
  if (isNum(s.mfeR) || isNum(s.maeR)) detail.push(`mfe ${fmtSigned(s.mfeR ?? 0)} / mae ${fmtSigned(-(s.maeR ?? 0))} R`);
  if (Array.isArray(s.trail) && s.trail.length) detail.push(`trailed ×${s.trail.length}`);
  if (s.grade) detail.push(`grade ${escapeHtml(s.grade)}`);
  if (detail.length) lines.push(`<i>${detail.join(' · ')}</i>`);
  return lines.join('\n');
}

const pad = (s, n, right = false) => { s = String(s); return s.length >= n ? s.slice(0, n) : right ? s.padStart(n) : s.padEnd(n); };

/** 📊 Digest with a <pre> scorecard by trigger (journal.scorecard rows) and today's setup count (HTML). */
export function formatDigest(rows, { dayKey, setupsToday, title = 'Digest' } = {}) {
  const list = Array.isArray(rows) ? rows.filter((r) => r && isNum(r.n)) : [];
  const total = list.reduce((a, r) => a + r.n, 0);
  const net = list.reduce((a, r) => a + (isNum(r.netR) ? r.netR : (r.expectancyR ?? 0) * r.n), 0);
  const head = `📊 <b>${escapeHtml(title)} ${escapeHtml(dayKey ?? '')}</b> · ${isNum(setupsToday) ? `${setupsToday} setup${setupsToday === 1 ? '' : 's'} today · ` : ''}${total} resolved · net ${fmtR(net)}`;
  if (!list.length) return `${head}\n<i>No resolved setups yet.</i>`;
  const keyW = Math.min(18, Math.max(7, ...list.map((r) => String(r.key).length)));
  const lines = [`${pad('trigger', keyW)} ${pad('n', 3, true)} ${pad('win%', 5, true)} ${pad('expR', 6, true)} ${pad('netR', 7, true)}`];
  for (const r of list) {
    const netR = isNum(r.netR) ? r.netR : (r.expectancyR ?? 0) * r.n;
    lines.push(`${escapeHtml(pad(r.key, keyW))} ${pad(r.n, 3, true)} ${pad(`${Math.round((r.winRate ?? 0) * 100)}%`, 5, true)} ${pad(fmtSigned(r.expectancyR), 6, true)} ${pad(fmtSigned(netR), 7, true)}`);
  }
  return `${head}\n<pre>${lines.join('\n')}</pre>`;
}

/** ⚠️ XAUUSD: reconnecting (attempt 4) (HTML). */
export function formatFeedProblem(symbol, msg) {
  return `⚠️ <b>${escapeHtml(symbol ?? '*')}</b>: ${escapeHtml(msg ?? 'feed problem')}`;
}

/**
 * Is the daily digest due at instant `t` (ms UTC)? Due when the local wall clock (cfg.sessions.timezone,
 * default Europe/London) is at or after `notify.digestAt` and that local day's digest has not been sent
 * (`lastDayKey`). Pure — the Analyst calls it on each closed 1m candle with the candle's CLOSE instant.
 * @returns {{ due: boolean, dayKey: string, localTime: string }}
 */
export function digestDue({ t, cfg, lastDayKey = null } = {}) {
  const n = notifyConfig(cfg);
  const tz = typeof cfg?.sessions?.timezone === 'string' ? cfg.sessions.timezone : 'Europe/London';
  const at = parseHHMM(n.digestAt);
  const lp = localParts(t, tz);
  const localTime = `${String(lp.hh).padStart(2, '0')}:${String(lp.mm).padStart(2, '0')}`;
  return { due: lp.minutes >= at && lp.dayKey !== lastDayKey, dayKey: lp.dayKey, localTime };
}

/**
 * @param {object} opts
 * @param {object} opts.cfg            strategy config (notify.*, sessions.timezone, journal.dir)
 * @param {object} [opts.env]          environment holding ANALYST_TELEGRAM_BOT_TOKEN / _CHAT_ID (default process.env)
 * @param {Function} [opts.fetch]      fetch stand-in (tests)
 * @param {object} [opts.log]          logger (info/ok/warn/guard); optional
 * @param {() => number} [opts.now]    clock; injected in tests
 * @param {number} [opts.timeoutMs]    request timeout (default 5000)
 * @param {number|object|Function} [opts.dp]  price decimals: a number, a {symbol: dp} map, or (symbol) => dp
 * @param {string|null} [opts.stateFile]  where the digest dayKey is remembered (default <journal.dir>/notify-state.json; null = memory only)
 * @param {object} [opts.fs]           node:fs stand-in (tests)
 */
export function createNotifier({ cfg = {}, env = process.env, fetch = globalThis.fetch, log = null, now = () => Date.now(), timeoutMs = 5000, dp, stateFile, fs = nodeFs } = {}) {
  const n = notifyConfig(cfg);
  const statePath = stateFile === null ? null : resolvePath(stateFile ?? join(cfg?.journal?.dir ?? 'data', STATE_FILE));
  const stats = { attempted: 0, sent: 0, failed: 0, skipped: 0, lastStatus: null, lastAt: null, lastError: null, lastDigestDay: null, holdoffUntil: null };
  for (const k of KINDS) stats[k] = { sent: 0, failed: 0, skipped: 0 };
  const lastSent = new Map();   // cooldown key → t of the last attempt
  const window = [];            // attempt timestamps inside the last hour (sliding cap)
  const announced = new Set();  // setup ids this process alerted on (bounded)
  let capWarned = false;

  const has = (k) => typeof env?.[k] === 'string' && env[k].trim() !== '';
  const isEnabled = () => has(ENV_TOKEN) && has(ENV_CHAT);
  const say = (level, symbol, msg, data) => { if (log && typeof log[level] === 'function') { try { log[level](symbol, msg, data); } catch { /* a broken logger never breaks a send */ } } };
  const dpFor = (symbol) => (typeof dp === 'function' ? dp(symbol) : isObj(dp) ? dp[symbol] : isNum(dp) ? dp : undefined);
  const skip = (kind, reason, symbol = '*') => { stats.skipped++; if (stats[kind]) stats[kind].skipped++; return { sent: false, kind, skipped: reason }; };

  // digest memory ------------------------------------------------------------------------------
  try {
    if (statePath) { const st = JSON.parse(fs.readFileSync(statePath, 'utf8')); if (typeof st?.lastDigestDay === 'string') stats.lastDigestDay = st.lastDigestDay; }
  } catch { /* no state yet, or unreadable: start fresh */ }
  const remember = () => {
    if (!statePath) return;
    try { fs.mkdirSync(resolvePath(statePath, '..'), { recursive: true }); fs.writeFileSync(statePath, JSON.stringify({ lastDigestDay: stats.lastDigestDay, updatedAt: now() }) + '\n'); } catch (e) { say('warn', '*', `Telegram: could not remember the digest day — ${e?.message ?? e}`); }
  };

  /**
   * Low-level send. Gates: enabled → holdoff → cooldown(key) → hourly cap. Never throws.
   * @returns {Promise<{sent:boolean, kind:string, status?:number, skipped?:string, error?:string}>}
   */
  async function send(kind, text, { symbol = '*', key = kind, cooldownMs = n.cooldownMinutes * MIN } = {}) {
    if (!KINDS.includes(kind)) kind = 'feedProblem';
    if (!isEnabled()) return skip(kind, 'disabled', symbol);
    const t = now();
    if (isNum(stats.holdoffUntil) && t < stats.holdoffUntil) return skip(kind, 'holdoff', symbol);
    const prev = lastSent.get(key);
    if (cooldownMs > 0 && prev !== undefined && t - prev < cooldownMs) return skip(kind, 'cooldown', symbol);
    while (window.length && window[0] <= t - HOUR) window.shift();
    if (window.length >= n.maxPerHour) {
      if (!capWarned) { capWarned = true; say('guard', symbol, `Telegram: hourly cap of ${n.maxPerHour} reached — alerts muted until the window clears`); }
      return skip(kind, 'hourly-cap', symbol);
    }
    capWarned = false;
    lastSent.set(key, t); window.push(t);
    stats.attempted++;

    const token = env[ENV_TOKEN].trim(), chatId = env[ENV_CHAT].trim(); // read here, kept only for this request
    const message = clampHtml(String(text ?? ''));
    const safe = { kind, symbol, chars: message.length };               // what a log line may carry — never the token or the URL
    // A fetch error may quote the request URL: drop the whole Telegram URL (it carries the token in its path), then the bare token.
    const scrub = (x) => String(x).replace(/https?:\/\/api\.telegram\.org\/bot\S*/g, '<telegram api>').split(token).join('[redacted]');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new Error(`timeout after ${timeoutMs} ms`)), timeoutMs);
    try {
      const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML', disable_web_page_preview: true }),
      });
      const status = Number(res?.status) || 0;
      stats.lastStatus = status; stats.lastAt = now();
      if (res?.ok) {
        stats.sent++; stats[kind].sent++; stats.lastError = null;
        say('info', symbol, `Telegram: sent ${kind}${symbol !== '*' ? ` for ${symbol}` : ''} (${message.length} chars)`, { ...safe, status });
        return { sent: true, kind, status };
      }
      stats.failed++; stats[kind].failed++; stats.lastError = `HTTP ${status}`;
      if (status === 429) {
        const ra = Number(res?.headers?.get?.('retry-after'));
        stats.holdoffUntil = now() + (Number.isFinite(ra) && ra > 0 ? ra * 1000 : 60e3);
      }
      // The response body is deliberately not read into the log — the status is enough and a body is never trusted.
      say('warn', symbol, `Telegram: HTTP ${status} on ${kind} (response body not logged)${status === 429 ? ' — holding off' : ''}`, { ...safe, status });
      return { sent: false, kind, status, error: `HTTP ${status}` };
    } catch (e) {
      stats.failed++; stats[kind].failed++; stats.lastStatus = null; stats.lastAt = now();
      const error = e?.name === 'AbortError' || ctrl.signal.aborted ? `timeout after ${timeoutMs} ms` : scrub(e?.message ?? e);
      stats.lastError = error;
      say('warn', symbol, `Telegram: could not send ${kind} — ${error}`, { ...safe, error });
      return { sent: false, kind, error };
    } finally {
      clearTimeout(timer);
    }
  }

  /** A new Setup. Sends when enabled and grade ≥ notify.minGrade. */
  async function setup(s) {
    if (!isEnabled()) return skip('setup', 'disabled', s?.symbol ?? '*');
    if (!isObj(s) || typeof s.symbol !== 'string') return skip('setup', 'invalid');
    if (!gradeAtLeast(s.grade, n.minGrade)) return skip('setup', 'grade', s.symbol);
    if (typeof s.id === 'string') { announced.add(s.id); if (announced.size > MAX_ANNOUNCED) announced.delete(announced.values().next().value); }
    return send('setup', formatSetup(s, { dp: dpFor(s.symbol) }), { symbol: s.symbol, key: `setup:${s.symbol}` });
  }

  /** A resolved Setup (status won|lost|expired, resultR set). Off when notify.onResolve is false. */
  async function resolved(s) {
    if (!isEnabled()) return skip('resolved', 'disabled', s?.symbol ?? '*');
    if (!n.onResolve) return skip('resolved', 'off', s?.symbol ?? '*');
    if (!isObj(s) || typeof s.symbol !== 'string') return skip('resolved', 'invalid');
    if (!['won', 'lost', 'expired'].includes(s.status)) return skip('resolved', 'status', s.symbol);
    if (!announced.has(s.id) && !gradeAtLeast(s.grade, n.minGrade)) return skip('resolved', 'grade', s.symbol);
    return send('resolved', formatResolved(s, { dp: dpFor(s.symbol) }), { symbol: s.symbol, key: `resolved:${s.symbol}` });
  }

  /** The daily scorecard, once per `dayKey`. `rows` = journal.scorecard({ by:'trigger' }). */
  async function digest(rows, { dayKey, setupsToday, title } = {}) {
    if (!isEnabled()) return skip('digest', 'disabled');
    if (typeof dayKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return skip('digest', 'invalid');
    if (stats.lastDigestDay === dayKey) return skip('digest', 'already-sent');
    const before = stats.lastDigestDay;
    stats.lastDigestDay = dayKey; remember();
    const out = await send('digest', formatDigest(rows, { dayKey, setupsToday, title }), { key: 'digest', cooldownMs: 0 });
    if (out.skipped) { stats.lastDigestDay = before; remember(); } // never attempted (holdoff / cap): the day is still owed
    return out;
  }

  /** A feed problem line (reconnect loop, fallback). Rate-limited hard per symbol. */
  async function feedProblem(symbol, msg) {
    if (!isEnabled()) return skip('feedProblem', 'disabled', symbol ?? '*');
    const sym = typeof symbol === 'string' && symbol ? symbol : '*';
    return send('feedProblem', formatFeedProblem(sym, msg), { symbol: sym, key: `feedProblem:${sym}`, cooldownMs: n.feedProblemCooldownMinutes * MIN });
  }

  return {
    get enabled() { return isEnabled(); },
    setup, resolved, digest, feedProblem, send,
    digestDue: (t, lastDayKey = stats.lastDigestDay) => digestDue({ t, cfg, lastDayKey }),
    stats: () => ({ ...structuredClone(stats), enabled: isEnabled(), inWindow: window.length, announced: announced.size, minGrade: n.minGrade, maxPerHour: n.maxPerHour, cooldownMinutes: n.cooldownMinutes, onResolve: n.onResolve, digestAt: n.digestAt }),
  };
}
