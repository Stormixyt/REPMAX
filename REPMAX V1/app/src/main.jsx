import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { CallProvider } from './context/CallContext'
import { LanguageProvider } from './context/LanguageContext'
import App from './App'
import { isNative, initNativeApp, hideSplashScreen } from './lib/native'
import './index.css'

initNativeApp()

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <LanguageProvider>
            <CallProvider>
              <App />
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

// Always hide splash — even on error, don't leave user staring at splash forever
setTimeout(() => hideSplashScreen(), 500)

if (!isNative && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
