export const maxDuration = 60

const WEBHOOK = 'https://jellybean1875.app.n8n.cloud/webhook/jarvis-capture'

export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: 'bad json' }, { status: 400 })
  }

  const text = String(body?.note ?? '').trim()
  if (!text) return Response.json({ ok: false, error: 'empty' }, { status: 400 })

  const started = Date.now()
  const r = await fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: text, source: body?.source || 'vault-app' }),
  })

  const raw = await r.text()
  let data: any
  if (!raw) {
    // Junk Filter dropped it server-side (empty/placeholder capture)
    data = { ok: true, dropped: true }
  } else {
    try {
      data = JSON.parse(raw)
    } catch {
      data = { ok: r.ok, raw: raw.slice(0, 300) }
    }
  }
  data.ms = Date.now() - started
  return Response.json(data)
}
