import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { getAnalytics } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: "AIzaSyDIClG8NvsTxhAjmSycRqp6XhD21blxkEY",
  authDomain: "repmax-fbc4e.firebaseapp.com",
  projectId: "repmax-fbc4e",
  storageBucket: "repmax-fbc4e.firebasestorage.app",
  messagingSenderId: "695741404430",
  appId: "1:695741404430:web:bafd0d7fe12cbc5679735f",
  measurementId: "G-QJFM9ME9GC"
}

const VAPID_KEY = 'BLSvlmEe58YkUFallFM3lXITHiEBbAzrOWc9DwFuV5QJZtKaFded_2WV_FF1oBPaJccFhZW-H82GxlY8gRG7c_0'

let app = null
let messaging = null
let analytics = null

try {
  app = initializeApp(firebaseConfig)
  // Only init analytics in browser (not during SSR/build)
  if (typeof window !== 'undefined') {
    analytics = getAnalytics(app)
    messaging = getMessaging(app)
  }
} catch (err) {
  console.warn('Firebase init:', err.message)
}

export async function requestNotificationPermission() {
  if (!messaging) return null

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.log('Notification permission denied')
      return null
    }

    // Register service worker first
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    })
    console.log('FCM Token obtained')
    return token
  } catch (err) {
    console.error('FCM token error:', err)
    return null
  }
}

export function onForegroundMessage(callback) {
  if (!messaging) return () => {}
  return onMessage(messaging, (payload) => {
    callback(payload)
  })
}

export { app, messaging, analytics }
