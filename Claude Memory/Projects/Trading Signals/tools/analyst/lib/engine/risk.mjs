// lib/engine/risk.mjs — position sizing, reward:risk and the per-day / open-position caps.
// SPEC.md §4.8. Pure functions: no clock, no balance lookup — `now` and `balance` arrive as
// arguments so backtests and tests are deterministic. Nothing here places or sizes a real order;
// the executor reads the real balance (strategy.json risk._note).
//
// Sources: 05 §7 ("Invalidation-Based Stop Losses" — risk is measured to the invalidation point,
// the price that proves the thesis wrong, never to a round number); strategy.json risk caps mirror
// the executor (1 %/trade, 5 %/day).
//
// DEVIATION: none from §4.8 — additive only: size() also returns `budgetUsd` and `unitsPerLot`;
//   dailyCaps() returns `{allowed, reasons, setupsToday, setupsLeft, cooldownMsLeft}` (the spec
//   names the function but not its result shape). The cooldown needs `state.now` (injected clock,
//   never Date.now()); without a finite `now` the cooldown is not evaluated — a missing clock is a
//   caller bug the tests catch, not a market condition to block on.

const LOT_STEP = 0.01;                                   // minimum lot and lot granularity
const round8 = (x) => Math.round(x * 1e8) / 1e8;         // kill float noise after lots × unitsPerLot
const floorLots = (lots) => Math.floor(lots / LOT_STEP + 1e-9) * LOT_STEP; // 0.0344 → 0.03, never up

/**
 * Units to buy/sell so that a stop-out loses `riskPct` % of `balance`.
 * units = riskUsd / |entry − stop| in instrument units; lots = units / contract.unitsPerLot floored to
 * 0.01. BTC (unitsPerLot 1): units = riskUsd / |entry − stop| BTC. Gold (100 oz/lot): 0.05 lot = 5 oz.
 * Below 0.01 lot the trade is REFUSED (`units: 0` + `reason`) — the smallest ticket would already
 * risk more than the budget; the stop is never tightened to make it fit (source 01: the stop is
 * where the manipulation low is, full stop).
 * @returns {{units:number, lots:number, riskUsd:number, riskPct:number, budgetUsd?:number, unitsPerLot?:number, reason?:string}}
 */
export function size({ balance, riskPct, entry, stop, contract } = {}) {
  const unitsPerLot = contract?.unitsPerLot ?? 1;
  const refuse = (reason) => ({ units: 0, lots: 0, riskUsd: 0, riskPct: 0, reason });
  if (!(balance > 0) || !Number.isFinite(balance)) return refuse('balance must be a positive number');
  if (!(riskPct > 0) || !Number.isFinite(riskPct)) return refuse('riskPct must be a positive number');
  if (!(unitsPerLot > 0) || !Number.isFinite(unitsPerLot)) return refuse('contract.unitsPerLot must be a positive number');
  const dist = Math.abs(entry - stop);
  if (!Number.isFinite(dist) || dist <= 0) return refuse('stop distance must be > 0 (entry and stop must differ)');
  const budgetUsd = balance * riskPct / 100;
  const lots = floorLots(budgetUsd / dist / unitsPerLot);
  if (lots < LOT_STEP) {
    const minRiskUsd = LOT_STEP * unitsPerLot * dist;
    return {
      ...refuse(`minimum ${LOT_STEP} lot would risk $${minRiskUsd.toFixed(2)} (${(minRiskUsd / balance * 100).toFixed(2)} %) > budget $${budgetUsd.toFixed(2)} (${riskPct} %)`),
      budgetUsd, unitsPerLot,
    };
  }
  const units = round8(lots * unitsPerLot);
  const riskUsd = round8(units * dist);
  return { units, lots: round8(lots), riskUsd, riskPct: round8(riskUsd / balance * 100), budgetUsd, unitsPerLot };
}

/**
 * Reward:risk of a target. Signed so direction is implicit: long (stop < entry < target) and short
 * (target < entry < stop) are both positive; a target on the stop's side is negative; a degenerate
 * stop (= entry) or a non-number yields 0 so `rr ≥ minRr` can never pass by accident.
 */
export function rr(entry, stop, target) {
  if (![entry, stop, target].every(Number.isFinite)) return 0;
  const risk = entry - stop;
  if (risk === 0) return 0;
  return (target - entry) / risk;
}

/**
 * The per-symbol / per-account caps czt.mjs consults before emitting a Setup.
 * state = { setupsToday, lastSetupT, openSetup, openAcrossSymbols?, dailyLossPct? | dailyLossUsd?, now }
 * cfg   = the strategy config (reads cfg.czt.* and cfg.risk.*).
 * @returns {{allowed:boolean, reasons:string[], setupsToday:number, setupsLeft:number, cooldownMsLeft:number}}
 */
export function dailyCaps(state = {}, cfg = {}) {
  const czt = cfg.czt ?? {}, risk = cfg.risk ?? {};
  const reasons = [];
  const maxPerDay = Number.isFinite(czt.maxSetupsPerSymbolPerDay) ? czt.maxSetupsPerSymbolPerDay : Infinity;
  const setupsToday = Number.isFinite(state.setupsToday) ? state.setupsToday : 0;
  if (setupsToday >= maxPerDay) reasons.push(`Daily cap reached: ${setupsToday}/${maxPerDay} setups for this symbol today`);

  const cdMs = (Number.isFinite(czt.cooldownMinutes) ? czt.cooldownMinutes : 0) * 60e3;
  let cooldownMsLeft = 0;
  if (cdMs > 0 && Number.isFinite(state.lastSetupT) && Number.isFinite(state.now)) {
    cooldownMsLeft = Math.max(0, state.lastSetupT + cdMs - state.now);
    if (cooldownMsLeft > 0) reasons.push(`Cooldown: ${Math.ceil(cooldownMsLeft / 60e3)} min left of ${czt.cooldownMinutes} since the last setup`);
  }

  if ((czt.oneOpenPerSymbol ?? true) && state.openSetup) {
    const id = typeof state.openSetup === 'object' ? state.openSetup.id : null;
    reasons.push(`One open setup per symbol${id ? `: ${id} is still open` : ''}`);
  }

  if (Number.isFinite(risk.maxOpenAcrossSymbols) && (state.openAcrossSymbols ?? 0) >= risk.maxOpenAcrossSymbols)
    reasons.push(`Max open across symbols reached: ${state.openAcrossSymbols}/${risk.maxOpenAcrossSymbols}`);

  if (Number.isFinite(risk.dailyLossPct)) {
    const lostPct = Number.isFinite(state.dailyLossPct) ? state.dailyLossPct
      : Number.isFinite(state.dailyLossUsd) && risk.balance > 0 ? state.dailyLossUsd / risk.balance * 100 : 0;
    if (lostPct >= risk.dailyLossPct) reasons.push(`Daily loss limit: down ${lostPct.toFixed(2)} % ≥ ${risk.dailyLossPct} % — no more setups today`);
  }

  return { allowed: reasons.length === 0, reasons, setupsToday, setupsLeft: Math.max(0, maxPerDay - setupsToday), cooldownMsLeft };
}
