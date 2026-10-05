// test/risk.test.mjs — SPEC §4.8 / §8. Contracts are the four shipped ones from config/symbols.json;
// caps are the shipped config/strategy.json. All inputs are plain objects; `now` is always passed in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { size, rr, dailyCaps } from '../lib/engine/risk.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CFG = JSON.parse(readFileSync(resolve(HERE, '../config/strategy.json'), 'utf8'));
const SYMS = JSON.parse(readFileSync(resolve(HERE, '../config/symbols.json'), 'utf8')).symbols;
const contract = (id) => SYMS.find(s => s.id === id).contract;
const T = Date.UTC(2026, 0, 13, 8, 0);

test('size: $1000 at 1 % = $10 budget, units = riskUsd / |entry − stop|, lots = units / unitsPerLot floored to 0.01', () => {
  // BTC, unitsPerLot 1: 10 / 100 = 0.1 BTC = 0.1 lot
  assert.deepEqual(size({ balance: 1000, riskPct: 1, entry: 85300, stop: 85200, contract: contract('BTCUSD') }),
    { units: 0.1, lots: 0.1, riskUsd: 10, riskPct: 1, budgetUsd: 10, unitsPerLot: 1 });
  // Gold, 100 oz/lot: 10 / 2 = 5 oz = 0.05 lot
  const au = size({ balance: 1000, riskPct: 1, entry: 4146, stop: 4148, contract: contract('XAUUSD') });
  assert.deepEqual([au.units, au.lots, au.riskUsd, au.riskPct], [5, 0.05, 10, 1]);
  // NQ, 20/contract: 10 / 50 = 0.2 units = 0.01 lot exactly
  const nq = size({ balance: 1000, riskPct: 1, entry: 21000, stop: 20950, contract: contract('NQ1!') });
  assert.deepEqual([nq.units, nq.lots, nq.riskUsd], [0.2, 0.01, 10]);
  // Oil, 1000 bbl/lot: 10 / 0.5 = 20 bbl = 0.02 lot
  const cl = size({ balance: 1000, riskPct: 1, entry: 70, stop: 70.5, contract: contract('OIL') });
  assert.deepEqual([cl.units, cl.lots, cl.riskUsd], [20, 0.02, 10]);
  // direction does not matter — only the distance
  assert.equal(size({ balance: 1000, riskPct: 1, entry: 85200, stop: 85300, contract: contract('BTCUSD') }).units, 0.1);
});

test('size: flooring never rounds up; the realised risk is ≤ the budget and reported honestly', () => {
  const s = size({ balance: 1000, riskPct: 1, entry: 85320, stop: 85030, contract: contract('BTCUSD') }); // 10 / 290 = 0.03448
  assert.deepEqual([s.units, s.lots, s.riskUsd, s.riskPct], [0.03, 0.03, 8.7, 0.87]);
  assert.ok(s.riskUsd <= s.budgetUsd);
  const g = size({ balance: 2500, riskPct: 1.5, entry: 4100, stop: 4105.3, contract: contract('XAUUSD') }); // 37.5 / 5.3 / 100 = 0.0707…
  assert.equal(g.lots, 0.07); assert.equal(g.units, 7); assert.ok(Math.abs(g.riskUsd - 37.1) < 1e-9);
  // a lots value that is a float-noise hair under a step still floors to that step (0.1 / 0.01 = 9.999999…)
  assert.equal(size({ balance: 1000, riskPct: 1, entry: 100, stop: 90, contract: { unitsPerLot: 10 } }).lots, 0.1);
  // no contract → unitsPerLot 1
  assert.equal(size({ balance: 1000, riskPct: 1, entry: 100, stop: 99 }).units, 10);
});

test('size: refuses (units 0 + reason) when even 0.01 lot would risk more than the budget', () => {
  // NQ with a 100-point stop: 0.01 lot = 0.2 units × 100 = $20 > $10
  const r = size({ balance: 1000, riskPct: 1, entry: 21000, stop: 20900, contract: contract('NQ1!') });
  assert.deepEqual([r.units, r.lots, r.riskUsd, r.riskPct], [0, 0, 0, 0]);
  assert.match(r.reason, /minimum 0\.01 lot would risk \$20\.00 \(2\.00 %\) > budget \$10\.00 \(1 %\)/);
  // Oil with a $1.50 stop: 0.01 lot = 10 bbl × 1.5 = $15 > $10
  assert.match(size({ balance: 1000, riskPct: 1, entry: 70, stop: 71.5, contract: contract('OIL') }).reason, /\$15\.00/);
  // and the exact boundary is accepted: 0.01 lot risking exactly the budget
  assert.equal(size({ balance: 1000, riskPct: 1, entry: 70, stop: 71, contract: contract('OIL') }).lots, 0.01);
});

test('size: invalid inputs refuse instead of throwing or producing NaN', () => {
  const bad = [
    [{ balance: 0, riskPct: 1, entry: 1, stop: 0.9 }, /balance/],
    [{ balance: -5, riskPct: 1, entry: 1, stop: 0.9 }, /balance/],
    [{ balance: 1000, riskPct: 0, entry: 1, stop: 0.9 }, /riskPct/],
    [{ balance: 1000, riskPct: 1, entry: 1, stop: 1 }, /stop distance/],
    [{ balance: 1000, riskPct: 1, entry: NaN, stop: 1 }, /stop distance/],
    [{ balance: 1000, riskPct: 1, entry: 1, stop: undefined }, /stop distance/],
    [{ balance: 1000, riskPct: 1, entry: 1, stop: 0.9, contract: { unitsPerLot: 0 } }, /unitsPerLot/],
    [{ balance: Infinity, riskPct: 1, entry: 1, stop: 0.9 }, /balance/],
  ];
  for (const [args, re] of bad) {
    const r = size(args);
    assert.equal(r.units, 0, JSON.stringify(args)); assert.match(r.reason, re);
    assert.ok(Object.values(r).every(v => typeof v !== 'number' || Number.isFinite(v)));
  }
  assert.equal(size().units, 0);
});

