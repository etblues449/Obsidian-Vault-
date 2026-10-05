// Config loader: reads + validates config/strategy.json and config/symbols.json, applies
// environment overrides, and refuses to start on anything inconsistent (SPEC.md §1).
//
// DEVIATION: SPEC.md names this module but defines no API. Contract chosen here:
//   loadConfig({dir?, env?, strategy?, symbols?, knownFeeds?}) → { cfg, symbolsCfg, server:{host,port}, paths, applied, warnings }
//   validateStrategy(cfg) → issues[] · validateSymbols(symbolsCfg, {knownFeeds}) → issues[] · applyEnv(cfg, symbolsCfg, env)
//   `cfg` is the strategy.json object (what every engine module takes as `cfg`); `symbolsCfg` is the
//   symbols.json object with `.symbols[]` and `.feedDefaults`. The server bind lives in `server`, not in cfg.
//
// Design: validation collects EVERY problem and throws one ConfigError listing them all, so a
// hand-edited config is fixed in one pass rather than one restart per typo. Nothing here reads
// a secret into the config object — ANALYST_EXECUTOR_SECRET is only checked for presence and
// the bridge reads it from the environment itself at send time.
//
// Environment overrides (all optional):
//   ANALYST_HOST / ANALYST_PORT          server bind (defaults 127.0.0.1 / 8080)
//   ANALYST_DATA_DIR                      journal.dir
//   ANALYST_TZ                            sessions.timezone (IANA name)
//   ANALYST_SYMBOLS=BTCUSD,XAUUSD         keep only these symbol ids (order preserved from file)
//   ANALYST_FEED=simulated                force every symbol onto one adapter (offline/demo mode)
//   ANALYST_FEED_<ID>=yahoo               per-symbol adapter; <ID> = symbol id upper-cased, non [A-Z0-9] → _
//   ANALYST_EXECUTOR_ENABLED=true|false   executorBridge.enabled
//   ANALYST_EXECUTOR_URL                  executorBridge.url
//   ANALYST_SET="czt.minScore=5;risk.balance=2000"   any dotted strategy path; values parsed as JSON when possible

import { readFileSync } from 'node:fs';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TF_MS } from './engine/candles.mjs';
import { parseHHMM, isValidTimeZone } from './engine/sessions.mjs';

export const CONFIG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'config');
export const KNOWN_FEEDS = ['binance', 'simulated', 'yahoo', 'replay'];
export const LEVEL_KINDS = ['sessionHighLow', 'pdhPdl', 'equalHighsLows', 'valueArea', 'nakedPoc', 'consolidation', 'fvg', 'orderBlock', 'prevCandle'];
export const WEIGHT_KEYS = [
  'condition.biasAligned', 'condition.killzone', 'condition.outsideValueTrend', 'condition.insideValueRotation',
  'zone.pdhPdl', 'zone.sessionHighLow', 'zone.equalHighsLows', 'zone.valueArea', 'zone.nakedPoc', 'zone.fvg', 'zone.orderBlock', 'zone.prevCandle',
  'trigger.sweepReclaim', 'trigger.absorption', 'trigger.cvdDivergence', 'trigger.engulfing', 'trigger.ltfBos', 'trigger.deltaConfirms',
];
/** Path segments ANALYST_SET may never walk: writing through them pollutes Object.prototype (review finding, config.mjs:255). */
const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);
/** http(s) URL with no userinfo — credentials in a URL end up in every log line that names it. Returns null when invalid. */
export function parseHttpUrl(s) {
  if (typeof s !== 'string' || !/^https?:\/\/\S+$/.test(s)) return null;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (u.username || u.password) return null;
  return u;
}

export class ConfigError extends Error {
  constructor(issues, source = 'config') {
    super(`${source}: ${issues.length} problem${issues.length === 1 ? '' : 's'}\n  - ${issues.join('\n  - ')}`);
    this.name = 'ConfigError';
    this.issues = issues;
  }
}

