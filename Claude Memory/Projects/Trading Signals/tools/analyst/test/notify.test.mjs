// test/notify.test.mjs — SPEC-PRO §P8: disabled without env, message formats, grade gate, cooldown + hourly cap,
// timeout / failure never throws, token never in logs, digest once per day (+ persisted across a restart).
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createNotifier, notifyConfig, escapeHtml, clampHtml, formatSetup, formatResolved, formatDigest, formatFeedProblem,
  digestDue, fmtPrice, fmtSigned, NOTIFY_DEFAULTS, MAX_MESSAGE_CHARS, TELEGRAM_API, KINDS,
} from '../lib/notify.mjs';
import { createLogger } from '../lib/log.mjs';
import { fakeFetch } from './helpers.mjs';

const strategy = JSON.parse(readFileSync(new URL('../config/strategy.json', import.meta.url), 'utf8'));
const TOKEN = '123456789:AAHxyz-SECRET-token-never-in-a-log_Q';
const CHAT = '-1001234567890';
const ENV = { ANALYST_TELEGRAM_BOT_TOKEN: TOKEN, ANALYST_TELEGRAM_CHAT_ID: CHAT };
const T0 = Date.UTC(2026, 9, 4, 8, 0); // Sun 2026-10-04 09:00 BST
const M = 60e3, H = 36e5;

const setup = (over = {}) => ({
  id: 'BTCUSD-20261004-0800', symbol: 'BTCUSD', t: T0, tf: '5m', side: 'long',
  entry: 85161.82, stop: 85063.15, targets: [{ price: 85428.01, label: 'Asia high', rr: 2.7 }], rr: 2.7, score: 9.5, grade: 'A',
  condition: { bias: { dir: 'bullish' }, session: { id: 'london', label: 'London', killzone: true }, valueRelation: 'below', hits: ['biasAligned', 'killzone'] },
  zone: { hits: ['sessionHighLow'] }, trigger: { kind: 'sweepReclaim', hits: ['sweepReclaim', 'deltaConfirms'] },
  reasons: ['Swept sell-side liquidity at Asia low 85,120.00 and reclaimed (manipulation)', 'Delta <confirms> & "agrees"'],
  invalidation: 'close below 85,063.15 (manipulation low)', status: 'open',
  ...over,
});
const resolvedSetup = (over = {}) => ({ ...setup(), status: 'won', exit: 'target', exitPrice: 85428.01, resultR: 2.7, mfeR: 2.7, maeR: 0.3, resolvedAt: T0 + 40 * M, ...over });

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'tradeguard-notify-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** An enabled notifier with a virtual clock, a silent logger and an in-memory Telegram. Every knob overridable. */
function harness({ env = ENV, cfg, routes, fetch, timeoutMs = 5000, start = T0, stateFile } = {}) {
  const c = structuredClone(strategy);
  c.journal.dir = dir;
  if (cfg) c.notify = { ...(c.notify ?? {}), ...cfg };
  let now = start;
  const clock = { now: () => now, tick: (ms) => { now += ms; } };
  const f = fetch ?? fakeFetch(routes ?? { '/sendMessage': { status: 200, json: { ok: true, result: { message_id: 1 } } } });
  const log = createLogger({ stream: null, now: () => now });
  const notifier = createNotifier({ cfg: c, env, fetch: f, log, now: clock.now, timeoutMs, stateFile });
  return { notifier, fetch: f, log, clock, cfg: c };
}
const bodyOf = (call) => JSON.parse(call.opts.body);
const everything = (log) => JSON.stringify(log.recent(500));

