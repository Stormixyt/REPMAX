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
  if (!isNative) return

  console.log(`[REPMAX] Running on native ${platform}`)

  await initStatusBar()
  
  // Keyboard dark mode
  try {
    await Keyboard.setStyle({ style: 'DARK' })
  } catch {}
}
