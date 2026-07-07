'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Message = {
  role: 'user' | 'assistant'
  text: string
  ts: number
}

type PhoneAction = {
  label: string
  // Tasker HTTP Request profile listens on a fixed path per action type
  // (Tasker 6.6.20 doesn't populate %http_request_body/query/path, so the
  // path itself is the signal — the body is advisory only).
  endpoint: 'alarm' | 'timer'
  tasker: { task: string; par1: string; par2: string }
  // Android intent: scheme URL — the ONLY way to trigger a phone action from
  // a deployed HTTPS origin (localhost bridge is blocked as mixed content).
  intent: string
}

function detectAction(text: string): PhoneAction | null {
  let m = text.match(/alarm\s*(?:for|at)?\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/i)
  if (m) {
    let H = parseInt(m[1], 10)
    const M = m[2] ? parseInt(m[2], 10) : 0
    const ap = m[3]?.toLowerCase()
    if (ap === 'pm' && H < 12) H += 12
    if (ap === 'am' && H === 12) H = 0
    if (H > 23 || M > 59) return null
    const hh = String(H).padStart(2, '0')
    const mm = String(M).padStart(2, '0')
    return {
      label: `ALARM ${hh}:${mm}`,
      endpoint: 'alarm',
      tasker: { task: 'Jarvis Alarm', par1: `${hh}:${mm}`, par2: 'JARVIS' },
      intent: `intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR=${H};i.android.intent.extra.alarm.MINUTES=${M};S.android.intent.extra.alarm.MESSAGE=JARVIS;end`,
    }
  }
  m = text.match(/timer\s*(?:for)?\s*(\d+)\s*(hours?|hrs?|minutes?|mins?)?/i)
  if (m) {
    const n = parseInt(m[1], 10)
    const mins = /h/i.test(m[2] || 'min') ? n * 60 : n
    if (!mins || mins > 24 * 60) return null
    return {
      label: `TIMER ${mins} MIN`,
      endpoint: 'timer',
      tasker: { task: 'Jarvis Timer', par1: String(mins), par2: 'JARVIS' },
      intent: `intent:#Intent;action=android.intent.action.SET_TIMER;i.android.intent.extra.alarm.LENGTH=${mins * 60};S.android.intent.extra.alarm.MESSAGE=JARVIS;end`,
    }
  }
  return null
}

// On-device Tasker HTTP Request bridge. Only reachable when the app is served
// from the SAME device that runs Tasker (i.e. the phone opening a local/http
// origin). From a deployed HTTPS page this is blocked as mixed content and the
// intent: fallback below takes over. Each action POSTs to a fixed sub-path
// (/alarm, /timer) that matches a Tasker profile.
const TASKER_BRIDGE = 'http://localhost:1337/'