describe('config + pure helpers', () => {
  test('notifyConfig: §P5 defaults with no block; a block overrides; wrong types fall back', () => {
    assert.deepEqual(notifyConfig({}), NOTIFY_DEFAULTS);
    assert.deepEqual(notifyConfig(null), NOTIFY_DEFAULTS);
    const n = notifyConfig({ notify: { minGrade: 'A', onResolve: false, digestAt: '18:30', cooldownMinutes: 5, maxPerHour: 10, feedProblemCooldownMinutes: 1 } });
    assert.deepEqual(n, { minGrade: 'A', onResolve: false, digestAt: '18:30', cooldownMinutes: 5, maxPerHour: 10, feedProblemCooldownMinutes: 1 });
    const bad = notifyConfig({ notify: { minGrade: 'S', onResolve: 'yes', digestAt: '25:99', cooldownMinutes: -1, maxPerHour: 0 } });
    assert.deepEqual(bad, NOTIFY_DEFAULTS);
  });
  test('escapeHtml covers & < > " — the four characters that can break Telegram HTML', () => {
    assert.equal(escapeHtml('a & b <i>"x"</i>'), 'a &amp; b &lt;i&gt;&quot;x&quot;&lt;/i&gt;');
    assert.equal(escapeHtml(null), ''); assert.equal(escapeHtml(42), '42');
  });
  test('fmtPrice groups thousands, fmtSigned uses a real minus sign', () => {
    assert.equal(fmtPrice(85161.82), '85,161.82'); assert.equal(fmtPrice(4146, 2), '4,146.00'); assert.equal(fmtPrice(NaN), '—');
    assert.equal(fmtSigned(2.7), '+2.70'); assert.equal(fmtSigned(-1), '−1.00'); assert.equal(fmtSigned(0), '0.00'); assert.equal(fmtSigned(-0.001), '0.00');
  });
  test('clampHtml: ≤ 4096 chars, never cuts a tag or an entity, closes what the cut left open', () => {
    const short = '<b>hi</b>';
    assert.equal(clampHtml(short), short);
    const long = `<b>head</b>\nWhy:\n${'• reason &amp; more <i>x</i>\n'.repeat(400)}`;
    const out = clampHtml(long);
    assert.ok(out.length <= MAX_MESSAGE_CHARS, `${out.length}`);
    assert.ok(out.endsWith('…') || /<\/[a-z]+>$/.test(out));
    assert.ok(!/<[^>]*$/.test(out.replace(/<\/?[a-z]+>/g, '')), 'no half-written tag');
    assert.ok(!/&[^;\s<]*$/.test(out.replace(/&[a-z]+;/g, '')), 'no half-written entity');
    const opens = (out.match(/<i>/g) || []).length, closes = (out.match(/<\/i>/g) || []).length;
    assert.equal(opens, closes, 'every <i> is closed');
    const cutInTag = clampHtml('<b>abc</b> ' + 'x'.repeat(4080) + '<i>zzzzz</i>', 4096);
    assert.ok(cutInTag.length <= 4096 && !cutInTag.includes('<i') || cutInTag.includes('</i>'));
    const tiny = clampHtml('<b>hello world</b>', 8);
    assert.ok(tiny.length <= 8, tiny); assert.ok(!/<[^>]*$/.test(tiny));
  });
});

