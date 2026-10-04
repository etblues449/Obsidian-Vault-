// Feed adapter contract. Every market-data source implements this and nothing else
// in the engine knows where candles come from. See SPEC.md §3.
//
// Events (all payloads are plain objects, never class instances):
//   'history' { symbol, candles: Candle[] }           — once after connect, oldest→newest, 1m, all closed
//   'candle'  { symbol, candle: Candle }               — the forming 1m candle (closed=false) or its final
//                                                        print (closed=true). Same `t` repeats until closed.
//   'trade'   { symbol, trade: Trade }                 — aggressor-tagged trade, when the source has it
//   'status'  { symbol, state, detail? }               — state ∈ 'connecting'|'live'|'delayed'|'sim'|
//                                                        'reconnecting'|'error'|'closed'
//
// Candle: { t:number(ms, open), o,h,l,c:number, v:number, buyV?:number, sellV?:number, n?:number, closed:boolean }
// Trade:  { t:number(ms), p:number, q:number, side:'buy'|'sell' }   // side = AGGRESSOR side

import { EventEmitter } from 'node:events';

export class FeedAdapter extends EventEmitter {
  /** @param {{id:string, feedParams?:object}} symbol  @param {object} [opts] */
  constructor(symbol, opts = {}) {
    super();
    this.symbol = symbol;
    this.opts = opts;
    this.state = 'connecting';
    this.kind = 'unknown'; // 'live' | 'delayed' | 'sim' — what the data IS, independent of connection state
  }

  /** Start producing events. Must never throw synchronously; errors become 'status' events. */
  async connect() { throw new Error('connect() not implemented'); }

  /** Stop everything: sockets, timers. Idempotent. */
  async close() { throw new Error('close() not implemented'); }

  /** Helper: set state and emit a status event. */
  setStatus(state, detail) {
    this.state = state;
    this.emit('status', { symbol: this.symbol.id, state, detail });
  }
}

/** Shared exponential backoff: 1s, 2s, 4s … capped, with ±20 % jitter supplied by the caller. */
export function backoffMs(attempt, { base = 1000, cap = 60000, jitter = 0 } = {}) {
  const raw = Math.min(cap, base * Math.pow(2, Math.max(0, attempt)));
  return Math.round(raw * (1 + jitter));
}
