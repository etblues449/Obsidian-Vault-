// /api/push — Web Push subscription registry for the Trade Guard dashboard.
//
//   GET     { ok, publicKey, count }      is push configured, how many devices
//   POST    { subscription }              register this device (upsert by endpoint)
//   DELETE  { endpoint }                  unregister
//
// Bearer-gated like every other route. Subscriptions live in Supabase
// (push_subscriptions; RLS on, no anon access). Sending is /api/push/send.

import { requireAuth } from '../_auth'
import * as db from '../../lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

type Sub = { endpoint?: unknown; keys?: unknown }

function notConfigured(): Response {
  return Response.json(
    { ok: false, error: `${db.SUPABASE_ENV.url} / ${db.SUPABASE_ENV.key} are not set in this environment.` },
    { status: 503 },
  )
}

export async function GET(req: Request) {
  const denied = requireAuth(req)
  if (denied) return denied
  if (!db.configured()) return notConfigured()
  try {
    const rows = await db.select<{ id: number }>('push_subscriptions', { select: 'id', limit: '1000' })
    return Response.json({
      ok: true,
      publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
      count: rows.length,
    })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}

export async function POST(req: Request) {
  const denied = requireAuth(req)
  if (denied) return denied
  if (!db.configured()) return notConfigured()
  let body: { subscription?: Sub }
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: 'bad json' }, { status: 400 })
  }
  const sub = body?.subscription
  if (!sub || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://')) {
    return Response.json({ ok: false, error: 'subscription.endpoint missing' }, { status: 400 })
  }
  try {
    await db.upsert(
      'push_subscriptions',
      { endpoint: sub.endpoint, subscription: sub, user_agent: (req.headers.get('user-agent') ?? '').slice(0, 200) },
      'endpoint',
    )
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}

export async function DELETE(req: Request) {
  const denied = requireAuth(req)
  if (denied) return denied
  if (!db.configured()) return notConfigured()
  let body: { endpoint?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: 'bad json' }, { status: 400 })
  }
  if (typeof body?.endpoint !== 'string') {
    return Response.json({ ok: false, error: 'endpoint missing' }, { status: 400 })
  }
  try {
    await db.remove('push_subscriptions', { endpoint: body.endpoint })
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}
