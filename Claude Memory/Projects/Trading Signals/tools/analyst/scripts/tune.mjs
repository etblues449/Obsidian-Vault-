#!/usr/bin/env node
// scripts/tune.mjs — best-fit tuner for czt.weights (SPEC-PRO.md §P4). Never runs automatically.
//
//   node scripts/tune.mjs [--min 30] [--k 30] [--dir data] [--symbol XAUUSD] [--strategy config/strategy.json]
//                         [--out tune-proposal.json] [--no-write] [--apply] [--yes]
//
// Reads the journal (lib/journal.mjs load() on --dir, default data/), groups RESOLVED setups by every hit
// they carried (condition.* / zone.* / trigger.* — the weights are per hit, so the groups are per hit), and
// proposes a new weight for each hit by shrinking it toward the evidence:
//
//     w' = w × (1 + k × clamp(expectancyR_of_setups_with_hit, −1, 1)),   k = n / (n + k0)
//
// k0 (default 30) is the prior's strength in "virtual trades" — Bayesian shrinkage toward the current weight:
// 30 trades move a weight half-way to the evidence, 3 trades a tenth of the way. A group with n < --min keeps
// its weight untouched (the proposal says so). expectancyR comes from journal.summarize, i.e. R measured
// against the ORIGINAL stop (source 05 §7: the invalidation point) — a trailed stop-out counts its real R.
//
// Prints the table (hit, n, win %, expR, w → w'), writes <dir>/tune-proposal.json, and ONLY with --apply
// rewrites config/strategy.json — even then it prints the diff and refuses without --yes (exit 2). The rewrite
// touches the numbers inside the `czt.weights` object and nothing else: whitespace, key order, comments
// (`_note` keys) and every other byte of the file are preserved. A key whose value does not change is not
// touched at all, so "3.0" stays "3.0". The result is parsed back and checked before it is written.
//
// DEVIATION: §P4 says "groups resolved setups by trigger kind and by zone kind"; the groups are by HIT
//   (condition / zone / trigger hits arrays) because that is the unit a weight attaches to — a setup with
//   two zone hits is evidence for both weights. Setup.trigger.kind is always one of its trigger hits.
// DEVIATION: additive flags --k (k0), --dir, --symbol, --strategy, --out, --no-write; exit code 2 for the
//   --apply-without---yes refusal (0 would read as "applied" to a shell script). validateStrategy() runs on
//   the rewritten config before it is written; an invalid result is refused (exit 1) and the file untouched.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createJournal, summarize } from '../lib/journal.mjs';
import { validateStrategy } from '../lib/config.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULTS = Object.freeze({ min: 30, k0: 30, dir: 'data', strategy: 'config/strategy.json', out: 'tune-proposal.json' });
export const RESOLVED = new Set(['won', 'lost', 'expired']);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round = (x, dp = 3) => Math.round(x * 10 ** dp) / 10 ** dp;
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** w × (1 + k × clamp(expR, −1, 1)), k = n / (n + k0). n ≤ 0 or a non-finite expR returns w unchanged. Never below 0. */
export function shrinkWeight(w, expR, n, { k0 = DEFAULTS.k0 } = {}) {
  if (!isNum(w)) throw new TypeError(`weight must be a finite number, got ${JSON.stringify(w)}`);
  if (!(n > 0) || !isNum(expR)) return w;
  const k = n / (n + Math.max(0, k0));
  return Math.max(0, round(w * (1 + k * clamp(expR, -1, 1))));
}

/** The weight keys a setup is evidence for: condition.<hit>, zone.<hit>, trigger.<hit> (deduped, in that order). */
export function hitsOf(setup) {
  const out = new Set();
  for (const group of ['condition', 'zone', 'trigger']) {
    const hits = setup?.[group]?.hits;
    if (Array.isArray(hits)) for (const h of hits) if (typeof h === 'string' && h) out.add(`${group}.${h}`);
  }
  if (typeof setup?.trigger?.kind === 'string' && setup.trigger.kind) out.add(`trigger.${setup.trigger.kind}`);
  return [...out];
}

