// test/tune.test.mjs — SPEC-PRO §P8: shrinkage maths, --apply refused without --yes, byte-identical rewrite of
// untouched keys (on a temp copy of config/strategy.json), proposal file, journal grouping by hit.
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { shrinkWeight, hitsOf, groupByHit, proposeWeights, rewriteWeights, formatTable, formatDiff, main, clamp, DEFAULTS, ROOT } from '../scripts/tune.mjs';
import { FILES } from '../lib/journal.mjs';

const STRATEGY_PATH = new URL('../config/strategy.json', import.meta.url);
const strategyText = readFileSync(STRATEGY_PATH, 'utf8');
const strategy = JSON.parse(strategyText);
const T0 = Date.UTC(2026, 0, 5, 8, 0);
const M = 60e3;

/** One journaled setup + its resolution line. `hits` = { condition, zone, trigger } arrays; trigger.kind = trigger[0]. */
function mkLines(i, { symbol = 'BTCUSD', resultR = 1, status = resultR > 0 ? 'won' : 'lost', hits = {}, side = 'long' } = {}) {
  const id = `${symbol}-${i}`;
  const setup = {
    id, symbol, t: T0 + i * 5 * M, tf: '5m', side, entry: 100, stop: side === 'long' ? 98 : 102, targets: [{ price: side === 'long' ? 104 : 96, label: 'PDH', rr: 2 }], rr: 2,
    score: 8, grade: 'B',
    condition: { bias: { dir: 'bullish' }, session: { id: 'london' }, valueRelation: 'below', hits: hits.condition ?? ['biasAligned', 'killzone'] },
    zone: { hits: hits.zone ?? ['sessionHighLow'] },
    trigger: { kind: (hits.trigger ?? ['sweepReclaim'])[0], hits: hits.trigger ?? ['sweepReclaim'] },
    reasons: [], invalidation: 'x', status: 'open',
  };
  const resolution = { id, symbol, status, exit: status === 'won' ? 'target' : status === 'lost' ? 'stop' : 'timeout', exitPrice: 1, resolvedAt: T0 + (i + 10) * 5 * M, resultR, mfeR: 0, maeR: 0, stop: setup.stop, trail: [] };
  return { setup, resolution };
}
/** Writes setups.jsonl + resolutions.jsonl for `specs` into `dir`. `open` setups get no resolution. */
function writeJournal(dir, specs) {
  mkdirSync(dir, { recursive: true });
  const s = [], r = [];
  specs.forEach((spec, i) => { const { setup, resolution } = mkLines(i, spec); s.push(JSON.stringify(setup)); if (!spec.open) r.push(JSON.stringify(resolution)); });
  writeFileSync(join(dir, FILES.setups), s.join('\n') + '\n');
  writeFileSync(join(dir, FILES.resolutions), r.join('\n') + '\n');
}
const resolvedOf = (specs) => specs.filter((x) => !x.open).map((spec, i) => { const { setup, resolution } = mkLines(i, spec); return { ...setup, ...resolution }; });

