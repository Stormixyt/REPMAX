// Push notification system for REPMAX
// Uses Web Push API with the service worker

// The VAPID Public Key must match your backend's VAPID keys!
const VAPID_PUBLIC_KEY = 'BNBo_jz-q5KOGSbK1Y43HB_UoZim9DwFNVOPGmUThMBDYihvSnX2zPCpqtck6NSiUE--C7ag2p5N4vv97aXh_Hg'
const PUSH_SYNC_KEY = 'repmax-push-last-sync'
const PUSH_DEVICE_ID_KEY = 'repmax-push-device-id'

function canUsePushNotifications() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true
}

export function getPushSupportState() {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isiPhone = /iPad|iPhone|iPod/.test(userAgent)

  return {
    supported: canUsePushNotifications(),
    isiPhone,
    standalone: isStandaloneDisplayMode(),
    requiresInstalledApp: isiPhone && !isStandaloneDisplayMode()
  }
}

function readLastPushSync() {
  try {
    return localStorage.getItem(PUSH_SYNC_KEY)
  } catch {
    return null
  }
}

function getPushDeviceId() {
  try {
    const existing = localStorage.getItem(PUSH_DEVICE_ID_KEY)
    if (existing) return existing
    const nextId = crypto.randomUUID()
    localStorage.setItem(PUSH_DEVICE_ID_KEY, nextId)
    return nextId
  } catch {
    return `repmax-${Date.now()}`
  }
}

function serializeSubscription(subscription) {
  return JSON.parse(JSON.stringify(subscription))
}

async function getServiceWorkerRegistration() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null

  let registration = await navigator.serviceWorker.getRegistration('/')

  if (!registration) {
    registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  }

  await registration.update().catch(() => {})
  await navigator.serviceWorker.ready
  return registration
}

async function persistSubscription(userId, subscription) {
  if (!userId || !subscription) return

  const { supabase } = await import('./supabase')
  const serialized = serializeSubscription(subscription)
  const syncedAt = new Date().toISOString()

  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!profileError && profile && Object.prototype.hasOwnProperty.call(profile, 'push_subscriptions')) {
      const deviceId = getPushDeviceId()
      const currentEntries = Array.isArray(profile.push_subscriptions) ? profile.push_subscriptions : []
      const nextEntries = [
        ...currentEntries.filter((entry) => {
          const endpoint = entry?.subscription?.endpoint || entry?.endpoint
          return entry?.device_id !== deviceId && endpoint !== serialized.endpoint
        }),
        {
          device_id: deviceId,
          endpoint: serialized.endpoint,
          subscription: serialized,
          updated_at: syncedAt,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        }
      ]

      const { error: multiDeviceError } = await supabase
        .from('profiles')
        .update({
          push_subscriptions: nextEntries,
          push_subscription: serialized
        })
        .eq('id', userId)

      if (!multiDeviceError) {
        try {
          localStorage.setItem(PUSH_SYNC_KEY, syncedAt)
        } catch {}
        return
      }

      console.warn('[REPMAX] Failed to persist multi-device push subscription, falling back to legacy field:', multiDeviceError)
    }
  } catch (error) {
    console.warn('[REPMAX] Failed to inspect push profile before syncing:', error)
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      push_subscription: serialized
    })
    .eq('id', userId)

  if (error) {
    console.warn('[REPMAX] Failed to persist push subscription:', error)
    return
  }

  try {
    localStorage.setItem(PUSH_SYNC_KEY, syncedAt)
  } catch {}
}

export async function requestNotificationPermission() {
  if (!canUsePushNotifications()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

export async function subscribeToPush(userId = null, { prompt = true } = {}) {
  try {
    if (!canUsePushNotifications()) return null

    const granted = Notification.permission === 'granted'
      ? true
      : prompt
        ? await requestNotificationPermission()
        : false

    if (!granted) return null

    const registration = await getServiceWorkerRegistration()
    if (!registration) return null

    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      })
    }

    if (subscription && userId) {
      await persistSubscription(userId, subscription)
    }

    return subscription
  } catch (err) {
    console.warn('[REPMAX] Push subscription failed:', err)
    return null
  }
}

export async function syncPushSubscription(userId = null) {
  if (!userId) return null
  if (!canUsePushNotifications()) return null
  if (Notification.permission !== 'granted') return null

  return subscribeToPush(userId, { prompt: false })
}

export async function getPushDeviceStatus() {
  const support = getPushSupportState()
  const permission = canUsePushNotifications() ? Notification.permission : 'unsupported'
  const lastSyncedAt = readLastPushSync()

  if (!support.supported) {
    return {
      ...support,
      permission,
      hasRegistration: false,
      subscribed: false,
      lastSyncedAt,
      endpointPreview: null,
      error: null,
    }
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration('/')
    const subscription = registration ? await registration.pushManager.getSubscription() : null

    return {
      ...support,
      permission,
      hasRegistration: Boolean(registration),
      subscribed: Boolean(subscription),
      lastSyncedAt,
      endpointPreview: subscription?.endpoint ? subscription.endpoint.slice(-22) : null,
      error: null,
    }
  } catch (error) {
    console.warn('[REPMAX] Failed to inspect push device status:', error)
    return {
      ...support,
      permission,
      hasRegistration: false,
      subscribed: false,
      lastSyncedAt,
      endpointPreview: null,
      error,
    }
  }
}

export function showLocalNotification(title, body, options = {}) {
  if (!canUsePushNotifications()) return
  if (Notification.permission !== 'granted') return

  getServiceWorkerRegistration().then(registration => {
    if (!registration) return
    registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
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