/** Resolved setups (status won|lost|expired, finite resultR) grouped by weight key. */
export function groupByHit(setups) {
  const groups = new Map();
  for (const s of setups || []) {
    if (!s || !RESOLVED.has(s.status) || !isNum(s.resultR)) continue;
    for (const h of hitsOf(s)) { if (!groups.has(h)) groups.set(h, []); groups.get(h).push(s); }
  }
  return groups;
}

/**
 * Propose new weights. Pure.
 * @returns {{ rows: object[], weights: object, resolved: number, min: number, k0: number }}
 *   rows: { hit, n, wins, winRate, expR, netR, w, wNew, delta, applied, unknown? } — every weight key first
 *   (config order), then hits seen in the journal that have no weight (`unknown: true`, informative only).
 *   weights: a full copy of `weights` with the applied rows replaced (keys beginning with "_" pass through).
 */
export function proposeWeights(setups, weights, { min = DEFAULTS.min, k0 = DEFAULTS.k0 } = {}) {
  if (!weights || typeof weights !== 'object') throw new TypeError('weights must be the czt.weights object');
  const groups = groupByHit(setups);
  const resolved = new Set();
  for (const list of groups.values()) for (const s of list) resolved.add(s.id);
  const rows = [], next = {};
  for (const [hit, w] of Object.entries(weights)) {
    if (hit.startsWith('_') || !isNum(w)) { next[hit] = w; continue; }
    const list = groups.get(hit) ?? [];
    const st = summarize(hit, list);
    const applied = st.n >= min && st.n > 0;
    const wNew = applied ? shrinkWeight(w, st.expectancyR, st.n, { k0 }) : w;
    next[hit] = wNew;
    rows.push({ hit, n: st.n, wins: st.wins, winRate: st.winRate, expR: st.expectancyR, netR: st.netR, w, wNew, delta: round(wNew - w), applied });
  }
  for (const [hit, list] of groups) {
    if (hit in weights) continue;
    const st = summarize(hit, list);
    rows.push({ hit, n: st.n, wins: st.wins, winRate: st.winRate, expR: st.expectancyR, netR: st.netR, w: null, wNew: null, delta: 0, applied: false, unknown: true });
  }
  return { rows, weights: next, resolved: resolved.size, min, k0 };
}