describe('message formats (HTML, source language)', () => {
  test('setup: 🟢 LONG · grade · score / Entry · Stop (−risk) · T1 (R) / Why / Invalidation — every user string escaped', () => {
    const m = formatSetup(setup());
    const lines = m.split('\n');
    assert.equal(lines[0], '🟢 <b>LONG BTCUSD</b> · grade A · score 9.5');
    assert.equal(lines[1], 'Entry 85,161.82 · Stop 85,063.15 (−98.67) · T1 85,428.01 (2.70 R) Asia high');
    assert.ok(m.includes('Why:\n• Swept sell-side liquidity at Asia low 85,120.00 and reclaimed (manipulation)'));
    assert.ok(m.includes('• Delta &lt;confirms&gt; &amp; &quot;agrees&quot;'), 'reasons are HTML-escaped');
    assert.ok(!m.includes('<confirms>'));
    assert.ok(m.includes('Invalidation: close below 85,063.15 (manipulation low)'));
    assert.ok(m.includes('<i>5m · London</i>'));
    const sh = formatSetup(setup({ side: 'short', symbol: '<XAU&USD>', entry: 4146.5, stop: 4150.2, targets: [{ price: 4130, rr: 4.46 }], grade: 'B' }));
    assert.ok(sh.startsWith('🔴 <b>SHORT &lt;XAU&amp;USD&gt;</b> · grade B'));
    assert.ok(sh.includes('Stop 4,150.20 (+3.70) · T1 4,130.00 (4.46 R)'));
    assert.ok(formatSetup({}).includes('LONG ?'), 'a hollow setup still formats, never throws');
    assert.ok(formatSetup(setup({ entry: 1.23456, stop: 1.2, targets: [{ price: 1.3, rr: 2 }] })).includes('1.23456'), 'decimals follow the prices');
  });
  test('resolved: ✅ WON +2.70 R / ❌ LOST −1.00 R / ⏱ EXPIRED with symbol, side, entry → exit', () => {
    const won = formatResolved(resolvedSetup());
    assert.equal(won.split('\n')[0], '✅ <b>WON +2.70 R</b> · BTCUSD LONG · 85,161.82 → 85,428.01');
    assert.ok(won.includes('via target') && won.includes('mfe +2.70 / mae −0.30 R') && won.includes('grade A'));
    const lost = formatResolved(resolvedSetup({ status: 'lost', exit: 'stop', exitPrice: 85063.15, resultR: -1, ambiguous: true }));
    assert.ok(lost.startsWith('❌ <b>LOST −1.00 R</b> · BTCUSD LONG · 85,161.82 → 85,063.15'));
    assert.ok(lost.includes('(ambiguous bar)'));
    const trailed = formatResolved(resolvedSetup({ status: 'lost', exit: 'stop', exitPrice: 85200, resultR: 0.39, trail: [{}, {}] }));
    assert.ok(trailed.startsWith('✅ <b>LOST +0.39 R</b>'), 'a trailed stop-out above entry: the emoji follows the money, the word the mechanism');
    assert.ok(trailed.includes('trailed ×2'));
    const exp = formatResolved(resolvedSetup({ status: 'expired', exit: 'timeout', exitPrice: 85100, resultR: -0.63, side: 'short' }));
    assert.ok(exp.startsWith('⏱ <b>EXPIRED −0.63 R</b> · BTCUSD SHORT'));
    assert.ok(formatResolved(resolvedSetup({ exitPrice: undefined })).includes('→ 85,428.01'), 'no exitPrice: won falls back to the target');
    assert.ok(formatResolved(resolvedSetup({ status: 'lost', exitPrice: undefined, resultR: -1 })).includes('→ 85,063.15'), 'lost falls back to the stop');
  });
  test('digest: header with today count, <pre> table by trigger with escaped keys; empty rows say so', () => {
    const rows = [
      { key: 'sweepReclaim', n: 5, wins: 3, winRate: 0.6, expectancyR: 0.42, netR: 2.1 },
      { key: 'absorption<x>', n: 2, wins: 0, winRate: 0, expectancyR: -1, netR: -2 },
    ];
    const m = formatDigest(rows, { dayKey: '2026-10-04', setupsToday: 3 });
    assert.ok(m.startsWith('📊 <b>Digest 2026-10-04</b> · 3 setups today · 7 resolved · net +0.10 R'));
    assert.ok(m.includes('<pre>') && m.endsWith('</pre>'));
    assert.match(m, /sweepReclaim\s+5\s+60%\s+\+0\.42\s+\+2\.10/);
    assert.ok(m.includes('absorption&lt;x&gt;') && !m.includes('absorption<x>'));
    const empty = formatDigest([], { dayKey: '2026-10-04', setupsToday: 0 });
    assert.ok(empty.includes('0 setups today · 0 resolved') && empty.includes('No resolved setups yet'));
    assert.ok(formatDigest(null, { dayKey: 'x' }).includes('No resolved setups yet'));
  });
  test('feedProblem: ⚠️ SYMBOL: msg, escaped', () => {
    assert.equal(formatFeedProblem('XAUUSD', 'reconnecting (attempt 4) <ws>'), '⚠️ <b>XAUUSD</b>: reconnecting (attempt 4) &lt;ws&gt;');
    assert.equal(formatFeedProblem(undefined, undefined), '⚠️ <b>*</b>: feed problem');
  });
});