// ---- small validation kit ------------------------------------------------------------------
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const get = (o, path) => path.split('.').filter(Boolean).reduce((a, k) => (a == null ? undefined : a[k]), o);

/** Issue collector. `prefix` is prepended to every reported path so nested blocks report full paths. */
function makeChecker(issues, prefix = '') {
  const fail = (p, msg) => { issues.push(`${prefix}${p}: ${msg}`); return false; };
  const c = {
    num: (o, p, { min = -Infinity, max = Infinity, gt, int = false } = {}) => {
      const v = get(o, p);
      if (!isNum(v) || (int && !isInt(v))) return fail(p, `expected ${int ? 'an integer' : 'a number'}, got ${JSON.stringify(v)}`);
      if (v < min || v > max || (gt !== undefined && v <= gt)) return fail(p, `${v} out of range (${gt !== undefined ? `> ${gt}` : `≥ ${min}`}${max !== Infinity ? `, ≤ ${max}` : ''})`);
      return true;
    },
    str: (o, p, re) => {
      const v = get(o, p);
      return typeof v === 'string' && v.length > 0 && (!re || re.test(v)) ? true : fail(p, `expected a${re ? ' matching' : ' non-empty'} string, got ${JSON.stringify(v)}`);
    },
    bool: (o, p) => (typeof get(o, p) === 'boolean' ? true : fail(p, `expected true/false, got ${JSON.stringify(get(o, p))}`)),
    obj: (o, p) => (isObj(get(o, p)) ? true : fail(p, `expected an object, got ${JSON.stringify(get(o, p))}`)),
    arr: (o, p, { min = 0 } = {}) => { const v = get(o, p); return Array.isArray(v) && v.length >= min ? true : fail(p, `expected an array${min ? ` of ≥ ${min}` : ''}, got ${JSON.stringify(v)}`); },
    oneOf: (o, p, allowed) => (allowed.includes(get(o, p)) ? true : fail(p, `${JSON.stringify(get(o, p))} is not one of ${allowed.join('|')}`)),
    fail,
    at: (sub) => makeChecker(issues, prefix + sub),
  };
  return c;
}

