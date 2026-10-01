// Server-only PostgREST helper for the Trade Guard dashboard (/api/trade).
//
// Uses the Supabase SERVICE-ROLE key, which bypasses RLS — the trading tables
// deliberately have NO anon policies, so this is the only way in. Never import
// this module from a client component; it only ever runs inside route
// handlers, which sit behind requireAuth() from app/api/_auth.ts.
//
// Env (names only — values live in Vercel → Settings → Environment Variables):
//   SUPABASE_URL          https://<project>.supabase.co
//   SUPABASE_SERVICE_KEY  the service_role key
//
// Zero dependencies on purpose: plain fetch against /rest/v1, the same
// PostgREST-over-fetch pattern jarvis-core uses (£0 rule, no SDK to rot).

export const SUPABASE_ENV = { url: 'SUPABASE_URL', key: 'SUPABASE_SERVICE_KEY' } as const

export class SupabaseError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'SupabaseError'
    this.status = status
  }
}

function cfg(): { base: string; key: string } | null {
  const url = process.env[SUPABASE_ENV.url]?.trim().replace(/\/+$/, '')
  const key = process.env[SUPABASE_ENV.key]?.trim()
  if (!url || !key) return null
  return { base: `${url}/rest/v1`, key }
}

export function configured(): boolean {
  return cfg() !== null
}

type Opts = { params?: Record<string, string>; body?: unknown; prefer?: string }

async function request<T>(method: string, table: string, opts: Opts = {}): Promise<T> {
  const c = cfg()
  if (!c) throw new SupabaseError(503, 'Supabase is not configured')
  const qs = opts.params ? '?' + new URLSearchParams(opts.params).toString() : ''
  const headers: Record<string, string> = {
    apikey: c.key,
    Authorization: `Bearer ${c.key}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (opts.prefer) headers.Prefer = opts.prefer
  const r = await fetch(`${c.base}/${table}${qs}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: 'no-store',
  })
  const text = await r.text()
  if (!r.ok) {
    throw new SupabaseError(r.status, `supabase ${method} ${table} → ${r.status}: ${text.slice(0, 300)}`)
  }
  return (text ? JSON.parse(text) : null) as T
}

/** SELECT with PostgREST query params, e.g. { status: 'eq.open', order: 'open_time.desc', limit: '20' } */
export function select<T = Record<string, unknown>>(table: string, params: Record<string, string>): Promise<T[]> {
  return request<T[]>('GET', table, { params })
}

/** PATCH rows matching { col: value } (rendered as col=eq.value); returns the updated rows. */
export function update<T = Record<string, unknown>>(
  table: string,
  match: Record<string, string | number>,
  patch: Record<string, unknown>,
): Promise<T[]> {
  const params: Record<string, string> = {}
  for (const [k, v] of Object.entries(match)) params[k] = `eq.${v}`
  return request<T[]>('PATCH', table, { params, body: patch, prefer: 'return=representation' })
}

export function insert(table: string, row: Record<string, unknown>): Promise<null> {
  return request<null>('POST', table, { body: row, prefer: 'return=minimal' })
}

/** INSERT … ON CONFLICT (onConflict) DO UPDATE — needs a unique constraint on that column. */
export function upsert(table: string, row: Record<string, unknown>, onConflict = 'id'): Promise<null> {
  return request<null>('POST', table, {
    params: { on_conflict: onConflict },
    body: row,
    prefer: 'resolution=merge-duplicates,return=minimal',
  })
}

/** DELETE rows matching { col: value }. */
export function remove(table: string, match: Record<string, string | number>): Promise<null> {
  const params: Record<string, string> = {}
  for (const [k, v] of Object.entries(match)) params[k] = `eq.${v}`
  return request<null>('DELETE', table, { params, prefer: 'return=minimal' })
}
