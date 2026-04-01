import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hqwnyzmipumhhqmvdzus.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxd255em1pcHVtaGhxbXZkenVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzkxMjAsImV4cCI6MjA5MDQ1NTEyMH0.s6XMRJUli5vzyeGs8yBv5nQ7MGXhFJSLZDn_NdrFGKI'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    storageKey: 'repmax-auth',
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  },
  global: {
    headers: {
      'x-client-info': 'repmax-app/3.0'
    }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Retry wrapper for Supabase calls that may fail due to rate limits or network issues
export async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fn()
      if (result?.error) {
        const status = result.error?.status || result.error?.code
        // Rate limited or server error — retry with backoff
        if ((status === 429 || status >= 500) && attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 500 + Math.random() * 300
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }
      return result
    } catch (err) {
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 500 + Math.random() * 300
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw err
    }
  }
}

// Session refresh helper for Android WebView (background kills can expire sessions)
export async function ensureSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    const { data, error } = await supabase.auth.refreshSession()
    if (error) {
      console.warn('Session refresh failed:', error.message)
      return null
    }
    return data.session
  }
  return session
}

// Listen for auth state changes and handle token refresh
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('[REPMAX] Token refreshed successfully')
  }
  if (event === 'SIGNED_OUT') {
    console.log('[REPMAX] User signed out')
  }
})