/** Capture stdout/stderr for main(). */
function io() {
  const out = [], err = [];
  return { stdout: { write: (s) => out.push(String(s)) }, stderr: { write: (s) => err.push(String(s)) }, out: () => out.join(''), err: () => err.join('') };
}

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'tradeguard-tune-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('shrinkage maths', () => {
  test("w' = w × (1 + k × clamp(expR, −1, 1)), k = n/(n+k0)", () => {
    assert.equal(shrinkWeight(3, 0.5, 30), 3.75);                // k = 0.5 → 3 × 1.25
    assert.equal(shrinkWeight(3, -0.5, 30), 2.25);               // 3 × 0.75
    assert.equal(shrinkWeight(2, 1, 30), 3);                     // 2 × 1.5
    assert.equal(shrinkWeight(2, 4, 30), 3, 'expR clamped to +1');
    assert.equal(shrinkWeight(2, -7, 30), 1, 'expR clamped to −1 — a weight is never more than halved at n = k0');
    assert.equal(shrinkWeight(2, -1, 1e9), 0, 'the floor is 0, never negative');
    assert.equal(shrinkWeight(1.5, 0.2, 10), 1.575);             // k = 0.25 → 1.5 × 1.05
    assert.equal(shrinkWeight(1.5, 0.2, 90), 1.725);             // k = 0.75
    assert.equal(shrinkWeight(1.5, 0.2, 30, { k0: 0 }), 1.8, 'k0 = 0: no shrinkage, the evidence is taken at face value');
    assert.equal(shrinkWeight(1.5, 0.2, 30, { k0: 1e12 }), 1.5, 'an enormous prior: the weight does not move');
    assert.equal(shrinkWeight(3, 0.5, 0), 3, 'n = 0 keeps w');
    assert.equal(shrinkWeight(3, NaN, 30), 3, 'no expectancy keeps w');
    assert.equal(shrinkWeight(0, 1, 100), 0, 'a zero weight stays zero (nothing to scale)');
    assert.throws(() => shrinkWeight('3', 1, 1), TypeError);
    assert.equal(clamp(5, -1, 1), 1); assert.equal(clamp(-5, -1, 1), -1); assert.equal(clamp(0.3, -1, 1), 0.3);
  });
  test('rounded to 3 dp so the rewrite stays readable', () => {
    assert.equal(shrinkWeight(1, 0.123456, 30), 1.062);           // k 0.5 → 1.061728
  });
});

describe('grouping by hit', () => {
  test('hitsOf lists condition./zone./trigger. keys, deduped, plus trigger.kind', () => {
    const { setup } = mkLines(0, { hits: { condition: ['biasAligned', 'killzone'], zone: ['fvg', 'fvg'], trigger: ['sweepReclaim', 'deltaConfirms'] } });
    assert.deepEqual(hitsOf(setup), ['condition.biasAligned', 'condition.killzone', 'zone.fvg', 'trigger.sweepReclaim', 'trigger.deltaConfirms']);
    assert.deepEqual(hitsOf({ trigger: { kind: 'absorption' } }), ['trigger.absorption']);
    assert.deepEqual(hitsOf(null), []); assert.deepEqual(hitsOf({ condition: { hits: 'nope' } }), []);
  });
  test('groupByHit uses only resolved setups with a finite resultR; one setup is evidence for every hit it carried', () => {
    const specs = [
      { resultR: 2, hits: { trigger: ['sweepReclaim', 'deltaConfirms'], zone: ['fvg'] } },
      { resultR: -1, hits: { trigger: ['absorption'], zone: ['fvg', 'orderBlock'] } },
      { open: true, hits: { trigger: ['sweepReclaim'] } },
      { resultR: 0.5, status: 'expired', hits: { trigger: ['sweepReclaim'] } },
    ];
    const rows = resolvedOf(specs);
    rows.push({ ...mkLines(9, {}).setup, status: 'cancelled', resultR: 0 }, { ...mkLines(8, {}).setup, status: 'won', resultR: NaN });
    const g = groupByHit([...rows, { ...mkLines(7, {}).setup, status: 'open' }]);
    assert.deepEqual(g.get('trigger.sweepReclaim').map((s) => s.resultR), [2, 0.5]);
    assert.deepEqual(g.get('zone.fvg').map((s) => s.resultR), [2, -1]);
    assert.deepEqual(g.get('zone.orderBlock').map((s) => s.resultR), [-1]);
    assert.equal(g.get('trigger.deltaConfirms').length, 1);
    assert.equal(g.get('condition.biasAligned').length, 3);
    assert.equal(g.has('trigger.cancelled'), false);
  });
});