// ---- strategy.json ---------------------------------------------------------------------------
/** @returns {string[]} issues (empty = valid). Pure; never throws on bad shapes. */
export function validateStrategy(cfg) {
  const issues = [];
  const c = makeChecker(issues);
  if (!isObj(cfg)) return ['strategy: expected a JSON object'];
  const tfKeys = Object.keys(TF_MS);

  if (c.obj(cfg, 'timeframes')) {
    const tf = cfg.timeframes, ct = c.at('timeframes.');
    if (ct.arr(tf, 'available', { min: 1 })) tf.available.forEach((t, i) => { if (!tfKeys.includes(t)) ct.fail(`available[${i}]`, `${JSON.stringify(t)} is not one of ${tfKeys.join('|')}`); });
    const roles = ['base', 'analysis', 'structure', 'bias', 'htf'];
    for (const r of roles) ct.oneOf(tf, r, Array.isArray(tf.available) ? tf.available.filter((t) => tfKeys.includes(t)) : tfKeys);
    if (tf.base !== '1m') ct.fail('base', 'must be "1m" — the store aggregates everything from 1-minute candles');
    // Each role must be at least as coarse as the previous: HTF bias from a finer TF than the trigger is meaningless.
    for (let i = 1; i < roles.length; i++) {
      const a = TF_MS[tf[roles[i - 1]]], b = TF_MS[tf[roles[i]]];
      if (a && b && b < a) ct.fail(roles[i], `${tf[roles[i]]} is finer than timeframes.${roles[i - 1]} (${tf[roles[i - 1]]})`);
    }
  }
  if (c.obj(cfg, 'history')) {
    c.num(cfg, 'history.backfillMinutes', { min: 1, int: true });
    // A 4h candle has 240 one-minute children; anything smaller would drop children mid-bucket.
    c.num(cfg, 'history.maxCandlesPerTf', { min: 300, int: true });
    c.num(cfg, 'history.maxTradesInMemory', { min: 0, int: true });
  }
  if (c.obj(cfg, 'sessions')) validateSessions(cfg.sessions, c.at('sessions.'));
  if (c.obj(cfg, 'indicators')) {
    for (const k of ['emaFast', 'emaSlow', 'emaBias', 'atrPeriod', 'swingLookback']) c.num(cfg, `indicators.${k}`, { min: 1, int: true });
    const ind = cfg.indicators;
    if (isNum(ind.emaFast) && isNum(ind.emaSlow) && isNum(ind.emaBias) && !(ind.emaFast < ind.emaSlow && ind.emaSlow < ind.emaBias)) c.fail('indicators', 'expected emaFast < emaSlow < emaBias');
    c.bool(cfg, 'indicators.vwapSessionReset');
  }
  if (c.obj(cfg, 'liquidity')) {
    c.num(cfg, 'liquidity.equalLevelToleranceAtr', { gt: 0 });
    c.num(cfg, 'liquidity.sweepMinDepthAtr', { min: 0 });
    c.num(cfg, 'liquidity.sweepMaxDepthAtr', { gt: 0 });
    if (isNum(cfg.liquidity.sweepMinDepthAtr) && isNum(cfg.liquidity.sweepMaxDepthAtr) && cfg.liquidity.sweepMinDepthAtr >= cfg.liquidity.sweepMaxDepthAtr) c.fail('liquidity.sweepMaxDepthAtr', 'must exceed sweepMinDepthAtr');
    c.num(cfg, 'liquidity.consolidationCandles', { min: 2, int: true });
    c.num(cfg, 'liquidity.consolidationMaxRangeAtr', { gt: 0 });
    c.num(cfg, 'liquidity.levelExpiryHours', { gt: 0 });
  }
  if (c.obj(cfg, 'structure')) {
    c.num(cfg, 'structure.displacementBodyAtr', { gt: 0 });
    c.num(cfg, 'structure.fvgMinSizeAtr', { min: 0 });
    c.num(cfg, 'structure.orderBlockMaxAgeCandles', { min: 1, int: true });
    c.num(cfg, 'structure.engulfingMinBodyAtr', { min: 0 });
  }
  if (c.obj(cfg, 'orderflow')) {
    c.num(cfg, 'orderflow.absorptionVolumeMult', { gt: 0 });
    c.num(cfg, 'orderflow.absorptionMaxRangeAtr', { gt: 0 });
    c.num(cfg, 'orderflow.absorptionMinWickRatio', { min: 0, max: 1 });
    c.num(cfg, 'orderflow.cvdDivergenceSwings', { min: 2, int: true });
    c.num(cfg, 'orderflow.volumeProfileWindowCandles', { min: 10, int: true });
    c.num(cfg, 'orderflow.volumeProfileBucketsAtr', { gt: 0 });
    c.num(cfg, 'orderflow.valueAreaPct', { gt: 0, max: 1 });
    c.num(cfg, 'orderflow.nakedPocLookbackDays', { min: 1, int: true });
  }
  if (c.obj(cfg, 'czt')) {
    const z = cfg.czt;
    c.num(cfg, 'czt.zoneToleranceAtr', { gt: 0 });
    if (c.obj(cfg, 'czt.weights')) {
      // Weight keys contain dots, so they are read directly rather than as dotted paths.
      for (const k of WEIGHT_KEYS) if (!isNum(z.weights[k]) || z.weights[k] < 0) c.fail(`czt.weights["${k}"]`, `expected a number ≥ 0, got ${JSON.stringify(z.weights[k])}`);
      for (const k of Object.keys(z.weights)) if (!WEIGHT_KEYS.includes(k) && !k.startsWith('_')) c.fail(`czt.weights["${k}"]`, 'unknown hit — the scorer would silently ignore it');
    }
    c.num(cfg, 'czt.minScore', { gt: 0 });
    c.num(cfg, 'czt.gradeB', { gt: 0 });
    c.num(cfg, 'czt.gradeA', { gt: 0 });
    if (isNum(z.minScore) && isNum(z.gradeB) && isNum(z.gradeA) && !(z.minScore <= z.gradeB && z.gradeB <= z.gradeA)) c.fail('czt', 'expected minScore ≤ gradeB ≤ gradeA');
    c.num(cfg, 'czt.minRr', { gt: 0 });
    c.num(cfg, 'czt.stopBufferAtr', { min: 0 });
    if (z.minStopAtr !== undefined) c.num(cfg, 'czt.minStopAtr', { min: 0 });
    c.num(cfg, 'czt.maxStopAtr', { gt: 0 });
    if (isNum(z.stopBufferAtr) && isNum(z.maxStopAtr) && z.maxStopAtr <= z.stopBufferAtr) c.fail('czt.maxStopAtr', 'must exceed stopBufferAtr');
    if (isNum(z.minStopAtr) && isNum(z.maxStopAtr) && z.maxStopAtr <= z.minStopAtr) c.fail('czt.maxStopAtr', 'must exceed minStopAtr');
    if (c.arr(z, 'targetsFrom', { min: 1 })) z.targetsFrom.forEach((k, i) => { if (!LEVEL_KINDS.includes(k)) c.fail(`czt.targetsFrom[${i}]`, `${JSON.stringify(k)} is not one of ${LEVEL_KINDS.join('|')}`); });
    c.num(cfg, 'czt.maxSetupsPerSymbolPerDay', { min: 1, int: true });
    c.num(cfg, 'czt.cooldownMinutes', { min: 0 });
    c.bool(cfg, 'czt.oneOpenPerSymbol');
  }
  if (c.obj(cfg, 'risk')) {
    c.num(cfg, 'risk.balance', { gt: 0 });
    c.num(cfg, 'risk.riskPct', { gt: 0, max: 100 });
    c.num(cfg, 'risk.dailyLossPct', { gt: 0, max: 100 });
    if (isNum(cfg.risk.riskPct) && isNum(cfg.risk.dailyLossPct) && cfg.risk.dailyLossPct < cfg.risk.riskPct) c.fail('risk.dailyLossPct', 'must be ≥ riskPct');
    c.num(cfg, 'risk.maxOpenAcrossSymbols', { min: 1, int: true });
  }
  if (c.obj(cfg, 'journal')) {
    c.str(cfg, 'journal.dir');
    c.num(cfg, 'journal.resolveTimeoutHours', { gt: 0 });
    c.bool(cfg, 'journal.trailByProvedAuctions');
  }
  if (c.obj(cfg, 'executorBridge')) {
    const b = cfg.executorBridge, cb = c.at('executorBridge.');
    cb.bool(b, 'enabled');
    if (b.enabled && cb.str(b, 'url', /^https?:\/\/\S+$/) && !parseHttpUrl(b.url)) cb.fail('url', 'must not carry user:password@ credentials (the URL is logged on every send) and must parse as a URL');
    cb.arr(b, 'symbols');
    cb.oneOf(b, 'minGrade', ['A', 'B', 'C']);
  }
  return issues;
}