test('rr: positive for a target beyond entry on either side, negative on the stop side, 0 when degenerate', () => {
  assert.equal(rr(100, 90, 120), 2);          // long 2 R
  assert.equal(rr(100, 110, 85), 1.5);        // short 1.5 R
  assert.equal(rr(100, 90, 95), -0.5);        // long target below entry
  assert.equal(rr(100, 110, 105), -0.5);      // short target above entry
  assert.equal(rr(100, 100, 120), 0);         // stop = entry
  assert.equal(rr(100, 90, NaN), 0);
  assert.equal(rr(undefined, 90, 120), 0);
  assert.ok(Math.abs(rr(85320, 85030, 85800) - 480 / 290) < 1e-12);
});

test('dailyCaps: clean state is allowed with the remaining budget reported', () => {
  const r = dailyCaps({ setupsToday: 1, lastSetupT: T - 36e5, openSetup: null, now: T }, CFG);
  assert.deepEqual(r, { allowed: true, reasons: [], setupsToday: 1, setupsLeft: 2, cooldownMsLeft: 0 });
  assert.deepEqual(dailyCaps({}, CFG), { allowed: true, reasons: [], setupsToday: 0, setupsLeft: 3, cooldownMsLeft: 0 });
});

test('dailyCaps: maxSetupsPerSymbolPerDay', () => {
  const r = dailyCaps({ setupsToday: 3, now: T }, CFG);
  assert.equal(r.allowed, false); assert.equal(r.setupsLeft, 0);
  assert.deepEqual(r.reasons, ['Daily cap reached: 3/3 setups for this symbol today']);
  assert.equal(dailyCaps({ setupsToday: 2, now: T }, CFG).allowed, true);
});

test('dailyCaps: cooldownMinutes uses the injected now and reports the minutes left', () => {
  const r = dailyCaps({ setupsToday: 1, lastSetupT: T - 10 * 60e3, now: T }, CFG);
  assert.equal(r.allowed, false); assert.equal(r.cooldownMsLeft, 20 * 60e3);
  assert.deepEqual(r.reasons, ['Cooldown: 20 min left of 30 since the last setup']);
  assert.equal(dailyCaps({ setupsToday: 1, lastSetupT: T - 30 * 60e3, now: T }, CFG).allowed, true, 'exactly 30 min → clear');
  assert.equal(dailyCaps({ setupsToday: 1, lastSetupT: T - 29 * 60e3 - 1, now: T }, CFG).reasons[0], 'Cooldown: 1 min left of 30 since the last setup');
  // no clock → the cooldown cannot be judged and is not applied (caller bug, caught here, not a market condition)
  assert.equal(dailyCaps({ setupsToday: 1, lastSetupT: T - 60e3 }, CFG).allowed, true);
  const noCd = structuredClone(CFG); noCd.czt.cooldownMinutes = 0;
  assert.equal(dailyCaps({ setupsToday: 1, lastSetupT: T - 1, now: T }, noCd).allowed, true);
});

test('dailyCaps: oneOpenPerSymbol names the open setup; config false disables it', () => {
  const r = dailyCaps({ openSetup: { id: 'XAUUSD-1-long' }, now: T }, CFG);
  assert.deepEqual(r.reasons, ['One open setup per symbol: XAUUSD-1-long is still open']);
  assert.deepEqual(dailyCaps({ openSetup: true, now: T }, CFG).reasons, ['One open setup per symbol']);
  const multi = structuredClone(CFG); multi.czt.oneOpenPerSymbol = false;
  assert.equal(dailyCaps({ openSetup: { id: 'x' }, now: T }, multi).allowed, true);
});

test('dailyCaps: account-level caps — maxOpenAcrossSymbols and dailyLossPct (from % or USD against risk.balance)', () => {
  assert.deepEqual(dailyCaps({ openAcrossSymbols: 2, now: T }, CFG).reasons, ['Max open across symbols reached: 2/2']);
  assert.equal(dailyCaps({ openAcrossSymbols: 1, now: T }, CFG).allowed, true);
  assert.deepEqual(dailyCaps({ dailyLossPct: 5, now: T }, CFG).reasons, ['Daily loss limit: down 5.00 % ≥ 5 % — no more setups today']);
  assert.deepEqual(dailyCaps({ dailyLossUsd: 60, now: T }, CFG).reasons, ['Daily loss limit: down 6.00 % ≥ 5 % — no more setups today']);
  assert.equal(dailyCaps({ dailyLossUsd: 49.99, now: T }, CFG).allowed, true);
  // every breached cap is listed, not just the first
  const all = dailyCaps({ setupsToday: 3, lastSetupT: T - 60e3, openSetup: { id: 'a' }, openAcrossSymbols: 2, dailyLossPct: 7, now: T }, CFG);
  assert.equal(all.allowed, false); assert.equal(all.reasons.length, 5);
  // an empty config caps nothing
  assert.equal(dailyCaps({ setupsToday: 99, lastSetupT: T, openSetup: { id: 'a' }, openAcrossSymbols: 9, dailyLossPct: 50, now: T }, {}).allowed, false, 'oneOpenPerSymbol defaults to true');
  assert.equal(dailyCaps({ setupsToday: 99, lastSetupT: T, openAcrossSymbols: 9, dailyLossPct: 50, now: T }, {}).allowed, true);
});