describe('gates', () => {
  test('disabled without BOTH env vars: enabled=false, every method skips, nothing is fetched, nothing throws', async () => {
    for (const env of [{}, { ANALYST_TELEGRAM_BOT_TOKEN: TOKEN }, { ANALYST_TELEGRAM_CHAT_ID: CHAT }, { ANALYST_TELEGRAM_BOT_TOKEN: '  ', ANALYST_TELEGRAM_CHAT_ID: CHAT }]) {
      const { notifier, fetch } = harness({ env });
      assert.equal(notifier.enabled, false);
      assert.deepEqual(await notifier.setup(setup()), { sent: false, kind: 'setup', skipped: 'disabled' });
      assert.deepEqual(await notifier.resolved(resolvedSetup()), { sent: false, kind: 'resolved', skipped: 'disabled' });
      assert.deepEqual(await notifier.digest([], { dayKey: '2026-10-04' }), { sent: false, kind: 'digest', skipped: 'disabled' });
      assert.deepEqual(await notifier.feedProblem('BTCUSD', 'x'), { sent: false, kind: 'feedProblem', skipped: 'disabled' });
      assert.equal(fetch.calls.length, 0);
      assert.equal(notifier.stats().skipped, 4);
    }
    const { notifier } = harness();
    assert.equal(notifier.enabled, true);
  });
  test('enabled: setup POSTs sendMessage with chat_id, HTML text, parse_mode HTML, no preview — token only in the URL', async () => {
    const { notifier, fetch } = harness();
    const r = await notifier.setup(setup());
    assert.deepEqual(r, { sent: true, kind: 'setup', status: 200 });
    assert.equal(fetch.calls.length, 1);
    const call = fetch.calls[0];
    assert.equal(call.url, `${TELEGRAM_API}/bot${TOKEN}/sendMessage`);
    assert.equal(call.opts.method, 'POST');
    assert.equal(call.opts.headers['content-type'], 'application/json');
    const body = bodyOf(call);
    assert.deepEqual(Object.keys(body).sort(), ['chat_id', 'disable_web_page_preview', 'parse_mode', 'text']);
    assert.equal(body.chat_id, CHAT); assert.equal(body.parse_mode, 'HTML'); assert.equal(body.disable_web_page_preview, true);
    assert.equal(body.text, formatSetup(setup()));
    assert.ok(!body.text.includes(TOKEN));
    assert.ok(call.opts.signal instanceof AbortSignal);
    assert.equal(notifier.stats().sent, 1); assert.equal(notifier.stats().setup.sent, 1);
  });
  test('grade gate: setup() sends only when grade ≥ notify.minGrade (default B)', async () => {
    const { notifier, fetch } = harness();
    assert.deepEqual(await notifier.setup(setup({ grade: 'C' })), { sent: false, kind: 'setup', skipped: 'grade' });
    assert.equal((await notifier.setup(setup({ grade: 'B', symbol: 'XAUUSD' }))).sent, true);
    assert.equal((await notifier.setup(setup({ grade: 'A', symbol: 'PAXGUSD' }))).sent, true);
    assert.equal(fetch.calls.length, 2);
    const strict = harness({ cfg: { minGrade: 'A' } });
    assert.equal((await strict.notifier.setup(setup({ grade: 'B' }))).skipped, 'grade');
    assert.equal((await strict.notifier.setup(setup({ grade: 'A' }))).sent, true);
    assert.equal((await notifier.setup(null)).skipped, 'invalid');
    assert.equal((await notifier.setup({ grade: 'A' })).skipped, 'invalid');
  });
  test('resolved(): status must be won|lost|expired; off via notify.onResolve; grade-gated unless the setup was announced here', async () => {
    const { notifier, fetch } = harness();
    assert.equal((await notifier.resolved(resolvedSetup())).sent, true);
    assert.equal(bodyOf(fetch.calls[0]).text, formatResolved(resolvedSetup()));
    assert.equal((await notifier.resolved(resolvedSetup({ status: 'open', symbol: 'A' }))).skipped, 'status');
    assert.equal((await notifier.resolved(resolvedSetup({ status: 'cancelled', symbol: 'B' }))).skipped, 'status');
    assert.equal((await notifier.resolved(resolvedSetup({ grade: 'C', symbol: 'C' }))).skipped, 'grade');
    // a grade-C setup announced by this process (minGrade C) and then the config tightened does not happen; but an announced id passes the gate
    const loose = harness({ cfg: { minGrade: 'C' } });
    await loose.notifier.setup(setup({ grade: 'C', id: 'c-1' }));
    loose.clock.tick(2 * M);
    assert.equal((await loose.notifier.resolved(resolvedSetup({ grade: 'C', id: 'c-1' }))).sent, true);
    const off = harness({ cfg: { onResolve: false } });
    assert.deepEqual(await off.notifier.resolved(resolvedSetup()), { sent: false, kind: 'resolved', skipped: 'off' });
    assert.equal(off.fetch.calls.length, 0);
  });
});

