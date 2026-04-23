/**
 * native.js — Platform abstraction layer for Capacitor
 * 
 * Detects whether the app is running inside a native iOS shell (Capacitor)
 * or in a standard browser, and provides unified wrappers for native APIs.
 * 
 * Usage:
 *   import { isNative, platform, nativeCamera, nativeHaptics, ... } from './native'
 */

import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Geolocation } from '@capacitor/geolocation'
import { Share } from '@capacitor/share'
import { Browser } from '@capacitor/browser'
import { App } from '@capacitor/app'
import { Keyboard } from '@capacitor/keyboard'
import { LocalNotifications } from '@capacitor/local-notifications'

// ── Platform Detection ──
export const isNative = Capacitor.isNativePlatform()
export const platform = Capacitor.getPlatform() // 'ios' | 'android' | 'web'
export const isIOS = platform === 'ios'

// ── Status Bar ──
export async function initStatusBar() {
  if (!isNative) return
  try {
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setOverlaysWebView({ overlay: true })
  } catch (e) {
    console.warn('[native] StatusBar init failed:', e.message)
  }
}

// ── Platform body classes ─────────────────────────────
// Applied once at boot so CSS can specialise per-platform
export function applyPlatformClasses() {
  if (typeof document === 'undefined') return
  const body = document.body
  if (!body) return
  body.classList.toggle('native-platform', isNative)
  body.classList.toggle('web-platform', !isNative)
  body.classList.toggle('native-ios', isNative && isIOS)
  body.classList.toggle('native-android', isNative && platform === 'android')
}

// ── Native keyboard (iOS/Android) ─────────────────────
// Listens to Capacitor Keyboard plugin and mirrors state onto <body>
// as `kb-open` and a CSS variable `--kb-offset` so the web UI can
// lift composers / hide nav consistently.
export function initNativeKeyboard() {
  if (!isNative) return () => {}
  const root = document.documentElement
  const body = document.body

  const show = (info) => {
    const height = info?.keyboardHeight || 0
    root.style.setProperty('--kb-offset', `${Math.round(height)}px`)
    body?.classList.add('kb-open')
  }
  const hide = () => {
    root.style.setProperty('--kb-offset', '0px')
    body?.classList.remove('kb-open')
  }

  let showL, hideL
  try {
    Keyboard.addListener('keyboardWillShow', show).then(h => { showL = h })
    Keyboard.addListener('keyboardDidShow', show).then(h => { showL = h })
    Keyboard.addListener('keyboardWillHide', hide).then(h => { hideL = h })
    Keyboard.addListener('keyboardDidHide', hide).then(h => { hideL = h })
  } catch {}

  // Keyboard should never resize the webview (we handle it in CSS)
  try { Keyboard.setResizeMode?.({ mode: 'none' }) } catch {}
  try { Keyboard.setScroll?.({ isDisabled: true }) } catch {}

  return () => {
    try { showL?.remove() } catch {}
    try { hideL?.remove() } catch {}
  }
}

// ── Tap haptic — unified helper for buttons/nav ────────
// Safe to call from web (no-op). Default: selection-like tick.
export function tapHaptic(style = 'selection') {
  if (!isNative) return
  try {
    if (style === 'selection') {
      Haptics.selectionStart().then(() => Haptics.selectionEnd()).catch(() => {})
    } else if (style === 'light') {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
    } else if (style === 'medium') {
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {})
    } else if (style === 'heavy') {
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {})
    } else if (style === 'success') {
      Haptics.notification({ type: NotificationType.Success }).catch(() => {})
    } else if (style === 'warning') {
      Haptics.notification({ type: NotificationType.Warning }).catch(() => {})
    } else if (style === 'error') {
      Haptics.notification({ type: NotificationType.Error }).catch(() => {})
    }
  } catch {}
}

// Global auto-haptic on common interactive elements.
// By default fires `selection` on bottom-nav, fab, primary buttons,
// settings items, chat list rows, and quick actions — matching the
// Apple HIG feel. Opt-out anywhere with `data-no-haptic`.
// Override style per-element with `data-haptic="medium"` etc.
const HAPTIC_SELECTORS = [
  '.bottom-nav-item',
  '.v2-tabbar__item',
  '.v2-fab',
  '.btn-primary',
  '.btn-accent',
  '.settings-item',
  '.chat-list-item',
  '.quick-action',
  '.v2-card--interactive',
  '[data-haptic]',
  '.haptic',
]

export function installTapHapticDelegate() {
  if (!isNative || typeof document === 'undefined') return () => {}
  const selector = HAPTIC_SELECTORS.join(',')
  const handler = (e) => {
    let el = e.target
    while (el && el !== document.body) {
      if (el.dataset?.noHaptic !== undefined) return
      if (el.matches?.(selector)) {
        tapHaptic(el.dataset?.haptic || 'selection')
        return
      }
      el = el.parentElement
    }
  }
  document.addEventListener('pointerdown', handler, { passive: true })
  return () => document.removeEventListener('pointerdown', handler)
}

// ── Splash Screen ──
export async function hideSplashScreen() {
  if (!isNative) return
  try {
    await SplashScreen.hide({ fadeOutDuration: 300 })
  } catch (e) {
    console.warn('[native] SplashScreen hide failed:', e.message)
  }
}

