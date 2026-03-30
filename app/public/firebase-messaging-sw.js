/* eslint-disable no-restricted-globals */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "AIzaSyDIClG8NvsTxhAjmSycRqp6XhD21blxkEY",
  authDomain: "repmax-fbc4e.firebaseapp.com",
  projectId: "repmax-fbc4e",
  storageBucket: "repmax-fbc4e.firebasestorage.app",
  messagingSenderId: "695741404430",
  appId: "1:695741404430:web:bafd0d7fe12cbc5679735f",
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {}
  const notifTitle = title || 'REPMAX'
  const notifOptions = {
    body: body || 'You have a new notification',
    icon: icon || '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    tag: payload.data?.type || 'default',
    data: { url: '/', ...payload.data },
    actions: [
      { action: 'open', title: 'Open' }
    ]
  }
  self.registration.showNotification(notifTitle, notifOptions)
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
