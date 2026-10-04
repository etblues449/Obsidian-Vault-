/* TradeGuard Analyst dashboard — SPEC §7. Framework-free, no build step, no network except same-origin
   `/api/*` and `/events`. Renders meaningfully with an empty snapshot (every feed 'connecting') and never
   throws on a missing field: every read of server data goes through `num()/str()/arr()` guards.

   Data flow:  GET /api/state  → watchlist, CZT panel, header pill          (polled every 10 s + on SSE events)
               GET /api/chart  → candles + indicators + levels + markers    (on symbol / TF change, on closed candle)
               GET /api/feed   → execution feed ring buffer                 (once; then SSE 'event' prepends)
               GET /api/scorecard?by=…                                      (on toggle; after every 'setup')
               SSE /events     → 'event' | 'candle' | 'setup' | 'status' | 'levels'
   Times from the server are ms epoch UTC; lightweight-charts wants SECONDS (UTCTimestamp). Axis labels are
   rendered in Europe/London because the sources are session-based ("time dictates the move", source 03).

   Chart: lightweight-charts v5.0.8 (vendored). Candles + EMA 9/21/50 + VWAP in pane 0; volume in pane 1;
   delta in pane 2. If the pane API is unavailable the histograms fall back to overlay scales with
   scaleMargins (volume bottom 20 %, delta just above it). Zones (FVG / order block) are drawn as an HTML
   overlay positioned with priceToCoordinate/timeToCoordinate because v5 has no built-in rectangle series. */
