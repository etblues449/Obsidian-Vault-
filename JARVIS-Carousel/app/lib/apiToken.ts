'use client'

// Client-side token handling for a personal, single-user app.
//
// The API token is NOT baked into the bundle (that would re-expose it to the
// public). Instead, you append it to the URL once when you first open / install
// the app:   https://…/jarvis#token=YOUR_TOKEN
// The app captures it, stores it in localStorage, strips it from the URL, and
// sends it on every /api call thereafter. A stranger opening the bare URL has
// no token and gets 401 from the gated routes.
//
// To rotate: open the app once with a new #token=… ; it overwrites the stored one.
// To clear on a shared device: run localStorage.removeItem('jarvis_api_token').

const KEY = 'jarvis_api_token'

/** Capture ?token / #token from the URL on first load, persist, then scrub it. */
export function captureTokenFromUrl(): void {
  if (typeof window === 'undefined') return
  try {
    let tok = ''
    const h = window.location.hash
    if (h) {
      const m = h.match(/(?:^#|[#&])token=([^&]+)/)
      if (m) tok = decodeURIComponent(m[1])
    }
    if (!tok) {
      const q = new URLSearchParams(window.location.search).get('token')
      if (q) tok = q
    }
    if (tok) {
      localStorage.setItem(KEY, tok.trim())
      // Scrub the token from the address bar / history so it isn't shoulder-surfed.
      const clean = window.location.pathname + window.location.search.replace(/([?&])token=[^&]+/, '')
      window.history.replaceState(null, '', clean || window.location.pathname)
    }
  } catch {
    /* non-fatal */
  }
}

export function getToken(): string {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(KEY) || ''
  } catch {
    return ''
  }
}

export function authHeaders(base: Record<string, string> = {}): Record<string, string> {
  const t = getToken()
  return t ? { ...base, Authorization: `Bearer ${t}` } : base
}

/** Drop-in fetch that attaches the bearer token to same-origin /api calls. */
export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = authHeaders(
    (init.headers as Record<string, string>) || { 'Content-Type': 'application/json' },
  )
  return fetch(input, { ...init, headers })
}
