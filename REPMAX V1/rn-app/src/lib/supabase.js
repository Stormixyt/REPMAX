import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

const supabaseUrl = 'https://hqwnyzmipumhhqmvdzus.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxd255em1pcHVtaGhxbXZkenVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzkxMjAsImV4cCI6MjA5MDQ1NTEyMH0.s6XMRJUli5vzyeGs8yBv5nQ7MGXhFJSLZDn_NdrFGKI'

export const SUPABASE_URL = supabaseUrl
export const SUPABASE_ANON_KEY = supabaseKey

const API_BASE = 'https://www.rep-max.app'

const ExpoSecureStoreAdapter = {
  getItem: async (key) => {
    try {
      return await SecureStore.getItemAsync(key)
    } catch {
      return null
    }
  },
  setItem: async (key, value) => {
    try {
      await SecureStore.setItemAsync(key, value)
    } catch {}
  },
  removeItem: async (key) => {
    try {
      await SecureStore.deleteItemAsync(key)
    } catch {}
  },
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    storageKey: 'repmax-auth',
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
    storage: ExpoSecureStoreAdapter,
  },
  global: {
    headers: { 'x-client-info': 'repmax-rn/1.0' },
  },
  db: { schema: 'public' },
  realtime: {
    params: { eventsPerSecond: 20 },
    timeout: 30000,
  },
})

function extractApiErrorMessage(payload, fallback) {
  if (!payload) return fallback
  if (typeof payload === 'string') return payload
  if (typeof payload?.error === 'string') return payload.error
  if (typeof payload?.message === 'string') return payload.message
  if (typeof payload?.raw === 'string') return payload.raw
  if (payload?.error && typeof payload.error === 'object') {
    if (typeof payload.error.message === 'string') return payload.error.message
    try { return JSON.stringify(payload.error) } catch { return fallback }
  }
  if (Array.isArray(payload?.errors) && payload.errors.length) {
    const first = payload.errors.find(e => typeof e === 'string' || typeof e?.message === 'string')
    if (typeof first === 'string') return first
    if (typeof first?.message === 'string') return first.message
  }
  if (payload && typeof payload === 'object') {
    try { return JSON.stringify(payload) } catch { return fallback }
  }
  return fallback
}

async function getValidAccessToken() {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) return session.access_token
  const recovered = await ensureSession()
  if (recovered?.access_token) return recovered.access_token
  return null
}

export async function invokeEdgeFunction(functionName, body, options = {}) {
  const { timeoutMs = 15000, requireAuth = true } = options
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const headers = {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      'x-client-info': 'repmax-rn/1.0',
    }
    const accessToken = await getValidAccessToken()
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    } else if (requireAuth) {
      throw new Error('You need to be signed in to use this feature.')
    }
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    })
    const raw = await response.text()
    let data = null
    if (raw) {
      try { data = JSON.parse(raw) } catch { data = { raw } }
    }
    if (!response.ok) {
      const error = new Error(extractApiErrorMessage(data, `Edge function ${functionName} failed with status ${response.status}.`))
      error.status = response.status
      error.payload = data
      throw error
    }
    return data
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`${functionName} timed out. Please try again.`)
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function invokeServerApi(path, body, options = {}) {
  const { timeoutMs = 15000, requireAuth = true } = options
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const headers = {
      'Content-Type': 'application/json',
      'x-client-info': 'repmax-rn/1.0',
    }
    const accessToken = await getValidAccessToken()
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    } else if (requireAuth) {
      throw new Error('You need to be signed in to use this feature.')
    }
    const response = await fetch(API_BASE + path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    })
    const raw = await response.text()
    let data = null
    if (raw) {
      try { data = JSON.parse(raw) } catch { data = { raw } }
    }
    if (!response.ok) {
      const error = new Error(extractApiErrorMessage(data, `Request to ${path} failed with status ${response.status}.`))
      error.status = response.status
      error.payload = data
      throw error
    }
    return data
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`${path} timed out. Please try again.`)
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fn()
      if (result?.error) {
        const status = result.error?.status || result.error?.code
        if ((status === 429 || status >= 500) && attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500 + Math.random() * 300))
          continue
        }
      }
      return result
    } catch (err) {
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500 + Math.random() * 300))
        continue
      }
      throw err
    }
  }
}

export async function ensureSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) return session
    const { data, error } = await supabase.auth.refreshSession()
    if (!error && data?.session) return data.session
    await supabase.auth.signOut()
    return null
  } catch {
    return null
  }
}

supabase.auth.onAuthStateChange((event) => {
  if (event === 'TOKEN_REFRESHED') console.log('[REPMAX] Token refreshed')
})