describe('rate limits', () => {
  test('cooldown: a second setup for the SAME symbol inside notify.cooldownMinutes is dropped; another symbol is not; it clears with time', async () => {
    const { notifier, fetch, clock } = harness();
    assert.equal((await notifier.setup(setup())).sent, true);
    assert.deepEqual(await notifier.setup(setup({ id: 'b' })), { sent: false, kind: 'setup', skipped: 'cooldown' });
    assert.equal((await notifier.setup(setup({ id: 'c', symbol: 'XAUUSD' }))).sent, true, 'the cooldown is per kind + symbol');
    assert.equal((await notifier.resolved(resolvedSetup())).sent, true, 'a different kind has its own cooldown');
    clock.tick(59 * 1000);
    assert.equal((await notifier.setup(setup({ id: 'd' }))).skipped, 'cooldown');
    clock.tick(1000);
    assert.equal((await notifier.setup(setup({ id: 'e' }))).sent, true);
    assert.equal(fetch.calls.length, 4);
    const slow = harness({ cfg: { cooldownMinutes: 10 } });
    await slow.notifier.setup(setup()); slow.clock.tick(9 * M + 59e3);
    assert.equal((await slow.notifier.setup(setup({ id: 'x' }))).skipped, 'cooldown');
    slow.clock.tick(1000);
    assert.equal((await slow.notifier.setup(setup({ id: 'y' }))).sent, true);
  });
  test('feedProblem is rate-limited hard: one per symbol per feedProblemCooldownMinutes (default 15)', async () => {
    const { notifier, fetch, clock } = harness();
    assert.equal((await notifier.feedProblem('XAUUSD', 'reconnecting')).sent, true);
    assert.equal(bodyOf(fetch.calls[0]).text, '⚠️ <b>XAUUSD</b>: reconnecting');
    for (let i = 0; i < 14; i++) { clock.tick(M); assert.equal((await notifier.feedProblem('XAUUSD', `attempt ${i}`)).skipped, 'cooldown'); }
    assert.equal((await notifier.feedProblem('BTCUSD', 'other symbol')).sent, true);
    clock.tick(M);
    assert.equal((await notifier.feedProblem('XAUUSD', 'still down')).sent, true);
    assert.equal(fetch.calls.length, 3);
  });
  test('hourly cap: at most notify.maxPerHour attempts in any sliding hour, then "hourly-cap" with one guard line; the window slides', async () => {
    const { notifier, fetch, clock, log } = harness({ cfg: { maxPerHour: 3, cooldownMinutes: 0 } });
    for (const s of ['A', 'B', 'C']) { assert.equal((await notifier.setup(setup({ symbol: s, id: s }))).sent, true); clock.tick(M); }
    assert.deepEqual(await notifier.setup(setup({ symbol: 'D', id: 'D' })), { sent: false, kind: 'setup', skipped: 'hourly-cap' });
    assert.equal((await notifier.feedProblem('E', 'x')).skipped, 'hourly-cap', 'the cap is global across kinds');
    assert.equal(log.recent(10, { level: 'guard' }).length, 1, 'one guard line per cap episode');
    assert.match(log.recent(10, { level: 'guard' })[0].msg, /hourly cap of 3/);
    clock.tick(H - 3 * M);            // exactly one hour after the first send: it falls out of the window
    assert.equal((await notifier.setup(setup({ symbol: 'F', id: 'F' }))).sent, true);
    assert.equal((await notifier.setup(setup({ symbol: 'G', id: 'G' }))).skipped, 'hourly-cap');
    assert.equal(fetch.calls.length, 4);
    assert.equal(notifier.stats().inWindow, 3);
  });
  test('failed attempts count toward the cap (a dying network cannot flood) and a 429 holds every kind off for Retry-After', async () => {
    const { notifier, fetch, clock } = harness({ cfg: { maxPerHour: 2, cooldownMinutes: 0 }, routes: { '/sendMessage': { status: 500, text: 'boom' } } });
    assert.equal((await notifier.setup(setup({ symbol: 'A' }))).error, 'HTTP 500');
    assert.equal((await notifier.setup(setup({ symbol: 'B' }))).error, 'HTTP 500');
    assert.equal((await notifier.setup(setup({ symbol: 'C' }))).skipped, 'hourly-cap');
    assert.equal(fetch.calls.length, 2);
    const h2 = harness({ cfg: { cooldownMinutes: 0 }, routes: { '/sendMessage': { status: 429, headers: { 'retry-after': '120' }, json: { ok: false, error_code: 429 } } } });
    assert.deepEqual(await h2.notifier.setup(setup({ symbol: 'A' })), { sent: false, kind: 'setup', status: 429, error: 'HTTP 429' });
    assert.equal((await h2.notifier.feedProblem('B', 'x')).skipped, 'holdoff');
    h2.clock.tick(119e3);
    assert.equal((await h2.notifier.setup(setup({ symbol: 'C' }))).skipped, 'holdoff');
    h2.clock.tick(1000);
    assert.equal((await h2.notifier.setup(setup({ symbol: 'D' }))).status, 429, 'tries again after the holdoff');
    assert.equal(h2.fetch.calls.length, 2);
  });
});

