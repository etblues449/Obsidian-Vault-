// Shared bearer-token gate for JARVIS Carousel API routes.
//
// Fail-CLOSED by design: if JARVIS_API_TOKEN is not set in the environment,
// every guarded route returns 503 and refuses to run. This is deliberate —
// an unauthenticated /api/chat spends Anthropic credits for anyone on the
// internet, and /api/capture injects into the vault pipeline. A missing
// secret must lock the door, not leave it open.
//
// The client sends the token one of three ways (constant-time compared):
//   Authorization: Bearer <token>
//   X-Auth-Token: <token>
//   ?token=<token>            (only path a plain <audio>/EventSource can use)
//
// Set the secret in Vercel → Project → Settings → Environment Variables,
// then redeploy. Keep the value out of the repo.

import { timingSafeEqual } from 'node:crypto'

export const AUTH_ENV = 'JARVIS_API_TOKEN'

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  // timingSafeEqual throws on length mismatch; compare against a fixed-size
  // digest-free guard by padding to equal length first.
  if (ab.length !== bb.length) {
    // Still burn a compare so length isn't a timing oracle.
    try { timingSafeEqual(ab, ab) } catch {}
    return false
  }
  return timingSafeEqual(ab, bb)
}

function presentedToken(request: Request): string {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim()
  const x = request.headers.get('x-auth-token')
  if (x) return x.trim()
  try {
    const u = new URL(request.url)
    const q = u.searchParams.get('token')
    if (q) return q.trim()
  } catch {}
  return ''
}

/**
 * Returns a Response to send immediately when the request is NOT authorized,
 * or null when the caller may proceed.
 *
 *   const denied = requireAuth(request)
 *   if (denied) return denied
 */
export function requireAuth(request: Request): Response | null {
  const expected = process.env[AUTH_ENV]?.trim()
  if (!expected) {
    return Response.json(
      {
        ok: false,
        error:
          `${AUTH_ENV} is not set in this environment. This endpoint is ` +
          `locked until it is configured. Add ${AUTH_ENV} in Vercel → ` +
          `Settings → Environment Variables and redeploy.`,
      },
      { status: 503 },
    )
  }
  const got = presentedToken(request)
  if (!got || !constantTimeEqual(got, expected)) {
    return Response.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
    )
  }
  return null
}
