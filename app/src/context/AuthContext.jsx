import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)
  const initDone = useRef(false)

  useEffect(() => {
    mounted.current = true
    if (initDone.current) return // Prevent re-init on HMR / strict mode
    initDone.current = true

    startAuth()

    return () => { mounted.current = false }
  }, [])

  async function startAuth() {
    // Hard timeout — never stay loading more than 6 seconds
    const timeout = setTimeout(() => {
      if (mounted.current && loading) {
        console.warn('[REPMAX] Auth timeout reached')
        setLoading(false)
        // Don't sign out here — just let the app render
        // If user exists but profile is null, they'll see an empty dashboard
        // which is better than being kicked to login
      }
    }, 6000)

    try {
      // 1. Try to get existing session
      const { data: { session } } = await supabase.auth.getSession()

      if (!mounted.current) { clearTimeout(timeout); return }

      if (session?.user) {
        setUser(session.user)
        // 2. Load profile — with its own timeout
        const profileLoaded = await loadProfileWithTimeout(session.user.id, 5000)
        if (mounted.current) {
          setLoading(false)
        }
      } else {
        // No session
        if (mounted.current) {
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
      }
    } catch (err) {
      console.warn('[REPMAX] Auth init error:', err)
      if (mounted.current) setLoading(false)
    }

    clearTimeout(timeout)

    // 3. Listen for future auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted.current) return

        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          await loadProfileWithTimeout(session.user.id, 5000)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user)
          // Only reload profile if we don't have one
          if (!profile) {
            await loadProfileWithTimeout(session.user.id, 3000)
          }
        }
      }
    )

    // Store cleanup
    const cleanup = () => {
      mounted.current = false
      subscription.unsubscribe()
    }
    // Can't return cleanup from async function, but mounted.current handles it
  }

  async function loadProfileWithTimeout(userId, timeoutMs) {
    return new Promise(async (resolve) => {
      const timer = setTimeout(() => {
        console.warn('[REPMAX] Profile fetch timed out')
        resolve(false)
      }, timeoutMs)

      try {
        const { data, error } = await supabase
          .from('profiles').select('*').eq('id', userId).single()

        clearTimeout(timer)

        if (!mounted.current) { resolve(false); return }

        if (error) {
          // New user — profile may not exist yet
          if (error.code === 'PGRST116') {
            // Wait and retry once
            await new Promise(r => setTimeout(r, 1000))
            const { data: retry } = await supabase
              .from('profiles').select('*').eq('id', userId).single()
            if (retry && mounted.current) {
              await ensureFriendCode(retry, userId)
              resolve(true)
              return
            }
          }
          resolve(false)
          return
        }

        if (data && mounted.current) {
          await ensureFriendCode(data, userId)
          resolve(true)
        } else {
          resolve(false)
        }
      } catch {
        clearTimeout(timer)
        resolve(false)
      }
    })
  }

  async function ensureFriendCode(data, userId) {
    if (!data.friend_code) {
      const code = genCode()
      const { data: updated } = await supabase
        .from('profiles').update({ friend_code: code })
        .eq('id', userId).select().single()
      if (mounted.current) setProfile(updated || { ...data, friend_code: code })
    } else {
      if (mounted.current) setProfile(data)
    }
  }

  function genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
    return code
  }

  async function updateProfile(updates) {
    if (!user) return { error: 'Not authenticated' }
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id).select().single()
    if (!error && data) setProfile(data)
    return { data, error }
  }

  const signUp = async (email, password, displayName) =>
    supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } })

  const signIn = async (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    try { localStorage.removeItem('repmax-auth') } catch {}
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signUp, signIn, signOut, updateProfile,
      fetchProfile: () => user && loadProfileWithTimeout(user.id, 5000),
      isOnboarded: profile?.onboarded === true,
      isPro: profile?.subscription_status === 'pro' || (profile?.pro_until && new Date(profile.pro_until) > new Date())
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