describe('failures never throw; the token never reaches a log', () => {
  test('HTTP error → warn line with the status, body not logged; result carries status + error', async () => {
    const { notifier, log } = harness({ routes: { '/sendMessage': { status: 400, json: { ok: false, description: `Bad Request: ${TOKEN} echoed` } } } });
    assert.deepEqual(await notifier.setup(setup()), { sent: false, kind: 'setup', status: 400, error: 'HTTP 400' });
    const warn = log.recent(5, { level: 'warn' })[0];
    assert.match(warn.msg, /HTTP 400 on setup \(response body not logged\)/);
    assert.ok(!everything(log).includes('echoed'), 'the response body is never read into a log line');
    assert.equal(notifier.stats().failed, 1); assert.equal(notifier.stats().lastStatus, 400);
  });
  test('network failure whose message embeds the request URL → logged scrubbed; token appears nowhere in the feed or the result', async () => {
    const url = `${TELEGRAM_API}/bot${TOKEN}/sendMessage`;
    const { notifier, log } = harness({ routes: { '/sendMessage': new TypeError(`fetch failed: ECONNREFUSED ${url}`) } });
    const r = await notifier.setup(setup());
    assert.equal(r.sent, false);
    assert.ok(!JSON.stringify(r).includes(TOKEN), 'result');
    assert.ok(r.error.includes('<telegram api>') && r.error.includes('ECONNREFUSED'), r.error);
    assert.ok(!r.error.includes('/bot'), 'the URL path that carries the token is gone from the error string');
    const all = everything(log);
    assert.ok(all.includes('could not send setup'), 'a warn line exists');
    assert.ok(!all.includes(TOKEN), 'token never in logs');
    assert.ok(!all.includes('/bot'), 'the URL itself is never logged');
    assert.ok(!JSON.stringify(notifier.stats()).includes(TOKEN), 'stats');
  });
  test('across a full session of sends (ok, 4xx, 5xx, throw, timeout), createLogger holds no trace of the token or chat id', async () => {
    let i = 0;
    const specs = [{ status: 200, json: { ok: true } }, { status: 403, text: TOKEN }, { status: 500, text: 'x' }, new Error(`boom ${TOKEN}`), (url, opts) => new Promise((_, rej) => opts.signal.addEventListener('abort', () => rej(opts.signal.reason)))];
    const fetch = fakeFetch({ '/sendMessage': (url, opts, call) => { const s = specs[i++ % specs.length]; return typeof s === 'function' ? s(url, opts, call) : s; } });
    const { notifier, log, clock } = harness({ fetch, timeoutMs: 10, cfg: { cooldownMinutes: 0 } });
    for (let k = 0; k < 5; k++) { await notifier.setup(setup({ symbol: `S${k}` })); clock.tick(M); }
    await notifier.resolved(resolvedSetup()); await notifier.feedProblem('X', 'y'); await notifier.digest([], { dayKey: '2026-10-04', setupsToday: 1 });
    const all = everything(log);
    assert.ok(log.recent(100).length >= 8);
    assert.ok(!all.includes(TOKEN));
    assert.ok(!all.includes(CHAT), 'the chat id is not a secret but it is not a log line either');
    assert.ok(!all.includes('[redacted]') || !all.includes(TOKEN));
    assert.equal(notifier.stats().attempted, 8);
  });
  test('timeout: an unanswered request is aborted after timeoutMs, reported, never thrown', async () => {
    const fetch = fakeFetch({ '/sendMessage': (url, opts) => new Promise((_, rej) => opts.signal.addEventListener('abort', () => rej(opts.signal.reason ?? new Error('aborted')))) });
    const { notifier, log } = harness({ fetch, timeoutMs: 15 });
    const r = await notifier.setup(setup());
    assert.deepEqual(r, { sent: false, kind: 'setup', error: 'timeout after 15 ms' });
    assert.match(log.recent(1, { level: 'warn' })[0].msg, /timeout after 15 ms/);
    assert.equal(notifier.stats().lastError, 'timeout after 15 ms');
  });
  test('a fetch that returns garbage, or no fetch at all, is a failure — not an exception', async () => {
    const { notifier } = harness({ fetch: async () => null });
    assert.deepEqual(await notifier.setup(setup()), { sent: false, kind: 'setup', status: 0, error: 'HTTP 0' });
    const broken = harness({ fetch: () => { throw new Error('sync throw'); } });
    const r = await broken.notifier.setup(setup());
    assert.equal(r.sent, false); assert.equal(r.error, 'sync throw');
    const noLog = createNotifier({ cfg: structuredClone(strategy), env: ENV, fetch: fakeFetch({ '/sendMessage': new Error('x') }), now: () => T0, stateFile: null });
    assert.equal((await noLog.setup(setup())).sent, false);
  });
  test('a logger that throws never breaks a send', async () => {
    const log = { info() { throw new Error('log down'); }, warn() { throw new Error('log down'); }, guard() { throw new Error('log down'); } };
    const notifier = createNotifier({ cfg: { ...structuredClone(strategy), journal: { dir } }, env: ENV, fetch: fakeFetch({ '/sendMessage': { status: 200, json: { ok: true } } }), log, now: () => T0 });
    assert.equal((await notifier.setup(setup())).sent, true);
  });
});

