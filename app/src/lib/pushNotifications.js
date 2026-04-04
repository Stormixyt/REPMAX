// Push notification system for REPMAX
// Uses Web Push API with the service worker

// The VAPID Public Key must match your backend's VAPID keys!
const VAPID_PUBLIC_KEY = 'BNBo_jz-q5KOGSbK1Y43HB_UoZim9DwFNVOPGmUThMBDYihvSnX2zPCpqtck6NSiUE--C7ag2p5N4vv97aXh_Hg='

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false
  if (!('serviceWorker' in navigator)) return false
  
  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

export async function subscribeToPush(userId = null) {
  try {
    const granted = await requestNotificationPermission()
    if (!granted) return null

    const registration = await navigator.serviceWorker.ready
    
    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription()
    
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      })
    }

    if (subscription && userId) {
      const { supabase } = await import('./supabase')
      await supabase.from('profiles').update({
        push_subscription: JSON.parse(JSON.stringify(subscription))
      }).eq('id', userId)
    }

    return subscription
  } catch (err) {
    console.warn('[REPMAX] Push subscription failed:', err)
    return null
  }
}

export function showLocalNotification(title, body, options = {}) {
  if (Notification.permission !== 'granted') return
  
  navigator.serviceWorker.ready.then(registration => {
    registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      tag: options.tag || 'repmax-' + Date.now(),
      vibrate: [200, 100, 200],
      data: options.data || {},
      ...options
    })
  })
}

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