describe('proposeWeights', () => {
  test('a group with n ≥ min is shrunk toward its expectancy; n < min keeps its weight; every weight key is reported; unknown hits are listed but not weighted', () => {
    const specs = [
      ...Array.from({ length: 30 }, (_, i) => ({ resultR: i < 20 ? 2 : -1, hits: { trigger: ['sweepReclaim'], zone: ['sessionHighLow'] } })), // expR = (40 − 10)/30 = 1.0
      ...Array.from({ length: 10 }, () => ({ resultR: -1, hits: { trigger: ['absorption'], zone: ['fvg'], condition: ['mystery'] } })),         // n 10 < 30: kept
    ];
    const weights = structuredClone(strategy.czt.weights);
    const p = proposeWeights(resolvedOf(specs), weights, { min: 30, k0: 30 });
    assert.equal(p.resolved, 40);
    const by = Object.fromEntries(p.rows.map((r) => [r.hit, r]));
    assert.equal(by['trigger.sweepReclaim'].n, 30); assert.equal(by['trigger.sweepReclaim'].expR, 1);
    assert.equal(by['trigger.sweepReclaim'].w, 3); assert.equal(by['trigger.sweepReclaim'].wNew, 4.5); assert.equal(by['trigger.sweepReclaim'].applied, true); assert.equal(by['trigger.sweepReclaim'].delta, 1.5);
    assert.equal(by['zone.sessionHighLow'].wNew, 2.25);
    assert.equal(by['condition.biasAligned'].n, 30, 'the default condition hits of the 30 sweep setups (the other 10 carry only "mystery")');
    assert.equal(by['condition.biasAligned'].wNew, 2 * (1 + (30 / 60) * 1));   // expR (40 − 10)/30 = 1 → 3
    assert.equal(by['trigger.absorption'].n, 10); assert.equal(by['trigger.absorption'].applied, false); assert.equal(by['trigger.absorption'].wNew, 2, 'kept');
    assert.equal(by['trigger.engulfing'].n, 0); assert.equal(by['trigger.engulfing'].wNew, strategy.czt.weights['trigger.engulfing']);
    assert.deepEqual(by['condition.mystery'], { hit: 'condition.mystery', n: 10, wins: 0, winRate: 0, expR: -1, netR: -10, w: null, wNew: null, delta: 0, applied: false, unknown: true });
    assert.equal(Object.keys(p.weights).length, Object.keys(weights).length, 'the proposal has exactly the config keys');
    assert.ok(!('condition.mystery' in p.weights));
    assert.equal(p.weights['trigger.sweepReclaim'], 4.5); assert.equal(p.weights['trigger.absorption'], 2);
    assert.equal(p.rows.filter((r) => !r.unknown).length, Object.keys(weights).filter((k) => !k.startsWith('_')).length);
    assert.deepEqual(weights, strategy.czt.weights, 'pure: the input weights are untouched');
    const lower = proposeWeights(resolvedOf(specs), weights, { min: 10 });
    assert.equal(lower.weights['trigger.absorption'], 1.5, 'with --min 10 the absorption group is applied: 2 × (1 + 0.25 × −1)');
    assert.throws(() => proposeWeights([], null), TypeError);
  });
  test('_note keys pass through; the table and the diff render', () => {
    const weights = { _note: 'keep me', 'trigger.sweepReclaim': 3, 'trigger.absorption': 2 };
    const p = proposeWeights(resolvedOf(Array.from({ length: 30 }, () => ({ resultR: 1 }))), weights, { min: 30 });
    assert.equal(p.weights._note, 'keep me');
    assert.equal(p.weights['trigger.sweepReclaim'], 4.5);
    const table = formatTable(p.rows, { min: 30 });
    assert.match(table, /trigger\.sweepReclaim\s+30\s+100%\s+\+1\.00\s+3\.00\s+→\s+4\.500\s+\+1\.500/);
    assert.match(table, /trigger\.absorption\s+0\s+—\s+—\s+2\.00\s+→\s+2\.00\s+no evidence: kept/);
    assert.deepEqual(formatDiff(weights, p.weights), ['  trigger.sweepReclaim: 3 → 4.5']);
    assert.deepEqual(formatDiff(weights, weights), []);
  });
});

