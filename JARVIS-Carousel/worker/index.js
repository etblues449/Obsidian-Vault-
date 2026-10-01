/* Custom service-worker code. next-pwa bundles this directory (worker/) into
 * the generated public/sw.js, alongside its Workbox precaching.
 *
 * Handles Web Push for the Trade Guard dashboard: show the notification the
 * Pi worker sent via /api/push/send, and focus/open /trade when it is tapped. */

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Trade Guard'
  const options = {
    body: data.body || '',
    tag: data.tag || 'tradeguard',
    renotify: true,
    data: { url: data.url || '/trade' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/trade'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          if ('navigate' in c) c.navigate(url)
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
