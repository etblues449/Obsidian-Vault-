/* TradeGuard Analyst — Pro panel (SPEC-PRO §P7). Plain script loaded AFTER app.js; same rules: framework-free,
   same-origin only, never throws on a missing field (every read of server data goes through num()/str()/arr()),
   errors render as one line in #proMsg. LIGHT THEME ONLY — colours come from app.css tokens via pro.css.

   Data flow:
     GET /api/pro/:symbol                 initial snapshot (on load and on every active-symbol change)
     SSE 'footprint' { symbol, tf, footprint }   one per closed analysis-TF candle → replace/append column
     SSE 'book'      { symbol, summary }         ≤ 1/s → ladder, meter, chips (rendered on the next frame)
     document 'tradeguard:state' { active }      app.js renderAll() hook → symbol change / hits refresh
     document 'tradeguard:sse'   { source }      app.js openSse() hook → attach to the ONE shared EventSource
   Shape expected from /api/pro/:symbol (SPEC-PRO §P6 "both plus trapped and the czt pro hits, in one call"):
     { symbol, tf, bucket, partial, footprints: Footprint[],
       book: { summary: BookSummary|null, history: BookSummary[], reason?: string },
       trapped: { side, t, levels, edge, close, reason } | null,
       hits: { footprintImbalance, trappedTraders, bookAbsorption, unfinishedAuction, bookImbalance } (booleans) }
     Tolerated variants (the integrator may still be wiring this): footprints under `footprint.footprints`;
     `summary`/`history`/`reason` at the top level instead of under `book`; `hits` as a string array, as
     { condition: [...], trigger: [...] }, or absent — then the strip falls back to the active symbol's czt hits
     from window.TradeGuard.state (the same hits the CZT panel shows).

   Source 05 (docs/sources/05-order-flow-masterclass.md) is the authority for what is drawn:
     §3 Footprint (Bid × Ask): per price level, bid = volume where the SELLER aggressed (hit the bid), ask =
        the BUYER lifted the ask; imbalance = aggressive volume DIAGONALLY exceeding the opposing volume by the
        ratio (300 %); unfinished auction = the bar's high/low printed volume on BOTH sides (no clean 0).
     §4 Trapped traders: "a trapped buyer's stop loss is a market sell order" — the engine's reason line is shown verbatim.
     §2 Resting flow: the DOM "can be modified, moved, or canceled (spoofing) at any moment … Never treat a large
        resting limit wall as a guaranteed bounce" — hence the tooltip "visible top of book, not level 3" and the
        pulled / absorbed / eaten chips: what the TAPE did to a wall, not the wall itself.

   DEVIATION: the show/hide pill persists ONE preference (localStorage 'tradeguard.pro'); with no preference stored
     the default follows §P7 — shown when the active symbol's feed is live, hidden for sim / replay / delayed feeds.
   DEVIATION: the footprint's shared price scale is capped at MAX_ROWS (90) rows around the latest candle so a
      5000-level truncated footprint (footprint.mjs DEVIATION) cannot build a 60 000-cell table on a phone.
   DEVIATION: the `p` key toggles the Pro panel (the footer lists it) — §P7 names only the pill. */