describe('rewriteWeights — only the weights change, every other byte survives', () => {
  test('identity: the same weights back → the exact same text', () => {
    assert.equal(rewriteWeights(strategyText, structuredClone(strategy.czt.weights)), strategyText);
  });
  test('changed values are substituted in place; whitespace, key order, _note/_comment and the rest of the file are byte-identical', () => {
    const next = structuredClone(strategy.czt.weights);
    next['trigger.sweepReclaim'] = 4.5; next['zone.fvg'] = 0.875; next['condition.killzone'] = 1.5; // the last one is unchanged
    const out = rewriteWeights(strategyText, next);
    const a = strategyText.split('\n'), b = out.split('\n');
    assert.equal(a.length, b.length, 'same line count');
    const changed = [];
    a.forEach((line, i) => { if (line !== b[i]) changed.push({ i, before: line, after: b[i] }); });
    assert.equal(changed.length, 2, JSON.stringify(changed));
    for (const c of changed) {
      assert.match(c.before, /^\s*"(trigger\.sweepReclaim|zone\.fvg)": [\d.]+,?$/);
      assert.equal(c.before.replace(/: [\d.]+/, ''), c.after.replace(/: [\d.]+/, ''), 'only the number differs on that line');
    }
    const parsed = JSON.parse(out);
    assert.equal(parsed.czt.weights['trigger.sweepReclaim'], 4.5); assert.equal(parsed.czt.weights['zone.fvg'], 0.875); assert.equal(parsed.czt.weights['condition.killzone'], 1.5);
    const strip = (o) => { const c = structuredClone(o); delete c.czt.weights; return c; };
    assert.deepEqual(strip(parsed), strip(strategy));
    assert.equal(out.indexOf('"_comment"'), strategyText.indexOf('"_comment"'));
    assert.ok(out.endsWith(strategyText.slice(strategyText.indexOf('"minScore"'))), 'everything after the weights block is identical');
  });
  test('odd formatting survives: tabs, one-line objects, "3.0" spellings, a _note inside weights that names a key', () => {
    const text = '{\n\t"czt": {"weights": {"trigger.sweepReclaim": 3.0, "_note": "trigger.sweepReclaim: 3 is the prior", "zone.fvg":1 ,\n\t\t"trigger.absorption"\t:\t2e0}, "minScore": 6},\n\t"other": {"weights": {"trigger.sweepReclaim": 99}}\n}\n';
    const out = rewriteWeights(text, { 'trigger.sweepReclaim': 3.75, 'zone.fvg': 1, 'trigger.absorption': 2 });
    assert.equal(out, '{\n\t"czt": {"weights": {"trigger.sweepReclaim": 3.75, "_note": "trigger.sweepReclaim: 3 is the prior", "zone.fvg":1 ,\n\t\t"trigger.absorption"\t:\t2e0}, "minScore": 6},\n\t"other": {"weights": {"trigger.sweepReclaim": 99}}\n}\n');
    assert.ok(out.includes('"trigger.absorption"\t:\t2e0'), 'an unchanged value keeps its spelling');
    assert.ok(out.includes('"other": {"weights": {"trigger.sweepReclaim": 99}}'), 'only czt.weights is touched, not another weights object');
    const same = rewriteWeights(text, { 'trigger.sweepReclaim': 3 });
    assert.equal(same, text, '"3.0" → 3 is numerically equal: not rewritten, spelling kept');
  });
  test('refuses: a key missing from the block, a negative or non-numeric weight, no czt / weights object', () => {
    assert.throws(() => rewriteWeights(strategyText, { 'trigger.nope': 1 }), /not a number in strategy\.json|not found/);
    assert.throws(() => rewriteWeights(strategyText, { 'trigger.sweepReclaim': -1 }), RangeError);
    assert.throws(() => rewriteWeights(strategyText, { 'trigger.sweepReclaim': NaN }), RangeError);
    assert.throws(() => rewriteWeights('{"czt": {"minScore": 6}}', { a: 1 }), /no "weights"/);
    assert.throws(() => rewriteWeights('{"a": 1}', { a: 1 }), /no "czt"/);
    assert.throws(() => rewriteWeights(42, {}), TypeError);
  });
});