describe('digest once per day', () => {
  test('digest(rows, {dayKey}) sends once per dayKey; the same day is "already-sent"; a new day sends; cooldown does not apply', async () => {
    const { notifier, fetch } = harness();
    const rows = [{ key: 'sweepReclaim', n: 3, wins: 2, winRate: 0.667, expectancyR: 0.9, netR: 2.7 }];
    assert.deepEqual(await notifier.digest(rows, { dayKey: '2026-10-04', setupsToday: 2 }), { sent: true, kind: 'digest', status: 200 });
    assert.equal(bodyOf(fetch.calls[0]).text, formatDigest(rows, { dayKey: '2026-10-04', setupsToday: 2 }));
    assert.deepEqual(await notifier.digest(rows, { dayKey: '2026-10-04', setupsToday: 3 }), { sent: false, kind: 'digest', skipped: 'already-sent' });
    assert.equal((await notifier.digest(rows, { dayKey: '2026-10-05', setupsToday: 0 })).sent, true, 'no cooldown between days');
    assert.equal(fetch.calls.length, 2);
    assert.equal(notifier.stats().lastDigestDay, '2026-10-05');
    assert.equal((await notifier.digest(rows, {})).skipped, 'invalid');
    assert.equal((await notifier.digest(rows, { dayKey: 'today' })).skipped, 'invalid');
  });
  test('the sent dayKey survives a restart: remembered in <journal.dir>/notify-state.json', async () => {
    const a = harness();
    await a.notifier.digest([], { dayKey: '2026-10-04' });
    const stateFile = join(dir, 'notify-state.json');
    assert.ok(existsSync(stateFile));
    assert.equal(JSON.parse(readFileSync(stateFile, 'utf8')).lastDigestDay, '2026-10-04');
    const b = harness();                                      // "restart": a fresh notifier over the same journal dir
    assert.equal(b.notifier.stats().lastDigestDay, '2026-10-04');
    assert.deepEqual(await b.notifier.digest([], { dayKey: '2026-10-04' }), { sent: false, kind: 'digest', skipped: 'already-sent' });
    assert.equal(b.fetch.calls.length, 0);
    assert.equal((await b.notifier.digest([], { dayKey: '2026-10-05' })).sent, true);
    const c = harness({ stateFile: null });                   // memory only: nothing on disk is consulted
    assert.equal(c.notifier.stats().lastDigestDay, null);
  });
  test('a digest attempt that fails is not retried that day (one attempt, result tells the caller); one that was never attempted (cap) is still owed', async () => {
    const bad = harness({ routes: { '/sendMessage': { status: 500, text: 'x' } } });
    assert.equal((await bad.notifier.digest([], { dayKey: '2026-10-04' })).error, 'HTTP 500');
    assert.equal((await bad.notifier.digest([], { dayKey: '2026-10-04' })).skipped, 'already-sent');
    const capped = harness({ cfg: { maxPerHour: 1, cooldownMinutes: 0 }, stateFile: join(dir, 'capped-state.json') }); // its own memory, not bad's
    await capped.notifier.setup(setup());
    assert.equal((await capped.notifier.digest([], { dayKey: '2026-10-04' })).skipped, 'hourly-cap');
    assert.equal(capped.notifier.stats().lastDigestDay, null, 'not marked: the day is still owed');
    capped.clock.tick(H);
    assert.equal((await capped.notifier.digest([], { dayKey: '2026-10-04' })).sent, true);
  });
  test('digestDue: at/after notify.digestAt (Europe/London, DST-aware) and not yet sent for that local day', () => {
    const cfg = structuredClone(strategy);
    // BST: 17:05 London = 16:05Z
    assert.deepEqual(digestDue({ t: Date.UTC(2026, 9, 4, 16, 4), cfg }), { due: false, dayKey: '2026-10-04', localTime: '17:04' });
    assert.deepEqual(digestDue({ t: Date.UTC(2026, 9, 4, 16, 5), cfg }), { due: true, dayKey: '2026-10-04', localTime: '17:05' });
    assert.equal(digestDue({ t: Date.UTC(2026, 9, 4, 16, 5), cfg, lastDayKey: '2026-10-04' }).due, false);
    assert.equal(digestDue({ t: Date.UTC(2026, 9, 4, 22, 59), cfg, lastDayKey: '2026-10-03' }).due, true);
    // GMT: 17:05 London = 17:05Z; 16:05Z is 16:05 local → not due
    assert.equal(digestDue({ t: Date.UTC(2026, 11, 1, 16, 5), cfg }).due, false);
    assert.equal(digestDue({ t: Date.UTC(2026, 11, 1, 17, 5), cfg }).due, true);
    // the day the clocks go back (2026-10-25): 17:05 local is 17:05Z
    assert.equal(digestDue({ t: Date.UTC(2026, 9, 25, 16, 5), cfg }).due, false);
    assert.equal(digestDue({ t: Date.UTC(2026, 9, 25, 17, 5), cfg }).due, true);
    cfg.notify = { digestAt: '09:30' };
    assert.equal(digestDue({ t: Date.UTC(2026, 9, 4, 8, 30), cfg }).due, true);
    assert.equal(digestDue({ t: Date.UTC(2026, 9, 4, 8, 29), cfg }).due, false);
    const { notifier } = harness();
    assert.equal(notifier.digestDue(Date.UTC(2026, 9, 4, 16, 5)).due, true, 'the notifier binds its own remembered day');
  });
});

