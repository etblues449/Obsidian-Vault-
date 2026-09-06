'use client'

// Trade Guard — executor dashboard.
//
// Read-mostly view over the Pi worker's state (via /api/trade → Supabase),
// plus the three things a human needs to be able to do from a phone:
//   KILL / RESUME        stop new orders now (open positions keep their SL/TP)
//   manual gate checks   "signals arrive before the move", "broker is FCA-authorised"
// Everything shown is what the worker last reported; if the heartbeat is
// stale the page says so loudly rather than pretending the numbers are live.

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, captureTokenFromUrl } from '../lib/apiToken'
import type { Event, Settings, Trade, WorkerStatus } from '../api/trade/route'

type Snapshot = {
  ok: true
  now: number
  settings: Settings | null
  worker: { alive: boolean; age_s: number | null; status: WorkerStatus | null }
  open: Trade[]
  closed: Trade[]
  events: Event[]
}

const POLL_MS = 5000

function fmt(n: number | null | undefined, dp = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return n.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}
function signed(n: number | null | undefined, dp = 2): string {
  if (n === null || n === undefined) return '—'
  return (n > 0 ? '+' : '') + fmt(n, dp)
}
function ago(s: number | null): string {
  if (s === null) return 'never'
  if (s < 90) return `${Math.round(s)}s ago`
  if (s < 5400) return `${Math.round(s / 60)}m ago`
  if (s < 172800) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}