(() => {
  'use strict';

  // ---------- constants ----------
  const TFS = ['1m', '5m', '15m', '1h', '4h'];
  const TF_MS = { '1m': 60e3, '5m': 3e5, '15m': 9e5, '1h': 36e5, '4h': 144e5 };
  const CHART_LIMIT = 600;
  const STATE_POLL_MS = 10_000;
  const FEED_MAX = 500;
  const MAX_PRICE_LINES = 36;
  const STORE = { theme: 'tradeguard.theme', symbol: 'tradeguard.symbol', tf: 'tradeguard.tf' };
  // CZT hit keys in cfg.czt.weights order (config/strategy.json), labelled in source-document language.
  const HITS = {
    condition: [
      ['biasAligned', 'Bias aligned — HTF pushes with the trade'],
      ['killzone', 'Killzone — London / New York'],
      ['outsideValueTrend', 'Outside prior-day value — expansion'],
      ['insideValueRotation', 'Inside value — rotation'],
    ],
    zone: [
      ['pdhPdl', 'Prior day high / low'],
      ['sessionHighLow', 'Session / Asia high–low'],
      ['equalHighsLows', 'Equal highs / lows'],
      ['valueArea', 'VAH / VAL / POC'],
      ['nakedPoc', 'Naked POC'],
      ['fvg', 'Imbalance (FVG)'],
      ['orderBlock', 'Order block'],
    ],
    trigger: [
      ['sweepReclaim', 'Sweep & reclaim (manipulation)'],
      ['absorption', 'Absorption'],
      ['cvdDivergence', 'CVD divergence'],
      ['engulfing', 'Engulfing candle'],
      ['ltfBos', 'LTF break of structure'],
      ['deltaConfirms', 'Delta confirms'],
    ],
  };
  const PILL = {
    connecting: 'Connecting…', live: 'Live', delayed: 'Delayed', sim: 'Simulated',
    reconnecting: 'Reconnecting…', error: 'Error', closed: 'Closed',
  };
  const BADGE = { live: 'LIVE', sim: 'SIM', delayed: 'DELAYED', replay: 'REPLAY' };
  // Level.kind → colour family + short axis title (source 02/04/05 vocabulary).
  const LEVEL_STYLE = {
    pdh: ['--lvl-pd', 'PDH'], pdl: ['--lvl-pd', 'PDL'],
    sessionHigh: ['--lvl-session', 'SESS H'], sessionLow: ['--lvl-session', 'SESS L'],
    asiaHigh: ['--lvl-session', 'ASIA H'], asiaLow: ['--lvl-session', 'ASIA L'],
    equalHighs: ['--lvl-equal', 'EQH'], equalLows: ['--lvl-equal', 'EQL'],
    consolidationHigh: ['--lvl-consol', 'CONS H'], consolidationLow: ['--lvl-consol', 'CONS L'],
    poc: ['--lvl-value', 'POC'], vah: ['--lvl-value', 'VAH'], val: ['--lvl-value', 'VAL'], nakedPoc: ['--lvl-value', 'nPOC'],
  };

  // ---------- tiny helpers ----------
  const $ = (id) => document.getElementById(id);
  const num = (v, d = null) => (typeof v === 'number' && Number.isFinite(v) ? v : (typeof v === 'string' && v !== '' && Number.isFinite(+v) ? +v : d));
  const str = (v, d = '') => (v == null ? d : String(v));
  const arr = (v) => (Array.isArray(v) ? v : []);
  const obj = (v) => (v && typeof v === 'object' ? v : {});
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode / quota — a convenience only */ } },
  };
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
  const debounce = (fn, ms) => { let h = 0; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; };

  // London clock for everything the user reads (sessions are defined in Europe/London). Falls back to UTC.
  const LDN = (() => {
    const mk = (o) => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour12: false, ...o }); } catch { return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour12: false, ...o }); } };
    return { hm: mk({ hour: '2-digit', minute: '2-digit' }), hms: mk({ hour: '2-digit', minute: '2-digit', second: '2-digit' }), dm: mk({ day: '2-digit', month: 'short' }), dmy: mk({ day: '2-digit', month: 'short', year: 'numeric' }) };
  })();
  const fmtClock = (ms) => (num(ms) == null ? '—' : LDN.hms.format(new Date(ms)));
  const fmtHm = (ms) => (num(ms) == null ? '—' : LDN.hm.format(new Date(ms)));
  const fmtPrice = (v, dp = 2) => (num(v) == null ? '—' : v.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp }));
  const fmtNum = (v, dp = 2) => (num(v) == null ? '—' : v.toLocaleString('en-GB', { maximumFractionDigits: dp }));
  const fmtSigned = (v, dp = 2) => (num(v) == null ? '—' : (v > 0 ? '+' : '') + v.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp }));
  const fmtPct = (v) => (num(v) == null ? '—' : (v > 0 ? '+' : '') + v.toFixed(2) + '%');
  const fmtR = (v) => (num(v) == null ? '—' : (v > 0 ? '+' : '') + v.toFixed(2) + 'R');
  const fmtVol = (v) => { v = num(v); if (v == null) return '—'; const a = Math.abs(v); const s = a >= 1e6 ? (a / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (a / 1e3).toFixed(1) + 'K' : a.toFixed(a < 10 ? 3 : 1); return (v < 0 ? '-' : '') + s; };
  // Delta per candle: trades-tagged if present, else the same body/range proxy as indicators.delta (SPEC §4.2).
  const candleDelta = (c) => { const d = num(c.delta); if (d != null) return d; const b = num(c.buyV), s = num(c.sellV); if (b != null && s != null) return b - s; const o = num(c.o, 0), cl = num(c.c, 0), h = num(c.h, 0), l = num(c.l, 0), v = num(c.v, 0); return ((cl - o) / ((h - l) || 1)) * v; };

  // ---------- state ----------
  const S = {
    snap: null, symbols: [], active: null, tf: TFS.includes(store.get(STORE.tf)) ? store.get(STORE.tf) : '5m',
    data: null, dataKey: null, feed: [], feedFilter: '', scoreBy: 'trigger', sse: null, sseOpened: false, chartReq: 0, pollTimer: 0,
  };
  const activeSym = () => S.symbols.find((s) => s.id === S.active) || null;
  const chartKey = (id, tf) => `${id}|${tf}`; // what the chart currently shows — SSE deltas apply only when it matches

  // ---------- HTTP (same-origin only) ----------
  async function api(path) {
    const r = await fetch(path, { cache: 'no-store', credentials: 'same-origin' });
    const body = await r.json().catch(() => null);
    if (!r.ok) throw new Error(str(obj(body).error, `${r.status} ${r.statusText}`));
    return body;
  }
  // Local UI notes land in the feed as dimmed 'warn' lines so a failing route is visible, not silent.
  function note(level, msg, symbol = 'UI') { pushFeed({ t: Date.now(), level, symbol, msg, local: true }); }

  // ---------- theme ----------
  const Theme = {
    media: window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null,
    current() { const s = document.documentElement.getAttribute('data-theme'); return s === 'dark' || s === 'light' ? s : (this.media && this.media.matches ? 'dark' : 'light'); },
    set(t) { document.documentElement.setAttribute('data-theme', t); store.set(STORE.theme, t); this.sync(); },
    toggle() { this.set(this.current() === 'dark' ? 'light' : 'dark'); },
    sync() { const dark = this.current() === 'dark'; $('themeBtn').setAttribute('aria-pressed', String(dark)); Chart.applyTheme(); },
  };

  // ---------- chart ----------
  const Chart = {
    chart: null, candles: null, ema9: null, ema21: null, ema50: null, vwap: null, vol: null, delta: null, markers: null,
    priceLines: [], times: [], dp: 2, panes: false, lastT: null, zones: [], ro: null,
    LW() { return window.LightweightCharts || null; },
    init() {
      const LW = this.LW(); const host = $('chart');
      if (!LW || this.chart) return;
      try {
        const t = this.tokens();
        this.chart = LW.createChart(host, {
          autoSize: true,
          layout: { background: { type: 'solid', color: t.surface }, textColor: t.ink2, fontFamily: t.font, attributionLogo: false },
          grid: { vertLines: { color: t.line }, horzLines: { color: t.line } },
          crosshair: { mode: LW.CrosshairMode.Normal },
          rightPriceScale: { borderColor: t.line, scaleMargins: { top: 0.06, bottom: 0.04 } },
          timeScale: { borderColor: t.line, timeVisible: true, secondsVisible: false, rightOffset: 3, tickMarkFormatter: (time, type) => this.tick(time, type) },
          localization: { timeFormatter: (time) => `${LDN.dm.format(new Date(time * 1000))} ${LDN.hm.format(new Date(time * 1000))}` },
        });
        this.candles = this.chart.addSeries(LW.CandlestickSeries, { upColor: t.up, downColor: t.down, wickUpColor: t.up, wickDownColor: t.down, borderVisible: false, priceFormat: this.priceFormat() });
        const line = (color) => this.chart.addSeries(LW.LineSeries, { color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
        this.ema9 = line(t.ema9); this.ema21 = line(t.ema21); this.ema50 = line(t.ema50);
        this.vwap = this.chart.addSeries(LW.LineSeries, { color: t.vwap, lineWidth: 2, lineStyle: LW.LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
        const hist = (opts, pane) => this.chart.addSeries(LW.HistogramSeries, { priceFormat: { type: 'volume' }, priceLineVisible: false, lastValueVisible: false, ...opts }, pane);
        try {
          // v5 panes: pane index beyond the last creates it; each pane owns its own right scale.
          this.vol = hist({}, 1); this.delta = hist({}, 2);
          const panes = this.chart.panes(); panes[1].setHeight(64); panes[2].setHeight(64);
          this.vol.priceScale().applyOptions({ scaleMargins: { top: 0.15, bottom: 0 } });
          this.delta.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } });
          this.panes = true;
        } catch (e) {
          // Fallback: overlay scales on pane 0 — volume bottom 20 %, delta in the band above it.
          this.vol = hist({ priceScaleId: 'vol' }); this.delta = hist({ priceScaleId: 'delta' });
          this.vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
          this.delta.priceScale().applyOptions({ scaleMargins: { top: 0.62, bottom: 0.22 } });
          this.candles.priceScale().applyOptions({ scaleMargins: { top: 0.05, bottom: 0.4 } });
          this.panes = false;
        }
        this.markers = LW.createSeriesMarkers(this.candles, []);
        this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => this.drawZones());
        if (window.ResizeObserver) { this.ro = new ResizeObserver(() => this.drawZones()); this.ro.observe(host); }
      } catch (e) {
        this.chart = null; note('error', `Chart failed to initialise: ${e.message || e}`);
      }
    },
    tokens() {
      return {
        surface: cssVar('--surface'), ink2: cssVar('--ink-2'), line: cssVar('--line'), muted: cssVar('--muted'), ink: cssVar('--ink'),
        up: cssVar('--up'), down: cssVar('--down'), volUp: cssVar('--vol-up'), volDown: cssVar('--vol-down'),
        ema9: cssVar('--ema9'), ema21: cssVar('--ema21'), ema50: cssVar('--ema50'), vwap: cssVar('--vwap'), good: cssVar('--good'), critical: cssVar('--critical'),
        font: getComputedStyle(document.body).fontFamily,
      };
    },
    priceFormat() { const dp = clamp(this.dp, 0, 8); return { type: 'price', precision: dp, minMove: +(10 ** -dp).toFixed(dp) }; },
    // TickMarkType: 0 Year, 1 Month, 2 DayOfMonth, 3 Time, 4 TimeWithSeconds — render in London time.
    tick(time, type) { const d = new Date(time * 1000); if (type >= 3) return LDN.hm.format(d); if (type === 2) return LDN.dm.format(d); return type === 1 ? LDN.dm.format(d).slice(3) : String(d.getUTCFullYear()); },
    applyTheme() {
      if (!this.chart) return;
      const LW = this.LW(), t = this.tokens();
      this.chart.applyOptions({ layout: { background: { type: 'solid', color: t.surface }, textColor: t.ink2 }, grid: { vertLines: { color: t.line }, horzLines: { color: t.line } }, rightPriceScale: { borderColor: t.line }, timeScale: { borderColor: t.line } });
      this.candles.applyOptions({ upColor: t.up, downColor: t.down, wickUpColor: t.up, wickDownColor: t.down });
      this.ema9.applyOptions({ color: t.ema9 }); this.ema21.applyOptions({ color: t.ema21 }); this.ema50.applyOptions({ color: t.ema50 }); this.vwap.applyOptions({ color: t.vwap });
      if (S.data) this.setData(S.data, { keepRange: true }); // bar colours live in the data points
      void LW;
    },
    // Map a server ms timestamp onto a bar time of the current TF (seconds). Snaps to the nearest bar within
    // one TF so markers/zones from another TF (e.g. a 15m order block on a 5m chart) still land on a bar.
    snap(ms) {
      ms = num(ms); if (ms == null || !this.times.length) return null;
      const tfMs = TF_MS[S.tf] || 60e3, sec = Math.floor(ms / tfMs) * tfMs / 1000;
      const a = this.times; let lo = 0, hi = a.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (a[mid] < sec) lo = mid + 1; else hi = mid; }
      const cands = [a[lo], a[lo - 1]].filter((x) => x != null);
      const best = cands.reduce((b, x) => (Math.abs(x - sec) < Math.abs(b - sec) ? x : b), cands[0]);
      return Math.abs(best - sec) <= tfMs / 1000 ? best : null;
    },
    setData(d, { keepRange = false } = {}) {
      if (!this.chart) this.init();
      if (!this.chart) return;
      const t = this.tokens(); const sym = activeSym();
      const dp = num(d.dp, num(obj(sym).dp, 2)); if (dp !== this.dp) { this.dp = dp; this.candles.applyOptions({ priceFormat: this.priceFormat() }); }
      const candles = arr(d.candles).filter((c) => c && num(c.t) != null && num(c.o) != null && num(c.h) != null && num(c.l) != null && num(c.c) != null).sort((a, b) => a.t - b.t);
      const seen = new Set(); const cs = [], vs = [], ds = []; this.times = [];
      for (const c of candles) {
        const time = Math.floor(c.t / 1000); if (seen.has(time)) continue; seen.add(time);
        const up = c.c >= c.o, delta = candleDelta(c);
        cs.push({ time, open: c.o, high: c.h, low: c.l, close: c.c });
        vs.push({ time, value: num(c.v, 0), color: up ? t.volUp : t.volDown });
        ds.push({ time, value: delta, color: delta >= 0 ? t.good : t.critical });
        this.times.push(time);
      }
      const line = (pts) => arr(pts).filter((p) => p && num(p.t) != null && num(p.v) != null).map((p) => ({ time: Math.floor(p.t / 1000), value: p.v })).filter((p, i, a) => !i || p.time > a[i - 1].time);
      const range = keepRange ? this.chart.timeScale().getVisibleLogicalRange() : null;
      this.candles.setData(cs); this.vol.setData(vs); this.delta.setData(ds);
      this.ema9.setData(line(d.ema9)); this.ema21.setData(line(d.ema21)); this.ema50.setData(line(d.ema50)); this.vwap.setData(line(d.vwap));
      this.lastT = cs.length ? cs[cs.length - 1].time : null;
      $('chartEmpty').hidden = cs.length > 0;
      this.setLevels(d);
      this.setMarkers(d.markers);
      if (range) this.chart.timeScale().setVisibleLogicalRange(range);
      else if (cs.length) { this.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, cs.length - (window.innerWidth < 600 ? 70 : 140)), to: cs.length + 3 }); }
      this.drawZones();
      renderLegend(candles[candles.length - 1], d);
    },
    update(c) {
      if (!this.chart || !this.times.length || num(c.t) == null) return false;
      const time = Math.floor(c.t / 1000);
      if (this.lastT != null && time < this.lastT) return false; // older than the last bar — lightweight-charts would throw; caller re-fetches
      const t = this.tokens(), up = c.c >= c.o, delta = candleDelta(c);
      try {
        this.candles.update({ time, open: num(c.o), high: num(c.h), low: num(c.l), close: num(c.c) });
        this.vol.update({ time, value: num(c.v, 0), color: up ? t.volUp : t.volDown });
        this.delta.update({ time, value: delta, color: delta >= 0 ? t.good : t.critical });
      } catch { return false; }
      if (time > this.lastT) { this.times.push(time); this.lastT = time; }
      $('chartEmpty').hidden = true;
      this.drawZones();
      return true;
    },
    setLevels(d) {
      if (!this.chart) return;
      const LW = this.LW();
      for (const pl of this.priceLines) { try { this.candles.removePriceLine(pl); } catch { /* already gone */ } }
      this.priceLines = [];
      const sym = activeSym(); const price = num(obj(sym).price, this.lastClose());
      const lines = [];
      for (const l of arr(d.levels)) {
        if (!l) continue; const p = num(l.price); if (p == null) continue;
        const [tok, title] = LEVEL_STYLE[l.kind] || ['--muted', str(l.kind).toUpperCase()];
        const swept = !!l.swept;
        // On a phone the price scale cannot hold a label per level — the inline title carries the name there.
        lines.push({ price: p, color: cssVar(tok), lineWidth: 1, lineStyle: swept ? LW.LineStyle.Dashed : LW.LineStyle.Solid, axisLabelVisible: !swept && window.innerWidth >= 600, title: swept ? `${title} ✕` : title, dist: price == null ? 0 : Math.abs(p - price) });
      }
      // The open setup's entry / stop / targets — the stop is the manipulation extreme (source 01), make it unmissable.
      const setup = obj(sym).openSetup; if (setup && num(setup.entry) != null) {
        lines.push({ price: setup.entry, color: cssVar('--ink'), lineWidth: 1, lineStyle: LW.LineStyle.LargeDashed, axisLabelVisible: true, title: 'ENTRY', dist: -1 });
        if (num(setup.stop) != null) lines.push({ price: setup.stop, color: cssVar('--critical'), lineWidth: 2, lineStyle: LW.LineStyle.Dashed, axisLabelVisible: true, title: 'STOP', dist: -1 });
        arr(setup.targets).forEach((tg, i) => { if (tg && num(tg.price) != null) lines.push({ price: tg.price, color: cssVar('--good'), lineWidth: 1, lineStyle: LW.LineStyle.Dotted, axisLabelVisible: true, title: `T${i + 1}`, dist: -1 }); });
      }
      lines.sort((a, b) => a.dist - b.dist).slice(0, MAX_PRICE_LINES).forEach(({ dist, ...opts }) => { try { this.priceLines.push(this.candles.createPriceLine(opts)); } catch { /* bad price */ } });
      this.zones = arr(d.zones).filter((z) => z && num(z.top) != null && num(z.bottom) != null).slice(-24);
      this.drawZones();
    },
    setMarkers(markers) {
      if (!this.markers) return;
      const t = this.tokens(); const out = [];
      for (const m of arr(markers)) {
        if (!m) continue; const time = this.snap(m.t); if (time == null) continue;
        const side = str(m.side).toLowerCase();
        // Sweeping SELL-side liquidity (below lows) is the bullish manipulation; buy-side swept is bearish.
        const bull = /long|bull|sell-side|low/.test(side), bear = /short|bear|buy-side|high/.test(side);
        const dir = bull && !bear ? 'up' : bear && !bull ? 'down' : null;
        const base = { time, position: dir === 'up' ? 'belowBar' : dir === 'down' ? 'aboveBar' : 'inBar' };
        switch (m.kind) {
          case 'sweep': out.push({ ...base, shape: dir === 'down' ? 'arrowDown' : 'arrowUp', color: cssVar('--lvl-equal'), text: str(m.text, 'SWEEP') }); break;
          case 'absorption': out.push({ ...base, shape: 'circle', color: cssVar('--lvl-value'), text: str(m.text, 'ABS') }); break;
          case 'setup': out.push({ ...base, shape: dir === 'down' ? 'arrowDown' : 'arrowUp', color: dir === 'down' ? t.critical : t.good, size: 2, text: str(m.text, `${dir === 'down' ? 'SHORT' : 'LONG'} ${str(m.grade)}`.trim()) }); break;
          case 'session': out.push({ time, position: 'inBar', shape: 'square', color: t.muted, text: str(m.text) }); break;
          default: out.push({ ...base, shape: 'circle', color: t.muted, text: str(m.text, str(m.kind)) });
        }
      }
      out.sort((a, b) => a.time - b.time);
      try { this.markers.setMarkers(out); } catch (e) { note('warn', `Markers skipped: ${e.message || e}`); }
    },
    // FVG / order-block bands as positioned divs over pane 0; redrawn on scroll, zoom, resize and each update.
    drawZones() {
      const layer = $('zoneLayer'); if (!layer) return;
      layer.replaceChildren();
      if (!this.chart || !this.zones.length || !this.times.length) return;
      const ts = this.chart.timeScale();
      let width, height;
      try { width = ts.width(); height = this.panes ? this.chart.panes()[0].getHeight() : $('chart').clientHeight; } catch { width = $('chart').clientWidth - 60; height = $('chart').clientHeight; }
      if (!(width > 0 && height > 0)) return;
      const frag = document.createDocumentFragment();
      for (const z of this.zones) {
        let y1 = this.candles.priceToCoordinate(z.top), y2 = this.candles.priceToCoordinate(z.bottom);
        if (y1 == null || y2 == null) continue;
        if (y1 > y2) [y1, y2] = [y2, y1];
        if (y2 < 0 || y1 > height) continue;
        const snapped = this.snap(z.t);
        let x = snapped == null ? (num(z.t, 0) / 1000 < this.times[0] ? 0 : null) : ts.timeToCoordinate(snapped);
        if (x == null) { if (num(z.t, 0) / 1000 < this.times[0]) x = 0; else continue; }
        x = clamp(x, 0, width); if (width - x < 2) continue;
        const box = el('div', `zone-box ${z.side === 'bearish' ? 'bear' : 'bull'}${z.mitigated ? ' mitigated' : ''}`);
        box.style.cssText = `left:${x}px;top:${clamp(y1, 0, height)}px;width:${width - x}px;height:${Math.max(1, clamp(y2, 0, height) - clamp(y1, 0, height))}px`;
        if (y2 - y1 > 14) box.textContent = z.kind === 'orderBlock' ? 'OB' : 'FVG';
        frag.appendChild(box);
      }
      layer.appendChild(frag);
    },
    lastClose() { const c = arr(obj(S.data).candles); return c.length ? num(c[c.length - 1].c) : null; },
    // Empty the chart and show `msg` — used when the symbol changes (never show another symbol's bars under
    // the new header, not even for a moment) and when a load fails (stale data is worse than no data).
    clear(msg) {
      S.data = null; S.dataKey = null; this.zones = []; this.times = []; this.lastT = null;
      const empty = $('chartEmpty'); empty.textContent = msg; empty.hidden = false;
      renderLegend(null, {});
      if (!this.chart) return;
      for (const s of [this.candles, this.vol, this.delta, this.ema9, this.ema21, this.ema50, this.vwap]) { try { s.setData([]); } catch { /* not created */ } }
      this.setLevels({}); try { this.markers.setMarkers([]); } catch { /* none */ }
    },
  };

  // ---------- rendering ----------
  function renderTabs() {
    const host = $('symbolTabs'); host.replaceChildren();
    if (!S.symbols.length) { host.appendChild(Object.assign(el('button', 'tab is-active', 'No symbols configured'), { disabled: true, type: 'button' })); return; }
    S.symbols.forEach((s, i) => {
      const b = el('button', `tab${s.id === S.active ? ' is-active' : ''}`); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(s.id === S.active)); b.title = `${str(s.name, s.id)} (key ${i + 1})`;
      const top = el('b'); const dot = el('span', `dot ${feedClass(s)}`); top.append(dot, document.createTextNode(str(s.id)));
      const sub = el('small', num(s.price) == null ? '—' : fmtPrice(s.price, num(s.dp, 2)));
      b.append(top, sub); b.addEventListener('click', () => selectSymbol(s.id)); host.appendChild(b);
    });
  }
  function renderTfPills() {
    const host = $('tfPills'); host.replaceChildren();
    for (const tf of TFS) { const b = el('button', `pill-btn${tf === S.tf ? ' is-active' : ''}`, tf); b.type = 'button'; b.setAttribute('aria-pressed', String(tf === S.tf)); b.addEventListener('click', () => selectTf(tf)); host.appendChild(b); }
  }
  function feedClass(s) { const f = obj(s.feed); const st = str(f.state, 'connecting'); return st === 'live' ? 'live' : st === 'sim' ? 'sim' : st === 'delayed' ? 'delayed' : (st === 'error' || st === 'closed') ? 'error' : 'connecting'; }
  function renderHeader() {
    const s = activeSym(); const f = obj(obj(s).feed); const state = str(f.state, 'connecting');
    const pill = $('statusPill'); pill.className = `pill pill-${PILL[state] ? state : 'connecting'}`; pill.textContent = PILL[state] || PILL.connecting;
    pill.title = [str(f.kind), str(f.sourceNote)].filter(Boolean).join(' — ') || 'Feed status';
    $('chartSymbol').textContent = s ? str(s.id) : '—'; $('chartName').textContent = s ? str(s.name) : '';
    const dp = num(obj(s).dp, 2); $('chartPrice').textContent = s ? fmtPrice(s.price, dp) : '—';
    const ch = obj(obj(s).change), pct = num(ch.pct); const chEl = $('chartChange');
    chEl.textContent = pct == null ? '—' : `${fmtSigned(num(ch.abs), dp)} (${fmtPct(pct)})${ch.windowLabel ? ' ' + str(ch.windowLabel) : ''}`;
    chEl.className = `change${pct > 0 ? ' up' : pct < 0 ? ' down' : ''}`;
    const meta = $('chartMeta'); meta.replaceChildren();
    if (s) {
      const ses = obj(s.session);
      if (ses.label) { const sp = el('span', ses.killzone ? 'kz' : '', `${ses.label}${ses.role ? ' · ' + ses.role : ''}${ses.killzone ? ' · KILLZONE' : ''}`); meta.appendChild(sp); }
      if (num(s.atr) != null) meta.appendChild(el('span', '', `ATR ${fmtPrice(s.atr, dp)}`));
      meta.appendChild(el('span', '', `Δ ${s.deltaSource === 'trades' ? 'true (trades)' : 'proxy'}`));
      if (num(s.lastCandleT) != null) meta.appendChild(el('span', '', `last ${fmtHm(s.lastCandleT)}`));
    }
    document.title = s && num(s.price) != null ? `${s.id} ${fmtPrice(s.price, dp)} · TradeGuard` : 'TradeGuard Analyst';
  }
  function renderLegend(last, d) {
    d = obj(d); const lastOf = (pts) => { const a = arr(pts); return a.length ? num(a[a.length - 1].v) : null; };
    const dp = Chart.dp; const set = (k, v) => { const e = document.querySelector(`[data-lg="${k}"]`); if (e) e.textContent = v; };
    set('ema9', fmtPrice(lastOf(d.ema9), dp)); set('ema21', fmtPrice(lastOf(d.ema21), dp)); set('ema50', fmtPrice(lastOf(d.ema50), dp)); set('vwap', fmtPrice(lastOf(d.vwap), dp));
    set('vol', last ? fmtVol(last.v) : '—'); set('delta', last ? fmtVol(candleDelta(last)) : '—');
    const src = obj(activeSym()).deltaSource; set('deltaSrc', src === 'trades' ? '(trades)' : src === 'proxy' ? '(proxy)' : '');
  }
  function renderCzt() {
    const s = activeSym(); const czt = obj(obj(s).czt);
    const side = str(czt.side); const sideEl = $('cztSide'); sideEl.textContent = side || 'no side'; sideEl.className = `side-tag side-${side === 'long' || side === 'short' ? side : 'none'}`;
    for (const col of document.querySelectorAll('#cztCols .czt-col')) {
      const layer = col.dataset.layer; const L = obj(czt[layer]); const hits = arr(L.hits).map(String); const ul = col.querySelector('.hits'); ul.replaceChildren();
      const known = HITS[layer].map(([k]) => k);
      const rows = [...HITS[layer], ...hits.filter((h) => !known.includes(h)).map((h) => [h, h])]; // unknown hits still show — never hide a reason
      for (const [key, label] of rows) { const on = hits.includes(key); const li = el('li', on ? 'on' : ''); li.append(el('span', 'mk', on ? '✓' : '–'), el('span', '', label)); ul.appendChild(li); }
      col.querySelector('.czt-score').textContent = `${hits.length}/${rows.length} · ${num(L.score) == null ? '—' : L.score.toFixed(1)} pts`;
    }
    const score = num(czt.score, 0), grade = str(czt.grade); const fill = $('scoreFill');
    fill.style.width = `${clamp((score / 12) * 100, 0, 100)}%`; fill.className = `scorebar-fill${grade ? ' grade-' + grade : ''}`;
    $('scoreNum').textContent = score.toFixed(1); const g = $('gradeTag'); g.textContent = grade || '—'; g.className = `grade grade-${grade || 'none'}`;
    const noteEl = $('cztNote');
    const rej = arr(czt.rejections), blocked = str(czt.blocked);
    noteEl.textContent = !s ? 'Waiting for the first closed analysis candle.' : blocked ? `Setup held back: ${blocked}` : rej.length ? rej[0] : (s.openSetup ? 'Setup open — managing by proved auctions.' : side ? `Leaning ${side} — no setup yet.` : 'Waiting for the first closed analysis candle.');
    renderSetupCard(obj(s).openSetup || obj(s).lastSetup || null, num(obj(s).dp, 2));
  }
  function renderSetupCard(setup, dp) {
    const card = $('setupCard'); card.replaceChildren();
    if (!setup || num(setup.entry) == null) {
      card.className = 'setup-card setup-empty';
      card.appendChild(el('p', 'muted', 'No setup. Never take a trigger in the middle of nowhere — wait for price to reach a zone and show its hand.'));
      return;
    }
    const side = str(setup.side); card.className = `setup-card ${side === 'short' ? 'short' : 'long'}`;
    const head = el('div', 'setup-head');
    const title = el('b', '', `${side.toUpperCase() || 'SETUP'} ${str(setup.symbol)} ${str(setup.tf)}`.trim());
    const grade = el('span', `grade grade-${str(setup.grade) || 'none'}`, `${str(setup.grade, '—')} · ${num(setup.score) == null ? '—' : setup.score.toFixed(1)}`);
    const status = el('span', 'st', `${str(setup.status, 'open')}${num(setup.resultR) != null ? ' ' + fmtR(setup.resultR) : ''} · ${fmtHm(setup.t)}`);
    head.append(title, grade, status); card.appendChild(head);
    const dl = el('dl', 'setup-kv');
    const kv = (k, v, cls) => { dl.appendChild(el('dt', '', k)); const dd = el('dd', cls || ''); if (typeof v === 'string') dd.textContent = v; else dd.appendChild(v); dl.appendChild(dd); };
    kv('Entry', fmtPrice(setup.entry, dp)); kv('Stop', fmtPrice(setup.stop, dp), 'stop');
    const tg = el('span'); const targets = arr(setup.targets);
    if (!targets.length) tg.textContent = '— (trail behind proved auctions)';
    targets.forEach((t, i) => { if (!t) return; const line = el('span', 't', `T${i + 1} ${fmtPrice(t.price, dp)} `); const sm = el('small', '', `${str(t.label)}${num(t.rr) != null ? ' · ' + t.rr.toFixed(2) + 'R' : ''}`); line.appendChild(sm); tg.appendChild(line); });
    kv('Targets', tg); kv('R:R', num(setup.rr) == null ? '—' : `${setup.rr.toFixed(2)} : 1`);
    const sz = obj(setup.size);
    kv('Size', num(sz.units) == null ? '—' : `${fmtNum(sz.units, 4)} units${num(sz.lots) != null ? ` (${fmtNum(sz.lots, 2)} lots)` : ''} · risk ${num(sz.riskUsd) == null ? '—' : '$' + fmtNum(sz.riskUsd, 2)}${num(sz.riskPct) != null ? ` (${fmtNum(sz.riskPct, 2)}%)` : ''}`);
    if (num(setup.mfeR) != null || num(setup.maeR) != null) kv('MFE / MAE', `${fmtR(setup.mfeR)} / ${fmtR(setup.maeR)}`);
    card.appendChild(dl);
    if (setup.invalidation) card.appendChild(el('div', 'setup-inv', `Invalidation: ${str(setup.invalidation)}`));
    const reasons = arr(setup.reasons); if (reasons.length) { const ol = el('ul', 'setup-reasons'); reasons.slice(0, 10).forEach((r) => r != null && ol.appendChild(el('li', '', str(r)))); card.appendChild(ol); }
  }
  function renderWatch() {
    const body = $('watchBody'); body.replaceChildren();
    if (!S.symbols.length) { const tr = el('tr'); const td = el('td', 'muted', S.snap ? 'No symbols configured.' : 'Connecting…'); td.colSpan = 7; tr.appendChild(td); body.appendChild(tr); return; }
    for (const s of S.symbols) {
      const dp = num(s.dp, 2); const tr = el('tr', s.id === S.active ? 'is-active' : ''); tr.tabIndex = 0; tr.setAttribute('role', 'button'); tr.setAttribute('aria-label', `Show ${str(s.id)}`);
      const ls = s.openSetup || s.lastSetup; const lsText = ls ? `${str(ls.side).toUpperCase()} ${str(ls.grade)} · ${str(ls.status, 'open')}${num(ls.resultR) != null ? ' ' + fmtR(ls.resultR) : ''}`.replace(/\s+/g, ' ') : '';
      // phones (< 600 px) show the last setup under the symbol instead of a seventh column (CSS swaps the two)
      const sym = el('td', 'sym'); sym.append(el('b', '', str(s.id)), el('small', 'name', str(s.name)), el('small', 'last-inline', lsText)); tr.appendChild(sym);
      tr.appendChild(el('td', 'num', fmtPrice(s.price, dp)));
      const pct = num(obj(s.change).pct); tr.appendChild(el('td', `num${pct > 0 ? ' up' : pct < 0 ? ' down' : ''}`, fmtPct(pct)));
      const ses = obj(s.session); tr.appendChild(el('td', 'col-session', ses.label ? `${ses.label}${ses.killzone ? ' ⚡' : ''}` : '—'));
      const b = obj(s.bias); const biasTd = el('td'); const bw = el('span', `bias ${str(b.dir, 'neutral')}`); const bar = el('span', 'bar'); const fillI = el('i'); fillI.style.width = `${clamp(num(b.strength, 0) * 100, 0, 100)}%`; bar.appendChild(fillI);
      bw.append(el('span', '', b.dir === 'bullish' ? '▲' : b.dir === 'bearish' ? '▼' : '–'), bar); bw.title = arr(b.reasons).join('\n') || str(b.dir, 'neutral'); biasTd.appendChild(bw); tr.appendChild(biasTd);
      const f = obj(s.feed); const kind = str(f.kind); const badgeText = BADGE[kind] || BADGE[str(f.state)] || str(f.state, 'connecting').toUpperCase();
      const badge = el('span', `badge badge-${feedClass(s)}`, badgeText); badge.title = [str(f.state), str(f.sourceNote)].filter(Boolean).join(' — '); const fd = el('td'); fd.appendChild(badge); tr.appendChild(fd);
      const lsTd = el('td', 'last');
      if (ls) { lsTd.append(el('b', '', `${str(ls.side).toUpperCase()} ${str(ls.grade)}`.trim()), el('small', '', `${str(ls.status, 'open')}${num(ls.resultR) != null ? ' ' + fmtR(ls.resultR) : ''}`)); lsTd.title = str(ls.invalidation); } else lsTd.textContent = '—';
      tr.appendChild(lsTd);
      tr.addEventListener('click', () => selectSymbol(s.id)); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectSymbol(s.id); } });
      body.appendChild(tr);
    }
    const lim = obj(obj(S.snap).limits); const today = obj(lim.setupsToday);
    const parts = []; if (num(lim.openCount) != null) parts.push(`open ${lim.openCount}`); const n = Object.values(today).reduce((a, v) => a + num(v, 0), 0); if (Object.keys(today).length) parts.push(`today ${n}`);
    $('limitsTag').textContent = parts.join(' · ');
  }
  function renderFeedFilter() {
    const sel = $('feedFilter'); const cur = sel.value; sel.replaceChildren(new Option('All symbols', ''));
    for (const s of S.symbols) sel.appendChild(new Option(str(s.id), str(s.id)));
    sel.value = S.symbols.some((s) => s.id === cur) ? cur : ''; S.feedFilter = sel.value;
  }
  function renderFeed() {
    const list = $('feedList'); list.replaceChildren();
    const rows = S.feed.filter((e) => !S.feedFilter || e.symbol === S.feedFilter || e.local).slice(0, 300);
    if (!rows.length) { list.appendChild(el('li', 'muted', 'No events yet.')); return; }
    const frag = document.createDocumentFragment();
    for (const e of rows) {
      const li = el('li', `lv-${e.level}${e.local ? ' local' : ''}`);
      li.append(el('span', 'ft', fmtClock(e.t)), el('span', 'fl', e.level), el('span', 'fs', e.symbol), el('span', 'fm', e.msg));
      if (e.data && typeof e.data === 'object' && Object.keys(e.data).length) { try { li.title = JSON.stringify(e.data).slice(0, 400); } catch { /* circular */ } }
      frag.appendChild(li);
    }
    list.appendChild(frag);
  }
  function pushFeed(ev, { render = true } = {}) {
    const e = normEvent(ev); if (!e) return;
    S.feed.unshift(e); if (S.feed.length > FEED_MAX) S.feed.length = FEED_MAX;
    if (render) renderFeed();
  }
  function normEvent(ev) {
    ev = obj(ev); if (!ev.msg && !ev.level) return null;
    const level = ['info', 'ok', 'warn', 'signal', 'guard', 'error', 'debug'].includes(ev.level) ? ev.level : 'info';
    return { t: num(ev.t, Date.now()), level, symbol: str(ev.symbol, '—'), msg: str(ev.msg), data: ev.data, local: !!ev.local };
  }
  function renderScorecard(rows) {
    const body = $('scoreBody'); body.replaceChildren();
    rows = arr(Array.isArray(rows) ? rows : obj(rows).rows);
    if (!rows.length) { const tr = el('tr'); const td = el('td', 'muted', 'No resolved setups yet — the scorecard fills as setups resolve walk-forward.'); td.colSpan = 8; tr.appendChild(td); body.appendChild(tr); return; }
    const ci = (c) => { if (Array.isArray(c) && c.length >= 2) return `${fmtNum(num(c[0], 0) * 100, 0)}–${fmtNum(num(c[1], 0) * 100, 0)}%`; const o = obj(c); if (num(o.lo) != null) return `${fmtNum(o.lo * 100, 0)}–${fmtNum(num(o.hi, 0) * 100, 0)}%`; return typeof c === 'string' ? c : '—'; };
    for (const r of rows) {
      if (!r) continue; const tr = el('tr'); const wr = num(r.winRate);
      tr.append(el('td', '', str(r.key, '—')), el('td', 'num', fmtNum(r.n, 0)), el('td', 'num', wr == null ? '—' : fmtNum(wr <= 1 ? wr * 100 : wr, 0) + '%'),
        el('td', `num${num(r.expectancyR) > 0 ? ' up' : num(r.expectancyR) < 0 ? ' down' : ''}`, fmtR(r.expectancyR)), el('td', 'num', fmtNum(r.profitFactor, 2)),
        el('td', 'num', fmtR(r.maxDdR)), el('td', 'num', fmtNum(r.avgRr, 2)), el('td', 'num', ci(r.ci95)));
      body.appendChild(tr);
    }
  }
  function renderAll() { renderTabs(); renderHeader(); renderCzt(); renderWatch(); }

  // ---------- loaders ----------
  async function loadState() {
    try {
      const snap = obj(await api('/api/state'));
      S.snap = snap; S.symbols = arr(snap.symbols).filter((s) => s && s.id != null).map((s) => ({ ...s, id: str(s.id) }));
      if (!S.active || !S.symbols.some((s) => s.id === S.active)) { const saved = store.get(STORE.symbol); S.active = S.symbols.some((s) => s.id === saved) ? saved : (S.symbols[0] ? S.symbols[0].id : null); }
      renderAll(); renderFeedFilter();
      if (S.data && Chart.chart) Chart.setLevels(S.data); // the open setup's lines live in the snapshot
      return true;
    } catch (e) { note('warn', `/api/state failed: ${e.message || e}`); renderAll(); return false; }
  }
  async function loadChart() {
    const sym = activeSym(); if (!sym) { Chart.clear('No symbols configured.'); return; }
    const req = ++S.chartReq, key = chartKey(sym.id, S.tf), wrap = document.querySelector('.chart-wrap');
    // Symbol change: clear at once. TF change: keep the frame dimmed until the new bars arrive (no layout jump).
    if (S.dataKey && S.dataKey.split('|')[0] !== sym.id) Chart.clear('Loading…'); else if (!S.dataKey) { const e = $('chartEmpty'); e.textContent = 'Loading…'; e.hidden = false; }
    wrap.classList.add('is-loading');
    try {
      const d = obj(await api(`/api/chart/${encodeURIComponent(sym.id)}?tf=${encodeURIComponent(S.tf)}&limit=${CHART_LIMIT}`));
      if (req !== S.chartReq) return; // a newer request superseded this one (fast tab switching)
      S.data = d; S.dataKey = key; Chart.setData(d);
      if (!arr(d.candles).length) $('chartEmpty').textContent = 'Waiting for candles…';
    } catch (e) {
      if (req !== S.chartReq) return;
      Chart.clear(`Chart unavailable — ${e.message || e}`); note('warn', `/api/chart failed: ${e.message || e}`, sym.id);
    } finally { if (req === S.chartReq) wrap.classList.remove('is-loading'); }
  }
  const reloadChartSoon = debounce(loadChart, 800);
  async function loadFeed() {
    try {
      const r = await api('/api/feed?limit=200'); const events = arr(Array.isArray(r) ? r : obj(r).events);
      const local = S.feed.filter((e) => e.local);
      S.feed = events.map(normEvent).filter(Boolean).sort((a, b) => b.t - a.t).concat(local).slice(0, FEED_MAX); renderFeed();
    } catch (e) { note('warn', `/api/feed failed: ${e.message || e}`); }
  }
  async function loadScorecard() {
    try { renderScorecard(await api(`/api/scorecard?by=${encodeURIComponent(S.scoreBy)}`)); }
    catch (e) { note('warn', `/api/scorecard failed: ${e.message || e}`); }
  }
  const reloadScorecardSoon = debounce(loadScorecard, 1500);
  const reloadStateSoon = debounce(loadState, 400);
  async function refreshAll() { await loadState(); await Promise.all([loadChart(), loadFeed(), loadScorecard()]); }

  // ---------- selection ----------
  function selectSymbol(id) { if (!id || id === S.active) return; S.active = id; store.set(STORE.symbol, id); renderAll(); loadChart(); }
  function selectTf(tf) { if (!TFS.includes(tf) || tf === S.tf) return; S.tf = tf; store.set(STORE.tf, tf); renderTfPills(); loadChart(); }

  // ---------- SSE ----------
  function openSse() {
    if (!window.EventSource) { note('warn', 'EventSource unsupported — polling only'); return; }
    const es = new EventSource('/events'); S.sse = es; const dot = $('sseDot');
    const parse = (e) => { try { return JSON.parse(e.data); } catch { return null; } };
    es.onopen = () => { dot.className = 'sse-dot is-open'; dot.title = 'Event stream: connected'; if (S.sseOpened) refreshAll(); S.sseOpened = true; };
    es.onerror = () => { dot.className = 'sse-dot is-down'; dot.title = 'Event stream: reconnecting…'; }; // EventSource reconnects by itself (retry: 3000)
    es.addEventListener('event', (e) => { const ev = parse(e); if (ev) pushFeed(ev); });
    es.addEventListener('status', (e) => {
      const st = obj(parse(e)); const s = S.symbols.find((x) => x.id === str(st.symbol)); if (!s) return;
      s.feed = { ...obj(s.feed), state: str(st.state, obj(s.feed).state), kind: str(st.kind, obj(s.feed).kind), detail: st.detail };
      renderTabs(); renderWatch(); if (s.id === S.active) renderHeader();
    });
    es.addEventListener('candle', (e) => {
      const m = obj(parse(e)); const c = obj(m.candle); const s = S.symbols.find((x) => x.id === str(m.symbol)); if (!s || num(c.c) == null) return;
      s.price = c.c; s.lastCandleT = num(c.t, s.lastCandleT);
      if (s.id === S.active) {
        if (S.dataKey === chartKey(s.id, str(m.tf))) { if (!Chart.update(c)) reloadChartSoon(); else if (c.closed) reloadChartSoon(); } // closed bar → indicators/levels need the server's recompute
        $('chartPrice').textContent = fmtPrice(c.c, num(s.dp, 2));
        const tab = document.querySelector('#symbolTabs .tab.is-active small'); if (tab) tab.textContent = fmtPrice(c.c, num(s.dp, 2));
      } else { const i = S.symbols.indexOf(s); const tab = document.querySelectorAll('#symbolTabs .tab small')[i]; if (tab) tab.textContent = fmtPrice(c.c, num(s.dp, 2)); }
    });
    es.addEventListener('setup', (e) => {
      const setup = obj(parse(e)); const s = S.symbols.find((x) => x.id === str(setup.symbol)); if (!s) return;
      s.lastSetup = setup; s.openSetup = str(setup.status, 'open') === 'open' ? setup : (obj(s.openSetup).id === setup.id ? null : s.openSetup);
      if (s.id === S.active) { renderCzt(); if (S.data) { Chart.setLevels(S.data); reloadChartSoon(); } }
      renderWatch(); reloadStateSoon(); reloadScorecardSoon();
    });
    es.addEventListener('levels', (e) => {
      const m = obj(parse(e)); if (!S.data || !S.dataKey || S.dataKey.split('|')[0] !== str(m.symbol)) return;
      S.data = { ...S.data, levels: arr(m.levels), zones: arr(m.zones), profile: m.profile ?? S.data.profile }; Chart.setLevels(S.data);
    });
  }

  // ---------- wiring ----------
  function wire() {
    $('themeBtn').addEventListener('click', () => Theme.toggle());
    if (Theme.media && Theme.media.addEventListener) Theme.media.addEventListener('change', () => Theme.sync());
    $('feedFilter').addEventListener('change', (e) => { S.feedFilter = e.target.value; renderFeed(); });
    $('scoreBy').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-by]'); if (!b) return; S.scoreBy = b.dataset.by;
      for (const x of $('scoreBy').querySelectorAll('button')) { const on = x === b; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', String(on)); }
      loadScorecard();
    });
    document.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return; const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|SELECT|TEXTAREA/.test(tag) || (e.target && e.target.isContentEditable)) return;
      if (/^[1-9]$/.test(e.key)) { const s = S.symbols[+e.key - 1]; if (s) selectSymbol(s.id); }
      else if (e.key === 't' || e.key === 'T') selectTf(TFS[(TFS.indexOf(S.tf) + 1) % TFS.length]);
      else if (e.key === 'd' || e.key === 'D') Theme.toggle();
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshAll(); });
    S.pollTimer = setInterval(() => { if (document.visibilityState !== 'hidden') loadState(); }, STATE_POLL_MS);
    window.addEventListener('beforeunload', () => { try { S.sse && S.sse.close(); } catch { /* closing */ } });
  }

  async function boot() {
    renderTfPills(); Theme.sync();
    if (!Chart.LW()) note('error', 'vendor/lightweight-charts.standalone.production.js did not load — chart disabled');
    Chart.init(); wire();
    await loadState();
    openSse();
    await Promise.all([loadChart(), loadFeed(), loadScorecard()]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  // Exposed for the browser console / Playwright checks only — nothing in the page depends on it.
  window.TradeGuard = { state: S, chart: Chart, selectSymbol, selectTf, refreshAll };
})();
