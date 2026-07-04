'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type LogEntry = {
  ts: number
  text: string
  category?: string
  path?: string
  ok: boolean
  dropped?: boolean
  ms?: number
}

const CHIPS = [
  { label: '+ NOTE', prefix: '' },
  { label: '+ TASK', prefix: 'task: ' },
  { label: '# BELIEF', prefix: '#belief ' },
  { label: '# DECISION', prefix: '#decision ' },
  { label: '? ASK', prefix: 'question: ' },
]

const SCHEDULE = [
  { t: 'DAILY 07:00', s: 'MORNING BRIEF', out: 'briefings/' },
  { t: 'MON 08:00', s: 'PATTERN DETECTOR', out: 'patterns.md' },
  { t: 'FRI 18:00', s: 'WEEKLY SYNTHESIS', out: 'synthesis/' },
  { t: 'SUN 14:00', s: 'CONNECTION FINDER', out: 'connections/' },
]

function loadLog(): LogEntry[] {
  try {
    return JSON.parse(localStorage.getItem('vault-log') || '[]')
  } catch {
    return []
  }
}

export default function Vault() {
  const [clock, setClock] = useState('--:--:--')
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'dropped' | 'error'>('idle')
  const [lastResult, setLastResult] = useState<LogEntry | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])
  const [listening, setListening] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const recRef = useRef<any>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // clock
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString('en-GB', {
          hour12: false,
          timeZone: 'Europe/London',
        }),
      )
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // log from storage
  useEffect(() => setLog(loadLog()), [])

  // particle core
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const N = 130
    const pts: { x: number; y: number; z: number }[] = []
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2
      const r = Math.sqrt(1 - y * y)
      const th = golden * i
      pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r })
    }

    let raf = 0
    let t = 0
    const render = () => {
      const w = (canvas.width = canvas.offsetWidth * 2)
      const h = (canvas.height = canvas.offsetHeight * 2)
      const cx = w / 2
      const cy = h / 2
      const R = Math.min(w, h) * 0.36
      ctx.clearRect(0, 0, w, h)

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6)
      grad.addColorStop(0, 'rgba(124,58,237,0.28)')
      grad.addColorStop(0.6, 'rgba(124,58,237,0.08)')
      grad.addColorStop(1, 'rgba(124,58,237,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)

      t += 0.004
      const proj = pts.map((p) => {
        const x1 = p.x * Math.cos(t) - p.z * Math.sin(t)
        const z1 = p.x * Math.sin(t) + p.z * Math.cos(t)
        const y1 = p.y * Math.cos(t * 0.6) - z1 * 0.15 * Math.sin(t * 0.6)
        const scale = 1 / (1.6 - z1 * 0.5)
        return { X: cx + x1 * R * scale, Y: cy + y1 * R * scale, z: z1 }
      })

      ctx.lineWidth = 1
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = proj[i].X - proj[j].X
          const dy = proj[i].Y - proj[j].Y
          const d2 = dx * dx + dy * dy
          if (d2 < R * R * 0.16) {
            const a = 0.12 * (1 - d2 / (R * R * 0.16))
            ctx.strokeStyle = `rgba(167,139,250,${a})`
            ctx.beginPath()
            ctx.moveTo(proj[i].X, proj[i].Y)
            ctx.lineTo(proj[j].X, proj[j].Y)
            ctx.stroke()
          }
        }
      }
      for (const p of proj) {
        const bright = 0.35 + (p.z + 1) * 0.3
        ctx.fillStyle = `rgba(216,180,254,${bright})`
        ctx.beginPath()
        ctx.arc(p.X, p.Y, 2.4 + (p.z + 1) * 1.4, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(render)
    }
    render()
    return () => cancelAnimationFrame(raf)
  }, [])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || status === 'sending') return
    setStatus('sending')
    try {
      const r = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: text, source: 'vault-app' }),
      })
      const data = await r.json()
      const entry: LogEntry = {
        ts: Date.now(),
        text,
        ok: !!data.ok,
        dropped: !!data.dropped,
        category: data.category,
        path: data.path,
        ms: data.ms,
      }
      const next = [entry, ...loadLog()].slice(0, 30)
      localStorage.setItem('vault-log', JSON.stringify(next))
      setLog(next)
      setLastResult(entry)
      setStatus(data.ok ? (data.dropped ? 'dropped' : 'ok') : 'error')
      if (data.ok) setInput('')
    } catch {
      setStatus('error')
      setLastResult({ ts: Date.now(), text, ok: false })
    }
  }, [input, status])

  const toggleMic = useCallback(() => {
    const w = window as any
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) {
      alert('Voice input not supported in this browser')
      return
    }
    if (listening) {
      recRef.current?.stop()
      setListening(false)
      return
    }
    const rec = new SR()
    recRef.current = rec
    rec.lang = 'en-GB'
    rec.interimResults = true
    rec.continuous = false
    rec.onresult = (e: any) => {
      let s = ''
      for (const res of e.results) s += res[0].transcript
      setInput(s)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    rec.start()
    setListening(true)
  }, [listening])

  const today = new Date().toDateString()
  const capturesToday = log.filter((l) => new Date(l.ts).toDateString() === today && l.ok && !l.dropped).length
  const last = log.find((l) => l.ok && !l.dropped)

  return (
    <div className="vault">
      <style>{`
        .vault {
          min-height: 100dvh; background: #0a0612; color: #e9e4f5;
          font-family: ui-monospace, 'Cascadia Mono', 'JetBrains Mono', Menlo, monospace;
          display: flex; flex-direction: column; padding: 14px 14px 24px;
          background-image: radial-gradient(ellipse 80% 50% at 50% 32%, rgba(88,28,135,0.25), transparent);
        }
        .hairline { border: 1px solid rgba(233,228,245,0.12); }
        .panel { border: 1px solid rgba(233,228,245,0.12); border-radius: 4px; padding: 10px 12px; background: rgba(10,6,18,0.6); }
        .label { font-size: 9px; letter-spacing: 0.22em; color: rgba(233,228,245,0.45); }
        .val { color: #d8b4fe; }
        .glow { text-shadow: 0 0 18px rgba(167,139,250,0.6); }
        .chip { border: 1px solid rgba(167,139,250,0.35); color: #d8b4fe; font-size: 10px;
          letter-spacing: 0.14em; padding: 6px 10px; border-radius: 3px; background: rgba(124,58,237,0.08); }
        .chip:active { background: rgba(124,58,237,0.3); }
        textarea.cap {
          width: 100%; background: rgba(20,12,34,0.8); border: 1px solid rgba(167,139,250,0.3);
          border-radius: 4px; color: #f3eefc; padding: 12px; font: inherit; font-size: 14px;
          resize: none; outline: none; min-height: 74px;
        }
        textarea.cap:focus { border-color: rgba(167,139,250,0.8); box-shadow: 0 0 0 1px rgba(167,139,250,0.4); }
        .btn { border-radius: 4px; font-size: 12px; letter-spacing: 0.18em; padding: 13px 0;
          text-align: center; width: 100%; }
        .send { background: #7c3aed; color: #fff; }
        .send:disabled { opacity: 0.5; }
        .mic { border: 1px solid rgba(167,139,250,0.4); color: #d8b4fe; background: transparent; }
        .mic.on { background: #dc2626; border-color: #dc2626; color: #fff; animation: pulse 1.2s infinite; }
        @keyframes pulse { 50% { opacity: 0.6; } }
        .logrow { border-bottom: 1px solid rgba(233,228,245,0.07); padding: 7px 0; font-size: 11px; }
        .ok { color: #6ee7b7; } .drop { color: #fbbf24; } .err { color: #f87171; }
        .banner { font-size: 11px; letter-spacing: 0.08em; padding: 9px 11px; border-radius: 3px; }
        .banner.ok { background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.4); color: #6ee7b7; }
        .banner.dropped { background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.4); color: #fbbf24; }
        .banner.error { background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.4); color: #f87171; }
        .banner.sending { background: rgba(124,58,237,0.12); border: 1px solid rgba(124,58,237,0.5); color: #d8b4fe; animation: pulse 1.2s infinite; }
      `}</style>

      {/* header */}
      <div className="flex items-start justify-between pb-3">
        <div>
          <div className="text-lg font-bold tracking-[0.3em] glow">V.A.U.L.T.</div>
          <div className="label mt-1">VOICE-ACTIVATED UNIFIED LOGGING TERMINAL</div>
        </div>
        <div className="text-right">
          <div className="text-lg val glow">{clock}</div>
          <div className="label mt-1">CORE · LINK · <span className="ok">ONLINE</span></div>
        </div>
      </div>
      <div className="hairline" style={{ borderWidth: '1px 0 0 0' }} />

      {/* orb + stat */}
      <div className="relative" style={{ height: 190 }}>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        <div className="absolute inset-x-0 bottom-1 text-center">
          <span className="text-3xl font-bold glow val">{capturesToday}</span>
          <span className="label ml-2">CAPTURES TODAY</span>
        </div>
      </div>

      {/* status banner */}
      {status !== 'idle' && (
        <div className={`banner ${status} mb-2`}>
          {status === 'sending' && '▸ TRANSMITTING TO VAULT…'}
          {status === 'ok' && lastResult && (
            <>✓ FILED → {lastResult.category || 'VAULT'}{lastResult.path ? ` · ${lastResult.path.split('/').pop()}` : ''}{lastResult.ms ? ` · ${(lastResult.ms / 1000).toFixed(1)}s` : ''}</>
          )}
          {status === 'dropped' && '⚠ DROPPED BY JUNK FILTER (empty/placeholder)'}
          {status === 'error' && '✗ TRANSMISSION FAILED — RETRY'}
        </div>
      )}

      {/* capture input */}
      <textarea
        ref={inputRef}
        className="cap"
        placeholder="Speak or type a capture…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            send()
          }
        }}
      />

      {/* chips */}
      <div className="flex gap-2 flex-wrap mt-2">
        {CHIPS.map((c) => (
          <button
            key={c.label}
            className="chip"
            onClick={() => {
              setInput((v) => (c.prefix && !v.startsWith(c.prefix) ? c.prefix + v : v))
              inputRef.current?.focus()
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* actions */}
      <div className="grid grid-cols-[1fr_2fr] gap-2 mt-3">
        <button className={`btn mic ${listening ? 'on' : ''}`} onClick={toggleMic}>
          {listening ? '● REC' : '🎙 VOICE'}
        </button>
        <button className="btn send" onClick={send} disabled={status === 'sending' || !input.trim()}>
          {status === 'sending' ? 'TRANSMITTING…' : 'CAPTURE ▸'}
        </button>
      </div>

      {/* vitals + schedule */}
      <div className="grid grid-cols-2 gap-2 mt-4">
        <div className="panel">
          <div className="label mb-2">SYSTEM VITALS</div>
          <div className="text-[11px] leading-5">
            <div>TODAY <span className="val float-right">{capturesToday}</span></div>
            <div>LOGGED <span className="val float-right">{log.filter((l) => l.ok && !l.dropped).length}</span></div>
            <div>LAST <span className="val float-right">{last ? new Date(last.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</span></div>
            <div>PIPE <span className="ok float-right">LIVE</span></div>
          </div>
        </div>
        <div className="panel">
          <div className="label mb-2">COMMAND DECK</div>
          <div className="text-[10px] leading-5">
            {SCHEDULE.map((s) => (
              <div key={s.s}>
                <span className="val">{s.t}</span> {s.s}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* transcript */}
      <div className="panel mt-2">
        <div className="label mb-1">TRANSCRIPT</div>
        {log.length === 0 && <div className="text-[11px] opacity-40 py-2">No captures yet from this device.</div>}
        {log.slice(0, 8).map((l) => (
          <div className="logrow flex justify-between gap-3" key={l.ts}>
            <span className="truncate opacity-80">{l.text}</span>
            <span className={l.dropped ? 'drop' : l.ok ? 'ok' : 'err'} style={{ whiteSpace: 'nowrap' }}>
              {l.dropped ? 'DROPPED' : l.ok ? `✓ ${l.category || 'FILED'}` : '✗ FAILED'}
            </span>
          </div>
        ))}
      </div>

      <div className="label text-center mt-4">
        JARVIS · SINGLE-WRITER PIPELINE · n8n → CLAUDE → GITHUB → OBSIDIAN
      </div>
    </div>
  )
}
