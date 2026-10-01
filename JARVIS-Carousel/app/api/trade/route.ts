// /api/trade — the Trade Guard dashboard's only door to Supabase.
//
//   GET   snapshot: settings (+ the worker's last heartbeat), open trades,
//         recent closed trades, recent events
//   POST  { action: 'kill' | 'resume' | 'live_check' | 'broker_check', value?: boolean }
//
// Bearer-gated by requireAuth (JARVIS_API_TOKEN), like /api/chat and
// /api/capture. The browser never holds a Supabase key: the page polls this
// route, and every write it makes is also written to the events table so the
// worker's log and the dashboard's log are one log.

import { requireAuth } from '../_auth'
import * as db from '../../lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** The worker's heartbeat is every 60 s; three missed beats = offline. */
const ALIVE_AFTER_S = 180

export type Gate = { passed: boolean; label: string; detail: string }
export type WorkerStatus = {
  ts: number
  env: 'practice' | 'live' | string
  dry_run: boolean
  balance: number
  nav: number
  open_trades: number
  kill: string | null
  price: number | null
  stats: {
    n: number
    win_rate: number | null
    pf: number | null
    max_dd: number | null
    net: number
    days: number
  }
  gates: Gate[]
  version: string
}
export type Settings = {
  id: number
  kill_switch: boolean
  live_check: boolean
  broker_check: boolean
  worker_status: WorkerStatus | null
  updated_at?: string
}
export type Trade = {
  id: string
  signal_id: string | null
  instrument: string
  side: number
  units: number
  entry: number
  sl: number | null
  tp: number | null
  open_time: number
  close_time: number | null
  close_price: number | null
  realized_pl: number
  status: string
  close_reason?: string | null
  env: string
}
export type Event = { id: number; ts: number; kind: string; env: string; payload: Record<string, unknown> | null }

function notConfigured(): Response {
  return Response.json(
    {
      ok: false,
      error:
        `${db.SUPABASE_ENV.url} / ${db.SUPABASE_ENV.key} are not set in this environment. ` +
        'Add them in Vercel → Settings → Environment Variables and redeploy.',
    },
    { status: 503 },
  )
}

function fail(e: unknown): Response {
  const status = e instanceof db.SupabaseError ? (e.status === 503 ? 503 : 502) : 500
  return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status })
}

export async function GET(req: Request) {
  const denied = requireAuth(req)
  if (denied) return denied
  if (!db.configured()) return notConfigured()
  try {
    const [settingsRows, open, closed, events] = await Promise.all([
      db.select<Settings>('settings', { id: 'eq.1', limit: '1' }),
      db.select<Trade>('trades', { status: 'eq.open', order: 'open_time.desc', limit: '20' }),
      db.select<Trade>('trades', { status: 'eq.closed', order: 'close_time.desc', limit: '50' }),
      db.select<Event>('events', { order: 'ts.desc', limit: '60' }),
    ])
    const settings = settingsRows[0] ?? null
    const ws = settings?.worker_status ?? null
    const now = Date.now() / 1000
    const age = ws && typeof ws.ts === 'number' ? now - ws.ts : null
    return Response.json({
      ok: true,
      now,
      settings,
      worker: { alive: age !== null && age < ALIVE_AFTER_S, age_s: age, status: ws },
      open,
      closed,
      events,
    })
  } catch (e) {
    return fail(e)
  }
}

const ACTIONS = new Set(['kill', 'resume', 'live_check', 'broker_check'])

export async function POST(req: Request) {
  const denied = requireAuth(req)
  if (denied) return denied
  if (!db.configured()) return notConfigured()

  let body: { action?: unknown; value?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: 'bad json' }, { status: 400 })
  }
  const action = String(body?.action ?? '')
  if (!ACTIONS.has(action)) {
    return Response.json({ ok: false, error: `unknown action: ${action}` }, { status: 400 })
  }
  const patch: Record<string, boolean> =
    action === 'kill'
      ? { kill_switch: true }
      : action === 'resume'
        ? { kill_switch: false }
        : { [action]: Boolean(body?.value) }

  try {
    const rows = await db.update<Settings>('settings', { id: 1 }, patch)
    await db.insert('events', {
      ts: Date.now() / 1000,
      kind: `dashboard_${action}`,
      env: 'dashboard',
      payload: { ...patch, ua: (req.headers.get('user-agent') ?? '').slice(0, 120) },
    })
    return Response.json({ ok: true, settings: rows[0] ?? null })
  } catch (e) {
    return fail(e)
  }
}