function when(ts: number | null | undefined): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString('en-GB', { timeZone: 'Europe/London', hour12: false,
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function short(s: string | null | undefined, n = 80): string {
  const t = (s ?? '').replace(/\s+/g, ' ')
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

export default function TradeGuard() {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [httpStatus, setHttpStatus] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    captureTokenFromUrl()
  }, [])

  const load = useCallback(async () => {
    try {
      const r = await apiFetch('/api/trade')
      setHttpStatus(r.status)
      const data = await r.json()
      if (data.ok) {
        setSnap(data as Snapshot)
        setError(null)
      } else {
        setError(data.error || `HTTP ${r.status}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'network error')
    }
  }, [])

  // Poll while the tab is visible; pause when hidden.
  useEffect(() => {
    let stopped = false
    const loop = async () => {
      if (stopped) return
      if (document.visibilityState === 'visible') await load()
      setTick((t) => t + 1)
      timer.current = setTimeout(loop, POLL_MS)
    }
    loop()
    const onVis = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      stopped = true
      if (timer.current) clearTimeout(timer.current)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [load])

  const act = useCallback(
    async (action: 'kill' | 'resume' | 'live_check' | 'broker_check', value?: boolean) => {
      if (busy) return
      if (action === 'kill' && !confirm('Halt all NEW orders now?\n\nOpen positions keep their broker-side stop-loss and take-profit.')) return
      if (action === 'resume' && !confirm('Resume placing orders?')) return
      setBusy(true)
      try {
        const r = await apiFetch('/api/trade', { method: 'POST', body: JSON.stringify({ action, value }) })
        const data = await r.json()
        if (!data.ok) setError(data.error || `HTTP ${r.status}`)
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'network error')
      } finally {
        setBusy(false)
      }
    },
    [busy, load],
  )

  const s = snap?.settings ?? null
  const ws = snap?.worker.status ?? null
  const alive = snap?.worker.alive ?? false
  const env = ws?.env ?? 'unknown'
  const killed = Boolean(s?.kill_switch) || Boolean(ws?.kill)
  const gates = ws?.gates ?? []
  const gatesPassed = gates.length ? gates.filter((g) => g.passed).length : 0

  return (
    <div className="tg">
      <style>{`
        .tg { min-height: 100dvh; background: #0a0612; color: #e9e4f5; padding: 14px 14px 28px;
          font-family: ui-monospace, 'Cascadia Mono', 'JetBrains Mono', Menlo, monospace; font-size: 13px;
          background-image: radial-gradient(ellipse 80% 40% at 50% 0%, rgba(88,28,135,0.25), transparent); }
        .hdr { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px;
          border-bottom: 1px solid rgba(233,228,245,0.12); }
        .glow { text-shadow: 0 0 18px rgba(167,139,250,0.6); }
        .label { font-size: 9px; letter-spacing: 0.22em; color: rgba(233,228,245,0.45); text-transform: uppercase; }
        .badge { display: inline-block; font-size: 10px; letter-spacing: 0.18em; padding: 3px 8px; border-radius: 3px; border: 1px solid; }
        .badge.practice { color: #6ee7b7; border-color: rgba(16,185,129,0.5); background: rgba(16,185,129,0.1); }
        .badge.live { color: #fca5a5; border-color: rgba(220,38,38,0.7); background: rgba(220,38,38,0.18); animation: pulse 1.6s infinite; }
        .badge.unknown { color: rgba(233,228,245,0.5); border-color: rgba(233,228,245,0.2); }
        .badge.dead { color: #fbbf24; border-color: rgba(251,191,36,0.6); background: rgba(251,191,36,0.1); }
        @keyframes pulse { 50% { opacity: 0.55; } }
        .alert { margin: 12px 0; padding: 10px 12px; border-radius: 4px; font-size: 12px; line-height: 1.5; }
        .alert.warn { background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.5); color: #fde68a; }
        .alert.err { background: rgba(220,38,38,0.12); border: 1px solid rgba(220,38,38,0.5); color: #fecaca; }
        .alert.kill { background: rgba(220,38,38,0.18); border: 1px solid #dc2626; color: #fff; font-weight: 700; letter-spacing: 0.1em; }
        .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
        .tile { padding: 10px; border-radius: 4px; background: rgba(124,58,237,0.10); border: 1px solid rgba(167,139,250,0.25); }
        .tile .v { font-size: 18px; color: #d8b4fe; margin-top: 2px; }
        .tile .v.pos { color: #6ee7b7; } .tile .v.neg { color: #fca5a5; }
        .sec { margin: 16px 0 6px; font-size: 10px; letter-spacing: 0.22em; color: rgba(233,228,245,0.55); text-transform: uppercase; }
        .btn { border-radius: 4px; font-size: 12px; letter-spacing: 0.18em; padding: 13px; text-align: center;
          border: 1px solid rgba(167,139,250,0.4); color: #d8b4fe; background: transparent; cursor: pointer; font-family: inherit; width: 100%; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn.kill { background: #dc2626; border-color: #dc2626; color: #fff; font-weight: 700; }
        .btn.resume { background: rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.6); color: #6ee7b7; }
        .row { display: flex; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(233,228,245,0.08); font-size: 12px; }
        .row .k { color: rgba(233,228,245,0.6); } .row .v { text-align: right; }
        .gate { display: flex; gap: 10px; align-items: flex-start; padding: 7px 0; border-bottom: 1px solid rgba(233,228,245,0.08); font-size: 12px; }
        .gate .dot { flex: 0 0 auto; width: 10px; height: 10px; border-radius: 50%; margin-top: 4px; background: #dc2626; }
        .gate .dot.ok { background: #10b981; }
        .gate small { display: block; color: rgba(233,228,245,0.5); }
        .check { display: flex; align-items: center; gap: 10px; padding: 9px 0; font-size: 12px; }
        .check input { width: 18px; height: 18px; accent-color: #7c3aed; }
        .tr { padding: 8px 0; border-bottom: 1px solid rgba(233,228,245,0.08); font-size: 12px; line-height: 1.5; }
        .tr b { color: #d8b4fe; }
        .ev { padding: 6px 0; border-bottom: 1px solid rgba(233,228,245,0.06); font-size: 11px; color: rgba(233,228,245,0.75); }
        .ev .k { color: #a78bfa; }
        .muted { color: rgba(233,228,245,0.45); font-size: 12px; padding: 8px 0; }
        code { background: rgba(233,228,245,0.08); padding: 1px 5px; border-radius: 3px; }
      `}</style>

      <div className="hdr">
        <div>
          <div className="text-lg font-bold tracking-[0.3em] glow">TRADE GUARD</div>
          <div className="label" style={{ marginTop: 4 }}>OANDA · {ws?.version ? `executor v${ws.version}` : 'executor'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className={`badge ${env === 'live' ? 'live' : env === 'practice' ? 'practice' : 'unknown'}`}>
            {env.toUpperCase()}{ws?.dry_run ? ' · DRY RUN' : ''}
          </span>
          <div className="label" style={{ marginTop: 6 }}>
            {alive ? `worker alive · ${ago(snap?.worker.age_s ?? null)}` : `worker offline · last seen ${ago(snap?.worker.age_s ?? null)}`}
          </div>
        </div>
      </div>

      {httpStatus === 401 && (
        <div className="alert warn">
          No token. Open this page once as <code>/trade#token=YOUR_TOKEN</code> (the same <code>JARVIS_API_TOKEN</code> the vault terminal uses); it is stored on this device and scrubbed from the address bar.
        </div>
      )}
      {error && httpStatus !== 401 && <div className="alert err">⚠ {error}</div>}
      {snap && !alive && (
        <div className="alert warn">
          The Pi worker has not reported for {ago(snap.worker.age_s)}. Numbers below are its last heartbeat, not live. Open positions still carry their broker-side SL/TP.
        </div>
      )}
      {killed && <div className="alert kill">⛔ KILL SWITCH ON — no new orders{ws?.kill ? ` (${ws.kill})` : ''}</div>}

      {/* kill / resume */}
      <div style={{ margin: '12px 0' }}>
        {s?.kill_switch ? (
          <button className="btn resume" disabled={busy || !snap} onClick={() => act('resume')}>RESUME ORDERS</button>
        ) : (
          <button className="btn kill" disabled={busy || !snap} onClick={() => act('kill')}>⛔ KILL — STOP NEW ORDERS</button>
        )}
      </div>

      {/* account tiles */}
      <div className="tiles">
        <div className="tile"><div className="label">NAV</div><div className="v">{fmt(ws?.nav)}</div></div>
        <div className="tile"><div className="label">Balance</div><div className="v">{fmt(ws?.balance)}</div></div>
        <div className="tile"><div className="label">Gold</div><div className="v">{fmt(ws?.price, 2)}</div></div>
      </div>

      {/* scorecard */}
      <div className="sec">Scorecard</div>
      <div className="tiles">
        <div className="tile"><div className="label">Closed</div><div className="v">{ws?.stats?.n ?? '—'}</div></div>
        <div className="tile"><div className="label">Win rate</div><div className="v">{ws?.stats?.win_rate != null ? `${fmt(ws.stats.win_rate, 0)}%` : '—'}</div></div>
        <div className="tile"><div className="label">Profit factor</div><div className="v">{ws?.stats ? (ws.stats.pf === null ? (ws.stats.n ? '∞' : '—') : fmt(ws.stats.pf, 2)) : '—'}</div></div>
        <div className="tile"><div className="label">Max DD</div><div className="v">{ws?.stats?.max_dd != null ? `${fmt(ws.stats.max_dd, 1)}%` : '—'}</div></div>
        <div className="tile"><div className="label">Net P&L</div><div className={`v ${(ws?.stats?.net ?? 0) > 0 ? 'pos' : (ws?.stats?.net ?? 0) < 0 ? 'neg' : ''}`}>{signed(ws?.stats?.net)}</div></div>
        <div className="tile"><div className="label">Days</div><div className="v">{ws?.stats ? fmt(ws.stats.days, 0) : '—'}</div></div>
      </div>

      {/* gates */}
      <div className="sec">Funding gates · {gates.length ? `${gatesPassed}/${gates.length}` : '—'}</div>
      {gates.length === 0 && <div className="muted">No heartbeat yet — the worker reports the gates every minute.</div>}
      {gates.map((g, i) => (
        <div className="gate" key={i}>
          <div className={`dot ${g.passed ? 'ok' : ''}`} />
          <div>{g.label}<small>{g.detail}</small></div>
        </div>
      ))}
      <label className="check">
        <input type="checkbox" checked={Boolean(s?.live_check)} disabled={busy || !s} onChange={(e) => act('live_check', e.target.checked)} />
        Signals arrive <b>before</b> the move, with entry / SL / TP — never after-the-fact
      </label>
      <label className="check">
        <input type="checkbox" checked={Boolean(s?.broker_check)} disabled={busy || !s} onChange={(e) => act('broker_check', e.target.checked)} />
        Execution broker is FCA-authorised (OANDA Europe, FRN 542574)
      </label>

      {/* open trades */}
      <div className="sec">Open · {snap?.open.length ?? '—'}</div>
      {snap && snap.open.length === 0 && <div className="muted">No open positions.</div>}
      {snap?.open.map((t) => (
        <div className="tr" key={t.id}>
          <b>{t.side > 0 ? 'BUY' : 'SELL'} {t.units} {t.instrument}</b> @ {fmt(t.entry, 2)} · SL {fmt(t.sl, 2)} · TP {fmt(t.tp, 2)}
          <br /><span className="muted">{when(t.open_time)} · trade {t.id} · {t.env}</span>
        </div>
      ))}

      {/* closed trades */}
      <div className="sec">Closed · last {snap?.closed.length ?? 0}</div>
      {snap && snap.closed.length === 0 && <div className="muted">Nothing closed yet.</div>}
      {snap?.closed.map((t) => (
        <div className="tr" key={t.id}>
          <b style={{ color: t.realized_pl > 0 ? '#6ee7b7' : t.realized_pl < 0 ? '#fca5a5' : '#d8b4fe' }}>{signed(t.realized_pl)}</b>{' '}
          {t.side > 0 ? 'BUY' : 'SELL'} {t.units} @ {fmt(t.entry, 2)} → {fmt(t.close_price, 2)} · {t.close_reason || 'closed'}
          <br /><span className="muted">{when(t.close_time)} · {t.env}</span>
        </div>
      ))}

      {/* events */}
      <div className="sec">Events</div>
      {snap && snap.events.length === 0 && <div className="muted">No events yet.</div>}
      {snap?.events.map((e) => (
        <div className="ev" key={e.id}>
          {when(e.ts)} <span className="k">{e.kind}</span> {short(e.payload ? JSON.stringify(e.payload) : '', 140)}
        </div>
      ))}

      <div className="muted" style={{ marginTop: 16 }}>
        Refreshes every {POLL_MS / 1000}s while visible · tick {tick} · practice-first; live only via a passed gate or the explicit override, both logged.
      </div>
    </div>
  )
}
