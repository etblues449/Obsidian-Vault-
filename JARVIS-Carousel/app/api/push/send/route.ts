// /api/push/send — fan a notification out to every registered device.
//
//   POST { title, body, tag?, url? }  →  { ok, sent, failed, pruned }
//
// Called by the Pi worker (executor/notify.py WebPushNotifier) with the same
// bearer token the dashboard uses. Expired subscriptions (404/410 from the
// push service) are pruned as they are discovered.
//
// Env (names only; set in Vercel):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   from `npx web-push generate-vapid-keys`
//   VAPID_SUBJECT                          mailto:you@example.com (or an https URL)
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY           the same public key, for the browser

import webpush from 'web-push'
import { requireAuth } from '../../_auth'
import * as db from '../../../lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

type Row = { id: number; endpoint: string; subscription: webpush.PushSubscription }

export async function POST(req: Request) {
  const denied = requireAuth(req)
  if (denied) return denied
  if (!db.configured()) {
    return Response.json({ ok: false, error: `${db.SUPABASE_ENV.url} / ${db.SUPABASE_ENV.key} are not set.` }, { status: 503 })
  }
  const pub = process.env.VAPID_PUBLIC_KEY?.trim()
  const priv = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:tradeguard@localhost'
  if (!pub || !priv) {
    return Response.json({ ok: false, error: 'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set.' }, { status: 503 })
  }

  let body: { title?: unknown; body?: unknown; tag?: unknown; url?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: 'bad json' }, { status: 400 })
  }
  const payload = JSON.stringify({
    title: String(body?.title ?? 'Trade Guard').slice(0, 120),
    body: String(body?.body ?? '').slice(0, 1000),
    tag: String(body?.tag ?? 'tradeguard').slice(0, 60),
    url: typeof body?.url === 'string' && body.url.startsWith('/') ? body.url : '/trade',
  })

  webpush.setVapidDetails(subject, pub, priv)
  let rows: Row[]
  try {
    rows = await db.select<Row>('push_subscriptions', { select: 'id,endpoint,subscription', limit: '200' })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }

  let sent = 0
  let failed = 0
  let pruned = 0
  await Promise.all(
    rows.map(async (r) => {
      try {
        await webpush.sendNotification(r.subscription, payload, { TTL: 600 })
        sent += 1
      } catch (e) {
        const status = (e as { statusCode?: number })?.statusCode
        if (status === 404 || status === 410) {
          pruned += 1
          try {
            await db.remove('push_subscriptions', { id: r.id })
          } catch {
            /* keep going */
          }
        } else {
          failed += 1
        }
      }
    }),
  )
  return Response.json({ ok: true, sent, failed, pruned, devices: rows.length })
}
