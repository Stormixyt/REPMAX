import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { CallProvider } from './context/CallContext'
import { LanguageProvider } from './context/LanguageContext'
import { V2Provider } from './context/V2Context'
import { ToastProvider } from './components/ui'
import App from './App'
import { isNative, initNativeApp, hideSplashScreen } from './lib/native'
import './index.css'
import './styles/v2-tokens.css'
import './styles/v2-primitives.css'
import './styles/v2-workout.css'
import './styles/v2-coach.css'
import './styles/v2-nutrition.css'
import './styles/v2-progress.css'
import './styles/v2-social.css'
import './styles/v2-profile.css'
import './styles/v2-misc.css'
import './styles/v2-auth.css'
import './styles/v2-onboarding.css'
import './styles/v2-ios.css'
import './styles/native-ios.css'

// Kick off native bootstrap (platform classes, statusbar, keyboard, haptics)
initNativeApp().catch((err) => console.warn('[REPMAX] native init failed:', err))

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <LanguageProvider>
            <CallProvider>
              <V2Provider>
                <ToastProvider>
                  <App />
                </ToastProvider>
              </V2Provider>
            </CallProvider>
          </LanguageProvider>
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  )
} catch (e) {
  console.error('[REPMAX] Fatal render error:', e)
  document.getElementById('root').innerHTML = `<div style="color:#ff4444;padding:40px;font-family:monospace;background:#070707;min-height:100vh"><h2>REPMAX failed to load</h2><pre>${e?.message}\n${e?.stack}</pre></div>`
}

// Hide native splash once the app has a chance to paint.
// Two rAFs guarantees the React tree has committed at least once.
if (typeof window !== 'undefined') {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      hideSplashScreen()
      document.body.classList.add('app-ready')
    })
  })
}
// Fallback — never leave the user staring at splash forever
setTimeout(() => {
  hideSplashScreen()
  document.body.classList.add('app-ready')
}, 1500)

if (!isNative && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