function validateSessions(s, c) {
  if (!c.str(s, 'timezone')) return;
  if (!isValidTimeZone(s.timezone)) c.fail('timezone', `${JSON.stringify(s.timezone)} is not an IANA time zone this Node build knows`);
  c.bool(s, 'tradeOnlyInKillzones');
  if (!c.arr(s, 'list', { min: 1 })) return;
  const ids = new Set();
  const spans = [];
  s.list.forEach((sess, i) => {
    const cs = c.at(`list[${i}]`);
    if (!isObj(sess)) return cs.fail('', 'expected an object');
    if (cs.str(sess, '.id', /^[a-z][a-z0-9_-]*$/)) { if (ids.has(sess.id)) cs.fail('.id', `duplicate id "${sess.id}"`); ids.add(sess.id); }
    cs.str(sess, '.label');
    cs.oneOf(sess, '.role', ['consolidation', 'manipulation', 'distribution', 'retracement', 'expansion']);
    const start = parseHHMM(sess.start), end = parseHHMM(sess.end);
    if (start === null) cs.fail('.start', `expected HH:MM, got ${JSON.stringify(sess.start)}`);
    if (end === null) cs.fail('.end', `expected HH:MM (24:00 allowed), got ${JSON.stringify(sess.end)}`);
    if (start !== null && end !== null) {
      if (end <= start) cs.fail('', `end ${sess.end} must be after start ${sess.start} (sessions do not wrap midnight; split them at 00:00)`);
      spans.push({ start, end, id: sess.id });
      if (sess.killzone !== undefined) {
        if (!isObj(sess.killzone)) cs.fail('.killzone', 'expected {start, end}');
        else {
          const ks = parseHHMM(sess.killzone.start), ke = parseHHMM(sess.killzone.end);
          if (ks === null || ke === null || ke <= ks) cs.fail('.killzone', 'expected HH:MM start < end');
          else if (ks < start || ke > end) cs.fail('.killzone', `must lie inside the session (${sess.start}–${sess.end})`);
        }
      }
    }
  });
  // Sources 02/03: every minute of the day belongs to exactly one phase, so the list must tile 00:00→24:00.
  spans.sort((a, b) => a.start - b.start);
  let cursor = 0;
  for (const sp of spans) {
    if (sp.start > cursor) c.fail('list', `gap between ${fmtHHMM(cursor)} and ${fmtHHMM(sp.start)} (before "${sp.id}")`);
    if (sp.start < cursor) c.fail('list', `"${sp.id}" overlaps the previous session (starts ${fmtHHMM(sp.start)}, previous ends ${fmtHHMM(cursor)})`);
    cursor = Math.max(cursor, sp.end);
  }
  if (spans.length && cursor < 1440) c.fail('list', `day not covered after ${fmtHHMM(cursor)} (last session must end at 24:00)`);
}
const fmtHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// ---- symbols.json ---------------------------------------------------------------------------
/** @returns {string[]} issues. `knownFeeds` lets the registry extend the adapter list later. */
export function validateSymbols(symbolsCfg, { knownFeeds = KNOWN_FEEDS } = {}) {
  const issues = [];
  const c = makeChecker(issues);
  if (!isObj(symbolsCfg)) return ['symbols: expected a JSON object'];
  if (!c.arr(symbolsCfg, 'symbols', { min: 1 })) return issues;
  const ids = new Set();
  const yahooMap = get(symbolsCfg, 'feedDefaults.yahoo.symbols') || {};
  symbolsCfg.symbols.forEach((s, i) => {
    const cs = c.at(`symbols[${i}]`);
    if (!isObj(s)) return cs.fail('', 'expected an object');
    if (cs.str(s, '.id', /^[A-Za-z0-9!._-]{1,16}$/)) { if (ids.has(s.id)) cs.fail('.id', `duplicate id "${s.id}"`); ids.add(s.id); }
    cs.str(s, '.name');
    if (cs.str(s, '.feed') && !knownFeeds.includes(s.feed)) cs.fail('.feed', `"${s.feed}" is not a known adapter (${knownFeeds.join('|')})`);
    if (s.feedParams !== undefined) cs.obj(s, '.feedParams');
    if (s.feed === 'binance' && !/^[a-z0-9]+$/.test(get(s, 'feedParams.stream') || '')) cs.fail('.feedParams.stream', 'binance needs a lower-case stream symbol, e.g. "btcusdt"');
    if (s.feed === 'yahoo' && !yahooMap[s.id]) cs.fail('', `feed "yahoo" needs feedDefaults.yahoo.symbols["${s.id}"]`);
    cs.num(s, '.dp', { min: 0, max: 10, int: true });
    cs.num(s, '.tick', { gt: 0 });
    if (cs.obj(s, '.contract')) { cs.num(s, '.contract.unitsPerLot', { gt: 0 }); cs.str(s, '.contract.label'); }
  });
  if (symbolsCfg.feedDefaults !== undefined && !isObj(symbolsCfg.feedDefaults)) c.fail('feedDefaults', 'expected an object');
  if (isObj(symbolsCfg.feedDefaults) && symbolsCfg.feedDefaults.yahoo !== undefined) c.at('feedDefaults.').num(symbolsCfg.feedDefaults, 'yahoo.pollSeconds', { min: 5, int: true });
  return issues;
}