describe('CLI main()', () => {
  /** A temp project: a copy of strategy.json + a journal with `specs`. */
  function project(specs) {
    const data = join(dir, 'data'), strat = join(dir, 'strategy.json');
    writeJournal(data, specs);
    copyFileSync(STRATEGY_PATH, strat);
    return { data, strat, args: ['--dir', data, '--strategy', strat] };
  }
  const evidence = [
    ...Array.from({ length: 40 }, (_, i) => ({ resultR: i < 30 ? 2 : -1, hits: { trigger: ['sweepReclaim'] } })),   // expR 1.25 → clamp 1; k 40/70
    ...Array.from({ length: 5 }, () => ({ resultR: -1, hits: { trigger: ['absorption'] } })),
    { open: true },
  ];

  test('dry run: prints the table, writes <dir>/tune-proposal.json, leaves strategy.json byte-identical, exit 0', async () => {
    const { data, strat, args } = project(evidence);
    const o = io();
    const code = await main(args, { ...o, now: () => T0 });
    assert.equal(code, 0, o.err());
    assert.match(o.out(), /45 resolved setup\(s\)/);
    assert.match(o.out(), /trigger\.sweepReclaim\s+40\s+75%\s+\+1\.25\s+3\.00\s+→\s+4\.714/);
    assert.match(o.out(), /trigger\.absorption\s+5\s+0%\s+\u22121\.00\s+2\.00\s+→\s+2\.00\s+n < 30: kept/);
    assert.match(o.out(), /Dry run\. \d+ weight\(s\) would change — pass --apply --yes/);
    const proposalPath = join(data, 'tune-proposal.json');
    assert.ok(existsSync(proposalPath));
    const proposal = JSON.parse(readFileSync(proposalPath, 'utf8'));
    assert.equal(proposal.generatedAt, new Date(T0).toISOString());
    assert.equal(proposal.min, 30); assert.equal(proposal.k0, 30); assert.equal(proposal.resolved, 45);
    assert.equal(proposal.weights['trigger.sweepReclaim'], 4.714);
    assert.equal(proposal.weights['trigger.absorption'], 2);
    assert.equal(proposal.rows.find((r) => r.hit === 'trigger.sweepReclaim').applied, true);
    assert.equal(readFileSync(strat, 'utf8'), strategyText, 'a dry run never touches strategy.json');
    assert.equal(o.err(), '');
  });
  test('--apply without --yes: prints the diff, refuses with exit 2, strategy.json untouched', async () => {
    const { strat, args } = project(evidence);
    const o = io();
    const code = await main([...args, '--apply'], { ...o, now: () => T0 });
    assert.equal(code, 2);
    assert.match(o.out(), /Proposed changes to .*strategy\.json:\n(  [a-z]+\.\w+: [\d.]+ → [\d.]+\n)*  trigger\.sweepReclaim: 3 → 4\.714\n/);
    assert.ok(!o.out().includes('trigger.absorption:'), 'the diff lists only keys that change');
    assert.match(o.err(), /Refusing to rewrite strategy\.json without --yes/);
    assert.equal(readFileSync(strat, 'utf8'), strategyText);
    const o2 = io();
    assert.equal(await main([...args, '--yes'], { ...o2, now: () => T0 }), 0, '--yes alone is still a dry run');
    assert.match(o2.out(), /Dry run/);
    assert.equal(readFileSync(strat, 'utf8'), strategyText);
  });
  test('--apply --yes: rewrites ONLY the changed weights on the temp copy; every other line is byte-identical; the result validates and parses', async () => {
    const { strat, args } = project(evidence);
    const o = io();
    const code = await main([...args, '--apply', '--yes'], { ...o, now: () => T0 });
    assert.equal(code, 0, o.err());
    assert.match(o.out(), /Applied \d+ weight\(s\)/);
    const after = readFileSync(strat, 'utf8');
    assert.notEqual(after, strategyText);
    const a = strategyText.split('\n'), b = after.split('\n');
    assert.equal(a.length, b.length);
    const diffs = a.map((l, i) => [l, b[i]]).filter(([x, y]) => x !== y);
    assert.ok(diffs.length >= 1);
    for (const [x, y] of diffs) {
      assert.match(x, /^\s*"(condition|zone|trigger)\.\w+": [\d.]+,?$/, `only weight lines may differ: ${x}`);
      assert.equal(x.replace(/: [\d.]+/, ''), y.replace(/: [\d.]+/, ''));
    }
    const parsed = JSON.parse(after);
    assert.equal(parsed.czt.weights['trigger.sweepReclaim'], 4.714);
    assert.equal(parsed.czt.weights['trigger.absorption'], 2);
    const strip = (c) => { c = structuredClone(c); delete c.czt.weights; return c; };
    assert.deepEqual(strip(parsed), strip(strategy));
    // the condition hits every fixture setup carried moved too — and only those
    const changedKeys = diffs.map(([x]) => /"([^"]+)"/.exec(x)[1]);
    assert.ok(changedKeys.includes('trigger.sweepReclaim') && changedKeys.includes('condition.biasAligned') && changedKeys.includes('condition.killzone') && changedKeys.includes('zone.sessionHighLow'));
    assert.ok(!changedKeys.includes('trigger.absorption'));
    // running again on the already-tuned file: the journal is the same, so the proposal moves again (it is a fit, not a fixed point) — but with no evidence nothing moves
    const quiet = join(dir, 'quiet'); writeJournal(quiet, [{ resultR: 1 }]);
    const o3 = io();
    assert.equal(await main(['--dir', quiet, '--strategy', strat, '--apply', '--yes'], { ...o3, now: () => T0 }), 0);
    assert.match(o3.out(), /Nothing to apply/);
    assert.equal(readFileSync(strat, 'utf8'), after, 'byte-identical when nothing changes');
  });
  test('--min / --k / --symbol / --out / --no-write flags; bad inputs exit 1 with a message', async () => {
    const { data, strat, args } = project([
      ...Array.from({ length: 12 }, () => ({ resultR: 1, symbol: 'XAUUSD', hits: { trigger: ['absorption'] } })),
      ...Array.from({ length: 12 }, () => ({ resultR: -1, symbol: 'BTCUSD', hits: { trigger: ['absorption'] } })),
    ]);
    const o = io();
    assert.equal(await main([...args, '--min', '10', '--k', '0', '--symbol', 'XAUUSD', '--out', join(dir, 'p.json')], { ...o, now: () => T0 }), 0, o.err());
    const p = JSON.parse(readFileSync(join(dir, 'p.json'), 'utf8'));
    assert.equal(p.symbol, 'XAUUSD'); assert.equal(p.resolved, 12); assert.equal(p.k0, 0); assert.equal(p.min, 10);
    assert.equal(p.weights['trigger.absorption'], 4, 'k0 = 0, expR +1 → doubled');
    assert.ok(!existsSync(join(data, 'tune-proposal.json')), '--out moved the file');
    const o2 = io();
    assert.equal(await main([...args, '--no-write'], { ...o2, now: () => T0 }), 0);
    assert.ok(!existsSync(join(data, 'tune-proposal.json')));
    assert.ok(!o2.out().includes('proposal written'));
    for (const bad of [['--min', '0'], ['--min', 'x'], ['--k', '-1'], ['--bogus'], ['--strategy', join(dir, 'missing.json')]]) {
      const o3 = io();
      assert.equal(await main([...args, ...bad], { ...o3, now: () => T0 }), 1, bad.join(' '));
      assert.ok(o3.err().length > 0);
    }
    writeFileSync(join(dir, 'noweights.json'), '{"czt": {}}');
    const o4 = io();
    assert.equal(await main(['--dir', data, '--strategy', join(dir, 'noweights.json')], { ...o4 }), 1);
    assert.match(o4.err(), /no czt\.weights/);
    assert.equal(readFileSync(strat, 'utf8'), strategyText);
  });
  test('an empty or missing journal is a quiet dry run, not a crash; relative paths resolve against cwd', async () => {
    const o = io();
    mkdirSync(join(dir, 'empty'));
    assert.equal(await main(['--dir', 'empty', '--strategy', 'config/strategy.json'], { ...o, cwd: dir, now: () => T0 }), 1, 'no strategy.json under the temp cwd');
    copyFileSync(STRATEGY_PATH, join(dir, 'strategy.json'));
    const o2 = io();
    assert.equal(await main(['--dir', 'empty', '--strategy', 'strategy.json'], { ...o2, cwd: dir, now: () => T0 }), 0, o2.err());
    assert.match(o2.out(), /0 resolved setup\(s\)/);
    assert.match(o2.out(), /Dry run\. Nothing would change\./);
    assert.ok(existsSync(join(dir, 'empty', 'tune-proposal.json')));
    assert.equal(DEFAULTS.dir, 'data'); assert.ok(existsSync(join(ROOT, 'config', 'strategy.json')));
  });
});