const fmt = (x, dp = 2) => (isNum(x) ? x.toFixed(dp) : '—');
const signed = (x, dp = 2) => (isNum(x) ? (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(dp) : '—');
const pad = (s, n, right = false) => { s = String(s); return right ? s.padStart(n) : s.padEnd(n); };

/** The console table. Pure. */
export function formatTable(rows, { min = DEFAULTS.min } = {}) {
  const keyW = Math.max(4, ...rows.map((r) => r.hit.length));
  const lines = [`${pad('hit', keyW)}  ${pad('n', 4, true)}  ${pad('win%', 5, true)}  ${pad('expR', 6, true)}  ${pad('w', 6, true)}  →  ${pad("w'", 6)}  note`];
  lines.push('-'.repeat(lines[0].length));
  for (const r of rows) {
    const note = r.unknown ? 'no weight for this hit' : !r.applied ? (r.n ? `n < ${min}: kept` : 'no evidence: kept') : r.delta === 0 ? 'unchanged' : `${signed(r.delta, 3)}`;
    lines.push(`${pad(r.hit, keyW)}  ${pad(r.n, 4, true)}  ${pad(r.n ? `${Math.round(r.winRate * 100)}%` : '—', 5, true)}  ${pad(r.n ? signed(r.expR) : '—', 6, true)}  ${pad(fmt(r.w, 2), 6, true)}  →  ${pad(r.applied ? fmt(r.wNew, 3) : fmt(r.w, 2), 6)}  ${note}`);
  }
  return lines.join('\n');
}

/** The lines of the --apply diff: only keys whose value changes. */
export function formatDiff(oldWeights, newWeights) {
  const out = [];
  for (const [k, v] of Object.entries(newWeights)) {
    if (k.startsWith('_') || !isNum(v) || !isNum(oldWeights[k]) || v === oldWeights[k]) continue;
    out.push(`  ${k}: ${oldWeights[k]} → ${v}`);
  }
  return out;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Index just past the opening brace of the `"weights": {` object inside `"czt": {`, and the index of its closing brace. */
function locateWeights(text) {
  const czt = /"czt"\s*:\s*\{/.exec(text);
  if (!czt) throw new Error('strategy.json: no "czt" object found');
  const re = /"weights"\s*:\s*\{/g;
  re.lastIndex = czt.index + czt[0].length;
  const m = re.exec(text);
  if (!m) throw new Error('strategy.json: no "weights" object inside "czt"');
  const start = m.index + m[0].length;
  let depth = 1, inStr = false, esc = false, i = start;
  for (; i < text.length && depth > 0; i++) {
    const ch = text[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') depth--;
  }
  if (depth !== 0) throw new Error('strategy.json: unbalanced braces in "czt.weights"');
  return { start, end: i - 1 };
}

/**
 * Rewrite ONLY the numeric values of `czt.weights` in the raw strategy.json text. Every other byte is kept:
 * whitespace, key order, `_note` keys, the rest of the file. A key whose parsed value already equals the new
 * one is not touched (so its spelling survives). Throws when a key is missing from the block, when the result
 * does not parse, or when anything outside czt.weights would differ. Pure.
 */
export function rewriteWeights(text, newWeights) {
  if (typeof text !== 'string') throw new TypeError('rewriteWeights needs the strategy.json text');
  const before = JSON.parse(text);
  const { start, end } = locateWeights(text);
  let block = text.slice(start, end);
  for (const [key, val] of Object.entries(newWeights)) {
    if (key.startsWith('_')) continue;
    if (!isNum(val) || val < 0) throw new RangeError(`weight "${key}" must be a finite number ≥ 0, got ${JSON.stringify(val)}`);
    const cur = before?.czt?.weights?.[key];
    if (!isNum(cur)) throw new Error(`weight "${key}" is not a number in strategy.json`);
    if (cur === val) continue;
    const re = new RegExp(`("${escapeRe(key)}"\\s*:\\s*)(-?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)`);
    if (!re.test(block)) throw new Error(`weight "${key}" not found in the czt.weights block`);
    block = block.replace(re, (_, pre) => pre + String(val));
  }
  const out = text.slice(0, start) + block + text.slice(end);
  const after = JSON.parse(out); // throws on a broken result — nothing is written then
  const strip = (o) => { const c = structuredClone(o); if (c?.czt) delete c.czt.weights; return JSON.stringify(c); };
  if (strip(before) !== strip(after)) throw new Error('rewrite touched something outside czt.weights — refusing');
  for (const [k, v] of Object.entries(after.czt.weights)) {
    const want = k.startsWith('_') || !isNum(v) ? before.czt.weights[k] : (newWeights[k] ?? before.czt.weights[k]);
    if (JSON.stringify(v) !== JSON.stringify(want)) throw new Error(`rewrite produced ${k}=${JSON.stringify(v)}, expected ${JSON.stringify(want)}`);
  }
  return out;
}

/**
 * CLI entry. Returns the exit code: 0 ok / dry run, 1 bad input or invalid result, 2 --apply refused without --yes.
 * @param {string[]} argv
 * @param {{ stdout?, stderr?, now?, cwd? }} deps  injectable for tests (cwd anchors relative --dir / --strategy / --out)
 */
export async function main(argv = process.argv.slice(2), { stdout = process.stdout, stderr = process.stderr, now = () => Date.now(), cwd = ROOT } = {}) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv, allowNegative: true,
      options: {
        min: { type: 'string', default: String(DEFAULTS.min) }, k: { type: 'string', default: String(DEFAULTS.k0) },
        dir: { type: 'string', default: DEFAULTS.dir }, symbol: { type: 'string' }, strategy: { type: 'string', default: DEFAULTS.strategy },
        out: { type: 'string', default: DEFAULTS.out }, write: { type: 'boolean', default: true },
        apply: { type: 'boolean', default: false }, yes: { type: 'boolean', default: false },
      },
    }));
  } catch (e) { stderr.write(`tune: ${e.message}\n`); return 1; }
  const min = Number(values.min), k0 = Number(values.k);
  if (!Number.isInteger(min) || min < 1) { stderr.write(`tune: --min must be a positive integer, got ${values.min}\n`); return 1; }
  if (!isNum(k0) || k0 < 0) { stderr.write(`tune: --k must be a number ≥ 0, got ${values.k}\n`); return 1; }
  const at = (p) => (isAbsolute(p) ? p : resolve(cwd, p));
  const dir = at(values.dir), strategyPath = at(values.strategy);
  const outPath = isAbsolute(values.out) ? values.out : join(dir, values.out);

  let text, cfg;
  try { text = readFileSync(strategyPath, 'utf8'); cfg = JSON.parse(text); } catch (e) { stderr.write(`tune: cannot read ${strategyPath}: ${e.message}\n`); return 1; }
  const weights = cfg?.czt?.weights;
  if (!weights || typeof weights !== 'object') { stderr.write(`tune: ${strategyPath} has no czt.weights object\n`); return 1; }

  const journal = createJournal({ cfg: { journal: { dir } }, dir, now });
  const counts = journal.load();
  if (counts.malformed) stderr.write(`warning: ${counts.malformed} unreadable journal line(s) skipped\n`);
  const setups = journal.list({ symbol: values.symbol, limit: 1e9 });
  const proposal = proposeWeights(setups, weights, { min, k0 });

  stdout.write(`TradeGuard tune — ${proposal.resolved} resolved setup(s)${values.symbol ? ` for ${values.symbol}` : ''} in ${dir} · min n ${min} · k0 ${k0}\n`);
  stdout.write(`w' = w × (1 + n/(n+${k0}) × clamp(expR, −1, 1))\n\n${formatTable(proposal.rows, { min })}\n\n`);
  if (values.write) {
    try {
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, JSON.stringify({ generatedAt: new Date(now()).toISOString(), journalDir: dir, strategy: strategyPath, symbol: values.symbol ?? null, min, k0, resolved: proposal.resolved, rows: proposal.rows, weights: proposal.weights }, null, 2) + '\n');
      stdout.write(`proposal written to ${outPath}\n`);
    } catch (e) { stderr.write(`tune: could not write ${outPath}: ${e.message}\n`); return 1; }
  }

  const diff = formatDiff(weights, proposal.weights);
  if (!values.apply) { stdout.write(diff.length ? `\nDry run. ${diff.length} weight(s) would change — pass --apply --yes to rewrite ${strategyPath}.\n` : '\nDry run. Nothing would change.\n'); return 0; }
  if (!diff.length) { stdout.write('\nNothing to apply — every weight keeps its value.\n'); return 0; }
  stdout.write(`\nProposed changes to ${strategyPath}:\n${diff.join('\n')}\n`);
  if (!values.yes) { stderr.write('\nRefusing to rewrite strategy.json without --yes. Re-run with --apply --yes to confirm.\n'); return 2; }
  let rewritten;
  try {
    rewritten = rewriteWeights(text, proposal.weights);
    const issues = validateStrategy(JSON.parse(rewritten));
    if (issues.length) { stderr.write(`tune: the rewritten config does not validate — nothing written:\n  - ${issues.join('\n  - ')}\n`); return 1; }
    writeFileSync(strategyPath, rewritten);
  } catch (e) { stderr.write(`tune: ${e.message} — nothing written\n`); return 1; }
  stdout.write(`\nApplied ${diff.length} weight(s) to ${strategyPath}. Everything else in the file is byte-identical.\n`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code), (e) => { process.stderr.write(`tune failed: ${e.message}\n`); process.exit(1); });
}
