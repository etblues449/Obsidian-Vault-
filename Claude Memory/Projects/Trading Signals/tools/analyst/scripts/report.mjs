#!/usr/bin/env node
// scripts/report.mjs — the markdown scorecard digest (SPEC.md §1): by trigger, by symbol, by session (and
// grade) + the last 20 setups, printed to stdout and written to data/reports/YYYY-MM-DD.md.
//   node scripts/report.mjs [--symbol XAUUSD] [--limit 20] [--no-write] [--out path.md]
// Reads the journal exactly as the server does (lib/journal.mjs load()), so numbers match the dashboard.

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadConfig } from '../lib/config.mjs';
import { createJournal } from '../lib/journal.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fmt = (x, dp = 2) => (typeof x === 'number' && Number.isFinite(x) ? x.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp }) : '—');
const signed = (x, dp = 2) => (typeof x === 'number' && Number.isFinite(x) ? (x > 0 ? '+' : '') + x.toFixed(dp) : '—');
const when = (t, tz) => (Number.isFinite(t) ? new Intl.DateTimeFormat('en-GB', { timeZone: tz, dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(t)) : '—');

export function scorecardMarkdown(title, rows) {
  const out = [`### ${title}`, ''];
  if (!rows.length) return [...out, '_No resolved setups yet._', ''].join('\n');
  out.push('| key | n | wins | win % | exp R | PF | max DD | avg R:R | net R | CI 95 % |', '|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|');
  for (const r of rows) out.push(`| ${r.key} | ${r.n} | ${r.wins} | ${fmt(r.winRate * 100, 0)} | ${signed(r.expectancyR)} | ${r.profitFactor == null ? '∞' : fmt(r.profitFactor)} | ${fmt(r.maxDdR)} | ${fmt(r.avgRr)} | ${signed(r.netR)} | ${fmt(r.ci95[0] * 100, 0)}–${fmt(r.ci95[1] * 100, 0)} |`);
  return [...out, ''].join('\n');
}

export function setupsMarkdown(setups, { tz, dpOf }) {
  const out = ['### Last setups', ''];
  if (!setups.length) return [...out, '_None journaled yet._', ''].join('\n');
  out.push('| time | symbol | side | grade | score | entry | stop | T1 | R:R | trigger | result |', '|---|---|---|---|--:|--:|--:|--:|--:|---|---|');
  for (const s of setups) {
    const dp = dpOf(s.symbol);
    const result = s.status === 'open' ? 'open' : `${s.status} ${signed(s.resultR)}R${s.ambiguous ? ' (ambiguous)' : ''}`;
    out.push(`| ${when(s.t, tz)} | ${s.symbol} | ${s.side} | ${s.grade} | ${fmt(s.score, 1)} | ${fmt(s.entry, dp)} | ${fmt(s.stop, dp)} | ${fmt(s.targets?.[0]?.price, dp)} | ${fmt(s.rr)} | ${s.trigger?.kind ?? '—'} | ${result} |`);
  }
  return [...out, ''].join('\n');
}

export function buildReport({ cfg, symbolsCfg, journal, symbol, limit = 20, now = Date.now() }) {
  const tz = cfg.sessions.timezone;
  const dpOf = (id) => symbolsCfg.symbols.find((s) => s.id === id)?.dp ?? 2;
  const all = journal.scorecard({ by: 'all', symbol });
  const total = all[0] ?? { n: 0, wins: 0, netR: 0, expectancyR: 0 };
  const open = journal.open(symbol).length;
  const parts = [
    `# TradeGuard Analyst — scorecard ${new Date(now).toISOString().slice(0, 10)}${symbol ? ` · ${symbol}` : ''}`, '',
    `Generated ${when(now, tz)} (${tz}). ${total.n} resolved setup(s), ${total.wins} won, net ${signed(total.netR)}R, expectancy ${signed(total.expectancyR)}R/trade, ${open} open. Analysis only — nothing here places orders.`, '',
    scorecardMarkdown('By trigger', journal.scorecard({ by: 'trigger', symbol })),
    scorecardMarkdown('By symbol', journal.scorecard({ by: 'symbol', symbol })),
    scorecardMarkdown('By session', journal.scorecard({ by: 'session', symbol })),
    scorecardMarkdown('By grade', journal.scorecard({ by: 'grade', symbol })),
    setupsMarkdown(journal.list({ symbol, limit }), { tz, dpOf }),
  ];
  return parts.join('\n');
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const { values } = parseArgs({ args: argv, options: { symbol: { type: 'string' }, limit: { type: 'string', default: '20' }, write: { type: 'boolean', default: true }, out: { type: 'string' } }, allowNegative: true });
  const { cfg, symbolsCfg } = loadConfig({ env });
  const dir = resolve(ROOT, cfg.journal.dir);
  const journal = createJournal({ cfg, dir, now: () => Date.now() });
  const counts = journal.load();
  if (counts.malformed) process.stderr.write(`warning: ${counts.malformed} unreadable journal line(s) skipped\n`);
  const md = buildReport({ cfg, symbolsCfg, journal, symbol: values.symbol, limit: Number(values.limit) || 20 });
  process.stdout.write(md);
  if (values.write) {
    const file = values.out ? resolve(values.out) : join(dir, 'reports', `${new Date().toISOString().slice(0, 10)}.md`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, md);
    process.stderr.write(`written ${file}\n`);
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code), (e) => { process.stderr.write(`report failed: ${e.message}\n`); process.exit(1); });
}