export default function Vault() {
  const [clock, setClock] = useState('--:--:--')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [listening, setListening] = useState(false)
  const [replying, setReplying] = useState(false)
  const [lastAction, setLastAction] = useState<
    (PhoneAction & { outcome: 'tasker' | 'fallback' }) | null
  >(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const recRef = useRef<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Clock
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

  // Particle core
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

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-start voice on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      startListening()
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  const startListening = useCallback(() => {
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
    rec.interimResults = false
    rec.continuous = false
    rec.onresult = (e: any) => {
      let s = ''
      for (const res of e.results) s += res[0].transcript
      if (s.trim()) {
        setInput(s)
        send(s)
      }
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    rec.start()
    setListening(true)
  }, [listening])

  const send = useCallback(
    async (text?: string) => {
      const msg = text || input.trim()
      if (!msg || replying) return

      setInput('')
      setReplying(true)
      setLastAction(null)

      // Add user message
      const userMsg: Message = { role: 'user', text: msg, ts: Date.now() }
      setMessages((m) => [...m, userMsg])

      // Detect phone actions
      const action = detectAction(msg)
      if (action) {
        try {
          const ctl = new AbortController()
          const to = setTimeout(() => ctl.abort(), 2500)
          // POST to the action's fixed path (/alarm, /timer) so the matching
          // Tasker profile fires. Works only when reachable on-device.
          await fetch(TASKER_BRIDGE + action.endpoint, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(action.tasker),
            signal: ctl.signal,
          })
          clearTimeout(to)
          setLastAction({ ...action, outcome: 'tasker' })
        } catch {
          // Bridge unreachable (deployed HTTPS / not on the phone). Surface the
          // intent: link so the user can fire the native alarm/timer with a tap.
          setLastAction({ ...action, outcome: 'fallback' })
        }
      }

      // Get Claude response
      try {
        const r = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg }),
        })
        const data = await r.json()
        if (data.ok && data.reply) {
          const assistantMsg: Message = { role: 'assistant', text: data.reply, ts: Date.now() }
          setMessages((m) => [...m, assistantMsg])
        }
      } catch (error) {
        console.error('Chat error:', error)
      }

      setReplying(false)
      // Auto-listen again after response
      setTimeout(() => {
        startListening()
      }, 500)
    },
    [input, replying, startListening],
  )

  return (
    <div className="vault">
      <style>{`
        .vault {
          min-height: 100dvh; background: #0a0612; color: #e9e4f5;
          font-family: ui-monospace, 'Cascadia Mono', 'JetBrains Mono', Menlo, monospace;
          display: flex; flex-direction: column; padding: 14px 14px 20px;
          background-image: radial-gradient(ellipse 80% 50% at 50% 32%, rgba(88,28,135,0.25), transparent);
        }
        .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px;
          border-bottom: 1px solid rgba(233,228,245,0.12); }
        .glow { text-shadow: 0 0 18px rgba(167,139,250,0.6); }
        .label { font-size: 9px; letter-spacing: 0.22em; color: rgba(233,228,245,0.45); }
        .val { color: #d8b4fe; }
        .orb { position: relative; height: 140px; margin: 12px 0; }
        .messages { flex: 1; overflow-y: auto; margin: 12px 0; display: flex; flex-direction: column; gap: 10px; }
        .msg { padding: 10px 12px; border-radius: 4px; max-width: 90%; word-wrap: break-word; font-size: 13px; line-height: 1.5; }
        .msg.user { align-self: flex-end; background: rgba(124,58,237,0.25); border: 1px solid rgba(167,139,250,0.4); color: #e9e4f5; }
        .msg.assistant { align-self: flex-start; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); color: #a7e8c9; }
        .action-banner { font-size: 11px; padding: 8px 10px; border-radius: 3px; background: rgba(16,185,129,0.12);
          border: 1px solid rgba(16,185,129,0.4); color: #6ee7b7; margin: 8px 0; }
        .action-link { color: #6ee7b7; font-weight: 700; text-decoration: underline; cursor: pointer; }
        .action-link:active { color: #34d399; }
        .input-area { display: flex; gap: 8px; margin-top: 10px; }
        .btn { border-radius: 4px; font-size: 12px; letter-spacing: 0.18em; padding: 11px;
          text-align: center; border: 1px solid rgba(167,139,250,0.4); color: #d8b4fe; background: transparent;
          cursor: pointer; font-family: inherit; }
        .btn:active { background: rgba(124,58,237,0.2); }
        .btn.mic { flex: 1; }
        .btn.mic.on { background: #dc2626; border-color: #dc2626; color: #fff; animation: pulse 1.2s infinite; }
        .btn.send { flex: 2; background: #7c3aed; color: #fff; border: none; }
        .btn.send:disabled { opacity: 0.5; cursor: not-allowed; }
        @keyframes pulse { 50% { opacity: 0.6; } }
        .scrollable::-webkit-scrollbar { width: 4px; }
        .scrollable::-webkit-scrollbar-thumb { background: rgba(167,139,250,0.4); border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div className="header">
        <div>
          <div className="text-lg font-bold tracking-[0.3em] glow">J.A.R.V.I.S</div>
          <div className="label mt-1">JUST A REALLY VALUABLE INTELLIGENT SYSTEM</div>
        </div>
        <div className="text-right">
          <div className="text-lg val glow">{clock}</div>
          <div className="label mt-1">{listening ? 'LISTENING…' : 'READY'}</div>
        </div>
      </div>

      {/* Particle core */}
      <div className="orb">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>

      {/* Action confirmation */}
      {lastAction && (
        <div className="action-banner">
          ⚡ {lastAction.label}{' '}
          {lastAction.outcome === 'tasker' ? (
            '→ SENT'
          ) : (
            // Bridge unreachable — offer the native Android intent as a one-tap
            // link. This is what makes actions work from the deployed HTTPS URL.
            <a className="action-link" href={lastAction.intent}>
              TAP TO SET ON PHONE →
            </a>
          )}
        </div>
      )}

      {/* Conversation */}
      <div className="messages scrollable">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'rgba(233,228,245,0.4)', fontSize: '12px', marginTop: '20px' }}>
            Say something to get started…
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input + controls */}
      <div className="input-area">
        <button
          className={`btn mic ${listening ? 'on' : ''}`}
          onClick={startListening}
          disabled={replying}
        >
          {listening ? '● REC' : '🎙'}
        </button>
        <button
          className="btn send"
          onClick={() => send()}
          disabled={!input.trim() || replying}
        >
          {replying ? 'THINKING…' : 'SEND'}
        </button>
      </div>
    </div>
  )
}
