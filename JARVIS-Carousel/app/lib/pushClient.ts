// Browser-side Web Push helpers for the Trade Guard page.
// The service worker (public/sw.js, from next-pwa + worker/index.js) shows
// the notifications; these functions only manage the subscription.

export type PushState = 'unsupported' | 'nokey' | 'denied' | 'off' | 'on'

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/** Ask permission and subscribe with the VAPID public key (base64url string). */
export async function subscribePush(publicKey: string): Promise<PushSubscription> {
  if (!pushSupported()) throw new Error('push is not supported in this browser')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('notifications were not permitted')
  const reg = await navigator.serviceWorker.ready
  // The Push API accepts the base64url key as a string; that avoids the
  // BufferSource typing churn between TypeScript versions.
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey })
}

/** Unsubscribe locally; returns the endpoint so the server row can be removed. */
export async function unsubscribePush(): Promise<string | null> {
  const sub = await currentSubscription()
  if (!sub) return null
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  return endpoint
}