// ---- environment overrides -------------------------------------------------------------------
function coerce(raw) {
  try { return JSON.parse(raw); } catch { return raw; }
}
/** Dotted-path write. Throws RangeError on a prototype-walking segment — callers decide whether to warn or abort. */
function setPath(obj, path, value) {
  const keys = path.split('.');
  if (keys.some((k) => FORBIDDEN_SEGMENTS.has(k))) throw new RangeError(`path "${path}" would write through Object.prototype`);
  let o = obj;
  for (const k of keys.slice(0, -1)) {
    // Own properties only: an inherited `constructor` or `__proto__` must never be walked into. Arrays survive (list.0.label).
    if (!Object.hasOwn(o, k) || o[k] === null || typeof o[k] !== 'object') o[k] = {};
    o = o[k];
  }
  o[keys.at(-1)] = value;
}
export const envKeyForSymbol = (id) => `ANALYST_FEED_${String(id).toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;

/**
 * Apply ANALYST_* overrides. Pure with respect to its inputs (clones first).
 * @returns {{cfg, symbolsCfg, server:{host:string, port:number}, applied:string[], warnings:string[]}}
 */
export function applyEnv(cfg, symbolsCfg, env = {}) {
  cfg = structuredClone(cfg);
  symbolsCfg = structuredClone(symbolsCfg);
  const applied = [], warnings = [];
  const has = (k) => typeof env[k] === 'string' && env[k].trim() !== '';
  const server = { host: has('ANALYST_HOST') ? env.ANALYST_HOST.trim() : '127.0.0.1', port: 8080 };
  if (has('ANALYST_PORT')) {
    const p = Number(env.ANALYST_PORT);
    if (Number.isInteger(p) && p >= 0 && p <= 65535) server.port = p; else warnings.push(`ANALYST_PORT=${env.ANALYST_PORT} ignored (not a port)`);
  }
  if (has('ANALYST_DATA_DIR')) { setPath(cfg, 'journal.dir', env.ANALYST_DATA_DIR.trim()); applied.push('journal.dir'); }
  if (has('ANALYST_TZ')) { setPath(cfg, 'sessions.timezone', env.ANALYST_TZ.trim()); applied.push('sessions.timezone'); }
  if (has('ANALYST_EXECUTOR_URL')) { setPath(cfg, 'executorBridge.url', env.ANALYST_EXECUTOR_URL.trim()); applied.push('executorBridge.url'); }
  if (has('ANALYST_EXECUTOR_ENABLED')) {
    const v = env.ANALYST_EXECUTOR_ENABLED.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(v) || ['false', '0', 'no', 'off'].includes(v)) { setPath(cfg, 'executorBridge.enabled', ['true', '1', 'yes', 'on'].includes(v)); applied.push('executorBridge.enabled'); }
    else warnings.push(`ANALYST_EXECUTOR_ENABLED=${env.ANALYST_EXECUTOR_ENABLED} ignored (expected true/false)`);
  }
  if (has('ANALYST_SET')) {
    for (const pair of env.ANALYST_SET.split(/[;,]/).map((s) => s.trim()).filter(Boolean)) {
      // A path starts with a letter; later segments are [A-Za-z0-9_] (array indexes allowed). `__proto__`, `constructor`,
      // `prototype` are rejected below as well, so a value can never land on Object.prototype.
      const m = /^([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*)=(.*)$/.exec(pair);
      if (!m) { warnings.push(`ANALYST_SET entry "${pair}" ignored (expected path=value)`); continue; }
      if (m[1].startsWith('executorBridge.') && /secret/i.test(m[1])) { warnings.push(`ANALYST_SET "${m[1]}" ignored — secrets never go in config`); continue; }
      if (m[1].split('.').some((k) => FORBIDDEN_SEGMENTS.has(k))) { warnings.push(`ANALYST_SET "${m[1]}" ignored — prototype path segments are not allowed`); continue; }
      setPath(cfg, m[1], coerce(m[2]));
      applied.push(m[1]);
    }
  }
  if (Array.isArray(symbolsCfg.symbols)) {
    if (has('ANALYST_SYMBOLS')) {
      const keep = env.ANALYST_SYMBOLS.split(',').map((s) => s.trim()).filter(Boolean);
      const known = new Set(symbolsCfg.symbols.map((s) => s.id));
      for (const k of keep) if (!known.has(k)) warnings.push(`ANALYST_SYMBOLS names unknown symbol "${k}"`);
      symbolsCfg.symbols = symbolsCfg.symbols.filter((s) => keep.includes(s.id));
      applied.push('symbols');
    }
    for (const s of symbolsCfg.symbols) {
      const perSymbol = envKeyForSymbol(s.id);
      const feed = has(perSymbol) ? env[perSymbol].trim() : has('ANALYST_FEED') ? env.ANALYST_FEED.trim() : null;
      if (feed && feed !== s.feed) { s.feedOriginal = s.feed; s.feed = feed; applied.push(`symbols.${s.id}.feed`); }
    }
  }
  if (get(cfg, 'executorBridge.enabled') === true && !has('ANALYST_EXECUTOR_SECRET')) warnings.push('executorBridge.enabled is true but ANALYST_EXECUTOR_SECRET is not set — the bridge will refuse to send');
  return { cfg, symbolsCfg, server, applied, warnings };
}

// ---- entry point -----------------------------------------------------------------------------
function readJson(path, source) {
  let text;
  try { text = readFileSync(path, 'utf8'); } catch (e) { throw new ConfigError([`cannot read ${path}: ${e.message}`], source); }
  try { return JSON.parse(text); } catch (e) { throw new ConfigError([`${path} is not valid JSON: ${e.message}`], source); }
}

/**
 * Load, override, validate. Throws ConfigError listing every problem.
 * @param {object} [opts]
 * @param {string} [opts.dir=CONFIG_DIR]   directory holding strategy.json + symbols.json
 * @param {object} [opts.env=process.env]
 * @param {object} [opts.strategy]         pass objects instead of reading files (tests)
 * @param {object} [opts.symbols]
 * @param {string[]} [opts.knownFeeds]
 * @returns {{cfg, symbolsCfg, server, paths, applied, warnings}}
 */
export function loadConfig({ dir = CONFIG_DIR, env = process.env, strategy, symbols, knownFeeds } = {}) {
  dir = isAbsolute(dir) ? dir : resolve(process.cwd(), dir);
  const paths = { strategy: resolve(dir, 'strategy.json'), symbols: resolve(dir, 'symbols.json') };
  const rawStrategy = strategy ?? readJson(paths.strategy, 'strategy.json');
  const rawSymbols = symbols ?? readJson(paths.symbols, 'symbols.json');
  const out = applyEnv(rawStrategy, rawSymbols, env);
  const issues = [
    ...validateStrategy(out.cfg).map((s) => `strategy.json ${s}`),
    ...validateSymbols(out.symbolsCfg, { knownFeeds }).map((s) => `symbols.json ${s}`),
  ];
  if (issues.length) throw new ConfigError(issues, out.applied.length ? `config (after env overrides: ${out.applied.join(', ')})` : 'config');
  return { ...out, paths };
}