(() => {
  'use strict';

  const COLS = 12;                 // §P7: "the last 12 analysis-TF candles as columns"
  const MAX_ROWS = 90;             // shared price scale cap (see DEVIATION)
  const STORE_KEY = 'tradeguard.pro';
  // The five Pro hits (§P5) in czt.weights order, labelled in source-document language, with their layer.
  const PRO_HITS = [
    ['footprintImbalance', 'trigger', 'Stacked footprint imbalance — aggressive side stepping in at the zone'],
    ['trappedTraders', 'trigger', 'Trapped traders — their stops are market orders'],
    ['bookAbsorption', 'trigger', 'Absorption at a book wall — tape hit it, it held'],
    ['unfinishedAuction', 'trigger', 'Unfinished auction — target-side magnet (confirmation only)'],
    ['bookImbalance', 'condition', 'Depth imbalance ≥ 25 % in the side\'s favour'],
  ];

  // ---------- helpers (mirrors app.js; kept local so pro.js has no load-order dependency on app.js internals) ----------
  const $ = (id) => document.getElementById(id);
  const num = (v, d = null) => (typeof v === 'number' && Number.isFinite(v) ? v : (typeof v === 'string' && v !== '' && Number.isFinite(+v) ? +v : d));
  const str = (v, d = '') => (v == null ? d : String(v));
  const arr = (v) => (Array.isArray(v) ? v : []);
  const obj = (v) => (v && typeof v === 'object' ? v : {});
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode — a convenience only */ } },
  };
  const LDN = (() => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour12: false, hour: '2-digit', minute: '2-digit' }); } catch { return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour12: false, hour: '2-digit', minute: '2-digit' }); } })();
  const fmtHm = (ms) => (num(ms) == null ? '—' : LDN.format(new Date(ms)));
  const fmtPrice = (v, dp = 2) => (num(v) == null ? '—' : v.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp }));
  // Executed quantity (base units): compact, 3 significant-ish digits — a BTC footprint cell reads "12.4 × 3.08".
  const fmtQty = (v) => { v = num(v); if (v == null) return '—'; const a = Math.abs(v); const s = a === 0 ? '0' : a >= 1e6 ? (a / 1e6).toFixed(2) + 'M' : a >= 1e4 ? (a / 1e3).toFixed(1) + 'K' : a >= 100 ? a.toFixed(0) : a >= 10 ? a.toFixed(1) : a >= 1 ? a.toFixed(2) : a.toFixed(3); return (v < 0 ? '−' : '') + s; };
  const fmtSignedQty = (v) => (num(v) == null ? '—' : (v > 0 ? '+' : '') + fmtQty(v));
  const fmtAge = (ms) => { ms = num(ms); if (ms == null) return ''; const s = Math.round(ms / 1000); return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m${s % 60 ? (s % 60) + 's' : ''}` : `${Math.floor(s / 3600)}h`; };
  const TG = () => obj(window.TradeGuard);
  const activeSym = () => { const S = obj(TG().state); return arr(S.symbols).find((s) => s && s.id === S.active) || null; };
  const dpOf = () => num(obj(activeSym()).dp, 2);

  // ---------- state ----------
  const P = {
    symbol: null, tf: null, bucket: null, partial: false,
    footprints: [],            // closed footprints oldest→newest (≤ COLS)
    book: null, bookReason: '', trapped: null, hits: null,
    req: 0, bookFrame: 0, pendingBook: null, shown: null, sse: null, msg: '',
  };

  // ---------- visibility (persisted pill) ----------
  function defaultShown() { const f = obj(obj(activeSym()).feed); const k = str(f.kind) || str(f.state); return k === 'live'; }
  function isShown() { const v = store.get(STORE_KEY); return v === '1' ? true : v === '0' ? false : defaultShown(); }
  function applyShown() {
    const shown = isShown(); P.shown = shown;
    $('proBody').hidden = !shown;
    const b = $('proToggle'); b.setAttribute('aria-pressed', String(shown)); b.classList.toggle('is-active', shown); b.textContent = shown ? 'Pro' : 'Pro off';
    if (shown && P.pendingBook) renderBook();
  }
  function toggle() { store.set(STORE_KEY, isShown() ? '0' : '1'); applyShown(); }

  // ---------- messages ----------
  function message(text) { P.msg = str(text); const m = $('proMsg'); m.textContent = P.msg; m.hidden = !P.msg; }

  // ---------- HTTP ----------
  async function api(path) {
    const r = await fetch(path, { cache: 'no-store', credentials: 'same-origin' });
    const body = await r.json().catch(() => null);
    if (!r.ok) throw new Error(str(obj(body).error, `${r.status} ${r.statusText}`.trim()));
    return body;
  }
  async function load(symbolId) {
    const req = ++P.req;
    try {
      const d = obj(await api(`/api/pro/${encodeURIComponent(symbolId)}`));
      if (req !== P.req) return;                                       // a newer symbol superseded this one
      const fps = arr(d.footprints).length ? d.footprints : arr(obj(d.footprint).footprints);
      P.tf = str(d.tf, str(obj(d.footprint).tf)); P.bucket = num(d.bucket, num(obj(d.footprint).bucket));
      P.footprints = arr(fps).filter((f) => f && num(f.t) != null).sort((a, b) => a.t - b.t).slice(-COLS);
      P.partial = !!(d.partial || obj(d.footprint).partial || P.footprints.some((f) => f.partial));
      const book = 'book' in d ? obj(d.book) : d;
      P.book = book.summary && typeof book.summary === 'object' ? book.summary : null;
      P.bookReason = str(book.reason, P.book ? '' : 'No order book for this feed.');
      P.trapped = d.trapped && typeof d.trapped === 'object' ? d.trapped : null;
      P.hits = d.hits == null ? null : d.hits;
      message('');
      renderFootprint(); renderBook(); renderHits();
    } catch (e) {
      if (req !== P.req) return;
      P.footprints = []; P.book = null; P.trapped = null; P.hits = null; P.partial = false;
      message(`Pro data unavailable — /api/pro/${symbolId}: ${str(e && e.message, e)}`);
      renderFootprint(); renderBook(); renderHits();
    }
  }

  // ---------- footprint (source 05 §3) ----------
  function levelMap(fp) { const m = new Map(); for (const l of arr(fp.levels)) { const p = num(obj(l).price); if (p != null) m.set(p, l); } return m; }
  function renderFootprint() {
    const table = $('fpTable'); const meta = $('fpMeta'); const badge = $('proPartial'); const trappedEl = $('fpTrapped');
    badge.hidden = !P.partial;
    const fps = P.footprints; const dp = dpOf();
    const tr = obj(P.trapped);
    if (tr.side && (tr.reason || arr(tr.levels).length)) {
      trappedEl.hidden = false; trappedEl.className = `fp-trapped ${tr.side === 'bearish' ? 'bearish' : tr.side === 'bullish' ? 'bullish' : ''}`;
      trappedEl.textContent = str(tr.reason, `Trapped ${tr.side === 'bearish' ? 'buyers' : 'sellers'} at ${fmtPrice(num(tr.edge, num(arr(tr.levels)[0])), dp)} — their stops are market ${tr.side === 'bearish' ? 'sells' : 'buys'}`);
    } else { trappedEl.hidden = true; trappedEl.textContent = ''; }
    if (!fps.length) {
      meta.textContent = '';
      table.replaceChildren(el('tbody')); table.tBodies[0].appendChild(el('tr')).appendChild(el('td', 'muted fp-empty', P.msg ? 'No footprints.' : 'Waiting for footprints — the first column appears when an analysis candle closes.'));
      return;
    }
    const bucket = num(P.bucket, num(fps[fps.length - 1].bucket));
    meta.textContent = `${str(P.tf, str(fps[fps.length - 1].tf))} · bucket ${bucket == null ? '—' : fmtPrice(bucket, dp)} · last ${COLS}`;
    // Shared price scale: the union of all level prices across the columns, descending, capped around the latest close.
    const maps = fps.map(levelMap);
    let prices = [...new Set(maps.flatMap((m) => [...m.keys()]))].sort((a, b) => b - a);
    if (prices.length > MAX_ROWS) {
      const last = fps[fps.length - 1]; const anchor = num(last.close, num(last.poc, prices[Math.floor(prices.length / 2)]));
      let i = prices.findIndex((p) => p <= anchor); if (i < 0) i = prices.length - 1;
      const from = clamp(i - Math.floor(MAX_ROWS / 2), 0, Math.max(0, prices.length - MAX_ROWS));
      prices = prices.slice(from, from + MAX_ROWS);
    }
    // Per column: imbalance side per price, stacked side per price, extremes, POC.
    const cols = fps.map((fp, ci) => {
      const imb = new Map(); for (const i of arr(fp.imbalances)) { const p = num(obj(i).price); if (p == null) continue; const s = str(i.side); imb.set(p, imb.has(p) && imb.get(p) !== s ? 'both' : s); }
      const stk = new Map(); for (const s of arr(fp.stacked)) { const from = num(obj(s).from), to = num(s.to); if (from == null || to == null) continue; for (const p of prices) if (p >= Math.min(from, to) - 1e-9 && p <= Math.max(from, to) + 1e-9) stk.set(p, stk.has(p) && stk.get(p) !== s.side ? 'both' : str(s.side)); }
      const lv = [...maps[ci].keys()]; const hi = lv.length ? Math.max(...lv) : null, lo = lv.length ? Math.min(...lv) : null;
      return { fp, m: maps[ci], imb, stk, hi, lo, poc: num(fp.poc) };
    });
    const thead = el('thead'); const hr = el('tr'); hr.appendChild(el('th', 'px', 'price'));
    cols.forEach((c, i) => { const th = el('th', `${i === cols.length - 1 ? 'cur' : ''}${c.fp.partial ? ' partial' : ''}`.trim(), fmtHm(c.fp.t)); th.title = `${fmtHm(c.fp.t)} London · ${num(c.fp.nTrades, 0)} trades${c.fp.partial ? ' · partial history' : ''}${c.fp.truncated ? ' · ladder truncated' : ''}`; hr.appendChild(th); });
    thead.appendChild(hr);
    const tbody = el('tbody');
    for (const p of prices) {
      const row = el('tr'); const px = el('td', 'px', fmtPrice(p, dp)); row.appendChild(px);
      for (const c of cols) {
        const l = c.m.get(p);
        if (!l) { row.appendChild(el('td', 'c z', '·')); continue; }
        const bid = num(l.bid, 0), ask = num(l.ask, 0);
        const td = el('td', 'c');
        if (bid === 0 && ask === 0) td.classList.add('z');
        const imb = c.imb.get(p); if (imb === 'buy' || imb === 'both') td.classList.add('imb-buy'); if (imb === 'sell' || imb === 'both') td.classList.add('imb-sell');
        const stk = c.stk.get(p); if (stk === 'buy' || stk === 'both') td.classList.add('stk-buy'); if (stk === 'sell' || stk === 'both') td.classList.add('stk-sell');
        if (c.poc != null && Math.abs(c.poc - p) < 1e-9) td.classList.add('poc');
        const uf = (c.fp.unfinishedHigh && c.hi != null && Math.abs(c.hi - p) < 1e-9) ? '▲' : (c.fp.unfinishedLow && c.lo != null && Math.abs(c.lo - p) < 1e-9) ? '▼' : '';
        if (uf) { const u = el('span', 'uf', uf); u.title = 'Unfinished auction — both sides printed at the extreme (source 05 §3)'; td.appendChild(u); }
        td.append(el('span', 'b', fmtQty(bid)), el('span', 'x', '×'), el('span', 'a', fmtQty(ask)));
        const bits = [`${fmtPrice(p, dp)}: bid ${fmtQty(bid)} × ask ${fmtQty(ask)} · Δ ${fmtSignedQty(ask - bid)}`];
        if (imb) bits.push(imb === 'both' ? 'buy + sell imbalance' : `${imb} imbalance (≥ 300 % diagonal)`); if (stk) bits.push(`stacked ${stk}`); if (td.classList.contains('poc')) bits.push('POC');
        td.title = bits.join(' · ');
        row.appendChild(td);
      }
      tbody.appendChild(row);
    }
    const tfoot = el('tfoot');
    const dRow = el('tr'); dRow.appendChild(el('td', 'px', 'Δ'));
    const tRow = el('tr'); tRow.appendChild(el('td', 'px', 'total'));
    for (const c of cols) {
      const d = num(c.fp.delta, num(c.fp.totalAsk, 0) - num(c.fp.totalBid, 0)); const t = num(c.fp.total, num(c.fp.totalAsk, 0) + num(c.fp.totalBid, 0));
      dRow.appendChild(el('td', d > 0 ? 'pos' : d < 0 ? 'neg' : '', fmtSignedQty(d))); tRow.appendChild(el('td', '', fmtQty(t)));
    }
    tfoot.append(dRow, tRow);
    table.replaceChildren(thead, tbody, tfoot);
    // keep the newest column in view on a phone (the table is wider than the panel; the PANEL scrolls, never the page)
    const sc = $('fpScroll'); if (sc && sc.scrollWidth > sc.clientWidth && !P.userScrolledFp) sc.scrollLeft = sc.scrollWidth;
  }
  function applyFootprintEvent(m) {
    m = obj(m); if (str(m.symbol) !== P.symbol) return;
    const fp = obj(m.footprint); if (num(fp.t) == null) return;
    if (P.tf && m.tf && str(m.tf) !== P.tf) return;                   // another TF's footprint is not this panel's
    const i = P.footprints.findIndex((f) => f.t === fp.t);
    if (i >= 0) P.footprints[i] = fp; else { P.footprints.push(fp); P.footprints.sort((a, b) => a.t - b.t); if (P.footprints.length > COLS) P.footprints.splice(0, P.footprints.length - COLS); }
    if (fp.partial) P.partial = true;
    if (m.trapped !== undefined) P.trapped = m.trapped && typeof m.trapped === 'object' ? m.trapped : null;
    if (P.shown) renderFootprint();
  }

  // ---------- order book (source 05 §2) ----------
  function renderBook() {
    P.pendingBook = null;
    const ladder = $('domLadder'); const chips = $('domChips'); const fill = $('domMeterFill'); const text = $('domMeterText'); const spreadEl = $('domSpread');
    const b = P.book; const dp = dpOf();
    if (!b) {
      ladder.replaceChildren(el('div', 'muted dom-empty', P.bookReason || (P.msg ? 'No order book.' : 'Waiting for the order book…')));
      chips.replaceChildren(); fill.style.width = '50%'; text.textContent = '—'; spreadEl.textContent = '';
      return;
    }
    const lv = obj(b.levels); const asks = arr(lv.asks).filter((l) => l && num(l.price) != null), bids = arr(lv.bids).filter((l) => l && num(l.price) != null);
    const maxQ = Math.max(1e-12, ...asks.map((l) => num(l.qty, 0)), ...bids.map((l) => num(l.qty, 0)));
    const wallAt = new Map(); for (const w of arr(b.walls)) { const o = obj(w); if (num(o.price) != null) wallAt.set(`${str(o.side)}:${o.price}`, o); }
    const absorbedAt = new Set(arr(b.absorbed).map((a) => `${str(obj(a).side)}:${num(obj(a).price)}`));
    const frag = document.createDocumentFragment();
    const row = (l, side, best) => {
      const q = num(l.qty, 0); const w = wallAt.get(`${side}:${num(l.price)}`);
      const r = el('div', `dom-row ${side}${w ? ' wall' : ''}${best ? ' best' : ''}${w && absorbedAt.has(`${side}:${num(l.price)}`) ? ' absorbed' : ''}`);
      const bar = el('i', 'bar'); bar.style.width = `${clamp((q / maxQ) * 100, 0, 100)}%`;
      r.append(bar, el('span', 'p', fmtPrice(l.price, dp)), el('span', 'q', fmtQty(q)), el('span', 'w', w ? `${Math.round(num(w.mult, 0))}×` : ''));
      r.title = `${side === 'ask' ? 'Ask' : 'Bid'} ${fmtPrice(l.price, dp)} · ${fmtQty(q)}${w ? ` · WALL ${num(w.mult, 0).toFixed(1)}× median, standing ${fmtAge(w.ageMs)}${num(w.tradedQty) ? `, ${fmtQty(w.tradedQty)} traded into it` : ''}${num(w.refills) ? `, refilled ×${w.refills}` : ''}` : ''} — visible top of book, not level 3`;
      return r;
    };
    // asks: far-from-touch at the top, best ask just above the spread row; bids: best bid first, then deeper
    [...asks].reverse().forEach((l, i, a) => frag.appendChild(row(l, 'ask', i === a.length - 1)));
    const sp = el('div', 'dom-spread', `spread ${num(b.spread) == null ? '—' : fmtPrice(b.spread, dp)}${num(b.spreadBp) != null ? ` · ${b.spreadBp.toFixed(2)} bp` : ''} · mid ${fmtPrice(b.mid, dp)}`);
    frag.appendChild(sp);
    bids.forEach((l, i) => frag.appendChild(row(l, 'bid', i === 0)));
    if (!asks.length && !bids.length) frag.appendChild(el('div', 'muted dom-empty', 'Order book snapshot has no levels yet.'));
    const keepScroll = ladder.scrollTop, hadRows = ladder.querySelector('.dom-row');
    ladder.replaceChildren(frag);
    // first paint: centre the spread; afterwards keep the viewer's own scroll position
    if (!hadRows) { const y = sp.offsetTop - ladder.clientHeight / 2 + sp.offsetHeight / 2; ladder.scrollTop = Math.max(0, y); } else ladder.scrollTop = keepScroll;
    // depth-imbalance meter: fill = bid share of the visible depth
    const bidD = num(b.bidDepth, 0), askD = num(b.askDepth, 0), tot = bidD + askD; const imb = num(b.imbalance, tot > 0 ? (bidD - askD) / tot : 0);
    fill.style.width = `${clamp(tot > 0 ? (bidD / tot) * 100 : 50, 0, 100)}%`;
    text.replaceChildren(el('span', '', `bids ${fmtQty(bidD)}`), Object.assign(el('b', '', `imbalance ${imb > 0 ? '+' : ''}${(imb * 100).toFixed(0)} %`), { title: 'positive = bid-heavy (passive buyers), negative = ask-heavy' }), el('span', '', `asks ${fmtQty(askD)}`));
    spreadEl.textContent = num(b.t) != null ? `book ${fmtHm(b.t)}` : '';
    // chips: what the tape did to walls (pulled = cancelled before being traded, absorbed = hit and held, eaten = traded through)
    const chipList = [];
    for (const a of arr(b.absorbed)) chipList.push(['absorbed', a]);
    for (const p of arr(b.pulled)) chipList.push(['pulled', p]);
    for (const t of arr(b.tradedThrough)) chipList.push(['eaten', t]);
    chipList.sort((x, y) => num(obj(x[1]).ageMs, 0) - num(obj(y[1]).ageMs, 0));
    const cf = document.createDocumentFragment();
    for (const [kind, e] of chipList.slice(0, 8)) {
      const o = obj(e); const c = el('span', `chip chip-${kind}`);
      c.append(document.createTextNode(`${kind} ${str(o.side)} ${fmtPrice(o.price, dp)}`), el('small', '', `${fmtQty(o.qty)}${num(o.tradedQty) ? ` / ${fmtQty(o.tradedQty)} traded` : ''} · ${fmtAge(o.ageMs)} ago`));
      c.title = kind === 'absorbed' ? `Wall at ${fmtPrice(o.price, dp)} absorbed ≥ 50 % of its size and held — ${o.side === 'bid' ? 'bullish' : 'bearish'} absorption (source 05 §4)` : kind === 'pulled' ? 'Wall vanished before being traded — cancelled, not filled (spoofing, source 05 §2)' : 'Wall vanished after being traded through — eaten, not cancelled';
      cf.appendChild(c);
    }
    chips.replaceChildren(cf);
  }
  function applyBookEvent(m) {
    m = obj(m); if (str(m.symbol) !== P.symbol) return;
    const s = m.summary && typeof m.summary === 'object' ? m.summary : null;
    if (!s) { if (m.reason) { P.book = null; P.bookReason = str(m.reason); if (P.shown) renderBook(); } return; }
    P.book = s; P.bookReason = '';
    P.pendingBook = s;
    if (!P.shown) return;
    if (!P.bookFrame) P.bookFrame = requestAnimationFrame(() => { P.bookFrame = 0; if (P.pendingBook) renderBook(); });
  }

  // ---------- Pro hits strip (§P5 hits, ✓/– like the CZT panel) ----------
  function hitOn(key, layer) {
    const h = P.hits;
    if (Array.isArray(h)) return h.map(String).includes(key);
    if (h && typeof h === 'object') {
      if (typeof h[key] === 'boolean') return h[key];
      if (h[key] && typeof h[key] === 'object' && typeof h[key].on === 'boolean') return h[key].on;
      if (Array.isArray(h[layer])) return h[layer].map(String).includes(key);
      if (h[layer] && Array.isArray(obj(h[layer]).hits)) return obj(h[layer]).hits.map(String).includes(key);
    }
    const czt = obj(obj(activeSym()).czt);                    // fallback: the same hits the CZT panel shows
    return arr(obj(czt[layer]).hits).map(String).includes(key);
  }
  function renderHits() {
    const ul = $('proHits'); ul.replaceChildren();
    for (const [key, layer, label] of PRO_HITS) {
      const on = hitOn(key, layer); const li = el('li', on ? 'on' : '');
      li.append(el('span', 'mk', on ? '✓' : '–'), el('span', '', label), el('span', 'lay', layer));
      li.title = `${layer}.${key}`;
      ul.appendChild(li);
    }
  }

  // ---------- wiring ----------
  function onState() {
    const S = obj(TG().state); const id = str(S.active) || null;
    if (id !== P.symbol) {
      P.symbol = id; P.footprints = []; P.book = null; P.bookReason = ''; P.trapped = null; P.hits = null; P.partial = false; P.userScrolledFp = false;
      applyShown(); message('');
      renderFootprint(); renderBook(); renderHits();
      if (id) load(id);
    } else { if (store.get(STORE_KEY) == null) applyShown(); renderHits(); }
  }
  function attachSse(es) {
    if (!es || es === P.sse || typeof es.addEventListener !== 'function') return;
    P.sse = es;
    es.addEventListener('footprint', (e) => { try { applyFootprintEvent(JSON.parse(e.data)); } catch { /* malformed frame */ } });
    es.addEventListener('book', (e) => { try { applyBookEvent(JSON.parse(e.data)); } catch { /* malformed frame */ } });
    // reconnect → the server's state may have moved on; refetch the snapshot once the stream is back
    es.addEventListener('open', () => { if (P.symbol && P.sse === es && P.sseWasOpen) load(P.symbol); P.sseWasOpen = true; });
  }
  function boot() {
    const t = $('proToggle'); if (!t || !$('proBody')) return;             // the Pro section is not in this page
    t.addEventListener('click', toggle);
    const sc = $('fpScroll'); if (sc) sc.addEventListener('scroll', () => { P.userScrolledFp = sc.scrollLeft < sc.scrollWidth - sc.clientWidth - 4; }, { passive: true });
    document.addEventListener('tradeguard:state', onState);
    document.addEventListener('tradeguard:sse', (e) => attachSse(obj(e.detail).source));
    document.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return; const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|SELECT|TEXTAREA/.test(tag) || (e.target && e.target.isContentEditable)) return;
      if (e.key === 'p' || e.key === 'P') toggle();
    });
    applyShown(); renderFootprint(); renderBook(); renderHits();
    // app.js may already have booted (it is synchronous up to its first await) — pick up what exists
    const S = obj(TG().state); if (S.sse) attachSse(S.sse); if (S.active) onState();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  // Exposed for the browser console / Playwright checks only — nothing in the page depends on it.
  window.TradeGuardPro = { state: P, load, applyFootprintEvent, applyBookEvent, renderFootprint, renderBook, renderHits, toggle };
})();