describe('stats + misc', () => {
  test('stats() is a plain snapshot: counts per kind, enabled, window, config knobs', async () => {
    const { notifier } = harness();
    await notifier.setup(setup()); await notifier.setup(setup({ grade: 'C', symbol: 'Z' }));
    const s = notifier.stats();
    assert.equal(s.enabled, true); assert.equal(s.attempted, 1); assert.equal(s.sent, 1); assert.equal(s.skipped, 1);
    assert.deepEqual(s.setup, { sent: 1, failed: 0, skipped: 1 });
    assert.equal(s.minGrade, 'B'); assert.equal(s.maxPerHour, 30); assert.equal(s.cooldownMinutes, 1); assert.equal(s.digestAt, '17:05');
    assert.deepEqual(KINDS, ['setup', 'resolved', 'digest', 'feedProblem']);
    s.sent = 99; assert.equal(notifier.stats().sent, 1);
  });
  test('send(kind, text) is exposed for scripts (report --telegram); an unknown kind is treated as a feed problem; dp option formats prices', async () => {
    const { notifier, fetch } = harness({ cfg: { cooldownMinutes: 0 } });
    assert.equal((await notifier.send('digest', '<b>manual</b>')).sent, true);
    assert.equal(bodyOf(fetch.calls[0]).text, '<b>manual</b>');
    assert.equal((await notifier.send('bogus', 'x')).kind, 'feedProblem');
    const dp = createNotifier({ cfg: { ...structuredClone(strategy), journal: { dir } }, env: ENV, fetch, now: () => T0, dp: { XAUUSD: 3 } });
    await dp.setup(setup({ symbol: 'XAUUSD', entry: 4146.5, stop: 4140, targets: [{ price: 4160, rr: 2 }] }));
    assert.ok(bodyOf(fetch.calls.at(-1)).text.includes('Entry 4,146.500 · Stop 4,140.000'));
    const long = setup({ reasons: Array(300).fill('A very long reason line that goes on and on about liquidity & order flow') });
    await notifier.setup(long);
    assert.ok(bodyOf(fetch.calls.at(-1)).text.length <= MAX_MESSAGE_CHARS, 'long messages are clamped before sending');
  });
});