// ── Haptic Feedback ──
export async function hapticImpact(style = 'Medium') {
  if (!isNative) return
  try {
    await Haptics.impact({ style: ImpactStyle[style] || ImpactStyle.Medium })
  } catch (e) {
    // Silently fail — haptics are a nice-to-have
  }
}

export async function hapticNotification(type = 'Success') {
  if (!isNative) return
  try {
    await Haptics.notification({ type: NotificationType[type] || NotificationType.Success })
  } catch (e) {}
}

export async function hapticSelection() {
  if (!isNative) return
  try {
    await Haptics.selectionStart()
    await Haptics.selectionChanged()
    await Haptics.selectionEnd()
  } catch (e) {}
}

// ── Camera ──
export async function takePhoto(options = {}) {
  if (!isNative) return null
  try {
    const image = await Camera.getPhoto({
      quality: options.quality || 80,
      allowEditing: options.allowEditing ?? false,
      resultType: CameraResultType.DataUrl,
      source: options.source === 'gallery' ? CameraSource.Photos : CameraSource.Prompt,
      width: options.width || 1200,
      height: options.height || 1200,
      correctOrientation: true,
      presentationStyle: 'fullScreen',
      ...options,
    })
    return image // { dataUrl, format, saved, ... }
  } catch (e) {
    if (e.message?.includes('cancelled') || e.message?.includes('User cancelled')) {
      return null // User cancelled — not an error
    }
    console.error('[native] Camera error:', e)
    throw e
  }
}

// ── Geolocation ──
export async function getCurrentPosition(options = {}) {
  if (!isNative) {
    // Fall back to web API
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        ...options,
      })
    })
  }
  try {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      ...options,
    })
    return pos
  } catch (e) {
    console.error('[native] Geolocation error:', e)
    throw e
  }
}

export async function watchPosition(callback, options = {}) {
  if (!isNative) {
    // Fall back to web API
    const watchId = navigator.geolocation.watchPosition(callback, (e) => {
      console.error('[web] Geolocation watch error:', e)
    }, {
      enableHighAccuracy: true,
      ...options,
    })
    return () => navigator.geolocation.clearWatch(watchId)
  }
  try {
    const watchId = await Geolocation.watchPosition({
      enableHighAccuracy: true,
      ...options,
    }, callback)
    return () => Geolocation.clearWatch({ id: watchId })
  } catch (e) {
    console.error('[native] Geolocation watch error:', e)
    throw e
  }
}

// ── Share ──
export async function nativeShare(options = {}) {
  if (!isNative && navigator.share) {
    try {
      await navigator.share(options)
      return true
    } catch { return false }
  }
  if (!isNative) return false
  try {
    await Share.share({
      title: options.title || 'REPMAX',
      text: options.text || '',
      url: options.url || '',
      dialogTitle: options.dialogTitle || 'Share',
    })
    return true
  } catch (e) {
    if (e.message?.includes('cancelled')) return false
    console.error('[native] Share error:', e)
    return false
  }
}

// ── Browser (open external links) ──
export async function openExternal(url) {
  if (!isNative) {
    window.open(url, '_blank', 'noopener')
    return
  }
  try {
    await Browser.open({ url, presentationStyle: 'popover' })
  } catch (e) {
    window.open(url, '_blank')
  }
}

// ── App lifecycle ──
export async function addAppStateListener(callback) {
  if (!isNative) return () => {}
  try {
    const listener = await App.addListener('appStateChange', callback)
    return () => listener.remove()
  } catch { return () => {} }
}

export async function addAppUrlOpenListener(callback) {
  if (!isNative) return () => {}
  try {
    const listener = await App.addListener('appUrlOpen', callback)
    return () => listener.remove()
  } catch { return () => {} }
}

// ── Keyboard ──
export async function addKeyboardListeners(onShow, onHide) {
  if (!isNative) return () => {}
  try {
    const showListener = await Keyboard.addListener('keyboardWillShow', onShow)
    const hideListener = await Keyboard.addListener('keyboardWillHide', onHide)
    return () => {
      showListener.remove()
      hideListener.remove()
    }
  } catch { return () => {} }
}

// ── Local Notifications ──
export async function scheduleLocalNotification(options = {}) {
  if (!isNative) return
  try {
    await LocalNotifications.schedule({
      notifications: [{
        title: options.title || 'REPMAX',
        body: options.body || '',
        id: options.id || Date.now(),
        schedule: options.schedule, // { at: Date, ... }
        sound: options.sound || undefined,
        extra: options.extra || {},
      }]
    })
  } catch (e) {
    console.error('[native] Local notification error:', e)
  }
}

// ── Init all native services ──
export async function initNativeApp() {
  applyPlatformClasses()

  if (!isNative) return

  console.log(`[REPMAX] Running on native ${platform}`)

  await initStatusBar()

  // Keyboard dark mode + listeners
  try {
    await Keyboard.setStyle({ style: 'DARK' })
  } catch {}
  initNativeKeyboard()

  // Delegate haptics on tap for any [data-haptic] element
  installTapHapticDelegate()

  // Mark ready — enables native-ios splash fade
  if (typeof document !== 'undefined') {
    requestAnimationFrame(() => document.body.classList.add('app-ready'))
  }
}
