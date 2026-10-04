// lib/feeds/registry.mjs — adapter name → class, and the one factory the orchestrator calls (SPEC.md §3).
//   createFeed(symbolCfg, globalCfg, deps) → adapter instance (not yet connected)
// `globalCfg` = { cfg (strategy), symbolsCfg (symbols.json), log? }; `deps` lets tests inject
// { fetch, WebSocket, now, setTimeout, clearTimeout, setInterval, clearInterval, random }.
// The replay adapter takes its candles from symbolCfg.feedParams (backtest.mjs builds that entry).

import { BinanceFeed } from './binance.mjs';
import { SimulatedFeed } from './simulated.mjs';
import { YahooFeed } from './yahoo.mjs';
import { ReplayFeed } from './replay.mjs';

export const FEEDS = { binance: BinanceFeed, simulated: SimulatedFeed, yahoo: YahooFeed, replay: ReplayFeed };

export function createFeed(symbolCfg, globalCfg = {}, deps = {}) {
  const Feed = FEEDS[symbolCfg?.feed];
  if (!Feed) throw new RangeError(`unknown feed adapter ${JSON.stringify(symbolCfg?.feed)} for ${symbolCfg?.id} (known: ${Object.keys(FEEDS).join(', ')})`);
  const cfg = globalCfg.cfg || {};
  const log = globalCfg.log && typeof globalCfg.log.child === 'function' ? globalCfg.log.child(symbolCfg.id) : globalCfg.log ?? null;
  const backfillMinutes = cfg.history?.backfillMinutes;
  switch (symbolCfg.feed) {
    case 'binance': return new BinanceFeed(symbolCfg, { backfillMinutes, log }, deps);
    case 'simulated': return new SimulatedFeed(symbolCfg, { backfillMinutes, log }, deps);
    case 'yahoo': return new YahooFeed(symbolCfg, { ...(globalCfg.symbolsCfg?.feedDefaults?.yahoo || {}), log }, deps);
    case 'replay': return new ReplayFeed(symbolCfg, { ...(symbolCfg.feedParams || {}) }, deps);
    default: return new Feed(symbolCfg, {}, deps);
  }
}
