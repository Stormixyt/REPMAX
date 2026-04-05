// REPMAX PWA Service Worker v5 — Network-first + Push Notifications
const CACHE_NAME = 'repmax-v5'
const STATIC_ASSETS = ['/', '/app.html']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  // Skip Supabase API calls — always go to network
  if (event.request.url.includes('supabase.co')) return
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})

// =====================
// PUSH NOTIFICATIONS
// =====================
self.addEventListener('push', (event) => {
  let data = {
    title: 'REPMAX',
    body: 'You have a new notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag: 'repmax-notification',
    data: {},
    actions: [],
    requireInteraction: false,
    renotify: false,
    silent: false
  }
  
  try {
    if (event.data) {
      const payload = event.data.json()
      data = {
        title: payload.title || 'REPMAX',
        body: payload.body || payload.message || 'New notification',
        icon: payload.icon || '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        tag: payload.tag || 'repmax-notification',
        data: payload.data || {},
        actions: payload.actions || [],
        requireInteraction: payload.requireInteraction === true,
        renotify: payload.renotify === true,
        silent: payload.silent === true
      }
    }
  } catch {
    if (event.data) {
      data.body = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      data: data.data,
      actions: data.actions,
      vibrate: [200, 100, 200],
      requireInteraction: data.requireInteraction,
      renotify: data.renotify,
      silent: data.silent
    })
  )
})

// Handle notification click — open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing tab if found
      for (const client of clients) {
        if (client.url.includes('repmax') && 'focus' in client) {
          return client.focus()
        }
      }
      // Otherwise open new tab
      return self.clients.openWindow(url)
    })
  )
})
