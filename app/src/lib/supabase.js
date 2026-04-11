import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hqwnyzmipumhhqmvdzus.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxd255em1pcHVtaGhxbXZkenVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzkxMjAsImV4cCI6MjA5MDQ1NTEyMH0.s6XMRJUli5vzyeGs8yBv5nQ7MGXhFJSLZDn_NdrFGKI'

export const SUPABASE_URL = supabaseUrl
export const SUPABASE_ANON_KEY = supabaseKey

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    storageKey: 'repmax-auth',
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: {
      // Custom storage using localStorage with error handling
      // This prevents the "always need to clear cookies" bug on Android
      getItem: (key) => {
        try { return globalThis.localStorage?.getItem(key) ?? null }
        catch { return null }
      },
      setItem: (key, value) => {
        try { globalThis.localStorage?.setItem(key, value) }
        catch { /* Android WebView may throw in incognito */ }
      },
      removeItem: (key) => {
        try { globalThis.localStorage?.removeItem(key) }
        catch {}
      }
    }
  },
  global: {
    headers: { 'x-client-info': 'repmax-app/4.0' }
  },
  db: { schema: 'public' },
  realtime: {
    params: { eventsPerSecond: 20 },
    timeout: 30000
  }
})

export async function invokeEdgeFunction(functionName, body, options = {}) {
  const {
    timeoutMs = 15000,
    requireAuth = true,
  } = options

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const headers = {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      'x-client-info': 'repmax-app/4.0'
    }

    const {
      data: { session }
    } = await supabase.auth.getSession()

    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`
    } else if (requireAuth) {
      throw new Error('You need to be signed in to use this feature.')
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body ?? {}),
      signal: controller.signal
    })

    const raw = await response.text()
    let data = null

    if (raw) {
      try {
        data = JSON.parse(raw)
      } catch {
        data = { raw }
      }
    }

    if (!response.ok) {
      const error = new Error(
        data?.error ||
        data?.message ||
        `Edge function ${functionName} failed with status ${response.status}.`
      )
      error.status = response.status
      error.payload = data
      throw error
    }

    return data
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`${functionName} timed out. Please try again.`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function invokeServerApi(path, body, options = {}) {
  const {
    timeoutMs = 15000,
    requireAuth = true,
  } = options

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const headers = {
      'Content-Type': 'application/json',
      'x-client-info': 'repmax-app/4.0'
    }

    const {
      data: { session }
    } = await supabase.auth.getSession()

    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`
    } else if (requireAuth) {
      throw new Error('You need to be signed in to use this feature.')
    }

    const response = await fetch(path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body ?? {}),
      signal: controller.signal
    })

    const raw = await response.text()
    let data = null

    if (raw) {
      try {
        data = JSON.parse(raw)
      } catch {
        data = { raw }
      }
    }

    if (!response.ok) {
      const error = new Error(
        data?.error ||
        data?.message ||
        `Request to ${path} failed with status ${response.status}.`
      )
      error.status = response.status
      error.payload = data
      throw error
    }

    return data
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`${path} timed out. Please try again.`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

// Retry wrapper
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

// Session recovery — fixes "always need to clear cookies"
export async function ensureSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) return session

    // Try to recover from localStorage directly
    const { data, error } = await supabase.auth.refreshSession()
    if (!error && data?.session) return data.session

    // If tokens are truly gone, force sign out so user gets a clean auth page
    await supabase.auth.signOut()
    return null
  } catch {
    return null
  }
}

// Auth state change listener
supabase.auth.onAuthStateChange((event) => {
  if (event === 'TOKEN_REFRESHED') console.log('[REPMAX] Token refreshed')
  if (event === 'SIGNED_OUT') {
    // Clean up any stale data
    try { localStorage.removeItem('repmax-auth') } catch {}
  }
})
